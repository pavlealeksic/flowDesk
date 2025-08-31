/**
 * Mobile Automation Dashboard - Overview and management of automations
 * 
 * This component provides:
 * - List of all automations with status
 * - Quick actions (enable/disable, test, edit)
 * - Execution history and statistics
 * - Mobile-optimized interface
 * - Performance metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Switch,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { 
  AutomationRecipe,
  AutomationExecution,
  AutomationExecutionStatus
} from '@flow-desk/shared';

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const { width: screenWidth } = Dimensions.get('window');

interface MobileAutomationDashboardProps {
  onCreateAutomation: () => void;
  onEditAutomation: (recipe: AutomationRecipe) => void;
  onTestAutomation: (recipe: AutomationRecipe) => void;
}

interface AutomationStats {
  totalRecipes: number;
  activeRecipes: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTime: number;
  successRate: number;
}

export const MobileAutomationDashboard: React.FC<MobileAutomationDashboardProps> = ({
  onCreateAutomation,
  onEditAutomation,
  onTestAutomation
}) => {
  const [recipes, setRecipes] = useState<AutomationRecipe[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'automations' | 'history' | 'stats'>('automations');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // These would call the mobile bridge to get data
      await Promise.all([
        loadAutomations(),
        loadExecutionHistory(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Failed to load automation data:', error);
    }
  };

  const loadAutomations = async () => {
    // Mock data for now - would call actual API
    const mockRecipes: AutomationRecipe[] = [
      {
        id: 'recipe-1',
        ownerId: 'user-1',
        name: 'Email to Task',
        description: 'Convert important emails to Jira issues',
        category: 'productivity',
        tags: ['email', 'jira'],
        enabled: true,
        isPublic: false,
        version: '1.0.0',
        trigger: {
          type: 'email_received',
          config: { senderFilters: ['important@company.com'] },
          conditions: []
        },
        actions: [
          {
            id: 'action-1',
            type: 'create_task',
            name: 'Create Jira Issue',
            description: 'Creates a new Jira issue',
            config: { service: 'jira', projectId: 'PROJ' },
            conditions: [],
            errorHandling: {
              strategy: 'stop',
              fallbackActions: [],
              logErrors: true,
              notifyOnError: false
            },
            continueOnError: false
          }
        ],
        settings: {
          timeout: 300,
          maxExecutionsPerHour: 10,
          maxConcurrentExecutions: 1,
          priority: 'normal',
          logLevel: 'info',
          variables: {},
          environment: 'production'
        },
        stats: {
          totalExecutions: 45,
          successfulExecutions: 42,
          failedExecutions: 3,
          avgExecutionTime: 2500,
          successRate: 0.93,
          recentExecutions: []
        },
        metadata: {
          author: { name: 'User', email: 'user@example.com' },
          documentation: '',
          template: { isTemplate: false },
          sharing: { isShared: false, sharedWith: [], permissions: {} }
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-20'),
        lastExecutedAt: new Date('2024-01-28')
      },
      {
        id: 'recipe-2',
        ownerId: 'user-1',
        name: 'Meeting Reminder',
        description: 'Send Slack message before meetings',
        category: 'communication',
        tags: ['calendar', 'slack'],
        enabled: false,
        isPublic: false,
        version: '1.0.0',
        trigger: {
          type: 'event_starting',
          config: { leadTimeMinutes: 15 },
          conditions: []
        },
        actions: [
          {
            id: 'action-2',
            type: 'send_message',
            name: 'Send Slack Message',
            description: 'Sends a message to Slack',
            config: { platform: 'slack', channel: '#general' },
            conditions: [],
            errorHandling: {
              strategy: 'retry',
              fallbackActions: [],
              logErrors: true,
              notifyOnError: true
            },
            continueOnError: false
          }
        ],
        settings: {
          timeout: 300,
          maxExecutionsPerHour: 50,
          maxConcurrentExecutions: 1,
          priority: 'high',
          logLevel: 'info',
          variables: {},
          environment: 'production'
        },
        stats: {
          totalExecutions: 12,
          successfulExecutions: 11,
          failedExecutions: 1,
          avgExecutionTime: 1200,
          successRate: 0.92,
          recentExecutions: []
        },
        metadata: {
          author: { name: 'User', email: 'user@example.com' },
          documentation: '',
          template: { isTemplate: false },
          sharing: { isShared: false, sharedWith: [], permissions: {} }
        },
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-01-25'),
        lastExecutedAt: new Date('2024-01-27')
      }
    ];
    
    setRecipes(mockRecipes);
  };

  const loadExecutionHistory = async () => {
    // Mock execution history
    const mockExecutions: AutomationExecution[] = [
      {
        id: 'exec-1',
        recipeId: 'recipe-1',
        userId: 'user-1',
        trigger: {
          type: 'email_received',
          data: { subject: 'Important: System Alert' },
          timestamp: new Date('2024-01-28T10:30:00Z')
        },
        status: 'completed',
        context: {
          trigger: { subject: 'Important: System Alert' },
          user: { id: 'user-1', email: 'user@example.com', name: 'User' },
          variables: {},
          environment: 'production'
        },
        actions: [],
        startedAt: new Date('2024-01-28T10:30:00Z'),
        endedAt: new Date('2024-01-28T10:30:02Z'),
        duration: 2000
      },
      {
        id: 'exec-2',
        recipeId: 'recipe-2',
        userId: 'user-1',
        trigger: {
          type: 'event_starting',
          data: { title: 'Team Standup' },
          timestamp: new Date('2024-01-27T09:45:00Z')
        },
        status: 'failed',
        context: {
          trigger: { title: 'Team Standup' },
          user: { id: 'user-1', email: 'user@example.com', name: 'User' },
          variables: {},
          environment: 'production'
        },
        actions: [],
        startedAt: new Date('2024-01-27T09:45:00Z'),
        endedAt: new Date('2024-01-27T09:45:01Z'),
        duration: 1000,
        error: {
          message: 'Slack API rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          timestamp: new Date('2024-01-27T09:45:01Z')
        }
      }
    ];
    
    setExecutions(mockExecutions);
  };

  const loadStats = async () => {
    const mockStats: AutomationStats = {
      totalRecipes: 2,
      activeRecipes: 1,
      totalExecutions: 57,
      successfulExecutions: 53,
      failedExecutions: 4,
      avgExecutionTime: 2100,
      successRate: 0.93
    };
    
    setStats(mockStats);
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, []);

  const toggleAutomation = async (recipe: AutomationRecipe) => {
    try {
      // Call API to toggle automation
      const updatedRecipe = { ...recipe, enabled: !recipe.enabled };
      setRecipes(prev => prev.map(r => r.id === recipe.id ? updatedRecipe : r));
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle automation');
    }
  };

  const deleteAutomation = (recipe: AutomationRecipe) => {
    Alert.alert(
      'Delete Automation',
      `Are you sure you want to delete "${recipe.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Call API to delete
              setRecipes(prev => prev.filter(r => r.id !== recipe.id));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete automation');
            }
          }
        }
      ]
    );
  };

  const renderStatsCard = () => {
    if (!stats) return null;

    return (
      <Card style={{ margin: 16, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16 }}>Overview</Text>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#3b82f6' }}>
              {stats.totalRecipes}
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Total</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#10b981' }}>
              {stats.activeRecipes}
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Active</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#f59e0b' }}>
              {stats.totalExecutions}
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Runs</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#8b5cf6' }}>
              {Math.round(stats.successRate * 100)}%
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Success</Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Avg. Execution Time</Text>
            <Text style={{ fontSize: 14, fontWeight: '600' }}>
              {(stats.avgExecutionTime / 1000).toFixed(2)}s
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Last 24h</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#10b981' }}>+{stats.successfulExecutions}</Text>
          </View>
        </View>
      </Card>
    );
  };

  const renderAutomationCard = (recipe: AutomationRecipe) => {
    const statusColor = recipe.enabled ? '#10b981' : '#6b7280';
    const successRate = Math.round(recipe.stats.successRate * 100);
    
    return (
      <Card key={recipe.id} style={{ margin: 16, marginTop: 0 }}>
        <View style={{ padding: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{recipe.name}</Text>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>{recipe.description}</Text>
            </View>
            <Switch
              value={recipe.enabled}
              onValueChange={() => toggleAutomation(recipe)}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor={recipe.enabled ? '#ffffff' : '#f3f4f6'}
            />
          </View>

          {/* Status and Stats */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: statusColor,
              marginRight: 8
            }} />
            <Text style={{ fontSize: 12, color: statusColor, fontWeight: '500' }}>
              {recipe.enabled ? 'Active' : 'Disabled'}
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 16 }}>
              {recipe.stats.totalExecutions} runs • {successRate}% success
            </Text>
          </View>

          {/* Trigger and Actions Preview */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{
              backgroundColor: '#f3f4f6',
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              marginRight: 8
            }}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>
                {getTriggerLabel(recipe.trigger.type)}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>→</Text>
            <View style={{
              backgroundColor: '#f3f4f6',
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              marginLeft: 8
            }}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>
                {recipe.actions.length} action{recipe.actions.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => onEditAutomation(recipe)}>
              <Text style={{ fontSize: 14, color: '#3b82f6', fontWeight: '500' }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onTestAutomation(recipe)}>
              <Text style={{ fontSize: 14, color: '#f59e0b', fontWeight: '500' }}>Test</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteAutomation(recipe)}>
              <Text style={{ fontSize: 14, color: '#ef4444', fontWeight: '500' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  const renderExecutionCard = (execution: AutomationExecution) => {
    const recipe = recipes.find(r => r.id === execution.recipeId);
    const statusColor = getStatusColor(execution.status);
    
    return (
      <Card key={execution.id} style={{ margin: 16, marginTop: 0 }}>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{recipe?.name || 'Unknown Recipe'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: statusColor,
                marginRight: 8
              }} />
              <Text style={{ fontSize: 12, color: statusColor, fontWeight: '500', textTransform: 'capitalize' }}>
                {execution.status}
              </Text>
            </View>
          </View>
          
          <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
            {execution.trigger.timestamp.toLocaleString()}
          </Text>
          
          {execution.duration && (
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Duration: {execution.duration / 1000}s</Text>
          )}
          
          {execution.error && (
            <View style={{ marginTop: 8, padding: 8, backgroundColor: '#fef2f2', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#ef4444' }}>
              <Text style={{ fontSize: 12, color: '#dc2626' }}>{execution.error.message}</Text>
            </View>
          )}
        </View>
      </Card>
    );
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'automations':
        return (
          <View>
            {renderStatsCard()}
            {recipes.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 32 }}>
                <Text style={{ fontSize: 18, color: '#6b7280', marginBottom: 16 }}>No automations yet</Text>
                <Button onPress={onCreateAutomation} title="Create Your First Automation" />
              </View>
            ) : (
              recipes.map(renderAutomationCard)
            )}
          </View>
        );
        
      case 'history':
        return (
          <View>
            {executions.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 32 }}>
                <Text style={{ fontSize: 18, color: '#6b7280' }}>No execution history</Text>
              </View>
            ) : (
              executions.map(renderExecutionCard)
            )}
          </View>
        );
        
      case 'stats':
        return (
          <View style={{ padding: 16 }}>
            {renderStatsCard()}
            
            <Card style={{ marginTop: 16, padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Performance Metrics</Text>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>Detailed analytics coming soon...</Text>
            </Card>
          </View>
        );
        
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Automations</Text>
        <TouchableOpacity onPress={onCreateAutomation}>
          <Text style={{ fontSize: 28, color: '#3b82f6' }}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        flexDirection: 'row'
      }}>
        {[
          { id: 'automations', label: 'Automations' },
          { id: 'history', label: 'History' },
          { id: 'stats', label: 'Stats' }
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              {
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
              },
              selectedTab === tab.id && {
                borderBottomWidth: 2,
                borderBottomColor: '#3b82f6'
              }
            ]}
            onPress={() => setSelectedTab(tab.id as any)}
          >
            <Text style={[
              { fontSize: 16 },
              selectedTab === tab.id ? { color: '#3b82f6', fontWeight: '600' } : { color: '#6b7280' }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderTabContent()}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

// Helper functions
const getTriggerLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'email_received': 'Email Received',
    'email_starred': 'Email Starred',
    'event_created': 'Event Created',
    'event_starting': 'Event Starting',
    'message_received': 'Message Received',
    'schedule': 'Schedule',
  };
  return labels[type] || type;
};

const getStatusColor = (status: AutomationExecutionStatus): string => {
  const colors: Record<AutomationExecutionStatus, string> = {
    'queued': '#f59e0b',
    'running': '#3b82f6',
    'completed': '#10b981',
    'failed': '#ef4444',
    'cancelled': '#6b7280',
    'paused': '#8b5cf6',
  };
  return colors[status] || '#6b7280';
};

export default MobileAutomationDashboard;