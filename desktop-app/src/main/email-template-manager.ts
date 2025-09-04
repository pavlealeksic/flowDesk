/**
 * Email Template Manager - Production Implementation
 * 
 * Provides real email template management with SQLite storage,
 * variable substitution, and analytics tracking.
 */

import log from 'electron-log';
import { getDatabaseInitializationService } from './database-initialization-service';
import { generateId } from './utils/id-generator';
import { 
  EmailTemplate, 
  TemplateVariable, 
  TemplateRenderResult, 
  TemplateRenderContext,
  EmailTemplateAttachment,
  EmailTrackingOptions,
  EmailScheduleOptions
} from './template-types';

interface EmailTemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string;
  subject: string;
  body_html: string;
  body_text: string;
  variables: string;
  attachments: string;
  sender: string | null;
  reply_to: string | null;
  priority: string;
  tracking_options: string;
  schedule_options: string;
  is_default: number;
  is_global: number;
  usage_count: number;
  last_used: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface SQLite3Database {
  exec(sql: string, callback?: (err: Error | null) => void): void;
  get(sql: string, params?: any, callback?: (err: Error | null, row?: any) => void): void;
  all(sql: string, params?: any, callback?: (err: Error | null, rows?: any[]) => void): void;
  run(sql: string, params?: any, callback?: (err: Error | null) => void): void;
  close(callback?: (err: Error | null) => void): void;
  serialize(callback?: () => void): void;
}

interface SQLite3Module {
  Database: new (filename: string, mode?: number, callback?: (err: Error | null) => void) => SQLite3Database;
  OPEN_READWRITE: number;
  OPEN_CREATE: number;
  OPEN_READONLY: number;
  verbose(): SQLite3Module;
}

export class EmailTemplateManager {
  private dbPath: string;
  private sqlite3?: SQLite3Module;

  constructor() {
    const dbService = getDatabaseInitializationService();
    this.dbPath = dbService.getConfig().mailDbPath;
  }

  /**
   * Load SQLite3 module
   */
  private async loadSQLite3(): Promise<SQLite3Module> {
    if (this.sqlite3) {
      return this.sqlite3;
    }

    try {
      const sqlite3Module = require('sqlite3').verbose();
      if (!sqlite3Module) {
        throw new Error('Failed to load SQLite3 module');
      }
      this.sqlite3 = sqlite3Module;
      return sqlite3Module;
    } catch (error) {
      throw new Error('SQLite3 module not available. Please install sqlite3: npm install sqlite3');
    }
  }

