/**
 * AutomationMetrics Component
 * 
 * Displays comprehensive metrics and analytics for automation performance
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../ui/utils';

interface MetricsData {
  totalRecipes: number;
  activeRecipes: number;
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  failureRate: number;
  topPerformingRecipes: Array<{
    id: string;
    name: string;
    executions: number;
    successRate: number;
  }>;
  recentTrends: {
    daily: number[];
    weekly: number[];
    labels: string[];
  };
  errorCodes: Record<string, number>;
}

interface AutomationMetricsProps {
  data?: MetricsData;
  refreshInterval?: number;
  className?: string;
  onRefresh?: () => void;
}

export const AutomationMetrics: React.FC<AutomationMetricsProps> = ({
  data,
  refreshInterval = 30000, // 30 seconds
  className,
  onRefresh
}) => {
  const [metricsData, setMetricsData] = useState<MetricsData | null>(data || null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (!data && refreshInterval > 0) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      fetchMetrics(); // Initial fetch
      return () => clearInterval(interval);
    }
  }, [data, refreshInterval]);

  const fetchMetrics = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      // In a real implementation, this would call the automation API
      const mockData: MetricsData = {
        totalRecipes: 12,
        activeRecipes: 8,
        totalExecutions: 1547,
        successRate: 0.94,
        averageExecutionTime: 2.3,
        failureRate: 0.06,
        topPerformingRecipes: [
          { id: '1', name: 'Email Organizer', executions: 245, successRate: 0.98 },
          { id: '2', name: 'Daily Report', executions: 180, successRate: 0.96 },
          { id: '3', name: 'Task Sync', executions: 156, successRate: 0.91 },
        ],
        recentTrends: {
          daily: [12, 15, 8, 22, 18, 25, 19],
          weekly: [89, 102, 85, 115, 98],
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        },
        errorCodes: {
          'TIMEOUT': 8,
          'API_ERROR': 5,
          'VALIDATION_ERROR': 3,
          'NETWORK_ERROR': 2
        }
      };
      
      setMetricsData(mockData);
      setLastUpdated(new Date());
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to fetch automation metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchMetrics();
  };

  if (!metricsData) {
    return (
      <div className={cn('automation-metrics', className)}>
        <Card className="p-8 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">Loading metrics...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('automation-metrics space-y-6', className)}>
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Performance Metrics</h3>
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <span className={cn('text-sm', loading && 'animate-spin')}>
            {loading ? '⟳' : '↻'}
          </span>
          Refresh
        </Button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {metricsData.totalRecipes}
              </p>
              <p className="text-sm text-gray-500">Total Recipes</p>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-sm">📝</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {metricsData.activeRecipes}
              </p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-sm">✅</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {metricsData.totalExecutions.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Executions</p>
            </div>
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 text-sm">🔄</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {Math.round(metricsData.successRate * 100)}%
              </p>
              <p className="text-sm text-gray-500">Success Rate</p>
            </div>
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 text-sm">📈</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Recipes */}
        <Card className="p-6">
          <h4 className="text-lg font-semibold mb-4">Top Performing Recipes</h4>
          <div className="space-y-3">
            {metricsData.topPerformingRecipes.map((recipe, index) => (
              <div key={recipe.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{recipe.name}</p>
                    <p className="text-xs text-gray-500">
                      {recipe.executions} executions
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">
                    {Math.round(recipe.successRate * 100)}%
                  </p>
                  <p className="text-xs text-gray-500">success</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Error Analysis */}
        <Card className="p-6">
          <h4 className="text-lg font-semibold mb-4">Common Errors</h4>
          <div className="space-y-2">
            {Object.entries(metricsData.errorCodes).map(([errorCode, count]) => (
              <div key={errorCode} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-mono">{errorCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{count}</span>
                  <div className="w-16 h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-2 bg-red-500 rounded-full"
                      style={{ 
                        width: `${(count / Math.max(...Object.values(metricsData.errorCodes))) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Performance Trends - Simple visualization */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold mb-4">Daily Execution Trends</h4>
        <div className="flex items-end justify-between h-32 space-x-1">
          {metricsData.recentTrends.daily.map((value, index) => {
            const maxValue = Math.max(...metricsData.recentTrends.daily);
            const height = (value / maxValue) * 100;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="flex-1 flex items-end">
                  <div 
                    className="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                    style={{ height: `${height}%` }}
                    title={`${value} executions`}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {metricsData.recentTrends.labels[index]}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-4 text-xs text-gray-500">
          <span>0</span>
          <span>{Math.max(...metricsData.recentTrends.daily)} executions</span>
        </div>
      </Card>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">
              {metricsData.averageExecutionTime}s
            </p>
            <p className="text-sm text-gray-500">Avg Execution Time</p>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-center">
            <p className="text-lg font-bold text-red-600">
              {Math.round(metricsData.failureRate * 100)}%
            </p>
            <p className="text-sm text-gray-500">Failure Rate</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AutomationMetrics;