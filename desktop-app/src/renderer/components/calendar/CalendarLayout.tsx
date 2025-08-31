/*!
 * Enhanced Calendar Layout
 * 
 * Main calendar layout component that integrates all calendar features including
 * real data, account management, privacy sync, and event management.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../../store'
import { useCalendarSync } from '../../hooks/useCalendarSync'
import {
  toggleCalendarVisibility,
  setVisibleCalendars,
  syncCalendarAccount
} from '../../store/slices/calendarSlice'
import {
  Button,
  Card,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  cn
} from '../ui'
import { CalendarViews } from './CalendarViews'
import { AddCalendarAccountModal } from './AddCalendarAccountModal'
import { PrivacySyncSettings } from './PrivacySyncSettings'
import type { CalendarEvent } from '@flow-desk/shared'

interface CalendarLayoutProps {
  className?: string
}

export const CalendarLayout: React.FC<CalendarLayoutProps> = ({
  className
}) => {
  const dispatch = useAppDispatch()
  const { loadInitialData, syncAllAccounts } = useCalendarSync()
  
  const {
    accounts,
    calendars,
    events,
    visibleCalendars,
    syncStatus,
    isLoading,
    error
  } = useAppSelector(state => state.calendar)

  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('calendar')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // Initialize calendar data on mount
  useEffect(() => {
    loadInitialData('current_user')
  }, [loadInitialData])

  // Get all calendars as flat list
  const allCalendars = Object.values(calendars).flat()

  // Handle event click
  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event)
    // TODO: Open event details modal
    console.log('Event clicked:', event)
  }, [])

  // Handle create event
  const handleCreateEvent = useCallback(() => {
    // TODO: Open create event modal
    console.log('Create event clicked')
  }, [])

  // Handle date select
  const handleDateSelect = useCallback((date: Date) => {
    console.log('Date selected:', date)
  }, [])

  // Handle calendar visibility toggle
  const handleCalendarToggle = useCallback((calendarId: string) => {
    dispatch(toggleCalendarVisibility(calendarId))
  }, [dispatch])

  // Handle account sync
  const handleSyncAccount = useCallback((accountId: string) => {
    dispatch(syncCalendarAccount({ accountId, force: true }))
  }, [dispatch])

  // Handle sync all accounts
  const handleSyncAll = useCallback(() => {
    const accountIds = accounts.map(account => account.id)
    syncAllAccounts(accountIds)
  }, [accounts, syncAllAccounts])

  // Get account for calendar
  const getAccountForCalendar = useCallback((calendarId: string) => {
    const calendar = allCalendars.find(cal => cal.id === calendarId)
    if (!calendar) return null
    return accounts.find(account => account.id === calendar.accountId) || null
  }, [allCalendars, accounts])

  return (
    <div className={cn('flex h-full bg-background', className)}>
      {/* Left Sidebar - Calendar Management */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Calendar</h2>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSyncAll}
                disabled={accounts.length === 0 || isLoading}
                title="Sync all accounts"
              >
                🔄
              </Button>
              <Button
                size="sm"
                onClick={() => setIsAddAccountModalOpen(true)}
              >
                + Account
              </Button>
            </div>
          </div>
          
          {/* Account Status */}
          {accounts.length > 0 && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>{allCalendars.length} calendar{allCalendars.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calendar">Calendars</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
            </TabsList>
            
            <TabsContent value="calendar" className="mt-4 space-y-4">
              {/* Calendar Accounts */}
              {accounts.length === 0 ? (
                <Card variant="outlined" padding="md" className="text-center">
                  <div className="text-muted-foreground">
                    <div className="text-3xl mb-2">📅</div>
                    <p className="text-sm">No calendar accounts connected</p>
                    <Button
                      className="mt-3"
                      size="sm"
                      onClick={() => setIsAddAccountModalOpen(true)}
                    >
                      Add Your First Account
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {accounts.map(account => (
                    <div key={account.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-sm">{account.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {account.provider}
                          </Badge>
                          {syncStatus[account.id] && (
                            <Badge 
                              variant={syncStatus[account.id].status === 'syncing' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {syncStatus[account.id].status}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSyncAccount(account.id)}
                          disabled={syncStatus[account.id]?.status === 'syncing'}
                        >
                          ⟳
                        </Button>
                      </div>
                      
                      {/* Calendars for this account */}
                      <div className="space-y-1 pl-4">
                        {(calendars[account.id] || []).map(calendar => {
                          const isVisible = visibleCalendars.length === 0 || visibleCalendars.includes(calendar.id)
                          const eventCount = events[calendar.id]?.length || 0
                          
                          return (
                            <div
                              key={calendar.id}
                              className="flex items-center space-x-2 py-1 hover:bg-accent/50 rounded px-2 cursor-pointer"
                              onClick={() => handleCalendarToggle(calendar.id)}
                            >
                              <div
                                className="w-3 h-3 rounded-sm border"
                                style={{
                                  backgroundColor: isVisible ? calendar.color : 'transparent',
                                  borderColor: calendar.color
                                }}
                              />
                              <span className={cn(
                                'text-sm flex-1',
                                isVisible ? 'text-foreground' : 'text-muted-foreground'
                              )}>
                                {calendar.name}
                              </span>
                              {eventCount > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {eventCount}
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="privacy" className="mt-4">
              <PrivacySyncSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Main Calendar View */}
      <div className="flex-1 flex flex-col">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="flex items-center space-x-2">
              <span className="text-red-500">⚠️</span>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}
        
        <CalendarViews
          onEventClick={handleEventClick}
          onCreateEvent={handleCreateEvent}
          onDateSelect={handleDateSelect}
          className="flex-1"
        />
      </div>

      {/* Add Account Modal */}
      <AddCalendarAccountModal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        onSuccess={() => {
          // Reload data after adding account
          loadInitialData('current_user')
        }}
      />
    </div>
  )
}