/*!
 * Privacy Sync Settings Component
 * 
 * Implementation of the Privacy Sync feature from Blueprint.md.
 * Allows users to configure cross-calendar busy block mirroring.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../../store'
import {
  Button,
  Card,
  Input,
  Switch,
  Select,
  SelectItem,
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  Badge,
  cn
} from '../ui'
import type {
  CalendarPrivacySync,
  Calendar,
  CalendarAccount
} from '@flow-desk/shared'

interface PrivacySyncSettingsProps {
  className?: string
}

export const PrivacySyncSettings: React.FC<PrivacySyncSettingsProps> = ({
  className
}) => {
  const dispatch = useAppDispatch()
  const { accounts, calendars, privacySyncRules } = useAppSelector(state => state.calendar)

  const [isCreatingRule, setIsCreatingRule] = useState(false)
  const [newRule, setNewRule] = useState<Partial<CalendarPrivacySync>>({
    name: '',
    isEnabled: true,
    sourceCalendarIds: [],
    targetCalendarIds: [],
    privacySettings: {
      defaultTitle: 'Private',
      titleTemplate: '',
      stripDescription: true,
      stripLocation: true,
      stripAttendees: true,
      stripAttachments: true,
      visibility: 'private'
    },
    filters: {
      workHoursOnly: false,
      excludeAllDay: false,
      minDurationMinutes: 0,
      includeColors: [],
      excludeColors: []
    },
    window: {
      pastDays: 7,
      futureDays: 60
    },
    isBidirectional: false,
    advancedMode: false
  })

  // Get all calendars as flat list for easier selection
  const allCalendars = Object.values(calendars).flat()

  const handleCreateRule = useCallback(async () => {
    if (!newRule.name?.trim()) {
      return
    }

    if (!newRule.sourceCalendarIds?.length || !newRule.targetCalendarIds?.length) {
      return
    }

    try {
      const ruleData: CalendarPrivacySync = {
        id: '', // Will be set by backend
        userId: 'current_user', // Replace with actual user ID
        name: newRule.name.trim(),
        isEnabled: newRule.isEnabled ?? true,
        sourceCalendarIds: newRule.sourceCalendarIds,
        targetCalendarIds: newRule.targetCalendarIds,
        privacySettings: newRule.privacySettings!,
        filters: newRule.filters,
        window: newRule.window!,
        isBidirectional: newRule.isBidirectional ?? false,
        advancedMode: newRule.advancedMode ?? false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Create via calendar API
      if (window.flowDesk?.calendar) {
        const result = await window.flowDesk.calendar.createPrivacySyncRule(ruleData)
        if (result.success) {
          setIsCreatingRule(false)
          resetNewRule()
        }
      }
    } catch (error) {
      console.error('Failed to create privacy sync rule:', error)
    }
  }, [newRule])

  const resetNewRule = useCallback(() => {
    setNewRule({
      name: '',
      isEnabled: true,
      sourceCalendarIds: [],
      targetCalendarIds: [],
      privacySettings: {
        defaultTitle: 'Private',
        titleTemplate: '',
        stripDescription: true,
        stripLocation: true,
        stripAttendees: true,
        stripAttachments: true,
        visibility: 'private'
      },
      filters: {
        workHoursOnly: false,
        excludeAllDay: false,
        minDurationMinutes: 0,
        includeColors: [],
        excludeColors: []
      },
      window: {
        pastDays: 7,
        futureDays: 60
      },
      isBidirectional: false,
      advancedMode: false
    })
  }, [])

  const getCalendarName = useCallback((calendarId: string) => {
    const calendar = allCalendars.find(cal => cal.id === calendarId)
    return calendar ? `${calendar.name}` : 'Unknown Calendar'
  }, [allCalendars])

  const getAccountName = useCallback((calendarId: string) => {
    const calendar = allCalendars.find(cal => cal.id === calendarId)
    if (!calendar) return 'Unknown Account'
    
    const account = accounts.find(acc => acc.id === calendar.accountId)
    return account ? account.name : 'Unknown Account'
  }, [allCalendars, accounts])

  const executePrivacySync = useCallback(async () => {
    try {
      if (window.flowDesk?.calendar) {
        const result = await window.flowDesk.calendar.executePrivacySync('default-account')
        if (result.success) {
          // Show success message
          console.log('Privacy sync executed successfully:', result.data)
        }
      }
    } catch (error) {
      console.error('Failed to execute privacy sync:', error)
    }
  }, [])

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Privacy Sync</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Mirror events from one calendar to another as privacy-safe "busy blocks" 
          to prevent scheduling conflicts without exposing sensitive details.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={executePrivacySync}
          >
            Sync Now
          </Button>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {privacySyncRules.length} rule{privacySyncRules.length !== 1 ? 's' : ''} configured
          </Badge>
        </div>
        
        <Button
          onClick={() => setIsCreatingRule(true)}
          disabled={allCalendars.length < 2}
        >
          Create Rule
        </Button>
      </div>

      {/* Create Rule Form */}
      {isCreatingRule && (
        <Card variant="outlined" padding="md" className="bg-blue-50 border-blue-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Create Privacy Sync Rule</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreatingRule(false)}
              >
                ✕
              </Button>
            </div>

            <Input
              label="Rule Name"
              value={newRule.name || ''}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              placeholder="e.g., Work to Personal"
            />

            {/* Source Calendars */}
            <div>
              <label className="text-sm font-medium mb-2 block">Source Calendars</label>
              <div className="space-y-2">
                {allCalendars.map(calendar => (
                  <div key={calendar.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`source-${calendar.id}`}
                      checked={newRule.sourceCalendarIds?.includes(calendar.id) || false}
                      onChange={(e) => {
                        const current = newRule.sourceCalendarIds || []
                        const updated = e.target.checked
                          ? [...current, calendar.id]
                          : current.filter(id => id !== calendar.id)
                        setNewRule({ ...newRule, sourceCalendarIds: updated })
                      }}
                      className="rounded border-border"
                    />
                    <label htmlFor={`source-${calendar.id}`} className="text-sm cursor-pointer">
                      {calendar.name} ({getAccountName(calendar.id)})
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Calendars */}
            <div>
              <label className="text-sm font-medium mb-2 block">Target Calendars</label>
              <div className="space-y-2">
                {allCalendars.map(calendar => (
                  <div key={calendar.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`target-${calendar.id}`}
                      checked={newRule.targetCalendarIds?.includes(calendar.id) || false}
                      onChange={(e) => {
                        const current = newRule.targetCalendarIds || []
                        const updated = e.target.checked
                          ? [...current, calendar.id]
                          : current.filter(id => id !== calendar.id)
                        setNewRule({ ...newRule, targetCalendarIds: updated })
                      }}
                      className="rounded border-border"
                    />
                    <label htmlFor={`target-${calendar.id}`} className="text-sm cursor-pointer">
                      {calendar.name} ({getAccountName(calendar.id)})
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy Settings */}
            <div>
              <h4 className="text-sm font-medium mb-2">Privacy Settings</h4>
              <div className="space-y-3">
                <Input
                  label="Default Event Title"
                  value={newRule.privacySettings?.defaultTitle || ''}
                  onChange={(e) => setNewRule({
                    ...newRule,
                    privacySettings: {
                      ...newRule.privacySettings!,
                      defaultTitle: e.target.value
                    }
                  })}
                  placeholder="Private"
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newRule.privacySettings?.stripDescription || false}
                      onCheckedChange={(checked: boolean) => setNewRule({
                        ...newRule,
                        privacySettings: {
                          ...newRule.privacySettings!,
                          stripDescription: checked
                        }
                      })}
                    />
                    <label className="text-sm">Strip Description</label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newRule.privacySettings?.stripLocation || false}
                      onCheckedChange={(checked: boolean) => setNewRule({
                        ...newRule,
                        privacySettings: {
                          ...newRule.privacySettings!,
                          stripLocation: checked
                        }
                      })}
                    />
                    <label className="text-sm">Strip Location</label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newRule.privacySettings?.stripAttendees || false}
                      onCheckedChange={(checked: boolean) => setNewRule({
                        ...newRule,
                        privacySettings: {
                          ...newRule.privacySettings!,
                          stripAttendees: checked
                        }
                      })}
                    />
                    <label className="text-sm">Strip Attendees</label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newRule.advancedMode || false}
                      onCheckedChange={(checked: boolean) => setNewRule({
                        ...newRule,
                        advancedMode: checked
                      })}
                    />
                    <label className="text-sm">Advanced Mode</label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="ghost"
                onClick={() => setIsCreatingRule(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateRule}
                disabled={!newRule.name?.trim() || !newRule.sourceCalendarIds?.length || !newRule.targetCalendarIds?.length}
              >
                Create Rule
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Existing Rules */}
      <div>
        <h3 className="text-lg font-medium mb-4">Privacy Sync Rules</h3>
        
        {privacySyncRules.length === 0 ? (
          <Card variant="outlined" padding="lg" className="text-center">
            <div className="text-muted-foreground">
              <div className="text-4xl mb-4">🔒</div>
              <h4 className="font-medium mb-2">No Privacy Sync Rules</h4>
              <p className="text-sm">
                Create a rule to start syncing busy blocks between your calendars while protecting your privacy.
              </p>
              {allCalendars.length < 2 && (
                <p className="text-sm mt-2 text-amber-600">
                  You need at least 2 connected calendars to create privacy sync rules.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {privacySyncRules.map(rule => (
              <Card key={rule.id} variant="outlined" padding="md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium">{rule.name}</h4>
                      <Badge variant={rule.isEnabled ? 'default' : 'secondary'}>
                        {rule.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      {rule.advancedMode && (
                        <Badge variant="outline">Advanced</Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>
                        <span className="font-medium">Source:</span> {rule.sourceCalendarIds.map(getCalendarName).join(', ')}
                      </div>
                      <div>
                        <span className="font-medium">Target:</span> {rule.targetCalendarIds.map(getCalendarName).join(', ')}
                      </div>
                      <div>
                        <span className="font-medium">Title:</span> "{rule.privacySettings.defaultTitle}"
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={rule.isEnabled}
                      onCheckedChange={async (enabled: boolean) => {
                        // Update rule enabled status
                        console.log('Toggle rule:', rule.id, enabled)
                      }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}