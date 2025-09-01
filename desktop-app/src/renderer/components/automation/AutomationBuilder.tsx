/**
 * Visual Automation Builder - React Flow based drag-and-drop automation creator
 * 
 * This component provides:
 * - Drag-and-drop workflow builder
 * - Visual representation of automation flows
 * - Real-time validation
 * - Testing capabilities
 * - Template support
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  ReactFlowInstance,
  ConnectionMode,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { 
  AutomationRecipe,
  AutomationBuilderNode,
  AutomationBuilderEdge,
  AutomationBuilderState,
  AutomationTriggerType,
  AutomationActionType
} from '@flow-desk/shared';

import { TriggerNode } from './nodes/TriggerNode';
import { ActionNode } from './nodes/ActionNode';
import { ConditionNode } from './nodes/ConditionNode';
import { VariableNode } from './nodes/VariableNode';
import { DelayNode } from './nodes/DelayNode';
import { TriggerPanel } from './panels/TriggerPanel';
import { ActionPanel } from './panels/ActionPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { TestPanel } from './panels/TestPanel';
import { TemplatesPanel } from './panels/TemplatesPanel';
import { ToolbarPanel } from './panels/ToolbarPanel';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

// Custom node types
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  variable: VariableNode,
  delay: DelayNode,
};

// Custom edge types with conditional styling
const edgeTypes: EdgeTypes = {
  // Custom edge types would be defined here
};

interface AutomationBuilderProps {
  recipe?: AutomationRecipe;
  onSave: (recipe: AutomationRecipe) => Promise<void>;
  onTest: (recipe: AutomationRecipe) => Promise<void>;
  onClose: () => void;
}

export const AutomationBuilder: React.FC<AutomationBuilderProps> = ({
  recipe,
  onSave,
  onTest,
  onClose
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  const [builderState, setBuilderState] = useState<AutomationBuilderState>({
    recipe: recipe || null,
    nodes: [],
    edges: [],
    selectedNodes: [],
    selectedEdges: [],
    mode: 'design',
    errors: [],
    zoom: 1,
    center: { x: 0, y: 0 },
    grid: { enabled: true, size: 20, snap: true }
  });

  const [activePanel, setActivePanel] = useState<'triggers' | 'actions' | 'properties' | 'test' | 'templates' | null>('triggers');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableTriggers, setAvailableTriggers] = useState<Array<{ type: string; name: string; description: string; schema: Record<string, unknown> }>>([]);
  const [availableActions, setAvailableActions] = useState<Array<{ type: string; name: string; description: string; schema: Record<string, unknown> }>>([]);

  // Load available triggers and actions on mount
  useEffect(() => {
    loadAvailableTriggersAndActions();
    if (recipe) {
      loadRecipeIntoBuilder(recipe);
    }
  }, [recipe]);

  const loadAvailableTriggersAndActions = async () => {
    try {
      // These would call the main process to get available triggers/actions
      const triggers = await window.automationAPI.getAvailableTriggers();
      const actions = await window.automationAPI.getAvailableActions();
      
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
      position: { x: 100, y: 100 },
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
        position: { x: 300 + (index * 250), y: 100 },
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
        target: action.id,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed }
      };
      builderEdges.push(edge);
    });

    setNodes(builderNodes);
    setEdges(builderEdges);
    
    setBuilderState(prev => ({
      ...prev,
      recipe,
      nodes: builderNodes,
      edges: builderEdges
    }));
  };

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge-${params.source}-${params.target}`,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: builderState.mode === 'debug'
      };
      
      setEdges(eds => addEdge(newEdge, eds));
    },
    [setEdges, builderState.mode]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = (event.target as Element).getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      const data = JSON.parse(event.dataTransfer.getData('application/json') || '{}');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance!.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: {
          label: data.name || type,
          config: {},
          ...data,
        },
      };

      setNodes(nds => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setActivePanel('properties');
    
    setBuilderState(prev => ({
      ...prev,
      selectedNodes: [node.id]
    }));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setBuilderState(prev => ({
      ...prev,
      selectedNodes: [],
      selectedEdges: []
    }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Validate the workflow
      const errors = validateWorkflow();
      if (errors.length > 0) {
        setBuilderState(prev => ({ ...prev, errors }));
        return;
      }

      // Convert nodes and edges back to recipe format
      const updatedRecipe = await convertBuilderToRecipe();
      
      await onSave(updatedRecipe);
    } catch (error) {
      console.error('Failed to save automation:', error);
      // Show error notification
    } finally {
      setIsLoading(false);
    }
  }, [nodes, edges, onSave]);

  const handleTest = useCallback(async () => {
    try {
      setIsLoading(true);
      setBuilderState(prev => ({ ...prev, mode: 'test' }));
      
      const testRecipe = await convertBuilderToRecipe();
      await onTest(testRecipe);
    } catch (error) {
      console.error('Failed to test automation:', error);
    } finally {
      setIsLoading(false);
      setBuilderState(prev => ({ ...prev, mode: 'design' }));
    }
  }, [nodes, edges, onTest]);

  const validateWorkflow = (): Array<{ nodeId?: string; type: 'error' | 'warning'; message: string }> => {
    const errors: Array<{ nodeId?: string; type: 'error' | 'warning'; message: string }> = [];

    // Check if there's a trigger node
    const triggerNodes = nodes.filter(n => n.type === 'trigger');
    if (triggerNodes.length === 0) {
      errors.push({ type: 'error', message: 'Workflow must have a trigger' });
    } else if (triggerNodes.length > 1) {
      errors.push({ type: 'error', message: 'Workflow can only have one trigger' });
    }

    // Check if there are action nodes
    const actionNodes = nodes.filter(n => n.type === 'action');
    if (actionNodes.length === 0) {
      errors.push({ type: 'error', message: 'Workflow must have at least one action' });
    }

    // Check for disconnected nodes
    nodes.forEach(node => {
      if (node.type !== 'trigger') {
        const hasIncomingEdge = edges.some(edge => edge.target === node.id);
        if (!hasIncomingEdge) {
          errors.push({ 
            nodeId: node.id, 
            type: 'warning', 
            message: `Node "${node.data.label}" is not connected` 
          });
        }
      }
    });

    // Validate individual node configurations
    nodes.forEach(node => {
      const nodeErrors = validateNodeConfiguration(node);
      errors.push(...nodeErrors);
    });

    return errors;
  };

  const validateNodeConfiguration = (node: Node): Array<{ nodeId: string; type: 'error' | 'warning'; message: string }> => {
    const errors: Array<{ nodeId: string; type: 'error' | 'warning'; message: string }> = [];

    // Node-specific validation would be implemented here
    if (!node.data.config) {
      errors.push({ 
        nodeId: node.id, 
        type: 'warning', 
        message: `Node "${node.data.label}" is not configured` 
      });
    }

    return errors;
  };

  const convertBuilderToRecipe = async (): Promise<AutomationRecipe> => {
    // Convert visual representation back to recipe format
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      throw new Error('No trigger node found');
    }

    const actionNodes = nodes.filter(n => n.type === 'action');
    
    // Build the action sequence based on edges
    const orderedActions = buildActionSequence(actionNodes, edges);

    const updatedRecipe: AutomationRecipe = {
      id: builderState.recipe?.id || `recipe_${Date.now()}`,
      ownerId: builderState.recipe?.ownerId || 'current-user',
      name: builderState.recipe?.name || 'New Automation',
      description: builderState.recipe?.description || '',
      category: builderState.recipe?.category || 'productivity',
      tags: builderState.recipe?.tags || [],
      enabled: builderState.recipe?.enabled ?? true,
      isPublic: builderState.recipe?.isPublic ?? false,
      version: builderState.recipe?.version || '1.0.0',
      trigger: {
        type: triggerNode.data.triggerType,
        config: triggerNode.data.config || {},
        conditions: triggerNode.data.conditions || [],
        throttling: triggerNode.data.throttling
      },
      actions: orderedActions,
      settings: builderState.recipe?.settings || {
        timeout: 300,
        maxExecutionsPerHour: 100,
        maxConcurrentExecutions: 1,
        priority: 'normal',
        logLevel: 'info',
        variables: {},
        environment: 'production'
      },
      stats: builderState.recipe?.stats || {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0,
        successRate: 0,
        recentExecutions: []
      },
      metadata: builderState.recipe?.metadata || {
        author: { name: 'User', email: 'user@example.com' },
        documentation: '',
        template: { isTemplate: false },
        sharing: { isShared: false, sharedWith: [], permissions: {} }
      },
      createdAt: builderState.recipe?.createdAt || new Date(),
      updatedAt: new Date(),
      lastExecutedAt: builderState.recipe?.lastExecutedAt
    };

    return updatedRecipe;
  };

  const buildActionSequence = (actionNodes: Node[], edges: Edge[]) => {
    // Build the sequence of actions based on the edge connections
    const actions: Array<{ type: string; id: string; config: Record<string, unknown>; description?: string }> = [];
    
    // Start from trigger and follow the edges
    let currentNodeId = 'trigger';
    const visited = new Set<string>();
    
    while (true) {
      const nextEdge = edges.find(e => e.source === currentNodeId && !visited.has(e.target));
      if (!nextEdge) break;
      
      const nextNode = actionNodes.find(n => n.id === nextEdge.target);
      if (!nextNode) break;
      
      actions.push({
        id: nextNode.id,
        type: nextNode.data.actionType,
        name: nextNode.data.label,
        description: nextNode.data.description || '',
        config: nextNode.data.config || {},
        conditions: nextNode.data.conditions || [],
        errorHandling: nextNode.data.errorHandling || {
          strategy: 'stop',
          fallbackActions: [],
          logErrors: true,
          notifyOnError: false
        },
        continueOnError: nextNode.data.continueOnError || false,
        timeout: nextNode.data.timeout,
        retry: nextNode.data.retry
      });
      
      visited.add(nextEdge.target);
      currentNodeId = nextEdge.target;
    }
    
    return actions;
  };

  const handleNodeUpdate = useCallback((nodeId: string, updates: any) => {
    setNodes(nds => nds.map(node => 
      node.id === nodeId 
        ? { ...node, data: { ...node.data, ...updates } }
        : node
    ));
  }, [setNodes]);

  // Memoized styles for better performance
  const flowStyles = useMemo(() => ({
    width: '100%',
    height: '100%',
    backgroundColor: '#f8fafc',
  }), []);

  const miniMapStyles = useMemo(() => ({
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid #e2e8f0',
  }), []);

  return (
    <div className="automation-builder flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-gray-900">
            {recipe ? 'Edit Automation' : 'Create Automation'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Drag and drop components to build your workflow
          </p>
        </div>
        
        {/* Panel Tabs */}
        <div className="flex border-b border-border">
          {[
            { id: 'triggers', label: 'Triggers', icon: '⚡' },
            { id: 'actions', label: 'Actions', icon: '🔧' },
            { id: 'templates', label: 'Templates', icon: '📋' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id as any)}
              className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePanel === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto">
          {activePanel === 'triggers' && (
            <TriggerPanel 
              triggers={availableTriggers}
              onDragStart={(event, trigger) => {
                event.dataTransfer.setData('application/reactflow', 'trigger');
                event.dataTransfer.setData('application/json', JSON.stringify(trigger));
              }}
            />
          )}
          
          {activePanel === 'actions' && (
            <ActionPanel 
              actions={availableActions}
              onDragStart={(event, action) => {
                event.dataTransfer.setData('application/reactflow', 'action');
                event.dataTransfer.setData('application/json', JSON.stringify(action));
              }}
            />
          )}
          
          {activePanel === 'templates' && (
            <TemplatesPanel 
              onTemplateSelect={(template) => {
                // Load template into builder
                loadRecipeIntoBuilder(template.recipe as AutomationRecipe);
              }}
            />
          )}

          {activePanel === 'properties' && selectedNode && (
            <PropertiesPanel 
              node={selectedNode}
              onUpdate={(updates) => handleNodeUpdate(selectedNode.id, updates)}
            />
          )}

          {activePanel === 'test' && (
            <TestPanel 
              recipe={builderState.recipe}
              onTest={handleTest}
            />
          )}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-16 bg-card border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={onClose}>
              ← Back
            </Button>
            <div className="h-6 w-px bg-gray-300" />
            <select 
              value={builderState.mode} 
              onChange={(e) => setBuilderState(prev => ({ ...prev, mode: e.target.value as any }))}
              className="text-sm border border-border rounded px-3 py-1"
            >
              <option value="design">Design</option>
              <option value="test">Test</option>
              <option value="debug">Debug</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-3">
            {builderState.errors.length > 0 && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
                {builderState.errors.length} error(s)
              </div>
            )}
            <Button variant="outline" onClick={handleTest} disabled={isLoading}>
              🧪 Test
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              💾 Save
            </Button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Strict}
            fitView
            style={flowStyles}
            snapToGrid={builderState.grid.snap}
            snapGrid={[builderState.grid.size, builderState.grid.size]}
          >
            <Controls />
            <MiniMap 
              style={miniMapStyles}
              zoomable
              pannable
            />
            <Background 
              variant={BackgroundVariant.Dots}
              gap={builderState.grid.size}
              size={1}
              color="#e2e8f0"
            />
            
            {/* Validation Errors Panel */}
            {builderState.errors.length > 0 && (
              <Panel position="top-left" className="bg-red-50 border border-red-200 rounded p-3 max-w-md">
                <h4 className="text-red-800 font-medium mb-2">Validation Errors</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {builderState.errors.map((error, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">⚠️</span>
                      {error.message}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

// Helper functions for getting icons and colors
const getTriggerIcon = (type: AutomationTriggerType): string => {
  const iconMap: Record<string, string> = {
    'email_received': '📧',
    'email_starred': '⭐',
    'event_created': '📅',
    'event_starting': '⏰',
    'file_created': '📁',
    'file_modified': '✏️',
    'schedule': '🕐',
    'webhook': '🔗',
    'message_received': '💬',
    'search_performed': '🔍',
  };
  return iconMap[type] || '⚡';
};

const getTriggerColor = (type: AutomationTriggerType): string => {
  const colorMap: Record<string, string> = {
    'email_received': '#3b82f6',
    'email_starred': '#f59e0b',
    'event_created': '#8b5cf6',
    'event_starting': '#06b6d4',
    'file_created': '#10b981',
    'file_modified': '#f97316',
    'schedule': '#6b7280',
    'webhook': '#ef4444',
    'message_received': '#ec4899',
    'search_performed': '#84cc16',
  };
  return colorMap[type] || '#6b7280';
};

const getActionIcon = (type: AutomationActionType): string => {
  const iconMap: Record<string, string> = {
    'send_email': '📤',
    'create_task': '✅',
    'send_notification': '🔔',
    'create_file': '📄',
    'send_message': '💬',
    'api_request': '🌐',
    'webhook_call': '🔗',
    'wait': '⏳',
    'conditional': '❓',
  };
  return iconMap[type] || '🔧';
};

const getActionColor = (type: AutomationActionType): string => {
  const colorMap: Record<string, string> = {
    'send_email': '#3b82f6',
    'create_task': '#10b981',
    'send_notification': '#f59e0b',
    'create_file': '#8b5cf6',
    'send_message': '#ec4899',
    'api_request': '#06b6d4',
    'webhook_call': '#ef4444',
    'wait': '#6b7280',
    'conditional': '#f97316',
  };
  return colorMap[type] || '#6b7280';
};

// Wrap with ReactFlowProvider
export default function AutomationBuilderWrapper(props: AutomationBuilderProps) {
  return (
    <ReactFlowProvider>
      <AutomationBuilder {...props} />
    </ReactFlowProvider>
  );
}