/**
 * AutomationList - Display and manage automation recipes
 * 
 * This component provides:
 * - List of automation recipes with status indicators
 * - Toggle, edit, delete, and test actions
 * - Loading states and empty states
 * - Search and filtering integration
 * - Modern UI with proper accessibility
 */

import React from 'react';
import { AutomationRecipe } from '@flow-desk/shared';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface AutomationListProps {
  automations: AutomationRecipe[];
  onEdit: (recipe: AutomationRecipe) => void;
  onDelete: (recipeId: string) => void;
  onToggle: (recipeId: string) => void;
  onTest: (recipe: AutomationRecipe) => void;
  isLoading?: boolean;
}

export const AutomationList: React.FC<AutomationListProps> = ({
  automations,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  isLoading = false
}) => {
  const getCategoryColor = (category: string) => {
    const colors = {
      productivity: 'bg-blue-100 text-blue-800',
      email: 'bg-green-100 text-green-800',
      calendar: 'bg-purple-100 text-purple-800',
      tasks: 'bg-orange-100 text-orange-800',
      files: 'bg-gray-100 text-gray-800',
      communication: 'bg-pink-100 text-pink-800',
      integrations: 'bg-indigo-100 text-indigo-800',
      notifications: 'bg-yellow-100 text-yellow-800',
      workflows: 'bg-red-100 text-red-800',
      utilities: 'bg-teal-100 text-teal-800',
      custom: 'bg-slate-100 text-slate-800'
    };
    return colors[category as keyof typeof colors] || colors.custom;
  };

  const formatExecutionTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes > 0 ? `${minutes}m ago` : 'Just now';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="p-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-gray-300 rounded-full" />
                  <div>
                    <div className="h-4 bg-gray-300 rounded w-48 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-32" />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-6 bg-gray-300 rounded w-16" />
                  <div className="h-8 bg-gray-300 rounded w-8" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (automations.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl text-gray-400">🤖</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No automations yet
        </h3>
        <p className="text-gray-500 mb-6">
          Create your first automation to streamline your workflow.
        </p>
        <Button
          onClick={() => {/* This will be handled by parent component */}}
          className="mx-auto"
        >
          Create First Automation
        </Button>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {automations.map((automation) => (
        <Card key={automation.id} className="p-0 shadow-none border-0 rounded-none">
          <div className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                {/* Status Indicator */}
                <div className="flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full ${
                    automation.enabled 
                      ? 'bg-green-500' 
                      : 'bg-gray-300'
                  }`} />
                </div>

                {/* Automation Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-1">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {automation.name}
                    </h3>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getCategoryColor(automation.category)}`}
                    >
                      {automation.category}
                    </Badge>
                    {automation.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {automation.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{automation.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500 space-x-4">
                    <span>{automation.trigger.type.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>{automation.actions.length} action{automation.actions.length !== 1 ? 's' : ''}</span>
                    {automation.lastExecutedAt && (
                      <>
                        <span>•</span>
                        <span>Last run {formatExecutionTime(automation.lastExecutedAt)}</span>
                      </>
                    )}
                  </div>
                  
                  {automation.description && (
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {automation.description}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {automation.stats.totalExecutions.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">executions</div>
                  <div className={`text-xs ${
                    automation.stats.successRate >= 0.9 
                      ? 'text-green-600' 
                      : automation.stats.successRate >= 0.7 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                  }`}>
                    {Math.round(automation.stats.successRate * 100)}% success
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 ml-4">
                {/* Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={automation.enabled}
                    onChange={() => onToggle(automation.id)}
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors ${
                    automation.enabled 
                      ? 'bg-blue-600' 
                      : 'bg-gray-300'
                  }`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-lg transform transition-transform ${
                      automation.enabled 
                        ? 'translate-x-5' 
                        : 'translate-x-0.5'
                    } mt-0.5`} />
                  </div>
                  <span className="sr-only">
                    {automation.enabled ? 'Disable' : 'Enable'} automation
                  </span>
                </label>

                {/* Action Buttons */}
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTest(automation)}
                    className="h-8 w-8 p-0"
                    title="Test automation"
                  >
                    <span className="text-sm">▶️</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(automation)}
                    className="h-8 w-8 p-0"
                    title="Edit automation"
                  >
                    <span className="text-sm">✏️</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(automation.id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    title="Delete automation"
                  >
                    <span className="text-sm">🗑️</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};