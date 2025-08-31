/**
 * Plugin Monitor - Monitors plugin performance and health
 * 
 * Tracks plugin usage, performance metrics, error rates, and provides
 * alerts for potential issues.
 */

import { EventEmitter } from 'events';
import { PluginLogger } from '../utils/PluginLogger';

export interface PluginMetrics {
  /** Plugin installation ID */
  installationId: string;
  /** Plugin ID */
  pluginId: string;
  /** Total invocations */
  totalInvocations: number;
  /** Successful invocations */
  successfulInvocations: number;
  /** Failed invocations */
  failedInvocations: number;
  /** Average response time in ms */
  averageResponseTime: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Performance samples */
  performanceSamples: PerformanceSample[];
  /** Error samples */
  errorSamples: ErrorSample[];
}

export interface PerformanceSample {
  /** Sample timestamp */
  timestamp: Date;
  /** Operation name */
  operation: string;
  /** Duration in ms */
  duration: number;
  /** Memory usage at time of sample */
  memoryUsage: number;
  /** Success/failure */
  success: boolean;
}

export interface ErrorSample {
  /** Error timestamp */
  timestamp: Date;
  /** Operation that failed */
  operation: string;
  /** Error message */
  error: string;
  /** Error stack trace */
  stack?: string;
  /** Error severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface HealthCheck {
  /** Plugin installation ID */
  installationId: string;
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  /** Health score (0-100) */
  score: number;
  /** Health issues */
  issues: string[];
  /** Recommendations */
  recommendations: string[];
  /** Last check timestamp */
  lastCheck: Date;
}

export interface Alert {
  /** Alert ID */
  id: string;
  /** Plugin installation ID */
  installationId: string;
  /** Alert type */
  type: 'performance' | 'error' | 'memory' | 'crash' | 'security';
  /** Alert severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Alert message */
  message: string;
  /** Alert data */
  data: any;
  /** Alert timestamp */
  timestamp: Date;
  /** Whether alert is resolved */
  resolved: boolean;
  /** Resolution timestamp */
  resolvedAt?: Date;
}

export interface MonitoringConfig {
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Enable health checks */
  enableHealthChecks: boolean;
  /** Health check interval in ms */
  healthCheckInterval: number;
  /** Maximum performance samples to keep */
  maxPerformanceSamples: number;
  /** Maximum error samples to keep */
  maxErrorSamples: number;
  /** Performance alert thresholds */
  performanceThresholds: {
    /** Response time threshold in ms */
    responseTime: number;
    /** Error rate threshold (0-1) */
    errorRate: number;
    /** Memory usage threshold in MB */
    memoryUsage: number;
    /** CPU usage threshold (0-1) */
    cpuUsage: number;
  };
  /** Enable alerts */
  enableAlerts: boolean;
  /** Alert retention period in ms */
  alertRetentionPeriod: number;
}

/**
 * Plugin Monitor
 * 
 * Monitors plugin health, performance, and generates alerts.
 */
export class PluginMonitor extends EventEmitter {
  private readonly logger: PluginLogger;
  private readonly config: MonitoringConfig;
  
  private readonly metrics = new Map<string, PluginMetrics>();
  private readonly healthChecks = new Map<string, HealthCheck>();
  private readonly alerts = new Map<string, Alert>();
  
