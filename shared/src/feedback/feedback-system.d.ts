/**
 * User Feedback System
 * Handles user feedback collection, analytics, and automated feedback processing
 */
export interface FeedbackForm {
    id: string;
    title: string;
    description?: string;
    fields: FeedbackField[];
    triggers: FeedbackTrigger[];
    analytics: boolean;
    autoResponse?: string;
    routing: FeedbackRouting;
    visibility: FeedbackVisibility;
}
export interface FeedbackField {
    id: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    required: boolean;
    validation?: FieldValidation;
    options?: string[];
    defaultValue?: any;
    conditional?: FieldCondition;
}
export type FieldType = 'text' | 'textarea' | 'email' | 'select' | 'radio' | 'checkbox' | 'rating' | 'file' | 'screenshot' | 'video' | 'slider' | 'date';
export interface FieldValidation {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    fileTypes?: string[];
    maxFileSize?: number;
    custom?: (value: any) => boolean | string;
}
export interface FieldCondition {
    fieldId: string;
    operator: 'equals' | 'contains' | 'greater' | 'less' | 'in';
    value: any;
}
export interface FeedbackTrigger {
    type: TriggerType;
    condition: TriggerCondition;
    delay?: number;
    maxOccurrences?: number;
    cooldown?: number;
}
export type TriggerType = 'error_occurred' | 'feature_used' | 'time_spent' | 'page_visit' | 'user_action' | 'performance_issue' | 'inactivity' | 'exit_intent' | 'milestone_reached';
export interface TriggerCondition {
    event?: string;
    threshold?: number;
    location?: string;
    errorType?: string;
    metadata?: Record<string, any>;
}
export interface FeedbackRouting {
    defaultAssignee?: string;
    autoTriage: boolean;
    escalationRules: EscalationRule[];
    integrations: FeedbackIntegration[];
}
export interface EscalationRule {
    condition: {
        severity?: string[];
        keywords?: string[];
        category?: string[];
        sentiment?: 'positive' | 'negative' | 'neutral';
    };
    action: {
        assignTo?: string;
        addTags?: string[];
        setPriority?: 'low' | 'medium' | 'high' | 'critical';
        notify?: string[];
    };
}
export interface FeedbackIntegration {
    type: 'slack' | 'email' | 'jira' | 'github' | 'discord' | 'webhook';
    config: Record<string, any>;
    conditions?: {
        severity?: string[];
        categories?: string[];
    };
}
export interface FeedbackVisibility {
    showToUsers: string[];
    showInWorkspaces: string[];
    showOnPlatforms: string[];
    showAfterDate?: number;
    showBeforeDate?: number;
}
export interface SubmittedFeedback {
    id: string;
    formId: string;
    userId?: string;
    sessionId: string;
    deviceInfo: DeviceInfo;
    responses: Record<string, any>;
    attachments: FeedbackAttachment[];
    metadata: FeedbackMetadata;
    sentiment: SentimentAnalysis;
    submittedAt: number;
    status: FeedbackStatus;
    assignee?: string;
    tags: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    internalNotes: InternalNote[];
}
export interface DeviceInfo {
    platform: string;
    os: string;
    browser?: string;
    version: string;
    viewport: {
        width: number;
        height: number;
    };
    userAgent: string;
    timezone: string;
    language: string;
}
export interface FeedbackMetadata {
    url?: string;
    feature?: string;
    component?: string;
    workspaceId?: string;
    errorId?: string;
    performanceMetrics?: PerformanceMetrics;
    breadcrumbs: any[];
    screenRecording?: string;
}
export interface PerformanceMetrics {
    loadTime: number;
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
}
export interface SentimentAnalysis {
    score: number;
    confidence: number;
    emotions: Record<string, number>;
    keywords: string[];
    intent: 'complaint' | 'suggestion' | 'compliment' | 'question' | 'bug_report';
}
export type FeedbackStatus = 'new' | 'in_review' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed' | 'spam';
export interface InternalNote {
    id: string;
    author: string;
    content: string;
    timestamp: number;
    visibility: 'internal' | 'public';
}
export interface FeedbackAttachment {
    id: string;
    type: 'image' | 'video' | 'audio' | 'document' | 'log';
    name: string;
    size: number;
    mimeType: string;
    data: Uint8Array;
    thumbnail?: Uint8Array;
}
export interface FeedbackAnalytics {
    totalSubmissions: number;
    averageRating: number;
    sentimentDistribution: Record<string, number>;
    topIssues: IssueAnalytics[];
    responseTime: number;
    resolutionTime: number;
    satisfactionScore: number;
    trends: FeedbackTrend[];
}
export interface IssueAnalytics {
    category: string;
    count: number;
    averageSeverity: number;
    trend: 'increasing' | 'decreasing' | 'stable';
}
export interface FeedbackTrend {
    period: string;
    submissions: number;
    averageRating: number;
    sentiment: number;
}
export declare class FeedbackSystem {
    private static instance;
    private forms;
    private submissions;
    private triggers;
    private analytics;
    private screenRecorder;
    private isRecording;
    static getInstance(): FeedbackSystem;
    /**
     * Initialize feedback system
     */
    initialize(): Promise<void>;
    /**
     * Create or update a feedback form
     */
    createForm(form: Omit<FeedbackForm, 'id'>): Promise<string>;
    /**
     * Get feedback form by ID
     */
    getForm(formId: string): FeedbackForm | null;
    /**
     * Get all forms visible to user
     */
    getVisibleForms(userId: string, workspaceId: string, platform: string): FeedbackForm[];
    /**
     * Submit feedback
     */
    submitFeedback(formId: string, responses: Record<string, any>, attachments?: FeedbackAttachment[], metadata?: Partial<FeedbackMetadata>): Promise<string>;
    /**
     * Trigger feedback form based on event
     */
    triggerFeedback(event: string, data?: any): Promise<string | null>;
    /**
     * Start screen recording for feedback
     */
    startScreenRecording(): Promise<void>;
    /**
     * Stop screen recording
     */
    stopScreenRecording(): void;
    /**
     * Take screenshot for feedback
     */
    takeScreenshot(): Promise<FeedbackAttachment | null>;
    /**
     * Get feedback analytics
     */
    getAnalytics(): FeedbackAnalytics | null;
    /**
     * Get submission by ID
     */
    getSubmission(submissionId: string): SubmittedFeedback | null;
    /**
     * Update submission status
     */
    updateSubmissionStatus(submissionId: string, status: FeedbackStatus, note?: string): Promise<void>;
    private loadDefaultForms;
    private setupTriggerListeners;
    private shouldTrigger;
    private isFormVisible;
    private validateResponses;
    private evaluateCondition;
    private processSubmission;
    private routeFeedback;
    private matchesEscalationRule;
    private shouldNotifyIntegration;
    private sendIntegrationNotification;
    private analyzeSentiment;
    private generateTags;
    private calculatePriority;
    private emitFeedbackTrigger;
    private getDeviceInfo;
    private getOS;
    private getBrowser;
    private getSessionId;
    private getBreadcrumbs;
    private getPerformanceMetrics;
    private generateThumbnail;
    private storeRecording;
    private loadAnalytics;
    private updateAnalytics;
    private saveForms;
    private saveSubmissions;
    private generateId;
}
export declare const getFeedbackSystem: () => FeedbackSystem;
export declare const showFeedbackForm: (formId?: string) => void;
//# sourceMappingURL=feedback-system.d.ts.map