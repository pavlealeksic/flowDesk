"use strict";
/**
 * Email Template Manager - Production Implementation
 *
 * Provides real email template management with SQLite storage,
 * variable substitution, and analytics tracking.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemplateManager = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
const database_initialization_service_1 = require("./database-initialization-service");
const id_generator_1 = require("./utils/id-generator");
class EmailTemplateManager {
    constructor() {
        const dbService = (0, database_initialization_service_1.getDatabaseInitializationService)();
        this.dbPath = dbService.getConfig().mailDbPath;
    }
    /**
     * Load SQLite3 module
     */
    async loadSQLite3() {
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
        }
        catch (error) {
            throw new Error('SQLite3 module not available. Please install sqlite3: npm install sqlite3');
        }
    }
    /**
     * Open database connection
     */
    async openDatabase() {
        const sqlite3 = await this.loadSQLite3();
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    reject(new Error(`Failed to open database: ${err.message}`));
                }
                else {
                    resolve(db);
                }
            });
        });
    }
    /**
     * Convert database row to EmailTemplate
     */
    rowToEmailTemplate(row) {
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
            priority: row.priority || 'normal',
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
    templateToParams(template) {
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
    async getAllTemplates() {
        const db = await this.openDatabase();
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM email_templates ORDER BY name ASC', [], (err, rows) => {
                db.close();
                if (err) {
                    electron_log_1.default.error('Failed to get all templates:', err);
                    reject(new Error(`Failed to get all templates: ${err.message}`));
                }
                else {
                    const templates = (rows || []).map(row => this.rowToEmailTemplate(row));
                    resolve(templates);
                }
            });
        });
    }
    /**
     * Get templates by category
     */
    async getTemplatesByCategory(category) {
        const db = await this.openDatabase();
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM email_templates WHERE category = ? ORDER BY name ASC', [category], (err, rows) => {
                db.close();
                if (err) {
                    electron_log_1.default.error('Failed to get templates by category:', err);
                    reject(new Error(`Failed to get templates by category: ${err.message}`));
                }
                else {
                    const templates = (rows || []).map(row => this.rowToEmailTemplate(row));
                    resolve(templates);
                }
            });
        });
    }
    /**
     * Get a specific template by ID
     */
    async getTemplate(id) {
        const db = await this.openDatabase();
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM email_templates WHERE id = ?', [id], (err, row) => {
                db.close();
                if (err) {
                    electron_log_1.default.error('Failed to get template:', err);
                    reject(new Error(`Failed to get template: ${err.message}`));
                }
                else if (row) {
                    resolve(this.rowToEmailTemplate(row));
                }
                else {
                    resolve(null);
                }
            });
        });
    }
    /**
     * Save a new template
     */
    async saveTemplate(template) {
        const newTemplate = {
            ...template,
            id: (0, id_generator_1.generateId)('tmpl'),
            usageCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const db = await this.openDatabase();
        return new Promise((resolve, reject) => {
            const params = this.templateToParams(newTemplate);
            db.run(`INSERT INTO email_templates (
          id, name, description, category, tags, subject, body_html, body_text, 
          variables, attachments, sender, reply_to, priority, tracking_options, 
          schedule_options, is_default, is_global, usage_count, created_at, 
          updated_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                params.id, params.name, params.description, params.category,
                params.tags, params.subject, params.body_html, params.body_text,
                params.variables, params.attachments, params.sender, params.reply_to,
                params.priority, params.tracking_options, params.schedule_options,
                params.is_default, params.is_global, params.usage_count,
                params.created_at, params.updated_at, params.created_by
            ], function (err) {
                db.close();
                if (err) {
                    electron_log_1.default.error('Failed to save template:', err);
                    reject(new Error(`Failed to save template: ${err.message}`));
                }
                else {
                    electron_log_1.default.info(`Saved template: ${newTemplate.name}`);
                    resolve(newTemplate);
                }
            });
        });
    }
    /**
     * Update an existing template
     */
    async updateTemplate(id, updates) {
        const existingTemplate = await this.getTemplate(id);
        if (!existingTemplate)
            return null;
        const updatedTemplate = {
            ...existingTemplate,
            ...updates,
            id: existingTemplate.id,
            createdAt: existingTemplate.createdAt,
            updatedAt: new Date()
        };
        const db = await this.openDatabase();
        return new Promise((resolve, reject) => {
            const params = this.templateToParams(updatedTemplate);
            db.run(`UPDATE email_templates SET 
         name = ?, description = ?, category = ?, tags = ?, subject = ?, 
         body_html = ?, body_text = ?, variables = ?, attachments = ?, 
         sender = ?, reply_to = ?, priority = ?, tracking_options = ?, 
         schedule_options = ?, is_default = ?, is_global = ?, updated_at = ?, 
         created_by = ?
         WHERE id = ?`, [
                params.name, params.description, params.category, params.tags,
                params.subject, params.body_html, params.body_text, params.variables,
                params.attachments, params.sender, params.reply_to, params.priority,
                params.tracking_options, params.schedule_options, params.is_default,
                params.is_global, params.updated_at, params.created_by, id
            ], function (err) {
                db.close();
                if (err) {
                    electron_log_1.default.error('Failed to update template:', err);
                    reject(new Error(`Failed to update template: ${err.message}`));
                }
                else if (this.changes === 0) {
                    resolve(null);
                }
                else {
                    electron_log_1.default.info(`Updated template: ${updatedTemplate.name}`);
                    resolve(updatedTemplate);
                }
            });
        });
    }
    /**
     * Delete a template
     */
    async deleteTemplate(id) {
        const db = await this.openDatabase();
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM email_templates WHERE id = ?', [id], function (err) {
                db.close();
                if (err) {
                    electron_log_1.default.error('Failed to delete template:', err);
                    reject(new Error(`Failed to delete template: ${err.message}`));
                }
                else {
                    const success = this.changes > 0;
                    if (success) {
                        electron_log_1.default.info(`Deleted template with id: ${id}`);
                    }
                    resolve(success);
                }
            });
        });
    }
    /**
     * Use a template (increment usage count and record analytics)
     */
    async useTemplate(id) {
        const template = await this.getTemplate(id);
        if (!template)
            return null;
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
    async searchTemplates(query) {
        const db = await this.openDatabase();
        return new Promise((resolve, reject) => {
            const searchQuery = `%${query.toLowerCase()}%`;
            db.all(`SELECT * FROM email_templates 
         WHERE LOWER(name) LIKE ? 
         OR LOWER(description) LIKE ?
         OR LOWER(subject) LIKE ? 
         OR LOWER(body_text) LIKE ?
         OR LOWER(tags) LIKE ?
         OR LOWER(category) LIKE ?
         ORDER BY usage_count DESC, name ASC`, [searchQuery, searchQuery, searchQuery, searchQuery, searchQuery, searchQuery], (err, rows) => {
                db.close();
                if (err) {
                    electron_log_1.default.error('Failed to search templates:', err);
                    reject(new Error(`Failed to search templates: ${err.message}`));
                }
                else {
                    const templates = (rows || []).map(row => this.rowToEmailTemplate(row));
                    resolve(templates);
                }
            });
        });
    }
    /**
     * Process template variables and render template
     */
    processTemplateVariables(template, variables) {
        const startTime = Date.now();
        const warnings = [];
        const errors = [];
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
        }
        catch (error) {
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
    renderTemplate(content, variables, templateVariables) {
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
    formatVariableValue(value, type) {
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
                }
                catch {
                    return value;
                }
            case 'datetime':
                try {
                    const date = new Date(value);
                    return date.toLocaleString();
                }
                catch {
                    return value;
                }
            case 'time':
                try {
                    const date = new Date(`1970-01-01T${value}`);
                    return date.toLocaleTimeString();
                }
                catch {
                    return value;
                }
            case 'currency':
                try {
                    const number = parseFloat(value);
                    return new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD'
                    }).format(number);
                }
                catch {
                    return value;
                }
            case 'percentage':
                try {
                    const number = parseFloat(value);
                    return `${number}%`;
                }
                catch {
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
    async recordTemplateUsage(templateId) {
        try {
            const db = await this.openDatabase();
            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO template_usage (id, template_id, template_type, used_at, context) 
           VALUES (?, ?, 'email', CURRENT_TIMESTAMP, 'email_template_manager')`, [(0, id_generator_1.generateId)('usage'), templateId], function (err) {
                    db.close();
                    if (err) {
                        electron_log_1.default.warn('Failed to record template usage:', err);
                        // Don't reject, as this is non-critical
                    }
                    resolve();
                });
            });
        }
        catch (error) {
            electron_log_1.default.warn('Failed to record template usage:', error);
        }
    }
    /**
     * Get template categories with counts
     */
    async getCategories() {
        const db = await this.openDatabase();
        return new Promise((resolve, reject) => {
            db.all('SELECT category, COUNT(*) as count FROM email_templates GROUP BY category ORDER BY category ASC', [], (err, rows) => {
                db.close();
                if (err) {
                    electron_log_1.default.error('Failed to get template categories:', err);
                    reject(new Error(`Failed to get template categories: ${err.message}`));
                }
                else {
                    resolve(rows || []);
                }
            });
        });
    }
    /**
     * Get most used templates
     */
    async getMostUsedTemplates(limit = 10) {
        const db = await this.openDatabase();
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM email_templates ORDER BY usage_count DESC, name ASC LIMIT ?', [limit], (err, rows) => {
                db.close();
                if (err) {
                    electron_log_1.default.error('Failed to get most used templates:', err);
                    reject(new Error(`Failed to get most used templates: ${err.message}`));
                }
                else {
                    const templates = (rows || []).map(row => this.rowToEmailTemplate(row));
                    resolve(templates);
                }
            });
        });
    }
    /**
     * Import templates from array
     */
    async importTemplates(templates) {
        let imported = 0;
        let failed = 0;
        const errors = [];
        for (const template of templates) {
            try {
                await this.saveTemplate(template);
                imported++;
            }
            catch (error) {
                failed++;
                errors.push(`Failed to import template "${template.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        electron_log_1.default.info(`Imported ${imported} templates, ${failed} failed`);
        return { imported, failed, errors };
    }
    /**
     * Export all templates
     */
    async exportTemplates() {
        return this.getAllTemplates();
    }
    /**
     * Validate template
     */
    validateTemplate(template) {
        const errors = [];
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
exports.EmailTemplateManager = EmailTemplateManager;
