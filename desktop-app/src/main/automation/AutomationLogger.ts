/**
 * Automation Logger - Comprehensive logging and monitoring system
 * 
 * This system provides:
 * - Structured logging with different levels
 * - Performance metrics and monitoring
 * - Error tracking and alerting
 * - Audit trails for compliance
 * - Integration with external monitoring services
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
// Use a local config type to avoid import issues
interface AutomationEngineConfig {
  logging: {
    level: string;
    retentionDays: number;
    maxLogSize: number;
    enableMetrics: boolean;
  };
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  category: 'engine' | 'execution' | 'trigger' | 'action' | 'plugin' | 'security' | 'performance';
  context: {
    recipeId?: string;
    executionId?: string;
    pluginId?: string;
    userId?: string;
    actionId?: string;
    triggerId?: string;
  };
  data?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metrics?: {
    duration?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    networkRequests?: number;
  };
  tags: string[];
}

interface LogFilter {
  level?: LogEntry['level'][];
  category?: LogEntry['category'][];
  startDate?: Date;
  endDate?: Date;
  recipeId?: string;
  executionId?: string;
  pluginId?: string;
  userId?: string;
  search?: string;
  tags?: string[];
}

interface LogMetrics {
  totalLogs: number;
  logsByLevel: Record<LogEntry['level'], number>;
  logsByCategory: Record<LogEntry['category'], number>;
  errorRate: number;
  averageExecutionTime: number;
  recentErrors: LogEntry[];
  topErrors: Array<{ error: string; count: number }>;
  performanceMetrics: {
    averageMemoryUsage: number;
    averageCpuUsage: number;
    averageNetworkRequests: number;
  };
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    level?: LogEntry['level'][];
    category?: LogEntry['category'][];
    errorPattern?: string;
    threshold?: {
      type: 'count' | 'rate' | 'duration';
      value: number;
      timeWindow: number; // in seconds
    };
  };
  actions: {
    type: 'email' | 'webhook' | 'notification' | 'slack';
    config: any;
  }[];
  cooldown: number; // in seconds
  lastTriggered?: Date;
}

export class AutomationLogger extends EventEmitter {
  private readonly config: AutomationEngineConfig['logging'];
  private readonly logs: LogEntry[] = [];
  private readonly alertRules: Map<string, AlertRule> = new Map();
  private readonly errorCounts = new Map<string, number>();
  
  private logFilePath: string;
  private maxLogSize: number;
  private maxLogsInMemory = 10000;
  private writeQueue: LogEntry[] = [];
  private isWriting = false;

  constructor(config: AutomationEngineConfig['logging']) {
    super();
    
    this.config = config;
    this.maxLogSize = config.maxLogSize || 100 * 1024 * 1024; // 100MB default
    this.logFilePath = path.join(process.cwd(), 'logs', 'automation.log');
    
    this.setupDefaultAlertRules();
    this.startPeriodicTasks();
  }

  /**
   * Log a message with context
   */
  log(
    level: LogEntry['level'],
    message: string,
    category: LogEntry['category'] = 'engine',
    context: LogEntry['context'] = {},
    data?: any,
    error?: Error | any,
    metrics?: LogEntry['metrics'],
    tags: string[] = []
  ): void {
    // Check if this log level should be recorded
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level,
      message,
      category,
      context,
      data,
      error: error ? this.formatError(error) : undefined,
      metrics,
      tags
    };

    // Add to memory logs
    this.addToMemoryLogs(logEntry);
    
    // Queue for file writing
    this.queueLogWrite(logEntry);
    
    // Check alert rules
    this.checkAlertRules(logEntry);
    
    // Track error counts
    if (level === 'error' || level === 'fatal') {
      this.trackError(logEntry);
    }

    // Emit log event
    this.emit('log', logEntry);
  }

  /**
   * Convenience methods for different log levels
   */
  trace(message: string, category?: LogEntry['category'], context?: LogEntry['context'], data?: any): void {
    this.log('trace', message, category, context, data);
  }

  debug(message: string, category?: LogEntry['category'], context?: LogEntry['context'], data?: any): void {
    this.log('debug', message, category, context, data);
  }

  info(message: string, category?: LogEntry['category'], context?: LogEntry['context'], data?: any): void {
    this.log('info', message, category, context, data);
  }

  warn(message: string, category?: LogEntry['category'], context?: LogEntry['context'], data?: any): void {
    this.log('warn', message, category, context, data);
  }

  error(message: string, error?: Error | any, category?: LogEntry['category'], context?: LogEntry['context'], data?: any): void {
    this.log('error', message, category, context, data, error);
  }

  fatal(message: string, error?: Error | any, category?: LogEntry['category'], context?: LogEntry['context'], data?: any): void {
    this.log('fatal', message, category, context, data, error);
  }

  /**
   * Log automation execution metrics
   */
  logExecution(
    executionId: string,
    recipeId: string,
    status: 'started' | 'completed' | 'failed' | 'cancelled',
    metrics?: {
      duration?: number;
      actionsExecuted?: number;
      memoryUsage?: number;
      cpuUsage?: number;
    },
    error?: Error
  ): void {
    const message = `Automation execution ${status}: ${executionId}`;
    const level = status === 'failed' ? 'error' : 'info';
    
    this.log(level, message, 'execution', {
      executionId,
      recipeId
    }, {
      status,
      ...metrics
    }, error, metrics, ['execution', status]);
  }

  /**
   * Log plugin operations
   */
  logPlugin(
    pluginId: string,
    operation: string,
    status: 'started' | 'completed' | 'failed',
    data?: any,
    error?: Error
  ): void {
    const message = `Plugin ${operation} ${status}: ${pluginId}`;
    const level = status === 'failed' ? 'error' : 'info';
    
    this.log(level, message, 'plugin', {
      pluginId
    }, {
      operation,
      status,
      ...data
    }, error, undefined, ['plugin', operation, status]);
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    metrics: {
      duration: number;
      memoryUsage?: number;
      cpuUsage?: number;
      networkRequests?: number;
    },
    context?: LogEntry['context']
  ): void {
    this.log('debug', `Performance: ${operation}`, 'performance', context, {
      operation
    }, undefined, metrics, ['performance', operation]);
  }

  /**
   * Log security events
   */
  logSecurity(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: LogEntry['context'],
    data?: any
  ): void {
    const levelMap = {
      low: 'info' as const,
      medium: 'warn' as const,
      high: 'error' as const,
      critical: 'fatal' as const
    };

    this.log(levelMap[severity], `Security event: ${event}`, 'security', context, {
      event,
      severity,
      ...data
    }, undefined, undefined, ['security', severity, event]);
  }

  /**
   * Query logs with filtering
   */
  queryLogs(filter: LogFilter = {}, limit: number = 100): LogEntry[] {
    let filteredLogs = this.logs;

    // Apply filters
    if (filter.level && filter.level.length > 0) {
      filteredLogs = filteredLogs.filter(log => filter.level!.includes(log.level));
    }

    if (filter.category && filter.category.length > 0) {
      filteredLogs = filteredLogs.filter(log => filter.category!.includes(log.category));
    }

    if (filter.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endDate!);
    }

    if (filter.recipeId) {
      filteredLogs = filteredLogs.filter(log => log.context.recipeId === filter.recipeId);
    }

    if (filter.executionId) {
      filteredLogs = filteredLogs.filter(log => log.context.executionId === filter.executionId);
    }

    if (filter.pluginId) {
      filteredLogs = filteredLogs.filter(log => log.context.pluginId === filter.pluginId);
    }

    if (filter.userId) {
      filteredLogs = filteredLogs.filter(log => log.context.userId === filter.userId);
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        (log.error && log.error.message.toLowerCase().includes(searchLower)) ||
        log.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    if (filter.tags && filter.tags.length > 0) {
      filteredLogs = filteredLogs.filter(log => 
        filter.tags!.some(tag => log.tags.includes(tag))
      );
    }

    // Sort by timestamp (most recent first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return filteredLogs.slice(0, limit);
  }

  /**
   * Get log metrics and statistics
   */
  getMetrics(timeWindow?: { start: Date; end: Date }): LogMetrics {
    let relevantLogs = this.logs;
    
    if (timeWindow) {
      relevantLogs = this.logs.filter(log => 
        log.timestamp >= timeWindow.start && log.timestamp <= timeWindow.end
      );
    }

    const logsByLevel: Record<LogEntry['level'], number> = {
      trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0
    };

    const logsByCategory: Record<LogEntry['category'], number> = {
      engine: 0, execution: 0, trigger: 0, action: 0, plugin: 0, security: 0, performance: 0
    };

    let totalDuration = 0;
    let durationCount = 0;
    let totalMemory = 0;
    let memoryCount = 0;
    let totalCpu = 0;
    let cpuCount = 0;
    let totalNetworkRequests = 0;
    let networkCount = 0;

    const errorMessages = new Map<string, number>();
    const recentErrors: LogEntry[] = [];

    for (const log of relevantLogs) {
      logsByLevel[log.level]++;
      logsByCategory[log.category]++;

      if (log.metrics) {
        if (log.metrics.duration) {
          totalDuration += log.metrics.duration;
          durationCount++;
        }
        if (log.metrics.memoryUsage) {
          totalMemory += log.metrics.memoryUsage;
          memoryCount++;
        }
        if (log.metrics.cpuUsage) {
          totalCpu += log.metrics.cpuUsage;
          cpuCount++;
        }
        if (log.metrics.networkRequests) {
          totalNetworkRequests += log.metrics.networkRequests;
          networkCount++;
        }
      }

      if (log.level === 'error' || log.level === 'fatal') {
        recentErrors.push(log);
        const errorKey = log.error?.message || log.message;
        errorMessages.set(errorKey, (errorMessages.get(errorKey) || 0) + 1);
      }
    }

    const topErrors = Array.from(errorMessages.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    recentErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const totalLogs = relevantLogs.length;
    const errorLogs = logsByLevel.error + logsByLevel.fatal;

    return {
      totalLogs,
      logsByLevel,
      logsByCategory,
      errorRate: totalLogs > 0 ? errorLogs / totalLogs : 0,
      averageExecutionTime: durationCount > 0 ? totalDuration / durationCount : 0,
      recentErrors: recentErrors.slice(0, 50),
      topErrors,
      performanceMetrics: {
        averageMemoryUsage: memoryCount > 0 ? totalMemory / memoryCount : 0,
        averageCpuUsage: cpuCount > 0 ? totalCpu / cpuCount : 0,
        averageNetworkRequests: networkCount > 0 ? totalNetworkRequests / networkCount : 0
      }
    };
  }

  /**
   * Create or update alert rule
   */
  createAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const alertRule: AlertRule = {
      ...rule,
      id: this.generateAlertRuleId()
    };

    this.alertRules.set(alertRule.id, alertRule);
    return alertRule.id;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Export logs to file
   */
  async exportLogs(
    filter: LogFilter = {},
    format: 'json' | 'csv' | 'txt' = 'json',
    filePath?: string
  ): Promise<string> {
    const logs = this.queryLogs(filter, 0); // Get all matching logs
    const exportPath = filePath || path.join(process.cwd(), 'exports', `logs-${Date.now()}.${format}`);

    let content: string;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(logs, null, 2);
        break;
      case 'csv':
        content = this.formatLogsAsCsv(logs);
        break;
      case 'txt':
        content = this.formatLogsAsText(logs);
        break;
    }

    // Ensure export directory exists
    await fs.mkdir(path.dirname(exportPath), { recursive: true });
    await fs.writeFile(exportPath, content, 'utf8');

    return exportPath;
  }

  /**
   * Clean up old logs
   */
  async cleanup(): Promise<void> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.retentionDays);

    // Remove old logs from memory
    const initialCount = this.logs.length;
    let index = 0;
    while (index < this.logs.length) {
      if (this.logs[index].timestamp < retentionDate) {
        this.logs.splice(index, 1);
      } else {
        index++;
      }
    }

    const removedCount = initialCount - this.logs.length;
    if (removedCount > 0) {
      this.info(`Cleaned up ${removedCount} old log entries`, 'engine');
    }

    // Rotate log file if too large
    await this.rotateLogFileIfNeeded();
  }

  // Private methods

  private shouldLog(level: LogEntry['level']): boolean {
    const levelOrder = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const configLevel = levelOrder.indexOf(this.config.level);
    const logLevel = levelOrder.indexOf(level);
    
    return logLevel >= configLevel;
  }

  private addToMemoryLogs(logEntry: LogEntry): void {
    this.logs.push(logEntry);
    
    // Trim memory logs if needed
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs.splice(0, this.logs.length - this.maxLogsInMemory);
    }
  }

  private queueLogWrite(logEntry: LogEntry): void {
    this.writeQueue.push(logEntry);
    this.processWriteQueue();
  }

  private async processWriteQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    try {
      const logsToWrite = [...this.writeQueue];
      this.writeQueue.length = 0;

      const logLines = logsToWrite.map(log => JSON.stringify(log)).join('\n') + '\n';
      
      // Ensure log directory exists
      await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
      
      // Append to log file
      await fs.appendFile(this.logFilePath, logLines, 'utf8');
      
    } catch (error) {
      console.error('Failed to write logs to file:', error);
      // Put logs back in queue
      this.writeQueue.unshift(...this.writeQueue);
    } finally {
      this.isWriting = false;
    }
  }

  private async rotateLogFileIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.logFilePath);
      
      if (stats.size > this.maxLogSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = this.logFilePath.replace('.log', `.${timestamp}.log`);
        
        await fs.rename(this.logFilePath, rotatedPath);
        
        this.info(`Log file rotated: ${rotatedPath}`, 'engine');
      }
    } catch (error) {
      // File might not exist yet
    }
  }

  private formatError(error: Error | any): LogEntry['error'] {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    if (typeof error === 'object' && error !== null) {
      return {
        name: error.name || 'UnknownError',
        message: error.message || String(error),
        stack: error.stack,
        code: error.code
      };
    }

    return {
      name: 'UnknownError',
      message: String(error)
    };
  }

  private trackError(logEntry: LogEntry): void {
    const errorKey = logEntry.error?.message || logEntry.message;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
  }

  private checkAlertRules(logEntry: LogEntry): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      // Check cooldown
      if (rule.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldown * 1000) {
          continue;
        }
      }

      if (this.doesLogMatchAlertRule(logEntry, rule)) {
        this.triggerAlert(rule, logEntry);
      }
    }
  }

  private doesLogMatchAlertRule(logEntry: LogEntry, rule: AlertRule): boolean {
    const conditions = rule.conditions;

    // Check level
    if (conditions.level && !conditions.level.includes(logEntry.level)) {
      return false;
    }

    // Check category
    if (conditions.category && !conditions.category.includes(logEntry.category)) {
      return false;
    }

    // Check error pattern
    if (conditions.errorPattern && logEntry.error) {
      const regex = new RegExp(conditions.errorPattern, 'i');
      if (!regex.test(logEntry.error.message)) {
        return false;
      }
    }

    // Check threshold (simplified - would need more sophisticated implementation)
    if (conditions.threshold) {
      // This would require tracking counts/rates over time windows
      return true; // Placeholder
    }

    return true;
  }

  private async triggerAlert(rule: AlertRule, logEntry: LogEntry): Promise<void> {
    rule.lastTriggered = new Date();

    for (const action of rule.actions) {
      try {
        await this.executeAlertAction(action, rule, logEntry);
      } catch (error) {
        console.error(`Failed to execute alert action:`, error);
      }
    }

    this.emit('alertTriggered', { rule, logEntry });
  }

  private async executeAlertAction(action: AlertRule['actions'][0], rule: AlertRule, logEntry: LogEntry): Promise<void> {
    switch (action.type) {
      case 'notification':
        // Would integrate with notification system
        break;
      case 'email':
        // Would send email notification
        break;
      case 'webhook':
        // Would call webhook
        break;
      case 'slack':
        // Would send Slack message
        break;
    }
  }

  private setupDefaultAlertRules(): void {
    // High error rate alert
    this.createAlertRule({
      name: 'High Error Rate',
      description: 'Alert when error rate is high',
      enabled: true,
      conditions: {
        level: ['error', 'fatal'],
        threshold: {
          type: 'rate',
          value: 10, // 10 errors
          timeWindow: 300 // in 5 minutes
        }
      },
      actions: [
        {
          type: 'notification',
          config: {
            title: 'High Error Rate Detected',
            urgency: 'high'
          }
        }
      ],
      cooldown: 900 // 15 minutes
    });

    // Security event alert
    this.createAlertRule({
      name: 'Security Event',
      description: 'Alert on security events',
      enabled: true,
      conditions: {
        category: ['security'],
        level: ['warn', 'error', 'fatal']
      },
      actions: [
        {
          type: 'email',
          config: {
            subject: 'Security Alert',
            urgency: 'critical'
          }
        }
      ],
      cooldown: 300 // 5 minutes
    });
  }

  private startPeriodicTasks(): void {
    // Cleanup task - runs every hour
    setInterval(() => {
      this.cleanup().catch(error => {
        console.error('Log cleanup failed:', error);
      });
    }, 3600000); // 1 hour

    // Metrics calculation - runs every 5 minutes
    setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metricsCalculated', metrics);
    }, 300000); // 5 minutes
  }

  private formatLogsAsCsv(logs: LogEntry[]): string {
    const headers = ['timestamp', 'level', 'category', 'message', 'recipeId', 'executionId', 'pluginId', 'error'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.level,
      log.category,
      JSON.stringify(log.message),
      log.context.recipeId || '',
      log.context.executionId || '',
      log.context.pluginId || '',
      log.error?.message || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private formatLogsAsText(logs: LogEntry[]): string {
    return logs.map(log => {
      const timestamp = log.timestamp.toISOString();
      const level = log.level.toUpperCase().padEnd(5);
      const category = log.category.padEnd(10);
      let line = `${timestamp} [${level}] ${category} ${log.message}`;
      
      if (log.error) {
        line += `\n  Error: ${log.error.message}`;
        if (log.error.stack) {
          line += `\n  Stack: ${log.error.stack}`;
        }
      }
      
      return line;
    }).join('\n');
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertRuleId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}