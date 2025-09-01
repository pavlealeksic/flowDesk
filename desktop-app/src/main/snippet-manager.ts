/**
 * Text Snippet Manager
 * 
 * Real file-based storage and management of text snippets
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import log from 'electron-log'
import { v4 as uuidv4 } from 'uuid'

interface TextSnippet {
  id: string
  name: string
  shortcut: string
  content: string
  category: string
  isShared: boolean
  createdAt: Date
  updatedAt: Date
  usageCount: number
  accountId?: string
}

interface SnippetStorage {
  snippets: Record<string, TextSnippet>
  categories: string[]
}

export class SnippetManager {
  private dataPath: string
  private snippets: Map<string, TextSnippet> = new Map()
  private categories: Set<string> = new Set(['common', 'signatures', 'closings', 'greetings'])

  constructor() {
    const userDataPath = app.getPath('userData')
    const snippetsDir = join(userDataPath, 'text-snippets')
    
    // Ensure directory exists
    if (!existsSync(snippetsDir)) {
      mkdirSync(snippetsDir, { recursive: true })
    }
    
    this.dataPath = join(snippetsDir, 'snippets.json')
    this.loadSnippets()
    this.createDefaultSnippets()
  }

  private loadSnippets(): void {
    try {
      if (existsSync(this.dataPath)) {
        const data = JSON.parse(readFileSync(this.dataPath, 'utf8')) as SnippetStorage
        
        for (const [id, snippet] of Object.entries(data.snippets)) {
          // Ensure dates are properly parsed
          snippet.createdAt = new Date(snippet.createdAt)
          snippet.updatedAt = new Date(snippet.updatedAt)
          this.snippets.set(id, snippet)
        }
        
        if (data.categories) {
          data.categories.forEach(cat => this.categories.add(cat))
        }
        
        log.info(`Loaded ${this.snippets.size} text snippets`)
      }
    } catch (error) {
      log.error('Failed to load text snippets:', error)
    }
  }

  private saveSnippets(): void {
    try {
      const snippetsObj: Record<string, TextSnippet> = {}
      for (const [id, snippet] of this.snippets.entries()) {
        snippetsObj[id] = snippet
      }

      const data: SnippetStorage = {
        snippets: snippetsObj,
        categories: Array.from(this.categories)
      }

      writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
      log.error('Failed to save text snippets:', error)
    }
  }

  private createDefaultSnippets(): void {
    if (this.snippets.size > 0) return // Don't recreate if snippets exist

    const defaultSnippets: Omit<TextSnippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
      {
        name: 'Professional Greeting',
        shortcut: '#hello',
        content: 'Hello,\n\nI hope this email finds you well.',
        category: 'greetings',
        isShared: true
      },
      {
        name: 'Professional Closing',
        shortcut: '#regards',
        content: 'Best regards,\n{{senderName}}',
        category: 'closings',
        isShared: true
      },
      {
        name: 'Meeting Follow-up',
        shortcut: '#followup',
        content: 'Thank you for taking the time to meet with me. As discussed, I will {{actionItem}} and follow up by {{deadline}}.',
        category: 'common',
        isShared: true
      },
      {
        name: 'Apology',
        shortcut: '#sorry',
        content: 'I apologize for any inconvenience this may have caused. Please let me know how I can make this right.',
        category: 'common',
        isShared: true
      },
      {
        name: 'Acknowledgment',
        shortcut: '#ack',
        content: 'Thank you for your email. I have received your message and will respond within {{timeframe}}.',
        category: 'common',
        isShared: true
      }
    ]

    defaultSnippets.forEach(snippet => {
      const id = uuidv4()
      const fullSnippet: TextSnippet = {
        ...snippet,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      }
      this.snippets.set(id, fullSnippet)
    })

    this.saveSnippets()
    log.info('Created default text snippets')
  }

  // Public API methods

  async getAllSnippets(): Promise<TextSnippet[]> {
    return Array.from(this.snippets.values())
      .sort((a, b) => b.usageCount - a.usageCount)
  }

  async getSnippetsByCategory(category: string): Promise<TextSnippet[]> {
    return Array.from(this.snippets.values())
      .filter(snippet => snippet.category === category)
      .sort((a, b) => b.usageCount - a.usageCount)
  }

  async getSnippet(snippetId: string): Promise<TextSnippet | null> {
    return this.snippets.get(snippetId) || null
  }

  async saveSnippet(snippet: Omit<TextSnippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<string> {
    const id = uuidv4()
    const fullSnippet: TextSnippet = {
      ...snippet,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    }

    this.snippets.set(id, fullSnippet)
    this.categories.add(snippet.category)
    this.saveSnippets()
    
    log.info(`Saved text snippet: ${snippet.name}`)
    return id
  }

  async updateSnippet(snippetId: string, updates: Partial<TextSnippet>): Promise<boolean> {
    const snippet = this.snippets.get(snippetId)
    if (!snippet) return false

    const updatedSnippet = {
      ...snippet,
      ...updates,
      updatedAt: new Date()
    }

    this.snippets.set(snippetId, updatedSnippet)
    if (updates.category) {
      this.categories.add(updates.category)
    }
    this.saveSnippets()
    
    log.info(`Updated text snippet: ${snippetId}`)
    return true
  }

  async deleteSnippet(snippetId: string): Promise<boolean> {
    const deleted = this.snippets.delete(snippetId)
    if (deleted) {
      this.saveSnippets()
      log.info(`Deleted text snippet: ${snippetId}`)
    }
    return deleted
  }

  async useSnippet(snippetId: string): Promise<TextSnippet | null> {
    const snippet = this.snippets.get(snippetId)
    if (!snippet) return null

    // Increment usage count
    snippet.usageCount++
    snippet.updatedAt = new Date()
    this.snippets.set(snippetId, snippet)
    this.saveSnippets()

    return snippet
  }

  async searchSnippets(query: string): Promise<TextSnippet[]> {
    const lowercaseQuery = query.toLowerCase()
    return Array.from(this.snippets.values())
      .filter(snippet => 
        snippet.name.toLowerCase().includes(lowercaseQuery) ||
        snippet.shortcut.toLowerCase().includes(lowercaseQuery) ||
        snippet.content.toLowerCase().includes(lowercaseQuery) ||
        snippet.category.toLowerCase().includes(lowercaseQuery)
      )
      .sort((a, b) => b.usageCount - a.usageCount)
  }

  async getCategories(): Promise<string[]> {
    return Array.from(this.categories)
  }

  async getSnippetsByShortcut(shortcut: string): Promise<TextSnippet | null> {
    for (const snippet of this.snippets.values()) {
      if (snippet.shortcut === shortcut) {
        return snippet
      }
    }
    return null
  }

  // Snippet processing - replace variables in content
  processSnippetVariables(snippet: TextSnippet, variables: Record<string, string>): string {
    let processedContent = snippet.content

    // Replace all variables in content
    for (const [key, value] of Object.entries(variables)) {
      const variable = key.startsWith('{{') ? key : `{{${key}}}`
      const regex = new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g')
      processedContent = processedContent.replace(regex, value)
    }

    return processedContent
  }

  extractVariables(content: string): string[] {
    const matches = content.match(/\{\{[^}]+\}\}/g)
    return matches ? [...new Set(matches)] : []
  }

  // Statistics
  async getSnippetStats(): Promise<{
    totalSnippets: number
    categoryCounts: Record<string, number>
    mostUsed: TextSnippet[]
    recentlyUpdated: TextSnippet[]
  }> {
    const snippets = Array.from(this.snippets.values())
    
    const categoryCounts: Record<string, number> = {}
    snippets.forEach(snippet => {
      categoryCounts[snippet.category] = (categoryCounts[snippet.category] || 0) + 1
    })

    const mostUsed = snippets
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)

    const recentlyUpdated = snippets
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 5)

    return {
      totalSnippets: snippets.length,
      categoryCounts,
      mostUsed,
      recentlyUpdated
    }
  }
}