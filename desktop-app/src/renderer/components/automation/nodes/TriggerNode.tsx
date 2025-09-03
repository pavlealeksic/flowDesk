import React from 'react';
import { cn } from '../../ui/utils';

export interface TriggerNodeProps {
  id: string;
  data: {
    label: string;
    triggerType: string;
    config: any;
  };
  selected?: boolean;
}

export function TriggerNode({ data, selected }: TriggerNodeProps) {
  const getTriggerIcon = (type: string) => {
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

  return (
    <div className={cn(
      "trigger-node relative bg-white rounded-lg border-2 shadow-sm transition-all duration-200 min-w-[200px]",
      selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-300 hover:border-gray-400"
    )}>      
      {/* Node header */}
      <div className="node-header flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-200 text-blue-800 rounded-t-lg">
        <div className="node-icon text-lg" aria-hidden="true">
          {getTriggerIcon(data.triggerType)}
        </div>
        <div className="node-title font-semibold text-sm">
          Trigger
        </div>
        <div className="ml-auto">
          <span className="text-xs font-mono px-2 py-1 rounded bg-blue-100">
            {data.triggerType}
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
            {data.triggerType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </div>
        </div>
      </div>
      
      {/* Output handle */}
      <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-sm node-handle node-handle-output" />
    </div>
  );
}