  private healthCheckInterval?: NodeJS.Timeout;
  private alertCleanupInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    
    this.logger = new PluginLogger('PluginMonitor');
    this.config = {
      enablePerformanceMonitoring: true,
      enableHealthChecks: true,
      healthCheckInterval: 60000, // 1 minute
      maxPerformanceSamples: 100,
      maxErrorSamples: 50,
      performanceThresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 0.1, // 10%
        memoryUsage: 100, // 100MB
        cpuUsage: 0.8 // 80%
      },
      enableAlerts: true,
      alertRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };
  }

  /**
   * Initialize the monitor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Plugin monitor already initialized');
    }

    this.logger.info('Initializing plugin monitor');

    // Start health checks
    if (this.config.enableHealthChecks) {
      this.startHealthChecks();
    }

    // Start alert cleanup
    if (this.config.enableAlerts) {
      this.startAlertCleanup();
    }

    this.isInitialized = true;
    this.logger.info('Plugin monitor initialized');
  }

  /**
   * Shutdown the monitor
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    this.logger.info('Shutting down plugin monitor');

    // Stop intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.alertCleanupInterval) {
      clearInterval(this.alertCleanupInterval);
    }

    // Clear data
    this.metrics.clear();
    this.healthChecks.clear();
    this.alerts.clear();

    this.isInitialized = false;
    this.logger.info('Plugin monitor shut down');
  }

  /**
   * Record plugin invocation
   */
  recordInvocation(installationId: string, operation: string, duration: number, success: boolean): void {
    if (!this.config.enablePerformanceMonitoring) return;

    const metrics = this.getOrCreateMetrics(installationId);
    
    // Update counters
    metrics.totalInvocations++;
    if (success) {
      metrics.successfulInvocations++;
    } else {
      metrics.failedInvocations++;
    }

    // Update response time (moving average)
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.totalInvocations - 1) + duration) / metrics.totalInvocations;

    // Update error rate
    metrics.errorRate = metrics.failedInvocations / metrics.totalInvocations;

    // Update last activity
    metrics.lastActivity = new Date();

    // Add performance sample
    const sample: PerformanceSample = {
      timestamp: new Date(),
      operation,
      duration,
      memoryUsage: metrics.memoryUsage,
      success
    };

    metrics.performanceSamples.push(sample);
    
    // Trim samples if needed
    if (metrics.performanceSamples.length > this.config.maxPerformanceSamples) {
      metrics.performanceSamples.shift();
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(installationId, metrics);

    this.logger.debug(`Recorded invocation for ${installationId}`, {
      operation,
      duration,
      success,
      errorRate: metrics.errorRate
    });
  }

  /**
   * Record plugin error
   */
  recordError(
    installationId: string,
    operation: string,
    error: Error,
    severity: ErrorSample['severity'] = 'medium'
  ): void {
    const metrics = this.getOrCreateMetrics(installationId);
    
    // Add error sample
    const sample: ErrorSample = {
      timestamp: new Date(),
      operation,
      error: error.message,
      stack: error.stack,
      severity
    };

    metrics.errorSamples.push(sample);
    
    // Trim samples if needed
    if (metrics.errorSamples.length > this.config.maxErrorSamples) {
      metrics.errorSamples.shift();
    }

    // Create error alert for high/critical errors
    if (severity === 'high' || severity === 'critical') {
      this.createAlert(installationId, 'error', severity, `Plugin error in ${operation}: ${error.message}`, {
        operation,
        error: error.message,
        stack: error.stack
      });
    }

    this.logger.warn(`Plugin error recorded for ${installationId}`, {
      operation,
      error: error.message,
      severity
    });
  }

  /**
   * Record action execution
   */
  recordActionExecution(installationId: string, action: string, success: boolean): void {
    // For simplicity, treat action execution as invocation
    this.recordInvocation(installationId, `action:${action}`, 0, success);
  }

  /**
   * Update plugin resource usage
   */
  updateResourceUsage(installationId: string, memoryUsage: number, cpuUsage: number): void {
    const metrics = this.getOrCreateMetrics(installationId);
    
    metrics.memoryUsage = memoryUsage;
    metrics.cpuUsage = cpuUsage;

    // Check resource usage alerts
    this.checkResourceAlerts(installationId, metrics);
  }

  /**
   * Get plugin metrics
   */
  getMetrics(installationId: string): PluginMetrics | undefined {
    return this.metrics.get(installationId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): PluginMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get plugin health check
   */
  getHealthCheck(installationId: string): HealthCheck | undefined {
    return this.healthChecks.get(installationId);
  }

  /**
   * Get all health checks
   */
  getAllHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(installationId?: string): Alert[] {
    const alerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);
    
    if (installationId) {
      return alerts.filter(alert => alert.installationId === installationId);
    }
    
    return alerts;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      this.logger.info(`Alert resolved: ${alertId}`);
      this.emit('alertResolved', alert);
    }
  }

  /**
   * Get system health summary
   */
  getSystemHealthSummary(): {
    totalPlugins: number;
    healthyPlugins: number;
    degradedPlugins: number;
    unhealthyPlugins: number;
    criticalPlugins: number;
    activeAlerts: number;
    criticalAlerts: number;
  } {
    const healthChecks = this.getAllHealthChecks();
    const activeAlerts = this.getActiveAlerts();

    const summary = {
      totalPlugins: healthChecks.length,
      healthyPlugins: 0,
      degradedPlugins: 0,
      unhealthyPlugins: 0,
      criticalPlugins: 0,
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length
    };

    for (const check of healthChecks) {
      switch (check.status) {
        case 'healthy': summary.healthyPlugins++; break;
        case 'degraded': summary.degradedPlugins++; break;
        case 'unhealthy': summary.unhealthyPlugins++; break;
        case 'critical': summary.criticalPlugins++; break;
      }
    }

    return summary;
  }

  /**
   * Private: Get or create metrics for plugin
   */
  private getOrCreateMetrics(installationId: string): PluginMetrics {
    let metrics = this.metrics.get(installationId);
    
    if (!metrics) {
      metrics = {
        installationId,
        pluginId: '', // Will be updated when available
        totalInvocations: 0,
        successfulInvocations: 0,
        failedInvocations: 0,
        averageResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        errorRate: 0,
        lastActivity: new Date(),
        performanceSamples: [],
        errorSamples: []
      };
      
      this.metrics.set(installationId, metrics);
      this.logger.debug(`Created metrics for plugin ${installationId}`);
    }
    
    return metrics;
  }

  /**
   * Private: Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    this.logger.debug('Started health checks');
  }

  /**
   * Private: Perform health checks on all plugins
   */
  private performHealthChecks(): void {
    for (const [installationId, metrics] of this.metrics.entries()) {
      this.performHealthCheck(installationId, metrics);
    }
  }

  /**
   * Private: Perform health check on single plugin
   */
  private performHealthCheck(installationId: string, metrics: PluginMetrics): void {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check error rate
    if (metrics.errorRate > this.config.performanceThresholds.errorRate) {
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
      recommendations.push('Review plugin logs and fix errors');
      score -= 30;
    }

    // Check response time
    if (metrics.averageResponseTime > this.config.performanceThresholds.responseTime) {
      issues.push(`Slow response time: ${metrics.averageResponseTime.toFixed(0)}ms`);
      recommendations.push('Optimize plugin performance');
      score -= 20;
    }

    // Check memory usage
    const memoryMB = metrics.memoryUsage / (1024 * 1024);
    if (memoryMB > this.config.performanceThresholds.memoryUsage) {
      issues.push(`High memory usage: ${memoryMB.toFixed(1)}MB`);
      recommendations.push('Reduce memory consumption');
      score -= 20;
    }

    // Check CPU usage
    if (metrics.cpuUsage > this.config.performanceThresholds.cpuUsage) {
      issues.push(`High CPU usage: ${(metrics.cpuUsage * 100).toFixed(1)}%`);
      recommendations.push('Optimize CPU-intensive operations');
      score -= 20;
    }

    // Check activity
    const timeSinceActivity = Date.now() - metrics.lastActivity.getTime();
    if (timeSinceActivity > 24 * 60 * 60 * 1000) { // 24 hours
      issues.push('Plugin has been inactive for more than 24 hours');
      score -= 10;
    }

    // Determine status
    let status: HealthCheck['status'];
    if (score >= 90) {
      status = 'healthy';
    } else if (score >= 70) {
      status = 'degraded';
    } else if (score >= 50) {
      status = 'unhealthy';
    } else {
      status = 'critical';
    }

    const healthCheck: HealthCheck = {
      installationId,
      status,
      score,
      issues,
      recommendations,
      lastCheck: new Date()
    };

    this.healthChecks.set(installationId, healthCheck);

    // Create health alert if status is concerning
    if (status === 'unhealthy' || status === 'critical') {
      const severity = status === 'critical' ? 'critical' : 'high';
      this.createAlert(
        installationId,
        'performance',
        severity,
        `Plugin health is ${status} (score: ${score})`,
        { healthCheck }
      );
    }

    this.logger.debug(`Health check completed for ${installationId}`, {
      status,
      score,
      issueCount: issues.length
    });
  }

  /**
   * Private: Check performance alerts
   */
  private checkPerformanceAlerts(installationId: string, metrics: PluginMetrics): void {
    if (!this.config.enableAlerts) return;

    // Check error rate alert
    if (metrics.errorRate > this.config.performanceThresholds.errorRate) {
      this.createAlert(
        installationId,
        'performance',
        'high',
        `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        { errorRate: metrics.errorRate }
      );
    }

    // Check response time alert
    if (metrics.averageResponseTime > this.config.performanceThresholds.responseTime) {
      this.createAlert(
        installationId,
        'performance',
        'medium',
        `Slow response time: ${metrics.averageResponseTime.toFixed(0)}ms`,
        { responseTime: metrics.averageResponseTime }
      );
    }
  }

  /**
   * Private: Check resource usage alerts
   */
  private checkResourceAlerts(installationId: string, metrics: PluginMetrics): void {
    if (!this.config.enableAlerts) return;

    // Check memory usage alert
    const memoryMB = metrics.memoryUsage / (1024 * 1024);
    if (memoryMB > this.config.performanceThresholds.memoryUsage) {
      this.createAlert(
        installationId,
        'memory',
        'high',
        `High memory usage: ${memoryMB.toFixed(1)}MB`,
        { memoryUsage: memoryMB }
      );
    }

    // Check CPU usage alert
    if (metrics.cpuUsage > this.config.performanceThresholds.cpuUsage) {
      this.createAlert(
        installationId,
        'performance',
        'high',
        `High CPU usage: ${(metrics.cpuUsage * 100).toFixed(1)}%`,
        { cpuUsage: metrics.cpuUsage }
      );
    }
  }

  /**
   * Private: Create alert
   */
  private createAlert(
    installationId: string,
    type: Alert['type'],
    severity: Alert['severity'],
    message: string,
    data: any
  ): void {
    const alertId = `alert-${installationId}-${type}-${Date.now()}`;
    
    const alert: Alert = {
      id: alertId,
      installationId,
      type,
      severity,
      message,
      data,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.set(alertId, alert);

    this.logger.warn(`Alert created: ${message}`, {
      alertId,
      installationId,
      type,
      severity
    });

    this.emit('alert', alert);
  }

  /**
   * Private: Start alert cleanup
   */
  private startAlertCleanup(): void {
    this.alertCleanupInterval = setInterval(() => {
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000); // 1 hour

    this.logger.debug('Started alert cleanup');
  }

  /**
   * Private: Clean up old alerts
   */
  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - this.config.alertRetentionPeriod;
    let cleanedCount = 0;

    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.timestamp.getTime() < cutoff) {
        this.alerts.delete(alertId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} old alerts`);
    }
  }
}