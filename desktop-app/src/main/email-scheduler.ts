/**
 * Email Scheduler
 * 
 * Manages scheduled email sending and email snoozing functionality
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import log from 'electron-log'
import { v4 as uuidv4 } from 'uuid'

interface ScheduledEmail {
  id: string
  accountId: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  attachments?: any[]
  scheduledTime: Date
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  createdAt: Date
  sentAt?: Date
  errorMessage?: string
  retryCount: number
  maxRetries: number
}

interface SnoozedEmail {
  id: string
  originalMessageId: string
  accountId: string
  snoozeUntil: Date
  reason: string
  createdAt: Date
  status: 'snoozed' | 'unsnoozed' | 'deleted'
}

interface SchedulerStorage {
  scheduledEmails: Record<string, ScheduledEmail>
  snoozedEmails: Record<string, SnoozedEmail>
}

export class EmailScheduler {
  private dataPath: string
  private scheduledEmails: Map<string, ScheduledEmail> = new Map()
  private snoozedEmails: Map<string, SnoozedEmail> = new Map()
  private processingTimer: NodeJS.Timeout | null = null
  private isActive = false

  constructor() {
    const userDataPath = app.getPath('userData')
    const schedulerDir = join(userDataPath, 'email-scheduler')
    
    // Ensure directory exists
    if (!existsSync(schedulerDir)) {
      mkdirSync(schedulerDir, { recursive: true })
    }
    
    this.dataPath = join(schedulerDir, 'scheduled-emails.json')
    this.loadScheduledEmails()
  }

  private loadScheduledEmails(): void {
    try {
      if (existsSync(this.dataPath)) {
        const data = JSON.parse(readFileSync(this.dataPath, 'utf8')) as SchedulerStorage
        
        // Load scheduled emails
        for (const [id, email] of Object.entries(data.scheduledEmails)) {
          email.scheduledTime = new Date(email.scheduledTime)
          email.createdAt = new Date(email.createdAt)
          if (email.sentAt) email.sentAt = new Date(email.sentAt)
          this.scheduledEmails.set(id, email)
        }
        
        // Load snoozed emails  
        for (const [id, snooze] of Object.entries(data.snoozedEmails)) {
          snooze.snoozeUntil = new Date(snooze.snoozeUntil)
          snooze.createdAt = new Date(snooze.createdAt)
          this.snoozedEmails.set(id, snooze)
        }
        
        log.info(`Loaded ${this.scheduledEmails.size} scheduled emails and ${this.snoozedEmails.size} snoozed emails`)
      }
    } catch (error) {
      log.error('Failed to load scheduled emails:', error)
    }
  }

  private saveScheduledEmails(): void {
    try {
      const scheduledEmailsObj: Record<string, ScheduledEmail> = {}
      for (const [id, email] of this.scheduledEmails.entries()) {
        scheduledEmailsObj[id] = email
      }

      const snoozedEmailsObj: Record<string, SnoozedEmail> = {}
      for (const [id, snooze] of this.snoozedEmails.entries()) {
        snoozedEmailsObj[id] = snooze
      }

      const data: SchedulerStorage = {
        scheduledEmails: scheduledEmailsObj,
        snoozedEmails: snoozedEmailsObj
      }

      writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
      log.error('Failed to save scheduled emails:', error)
    }
  }

  async initialize(): Promise<void> {
    this.isActive = true
    this.startProcessing()
    log.info('Email scheduler initialized')
  }

  async cleanup(): Promise<void> {
    this.isActive = false
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = null
    }
    log.info('Email scheduler cleaned up')
  }

  private startProcessing(): void {
    if (this.processingTimer) return

    // Check every minute for emails to send or unsnooze
    this.processingTimer = setInterval(async () => {
      await this.processScheduledEmails()
      await this.processSnoozedEmails()
    }, 60000) // 1 minute intervals

    // Also process immediately
    setTimeout(() => {
      this.processScheduledEmails()
      this.processSnoozedEmails()
    }, 5000)
  }

  private async processScheduledEmails(): Promise<void> {
    const now = new Date()
    const emailsToSend = Array.from(this.scheduledEmails.values())
      .filter(email => 
        email.status === 'pending' && 
        email.scheduledTime <= now
      )

    for (const email of emailsToSend) {
      await this.sendScheduledEmail(email)
    }
  }

  private async processSnoozedEmails(): Promise<void> {
    const now = new Date()
    const emailsToUnsnooze = Array.from(this.snoozedEmails.values())
      .filter(snooze => 
        snooze.status === 'snoozed' && 
        snooze.snoozeUntil <= now
      )

    for (const snooze of emailsToUnsnooze) {
      await this.unsnoozeEmail(snooze)
    }
  }

  private async sendScheduledEmail(email: ScheduledEmail): Promise<void> {
    try {
      // Use the main mail service to send the email
      const rustEngine = require('../lib/rust-engine')
      
      const success = await rustEngine.sendMessage(email.accountId, {
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        body: email.body,
        attachments: email.attachments
      })

      if (success) {
        email.status = 'sent'
        email.sentAt = new Date()
        log.info(`Sent scheduled email: ${email.subject}`)
      } else {
        throw new Error('Failed to send email via engine')
      }
    } catch (error) {
      email.retryCount++
      email.errorMessage = error instanceof Error ? error.message : 'Send failed'
      
      if (email.retryCount >= email.maxRetries) {
        email.status = 'failed'
        log.error(`Failed to send scheduled email after ${email.maxRetries} retries: ${email.subject}`)
      } else {
        log.warn(`Failed to send scheduled email (retry ${email.retryCount}/${email.maxRetries}): ${email.subject}`)
      }
    }

    this.scheduledEmails.set(email.id, email)
    this.saveScheduledEmails()
  }

  private async unsnoozeEmail(snooze: SnoozedEmail): Promise<void> {
    try {
      // Mark the email as unsnoozed (bring it back to inbox)
      snooze.status = 'unsnoozed'
      this.snoozedEmails.set(snooze.id, snooze)
      this.saveScheduledEmails()
      
      // TODO: Trigger email client refresh to show the unsnoozed email
      log.info(`Unsnoozed email: ${snooze.originalMessageId}`)
    } catch (error) {
      log.error(`Failed to unsnooze email: ${snooze.originalMessageId}`, error)
    }
  }

  // Public API methods

  async scheduleEmail(emailData: {
    accountId: string
    to: string[]
    cc?: string[]
    bcc?: string[]
    subject: string
    body: string
    attachments?: any[]
    scheduledTime: Date
  }): Promise<string> {
    const id = uuidv4()
    const scheduledEmail: ScheduledEmail = {
      id,
      ...emailData,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3
    }

    this.scheduledEmails.set(id, scheduledEmail)
    this.saveScheduledEmails()
    
    log.info(`Scheduled email for ${scheduledEmail.scheduledTime.toISOString()}: ${scheduledEmail.subject}`)
    return id
  }

  async cancelScheduledEmail(emailId: string): Promise<boolean> {
    const email = this.scheduledEmails.get(emailId)
    if (!email || email.status !== 'pending') return false

    email.status = 'cancelled'
    this.scheduledEmails.set(emailId, email)
    this.saveScheduledEmails()
    
    log.info(`Cancelled scheduled email: ${emailId}`)
    return true
  }

  async snoozeEmail(messageId: string, accountId: string, snoozeUntil: Date, reason: string): Promise<string> {
    const id = uuidv4()
    const snoozedEmail: SnoozedEmail = {
      id,
      originalMessageId: messageId,
      accountId,
      snoozeUntil,
      reason,
      createdAt: new Date(),
      status: 'snoozed'
    }

    this.snoozedEmails.set(id, snoozedEmail)
    this.saveScheduledEmails()
    
    log.info(`Snoozed email ${messageId} until ${snoozeUntil.toISOString()}`)
    return id
  }

  async unsnoozeEmailManually(snoozeId: string): Promise<boolean> {
    const snooze = this.snoozedEmails.get(snoozeId)
    if (!snooze || snooze.status !== 'snoozed') return false

    await this.unsnoozeEmail(snooze)
    return true
  }

  async getScheduledEmails(): Promise<ScheduledEmail[]> {
    return Array.from(this.scheduledEmails.values())
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())
  }

  async getSnoozedEmails(): Promise<SnoozedEmail[]> {
    return Array.from(this.snoozedEmails.values())
      .filter(snooze => snooze.status === 'snoozed')
      .sort((a, b) => a.snoozeUntil.getTime() - b.snoozeUntil.getTime())
  }

  async getSchedulerStats(): Promise<{
    scheduledCount: number
    snoozedCount: number
    sentToday: number
    failedToday: number
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const scheduledEmails = Array.from(this.scheduledEmails.values())
    const snoozedEmails = Array.from(this.snoozedEmails.values())

    return {
      scheduledCount: scheduledEmails.filter(e => e.status === 'pending').length,
      snoozedCount: snoozedEmails.filter(s => s.status === 'snoozed').length,
      sentToday: scheduledEmails.filter(e => e.sentAt && e.sentAt >= today).length,
      failedToday: scheduledEmails.filter(e => e.status === 'failed' && e.createdAt >= today).length
    }
  }
}