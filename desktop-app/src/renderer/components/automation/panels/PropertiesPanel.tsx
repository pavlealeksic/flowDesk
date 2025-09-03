import React, { useState } from 'react';
import { Node } from 'reactflow';
import { cn } from '../../ui/utils';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';

interface PropertiesPanelProps {
  node: Node;
  onUpdate: (updates: any) => void;
}

export function PropertiesPanel({ node, onUpdate }: PropertiesPanelProps) {
  const [localData, setLocalData] = useState(node.data);

  const handleSave = () => {
    onUpdate(localData);
  };

  const handleReset = () => {
    setLocalData(node.data);
  };

  const updateField = (field: string, value: any) => {
    setLocalData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const updateConfig = (configField: string, value: any) => {
    setLocalData((prev: any) => ({
      ...prev,
      config: {
        ...prev.config,
        [configField]: value
      }
    }));
  };

  const getNodeTypeIcon = (type: string) => {
    switch (type) {
      case 'trigger': return '⚡';
      case 'action': return '🔧';
      case 'condition': return '🔍';
      case 'variable': return '📄';
      case 'delay': return '⏳';
      default: return '📦';
    }
  };

  const renderTriggerProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="trigger-type">Trigger Type</Label>
        <Input
          id="trigger-type"
          value={localData.triggerType || ''}
          onChange={(e) => updateField('triggerType', e.target.value)}
          placeholder="e.g., email_received"
        />
      </div>
      
      <div>
        <Label htmlFor="trigger-label">Display Name</Label>
        <Input
          id="trigger-label"
          value={localData.label || ''}
          onChange={(e) => updateField('label', e.target.value)}
          placeholder="Enter a descriptive name"
        />
      </div>

      {/* Trigger-specific configuration would go here */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Configuration</h4>
        <p className="text-xs text-gray-500">
          Trigger-specific settings will be displayed here based on the trigger type.
        </p>
      </div>
    </div>
  );

  const renderActionProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="action-type">Action Type</Label>
        <Input
          id="action-type"
          value={localData.actionType || ''}
          onChange={(e) => updateField('actionType', e.target.value)}
          placeholder="e.g., send_email"
        />
      </div>
      
      <div>
        <Label htmlFor="action-label">Display Name</Label>
        <Input
          id="action-label"
          value={localData.label || ''}
          onChange={(e) => updateField('label', e.target.value)}
          placeholder="Enter a descriptive name"
        />
      </div>

      {/* Action-specific configuration would go here */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Configuration</h4>
        <p className="text-xs text-gray-500">
          Action-specific settings will be displayed here based on the action type.
        </p>
      </div>
    </div>
  );

  const renderConditionProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="condition-type">Condition</Label>
        <Input
          id="condition-type"
          value={localData.condition || ''}
          onChange={(e) => updateField('condition', e.target.value)}
          placeholder="e.g., equals, contains, greater_than"
        />
      </div>
      
      <div>
        <Label htmlFor="condition-label">Display Name</Label>
        <Input
          id="condition-label"
          value={localData.label || ''}
          onChange={(e) => updateField('label', e.target.value)}
          placeholder="Enter a descriptive name"
        />
      </div>
    </div>
  );

  const renderVariableProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="variable-name">Variable Name</Label>
        <Input
          id="variable-name"
          value={localData.variableName || ''}
          onChange={(e) => updateField('variableName', e.target.value)}
          placeholder="e.g., userEmail"
        />
      </div>
      
      <div>
        <Label htmlFor="variable-type">Variable Type</Label>
        <select 
          id="variable-type"
          value={localData.variableType || 'string'}
          onChange={(e) => updateField('variableType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="object">Object</option>
          <option value="array">Array</option>
        </select>
      </div>
      
      <div>
        <Label htmlFor="variable-label">Display Name</Label>
        <Input
          id="variable-label"
          value={localData.label || ''}
          onChange={(e) => updateField('label', e.target.value)}
          placeholder="Enter a descriptive name"
        />
      </div>
    </div>
  );

  const renderDelayProperties = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="delay-type">Delay Type</Label>
        <select 
          id="delay-type"
          value={localData.delayType || 'fixed'}
          onChange={(e) => updateField('delayType', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="fixed">Fixed Duration</option>
          <option value="dynamic">Dynamic</option>
          <option value="until">Until Time</option>
        </select>
      </div>
      
      {localData.delayType === 'fixed' && (
        <>
          <div>
            <Label htmlFor="delay-duration">Duration</Label>
            <Input
              id="delay-duration"
              type="number"
              value={localData.duration || ''}
              onChange={(e) => updateField('duration', parseInt(e.target.value) || 0)}
              placeholder="Enter duration"
            />
          </div>
          
          <div>
            <Label htmlFor="delay-unit">Unit</Label>
            <select 
              id="delay-unit"
              value={localData.unit || 'minutes'}
              onChange={(e) => updateField('unit', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </>
      )}
      
      <div>
        <Label htmlFor="delay-label">Display Name</Label>
        <Input
          id="delay-label"
          value={localData.label || ''}
          onChange={(e) => updateField('label', e.target.value)}
          placeholder="Enter a descriptive name"
        />
      </div>
    </div>
  );

  const renderProperties = () => {
    switch (node.type) {
      case 'trigger':
        return renderTriggerProperties();
      case 'action':
        return renderActionProperties();
      case 'condition':
        return renderConditionProperties();
      case 'variable':
        return renderVariableProperties();
      case 'delay':
        return renderDelayProperties();
      default:
        return (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No properties available for this node type</p>
          </div>
        );
    }
  };

  const hasChanges = JSON.stringify(localData) !== JSON.stringify(node.data);

  return (
    <div className="properties-panel p-4 space-y-4">
      <div className="panel-header">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg" aria-hidden="true">
            {getNodeTypeIcon(node.type)}
          </span>
          <h3 className="text-sm font-semibold text-gray-900">
            {node.type} Properties
          </h3>
        </div>
        <p className="text-xs text-gray-500">
          Configure the selected node
        </p>
      </div>

      <div className="properties-form">
        {renderProperties()}
      </div>

      {hasChanges && (
        <div className="properties-actions flex gap-2 pt-4 border-t border-gray-200">
          <Button size="sm" onClick={handleSave} className="flex-1">
            Save Changes
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}