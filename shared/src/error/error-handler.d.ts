/**
 * Production Error Handling and User Feedback System
 * Comprehensive error handling, logging, reporting, and user feedback mechanisms
 */
export interface ErrorContext {
    userId?: string;
    deviceId?: string;
    platform?: string;
    version?: string;
    workspaceId?: string;
    feature?: string;
    component?: string;
    timestamp: number;
    sessionId?: string;
    breadcrumbs: Breadcrumb[];
    context?: Record<string, any>;
    metadata?: Record<string, any>;
}
export interface Breadcrumb {
    timestamp: number;
    message: string;
    category: BreadcrumbCategory;
    level: ErrorLevel;
    data?: Record<string, any>;
}
export type BreadcrumbCategory = 'navigation' | 'user' | 'network' | 'system' | 'error' | 'debug';
export type ErrorLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export interface ErrorReport {
    id: string;
    message: string;
    stack?: string;
    level: ErrorLevel;
    context: ErrorContext;
    resolved: boolean;
    reportedAt: number;
    fingerprint: string;
    occurrenceCount: number;
    lastOccurrence: number;
    tags: string[];
}
export interface UserFeedback {
    id: string;
    errorId?: string;
    userId?: string;
    type: 'bug' | 'feedback' | 'suggestion' | 'question';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    steps?: string[];
    expectedBehavior?: string;
    actualBehavior?: string;
    attachments?: FeedbackAttachment[];
    context: ErrorContext;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    submittedAt: number;
    resolvedAt?: number;
    tags: string[];
}
export interface FeedbackAttachment {
    id: string;
    type: 'screenshot' | 'video' | 'log' | 'file';
    name: string;
    size: number;
    data: Uint8Array | string;
    mimeType?: string;
}
export interface NotificationConfig {
    showToUser: boolean;
    userMessage?: string;
    actionable: boolean;
    actions?: NotificationAction[];
    dismissible: boolean;
    autoHide: boolean;
    duration?: number;
    priority: 'low' | 'normal' | 'high';
}
export interface NotificationAction {
    id: string;
    label: string;
    type: 'button' | 'link';
    action: Function;
    style?: 'primary' | 'secondary' | 'danger';
}
export interface ErrorHandlerConfig {
    enableReporting: boolean;
    enableUserFeedback: boolean;
    reportingEndpoint?: string;
    maxBreadcrumbs: number;
    enableConsoleLogging: boolean;
    enableUserNotifications: boolean;
    enableAutomaticRecovery: boolean;
    enablePerformanceMonitoring: boolean;
    enableNetworkErrorRetry: boolean;
    retryAttempts: number;
    retryDelay: number;
    enableCrashRecovery: boolean;
    enableOfflineSupport: boolean;
}
export declare class ErrorHandler {
    private static instance;
    private config;
    private context;
    private breadcrumbs;
    private errorReports;
    private userFeedback;
    private errorListeners;
    private recoveryStrategies;
    private retryQueue;
    private performanceMonitor;
    constructor(config: ErrorHandlerConfig);
    static getInstance(config?: ErrorHandlerConfig): ErrorHandler;
    /**
     * Initialize error handler with context
     */
    initialize(context: Partial<ErrorContext>): void;
    /**
     * Capture and handle an error
     */
    captureError(error: Error | string, level?: ErrorLevel, context?: Partial<ErrorContext>): string;
    /**
     * Capture exception with automatic error reporting
     */
    captureException(error: Error, context?: Partial<ErrorContext>): string;
    /**
     * Capture message for logging and reporting
     */
    captureMessage(message: string, level?: ErrorLevel, context?: Partial<ErrorContext>): string;
    /**
     * Add breadcrumb for debugging
     */
    addBreadcrumb(message: string, category: BreadcrumbCategory, level?: ErrorLevel, data?: Record<string, any>): void;
    /**
     * Set user context
     */
    setUser(user: {
        id: string;
        email?: string;
        name?: string;
        [key: string]: any;
    }): void;
    /**
     * Set workspace context
     */
    setWorkspace(workspaceId: string): void;
    /**
     * Set component context
     */
    setComponent(component: string): void;
    /**
     * Set feature context
     */
    setFeature(feature: string): void;
    /**
     * Submit user feedback
     */
    submitUserFeedback(feedback: Omit<UserFeedback, 'id' | 'context' | 'submittedAt' | 'status'>): Promise<string>;
    /**
     * Handle network error with retry logic
     */
    handleNetworkError(error: Error, retryFunction: Function, maxRetries?: number): Promise<any>;
    /**
     * Register error listener
     */
    onError(listener: (error: ErrorReport) => void): void;
    /**
     * Remove error listener
     */
    offError(listener: Function): void;
    /**
     * Register recovery strategy for specific error types
     */
    registerRecoveryStrategy(errorPattern: string | RegExp, recoveryFunction: Function): void;
    /**
     * Get error reports
     */
    getErrorReports(): ErrorReport[];
    /**
     * Get user feedback
     */
    getUserFeedback(): UserFeedback[];
    /**
     * Get breadcrumbs
     */
    getBreadcrumbs(): Breadcrumb[];
    /**
     * Clear breadcrumbs
     */
    clearBreadcrumbs(): void;
    /**
     * Get current context
     */
    getCurrentContext(): ErrorContext;
    /**
     * Enable/disable error reporting
     */
    setReportingEnabled(enabled: boolean): void;
    private createErrorReport;
    private generateFingerprint;
    private generateTags;
    private generateId;
    private notifyErrorListeners;
    private reportError;
    private reportUserFeedback;
    private showUserNotification;
    private getNotificationConfig;
    private attemptRecovery;
    private setupGlobalErrorHandlers;
    private setupUnhandledRejectionHandler;
    private setupPerformanceMonitoring;
    private handleCrashRecovery;
    private restartApplication;
    private retryLastAction;
    private openFeedbackDialog;
    private sleep;
}
export declare const createErrorHandler: (config: ErrorHandlerConfig) => ErrorHandler;
export declare const getErrorHandler: () => ErrorHandler;
export declare const withErrorBoundary: (fn: Function, context?: Partial<ErrorContext>) => (...args: any[]) => Promise<any>;
//# sourceMappingURL=error-handler.d.ts.map