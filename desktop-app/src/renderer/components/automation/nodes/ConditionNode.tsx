import React from 'react';

export interface ConditionNodeProps {
  id: string;
  data: {
    label: string;
    condition: string;
    config: any;
  };
  selected?: boolean;
}

export function ConditionNode({ data, selected }: ConditionNodeProps) {
  return (
    <div className={`condition-node ${selected ? 'selected' : ''}`}>
      <div className="node-handle node-handle-input"></div>
      
      <div className="node-header">
        <div className="node-icon">🔍</div>
        <div className="node-title">Condition</div>
      </div>
      
      <div className="node-content">
        <div className="node-label">{data.label}</div>
        <div className="node-type">{data.condition}</div>
      </div>
      
      <div className="node-handle node-handle-output"></div>
    </div>
  );
}