"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopNotificationManager = void 0;
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
class DesktopNotificationManager {
    constructor(mainWindow) {
        this.activeNotifications = new Map();
        this.mainWindow = mainWindow || undefined;
        this.setupNotificationHandlers();
    }
    async initialize() {
        electron_log_1.default.info('Desktop notification manager initializing...');
        try {
            // Verify notification support
            if (!electron_1.Notification.isSupported()) {
                electron_log_1.default.warn('Notifications are not supported on this system');
                return;
            }
            // On macOS, check notification permissions
            if (process.platform === 'darwin') {
                try {
                    const { systemPreferences } = require('electron');
                    const getNotificationPermission = systemPreferences.getNotificationPermission;
                    if (typeof getNotificationPermission === 'function') {
                        const permission = getNotificationPermission();
                        electron_log_1.default.info(`Notification permission status: ${permission}`);
                        if (permission === 'denied') {
                            electron_log_1.default.warn('Notification permissions denied. Users can enable them in System Preferences.');
                        }
                    }
                    else {
                        electron_log_1.default.info('getNotificationPermission not available on this Electron version');
                    }
                }
                catch (permError) {
                    electron_log_1.default.warn('Failed to check macOS notification permissions:', permError);
                    // Continue anyway - basic notifications might still work
                }
            }
            electron_log_1.default.info('Desktop notification manager initialized successfully');
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize notification manager:', error);
            // Don't throw - continue without advanced notification features
            electron_log_1.default.info('Continuing with basic notification support');
        }
    }
    setupNotificationHandlers() {
        // Check notification permissions
        try {
            if (process.platform === 'darwin') {
                const { systemPreferences } = require('electron');
                // Check if we have notification permissions
                try {
                    const getNotificationPermission = systemPreferences.getNotificationPermission;
                    if (typeof getNotificationPermission === 'function') {
                        const notificationPermission = getNotificationPermission();
                        electron_log_1.default.info(`Notification permission status: ${notificationPermission}`);
                        if (notificationPermission === 'denied') {
                            electron_log_1.default.warn('Notification permissions denied. Notifications will not be shown.');
                            return;
                        }
                    }
                }
                catch (permError) {
                    electron_log_1.default.warn('Failed to check notification permissions:', permError);
                    // Continue anyway - permissions might still work
                }
            }
            // Test notification availability
            if (!electron_1.Notification.isSupported()) {
                electron_log_1.default.warn('Notifications are not supported on this system');
                return;
            }
            electron_log_1.default.info('Notification system initialized successfully');
        }
        catch (error) {
            electron_log_1.default.warn('Failed to setup notification handlers:', error);
            // Don't throw - continue without notifications
        }
    }
    async showNotification(options) {
        try {
            // Check if notifications are supported
            if (!electron_1.Notification.isSupported()) {
                electron_log_1.default.warn('Notifications not supported, skipping notification');
                return;
            }
            // Check permissions on macOS
            if (process.platform === 'darwin') {
                try {
                    const { systemPreferences } = require('electron');
                    const getNotificationPermission = systemPreferences.getNotificationPermission;
                    if (typeof getNotificationPermission === 'function') {
                        const permission = getNotificationPermission();
                        if (permission === 'denied') {
                            electron_log_1.default.warn('Notification permissions denied, skipping notification');
                            return;
                        }
                    }
                }
                catch (permError) {
                    electron_log_1.default.warn('Failed to check notification permissions, attempting to show notification anyway:', permError);
                    // Continue with showing notification - it might still work
                }
            }
            const notificationConfig = {
                title: options.title,
                body: options.body,
                silent: false,
            };
            // Add urgency for Linux systems
            if (process.platform === 'linux' && options.priority) {
                notificationConfig.urgency = options.priority === 'high' ? 'critical' : 'normal';
            }
            const notification = new electron_1.Notification(notificationConfig);
            if (options.tag) {
                // Close existing notification with same tag
                const existing = this.activeNotifications.get(options.tag);
                if (existing) {
                    existing.close();
                }
                this.activeNotifications.set(options.tag, notification);
            }
            notification.on('close', () => {
                if (options.tag) {
                    this.activeNotifications.delete(options.tag);
                }
            });
            notification.on('click', () => {
                // Focus main window when notification is clicked
                if (this.mainWindow) {
                    if (this.mainWindow.isMinimized()) {
                        this.mainWindow.restore();
                    }
                    this.mainWindow.focus();
                }
            });
            notification.show();
            electron_log_1.default.info(`Notification shown: ${options.title}`);
        }
        catch (error) {
            electron_log_1.default.error('Failed to show notification:', error);
        }
    }
    async showEmailNotification(subject, sender, accountName) {
        await this.showNotification({
            title: `New Email - ${accountName}`,
            body: `From: ${sender}\n${subject}`,
            tag: 'email',
            priority: 'normal',
        });
    }
    async showCalendarNotification(eventTitle, time) {
        await this.showNotification({
            title: 'Calendar Reminder',
            body: `${eventTitle} at ${time}`,
            tag: 'calendar',
            priority: 'high',
        });
    }
    clearAllNotifications() {
        for (const notification of this.activeNotifications.values()) {
            notification.close();
        }
        this.activeNotifications.clear();
    }
    clearNotification(tag) {
        const notification = this.activeNotifications.get(tag);
        if (notification) {
            notification.close();
            this.activeNotifications.delete(tag);
        }
    }
    isNotificationSupported() {
        return electron_1.Notification.isSupported();
    }
    getNotificationPermissionStatus() {
        try {
            if (process.platform === 'darwin') {
                try {
                    const { systemPreferences } = require('electron');
                    const getNotificationPermission = systemPreferences.getNotificationPermission;
                    if (typeof getNotificationPermission === 'function') {
                        const permission = getNotificationPermission();
                        return permission || 'unknown';
                    }
                    else {
                        return 'unknown';
                    }
                }
                catch (macError) {
                    electron_log_1.default.warn('Failed to get macOS notification permission status:', macError);
                    return 'unknown';
                }
            }
            // On Windows and Linux, permissions are typically granted by default
            return 'granted';
        }
        catch (error) {
            electron_log_1.default.warn('Failed to get notification permission status:', error);
            return 'unknown';
        }
    }
    async cleanup() {
        this.clearAllNotifications();
        electron_log_1.default.info('Desktop notification manager cleaned up');
    }
}
exports.DesktopNotificationManager = DesktopNotificationManager;
