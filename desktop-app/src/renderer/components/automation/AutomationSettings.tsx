/**
 * AutomationSettings Component
 * 
 * Provides comprehensive automation configuration and management settings
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { cn } from '../ui/utils';

interface AutomationSettingsConfig {
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  retryAttempts: number;
  retryDelay: number;
  enableNotifications: boolean;
  notificationTypes: {
    onSuccess: boolean;
    onFailure: boolean;
    onStart: boolean;
  };
  autoCleanupLogs: boolean;
  logRetentionDays: number;
  enableGlobalShortcuts: boolean;
  shortcuts: {
    toggleAll: string;
    openBuilder: string;
    viewLogs: string;
  };
}

interface AutomationSettingsProps {
  settings: AutomationSettingsConfig;
  onSave: (settings: AutomationSettingsConfig) => void;
  onBack: () => void;
  className?: string;
}

export const AutomationSettings: React.FC<AutomationSettingsProps> = ({
  settings,
  onSave,
  onBack,
  className
}) => {
  const [currentSettings, setCurrentSettings] = useState<AutomationSettingsConfig>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCurrentSettings(settings);
    setHasChanges(false);
  }, [settings]);

  const handleSettingChange = <K extends keyof AutomationSettingsConfig>(
    key: K,
    value: AutomationSettingsConfig[K]
  ) => {
    setCurrentSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  const handleNestedChange = <T extends keyof AutomationSettingsConfig>(
    parentKey: T,
    childKey: keyof AutomationSettingsConfig[T],
    value: any
  ) => {
    setCurrentSettings(prev => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [childKey]: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(currentSettings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save automation settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setCurrentSettings(settings);
    setHasChanges(false);
  };

  const handleRestoreDefaults = () => {
    const defaultSettings: AutomationSettingsConfig = {
      maxConcurrentExecutions: 5,
      defaultTimeout: 30,
      enableLogging: true,
      logLevel: 'info',
      retryAttempts: 3,
      retryDelay: 1000,
      enableNotifications: true,
      notificationTypes: {
        onSuccess: false,
        onFailure: true,
        onStart: false,
      },
      autoCleanupLogs: true,
      logRetentionDays: 30,
      enableGlobalShortcuts: true,
      shortcuts: {
        toggleAll: 'Cmd+Shift+A',
        openBuilder: 'Cmd+Shift+B',
        viewLogs: 'Cmd+Shift+L',
      },
    };
    setCurrentSettings(defaultSettings);
    setHasChanges(true);
  };

  return (
    <div className={cn('automation-settings p-6 space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Automation Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure global automation behavior and preferences
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onBack}
        >
          ← Back to Dashboard
        </Button>
      </div>

      {/* Execution Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Execution Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Concurrent Executions
            </label>
            <Input
              type="number"
              min="1"
              max="20"
              value={currentSettings.maxConcurrentExecutions}
              onChange={(e) => handleSettingChange('maxConcurrentExecutions', parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum number of automations that can run simultaneously
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Timeout (seconds)
            </label>
            <Input
              type="number"
              min="5"
              max="600"
              value={currentSettings.defaultTimeout}
              onChange={(e) => handleSettingChange('defaultTimeout', parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default timeout for automation steps
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Retry Attempts
            </label>
            <Input
              type="number"
              min="0"
              max="10"
              value={currentSettings.retryAttempts}
              onChange={(e) => handleSettingChange('retryAttempts', parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of retry attempts on failure
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Retry Delay (ms)
            </label>
            <Input
              type="number"
              min="100"
              max="30000"
              step="100"
              value={currentSettings.retryDelay}
              onChange={(e) => handleSettingChange('retryDelay', parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Delay between retry attempts
            </p>
          </div>
        </div>
      </Card>

      {/* Logging Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Logging Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Logging</p>
              <p className="text-sm text-gray-600">Record automation execution details</p>
            </div>
            <Button
              variant={currentSettings.enableLogging ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSettingChange('enableLogging', !currentSettings.enableLogging)}
            >
              {currentSettings.enableLogging ? 'On' : 'Off'}
            </Button>
          </div>

          {currentSettings.enableLogging && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Log Level
                </label>
                <select
                  value={currentSettings.logLevel}
                  onChange={(e) => handleSettingChange('logLevel', e.target.value as any)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="debug">Debug (Verbose)</option>
                  <option value="info">Info (Standard)</option>
                  <option value="warn">Warning (Important)</option>
                  <option value="error">Error (Critical Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Log Retention (days)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={currentSettings.logRetentionDays}
                  onChange={(e) => handleSettingChange('logRetentionDays', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Cleanup Logs</p>
                    <p className="text-sm text-gray-600">Automatically remove old log files</p>
                  </div>
                  <Button
                    variant={currentSettings.autoCleanupLogs ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSettingChange('autoCleanupLogs', !currentSettings.autoCleanupLogs)}
                  >
                    {currentSettings.autoCleanupLogs ? 'On' : 'Off'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Notification Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Notifications</p>
              <p className="text-sm text-gray-600">Show system notifications for automation events</p>
            </div>
            <Button
              variant={currentSettings.enableNotifications ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSettingChange('enableNotifications', !currentSettings.enableNotifications)}
            >
              {currentSettings.enableNotifications ? 'On' : 'Off'}
            </Button>
          </div>

          {currentSettings.enableNotifications && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">On Success</span>
                <Button
                  variant={currentSettings.notificationTypes.onSuccess ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleNestedChange('notificationTypes', 'onSuccess', !currentSettings.notificationTypes.onSuccess)}
                >
                  {currentSettings.notificationTypes.onSuccess ? 'On' : 'Off'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">On Failure</span>
                <Button
                  variant={currentSettings.notificationTypes.onFailure ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleNestedChange('notificationTypes', 'onFailure', !currentSettings.notificationTypes.onFailure)}
                >
                  {currentSettings.notificationTypes.onFailure ? 'On' : 'Off'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">On Start</span>
                <Button
                  variant={currentSettings.notificationTypes.onStart ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleNestedChange('notificationTypes', 'onStart', !currentSettings.notificationTypes.onStart)}
                >
                  {currentSettings.notificationTypes.onStart ? 'On' : 'Off'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Global Shortcuts</p>
              <p className="text-sm text-gray-600">Use keyboard shortcuts to control automations</p>
            </div>
            <Button
              variant={currentSettings.enableGlobalShortcuts ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSettingChange('enableGlobalShortcuts', !currentSettings.enableGlobalShortcuts)}
            >
              {currentSettings.enableGlobalShortcuts ? 'On' : 'Off'}
            </Button>
          </div>

          {currentSettings.enableGlobalShortcuts && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Toggle All Automations
                </label>
                <Input
                  type="text"
                  value={currentSettings.shortcuts.toggleAll}
                  onChange={(e) => handleNestedChange('shortcuts', 'toggleAll', e.target.value)}
                  className="w-full"
                  placeholder="Cmd+Shift+A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Open Automation Builder
                </label>
                <Input
                  type="text"
                  value={currentSettings.shortcuts.openBuilder}
                  onChange={(e) => handleNestedChange('shortcuts', 'openBuilder', e.target.value)}
                  className="w-full"
                  placeholder="Cmd+Shift+B"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  View Execution Logs
                </label>
                <Input
                  type="text"
                  value={currentSettings.shortcuts.viewLogs}
                  onChange={(e) => handleNestedChange('shortcuts', 'viewLogs', e.target.value)}
                  className="w-full"
                  placeholder="Cmd+Shift+L"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRestoreDefaults}
            disabled={isSaving}
          >
            Restore Defaults
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
          >
            Reset Changes
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">
            You have unsaved changes. Don't forget to save your settings.
          </p>
        </div>
      )}
    </div>
  );
};

export default AutomationSettings;