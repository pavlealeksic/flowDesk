/**
 * Mobile Automation Builder - Touch-optimized drag-and-drop automation creator
 * 
 * This component provides:
 * - Touch-friendly workflow builder
 * - Mobile-optimized visual representation
 * - Gesture-based interactions
 * - Simplified mobile interface
 * - Real-time validation
 * - Testing capabilities
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Dimensions, PanGestureHandler, State } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Line, Circle, Path } from 'react-native-svg';

import { 
  AutomationRecipe,
  AutomationTriggerType,
  AutomationActionType
} from '@flow-desk/shared';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Node {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  position: { x: number; y: number };
  data: {
    label: string;
    config: any;
    triggerType?: AutomationTriggerType;
    actionType?: AutomationActionType;
    icon: string;
    color: string;
  };
}

interface Edge {
  id: string;
  source: string;
  target: string;
}

interface MobileAutomationBuilderProps {
  recipe?: AutomationRecipe;
  onSave: (recipe: AutomationRecipe) => Promise<void>;
  onTest: (recipe: AutomationRecipe) => Promise<void>;
  onClose: () => void;
}

export const MobileAutomationBuilder: React.FC<MobileAutomationBuilderProps> = ({
  recipe,
  onSave,
  onTest,
  onClose
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [panelMode, setPanelMode] = useState<'triggers' | 'actions' | 'properties'>('triggers');
  const [availableTriggers, setAvailableTriggers] = useState<any[]>([]);
  const [availableActions, setAvailableActions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Animated values for canvas panning
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    loadAvailableTriggersAndActions();
    if (recipe) {
      loadRecipeIntoBuilder(recipe);
    }
  }, [recipe]);

  const loadAvailableTriggersAndActions = async () => {
    try {
      // These would call the mobile bridge to get available triggers/actions
      const triggers = [
        { type: 'email_received', name: 'Email Received', icon: '📧', color: '#3b82f6' },
        { type: 'email_starred', name: 'Email Starred', icon: '⭐', color: '#f59e0b' },
        { type: 'event_created', name: 'Event Created', icon: '📅', color: '#8b5cf6' },
        { type: 'event_starting', name: 'Event Starting', icon: '⏰', color: '#06b6d4' },
        { type: 'message_received', name: 'Message Received', icon: '💬', color: '#ec4899' },
        { type: 'schedule', name: 'Schedule', icon: '🕐', color: '#6b7280' },
      ];
      
      const actions = [
        { type: 'send_email', name: 'Send Email', icon: '📤', color: '#3b82f6' },
        { type: 'create_task', name: 'Create Task', icon: '✅', color: '#10b981' },
        { type: 'send_notification', name: 'Send Notification', icon: '🔔', color: '#f59e0b' },
        { type: 'send_message', name: 'Send Message', icon: '💬', color: '#ec4899' },
        { type: 'api_request', name: 'API Request', icon: '🌐', color: '#06b6d4' },
        { type: 'wait', name: 'Wait', icon: '⏳', color: '#6b7280' },
      ];
      
      setAvailableTriggers(triggers);
      setAvailableActions(actions);
    } catch (error) {
      console.error('Failed to load triggers/actions:', error);
    }
  };

  const loadRecipeIntoBuilder = (recipe: AutomationRecipe) => {
    const builderNodes: Node[] = [];
    const builderEdges: Edge[] = [];

    // Convert trigger to node
    const triggerNode: Node = {
      id: 'trigger',
      type: 'trigger',
      position: { x: screenWidth / 2 - 75, y: 100 },
      data: {
        label: recipe.trigger.type,
        config: recipe.trigger.config,
        triggerType: recipe.trigger.type,
        icon: getTriggerIcon(recipe.trigger.type),
        color: getTriggerColor(recipe.trigger.type)
      }
    };
    builderNodes.push(triggerNode);

    // Convert actions to nodes
    recipe.actions.forEach((action, index) => {
      const actionNode: Node = {
        id: action.id,
        type: 'action',
        position: { 
          x: screenWidth / 2 - 75, 
          y: 200 + (index * 120) 
        },
        data: {
          label: action.name,
          config: action.config,
          actionType: action.type,
          icon: getActionIcon(action.type),
          color: getActionColor(action.type)
        }
      };
      builderNodes.push(actionNode);

      // Create edge from previous node to this action
      const sourceId = index === 0 ? 'trigger' : recipe.actions[index - 1].id;
      const edge: Edge = {
        id: `edge-${sourceId}-${action.id}`,
        source: sourceId,
        target: action.id
      };
      builderEdges.push(edge);
    });

    setNodes(builderNodes);
    setEdges(builderEdges);
  };

  const canvasGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startX = translateX.value;
      context.startY = translateY.value;
    },
    onActive: (event, context) => {
      translateX.value = context.startX + event.translationX;
      translateY.value = context.startY + event.translationY;
    },
    onEnd: () => {
      // Optional: Add bounds checking or snapping
    },
  });

  const canvasStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const handleAddNode = (item: any, type: 'trigger' | 'action') => {
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type,
      position: { 
        x: screenWidth / 2 - 75, 
        y: nodes.length * 120 + 100 
      },
      data: {
        label: item.name,
        config: {},
        [type === 'trigger' ? 'triggerType' : 'actionType']: item.type,
        icon: item.icon,
        color: item.color
      }
    };

    setNodes(prev => [...prev, newNode]);
    
    // Auto-connect to previous node
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      const newEdge: Edge = {
        id: `edge-${lastNode.id}-${newNode.id}`,
        source: lastNode.id,
        target: newNode.id
      };
      setEdges(prev => [...prev, newEdge]);
    }
  };

  const handleNodePress = (node: Node) => {
    setSelectedNode(node);
    setPanelMode('properties');
  };

  const renderNode = (node: Node) => {
    const isSelected = selectedNode?.id === node.id;
    
    return (
      <TouchableOpacity
        key={node.id}
        style={[
          {
            position: 'absolute',
            left: node.position.x,
            top: node.position.y,
            width: 150,
            height: 80,
            backgroundColor: node.data.color,
            borderRadius: 12,
            padding: 12,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          },
          isSelected && {
            borderWidth: 3,
            borderColor: '#fff',
          }
        ]}
        onPress={() => handleNodePress(node)}
      >
        <Text style={{ fontSize: 24, marginBottom: 4 }}>{node.data.icon}</Text>
        <Text style={{ 
          color: '#fff', 
          fontSize: 12, 
          fontWeight: '600',
          textAlign: 'center' 
        }}>
          {node.data.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEdges = () => {
    return (
      <Svg
        style={{ position: 'absolute', top: 0, left: 0, width: screenWidth, height: screenHeight }}
        pointerEvents="none"
      >
        {edges.map(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          
          if (!sourceNode || !targetNode) return null;
          
          const startX = sourceNode.position.x + 75;
          const startY = sourceNode.position.y + 80;
          const endX = targetNode.position.x + 75;
          const endY = targetNode.position.y;
          
          return (
            <Line
              key={edge.id}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#6b7280"
              strokeWidth="3"
              markerEnd="url(#arrowhead)"
            />
          );
        })}
      </Svg>
    );
  };

  const renderBottomPanel = () => {
    return (
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 10,
        maxHeight: screenHeight * 0.5,
      }}>
        {/* Panel Tabs */}
        <View style={{ 
          flexDirection: 'row', 
          borderBottomWidth: 1, 
          borderBottomColor: '#e5e7eb',
          paddingTop: 8
        }}>
          {[
            { id: 'triggers', label: 'Triggers', icon: '⚡' },
            { id: 'actions', label: 'Actions', icon: '🔧' },
            { id: 'properties', label: 'Properties', icon: '⚙️' }
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[
                {
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: 'center',
                },
                panelMode === tab.id && {
                  borderBottomWidth: 2,
                  borderBottomColor: '#3b82f6'
                }
              ]}
              onPress={() => setPanelMode(tab.id as any)}
            >
              <Text style={{ fontSize: 16 }}>{tab.icon}</Text>
              <Text style={[
                { fontSize: 12, marginTop: 2 },
                panelMode === tab.id ? { color: '#3b82f6', fontWeight: '600' } : { color: '#6b7280' }
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Panel Content */}
        <ScrollView style={{ flex: 1, padding: 16 }}>
          {panelMode === 'triggers' && (
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Available Triggers</Text>
              {availableTriggers.map(trigger => (
                <TouchableOpacity
                  key={trigger.type}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    marginBottom: 8,
                    backgroundColor: '#f8fafc',
                    borderRadius: 8,
                    borderLeftWidth: 4,
                    borderLeftColor: trigger.color,
                  }}
                  onPress={() => handleAddNode(trigger, 'trigger')}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{trigger.icon}</Text>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>{trigger.name}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Tap to add</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {panelMode === 'actions' && (
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Available Actions</Text>
              {availableActions.map(action => (
                <TouchableOpacity
                  key={action.type}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    marginBottom: 8,
                    backgroundColor: '#f8fafc',
                    borderRadius: 8,
                    borderLeftWidth: 4,
                    borderLeftColor: action.color,
                  }}
                  onPress={() => handleAddNode(action, 'action')}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{action.icon}</Text>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>{action.name}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Tap to add</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {panelMode === 'properties' && selectedNode && (
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Node Properties</Text>
              <Card style={{ padding: 16 }}>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 32 }}>{selectedNode.data.icon}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 8 }}>
                    {selectedNode.data.label}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
                  Configuration options would be shown here
                </Text>
              </Card>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const convertedRecipe = await convertBuilderToRecipe();
      await onSave(convertedRecipe);
    } catch (error) {
      console.error('Failed to save automation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setIsLoading(true);
      const testRecipe = await convertBuilderToRecipe();
      await onTest(testRecipe);
    } catch (error) {
      console.error('Failed to test automation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const convertBuilderToRecipe = async (): Promise<AutomationRecipe> => {
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      throw new Error('No trigger node found');
    }

    const actionNodes = nodes.filter(n => n.type === 'action');
    
    const actions = actionNodes.map(node => ({
      id: node.id,
      type: node.data.actionType!,
      name: node.data.label,
      description: '',
      config: node.data.config || {},
      conditions: [],
      errorHandling: {
        strategy: 'stop' as const,
        fallbackActions: [],
        logErrors: true,
        notifyOnError: false
      },
      continueOnError: false
    }));

    const updatedRecipe: AutomationRecipe = {
      id: recipe?.id || `recipe_${Date.now()}`,
      ownerId: recipe?.ownerId || 'current-user',
      name: recipe?.name || 'New Mobile Automation',
      description: recipe?.description || '',
      category: recipe?.category || 'productivity',
      tags: recipe?.tags || [],
      enabled: recipe?.enabled ?? true,
      isPublic: recipe?.isPublic ?? false,
      version: recipe?.version || '1.0.0',
      trigger: {
        type: triggerNode.data.triggerType!,
        config: triggerNode.data.config || {},
        conditions: [],
      },
      actions,
      settings: {
        timeout: 300,
        maxExecutionsPerHour: 100,
        maxConcurrentExecutions: 1,
        priority: 'normal',
        logLevel: 'info',
        variables: {},
        environment: 'production'
      },
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0,
        successRate: 0,
        recentExecutions: []
      },
      metadata: {
        author: { name: 'User', email: 'user@example.com' },
        documentation: '',
        template: { isTemplate: false },
        sharing: { isShared: false, sharedWith: [], permissions: {} }
      },
      createdAt: recipe?.createdAt || new Date(),
      updatedAt: new Date(),
      lastExecutedAt: recipe?.lastExecutedAt
    };

    return updatedRecipe;
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{
        paddingTop: 44,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ fontSize: 16, color: '#3b82f6' }}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={{ fontSize: 18, fontWeight: '600' }}>
          {recipe ? 'Edit Automation' : 'Create Automation'}
        </Text>
        
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity 
            onPress={handleTest}
            disabled={isLoading}
            style={{ marginRight: 12 }}
          >
            <Text style={{ fontSize: 16, color: '#f59e0b' }}>Test</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} disabled={isLoading}>
            <Text style={{ fontSize: 16, color: '#10b981' }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas */}
      <View style={{ flex: 1, position: 'relative' }}>
        <PanGestureHandler onGestureEvent={canvasGestureHandler}>
          <Animated.View style={[{ flex: 1 }, canvasStyle]}>
            {renderEdges()}
            {nodes.map(renderNode)}
          </Animated.View>
        </PanGestureHandler>
      </View>

      {/* Bottom Panel */}
      {renderBottomPanel()}
    </GestureHandlerRootView>
  );
};

// Helper functions
const getTriggerIcon = (type: AutomationTriggerType): string => {
  const iconMap: Record<string, string> = {
    'email_received': '📧',
    'email_starred': '⭐',
    'event_created': '📅',
    'event_starting': '⏰',
    'message_received': '💬',
    'schedule': '🕐',
  };
  return iconMap[type] || '⚡';
};

const getTriggerColor = (type: AutomationTriggerType): string => {
  const colorMap: Record<string, string> = {
    'email_received': '#3b82f6',
    'email_starred': '#f59e0b',
    'event_created': '#8b5cf6',
    'event_starting': '#06b6d4',
    'message_received': '#ec4899',
    'schedule': '#6b7280',
  };
  return colorMap[type] || '#6b7280';
};

const getActionIcon = (type: AutomationActionType): string => {
  const iconMap: Record<string, string> = {
    'send_email': '📤',
    'create_task': '✅',
    'send_notification': '🔔',
    'send_message': '💬',
    'api_request': '🌐',
    'wait': '⏳',
  };
  return iconMap[type] || '🔧';
};

const getActionColor = (type: AutomationActionType): string => {
  const colorMap: Record<string, string> = {
    'send_email': '#3b82f6',
    'create_task': '#10b981',
    'send_notification': '#f59e0b',
    'send_message': '#ec4899',
    'api_request': '#06b6d4',
    'wait': '#6b7280',
  };
  return colorMap[type] || '#6b7280';
};

export default MobileAutomationBuilder;