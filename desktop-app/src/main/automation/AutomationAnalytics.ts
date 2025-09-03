/**
 * Automation Analytics and Monitoring System
 * 
 * This system provides:
 * - Real-time automation execution monitoring
 * - Performance analytics and metrics
 * - Error tracking and alerting
 * - Usage patterns and optimization insights
 * - Cost analysis and resource utilization
 * - Predictive analytics and recommendations
 */

import { EventEmitter } from 'events';
import {
  AutomationRecipe,
  AutomationExecution,
  AutomationExecutionStatus
} from '@flow-desk/shared/types/automations';

interface AutomationMetrics {
  // Execution metrics
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  medianExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  
  // Success metrics
  successRate: number;
  errorRate: number;
  timeoutRate: number;
  retryRate: number;
  
  // Performance metrics
  throughput: number; // executions per hour
  concurrentExecutions: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
  };
  
  // Time-based metrics
  hourlyStats: HourlyStats[];
  dailyStats: DailyStats[];
  weeklyStats: WeeklyStats[];
  monthlyStats: MonthlyStats[];
}

interface HourlyStats {
  hour: string; // ISO hour
  executions: number;
  successes: number;
  failures: number;
  avgTime: number;
  errors: ErrorSummary[];
}

interface DailyStats {
  date: string; // ISO date
  executions: number;
  successes: number;
  failures: number;
  avgTime: number;
  topErrors: ErrorSummary[];
  peakHour: number;
  resourceUsage: ResourceUsage;
}

interface WeeklyStats {
  week: string; // ISO week
  executions: number;
  successes: number;
  failures: number;
  avgTime: number;
  trends: {
    executionTrend: 'up' | 'down' | 'stable';
    successTrend: 'up' | 'down' | 'stable';
    performanceTrend: 'up' | 'down' | 'stable';
  };
}

interface MonthlyStats {
  month: string; // YYYY-MM
  executions: number;
  successes: number;
  failures: number;
  avgTime: number;
  costAnalysis: CostAnalysis;
  topAutomations: AutomationRanking[];
}

interface ErrorSummary {
  error: string;
  count: number;
  percentage: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  affectedRecipes: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ResourceUsage {
  cpu: {
    average: number;
    peak: number;
    time: Date;
  };
  memory: {
    average: number;
    peak: number;
    time: Date;
  };
  network: {
    requests: number;
    bandwidth: number;
    errors: number;
  };
}

interface CostAnalysis {
  totalCost: number;
  costPerExecution: number;
  costBreakdown: {
    compute: number;
    storage: number;
    network: number;
    external: number;
  };
  projectedMonthlyCost: number;
  savings: {
    automated: number;
    manual: number;
    efficiency: number;
  };
}

interface AutomationRanking {
  recipeId: string;
  recipeName: string;
  executions: number;
  successRate: number;
  avgTime: number;
  impact: number;
  rank: number;
}

interface PerformanceAlert {
  id: string;
  type: 'performance' | 'error' | 'resource' | 'cost';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  recipeId?: string;
  recipeName?: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

interface AnalyticsInsight {
  id: string;
  type: 'optimization' | 'pattern' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  category: string;
  data: any;
  actionable: boolean;
  actions?: {
    label: string;
    type: 'optimize' | 'configure' | 'disable' | 'investigate';
    parameters: any;
  }[];
  createdAt: Date;
  relevanceScore: number;
}

interface MonitoringConfiguration {
  alerts: {
    enabled: boolean;
    thresholds: {
      errorRate: number;
      executionTime: number;
      successRate: number;
      resourceUsage: number;
    };
    channels: {
      email: boolean;
      slack: boolean;
      webhook: boolean;
    };
  };
  retention: {
    rawData: number; // days
    aggregatedData: number; // days
    alerts: number; // days
  };
  sampling: {
    enabled: boolean;
    rate: number; // 0-1
    mode: 'random' | 'systematic';
  };
}

export class AutomationAnalytics extends EventEmitter {
  private metrics = new Map<string, AutomationMetrics>();
  private executionHistory: AutomationExecution[] = [];
  private alerts: PerformanceAlert[] = [];
  private insights: AnalyticsInsight[] = [];
  private configuration: MonitoringConfiguration;
  
