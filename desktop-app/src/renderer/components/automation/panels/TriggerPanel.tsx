import React from 'react';
import { cn } from '../../ui/utils';

interface Trigger {
  type: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
  icon?: string;
  category?: string;
}

interface TriggerPanelProps {
  triggers: Trigger[];
  onDragStart: (event: React.DragEvent, trigger: Trigger) => void;
}

export function TriggerPanel({ triggers, onDragStart }: TriggerPanelProps) {
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

  const groupTriggersByCategory = (triggers: Trigger[]) => {
    const grouped: Record<string, Trigger[]> = {};
    
    triggers.forEach(trigger => {
      const category = trigger.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(trigger);
    });
    
    return grouped;
  };

  const groupedTriggers = groupTriggersByCategory(triggers);

  return (
    <div className="trigger-panel p-4 space-y-4">
      <div className="panel-header">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Available Triggers</h3>
        <p className="text-xs text-gray-500 mb-4">
          Drag a trigger to start building your automation
        </p>
      </div>

      <div className="trigger-categories space-y-4">
        {Object.entries(groupedTriggers).map(([category, categoryTriggers]) => (
          <div key={category} className="trigger-category">
            <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
              {category}
            </h4>
            
            <div className="trigger-list space-y-2">
              {categoryTriggers.map((trigger) => (
                <div
                  key={trigger.type}
                  className={cn(
                    "trigger-item p-3 rounded-lg border border-gray-200 bg-white cursor-grab",
                    "hover:border-blue-300 hover:shadow-sm transition-all duration-150",
                    "active:cursor-grabbing active:scale-95"
                  )}
                  draggable
                  onDragStart={(event) => onDragStart(event, trigger)}
                >
                  <div className="flex items-start gap-3">
                    <div className="trigger-icon text-lg flex-shrink-0" aria-hidden="true">
                      {trigger.icon || getTriggerIcon(trigger.type)}
                    </div>
                    
                    <div className="trigger-info flex-1 min-w-0">
                      <div className="trigger-name font-medium text-sm text-gray-900 mb-1">
                        {trigger.name}
                      </div>
                      <div className="trigger-description text-xs text-gray-500 leading-relaxed">
                        {trigger.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {triggers.length === 0 && (
        <div className="empty-state text-center py-8">
          <div className="text-4xl mb-2">⚡</div>
          <p className="text-sm text-gray-500">No triggers available</p>
          <p className="text-xs text-gray-400 mt-1">
            Make sure the automation service is running
          </p>
        </div>
      )}
    </div>
  );
}