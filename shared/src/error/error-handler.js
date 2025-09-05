"use strict";
/**
 * Production Error Handling and User Feedback System
 * Comprehensive error handling, logging, reporting, and user feedback mechanisms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withErrorBoundary = exports.getErrorHandler = exports.createErrorHandler = exports.ErrorHandler = void 0;
class ErrorHandler {
    constructor(config) {
        this.context = {};
        this.breadcrumbs = [];
        this.errorReports = new Map();
        this.userFeedback = new Map();
        this.errorListeners = [];
        this.recoveryStrategies = new Map();
        this.retryQueue = new Map();
        this.performanceMonitor = null;
        this.config = config;
        this.setupGlobalErrorHandlers();
        this.setupPerformanceMonitoring();
        this.setupUnhandledRejectionHandler();
    }
    static getInstance(config) {
        if (!ErrorHandler.instance && config) {
            ErrorHandler.instance = new ErrorHandler(config);
        }
        else if (!ErrorHandler.instance) {
            throw new Error('ErrorHandler must be initialized with config first');
        }
        return ErrorHandler.instance;
    }
    /**
     * Initialize error handler with context
     */
    initialize(context) {
        this.context = {
            ...context,
            timestamp: Date.now(),
            breadcrumbs: []
        };
        // Add initial breadcrumb
        this.addBreadcrumb('ErrorHandler initialized', 'system', 'info', { context });
        console.log('ErrorHandler initialized with context:', context);
    }
    /**
     * Capture and handle an error
     */
    captureError(error, level = 'error', context) {
        const errorReport = this.createErrorReport(error, level, context);
        // Store error report
        this.errorReports.set(errorReport.id, errorReport);
        // Add breadcrumb
        this.addBreadcrumb(`Error captured: ${errorReport.message}`, 'error', level, { errorId: errorReport.id });
        // Log to console if enabled
        if (this.config.enableConsoleLogging) {
            console.error('Error captured:', errorReport);
        }
        // Notify listeners
        this.notifyErrorListeners(errorReport);
        // Report to external service if enabled
        if (this.config.enableReporting) {
            this.reportError(errorReport);
        }
        // Show user notification if configured
        this.showUserNotification(errorReport);
        // Attempt automatic recovery if enabled
        if (this.config.enableAutomaticRecovery) {
            this.attemptRecovery(errorReport);
        }
        return errorReport.id;
    }
    /**
     * Capture exception with automatic error reporting
     */
    captureException(error, context) {
        return this.captureError(error, 'error', context);
    }
    /**
     * Capture message for logging and reporting
     */
    captureMessage(message, level = 'info', context) {
        return this.captureError(message, level, context);
    }
    /**
     * Add breadcrumb for debugging
     */
    addBreadcrumb(message, category, level = 'info', data) {
        const breadcrumb = {
            timestamp: Date.now(),
            message,
            category,
            level,
            data
        };
        this.breadcrumbs.push(breadcrumb);
        // Maintain max breadcrumbs limit
        if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
            this.breadcrumbs.shift();
        }
    }
    /**
     * Set user context
     */
    setUser(user) {
        this.context.userId = user.id;
        this.context.metadata = { ...this.context.metadata, user };
        this.addBreadcrumb('User context updated', 'user', 'info', { userId: user.id });
    }
    /**
     * Set workspace context
     */
    setWorkspace(workspaceId) {
        this.context.workspaceId = workspaceId;
        this.addBreadcrumb('Workspace changed', 'navigation', 'info', { workspaceId });
    }
    /**
     * Set component context
     */
    setComponent(component) {
        this.context.component = component;
        this.addBreadcrumb('Component context set', 'navigation', 'info', { component });
    }
    /**
     * Set feature context
     */
    setFeature(feature) {
        this.context.feature = feature;
        this.addBreadcrumb('Feature context set', 'navigation', 'info', { feature });
    }
    /**
     * Submit user feedback
     */
    async submitUserFeedback(feedback) {
        const userFeedback = {
            ...feedback,
            id: this.generateId(),
            context: this.getCurrentContext(),
            submittedAt: Date.now(),
            status: 'open'
        };
        this.userFeedback.set(userFeedback.id, userFeedback);
        // Add breadcrumb
        this.addBreadcrumb(`User feedback submitted: ${userFeedback.type}`, 'user', 'info', { feedbackId: userFeedback.id, type: userFeedback.type });
        // Report feedback if enabled
        if (this.config.enableReporting) {
            await this.reportUserFeedback(userFeedback);
        }
        return userFeedback.id;
    }
    /**
     * Handle network error with retry logic
     */
    async handleNetworkError(error, retryFunction, maxRetries) {
        const retries = maxRetries || this.config.retryAttempts;
        const errorId = this.captureError(error, 'error', { feature: 'network' });
        if (!this.config.enableNetworkErrorRetry) {
            throw error;
        }
        const retryKey = `network_${Date.now()}_${Math.random()}`;
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                this.addBreadcrumb(`Network retry attempt ${attempt + 1}/${retries}`, 'network', 'info', { errorId, attempt: attempt + 1 });
                const result = await retryFunction();
                if (attempt > 0) {
                    this.addBreadcrumb(`Network retry succeeded after ${attempt + 1} attempts`, 'network', 'info', { errorId, totalAttempts: attempt + 1 });
                }
                return result;
            }
            catch (retryError) {
                if (attempt === retries - 1) {
                    this.captureError(`Network retry failed after ${retries} attempts`, 'error', { feature: 'network', timestamp: Date.now(), breadcrumbs: [], context: { originalError: error.message } });
                    throw retryError;
                }
                // Wait before retry with exponential backoff
                const delay = this.config.retryDelay * Math.pow(2, attempt);
                await this.sleep(delay);
            }
        }
    }
    /**
     * Register error listener
     */
    onError(listener) {
        this.errorListeners.push(listener);
    }
    /**
     * Remove error listener
     */
    offError(listener) {
        const index = this.errorListeners.indexOf(listener);
        if (index > -1) {
            this.errorListeners.splice(index, 1);
        }
    }
    /**
     * Register recovery strategy for specific error types
     */
    registerRecoveryStrategy(errorPattern, recoveryFunction) {
        const key = errorPattern instanceof RegExp ? errorPattern.source : errorPattern;
        this.recoveryStrategies.set(key, recoveryFunction);
    }
    /**
     * Get error reports
     */
    getErrorReports() {
        return Array.from(this.errorReports.values());
    }
    /**
     * Get user feedback
     */
    getUserFeedback() {
        return Array.from(this.userFeedback.values());
    }
    /**
     * Get breadcrumbs
     */
    getBreadcrumbs() {
        return [...this.breadcrumbs];
    }
    /**
     * Clear breadcrumbs
     */
    clearBreadcrumbs() {
        this.breadcrumbs = [];
        this.addBreadcrumb('Breadcrumbs cleared', 'system', 'info');
    }
    /**
     * Get current context
     */
    getCurrentContext() {
        return {
            ...this.context,
            timestamp: Date.now(),
            breadcrumbs: [...this.breadcrumbs]
        };
    }
    /**
     * Enable/disable error reporting
     */
    setReportingEnabled(enabled) {
        this.config.enableReporting = enabled;
        this.addBreadcrumb(`Error reporting ${enabled ? 'enabled' : 'disabled'}`, 'system', 'info');
    }
    // Private methods
    createErrorReport(error, level, context) {
        const message = typeof error === 'string' ? error : error.message;
        const stack = typeof error === 'string' ? undefined : error.stack;
        const fullContext = {
            ...this.context,
            ...context,
            timestamp: Date.now(),
            breadcrumbs: [...this.breadcrumbs]
        };
        const fingerprint = this.generateFingerprint(message, stack);
        const existingReport = Array.from(this.errorReports.values())
            .find(report => report.fingerprint === fingerprint);
        if (existingReport) {
            existingReport.occurrenceCount++;
            existingReport.lastOccurrence = Date.now();
            return existingReport;
        }
        const errorReport = {
            id: this.generateId(),
            message,
            stack,
            level,
            context: fullContext,
            resolved: false,
            reportedAt: Date.now(),
            fingerprint,
            occurrenceCount: 1,
            lastOccurrence: Date.now(),
            tags: this.generateTags(error, fullContext)
        };
        return errorReport;
    }
    generateFingerprint(message, stack) {
        const content = stack || message;
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }
    generateTags(error, context) {
        const tags = [];
        if (context.platform)
            tags.push(`platform:${context.platform}`);
        if (context.feature)
            tags.push(`feature:${context.feature}`);
        if (context.component)
            tags.push(`component:${context.component}`);
        if (context.workspaceId)
            tags.push(`workspace:${context.workspaceId}`);
        if (typeof error !== 'string') {
            tags.push(`error_type:${error.constructor.name}`);
        }
        return tags;
    }
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    notifyErrorListeners(errorReport) {
        for (const listener of this.errorListeners) {
            try {
                listener(errorReport);
            }
            catch (error) {
                console.error('Error in error listener:', error);
            }
        }
    }
    async reportError(errorReport) {
        if (!this.config.reportingEndpoint) {
            return;
        }
        try {
            await fetch(this.config.reportingEndpoint + '/errors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(errorReport)
            });
        }
        catch (error) {
            console.error('Failed to report error:', error);
        }
    }
    async reportUserFeedback(feedback) {
        if (!this.config.reportingEndpoint) {
            return;
        }
        try {
            await fetch(this.config.reportingEndpoint + '/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(feedback)
            });
        }
        catch (error) {
            console.error('Failed to report user feedback:', error);
        }
    }
    showUserNotification(errorReport) {
        if (!this.config.enableUserNotifications) {
            return;
        }
        // Determine notification configuration based on error level
        const config = this.getNotificationConfig(errorReport);
        if (config.showToUser) {
            // Emit event for UI to handle notification display
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('flowdesk:error-notification', {
                    detail: { errorReport, config }
                }));
            }
        }
    }
    getNotificationConfig(errorReport) {
        switch (errorReport.level) {
            case 'fatal':
                return {
                    showToUser: true,
                    userMessage: 'A critical error occurred. The application may need to restart.',
                    actionable: true,
                    actions: [
                        {
                            id: 'restart',
                            label: 'Restart App',
                            type: 'button',
                            action: () => this.restartApplication(),
                            style: 'primary'
                        },
                        {
                            id: 'report',
                            label: 'Report Issue',
                            type: 'button',
                            action: () => this.openFeedbackDialog(errorReport.id),
                            style: 'secondary'
                        }
                    ],
                    dismissible: false,
                    autoHide: false,
                    priority: 'high'
                };
            case 'error':
                return {
                    showToUser: true,
                    userMessage: 'An error occurred while processing your request.',
                    actionable: true,
                    actions: [
                        {
                            id: 'retry',
                            label: 'Try Again',
                            type: 'button',
                            action: () => this.retryLastAction(),
                            style: 'primary'
                        },
                        {
                            id: 'report',
                            label: 'Report',
                            type: 'button',
                            action: () => this.openFeedbackDialog(errorReport.id),
                            style: 'secondary'
                        }
                    ],
                    dismissible: true,
                    autoHide: false,
                    priority: 'normal'
                };
            case 'warn':
                return {
                    showToUser: true,
                    userMessage: 'Something unexpected happened, but you can continue.',
                    actionable: false,
                    dismissible: true,
                    autoHide: true,
                    duration: 5000,
                    priority: 'low'
                };
            default:
                return {
                    showToUser: false,
                    actionable: false,
                    dismissible: true,
                    autoHide: true,
                    priority: 'low'
                };
        }
    }
    attemptRecovery(errorReport) {
        for (const [pattern, recoveryFn] of this.recoveryStrategies) {
            const regex = new RegExp(pattern);
            if (regex.test(errorReport.message) || (errorReport.stack && regex.test(errorReport.stack))) {
                try {
                    this.addBreadcrumb(`Attempting recovery for error: ${errorReport.id}`, 'system', 'info', { errorId: errorReport.id, pattern });
                    recoveryFn(errorReport);
                    this.addBreadcrumb(`Recovery successful for error: ${errorReport.id}`, 'system', 'info', { errorId: errorReport.id });
                    return;
                }
                catch (recoveryError) {
                    this.captureError(`Recovery failed for error ${errorReport.id}: ${recoveryError.message || 'Unknown error'}`, 'error', { timestamp: Date.now(), breadcrumbs: [], context: { originalErrorId: errorReport.id } });
                }
            }
        }
    }
    setupGlobalErrorHandlers() {
        // Handle unhandled errors
        if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                this.captureError(event.error || event.message, 'error', {
                    feature: 'global_handler',
                    metadata: {
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno
                    }
                });
            });
        }
        else if (typeof process !== 'undefined') {
            process.on('uncaughtException', (error) => {
                this.captureError(error, 'fatal', { feature: 'global_handler' });
                if (this.config.enableCrashRecovery) {
                    this.handleCrashRecovery(error);
                }
                else {
                    process.exit(1);
                }
            });
        }
    }
    setupUnhandledRejectionHandler() {
        if (typeof window !== 'undefined') {
            window.addEventListener('unhandledrejection', (event) => {
                this.captureError(event.reason, 'error', { feature: 'promise_rejection' });
            });
        }
        else if (typeof process !== 'undefined') {
            process.on('unhandledRejection', (reason, promise) => {
                this.captureError(reason, 'error', {
                    feature: 'promise_rejection',
                    metadata: { promise: promise.toString() }
                });
            });
        }
    }
    setupPerformanceMonitoring() {
        if (this.config.enablePerformanceMonitoring) {
            this.performanceMonitor = new PerformanceMonitor();
            this.performanceMonitor.onPerformanceIssue((issue) => {
                this.captureError(`Performance issue: ${issue.type}`, 'warn', {
                    feature: 'performance',
                    metadata: issue
                });
            });
        }
    }
    handleCrashRecovery(error) {
        this.addBreadcrumb('Crash recovery initiated', 'system', 'error', {
            error: error.message
        });
        // Implement crash recovery logic
        // This could include saving current state, clearing problematic data, etc.
        // For now, just log and continue
        console.error('Crash recovery:', error);
    }
    restartApplication() {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
        else if (typeof process !== 'undefined') {
            // For Electron or Node.js apps
            process.exit(0);
        }
    }
    retryLastAction() {
        // Implement retry logic for the last failed action
        this.addBreadcrumb('Retrying last action', 'user', 'info');
    }
    openFeedbackDialog(errorId) {
        // Emit event to open feedback dialog
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('flowdesk:open-feedback', {
                detail: { errorId }
            }));
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.ErrorHandler = ErrorHandler;
ErrorHandler.instance = null;
// Performance Monitor class
class PerformanceMonitor {
    constructor() {
        this.observers = [];
        this.onIssueCallback = null;
        this.setupObservers();
    }
    onPerformanceIssue(callback) {
        this.onIssueCallback = callback;
    }
    setupObservers() {
        if (typeof PerformanceObserver === 'undefined') {
            return;
        }
        // Monitor long tasks
        try {
            const longTaskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) { // Tasks longer than 50ms
                        this.reportPerformanceIssue({
                            type: 'long_task',
                            duration: entry.duration,
                            startTime: entry.startTime
                        });
                    }
                }
            });
            longTaskObserver.observe({ entryTypes: ['longtask'] });
            this.observers.push(longTaskObserver);
        }
        catch (error) {
            // Long task API not supported
        }
        // Monitor layout shifts
        try {
            const layoutShiftObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.value > 0.1) { // Significant layout shift
                        this.reportPerformanceIssue({
                            type: 'layout_shift',
                            value: entry.value,
                            startTime: entry.startTime
                        });
                    }
                }
            });
            layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
            this.observers.push(layoutShiftObserver);
        }
        catch (error) {
            // Layout shift API not supported
        }
    }
    reportPerformanceIssue(issue) {
        if (this.onIssueCallback) {
            this.onIssueCallback(issue);
        }
    }
    dispose() {
        for (const observer of this.observers) {
            observer.disconnect();
        }
        this.observers = [];
    }
}
// Helper functions
const createErrorHandler = (config) => {
    return new ErrorHandler(config);
};
exports.createErrorHandler = createErrorHandler;
const getErrorHandler = () => {
    return ErrorHandler.getInstance();
};
exports.getErrorHandler = getErrorHandler;
const withErrorBoundary = (fn, context) => {
    return async (...args) => {
        const errorHandler = ErrorHandler.getInstance();
        try {
            return await fn(...args);
        }
        catch (error) {
            errorHandler.captureError(error, 'error', context);
            throw error;
        }
    };
};
exports.withErrorBoundary = withErrorBoundary;
//# sourceMappingURL=error-handler.js.map