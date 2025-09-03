import React from 'react';

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  actionType: string;
  createdAt: Date;
}

interface AutomationListProps {
  rules: AutomationRule[];
  onEdit?: (rule: AutomationRule) => void;
  onDelete?: (ruleId: string) => void;
  onToggle?: (ruleId: string, enabled: boolean) => void;
}

export function AutomationList({ rules, onEdit, onDelete, onToggle }: AutomationListProps) {
  return (
    <div className="automation-list">
      <h3>Automation Rules</h3>
      {rules.length === 0 ? (
        <div className="empty-state">
          <p>No automation rules configured.</p>
          <p>Create your first rule to get started.</p>
        </div>
      ) : (
        <div className="rule-list">
          {rules.map((rule) => (
            <div key={rule.id} className="rule-item">
              <div className="rule-info">
                <div className="rule-name">{rule.name}</div>
                <div className="rule-details">
                  {rule.triggerType} → {rule.actionType}
                </div>
              </div>
              
              <div className="rule-actions">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => onToggle?.(rule.id, e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
                
                {onEdit && (
                  <button 
                    onClick={() => onEdit(rule)}
                    aria-label={`Edit rule ${rule.name}`}
                  >
                    ✏️
                  </button>
                )}
                
                {onDelete && (
                  <button 
                    onClick={() => onDelete(rule.id)}
                    aria-label={`Delete rule ${rule.name}`}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}