  /**
   * Open database connection
   */
  private async openDatabase(): Promise<SQLite3Database> {
    const sqlite3 = await this.loadSQLite3();
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err: Error | null) => {
        if (err) {
          reject(new Error(`Failed to open database: ${err.message}`));
        } else {
          resolve(db);
        }
      });
    });
  }

  /**
   * Convert database row to EmailTemplate
   */
  private rowToEmailTemplate(row: EmailTemplateRow): EmailTemplate {
    return {
      type: 'email',
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      variables: JSON.parse(row.variables || '[]'),
      subject: row.subject,
      bodyHtml: row.body_html,
      bodyText: row.body_text,
      attachments: JSON.parse(row.attachments || '[]'),
      sender: row.sender || undefined,
      replyTo: row.reply_to || undefined,
      priority: (row.priority as 'low' | 'normal' | 'high') || 'normal',
      tracking: JSON.parse(row.tracking_options || '{}'),
      schedule: JSON.parse(row.schedule_options || '{}'),
      isDefault: row.is_default === 1,
      isGlobal: row.is_global === 1,
      usageCount: row.usage_count,
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by || undefined
    };
  }

  /**
   * Convert EmailTemplate to database parameters
   */
  private templateToParams(template: Partial<EmailTemplate>): any {
    return {
      id: template.id,
      name: template.name,
      description: template.description || null,
      category: template.category || 'general',
      tags: JSON.stringify(template.tags || []),
      subject: template.subject,
      body_html: template.bodyHtml,
      body_text: template.bodyText || '',
      variables: JSON.stringify(template.variables || []),
      attachments: JSON.stringify(template.attachments || []),
      sender: template.sender || null,
      reply_to: template.replyTo || null,
      priority: template.priority || 'normal',
      tracking_options: JSON.stringify(template.tracking || {}),
      schedule_options: JSON.stringify(template.schedule || {}),
      is_default: template.isDefault ? 1 : 0,
      is_global: template.isGlobal ? 1 : 0,
      usage_count: template.usageCount || 0,
      last_used: template.lastUsed?.toISOString() || null,
      created_at: template.createdAt?.toISOString(),
      updated_at: template.updatedAt?.toISOString() || new Date().toISOString(),
      created_by: template.createdBy || null
    };
  }

  /**
   * Get all email templates
   */
  async getAllTemplates(): Promise<EmailTemplate[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM email_templates ORDER BY name ASC',
        [],
        (err: Error | null, rows?: EmailTemplateRow[]) => {
          db.close();
          if (err) {
            log.error('Failed to get all templates:', err);
            reject(new Error(`Failed to get all templates: ${err.message}`));
          } else {
            const templates = (rows || []).map(row => this.rowToEmailTemplate(row));
            resolve(templates);
          }
        }
      );
    });
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: string): Promise<EmailTemplate[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM email_templates WHERE category = ? ORDER BY name ASC',
        [category],
        (err: Error | null, rows?: EmailTemplateRow[]) => {
          db.close();
          if (err) {
            log.error('Failed to get templates by category:', err);
            reject(new Error(`Failed to get templates by category: ${err.message}`));
          } else {
            const templates = (rows || []).map(row => this.rowToEmailTemplate(row));
            resolve(templates);
          }
        }
      );
    });
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(id: string): Promise<EmailTemplate | null> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM email_templates WHERE id = ?',
        [id],
        (err: Error | null, row?: EmailTemplateRow) => {
          db.close();
          if (err) {
            log.error('Failed to get template:', err);
            reject(new Error(`Failed to get template: ${err.message}`));
          } else if (row) {
            resolve(this.rowToEmailTemplate(row));
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Save a new template
   */
  async saveTemplate(template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<EmailTemplate> {
    const newTemplate: EmailTemplate = {
      ...template,
      id: generateId('tmpl'),
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const params = this.templateToParams(newTemplate);
      
      db.run(
        `INSERT INTO email_templates (
          id, name, description, category, tags, subject, body_html, body_text, 
          variables, attachments, sender, reply_to, priority, tracking_options, 
          schedule_options, is_default, is_global, usage_count, created_at, 
          updated_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          params.id, params.name, params.description, params.category, 
          params.tags, params.subject, params.body_html, params.body_text,
          params.variables, params.attachments, params.sender, params.reply_to,
          params.priority, params.tracking_options, params.schedule_options,
          params.is_default, params.is_global, params.usage_count,
          params.created_at, params.updated_at, params.created_by
        ],
        function (err: Error | null) {
          db.close();
          if (err) {
            log.error('Failed to save template:', err);
            reject(new Error(`Failed to save template: ${err.message}`));
          } else {
            log.info(`Saved template: ${newTemplate.name}`);
            resolve(newTemplate);
          }
        }
      );
    });
  }

  /**
   * Update an existing template
   */
  async updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate | null> {
    const existingTemplate = await this.getTemplate(id);
    if (!existingTemplate) return null;

    const updatedTemplate: EmailTemplate = {
      ...existingTemplate,
      ...updates,
      id: existingTemplate.id,
      createdAt: existingTemplate.createdAt,
      updatedAt: new Date()
    };

    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const params = this.templateToParams(updatedTemplate);
      
      db.run(
        `UPDATE email_templates SET 
         name = ?, description = ?, category = ?, tags = ?, subject = ?, 
         body_html = ?, body_text = ?, variables = ?, attachments = ?, 
         sender = ?, reply_to = ?, priority = ?, tracking_options = ?, 
         schedule_options = ?, is_default = ?, is_global = ?, updated_at = ?, 
         created_by = ?
         WHERE id = ?`,
        [
          params.name, params.description, params.category, params.tags,
          params.subject, params.body_html, params.body_text, params.variables,
          params.attachments, params.sender, params.reply_to, params.priority,
          params.tracking_options, params.schedule_options, params.is_default,
          params.is_global, params.updated_at, params.created_by, id
        ],
        function (this: any, err: Error | null) {
          db.close();
          if (err) {
            log.error('Failed to update template:', err);
            reject(new Error(`Failed to update template: ${err.message}`));
          } else if (this.changes === 0) {
            resolve(null);
          } else {
            log.info(`Updated template: ${updatedTemplate.name}`);
            resolve(updatedTemplate);
          }
        }
      );
    });
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM email_templates WHERE id = ?',
        [id],
        function (this: any, err: Error | null) {
          db.close();
          if (err) {
            log.error('Failed to delete template:', err);
            reject(new Error(`Failed to delete template: ${err.message}`));
          } else {
            const success = this.changes > 0;
            if (success) {
              log.info(`Deleted template with id: ${id}`);
            }
            resolve(success);
          }
        }
      );
    });
  }

  /**
   * Use a template (increment usage count and record analytics)
   */
  async useTemplate(id: string): Promise<EmailTemplate | null> {
    const template = await this.getTemplate(id);
    if (!template) return null;

    // Update usage count and last used timestamp
    const updatedTemplate = await this.updateTemplate(id, {
      usageCount: template.usageCount + 1,
      lastUsed: new Date()
    });

    // Record usage analytics
    await this.recordTemplateUsage(id);

    return updatedTemplate;
  }

  /**
   * Search templates
   */
  async searchTemplates(query: string): Promise<EmailTemplate[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const searchQuery = `%${query.toLowerCase()}%`;
      db.all(
        `SELECT * FROM email_templates 
         WHERE LOWER(name) LIKE ? 
         OR LOWER(description) LIKE ?
         OR LOWER(subject) LIKE ? 
         OR LOWER(body_text) LIKE ?
         OR LOWER(tags) LIKE ?
         OR LOWER(category) LIKE ?
         ORDER BY usage_count DESC, name ASC`,
        [searchQuery, searchQuery, searchQuery, searchQuery, searchQuery, searchQuery],
        (err: Error | null, rows?: EmailTemplateRow[]) => {
          db.close();
          if (err) {
            log.error('Failed to search templates:', err);
            reject(new Error(`Failed to search templates: ${err.message}`));
          } else {
            const templates = (rows || []).map(row => this.rowToEmailTemplate(row));
            resolve(templates);
          }
        }
      );
    });
  }

  /**
   * Process template variables and render template
   */
  processTemplateVariables(template: EmailTemplate, variables: Record<string, string>): TemplateRenderResult {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Render subject
      const renderedSubject = this.renderTemplate(template.subject, variables, template.variables);
      
      // Render HTML body
      const renderedBodyHtml = this.renderTemplate(template.bodyHtml, variables, template.variables);
      
      // Render text body
      const renderedBodyText = this.renderTemplate(template.bodyText, variables, template.variables);

      // Check for missing required variables
      const missingRequired = template.variables
        .filter(v => v.isRequired && !variables[v.key])
        .map(v => v.key);

      if (missingRequired.length > 0) {
        warnings.push(`Missing required variables: ${missingRequired.join(', ')}`);
      }

      return {
        success: true,
        rendered: {
          subject: renderedSubject,
          bodyHtml: renderedBodyHtml,
          bodyText: renderedBodyText
        },
        variables,
        renderTime: Date.now() - startTime,
        warnings,
        errors,
        metadata: {
          templateId: template.id,
          templateName: template.name,
          variableCount: template.variables.length
        }
      };
    } catch (error) {
      return {
        success: false,
        rendered: {},
        variables,
        renderTime: Date.now() - startTime,
        warnings,
        errors: [error instanceof Error ? error.message : 'Unknown rendering error'],
        metadata: {
          templateId: template.id,
          templateName: template.name
        }
      };
    }
  }

  /**
   * Render template content with variable substitution
   */
  private renderTemplate(content: string, variables: Record<string, string>, templateVariables: TemplateVariable[]): string {
    let rendered = content;

    // Create a map of template variables for validation
    const variableMap = new Map(templateVariables.map(v => [v.key, v]));

    // Replace all {{variable}} placeholders
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const variable = variableMap.get(key);
      const value = variables[key];

      // If value is provided, use it
      if (value !== undefined && value !== null) {
        // Apply any formatting based on variable type
        return this.formatVariableValue(value, variable?.type);
      }

      // If no value but has default, use default
      if (variable?.defaultValue) {
        return this.formatVariableValue(variable.defaultValue, variable.type);
      }

      // Return original placeholder if no value and no default
      return match;
    });

    return rendered;
  }

  /**
   * Format variable value based on its type
   */
  private formatVariableValue(value: string, type?: string): string {
    if (!type || type === 'text' || type === 'textarea' || type === 'richtext') {
      return value;
    }

    switch (type) {
      case 'email':
        return value.toLowerCase();
      
      case 'date':
        try {
          const date = new Date(value);
          return date.toLocaleDateString();
        } catch {
          return value;
        }
      
      case 'datetime':
        try {
          const date = new Date(value);
          return date.toLocaleString();
        } catch {
          return value;
        }
      
      case 'time':
        try {
          const date = new Date(`1970-01-01T${value}`);
          return date.toLocaleTimeString();
        } catch {
          return value;
        }
      
      case 'currency':
        try {
          const number = parseFloat(value);
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(number);
        } catch {
          return value;
        }
      
      case 'percentage':
        try {
          const number = parseFloat(value);
          return `${number}%`;
        } catch {
          return value;
        }
      
      case 'phone':
        // Basic phone formatting (US format)
        const digits = value.replace(/\D/g, '');
        if (digits.length === 10) {
          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        return value;
      
      case 'url':
        // Ensure URL has protocol
        if (value && !value.match(/^https?:\/\//)) {
          return `https://${value}`;
        }
        return value;
      
      default:
        return value;
    }
  }

  /**
   * Record template usage for analytics
   */
  private async recordTemplateUsage(templateId: string): Promise<void> {
    try {
      const db = await this.openDatabase();
      
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO template_usage (id, template_id, template_type, used_at, context) 
           VALUES (?, ?, 'email', CURRENT_TIMESTAMP, 'email_template_manager')`,
          [generateId('usage'), templateId],
          function (err: Error | null) {
            db.close();
            if (err) {
              log.warn('Failed to record template usage:', err);
              // Don't reject, as this is non-critical
            }
            resolve();
          }
        );
      });
    } catch (error) {
      log.warn('Failed to record template usage:', error);
    }
  }

  /**
   * Get template categories with counts
   */
  async getCategories(): Promise<Array<{ category: string; count: number }>> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT category, COUNT(*) as count FROM email_templates GROUP BY category ORDER BY category ASC',
        [],
        (err: Error | null, rows?: any[]) => {
          db.close();
          if (err) {
            log.error('Failed to get template categories:', err);
            reject(new Error(`Failed to get template categories: ${err.message}`));
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Get most used templates
   */
  async getMostUsedTemplates(limit: number = 10): Promise<EmailTemplate[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM email_templates ORDER BY usage_count DESC, name ASC LIMIT ?',
        [limit],
        (err: Error | null, rows?: EmailTemplateRow[]) => {
          db.close();
          if (err) {
            log.error('Failed to get most used templates:', err);
            reject(new Error(`Failed to get most used templates: ${err.message}`));
          } else {
            const templates = (rows || []).map(row => this.rowToEmailTemplate(row));
            resolve(templates);
          }
        }
      );
    });
  }

  /**
   * Import templates from array
   */
  async importTemplates(templates: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[]): Promise<{
    imported: number;
    failed: number;
    errors: string[];
  }> {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const template of templates) {
      try {
        await this.saveTemplate(template);
        imported++;
      } catch (error) {
        failed++;
        errors.push(`Failed to import template "${template.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    log.info(`Imported ${imported} templates, ${failed} failed`);
    return { imported, failed, errors };
  }

  /**
   * Export all templates
   */
  async exportTemplates(): Promise<EmailTemplate[]> {
    return this.getAllTemplates();
  }

  /**
   * Validate template
   */
  validateTemplate(template: Partial<EmailTemplate>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.subject || template.subject.trim().length === 0) {
      errors.push('Template subject is required');
    }

    if (!template.bodyHtml || template.bodyHtml.trim().length === 0) {
      errors.push('Template HTML body is required');
    }

    if (template.variables) {
      for (const variable of template.variables) {
        if (!variable.key || variable.key.trim().length === 0) {
          errors.push('Variable key is required');
        }
        
        if (!variable.label || variable.label.trim().length === 0) {
          errors.push(`Variable "${variable.key}" label is required`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}