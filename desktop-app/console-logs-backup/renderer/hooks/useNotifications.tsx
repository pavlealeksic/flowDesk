/**
 * Notifications Hook
 * 
 * React hook for managing desktop notifications, rules, DND schedules,
 * and notification statistics.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';

interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    sender?: string[];
    keywords?: string[];
    apps?: string[];
    importance?: 'low' | 'normal' | 'high' | 'critical';
    timeRange?: { start: string; end: string };
    days?: number[];
  };
  actions: {
    show?: boolean;
    sound?: boolean;
    badge?: boolean;
    forward?: string[];
    autoReply?: string;
    markAsRead?: boolean;
  };
  priority: number;
}

interface DNDSchedule {
  id: string;
  name: string;
  enabled: boolean;
  schedule: {
    start: string;
    end: string;
    days: number[];
    timezone?: string;
  };
  allowBreakthrough: {
    calls: boolean;
    emergencyKeywords: string[];
    vipContacts: string[];
    criticalApps: string[];
  };
  exceptions: {
    dates: string[];
    events: string[];
  };
}

interface NotificationData {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  sound?: string;
  actions?: Array<{
    action: string;
    title: string;
  }>;
  data?: any;
  timestamp: number;
  source: string;
  importance: 'low' | 'normal' | 'high' | 'critical';
  category?: string;
  thread?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
}

interface NotificationStats {
  totalSent: number;
  totalShown: number;
  totalDismissed: number;
  totalClicked: number;
  rulesApplied: number;
  dndBlocked: number;
  lastResetTime: number;
}

interface NotificationStatus {
  initialized: boolean;
  permissionGranted: boolean;
  dndActive: boolean;
  queueLength: number;
  activeNotifications: number;
  rulesCount: number;
  dndSchedulesCount: number;
}

export interface UseNotificationsResult {
  // State
  status: NotificationStatus | null;
  stats: NotificationStats | null;
  rules: NotificationRule[];
  dndSchedules: DNDSchedule[];
  loading: boolean;
  error: string | null;

  // Actions
  sendNotification: (data: NotificationData) => Promise<string>;
  clearAllNotifications: () => Promise<void>;
  clearNotification: (notificationId: string) => Promise<void>;
  
  // Rules management
  addNotificationRule: (rule: NotificationRule) => Promise<void>;
  updateNotificationRule: (rule: NotificationRule) => Promise<void>;
  removeNotificationRule: (ruleId: string) => Promise<void>;
  
  // DND management
  addDNDSchedule: (schedule: DNDSchedule) => Promise<void>;
  updateDNDSchedule: (schedule: DNDSchedule) => Promise<void>;
  removeDNDSchedule: (scheduleId: string) => Promise<void>;
  setDNDActive: (active: boolean, duration?: number) => Promise<void>;
  
  // Stats
  resetStats: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const dispatch = useAppDispatch();
  
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [dndSchedules, setDNDSchedules] = useState<DNDSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadNotificationData();
    setupEventListeners();
    
    return () => {
      cleanupEventListeners();
    };
  }, []);

  const loadNotificationData = async () => {
    setLoading(true);
    try {
      const [statusData, statsData, rulesData, scheduleData] = await Promise.all([
        window.electronAPI.invoke('notifications:get-status'),
        window.electronAPI.invoke('notifications:get-stats'),
        window.electronAPI.invoke('notifications:get-rules'),
        window.electronAPI.invoke('notifications:get-dnd-schedules'),
      ]);

      setStatus(statusData);
      setStats(statsData);
      setRules(rulesData);
      setDNDSchedules(scheduleData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notification data');
      console.error('Failed to load notification data:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = () => {
    window.electronAPI.on('notification-clicked', handleNotificationClicked);
    window.electronAPI.on('notification-action', handleNotificationAction);
    window.electronAPI.on('dnd-status-changed', handleDNDStatusChanged);
    window.electronAPI.on('notification-rule-updated', handleRuleUpdated);
    window.electronAPI.on('dnd-schedule-updated', handleScheduleUpdated);
  };

  const cleanupEventListeners = () => {
    window.electronAPI.removeAllListeners('notification-clicked');
    window.electronAPI.removeAllListeners('notification-action');
    window.electronAPI.removeAllListeners('dnd-status-changed');
    window.electronAPI.removeAllListeners('notification-rule-updated');
    window.electronAPI.removeAllListeners('dnd-schedule-updated');
  };

  const handleNotificationClicked = useCallback((data: NotificationData) => {
    // Handle notification click - navigate to relevant section
    dispatch({ type: 'notifications/notificationClicked', payload: data });
  }, [dispatch]);

  const handleNotificationAction = useCallback((data: { data: NotificationData; action: string }) => {
    // Handle notification action
    dispatch({ type: 'notifications/notificationActionTriggered', payload: data });
  }, [dispatch]);

  const handleDNDStatusChanged = useCallback((active: boolean) => {
    setStatus(prev => prev ? { ...prev, dndActive: active } : null);
  }, []);

  const handleRuleUpdated = useCallback((rule: NotificationRule) => {
    setRules(prev => {
      const index = prev.findIndex(r => r.id === rule.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = rule;
        return updated;
      } else {
        return [...prev, rule];
      }
    });
  }, []);

  const handleScheduleUpdated = useCallback((schedule: DNDSchedule) => {
    setDNDSchedules(prev => {
      const index = prev.findIndex(s => s.id === schedule.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = schedule;
        return updated;
      } else {
        return [...prev, schedule];
      }
    });
  }, []);

  // Actions
  const sendNotification = useCallback(async (data: NotificationData): Promise<string> => {
    try {
      const notificationId = await window.electronAPI.invoke('notifications:send', data);
      
      // Update stats
      setStats(prev => prev ? {
        ...prev,
        totalSent: prev.totalSent + 1,
      } : null);
      
      return notificationId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send notification';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try {
      await window.electronAPI.invoke('notifications:clear-all');
      setStatus(prev => prev ? { ...prev, activeNotifications: 0, queueLength: 0 } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear notifications';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const clearNotification = useCallback(async (notificationId: string) => {
    try {
      await window.electronAPI.invoke('notifications:clear', notificationId);
      setStatus(prev => prev ? { 
        ...prev, 
        activeNotifications: Math.max(0, prev.activeNotifications - 1) 
      } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear notification';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const addNotificationRule = useCallback(async (rule: NotificationRule) => {
    try {
      await window.electronAPI.invoke('notifications:add-rule', rule);
      setRules(prev => [...prev, rule].sort((a, b) => b.priority - a.priority));
      setStatus(prev => prev ? { ...prev, rulesCount: prev.rulesCount + 1 } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add notification rule';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const updateNotificationRule = useCallback(async (rule: NotificationRule) => {
    try {
      await window.electronAPI.invoke('notifications:add-rule', rule); // Same endpoint for add/update
      setRules(prev => {
        const updated = prev.map(r => r.id === rule.id ? rule : r);
        return updated.sort((a, b) => b.priority - a.priority);
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update notification rule';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const removeNotificationRule = useCallback(async (ruleId: string) => {
    try {
      await window.electronAPI.invoke('notifications:remove-rule', ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
      setStatus(prev => prev ? { ...prev, rulesCount: Math.max(0, prev.rulesCount - 1) } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove notification rule';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const addDNDSchedule = useCallback(async (schedule: DNDSchedule) => {
    try {
      await window.electronAPI.invoke('notifications:add-dnd-schedule', schedule);
      setDNDSchedules(prev => [...prev, schedule]);
      setStatus(prev => prev ? { ...prev, dndSchedulesCount: prev.dndSchedulesCount + 1 } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add DND schedule';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const updateDNDSchedule = useCallback(async (schedule: DNDSchedule) => {
    try {
      await window.electronAPI.invoke('notifications:add-dnd-schedule', schedule); // Same endpoint
      setDNDSchedules(prev => prev.map(s => s.id === schedule.id ? schedule : s));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update DND schedule';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const removeDNDSchedule = useCallback(async (scheduleId: string) => {
    try {
      await window.electronAPI.invoke('notifications:remove-dnd-schedule', scheduleId);
      setDNDSchedules(prev => prev.filter(s => s.id !== scheduleId));
      setStatus(prev => prev ? { ...prev, dndSchedulesCount: Math.max(0, prev.dndSchedulesCount - 1) } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove DND schedule';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const setDNDActive = useCallback(async (active: boolean, duration?: number) => {
    try {
      await window.electronAPI.invoke('notifications:set-dnd', active, duration);
      setStatus(prev => prev ? { ...prev, dndActive: active } : null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set DND status';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const resetStats = useCallback(async () => {
    try {
      await window.electronAPI.invoke('notifications:reset-stats');
      setStats({
        totalSent: 0,
        totalShown: 0,
        totalDismissed: 0,
        totalClicked: 0,
        rulesApplied: 0,
        dndBlocked: 0,
        lastResetTime: Date.now(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset stats';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const [statusData, statsData] = await Promise.all([
        window.electronAPI.invoke('notifications:get-status'),
        window.electronAPI.invoke('notifications:get-stats'),
      ]);

      setStatus(statusData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh status';
      setError(errorMessage);
    }
  }, []);

  return {
    // State
    status,
    stats,
    rules,
    dndSchedules,
    loading,
    error,

    // Actions
    sendNotification,
    clearAllNotifications,
    clearNotification,

    // Rules management
    addNotificationRule,
    updateNotificationRule,
    removeNotificationRule,

    // DND management
    addDNDSchedule,
    updateDNDSchedule,
    removeDNDSchedule,
    setDNDActive,

    // Stats
    resetStats,
    refreshStatus,
  };
}