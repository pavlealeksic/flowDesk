import React from 'react';
import { cn } from '../../ui/utils';

export interface VariableNodeProps {
  id: string;
  data: {
    label: string;
    variableName: string;
    variableType: 'string' | 'number' | 'boolean' | 'object' | 'array';
    defaultValue?: any;
    config: any;
  };
  selected?: boolean;
}

export function VariableNode({ data, selected }: VariableNodeProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'string': return '📝';
      case 'number': return '#️⃣';
      case 'boolean': return '✅';
      case 'object': return '📦';
      case 'array': return '📋';
      default: return '📄';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'number': return 'bg-green-50 border-green-200 text-green-800';
      case 'boolean': return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'object': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'array': return 'bg-pink-50 border-pink-200 text-pink-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className={cn(
      "variable-node relative bg-white rounded-lg border-2 shadow-sm transition-all duration-200 min-w-[200px]",
      selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-300 hover:border-gray-400"
    )}>
      {/* Input handle */}
      <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white shadow-sm node-handle node-handle-input" />
      
      {/* Node header */}
      <div className={cn(
        "node-header flex items-center gap-2 px-3 py-2 border-b border-gray-200 rounded-t-lg",
        getTypeColor(data.variableType)
      )}>
        <div className="node-icon text-lg" aria-hidden="true">
          {getTypeIcon(data.variableType)}
        </div>
        <div className="node-title font-semibold text-sm">
          Variable
        </div>
        <div className="ml-auto">
          <span className="text-xs font-mono px-2 py-1 rounded bg-white/50">
            {data.variableType}
          </span>
        </div>
      </div>
      
      {/* Node content */}
      <div className="node-content p-3">
        <div className="space-y-2">
          <div className="node-label font-medium text-sm text-gray-900">
            {data.label}
          </div>
          <div className="node-variable-name text-xs text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
            ${data.variableName}
          </div>
          {data.defaultValue !== undefined && (
            <div className="node-default-value text-xs text-gray-500">
              Default: <span className="font-mono">{JSON.stringify(data.defaultValue)}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Output handle */}
      <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white shadow-sm node-handle node-handle-output" />
    </div>
  );
}