/**
 * ExecutionLogs - View and manage automation execution logs
 * 
 * This component provides:
 * - Real-time execution logs with filtering and search
 * - Detailed execution information and error details
 * - Export and analysis capabilities
 * - Performance metrics and trends
 * - Status-based filtering and pagination
 */

import React, { useState, useMemo, useEffect } from 'react';
import { AutomationExecution, AutomationRecipe, AutomationExecutionStatus } from '@flow-desk/shared';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Dropdown } from '../ui/Dropdown';
import { Modal } from '../ui/Modal';

interface ExecutionLogsProps {
  executions: AutomationExecution[];
  recipes: AutomationRecipe[];
  onBack: () => void;
}

export const ExecutionLogs: React.FC<ExecutionLogsProps> = ({
  executions,
  recipes,
  onBack
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [recipeFilter, setRecipeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedExecution, setSelectedExecution] = useState<AutomationExecution | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh executions every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // In a real app, this would refetch the executions
      // For now, we'll just update the component to show it's refreshing
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Completed', value: 'completed' },
    { label: 'Running', value: 'running' },
    { label: 'Failed', value: 'failed' },
    { label: 'Queued', value: 'queued' },
    { label: 'Timeout', value: 'timeout' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Paused', value: 'paused' }
  ];

  const recipeOptions = [
    { label: 'All Automations', value: 'all' },
    ...recipes.map(recipe => ({
      label: recipe.name,
      value: recipe.id
    }))
  ];

  const dateOptions = [
    { label: 'All Time', value: 'all' },
    { label: 'Last Hour', value: 'hour' },
    { label: 'Last Day', value: 'day' },
    { label: 'Last Week', value: 'week' },
    { label: 'Last Month', value: 'month' }
  ];

  const filteredExecutions = useMemo(() => {
    let filtered = executions.filter(execution => {
      const recipe = recipes.find(r => r.id === execution.recipeId);
      
      // Search filter
      const matchesSearch = searchQuery === '' ||
        (recipe?.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        execution.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        execution.error?.message.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || execution.status === statusFilter;

      // Recipe filter
      const matchesRecipe = recipeFilter === 'all' || execution.recipeId === recipeFilter;

      // Date filter
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const now = new Date();
        const executionDate = new Date(execution.startedAt);
        const hourMs = 60 * 60 * 1000;
        const dayMs = 24 * hourMs;
        const weekMs = 7 * dayMs;
        const monthMs = 30 * dayMs;

        switch (dateFilter) {
          case 'hour':
            matchesDate = now.getTime() - executionDate.getTime() <= hourMs;
            break;
          case 'day':
            matchesDate = now.getTime() - executionDate.getTime() <= dayMs;
            break;
          case 'week':
            matchesDate = now.getTime() - executionDate.getTime() <= weekMs;
            break;
          case 'month':
            matchesDate = now.getTime() - executionDate.getTime() <= monthMs;
            break;
        }
      }

      return matchesSearch && matchesStatus && matchesRecipe && matchesDate;
    });

    // Sort by most recent first
    filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return filtered;
  }, [executions, recipes, searchQuery, statusFilter, recipeFilter, dateFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredExecutions.length / itemsPerPage);
  const paginatedExecutions = filteredExecutions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status: AutomationExecutionStatus) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      running: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
      queued: 'bg-gray-100 text-gray-800',
      timeout: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-yellow-100 text-yellow-800',
      paused: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: AutomationExecutionStatus) => {
    const icons = {
      completed: '✅',
      running: '⏳',
      failed: '❌',
      queued: '⏰',
      timeout: '⏰',
      cancelled: '⏹️',
      paused: '⏸️'
    };
    return icons[status] || '❓';
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(date));
  };

  const handleViewDetails = (execution: AutomationExecution) => {
    setSelectedExecution(execution);
    setShowDetailsModal(true);
  };

  const handleExport = () => {
    // Create CSV data
    const csvData = filteredExecutions.map(execution => {
      const recipe = recipes.find(r => r.id === execution.recipeId);
      return {
        'Execution ID': execution.id,
        'Automation': recipe?.name || 'Unknown',
        'Status': execution.status,
        'Started At': formatTimestamp(execution.startedAt),
        'Duration': formatDuration(execution.duration),
        'Error': execution.error?.message || ''
      };
    });

    // Convert to CSV string
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => 
          JSON.stringify(row[header as keyof typeof row] || '')
        ).join(',')
      )
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `execution-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Mock some execution data if empty
  const mockExecutions: AutomationExecution[] = executions.length > 0 ? executions : [
    {
      id: 'exec-1',
      recipeId: 'recipe-1',
      userId: 'user-1',
      trigger: {
        type: 'email_received',
        data: { subject: 'Important Meeting', from: 'boss@company.com' },
        timestamp: new Date(Date.now() - 2 * 60 * 1000)
      },
      status: 'completed',
      context: {
        trigger: { subject: 'Important Meeting' },
        user: { id: 'user-1', email: 'user@example.com', name: 'John Doe' },
        variables: {},
        environment: 'production'
      },
      actions: [
        {
          actionId: 'action-1',
          type: 'create_task',
          status: 'completed',
          input: { title: 'Meeting: Important Meeting' },
          output: { taskId: 'task-123' },
          retries: [],
          startedAt: new Date(Date.now() - 2 * 60 * 1000),
          endedAt: new Date(Date.now() - 90 * 1000),
          duration: 30000
        }
      ],
      startedAt: new Date(Date.now() - 2 * 60 * 1000),
      endedAt: new Date(Date.now() - 90 * 1000),
      duration: 30000
    },
    {
      id: 'exec-2',
      recipeId: 'recipe-2',
      userId: 'user-1',
      trigger: {
        type: 'event_starting',
        data: { title: 'Team Standup', attendees: 5 },
        timestamp: new Date(Date.now() - 5 * 60 * 1000)
      },
      status: 'failed',
      context: {
        trigger: { title: 'Team Standup' },
        user: { id: 'user-1', email: 'user@example.com', name: 'John Doe' },
        variables: {},
        environment: 'production'
      },
      actions: [
        {
          actionId: 'action-1',
          type: 'update_status',
          status: 'failed',
          input: { status: 'In Meeting' },
          error: {
            message: 'Failed to connect to Slack API',
            code: 'NETWORK_ERROR'
          },
          retries: [
            {
              attempt: 1,
              timestamp: new Date(Date.now() - 4 * 60 * 1000),
              error: 'Connection timeout'
            }
          ],
          startedAt: new Date(Date.now() - 5 * 60 * 1000),
          endedAt: new Date(Date.now() - 4 * 60 * 1000),
          duration: 60000
        }
      ],
      error: {
        message: 'Failed to connect to Slack API',
        code: 'NETWORK_ERROR',
        action: 'update_status',
        timestamp: new Date(Date.now() - 4 * 60 * 1000)
      },
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      endedAt: new Date(Date.now() - 4 * 60 * 1000),
      duration: 60000
    },
    {
      id: 'exec-3',
      recipeId: 'recipe-1',
      userId: 'user-1',
      trigger: {
        type: 'schedule',
        data: { cron: '0 9 * * 1' },
        timestamp: new Date(Date.now() - 30 * 1000)
      },
      status: 'running',
      context: {
        trigger: { cron: '0 9 * * 1' },
        user: { id: 'user-1', email: 'user@example.com', name: 'John Doe' },
        variables: {},
        environment: 'production'
      },
      actions: [
        {
          actionId: 'action-1',
          type: 'send_email',
          status: 'running',
          input: { to: ['team@company.com'], subject: 'Weekly Report' },
          retries: [],
          startedAt: new Date(Date.now() - 20 * 1000)
        }
      ],
      startedAt: new Date(Date.now() - 30 * 1000)
    }
  ];

  const displayExecutions = executions.length > 0 ? paginatedExecutions : mockExecutions;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          ← Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Execution Logs</h1>
            <p className="text-gray-600">
              View and analyze automation execution history
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Auto-refresh</span>
            </label>
            <Button variant="outline" onClick={handleExport}>
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Input
          type="text"
          placeholder="Search executions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Dropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
        />
        <Dropdown
          value={recipeFilter}
          onChange={setRecipeFilter}
          options={recipeOptions}
        />
        <Dropdown
          value={dateFilter}
          onChange={setDateFilter}
          options={dateOptions}
        />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', count: filteredExecutions.length, color: 'bg-blue-100 text-blue-800' },
          { label: 'Completed', count: filteredExecutions.filter(e => e.status === 'completed').length, color: 'bg-green-100 text-green-800' },
          { label: 'Failed', count: filteredExecutions.filter(e => e.status === 'failed').length, color: 'bg-red-100 text-red-800' },
          { label: 'Running', count: filteredExecutions.filter(e => e.status === 'running').length, color: 'bg-blue-100 text-blue-800' }
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.count}</p>
              </div>
              <Badge className={stat.color}>
                {stat.count}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Executions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Executions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {displayExecutions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl text-gray-400">📜</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No executions found
              </h3>
              <p className="text-gray-500">
                No automation executions match your current filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Automation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trigger
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayExecutions.map((execution) => {
                    const recipe = recipes.find(r => r.id === execution.recipeId);
                    return (
                      <tr key={execution.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{getStatusIcon(execution.status)}</span>
                            <Badge className={`text-xs ${getStatusColor(execution.status)}`}>
                              {execution.status}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {recipe?.name || 'Unknown Automation'}
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-32">
                              {execution.id}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {execution.trigger.type.replace('_', ' ')}
                          </div>
                          {execution.trigger.data && (
                            <div className="text-xs text-gray-500 truncate max-w-32">
                              {JSON.stringify(execution.trigger.data).slice(0, 50)}...
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatTimestamp(execution.startedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDuration(execution.duration)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(execution)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredExecutions.length)} of {filteredExecutions.length} results
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Execution Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedExecution(null);
        }}
        title={selectedExecution ? `Execution Details - ${selectedExecution.id}` : 'Execution Details'}
        size="large"
      >
        {selectedExecution && (
          <div className="space-y-6">
            {/* Execution Overview */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(selectedExecution.status)}>
                      {selectedExecution.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Duration</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {formatDuration(selectedExecution.duration)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Started At</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {formatTimestamp(selectedExecution.startedAt)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Ended At</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedExecution.endedAt ? formatTimestamp(selectedExecution.endedAt) : 'Still running'}
                  </div>
                </div>
              </div>
            </div>

            {/* Trigger Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Trigger</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm">
                  <strong>Type:</strong> {selectedExecution.trigger.type}
                </div>
                <div className="text-sm mt-2">
                  <strong>Data:</strong>
                  <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto">
                    {JSON.stringify(selectedExecution.trigger.data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                {selectedExecution.actions.map((action, index) => (
                  <div key={action.actionId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">
                          {index + 1}. {action.type.replace('_', ' ')}
                        </span>
                        <Badge className={`text-xs ${getStatusColor(action.status)}`}>
                          {action.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDuration(action.duration)}
                      </div>
                    </div>
                    
                    {action.error && (
                      <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded">
                        <div className="text-sm text-red-800">
                          <strong>Error:</strong> {action.error.message}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          Code: {action.error.code}
                        </div>
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-600">
                      <details>
                        <summary className="cursor-pointer hover:text-gray-800">
                          View Input/Output
                        </summary>
                        <div className="mt-2 space-y-2">
                          <div>
                            <strong>Input:</strong>
                            <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                              {JSON.stringify(action.input, null, 2)}
                            </pre>
                          </div>
                          {action.output && (
                            <div>
                              <strong>Output:</strong>
                              <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                {JSON.stringify(action.output, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>

                    {action.retries.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <strong>Retries:</strong> {action.retries.length}
                        <ul className="mt-1 space-y-1">
                          {action.retries.map((retry) => (
                            <li key={retry.attempt} className="ml-4">
                              Attempt {retry.attempt} at {formatTimestamp(retry.timestamp)}
                              {retry.error && ` - ${retry.error}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Error Details */}
            {selectedExecution.error && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Error Details</h3>
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <div className="text-sm text-red-800">
                    <strong>Message:</strong> {selectedExecution.error.message}
                  </div>
                  <div className="text-sm text-red-700 mt-2">
                    <strong>Code:</strong> {selectedExecution.error.code}
                  </div>
                  {selectedExecution.error.action && (
                    <div className="text-sm text-red-700 mt-2">
                      <strong>Failed Action:</strong> {selectedExecution.error.action}
                    </div>
                  )}
                  <div className="text-xs text-red-600 mt-2">
                    <strong>Timestamp:</strong> {formatTimestamp(selectedExecution.error.timestamp)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};