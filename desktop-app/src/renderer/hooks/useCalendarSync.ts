/*!
 * Calendar Sync Hook
 * 
 * React hook for managing real-time calendar synchronization and updates.
 */

import { useEffect, useCallback } from 'react';
import { useAppDispatch } from '../store';
import {
  accountCreated,
  accountUpdated,
  accountDeleted,
  eventCreated,
  eventUpdated,
  eventDeleted,
  syncStatusUpdated,
  fetchUserAccounts,
  fetchCalendars,
  fetchEventsInRange,
  syncCalendarAccount
} from '../store/slices/calendarSlice';
import type {
  CalendarAccount,
  CalendarEvent,
  CalendarSyncStatus
} from '@flow-desk/shared';

/**
 * Hook for managing calendar synchronization and real-time updates
 */
export const useCalendarSync = () => {
  const dispatch = useAppDispatch();

  // Setup real-time event listeners
  useEffect(() => {
    if (!window.flowDesk?.calendar) {
      console.warn('Calendar API not available');
      return;
    }

    const { calendar } = window.flowDesk;

    // Account event handlers
    const handleAccountCreated = (account: any) => {
      dispatch(accountCreated(account as CalendarAccount));
      // Fetch calendars for new account
      dispatch(fetchCalendars(account.id));
    };

    const handleAccountUpdated = (account: any) => {
      dispatch(accountUpdated(account as CalendarAccount));
    };

    const handleAccountDeleted = (data: { accountId: string }) => {
      dispatch(accountDeleted(data));
    };

    // Event handlers
    const handleEventCreated = (event: any) => {
      dispatch(eventCreated(event as CalendarEvent));
    };

    const handleEventUpdated = (event: any) => {
      dispatch(eventUpdated(event as CalendarEvent));
    };

    const handleEventDeleted = (data: { calendarId: string; eventId: string }) => {
      dispatch(eventDeleted(data));
    };

    // Sync status handler
    const handleSyncStatusUpdated = (data: { accountId: string; status: CalendarSyncStatus }) => {
      dispatch(syncStatusUpdated(data));
    };

    // Register event listeners
    calendar.onAccountCreated(handleAccountCreated);
    calendar.onAccountUpdated(handleAccountUpdated);
    calendar.onAccountDeleted(handleAccountDeleted);
    calendar.onEventCreated(handleEventCreated);
    calendar.onEventUpdated(handleEventUpdated);
    calendar.onEventDeleted(handleEventDeleted);
    calendar.onSyncStatusUpdated(handleSyncStatusUpdated);

    // Cleanup function
    return () => {
      // Remove event listeners when component unmounts
      calendar.removeAllListeners();
    };
  }, [dispatch]);

  // Load initial data
  const loadInitialData = useCallback(async (userId: string) => {
    try {
      // Fetch user accounts
      const accountsResult = await dispatch(fetchUserAccounts(userId));
      
      if (fetchUserAccounts.fulfilled.match(accountsResult)) {
        const accounts = accountsResult.payload;
        
        // Fetch calendars for each account
        for (const account of accounts) {
          await dispatch(fetchCalendars(account.id));
        }
        
        // Fetch events for current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // Get all calendar IDs
        const allCalendarIds: string[] = [];
        for (const account of accounts) {
          const calendarsResult = await dispatch(fetchCalendars(account.id));
          if (fetchCalendars.fulfilled.match(calendarsResult)) {
            allCalendarIds.push(...calendarsResult.payload.calendars.map(cal => cal.id));
          }
        }
        
        if (allCalendarIds.length > 0) {
          await dispatch(fetchEventsInRange({
            calendarIds: allCalendarIds,
            timeMin: startOfMonth,
            timeMax: endOfMonth
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load initial calendar data:', error);
    }
  }, [dispatch]);

  // Refresh events for a date range
  const refreshEvents = useCallback(async (calendarIds: string[], timeMin: Date, timeMax: Date) => {
    try {
      await dispatch(fetchEventsInRange({
        calendarIds,
        timeMin,
        timeMax
      }));
    } catch (error) {
      console.error('Failed to refresh calendar events:', error);
    }
  }, [dispatch]);

  // Sync all accounts
  const syncAllAccounts = useCallback(async (accountIds: string[]) => {
    const syncPromises = accountIds.map(accountId => 
      dispatch(syncCalendarAccount({ accountId, force: false }))
    );
    
    try {
      await Promise.all(syncPromises);
    } catch (error) {
      console.error('Failed to sync calendar accounts:', error);
    }
  }, [dispatch]);

  return {
    loadInitialData,
    refreshEvents,
    syncAllAccounts
  };
};

export default useCalendarSync;