  private readonly maxHistorySize = 10000;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    super();
    
    this.configuration = {
      alerts: {
        enabled: true,
        thresholds: {
          errorRate: 0.1, // 10%
          executionTime: 30000, // 30 seconds
          successRate: 0.9, // 90%
          resourceUsage: 0.8 // 80%
        },
        channels: {
          email: true,
          slack: false,
          webhook: false
        }
      },
      retention: {
        rawData: 30,
        aggregatedData: 365,
        alerts: 90
      },
      sampling: {
        enabled: false,
        rate: 1.0,
        mode: 'random'
      }
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load historical data
      await this.loadHistoricalData();
      
      // Initialize metrics
      await this.initializeMetrics();
      
      // Start monitoring
      this.startMonitoring();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize AutomationAnalytics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Stop monitoring
      this.stopMonitoring();
      
      // Persist data
      await this.persistData();
      
      this.isInitialized = false;
      this.emit('shutdown');
    } catch (error) {
      throw new Error(`Failed to shutdown AutomationAnalytics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Record automation execution for analytics
   */
  async recordExecution(execution: AutomationExecution): Promise<void> {
    if (!this.shouldSample()) return;

    // Add to history
    this.executionHistory.push(execution);
    
    // Maintain history size limit
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }

    // Update metrics
    await this.updateMetrics(execution);
    
    // Check for alerts
    await this.checkAlerts(execution);
    
    // Generate insights
    await this.generateInsights(execution);
    
    this.emit('executionRecorded', execution);
  }

  /**
   * Get comprehensive metrics for a recipe or overall system
   */
  getMetrics(recipeId?: string, timeRange?: {
    start: Date;
    end: Date;
  }): AutomationMetrics {
    let executions = this.executionHistory;
    
    // Filter by recipe
    if (recipeId) {
      executions = executions.filter(e => e.recipeId === recipeId);
    }
    
    // Filter by time range
    if (timeRange) {
      executions = executions.filter(e => 
        e.startedAt >= timeRange.start && e.startedAt <= timeRange.end
      );
    }
    
    if (executions.length === 0) {
      return this.getEmptyMetrics();
    }

    return this.calculateMetrics(executions);
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData(): {
    overview: {
      totalAutomations: number;
      activeAutomations: number;
      totalExecutions: number;
      successRate: number;
      avgExecutionTime: number;
      currentThroughput: number;
    };
    recentActivity: AutomationExecution[];
    topPerformers: AutomationRanking[];
    recentAlerts: PerformanceAlert[];
    insights: AnalyticsInsight[];
  } {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentExecutions = this.executionHistory.filter(e => e.startedAt >= last24Hours);
    const overallMetrics = this.getMetrics();
    
    return {
      overview: {
        totalAutomations: this.metrics.size,
        activeAutomations: this.getActiveAutomationCount(),
        totalExecutions: overallMetrics.totalExecutions,
        successRate: overallMetrics.successRate,
        avgExecutionTime: overallMetrics.averageExecutionTime,
        currentThroughput: overallMetrics.throughput
      },
      recentActivity: recentExecutions
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, 10),
      topPerformers: this.getTopPerformers(),
      recentAlerts: this.alerts
        .filter(a => !a.acknowledged)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5),
      insights: this.insights
        .filter(i => i.relevanceScore > 0.7)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 8)
    };
  }

  /**
   * Get detailed performance analysis for a specific recipe
   */
  getRecipeAnalysis(recipeId: string): {
    metrics: AutomationMetrics;
    trends: {
      executionTrend: Array<{ date: string; value: number }>;
      performanceTrend: Array<{ date: string; value: number }>;
      errorTrend: Array<{ date: string; value: number }>;
    };
    bottlenecks: {
      action: string;
      avgTime: number;
      errorRate: number;
      impact: number;
    }[];
    recommendations: AnalyticsInsight[];
  } {
    const recipeExecutions = this.executionHistory.filter(e => e.recipeId === recipeId);
    const metrics = this.calculateMetrics(recipeExecutions);
    
    return {
      metrics,
      trends: this.calculateTrends(recipeExecutions),
      bottlenecks: this.identifyBottlenecks(recipeExecutions),
      recommendations: this.insights.filter(i => 
        i.data?.recipeId === recipeId || i.category === 'recipe-optimization'
      )
    };
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    indicators: {
      name: string;
      status: 'healthy' | 'warning' | 'critical';
      value: number;
      threshold: number;
      description: string;
    }[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const indicators = [
      {
        name: 'Success Rate',
        status: this.getHealthStatus(metrics.successRate, 0.95, 0.90),
        value: metrics.successRate,
        threshold: 0.95,
        description: 'Percentage of successful automation executions'
      },
      {
        name: 'Average Execution Time',
        status: this.getHealthStatus(15000 / metrics.averageExecutionTime, 0.8, 0.6),
        value: metrics.averageExecutionTime,
        threshold: 15000,
        description: 'Average time for automation execution'
      },
      {
        name: 'Error Rate',
        status: this.getHealthStatus(1 - metrics.errorRate, 0.95, 0.90),
        value: metrics.errorRate,
        threshold: 0.05,
        description: 'Rate of execution errors'
      },
      {
        name: 'Throughput',
        status: this.getHealthStatus(Math.min(metrics.throughput / 100, 1), 0.8, 0.6),
        value: metrics.throughput,
        threshold: 100,
        description: 'Executions processed per hour'
      }
    ];
    
    const criticalCount = indicators.filter(i => i.status === 'critical').length;
    const warningCount = indicators.filter(i => i.status === 'warning').length;
    
    let overallStatus: 'healthy' | 'warning' | 'critical';
    let score: number;
    
    if (criticalCount > 0) {
      overallStatus = 'critical';
      score = Math.max(0, 50 - (criticalCount * 15));
    } else if (warningCount > 0) {
      overallStatus = 'warning';
      score = Math.max(50, 80 - (warningCount * 10));
    } else {
      overallStatus = 'healthy';
      score = Math.min(100, 85 + (indicators.length * 3));
    }
    
    const recommendations = this.getHealthRecommendations(indicators);
    
    return {
      status: overallStatus,
      score,
      indicators,
      recommendations
    };
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;
    
    alert.acknowledged = true;
    this.emit('alertAcknowledged', alert);
    
    return true;
  }

  /**
   * Get automation optimization recommendations
   */
  getOptimizationRecommendations(limit: number = 10): AnalyticsInsight[] {
    return this.insights
      .filter(i => i.type === 'optimization' && i.actionable)
      .sort((a, b) => {
        // Sort by impact and relevance
        const scoreA = this.getImpactScore(a.impact) * a.relevanceScore;
        const scoreB = this.getImpactScore(b.impact) * b.relevanceScore;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * Update monitoring configuration
   */
  updateConfiguration(config: Partial<MonitoringConfiguration>): void {
    this.configuration = { ...this.configuration, ...config };
    this.emit('configurationUpdated', this.configuration);
  }

  // Private methods

  private shouldSample(): boolean {
    if (!this.configuration.sampling.enabled) return true;
    
    if (this.configuration.sampling.mode === 'random') {
      return Math.random() < this.configuration.sampling.rate;
    }
    
    // Systematic sampling would be implemented here
    return true;
  }

  private async updateMetrics(execution: AutomationExecution): Promise<void> {
    // Update overall metrics
    const overallMetrics = this.metrics.get('overall') || this.getEmptyMetrics();
    this.updateMetricsWithExecution(overallMetrics, execution);
    this.metrics.set('overall', overallMetrics);
    
    // Update recipe-specific metrics
    const recipeMetrics = this.metrics.get(execution.recipeId) || this.getEmptyMetrics();
    this.updateMetricsWithExecution(recipeMetrics, execution);
    this.metrics.set(execution.recipeId, recipeMetrics);
  }

  private updateMetricsWithExecution(metrics: AutomationMetrics, execution: AutomationExecution): void {
    metrics.totalExecutions++;
    
    if (execution.status === 'completed') {
      metrics.successfulExecutions++;
    } else if (execution.status === 'failed') {
      metrics.failedExecutions++;
    }
    
    if (execution.duration) {
      const newAvg = ((metrics.averageExecutionTime * (metrics.totalExecutions - 1)) + execution.duration) / metrics.totalExecutions;
      metrics.averageExecutionTime = newAvg;
    }
    
    metrics.successRate = metrics.totalExecutions > 0 ? metrics.successfulExecutions / metrics.totalExecutions : 0;
    metrics.errorRate = metrics.totalExecutions > 0 ? metrics.failedExecutions / metrics.totalExecutions : 0;
    
    // Calculate throughput (executions per hour)
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentExecutions = this.executionHistory.filter(e => e.startedAt.getTime() > oneHourAgo);
    metrics.throughput = recentExecutions.length;
  }

  private async checkAlerts(execution: AutomationExecution): Promise<void> {
    if (!this.configuration.alerts.enabled) return;
    
    const recipeMetrics = this.metrics.get(execution.recipeId);
    if (!recipeMetrics) return;
    
    const thresholds = this.configuration.alerts.thresholds;
    
    // Check error rate
    if (recipeMetrics.errorRate > thresholds.errorRate) {
      await this.createAlert({
        type: 'error',
        severity: 'warning',
        title: 'High Error Rate Detected',
        message: `Recipe ${execution.recipeId} has error rate of ${(recipeMetrics.errorRate * 100).toFixed(1)}%`,
        recipeId: execution.recipeId,
        metric: 'errorRate',
        threshold: thresholds.errorRate,
        currentValue: recipeMetrics.errorRate
      });
    }
    
    // Check execution time
    if (execution.duration && execution.duration > thresholds.executionTime) {
      await this.createAlert({
        type: 'performance',
        severity: 'warning',
        title: 'Slow Execution Detected',
        message: `Execution took ${execution.duration}ms, exceeding threshold of ${thresholds.executionTime}ms`,
        recipeId: execution.recipeId,
        metric: 'executionTime',
        threshold: thresholds.executionTime,
        currentValue: execution.duration
      });
    }
    
    // Check success rate
    if (recipeMetrics.successRate < thresholds.successRate && recipeMetrics.totalExecutions > 10) {
      await this.createAlert({
        type: 'performance',
        severity: 'error',
        title: 'Low Success Rate',
        message: `Recipe ${execution.recipeId} has success rate of ${(recipeMetrics.successRate * 100).toFixed(1)}%`,
        recipeId: execution.recipeId,
        metric: 'successRate',
        threshold: thresholds.successRate,
        currentValue: recipeMetrics.successRate
      });
    }
  }

  private async createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    const alert: PerformanceAlert = {
      ...alertData,
      id: this.generateAlertId(),
      timestamp: new Date(),
      acknowledged: false
    };
    
    this.alerts.push(alert);
    
    // Keep only recent alerts
    const retentionDate = new Date(Date.now() - (this.configuration.retention.alerts * 24 * 60 * 60 * 1000));
    this.alerts = this.alerts.filter(a => a.timestamp > retentionDate);
    
    this.emit('alertCreated', alert);
    
    // Send notifications
    await this.sendAlertNotifications(alert);
  }

  private async generateInsights(execution: AutomationExecution): Promise<void> {
    // Generate various types of insights
    await this.generatePerformanceInsights(execution);
    await this.generatePatternInsights(execution);
    await this.generateOptimizationInsights(execution);
  }

  private async generatePerformanceInsights(execution: AutomationExecution): Promise<void> {
    const recipeExecutions = this.executionHistory.filter(e => e.recipeId === execution.recipeId);
    
    if (recipeExecutions.length >= 10) {
      const avgTime = recipeExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / recipeExecutions.length;
      const slowExecutions = recipeExecutions.filter(e => e.duration && e.duration > avgTime * 1.5);
      
      if (slowExecutions.length / recipeExecutions.length > 0.2) {
        await this.createInsight({
          type: 'optimization',
          title: 'Performance Degradation Detected',
          description: `Recipe ${execution.recipeId} shows inconsistent performance with 20% of executions taking 50% longer than average`,
          impact: 'medium',
          effort: 'medium',
          category: 'performance',
          data: { recipeId: execution.recipeId, avgTime, slowExecutions: slowExecutions.length },
          actionable: true,
          actions: [
            {
              label: 'Analyze Slow Actions',
              type: 'investigate',
              parameters: { recipeId: execution.recipeId, metric: 'execution_time' }
            },
            {
              label: 'Optimize Recipe',
              type: 'optimize',
              parameters: { recipeId: execution.recipeId, focus: 'performance' }
            }
          ],
          relevanceScore: 0.8
        });
      }
    }
  }

  private async generatePatternInsights(execution: AutomationExecution): Promise<void> {
    const recentFailures = this.executionHistory
      .filter(e => e.status === 'failed' && e.startedAt > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .slice(0, 50);
    
    if (recentFailures.length > 0) {
      const errorPatterns = this.analyzeErrorPatterns(recentFailures);
      
      for (const pattern of errorPatterns) {
        if (pattern.frequency > 0.3) { // More than 30% of recent failures
          await this.createInsight({
            type: 'pattern',
            title: 'Recurring Error Pattern',
            description: `Error "${pattern.error}" accounts for ${(pattern.frequency * 100).toFixed(1)}% of recent failures`,
            impact: 'high',
            effort: 'medium',
            category: 'error-analysis',
            data: { pattern, affectedRecipes: pattern.recipeIds },
            actionable: true,
            actions: [
              {
                label: 'Investigate Root Cause',
                type: 'investigate',
                parameters: { error: pattern.error, recipeIds: pattern.recipeIds }
              }
            ],
            relevanceScore: 0.9
          });
        }
      }
    }
  }

  private async generateOptimizationInsights(execution: AutomationExecution): Promise<void> {
    // Analyze resource utilization and suggest optimizations
    const metrics = this.getMetrics(execution.recipeId);
    
    if (metrics.totalExecutions > 20 && metrics.averageExecutionTime > 10000) {
      await this.createInsight({
        type: 'optimization',
        title: 'Long-Running Automation',
        description: `Recipe takes an average of ${(metrics.averageExecutionTime / 1000).toFixed(1)} seconds to execute`,
        impact: 'medium',
        effort: 'low',
        category: 'performance',
        data: { recipeId: execution.recipeId, avgTime: metrics.averageExecutionTime },
        actionable: true,
        actions: [
          {
            label: 'Optimize Actions',
            type: 'optimize',
            parameters: { recipeId: execution.recipeId, focus: 'execution_time' }
          }
        ],
        relevanceScore: 0.75
      });
    }
  }

  private async createInsight(insightData: Omit<AnalyticsInsight, 'id' | 'createdAt'>): Promise<void> {
    // Check if similar insight already exists
    const existingSimilar = this.insights.find(i => 
      i.type === insightData.type && 
      i.category === insightData.category &&
      JSON.stringify(i.data) === JSON.stringify(insightData.data)
    );
    
    if (existingSimilar) {
      existingSimilar.relevanceScore = Math.min(1, existingSimilar.relevanceScore + 0.1);
      return;
    }
    
    const insight: AnalyticsInsight = {
      ...insightData,
      id: this.generateInsightId(),
      createdAt: new Date()
    };
    
    this.insights.push(insight);
    
    // Keep only recent insights
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.insights = this.insights.filter(i => i.createdAt > oneWeekAgo);
    
    this.emit('insightGenerated', insight);
  }

  private calculateMetrics(executions: AutomationExecution[]): AutomationMetrics {
    if (executions.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    
    const executionTimes = executions
      .map(e => e.duration)
      .filter((t): t is number => t !== undefined)
      .sort((a, b) => a - b);
    
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length 
      : 0;
    
    const medianExecutionTime = executionTimes.length > 0 
      ? executionTimes[Math.floor(executionTimes.length / 2)] 
      : 0;
    
    const p95Index = Math.floor(executionTimes.length * 0.95);
    const p99Index = Math.floor(executionTimes.length * 0.99);
    
    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      medianExecutionTime,
      p95ExecutionTime: executionTimes[p95Index] || 0,
      p99ExecutionTime: executionTimes[p99Index] || 0,
      successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      errorRate: totalExecutions > 0 ? failedExecutions / totalExecutions : 0,
      timeoutRate: 0, // Would be calculated from timeout executions
      retryRate: 0, // Would be calculated from retry attempts
      throughput: this.calculateThroughput(executions),
      concurrentExecutions: 0, // Would be tracked in real-time
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        network: 0
      },
      hourlyStats: [],
      dailyStats: [],
      weeklyStats: [],
      monthlyStats: []
    };
  }

  private getEmptyMetrics(): AutomationMetrics {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      medianExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      successRate: 0,
      errorRate: 0,
      timeoutRate: 0,
      retryRate: 0,
      throughput: 0,
      concurrentExecutions: 0,
      resourceUtilization: { cpu: 0, memory: 0, network: 0 },
      hourlyStats: [],
      dailyStats: [],
      weeklyStats: [],
      monthlyStats: []
    };
  }

  private calculateThroughput(executions: AutomationExecution[]): number {
    if (executions.length === 0) return 0;
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentExecutions = executions.filter(e => e.startedAt > oneHourAgo);
    
    return recentExecutions.length;
  }

  private calculateTrends(executions: AutomationExecution[]): {
    executionTrend: Array<{ date: string; value: number }>;
    performanceTrend: Array<{ date: string; value: number }>;
    errorTrend: Array<{ date: string; value: number }>;
  } {
    // Group executions by day
    const dailyData = new Map<string, {
      executions: number;
      totalTime: number;
      errors: number;
    }>();
    
    for (const execution of executions) {
      const date = execution.startedAt.toISOString().split('T')[0];
      const data = dailyData.get(date) || { executions: 0, totalTime: 0, errors: 0 };
      
      data.executions++;
      if (execution.duration) data.totalTime += execution.duration;
      if (execution.status === 'failed') data.errors++;
      
      dailyData.set(date, data);
    }
    
    const sortedDates = Array.from(dailyData.keys()).sort();
    
    return {
      executionTrend: sortedDates.map(date => ({
        date,
        value: dailyData.get(date)!.executions
      })),
      performanceTrend: sortedDates.map(date => {
        const data = dailyData.get(date)!;
        return {
          date,
          value: data.executions > 0 ? data.totalTime / data.executions : 0
        };
      }),
      errorTrend: sortedDates.map(date => ({
        date,
        value: dailyData.get(date)!.errors
      }))
    };
  }

  private identifyBottlenecks(executions: AutomationExecution[]): {
    action: string;
    avgTime: number;
    errorRate: number;
    impact: number;
  }[] {
    // Analyze action performance across executions
    const actionStats = new Map<string, {
      totalTime: number;
      count: number;
      errors: number;
    }>();
    
    for (const execution of executions) {
      if (execution.actions) {
        for (const action of execution.actions) {
          const stats = actionStats.get(action.type) || { totalTime: 0, count: 0, errors: 0 };
          
          stats.count++;
          if (action.duration) stats.totalTime += action.duration;
          if (action.status === 'failed') stats.errors++;
          
          actionStats.set(action.type, stats);
        }
      }
    }
    
    return Array.from(actionStats.entries())
      .map(([action, stats]) => ({
        action,
        avgTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
        errorRate: stats.count > 0 ? stats.errors / stats.count : 0,
        impact: (stats.totalTime / 1000) * (1 + stats.errors / stats.count) // Time impact with error weight
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 10);
  }

  private analyzeErrorPatterns(failedExecutions: AutomationExecution[]): {
    error: string;
    frequency: number;
    recipeIds: string[];
  }[] {
    const errorCounts = new Map<string, Set<string>>();
    
    for (const execution of failedExecutions) {
      const error = execution.error?.message || 'Unknown error';
      const recipeIds = errorCounts.get(error) || new Set();
      recipeIds.add(execution.recipeId);
      errorCounts.set(error, recipeIds);
    }
    
    return Array.from(errorCounts.entries())
      .map(([error, recipeIds]) => ({
        error,
        frequency: recipeIds.size / failedExecutions.length,
        recipeIds: Array.from(recipeIds)
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  private getTopPerformers(): AutomationRanking[] {
    const recipeStats = new Map<string, {
      executions: number;
      successes: number;
      totalTime: number;
      recipeName: string;
    }>();
    
    for (const execution of this.executionHistory) {
      const stats = recipeStats.get(execution.recipeId) || {
        executions: 0,
        successes: 0,
        totalTime: 0,
        recipeName: execution.recipeId // Would get actual name from recipe data
      };
      
      stats.executions++;
      if (execution.status === 'completed') stats.successes++;
      if (execution.duration) stats.totalTime += execution.duration;
      
      recipeStats.set(execution.recipeId, stats);
    }
    
    return Array.from(recipeStats.entries())
      .map(([recipeId, stats]) => ({
        recipeId,
        recipeName: stats.recipeName,
        executions: stats.executions,
        successRate: stats.executions > 0 ? stats.successes / stats.executions : 0,
        avgTime: stats.executions > 0 ? stats.totalTime / stats.executions : 0,
        impact: stats.executions * (stats.executions > 0 ? stats.successes / stats.executions : 0),
        rank: 0
      }))
      .sort((a, b) => b.impact - a.impact)
      .map((item, index) => ({ ...item, rank: index + 1 }))
      .slice(0, 10);
  }

  private getActiveAutomationCount(): number {
    // Would track active automations from recipe manager
    return this.metrics.size;
  }

  private getHealthStatus(value: number, goodThreshold: number, warningThreshold: number): 'healthy' | 'warning' | 'critical' {
    if (value >= goodThreshold) return 'healthy';
    if (value >= warningThreshold) return 'warning';
    return 'critical';
  }

  private getHealthRecommendations(indicators: any[]): string[] {
    const recommendations: string[] = [];
    
    const criticalIndicators = indicators.filter(i => i.status === 'critical');
    const warningIndicators = indicators.filter(i => i.status === 'warning');
    
    if (criticalIndicators.length > 0) {
      recommendations.push('Immediate attention required for critical performance issues');
      recommendations.push('Review failed automations and implement error handling');
    }
    
    if (warningIndicators.length > 0) {
      recommendations.push('Monitor warning indicators and consider optimization');
      recommendations.push('Review automation configurations and resource allocation');
    }
    
    if (indicators.every(i => i.status === 'healthy')) {
      recommendations.push('System is performing well - consider scaling or adding new automations');
    }
    
    return recommendations;
  }

  private getImpactScore(impact: string): number {
    switch (impact) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performPeriodicAnalysis();
    }, 60000); // Every minute
  }

  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private performPeriodicAnalysis(): void {
    // Perform periodic analysis tasks
    this.cleanupOldData();
    this.calculateAggregatedStats();
    this.updateResourceMetrics();
  }

  private cleanupOldData(): void {
    const retentionDate = new Date(Date.now() - (this.configuration.retention.rawData * 24 * 60 * 60 * 1000));
    this.executionHistory = this.executionHistory.filter(e => e.startedAt > retentionDate);
  }

  private calculateAggregatedStats(): void {
    // Calculate and store aggregated statistics
    // This would be implemented based on specific requirements
  }

  private updateResourceMetrics(): void {
    // Update resource utilization metrics
    // This would integrate with system monitoring
  }

  private async sendAlertNotifications(alert: PerformanceAlert): Promise<void> {
    // Send notifications based on configuration
    if (this.configuration.alerts.channels.email) {
      await this.sendEmailAlert(alert);
    }
    
    if (this.configuration.alerts.channels.slack) {
      await this.sendSlackAlert(alert);
    }
    
    if (this.configuration.alerts.channels.webhook) {
      await this.sendWebhookAlert(alert);
    }
  }

  private async sendEmailAlert(alert: PerformanceAlert): Promise<void> {
    // Implementation for email alerts
  }

  private async sendSlackAlert(alert: PerformanceAlert): Promise<void> {
    // Implementation for Slack alerts
  }

  private async sendWebhookAlert(alert: PerformanceAlert): Promise<void> {
    // Implementation for webhook alerts
  }

  private async loadHistoricalData(): Promise<void> {
    // Load historical execution data from storage
  }

  private async initializeMetrics(): Promise<void> {
    // Initialize metrics from historical data
  }

  private async persistData(): Promise<void> {
    // Persist analytics data to storage
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateInsightId(): string {
    return `insight_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
}

// Default export
export const automationAnalytics = new AutomationAnalytics();