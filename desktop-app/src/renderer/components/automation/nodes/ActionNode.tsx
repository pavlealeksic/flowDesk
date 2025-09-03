import React from 'react';

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
  return (
    <div className={`action-node ${selected ? 'selected' : ''}`}>
      <div className="node-handle node-handle-input"></div>
      
      <div className="node-header">
        <div className="node-icon">⚙️</div>
        <div className="node-title">Action</div>
      </div>
      
      <div className="node-content">
        <div className="node-label">{data.label}</div>
        <div className="node-type">{data.actionType}</div>
      </div>
    </div>
  );
}