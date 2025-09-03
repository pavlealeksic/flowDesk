import React from 'react';

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
  return (
    <div className={`trigger-node ${selected ? 'selected' : ''}`}>
      <div className="node-header">
        <div className="node-icon">⚡</div>
        <div className="node-title">Trigger</div>
      </div>
      
      <div className="node-content">
        <div className="node-label">{data.label}</div>
        <div className="node-type">{data.triggerType}</div>
      </div>
      
      <div className="node-handle node-handle-output"></div>
    </div>
  );
}