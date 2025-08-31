/**
 * Automation Dashboard - Main automation management interface
 * 
 * This component provides:
 * - Overview of all automations
 * - Quick actions and controls
 * - Performance metrics and analytics
 * - Template marketplace access
 * - Recent activity and logs
 */

import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  AutomationRecipe,
  AutomationExecution,
  AutomationTemplate 
} from '@flow-desk/shared';

import { AutomationBuilder } from './AutomationBuilder';
import { AutomationList } from './AutomationList';
import { AutomationMetrics } from './AutomationMetrics';
import { TemplateMarketplace } from './TemplateMarketplace';
import { ExecutionLogs } from './ExecutionLogs';
import { AutomationSettings } from './AutomationSettings';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Dropdown } from '../ui/Dropdown';

import { 
  setLoading,
  setError,
  addRule,
  updateRule,
  removeRule,
  toggleRule 
} from '../../store/slices/automationSlice';

interface AutomationDashboardProps {
  // Optional props for specific views
  initialView?: 'dashboard' | 'builder' | 'templates' | 'logs' | 'settings';
  recipeId?: string;
}

export const AutomationDashboard: React.FC<AutomationDashboardProps> = ({
  initialView = 'dashboard',
  recipeId
}) => {
  const dispatch = useDispatch();
  const { 
    rules,
    executions,
    templates,
    isLoading,
    error,
    settings 
  } = useSelector((state: any) => state.automation);

  const [currentView, setCurrentView] = useState(initialView);
  const [selectedRecipe, setSelectedRecipe] = useState<AutomationRecipe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'executions' | 'success_rate'>('created');
  const [metrics, setMetrics] = useState<any>(null);
  const [recentExecutions, setRecentExecutions] = useState<AutomationExecution[]>([]);

  // Load data on mount
  useEffect(() => {
    loadAutomationData();
  }, []);

  // Load specific recipe if provided
  useEffect(() => {
    if (recipeId) {
      const recipe = rules.find((r: AutomationRecipe) => r.id === recipeId);
      if (recipe) {
        setSelectedRecipe(recipe);
        setCurrentView('builder');
      }
    }
  }, [recipeId, rules]);

  const loadAutomationData = async () => {
    try {
      dispatch(setLoading(true));
      
      // Load automation metrics
      const metricsData = await window.automationAPI.getMetrics();
      setMetrics(metricsData);

      // Load recent executions
      const executionsData = await window.automationAPI.getRecentExecutions(20);
      setRecentExecutions(executionsData);

    } catch (error) {
      dispatch(setError(error.message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleCreateAutomation = () => {
    setSelectedRecipe(null);
    setCurrentView('builder');
  };

  const handleEditAutomation = (recipe: AutomationRecipe) => {
    setSelectedRecipe(recipe);
    setCurrentView('builder');
  };

  const handleDeleteAutomation = async (recipeId: string) => {
    try {
      await window.automationAPI.deleteRecipe(recipeId);
      dispatch(removeRule(recipeId));
    } catch (error) {
      dispatch(setError(error.message));
    }
  };

  const handleToggleAutomation = async (recipeId: string) => {
    try {
      await window.automationAPI.toggleRecipe(recipeId);
      dispatch(toggleRule(recipeId));
    } catch (error) {
      dispatch(setError(error.message));
    }
  };

  const handleTestAutomation = async (recipe: AutomationRecipe) => {
    try {
      await window.automationAPI.testRecipe(recipe.id);
      // Show success notification
    } catch (error) {
      dispatch(setError(error.message));
    }
  };

  const handleSaveAutomation = async (recipe: AutomationRecipe) => {
    try {
      if (recipe.id && rules.find((r: AutomationRecipe) => r.id === recipe.id)) {
        await window.automationAPI.updateRecipe(recipe.id, recipe);
        dispatch(updateRule({ id: recipe.id, updates: recipe }));
      } else {
        const newRecipe = await window.automationAPI.createRecipe(recipe);
        dispatch(addRule(newRecipe));
      }
      
      setCurrentView('dashboard');
      setSelectedRecipe(null);
    } catch (error) {
      dispatch(setError(error.message));
    }
  };

  const handleInstallTemplate = async (template: AutomationTemplate, variables: Record<string, any>) => {
    try {
      const { recipe } = await window.automationAPI.installTemplate(template.id, variables);
      dispatch(addRule(recipe));
      // Show success notification
    } catch (error) {
      dispatch(setError(error.message));
    }
  };

  // Filter and sort automations
  const filteredAndSortedRules = React.useMemo(() => {
    let filtered = rules.filter((rule: AutomationRecipe) => {
      const matchesSearch = searchQuery === '' || 
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = filterCategory === 'all' || rule.category === filterCategory;

      return matchesSearch && matchesCategory;
    });

    // Sort
    filtered.sort((a: AutomationRecipe, b: AutomationRecipe) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'executions':
          return b.stats.totalExecutions - a.stats.totalExecutions;
        case 'success_rate':
          return b.stats.successRate - a.stats.successRate;
        default:
          return 0;
      }
    });

    return filtered;
  }, [rules, searchQuery, filterCategory, sortBy]);

  if (currentView === 'builder') {
    return (
      <AutomationBuilder
        recipe={selectedRecipe}
        onSave={handleSaveAutomation}
        onTest={handleTestAutomation}
        onClose={() => {
          setCurrentView('dashboard');
          setSelectedRecipe(null);
        }}
      />
    );
  }

  return (
    <div className="automation-dashboard flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage your workflow automations
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            
            <Button
              variant="outline"
              onClick={() => setCurrentView('templates')}
            >
              📋 Browse Templates
            </Button>
            
            <Button
              onClick={handleCreateAutomation}
            >
              ➕ Create Automation
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex mt-4 border-b border-gray-200">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'templates', label: 'Templates', icon: '📋' },
            { id: 'logs', label: 'Execution Logs', icon: '📜' },
            { id: 'settings', label: 'Settings', icon: '⚙️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentView(tab.id as any)}
              className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                currentView === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {currentView === 'dashboard' && (
          <div className="p-6">
            {/* Metrics Overview */}
            {metrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <span className="text-blue-600 text-xl">🤖</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Total Automations</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.totalRecipes}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <span className="text-green-600 text-xl">✅</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Active</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.activeRecipes}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <span className="text-purple-600 text-xl">🔄</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Total Executions</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.totalExecutions.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <span className="text-yellow-600 text-xl">📈</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">Success Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Math.round(metrics.successRate * 100)}%
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Automations List */}
              <div className="lg:col-span-2">
                <Card>
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Your Automations</h2>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="text"
                          placeholder="Search automations..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-48"
                        />
                        <Dropdown
                          value={filterCategory}
                          onChange={setFilterCategory}
                          options={[
                            { label: 'All Categories', value: 'all' },
                            { label: 'Productivity', value: 'productivity' },
                            { label: 'Email', value: 'email' },
                            { label: 'Calendar', value: 'calendar' },
                            { label: 'Tasks', value: 'tasks' },
                            { label: 'Communication', value: 'communication' }
                          ]}
                        />
                        <Dropdown
                          value={sortBy}
                          onChange={setSortBy}
                          options={[
                            { label: 'Created Date', value: 'created' },
                            { label: 'Name', value: 'name' },
                            { label: 'Executions', value: 'executions' },
                            { label: 'Success Rate', value: 'success_rate' }
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  <AutomationList
                    automations={filteredAndSortedRules}
                    onEdit={handleEditAutomation}
                    onDelete={handleDeleteAutomation}
                    onToggle={handleToggleAutomation}
                    onTest={handleTestAutomation}
                    isLoading={isLoading}
                  />
                </Card>
              </div>

              {/* Recent Activity */}
              <div className="space-y-6">
                <Card>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                    <div className="space-y-3">
                      {recentExecutions.slice(0, 10).map((execution) => {
                        const recipe = rules.find((r: AutomationRecipe) => r.id === execution.recipeId);
                        return (
                          <div key={execution.id} className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
                            <div className={`w-2 h-2 rounded-full ${
                              execution.status === 'completed' ? 'bg-green-500' :
                              execution.status === 'failed' ? 'bg-red-500' :
                              execution.status === 'running' ? 'bg-yellow-500' :
                              'bg-gray-400'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {recipe?.name || 'Unknown Automation'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(execution.startedAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-xs font-medium">
                              {execution.status === 'completed' && (
                                <span className="text-green-600">✓</span>
                              )}
                              {execution.status === 'failed' && (
                                <span className="text-red-600">✗</span>
                              )}
                              {execution.status === 'running' && (
                                <span className="text-yellow-600">⏳</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {recentExecutions.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>No recent executions</p>
                        <p className="text-sm mt-1">Your automation activity will appear here</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        onClick={handleCreateAutomation}
                        className="w-full justify-start"
                      >
                        ➕ Create New Automation
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setCurrentView('templates')}
                        className="w-full justify-start"
                      >
                        📋 Browse Templates
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setCurrentView('logs')}
                        className="w-full justify-start"
                      >
                        📜 View Execution Logs
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setCurrentView('settings')}
                        className="w-full justify-start"
                      >
                        ⚙️ Automation Settings
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {currentView === 'templates' && (
          <TemplateMarketplace
            onInstall={handleInstallTemplate}
            onBack={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'logs' && (
          <ExecutionLogs
            executions={executions}
            recipes={rules}
            onBack={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'settings' && (
          <AutomationSettings
            settings={settings}
            onSave={(newSettings) => {
              // Handle settings save
            }}
            onBack={() => setCurrentView('dashboard')}
          />
        )}
      </div>
    </div>
  );
};

export default AutomationDashboard;