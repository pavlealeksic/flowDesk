/**
 * Email Rules and Automation Engine
 * 
 * Processes email rules, filters, and automated actions
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import log from 'electron-log'
import { v4 as uuidv4 } from 'uuid'

interface EmailRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  accountId?: string // If rule is account-specific
  conditions: {
    field: 'from' | 'to' | 'subject' | 'body' | 'size' | 'hasAttachments' | 'date'
    operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex' | 'greaterThan' | 'lessThan'
    value: string | number | boolean
    caseSensitive?: boolean
  }[]
  conditionOperator: 'AND' | 'OR'
  actions: {
    type: 'move' | 'copy' | 'label' | 'forward' | 'autoReply' | 'markRead' | 'markStarred' | 'delete' | 'archive'
    parameters: Record<string, any>
  }[]
  createdAt: Date
  updatedAt: Date
  appliedCount: number
}

interface EmailMessage {
  id: string
  accountId: string
  from: { name: string; address: string }
  to: { name: string; address: string }[]
  subject: string
  body: string
  size: number
  hasAttachments: boolean
  receivedAt: Date
  folder: string
}

interface RuleStorage {
  rules: Record<string, EmailRule>
  autoReplyHistory: Record<string, Date[]> // Track auto-replies to prevent spam
}

export class EmailRulesEngine {
  private dataPath: string
  private rules: Map<string, EmailRule> = new Map()
  private autoReplyHistory: Map<string, Date[]> = new Map()
  private isActive = false

  constructor() {
    const userDataPath = app.getPath('userData')
    const rulesDir = join(userDataPath, 'email-rules')
    
    if (!existsSync(rulesDir)) {
      mkdirSync(rulesDir, { recursive: true })
    }
    
    this.dataPath = join(rulesDir, 'rules.json')
    this.loadRules()
  }

  private loadRules(): void {
    try {
      if (existsSync(this.dataPath)) {
        const data = JSON.parse(readFileSync(this.dataPath, 'utf8')) as RuleStorage
        
        for (const [id, rule] of Object.entries(data.rules)) {
          rule.createdAt = new Date(rule.createdAt)
          rule.updatedAt = new Date(rule.updatedAt)
          this.rules.set(id, rule)
        }
        
        if (data.autoReplyHistory) {
          for (const [email, dates] of Object.entries(data.autoReplyHistory)) {
            this.autoReplyHistory.set(email, dates.map(d => new Date(d)))
          }
        }
        
        log.info(`Loaded ${this.rules.size} email rules`)
      }
    } catch (error) {
      log.error('Failed to load email rules:', error)
    }
  }

  private saveRules(): void {
    try {
      const rulesObj: Record<string, EmailRule> = {}
      for (const [id, rule] of this.rules.entries()) {
        rulesObj[id] = rule
      }

      const autoReplyHistoryObj: Record<string, Date[]> = {}
      for (const [email, dates] of this.autoReplyHistory.entries()) {
        autoReplyHistoryObj[email] = dates
      }

      const data: RuleStorage = {
        rules: rulesObj,
        autoReplyHistory: autoReplyHistoryObj
      }

      writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
      log.error('Failed to save email rules:', error)
    }
  }

  async initialize(): Promise<void> {
    this.isActive = true
    log.info('Email rules engine initialized')
  }

  // Rule evaluation logic
  private evaluateCondition(message: EmailMessage, condition: EmailRule['conditions'][0]): boolean {
    let fieldValue: string | number | boolean

    switch (condition.field) {
      case 'from':
        fieldValue = `${message.from.name} ${message.from.address}`
        break
      case 'to':
        fieldValue = message.to.map(addr => `${addr.name} ${addr.address}`).join(' ')
        break
      case 'subject':
        fieldValue = message.subject
        break
      case 'body':
        fieldValue = message.body
        break
      case 'size':
        fieldValue = message.size
        break
      case 'hasAttachments':
        fieldValue = message.hasAttachments
        break
      case 'date':
        fieldValue = message.receivedAt.getTime()
        break
      default:
        return false
    }

    // Apply operator
    switch (condition.operator) {
      case 'contains':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return condition.caseSensitive 
            ? fieldValue.includes(condition.value)
            : fieldValue.toLowerCase().includes(condition.value.toLowerCase())
        }
        return false

      case 'equals':
        if (condition.caseSensitive === false && typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return fieldValue.toLowerCase() === condition.value.toLowerCase()
        }
        return fieldValue === condition.value

      case 'startsWith':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return condition.caseSensitive 
            ? fieldValue.startsWith(condition.value)
            : fieldValue.toLowerCase().startsWith(condition.value.toLowerCase())
        }
        return false

      case 'endsWith':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return condition.caseSensitive 
            ? fieldValue.endsWith(condition.value)
            : fieldValue.toLowerCase().endsWith(condition.value.toLowerCase())
        }
        return false

      case 'regex':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          try {
            const flags = condition.caseSensitive ? 'g' : 'gi'
            const regex = new RegExp(condition.value, flags)
            return regex.test(fieldValue)
          } catch {
            return false
          }
        }
        return false

      case 'greaterThan':
        return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value

      case 'lessThan':
        return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value

      default:
        return false
    }
  }

  private evaluateRule(message: EmailMessage, rule: EmailRule): boolean {
    if (!rule.enabled) return false
    if (rule.accountId && rule.accountId !== message.accountId) return false

    const conditionResults = rule.conditions.map(condition => 
      this.evaluateCondition(message, condition)
    )

    return rule.conditionOperator === 'AND' 
      ? conditionResults.every(result => result)
      : conditionResults.some(result => result)
  }

  async processMessage(message: EmailMessage): Promise<{ actionsApplied: string[]; ruleIds: string[] }> {
    if (!this.isActive) return { actionsApplied: [], ruleIds: [] }

    const applicableRules = Array.from(this.rules.values())
      .filter(rule => this.evaluateRule(message, rule))
      .sort((a, b) => b.priority - a.priority) // Higher priority first

    const actionsApplied: string[] = []
    const ruleIds: string[] = []

    for (const rule of applicableRules) {
      try {
        for (const action of rule.actions) {
          const actionResult = await this.executeAction(message, action)
          if (actionResult) {
            actionsApplied.push(`${action.type}:${JSON.stringify(action.parameters)}`)
            ruleIds.push(rule.id)
          }
        }

        // Update rule statistics
        rule.appliedCount++
        rule.updatedAt = new Date()
        this.rules.set(rule.id, rule)
      } catch (error) {
        log.error(`Failed to apply rule ${rule.name}:`, error)
      }
    }

    if (actionsApplied.length > 0) {
      this.saveRules()
      log.info(`Applied ${actionsApplied.length} actions to message ${message.id}`)
    }

    return { actionsApplied, ruleIds }
  }

  private async executeAction(message: EmailMessage, action: EmailRule['actions'][0]): Promise<boolean> {
    const rustEngine = require('../lib/rust-engine')

    try {
      switch (action.type) {
        case 'markRead':
          await rustEngine.markMailMessageRead(message.accountId, message.id, true)
          return true

        case 'markStarred':
          await rustEngine.markMailMessageStarred(message.accountId, message.id, true)
          return true

        case 'move':
          if (action.parameters.folder) {
            await rustEngine.moveMessage(message.accountId, message.id, action.parameters.folder)
            return true
          }
          return false

        case 'label':
          if (action.parameters.label) {
            await rustEngine.addLabelToMessage(message.accountId, message.id, action.parameters.label)
            return true
          }
          return false

        case 'autoReply':
          return await this.sendAutoReply(message, action.parameters)

        case 'forward':
          if (action.parameters.to) {
            await rustEngine.forwardMessage(message.accountId, message.id, action.parameters.to)
            return true
          }
          return false

        case 'delete':
          await rustEngine.deleteMessage(message.accountId, message.id)
          return true

        case 'archive':
          await rustEngine.archiveMessage(message.accountId, message.id)
          return true

        default:
          log.warn(`Unknown action type: ${action.type}`)
          return false
      }
    } catch (error) {
      log.error(`Failed to execute action ${action.type}:`, error)
      return false
    }
  }

  private async sendAutoReply(message: EmailMessage, parameters: any): Promise<boolean> {
    try {
      // Prevent auto-reply spam
      const fromEmail = message.from.address.toLowerCase()
      const replyHistory = this.autoReplyHistory.get(fromEmail) || []
      const now = new Date()
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      // Remove old entries
      const recentReplies = replyHistory.filter(date => date > dayAgo)
      
      // Don't auto-reply if we've already replied recently
      if (recentReplies.length >= (parameters.maxRepliesPerDay || 1)) {
        log.info(`Skipping auto-reply to ${fromEmail} - daily limit reached`)
        return false
      }

      // Send auto-reply
      const rustEngine = require('../lib/rust-engine')
      const replySubject = parameters.subject || `Re: ${message.subject}`
      const replyBody = parameters.body || 'Thank you for your email. I will get back to you soon.'

      await rustEngine.sendMessage(message.accountId, {
        to: [message.from.address],
        subject: replySubject,
        body: replyBody,
        isAutoReply: true
      })

      // Track the auto-reply
      recentReplies.push(now)
      this.autoReplyHistory.set(fromEmail, recentReplies)
      this.saveRules()

      log.info(`Sent auto-reply to ${fromEmail}`)
      return true
    } catch (error) {
      log.error('Failed to send auto-reply:', error)
      return false
    }
  }

  // Public API methods

  async createRule(ruleData: Omit<EmailRule, 'id' | 'createdAt' | 'updatedAt' | 'appliedCount'>): Promise<string> {
    const id = uuidv4()
    const rule: EmailRule = {
      ...ruleData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      appliedCount: 0
    }

    this.rules.set(id, rule)
    this.saveRules()
    
    log.info(`Created email rule: ${rule.name}`)
    return id
  }

  async updateRule(ruleId: string, updates: Partial<EmailRule>): Promise<boolean> {
    const rule = this.rules.get(ruleId)
    if (!rule) return false

    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: new Date()
    }

    this.rules.set(ruleId, updatedRule)
    this.saveRules()
    
    log.info(`Updated email rule: ${ruleId}`)
    return true
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    const deleted = this.rules.delete(ruleId)
    if (deleted) {
      this.saveRules()
      log.info(`Deleted email rule: ${ruleId}`)
    }
    return deleted
  }

  async getAllRules(): Promise<EmailRule[]> {
    return Array.from(this.rules.values())
      .sort((a, b) => b.priority - a.priority)
  }

  async getRulesByAccount(accountId: string): Promise<EmailRule[]> {
    return Array.from(this.rules.values())
      .filter(rule => !rule.accountId || rule.accountId === accountId)
      .sort((a, b) => b.priority - a.priority)
  }

  async testRule(ruleId: string, testMessage: EmailMessage): Promise<boolean> {
    const rule = this.rules.get(ruleId)
    if (!rule) return false

    return this.evaluateRule(testMessage, rule)
  }

  async getRuleStats(): Promise<{
    totalRules: number
    enabledRules: number
    totalApplications: number
    topRules: Array<{ id: string; name: string; appliedCount: number }>
  }> {
    const rules = Array.from(this.rules.values())
    
    return {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      totalApplications: rules.reduce((sum, r) => sum + r.appliedCount, 0),
      topRules: rules
        .sort((a, b) => b.appliedCount - a.appliedCount)
        .slice(0, 5)
        .map(r => ({ id: r.id, name: r.name, appliedCount: r.appliedCount }))
    }
  }

  // Bulk processing for incoming messages
  async processBatchMessages(messages: EmailMessage[]): Promise<{
    processed: number
    actionsApplied: number
    errors: number
  }> {
    let processed = 0
    let actionsApplied = 0
    let errors = 0

    for (const message of messages) {
      try {
        const result = await this.processMessage(message)
        processed++
        actionsApplied += result.actionsApplied.length
      } catch (error) {
        errors++
        log.error(`Failed to process message ${message.id}:`, error)
      }
    }

    return { processed, actionsApplied, errors }
  }
}