import React from 'react';
import { cn } from '../../ui/utils';

export interface ActionNodeProps {
  id: string;
  data: {
    label: string;
    actionType: string;
    config: any;
  };
  selected?: boolean;
}

export function ActionNode({ data, selected }: ActionNodeProps) {
  const getActionIcon = (type: string) => {
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
    return iconMap[type] || '⚙️';
  };

  return (
    <div className={cn(
      "action-node relative bg-white rounded-lg border-2 shadow-sm transition-all duration-200 min-w-[200px]",
      selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-300 hover:border-gray-400"
    )}>
      {/* Input handle */}
      <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm node-handle node-handle-input" />
      
      {/* Node header */}
      <div className="node-header flex items-center gap-2 px-3 py-2 bg-green-50 border-b border-green-200 text-green-800 rounded-t-lg">
        <div className="node-icon text-lg" aria-hidden="true">
          {getActionIcon(data.actionType)}
        </div>
        <div className="node-title font-semibold text-sm">
          Action
        </div>
        <div className="ml-auto">
          <span className="text-xs font-mono px-2 py-1 rounded bg-green-100">
            {data.actionType}
          </span>
        </div>
      </div>
      
      {/* Node content */}
      <div className="node-content p-3">
        <div className="space-y-1">
          <div className="node-label font-medium text-sm text-gray-900">
            {data.label}
          </div>
          <div className="node-type text-xs text-gray-500">
            {data.actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </div>
        </div>
      </div>
      
      {/* Output handle */}
      <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm node-handle node-handle-output" />
    </div>
  );
}