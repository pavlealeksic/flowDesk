import React from 'react';
import { cn } from '../../ui/utils';

interface Action {
  type: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
  icon?: string;
  category?: string;
}

interface ActionPanelProps {
  actions: Action[];
  onDragStart: (event: React.DragEvent, action: Action) => void;
}

export function ActionPanel({ actions, onDragStart }: ActionPanelProps) {
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
    return iconMap[type] || '🔧';
  };

  const groupActionsByCategory = (actions: Action[]) => {
    const grouped: Record<string, Action[]> = {};
    
    actions.forEach(action => {
      const category = action.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(action);
    });
    
    return grouped;
  };

  const groupedActions = groupActionsByCategory(actions);

  return (
    <div className="action-panel p-4 space-y-4">
      <div className="panel-header">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Available Actions</h3>
        <p className="text-xs text-gray-500 mb-4">
          Drag actions to define what your automation should do
        </p>
      </div>

      <div className="action-categories space-y-4">
        {Object.entries(groupedActions).map(([category, categoryActions]) => (
          <div key={category} className="action-category">
            <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
              {category}
            </h4>
            
            <div className="action-list space-y-2">
              {categoryActions.map((action) => (
                <div
                  key={action.type}
                  className={cn(
                    "action-item p-3 rounded-lg border border-gray-200 bg-white cursor-grab",
                    "hover:border-green-300 hover:shadow-sm transition-all duration-150",
                    "active:cursor-grabbing active:scale-95"
                  )}
                  draggable
                  onDragStart={(event) => onDragStart(event, action)}
                >
                  <div className="flex items-start gap-3">
                    <div className="action-icon text-lg flex-shrink-0" aria-hidden="true">
                      {action.icon || getActionIcon(action.type)}
                    </div>
                    
                    <div className="action-info flex-1 min-w-0">
                      <div className="action-name font-medium text-sm text-gray-900 mb-1">
                        {action.name}
                      </div>
                      <div className="action-description text-xs text-gray-500 leading-relaxed">
                        {action.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {actions.length === 0 && (
        <div className="empty-state text-center py-8">
          <div className="text-4xl mb-2">🔧</div>
          <p className="text-sm text-gray-500">No actions available</p>
          <p className="text-xs text-gray-400 mt-1">
            Make sure the automation service is running
          </p>
        </div>
      )}
    </div>
  );
}