"use strict";
/**
 * Email Rules Engine Service
 *
 * Manages email filtering rules and automatic processing.
 * Applies conditions and actions to incoming emails.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailRulesEngine = void 0;
const electron_1 = require("electron");
const path_1 = require("path");
const electron_log_1 = __importDefault(require("electron-log"));
class EmailRulesEngine {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.cachedRules = new Map();
        this.ruleStats = new Map();
        const userDataPath = electron_1.app.getPath('userData');
        this.dbPath = (0, path_1.join)(userDataPath, 'email_rules.db');
    }
    /**
     * Initialize the email rules engine service
     */
    async initialize() {
        try {
            electron_log_1.default.info('Initializing Email Rules Engine service...');
            // Initialize database
            await this.initializeDatabase();
            // Load existing rules into cache
            await this.loadRulesCache();
            // Load rule statistics
            await this.loadRuleStats();
            this.isInitialized = true;
            electron_log_1.default.info('Email Rules Engine service initialized successfully');
            return true;
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize Email Rules Engine service:', error);
            return false;
        }
    }
    /**
     * Initialize SQLite database with required tables
     */
    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            try {
                const sqlite3 = require('sqlite3').verbose();
                this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                    if (err) {
                        electron_log_1.default.error('Failed to connect to email rules database:', err);
                        reject(err);
                        return;
                    }
                    // Create email rules table
                    const createRulesTable = `
            CREATE TABLE IF NOT EXISTS email_rules (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              is_active INTEGER NOT NULL DEFAULT 1,
              enabled INTEGER NOT NULL DEFAULT 1,
              conditions TEXT NOT NULL,
              actions TEXT NOT NULL,
              priority INTEGER NOT NULL DEFAULT 0,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `;
                    // Create rule statistics table
                    const createStatsTable = `
            CREATE TABLE IF NOT EXISTS rule_stats (
              id TEXT PRIMARY KEY,
              rule_id TEXT NOT NULL,
              match_count INTEGER NOT NULL DEFAULT 0,
              last_matched INTEGER,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              FOREIGN KEY (rule_id) REFERENCES email_rules (id) ON DELETE CASCADE
            )
          `;
                    // Create rule execution log table
                    const createLogTable = `
            CREATE TABLE IF NOT EXISTS rule_execution_log (
              id TEXT PRIMARY KEY,
              rule_id TEXT NOT NULL,
              message_id TEXT NOT NULL,
              executed_actions TEXT NOT NULL,
              execution_result TEXT,
              executed_at INTEGER NOT NULL,
              FOREIGN KEY (rule_id) REFERENCES email_rules (id) ON DELETE CASCADE
            )
          `;
                    // Create indexes for performance
                    const createIndexes = `
            CREATE INDEX IF NOT EXISTS idx_rule_priority ON email_rules(priority DESC, is_active, enabled);
            CREATE INDEX IF NOT EXISTS idx_rule_stats ON rule_stats(rule_id);
            CREATE INDEX IF NOT EXISTS idx_execution_log ON rule_execution_log(rule_id, executed_at DESC);
          `;
                    this.db.exec(createRulesTable, (err) => {
                        if (err) {
                            reject(new Error(`Failed to create email_rules table: ${err.message}`));
                            return;
                        }
                        this.db.exec(createStatsTable, (err) => {
                            if (err) {
                                reject(new Error(`Failed to create rule_stats table: ${err.message}`));
                                return;
                            }
                            this.db.exec(createLogTable, (err) => {
                                if (err) {
                                    reject(new Error(`Failed to create rule_execution_log table: ${err.message}`));
                                    return;
                                }
                                this.db.exec(createIndexes, (err) => {
                                    if (err) {
                                        electron_log_1.default.warn('Failed to create database indexes:', err);
                                    }
                                    resolve();
                                });
                            });
                        });
                    });
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Load all rules into memory cache
     */
    async loadRulesCache() {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const sql = `
        SELECT * FROM email_rules 
        WHERE is_active = 1 AND enabled = 1
        ORDER BY priority DESC
      `;
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(new Error(`Failed to load rules cache: ${err.message}`));
                    return;
                }
                if (!rows) {
                    resolve();
                    return;
                }
                this.cachedRules.clear();
                rows.forEach(row => {
                    const rule = this.mapRowToEmailRule(row);
                    this.cachedRules.set(rule.id, rule);
                });
                electron_log_1.default.info(`Loaded ${rows.length} active rules into cache`);
                resolve();
            });
        });
    }
    /**
     * Load rule statistics
     */
    async loadRuleStats() {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const sql = `
        SELECT rs.*, er.name, er.is_active 
        FROM rule_stats rs
        JOIN email_rules er ON rs.rule_id = er.id
      `;
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(new Error(`Failed to load rule stats: ${err.message}`));
                    return;
                }
                if (!rows) {
                    resolve();
                    return;
                }
                this.ruleStats.clear();
                rows.forEach(row => {
                    const stats = {
                        ruleId: row.rule_id,
                        ruleName: row.name,
                        matchCount: row.match_count,
                        lastMatched: row.last_matched ? new Date(row.last_matched) : undefined,
                        isActive: row.is_active === 1
                    };
                    this.ruleStats.set(row.rule_id, stats);
                });
                electron_log_1.default.info(`Loaded statistics for ${rows.length} rules`);
                resolve();
            });
        });
    }
    /**
     * Process an email against all active rules
     */
    async processEmail(email) {
        if (!this.isInitialized) {
            electron_log_1.default.warn('Email Rules Engine not initialized - attempting to initialize now');
            try {
                await this.initialize();
            }
            catch (error) {
                electron_log_1.default.error('Failed to initialize Email Rules Engine:', error);
                return [];
            }
        }
        const results = [];
        try {
            // Get rules sorted by priority (highest first)
            const sortedRules = Array.from(this.cachedRules.values())
                .sort((a, b) => b.priority - a.priority);
            for (const rule of sortedRules) {
                if (!rule.isActive || !rule.enabled)
                    continue;
                const matched = this.evaluateRule(email, rule);
                const result = {
                    matched,
                    rule,
                    actionsToExecute: matched ? rule.actions : []
                };
                results.push(result);
                if (matched) {
                    electron_log_1.default.info(`Email ${email.id} matched rule: ${rule.name}`);
                    // Update rule statistics
                    await this.updateRuleStats(rule.id);
                    // Log the rule execution
                    await this.logRuleExecution(rule.id, email.id, rule.actions, 'matched');
                }
            }
            return results;
        }
        catch (error) {
            electron_log_1.default.error('Error processing email against rules:', error);
            return [];
        }
    }
    /**
     * Evaluate if an email matches a rule's conditions
     */
    evaluateRule(email, rule) {
        if (!rule.conditions || rule.conditions.length === 0) {
            return false;
        }
        // All conditions must match (AND logic)
        for (const condition of rule.conditions) {
            if (!this.evaluateCondition(email, condition)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Evaluate a single condition against an email
     */
    evaluateCondition(email, condition) {
        let fieldValue;
        // Get field value based on condition field
        switch (condition.field) {
            case 'from':
                fieldValue = email.from;
                break;
            case 'to':
                fieldValue = email.to.join(' ');
                break;
            case 'subject':
                fieldValue = email.subject;
                break;
            case 'body':
                fieldValue = email.body;
                break;
            case 'has_attachment':
                return condition.value.toLowerCase() === email.hasAttachment.toString();
            default:
                return false;
        }
        // Apply case sensitivity
        const searchValue = condition.caseSensitive ? condition.value : condition.value.toLowerCase();
        const targetValue = condition.caseSensitive ? fieldValue : fieldValue.toLowerCase();
        // Evaluate based on operator
        switch (condition.operator) {
            case 'contains':
                return targetValue.includes(searchValue);
            case 'equals':
                return targetValue === searchValue;
            case 'starts_with':
                return targetValue.startsWith(searchValue);
            case 'ends_with':
                return targetValue.endsWith(searchValue);
            case 'regex':
                try {
                    const flags = condition.caseSensitive ? 'g' : 'gi';
                    const regex = new RegExp(searchValue, flags);
                    return regex.test(targetValue);
                }
                catch (error) {
                    electron_log_1.default.error(`Invalid regex in rule condition: ${searchValue}`, error);
                    return false;
                }
            default:
                return false;
        }
    }
    /**
     * Create a new email rule
     */
    async createRule(ruleData) {
        if (!this.isInitialized || !this.db) {
            electron_log_1.default.error('Email Rules Engine not initialized');
            return null;
        }
        try {
            const id = this.generateId();
            const now = Date.now();
            const rule = {
                ...ruleData,
                id,
                createdAt: new Date(now),
                updatedAt: new Date(now)
            };
            await this.saveRule(rule);
            // Add to cache if active
            if (rule.isActive && rule.enabled) {
                this.cachedRules.set(rule.id, rule);
            }
            // Initialize statistics
            await this.initializeRuleStats(rule.id);
            electron_log_1.default.info(`Created email rule: ${rule.name} (ID: ${id})`);
            return id;
        }
        catch (error) {
            electron_log_1.default.error('Failed to create email rule:', error);
            return null;
        }
    }
    /**
     * Update an existing email rule
     */
    async updateRule(ruleId, updates) {
        if (!this.isInitialized || !this.db) {
            return false;
        }
        try {
            const existingRule = this.cachedRules.get(ruleId);
            if (!existingRule) {
                electron_log_1.default.error(`Rule with ID ${ruleId} not found`);
                return false;
            }
            const updatedRule = {
                ...existingRule,
                ...updates,
                updatedAt: new Date()
            };
            await this.saveRule(updatedRule);
            // Update cache
            if (updatedRule.isActive && updatedRule.enabled) {
                this.cachedRules.set(ruleId, updatedRule);
            }
            else {
                this.cachedRules.delete(ruleId);
            }
            electron_log_1.default.info(`Updated email rule: ${updatedRule.name} (ID: ${ruleId})`);
            return true;
        }
        catch (error) {
            electron_log_1.default.error('Failed to update email rule:', error);
            return false;
        }
    }
    /**
     * Delete an email rule
     */
    async deleteRule(ruleId) {
        if (!this.isInitialized || !this.db) {
            return false;
        }
        try {
            return new Promise((resolve) => {
                const sql = 'DELETE FROM email_rules WHERE id = ?';
                const self = this;
                this.db.run(sql, [ruleId], function (err) {
                    if (err) {
                        electron_log_1.default.error(`Failed to delete rule ${ruleId}:`, err);
                        resolve(false);
                        return;
                    }
                    const success = this.changes > 0;
                    if (success) {
                        // Remove from cache
                        self.cachedRules.delete(ruleId);
                        self.ruleStats.delete(ruleId);
                        electron_log_1.default.info(`Deleted email rule: ${ruleId}`);
                    }
                    resolve(success);
                });
            });
        }
        catch (error) {
            electron_log_1.default.error('Failed to delete email rule:', error);
            return false;
        }
    }
    /**
     * Get all email rules
     */
    async getAllRules() {
        if (!this.isInitialized || !this.db) {
            electron_log_1.default.warn('Email Rules Engine not initialized - attempting to initialize now');
            try {
                await this.initialize();
            }
            catch (error) {
                electron_log_1.default.error('Failed to initialize Email Rules Engine for getAllRules:', error);
                return [];
            }
        }
        return new Promise((resolve) => {
            const sql = 'SELECT * FROM email_rules ORDER BY priority DESC, name ASC';
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    electron_log_1.default.error('Failed to get all rules:', err);
                    resolve([]);
                    return;
                }
                if (!rows) {
                    resolve([]);
                    return;
                }
                const rules = rows.map(row => this.mapRowToEmailRule(row));
                resolve(rules);
            });
        });
    }
    /**
     * Get rule statistics
     */
    async getRuleStats() {
        if (!this.isInitialized) {
            electron_log_1.default.warn('Email Rules Engine not initialized - attempting to initialize now');
            try {
                await this.initialize();
            }
            catch (error) {
                electron_log_1.default.error('Failed to initialize Email Rules Engine for getRuleStats:', error);
                return [];
            }
        }
        return Array.from(this.ruleStats.values());
    }
    /**
     * Save rule to database
     */
    async saveRule(rule) {
        if (!this.db)
            throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT OR REPLACE INTO email_rules (
          id, name, description, is_active, enabled, conditions, 
          actions, priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
            const params = [
                rule.id,
                rule.name,
                rule.description || null,
                rule.isActive ? 1 : 0,
                rule.enabled ? 1 : 0,
                JSON.stringify(rule.conditions),
                JSON.stringify(rule.actions),
                rule.priority,
                rule.createdAt.getTime(),
                rule.updatedAt.getTime()
            ];
            this.db.run(sql, params, (err) => {
                if (err) {
                    reject(new Error(`Failed to save rule: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }
    /**
     * Initialize statistics for a new rule
     */
    async initializeRuleStats(ruleId) {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO rule_stats (id, rule_id, match_count, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?)
      `;
            const now = Date.now();
            const statsId = `stats_${ruleId}`;
            this.db.run(sql, [statsId, ruleId, now, now], (err) => {
                if (err) {
                    reject(new Error(`Failed to initialize rule stats: ${err.message}`));
                    return;
                }
                // Add to stats cache
                const ruleName = this.cachedRules.get(ruleId)?.name || 'Unknown';
                this.ruleStats.set(ruleId, {
                    ruleId,
                    ruleName,
                    matchCount: 0,
                    isActive: true
                });
                resolve();
            });
        });
    }
    /**
     * Update rule statistics after a match
     */
    async updateRuleStats(ruleId) {
        if (!this.db)
            return;
        const currentStats = this.ruleStats.get(ruleId);
        if (!currentStats)
            return;
        const newMatchCount = currentStats.matchCount + 1;
        const now = Date.now();
        return new Promise((resolve, reject) => {
            const sql = `
        UPDATE rule_stats 
        SET match_count = ?, last_matched = ?, updated_at = ? 
        WHERE rule_id = ?
      `;
            this.db.run(sql, [newMatchCount, now, now, ruleId], (err) => {
                if (err) {
                    reject(new Error(`Failed to update rule stats: ${err.message}`));
                    return;
                }
                // Update cache
                this.ruleStats.set(ruleId, {
                    ...currentStats,
                    matchCount: newMatchCount,
                    lastMatched: new Date(now)
                });
                resolve();
            });
        });
    }
    /**
     * Log rule execution
     */
    async logRuleExecution(ruleId, messageId, actions, result) {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO rule_execution_log (id, rule_id, message_id, executed_actions, execution_result, executed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
            const logId = this.generateId();
            const params = [
                logId,
                ruleId,
                messageId,
                JSON.stringify(actions),
                result,
                Date.now()
            ];
            this.db.run(sql, params, (err) => {
                if (err) {
                    reject(new Error(`Failed to log rule execution: ${err.message}`));
                    return;
                }
                resolve();
            });
        });
    }
    /**
     * Map database row to EmailRule object
     */
    mapRowToEmailRule(row) {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            isActive: row.is_active === 1,
            enabled: row.enabled === 1,
            conditions: JSON.parse(row.conditions),
            actions: JSON.parse(row.actions),
            priority: row.priority,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Cleanup resources on shutdown
     */
    async shutdown() {
        electron_log_1.default.info('Shutting down Email Rules Engine service...');
        // Clear caches
        this.cachedRules.clear();
        this.ruleStats.clear();
        // Close database connection
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        electron_log_1.default.error('Error closing email rules database:', err);
                    }
                    electron_log_1.default.info('Email Rules Engine service shut down successfully');
                    resolve();
                });
            });
        }
        this.isInitialized = false;
    }
}
exports.EmailRulesEngine = EmailRulesEngine;
