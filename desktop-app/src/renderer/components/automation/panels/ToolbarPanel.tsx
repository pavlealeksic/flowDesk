import React from 'react';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/utils';

interface ToolbarPanelProps {
  onSave: () => void;
  onTest: () => void;
  onExport: () => void;
  onImport: () => void;
  onClear: () => void;
  isLoading?: boolean;
  canSave?: boolean;
  canTest?: boolean;
}

export function ToolbarPanel({
  onSave,
  onTest,
  onExport,
  onImport,
  onClear,
  isLoading = false,
  canSave = true,
  canTest = true
}: ToolbarPanelProps) {
  return (
    <div className="toolbar-panel p-4 space-y-4 bg-white border-r border-gray-200">
      <div className="panel-header">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Actions</h3>
      </div>

      <div className="toolbar-actions space-y-2">
        {/* Primary Actions */}
        <div className="primary-actions space-y-2">
          <Button
            onClick={onSave}
            disabled={!canSave || isLoading}
            loading={isLoading}
            className="w-full"
            leftIcon="💾"
          >
            Save
          </Button>
          
          <Button
            onClick={onTest}
            disabled={!canTest || isLoading}
            variant="outline"
            className="w-full"
            leftIcon="🧪"
          >
            Test
          </Button>
        </div>

        {/* Secondary Actions */}
        <div className="secondary-actions pt-2 border-t border-gray-200 space-y-2">
          <Button
            onClick={onExport}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            leftIcon="📤"
          >
            Export
          </Button>
          
          <Button
            onClick={onImport}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            leftIcon="📥"
          >
            Import
          </Button>
        </div>

        {/* Danger Actions */}
        <div className="danger-actions pt-2 border-t border-gray-200">
          <Button
            onClick={onClear}
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-start text-red-600 hover:text-red-700",
              "hover:bg-red-50"
            )}
            leftIcon="🗑️"
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="toolbar-stats pt-4 border-t border-gray-200">
        <div className="stats-grid space-y-2">
          <div className="stat-item">
            <div className="text-xs text-gray-500">Nodes</div>
            <div className="text-sm font-medium text-gray-900">-</div>
          </div>
          
          <div className="stat-item">
            <div className="text-xs text-gray-500">Connections</div>
            <div className="text-sm font-medium text-gray-900">-</div>
          </div>
          
          <div className="stat-item">
            <div className="text-xs text-gray-500">Status</div>
            <div className="text-sm font-medium text-green-600">Valid</div>
          </div>
        </div>
      </div>
    </div>
  );
}