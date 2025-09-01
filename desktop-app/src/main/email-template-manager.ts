/**
 * Email Template Manager
 * 
 * Handles storage, retrieval, and management of email templates
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import log from 'electron-log'
import { v4 as uuidv4 } from 'uuid'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: 'business' | 'personal' | 'follow-up' | 'meeting' | 'custom'
  variables: string[] // e.g., ['{{senderName}}', '{{company}}']
  isShared: boolean
  createdAt: Date
  updatedAt: Date
  usageCount: number
  accountId?: string // If template is account-specific
}

interface TemplateStorage {
  templates: Record<string, EmailTemplate>
  categories: string[]
  defaultTemplates: string[]
}

export class EmailTemplateManager {
  private dataPath: string
  private templates: Map<string, EmailTemplate> = new Map()
  private categories: Set<string> = new Set(['business', 'personal', 'follow-up', 'meeting', 'custom'])

  constructor() {
    const userDataPath = app.getPath('userData')
    const templatesDir = join(userDataPath, 'email-templates')
    
    // Ensure directory exists
    if (!existsSync(templatesDir)) {
      mkdirSync(templatesDir, { recursive: true })
    }
    
    this.dataPath = join(templatesDir, 'templates.json')
    this.loadTemplates()
    this.createDefaultTemplates()
  }

  private loadTemplates(): void {
    try {
      if (existsSync(this.dataPath)) {
        const data = JSON.parse(readFileSync(this.dataPath, 'utf8')) as TemplateStorage
        
        for (const [id, template] of Object.entries(data.templates)) {
          // Ensure dates are properly parsed
          template.createdAt = new Date(template.createdAt)
          template.updatedAt = new Date(template.updatedAt)
          this.templates.set(id, template)
        }
        
        if (data.categories) {
          data.categories.forEach(cat => this.categories.add(cat))
        }
        
        log.info(`Loaded ${this.templates.size} email templates`)
      }
    } catch (error) {
      log.error('Failed to load email templates:', error)
    }
  }

  private saveTemplates(): void {
    try {
      const templatesObj: Record<string, EmailTemplate> = {}
      for (const [id, template] of this.templates.entries()) {
        templatesObj[id] = template
      }

      const data: TemplateStorage = {
        templates: templatesObj,
        categories: Array.from(this.categories),
        defaultTemplates: Array.from(this.templates.values())
          .filter(t => t.category !== 'custom')
          .map(t => t.id)
      }

      writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
      log.error('Failed to save email templates:', error)
    }
  }

  private createDefaultTemplates(): void {
    if (this.templates.size > 0) return // Don't recreate if templates exist

    const defaultTemplates: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
      {
        name: 'Meeting Request',
        subject: 'Meeting Request: {{meetingTopic}}',
        body: `Hi {{recipientName}},

I hope this email finds you well. I would like to schedule a meeting to discuss {{meetingTopic}}.

Would any of the following times work for you?
- {{timeOption1}}
- {{timeOption2}}
- {{timeOption3}}

Please let me know what works best for your schedule.

Best regards,
{{senderName}}`,
        category: 'meeting',
        variables: ['{{recipientName}}', '{{meetingTopic}}', '{{timeOption1}}', '{{timeOption2}}', '{{timeOption3}}', '{{senderName}}'],
        isShared: true
      },
      {
        name: 'Follow-up Email',
        subject: 'Following up on {{originalTopic}}',
        body: `Hi {{recipientName}},

I wanted to follow up on our previous conversation about {{originalTopic}}.

{{followUpDetails}}

Please let me know if you need any additional information.

Best regards,
{{senderName}}`,
        category: 'follow-up',
        variables: ['{{recipientName}}', '{{originalTopic}}', '{{followUpDetails}}', '{{senderName}}'],
        isShared: true
      },
      {
        name: 'Business Introduction',
        subject: 'Introduction from {{company}}',
        body: `Dear {{recipientName}},

My name is {{senderName}} and I'm reaching out from {{company}}. 

{{introductionDetails}}

I would love to discuss how we might be able to help {{recipientCompany}} with {{serviceOffering}}.

Would you be available for a brief call next week?

Best regards,
{{senderName}}
{{title}}
{{company}}
{{phone}}`,
        category: 'business',
        variables: ['{{recipientName}}', '{{company}}', '{{senderName}}', '{{introductionDetails}}', '{{recipientCompany}}', '{{serviceOffering}}', '{{title}}', '{{phone}}'],
        isShared: true
      },
      {
        name: 'Thank You Note',
        subject: 'Thank you for {{reason}}',
        body: `Dear {{recipientName}},

Thank you for {{reason}}. {{thankYouDetails}}

I truly appreciate {{specificAppreciation}}.

Best regards,
{{senderName}}`,
        category: 'personal',
        variables: ['{{recipientName}}', '{{reason}}', '{{thankYouDetails}}', '{{specificAppreciation}}', '{{senderName}}'],
        isShared: true
      }
    ]

    defaultTemplates.forEach(template => {
      const id = uuidv4()
      const fullTemplate: EmailTemplate = {
        ...template,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      }
      this.templates.set(id, fullTemplate)
    })

    this.saveTemplates()
    log.info('Created default email templates')
  }

  // Public API methods

  async getAllTemplates(): Promise<EmailTemplate[]> {
    return Array.from(this.templates.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  async getTemplatesByCategory(category: string): Promise<EmailTemplate[]> {
    return Array.from(this.templates.values())
      .filter(template => template.category === category)
      .sort((a, b) => b.usageCount - a.usageCount)
  }

  async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    return this.templates.get(templateId) || null
  }

  async saveTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<string> {
    const id = uuidv4()
    const fullTemplate: EmailTemplate = {
      ...template,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    }

    this.templates.set(id, fullTemplate)
    this.categories.add(template.category)
    this.saveTemplates()
    
    log.info(`Saved email template: ${template.name}`)
    return id
  }

  async updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<boolean> {
    const template = this.templates.get(templateId)
    if (!template) return false

    const updatedTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date()
    }

    this.templates.set(templateId, updatedTemplate)
    if (updates.category) {
      this.categories.add(updates.category)
    }
    this.saveTemplates()
    
    log.info(`Updated email template: ${templateId}`)
    return true
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    const deleted = this.templates.delete(templateId)
    if (deleted) {
      this.saveTemplates()
      log.info(`Deleted email template: ${templateId}`)
    }
    return deleted
  }

  async useTemplate(templateId: string): Promise<EmailTemplate | null> {
    const template = this.templates.get(templateId)
    if (!template) return null

    // Increment usage count
    template.usageCount++
    template.updatedAt = new Date()
    this.templates.set(templateId, template)
    this.saveTemplates()

    return template
  }

  async searchTemplates(query: string): Promise<EmailTemplate[]> {
    const lowercaseQuery = query.toLowerCase()
    return Array.from(this.templates.values())
      .filter(template => 
        template.name.toLowerCase().includes(lowercaseQuery) ||
        template.subject.toLowerCase().includes(lowercaseQuery) ||
        template.body.toLowerCase().includes(lowercaseQuery) ||
        template.category.toLowerCase().includes(lowercaseQuery)
      )
      .sort((a, b) => b.usageCount - a.usageCount)
  }

  async getCategories(): Promise<string[]> {
    return Array.from(this.categories)
  }

  async createCategory(categoryName: string): Promise<boolean> {
    this.categories.add(categoryName.toLowerCase())
    this.saveTemplates()
    return true
  }

  // Template variable processing
  processTemplateVariables(template: EmailTemplate, variables: Record<string, string>): { subject: string; body: string } {
    let processedSubject = template.subject
    let processedBody = template.body

    // Replace all variables in subject and body
    for (const [key, value] of Object.entries(variables)) {
      const variable = key.startsWith('{{') ? key : `{{${key}}}`
      const regex = new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g')
      
      processedSubject = processedSubject.replace(regex, value)
      processedBody = processedBody.replace(regex, value)
    }

    return {
      subject: processedSubject,
      body: processedBody
    }
  }

  extractVariables(text: string): string[] {
    const matches = text.match(/\{\{[^}]+\}\}/g)
    return matches ? [...new Set(matches)] : []
  }

  // Statistics and analytics
  async getTemplateStats(): Promise<{
    totalTemplates: number
    categoryCounts: Record<string, number>
    mostUsed: EmailTemplate[]
    recentlyUpdated: EmailTemplate[]
  }> {
    const templates = Array.from(this.templates.values())
    
    const categoryCounts: Record<string, number> = {}
    templates.forEach(template => {
      categoryCounts[template.category] = (categoryCounts[template.category] || 0) + 1
    })

    const mostUsed = templates
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)

    const recentlyUpdated = templates
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 5)

    return {
      totalTemplates: templates.length,
      categoryCounts,
      mostUsed,
      recentlyUpdated
    }
  }
}