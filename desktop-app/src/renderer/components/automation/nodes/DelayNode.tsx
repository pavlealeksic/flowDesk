import React from 'react';
import { cn } from '../../ui/utils';

export interface DelayNodeProps {
  id: string;
  data: {
    label: string;
    delayType: 'fixed' | 'dynamic' | 'until';
    duration?: number;
    unit?: 'seconds' | 'minutes' | 'hours' | 'days';
    untilTime?: string;
    config: any;
  };
  selected?: boolean;
}

export function DelayNode({ data, selected }: DelayNodeProps) {
  const formatDuration = () => {
    if (data.delayType === 'until' && data.untilTime) {
      return `Until ${data.untilTime}`;
    }
    
    if (data.delayType === 'dynamic') {
      return 'Dynamic delay';
    }
    
    if (data.duration && data.unit) {
      const unitLabel = data.duration === 1 ? data.unit.slice(0, -1) : data.unit;
      return `${data.duration} ${unitLabel}`;
    }
    
    return 'Not configured';
  };

  const getDelayIcon = () => {
    switch (data.delayType) {
      case 'fixed': return '⏳';
      case 'dynamic': return '🔄';
      case 'until': return '⏰';
      default: return '⏸️';
    }
  };

  const getDelayColor = () => {
    switch (data.delayType) {
      case 'fixed': return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'dynamic': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'until': return 'bg-purple-50 border-purple-200 text-purple-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className={cn(
      "delay-node relative bg-white rounded-lg border-2 shadow-sm transition-all duration-200 min-w-[200px]",
      selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-300 hover:border-gray-400"
    )}>
      {/* Input handle */}
      <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white shadow-sm node-handle node-handle-input" />
      
      {/* Node header */}
      <div className={cn(
        "node-header flex items-center gap-2 px-3 py-2 border-b border-gray-200 rounded-t-lg",
        getDelayColor()
      )}>
        <div className="node-icon text-lg" aria-hidden="true">
          {getDelayIcon()}
        </div>
        <div className="node-title font-semibold text-sm">
          Delay
        </div>
        <div className="ml-auto">
          <span className="text-xs font-mono px-2 py-1 rounded bg-white/50">
            {data.delayType}
          </span>
        </div>
      </div>
      
      {/* Node content */}
      <div className="node-content p-3">
        <div className="space-y-2">
          <div className="node-label font-medium text-sm text-gray-900">
            {data.label}
          </div>
          <div className="node-duration text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
            {formatDuration()}
          </div>
          {data.delayType === 'dynamic' && (
            <div className="node-description text-xs text-gray-500 italic">
              Delay based on conditions or variables
            </div>
          )}
        </div>
      </div>
      
      {/* Output handle */}
      <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white shadow-sm node-handle node-handle-output" />
    </div>
  );
}