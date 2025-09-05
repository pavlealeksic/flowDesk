"use strict";
/**
 * User Feedback System
 * Handles user feedback collection, analytics, and automated feedback processing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.showFeedbackForm = exports.getFeedbackSystem = exports.FeedbackSystem = void 0;
class FeedbackSystem {
    constructor() {
        this.forms = new Map();
        this.submissions = new Map();
        this.triggers = new Map();
        this.analytics = null;
        this.screenRecorder = null;
        this.isRecording = false;
    }
    static getInstance() {
        if (!FeedbackSystem.instance) {
            FeedbackSystem.instance = new FeedbackSystem();
        }
        return FeedbackSystem.instance;
    }
    /**
     * Initialize feedback system
     */
    async initialize() {
        // Load default forms
        await this.loadDefaultForms();
        // Set up trigger listeners
        this.setupTriggerListeners();
        // Load analytics
        await this.loadAnalytics();
        console.log('FeedbackSystem initialized');
    }
    /**
     * Create or update a feedback form
     */
    async createForm(form) {
        const formId = this.generateId();
        const fullForm = {
            ...form,
            id: formId
        };
        this.forms.set(formId, fullForm);
        await this.saveForms();
        return formId;
    }
    /**
     * Get feedback form by ID
     */
    getForm(formId) {
        return this.forms.get(formId) || null;
    }
    /**
     * Get all forms visible to user
     */
    getVisibleForms(userId, workspaceId, platform) {
        return Array.from(this.forms.values()).filter(form => this.isFormVisible(form, userId, workspaceId, platform));
    }
    /**
     * Submit feedback
     */
    async submitFeedback(formId, responses, attachments = [], metadata) {
        const form = this.getForm(formId);
        if (!form) {
            throw new Error(`Feedback form not found: ${formId}`);
        }
        // Validate responses
        const validationErrors = this.validateResponses(form, responses);
        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }
        // Create submission
        const submission = {
            id: this.generateId(),
            formId,
            sessionId: this.getSessionId(),
            deviceInfo: await this.getDeviceInfo(),
            responses,
            attachments,
            metadata: {
                ...metadata,
                breadcrumbs: this.getBreadcrumbs(),
                performanceMetrics: await this.getPerformanceMetrics()
            },
            sentiment: await this.analyzeSentiment(responses),
            submittedAt: Date.now(),
            status: 'new',
            tags: this.generateTags(responses, form),
            priority: this.calculatePriority(responses, form),
            internalNotes: []
        };
        this.submissions.set(submission.id, submission);
        // Process submission
        await this.processSubmission(submission);
        // Update analytics
        await this.updateAnalytics(submission);
        // Auto-route and notify
        await this.routeFeedback(submission);
        return submission.id;
    }
    /**
     * Trigger feedback form based on event
     */
    async triggerFeedback(event, data) {
        for (const [formId, form] of this.forms) {
            for (const trigger of form.triggers) {
                if (this.shouldTrigger(trigger, event, data)) {
                    // Check cooldown
                    const triggerKey = `${formId}_${trigger.type}`;
                    const lastTrigger = this.triggers.get(triggerKey);
                    if (lastTrigger && trigger.cooldown) {
                        if (Date.now() - lastTrigger.lastTriggered < trigger.cooldown) {
                            continue; // Still in cooldown
                        }
                    }
                    // Check max occurrences
                    if (lastTrigger && trigger.maxOccurrences) {
                        if (lastTrigger.count >= trigger.maxOccurrences) {
                            continue; // Max occurrences reached
                        }
                    }
                    // Update trigger tracking
                    this.triggers.set(triggerKey, {
                        lastTriggered: Date.now(),
                        count: (lastTrigger?.count || 0) + 1
                    });
                    // Show form (emit event for UI to handle)
                    this.emitFeedbackTrigger(formId, trigger.delay);
                    return formId;
                }
            }
        }
        return null;
    }
    /**
     * Start screen recording for feedback
     */
    async startScreenRecording() {
        if (this.isRecording || typeof navigator === 'undefined') {
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });
            this.screenRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9'
            });
            const recordedChunks = [];
            this.screenRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };
            this.screenRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                // Store recording for feedback attachment
                this.storeRecording(blob);
            };
            this.screenRecorder.start();
            this.isRecording = true;
        }
        catch (error) {
            console.error('Failed to start screen recording:', error);
        }
    }
    /**
     * Stop screen recording
     */
    stopScreenRecording() {
        if (this.screenRecorder && this.isRecording) {
            this.screenRecorder.stop();
            this.isRecording = false;
            // Stop all tracks
            this.screenRecorder.stream?.getTracks().forEach(track => track.stop());
        }
    }
    /**
     * Take screenshot for feedback
     */
    async takeScreenshot() {
        if (typeof globalThis.html2canvas === 'undefined') {
            console.warn('html2canvas not available for screenshots');
            return null;
        }
        try {
            const canvas = await window.html2canvas(document.body, {
                height: window.innerHeight,
                width: window.innerWidth,
                useCORS: true
            });
            return new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const attachment = {
                                id: this.generateId(),
                                type: 'image',
                                name: `screenshot_${Date.now()}.png`,
                                size: blob.size,
                                mimeType: 'image/png',
                                data: new Uint8Array(reader.result)
                            };
                            resolve(attachment);
                        };
                        reader.readAsArrayBuffer(blob);
                    }
                    else {
                        resolve(null);
                    }
                }, 'image/png', 0.8);
            });
        }
        catch (error) {
            console.error('Failed to take screenshot:', error);
            return null;
        }
    }
    /**
     * Get feedback analytics
     */
    getAnalytics() {
        return this.analytics;
    }
    /**
     * Get submission by ID
     */
    getSubmission(submissionId) {
        return this.submissions.get(submissionId) || null;
    }
    /**
     * Update submission status
     */
    async updateSubmissionStatus(submissionId, status, note) {
        const submission = this.submissions.get(submissionId);
        if (!submission) {
            throw new Error(`Submission not found: ${submissionId}`);
        }
        submission.status = status;
        if (note) {
            submission.internalNotes.push({
                id: this.generateId(),
                author: 'system',
                content: note,
                timestamp: Date.now(),
                visibility: 'internal'
            });
        }
        await this.saveSubmissions();
    }
    // Private methods
    async loadDefaultForms() {
        // General feedback form
        const generalForm = {
            id: 'general_feedback',
            title: 'General Feedback',
            description: 'Help us improve Flow Desk with your feedback',
            fields: [
                {
                    id: 'type',
                    type: 'select',
                    label: 'Feedback Type',
                    required: true,
                    options: ['Bug Report', 'Feature Request', 'General Feedback', 'Question']
                },
                {
                    id: 'rating',
                    type: 'rating',
                    label: 'Overall Rating',
                    required: false,
                    validation: { minLength: 1, maxLength: 5 }
                },
                {
                    id: 'subject',
                    type: 'text',
                    label: 'Subject',
                    required: true,
                    validation: { minLength: 5, maxLength: 100 }
                },
                {
                    id: 'description',
                    type: 'textarea',
                    label: 'Description',
                    placeholder: 'Please provide detailed information...',
                    required: true,
                    validation: { minLength: 20, maxLength: 2000 }
                },
                {
                    id: 'steps',
                    type: 'textarea',
                    label: 'Steps to Reproduce',
                    placeholder: '1. Go to...\n2. Click on...\n3. See error',
                    required: false,
                    conditional: { fieldId: 'type', operator: 'equals', value: 'Bug Report' }
                },
                {
                    id: 'expected',
                    type: 'textarea',
                    label: 'Expected Behavior',
                    required: false,
                    conditional: { fieldId: 'type', operator: 'equals', value: 'Bug Report' }
                },
                {
                    id: 'screenshot',
                    type: 'screenshot',
                    label: 'Screenshot',
                    required: false
                },
                {
                    id: 'contact',
                    type: 'email',
                    label: 'Contact Email',
                    placeholder: 'your.email@example.com',
                    required: false
                }
            ],
            triggers: [
                {
                    type: 'error_occurred',
                    condition: { errorType: 'user_facing' },
                    delay: 2000,
                    maxOccurrences: 3,
                    cooldown: 300000 // 5 minutes
                }
            ],
            analytics: true,
            routing: {
                autoTriage: true,
                escalationRules: [
                    {
                        condition: { severity: ['critical', 'high'] },
                        action: { setPriority: 'critical', notify: ['support@flowdesk.com'] }
                    }
                ],
                integrations: []
            },
            visibility: {
                showToUsers: ['all'],
                showInWorkspaces: ['all'],
                showOnPlatforms: ['all']
            }
        };
        this.forms.set(generalForm.id, generalForm);
    }
    setupTriggerListeners() {
        if (typeof window !== 'undefined') {
            // Listen for error events
            window.addEventListener('flowdesk:error-notification', (event) => {
                this.triggerFeedback('error_occurred', {
                    errorType: event.detail.errorReport.level === 'error' ? 'user_facing' : 'background'
                });
            });
            // Listen for feature usage events
            window.addEventListener('flowdesk:feature-used', (event) => {
                this.triggerFeedback('feature_used', event.detail);
            });
        }
    }
    shouldTrigger(trigger, event, data) {
        switch (trigger.type) {
            case 'error_occurred':
                return event === 'error_occurred' &&
                    (!trigger.condition.errorType || trigger.condition.errorType === data?.errorType);
            case 'feature_used':
                return event === 'feature_used' &&
                    (!trigger.condition.event || trigger.condition.event === data?.feature);
            default:
                return false;
        }
    }
    isFormVisible(form, userId, workspaceId, platform) {
        const visibility = form.visibility;
        // Check user visibility
        if (!visibility.showToUsers.includes('all') && !visibility.showToUsers.includes(userId)) {
            return false;
        }
        // Check workspace visibility
        if (!visibility.showInWorkspaces.includes('all') && !visibility.showInWorkspaces.includes(workspaceId)) {
            return false;
        }
        // Check platform visibility
        if (!visibility.showOnPlatforms.includes('all') && !visibility.showOnPlatforms.includes(platform)) {
            return false;
        }
        // Check date range
        const now = Date.now();
        if (visibility.showAfterDate && now < visibility.showAfterDate) {
            return false;
        }
        if (visibility.showBeforeDate && now > visibility.showBeforeDate) {
            return false;
        }
        return true;
    }
    validateResponses(form, responses) {
        const errors = [];
        for (const field of form.fields) {
            const value = responses[field.id];
            // Check if field is visible (conditional logic)
            if (field.conditional && !this.evaluateCondition(field.conditional, responses)) {
                continue;
            }
            // Check required fields
            if (field.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field.label} is required`);
                continue;
            }
            // Skip validation for empty optional fields
            if (!field.required && (value === undefined || value === null || value === '')) {
                continue;
            }
            // Field-specific validation
            if (field.validation) {
                const validation = field.validation;
                if (validation.minLength && value.length < validation.minLength) {
                    errors.push(`${field.label} must be at least ${validation.minLength} characters`);
                }
                if (validation.maxLength && value.length > validation.maxLength) {
                    errors.push(`${field.label} must be no more than ${validation.maxLength} characters`);
                }
                if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
                    errors.push(`${field.label} format is invalid`);
                }
                if (validation.custom) {
                    const result = validation.custom(value);
                    if (result !== true) {
                        errors.push(typeof result === 'string' ? result : `${field.label} is invalid`);
                    }
                }
            }
        }
        return errors;
    }
    evaluateCondition(condition, responses) {
        const fieldValue = responses[condition.fieldId];
        switch (condition.operator) {
            case 'equals':
                return fieldValue === condition.value;
            case 'contains':
                return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
            case 'greater':
                return Number(fieldValue) > Number(condition.value);
            case 'less':
                return Number(fieldValue) < Number(condition.value);
            case 'in':
                return Array.isArray(condition.value) && condition.value.includes(fieldValue);
            default:
                return false;
        }
    }
    async processSubmission(submission) {
        // Process attachments
        for (const attachment of submission.attachments) {
            if (attachment.type === 'image') {
                // Generate thumbnail for images
                attachment.thumbnail = await this.generateThumbnail(attachment.data);
            }
        }
        await this.saveSubmissions();
    }
    async routeFeedback(submission) {
        const form = this.getForm(submission.formId);
        if (!form)
            return;
        const routing = form.routing;
        // Auto-triage
        if (routing.autoTriage) {
            for (const rule of routing.escalationRules) {
                if (this.matchesEscalationRule(submission, rule)) {
                    // Apply escalation actions
                    if (rule.action.assignTo) {
                        submission.assignee = rule.action.assignTo;
                    }
                    if (rule.action.addTags) {
                        submission.tags.push(...rule.action.addTags);
                    }
                    if (rule.action.setPriority) {
                        submission.priority = rule.action.setPriority;
                    }
                    break;
                }
            }
        }
        // Send notifications through integrations
        for (const integration of routing.integrations) {
            if (this.shouldNotifyIntegration(submission, integration)) {
                await this.sendIntegrationNotification(submission, integration);
            }
        }
    }
    matchesEscalationRule(submission, rule) {
        const condition = rule.condition;
        if (condition.severity && !condition.severity.includes(submission.priority)) {
            return false;
        }
        if (condition.keywords) {
            const content = Object.values(submission.responses).join(' ').toLowerCase();
            if (!condition.keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
                return false;
            }
        }
        if (condition.sentiment && submission.sentiment.score) {
            const sentimentMatch = condition.sentiment === 'positive' && submission.sentiment.score > 0.1 ||
                condition.sentiment === 'negative' && submission.sentiment.score < -0.1 ||
                condition.sentiment === 'neutral' && Math.abs(submission.sentiment.score) <= 0.1;
            if (!sentimentMatch) {
                return false;
            }
        }
        return true;
    }
    shouldNotifyIntegration(submission, integration) {
        if (integration.conditions?.severity && !integration.conditions.severity.includes(submission.priority)) {
            return false;
        }
        return true;
    }
    async sendIntegrationNotification(submission, integration) {
        // Implementation would depend on the integration type
        console.log(`Sending notification to ${integration.type}:`, submission.id);
    }
    async analyzeSentiment(responses) {
        // Simple sentiment analysis - in production, use a proper NLP service
        const text = Object.values(responses).join(' ').toLowerCase();
        const positiveWords = ['good', 'great', 'excellent', 'love', 'amazing', 'fantastic'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'broken', 'useless'];
        let positiveCount = 0;
        let negativeCount = 0;
        positiveWords.forEach(word => {
            if (text.includes(word))
                positiveCount++;
        });
        negativeWords.forEach(word => {
            if (text.includes(word))
                negativeCount++;
        });
        const score = (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1);
        return {
            score,
            confidence: 0.7, // Placeholder confidence
            emotions: {},
            keywords: [],
            intent: negativeCount > positiveCount ? 'complaint' : 'compliment'
        };
    }
    generateTags(responses, form) {
        const tags = [];
        // Add form-based tags
        tags.push(`form:${form.id}`);
        // Add response-based tags
        if (responses.type) {
            tags.push(`type:${responses.type.toLowerCase().replace(' ', '_')}`);
        }
        return tags;
    }
    calculatePriority(responses, form) {
        // Simple priority calculation based on responses
        if (responses.type === 'Bug Report' && responses.rating && responses.rating <= 2) {
            return 'high';
        }
        if (responses.type === 'Feature Request') {
            return 'medium';
        }
        return 'low';
    }
    emitFeedbackTrigger(formId, delay) {
        const showForm = () => {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('flowdesk:show-feedback', {
                    detail: { formId }
                }));
            }
        };
        if (delay) {
            setTimeout(showForm, delay);
        }
        else {
            showForm();
        }
    }
    async getDeviceInfo() {
        return {
            platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
            os: this.getOS(),
            browser: this.getBrowser(),
            version: process.env.APP_VERSION || '1.0.0',
            viewport: typeof window !== 'undefined'
                ? { width: window.innerWidth, height: window.innerHeight }
                : { width: 0, height: 0 },
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: typeof navigator !== 'undefined' ? navigator.language : 'en'
        };
    }
    getOS() {
        if (typeof navigator === 'undefined')
            return 'unknown';
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('win'))
            return 'Windows';
        if (platform.includes('mac'))
            return 'macOS';
        if (platform.includes('linux'))
            return 'Linux';
        return 'unknown';
    }
    getBrowser() {
        if (typeof navigator === 'undefined')
            return 'unknown';
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('chrome'))
            return 'Chrome';
        if (userAgent.includes('firefox'))
            return 'Firefox';
        if (userAgent.includes('safari'))
            return 'Safari';
        if (userAgent.includes('edge'))
            return 'Edge';
        return 'unknown';
    }
    getSessionId() {
        // Get or generate session ID
        if (typeof sessionStorage !== 'undefined') {
            let sessionId = sessionStorage.getItem('flowdesk_session_id');
            if (!sessionId) {
                sessionId = this.generateId();
                sessionStorage.setItem('flowdesk_session_id', sessionId);
            }
            return sessionId;
        }
        return this.generateId();
    }
    getBreadcrumbs() {
        // Get breadcrumbs from error handler if available
        return [];
    }
    async getPerformanceMetrics() {
        if (typeof performance !== 'undefined') {
            const navigation = performance.getEntriesByType('navigation')[0];
            return {
                loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
                memoryUsage: performance.memory?.usedJSHeapSize || 0,
                cpuUsage: 0, // Would need additional monitoring
                networkLatency: 0 // Would need additional monitoring
            };
        }
        return {
            loadTime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            networkLatency: 0
        };
    }
    async generateThumbnail(imageData) {
        // Generate thumbnail from image data
        // This is a placeholder - in practice, you'd use a proper image processing library
        return imageData;
    }
    storeRecording(blob) {
        // Store recording for later attachment to feedback
        // This would typically be stored temporarily
        console.log('Screen recording stored:', blob.size, 'bytes');
    }
    async loadAnalytics() {
        // Load or calculate analytics
        this.analytics = {
            totalSubmissions: this.submissions.size,
            averageRating: 0,
            sentimentDistribution: {},
            topIssues: [],
            responseTime: 0,
            resolutionTime: 0,
            satisfactionScore: 0,
            trends: []
        };
    }
    async updateAnalytics(submission) {
        if (!this.analytics)
            return;
        this.analytics.totalSubmissions++;
        // Update other analytics...
    }
    async saveForms() {
        // Save forms to storage
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('feedback_forms', JSON.stringify(Array.from(this.forms.values())));
        }
    }
    async saveSubmissions() {
        // Save submissions to storage
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('feedback_submissions', JSON.stringify(Array.from(this.submissions.values())));
        }
    }
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.FeedbackSystem = FeedbackSystem;
FeedbackSystem.instance = null;
// Helper functions
const getFeedbackSystem = () => {
    return FeedbackSystem.getInstance();
};
exports.getFeedbackSystem = getFeedbackSystem;
const showFeedbackForm = (formId) => {
    const system = FeedbackSystem.getInstance();
    const event = new CustomEvent('flowdesk:show-feedback', {
        detail: { formId: formId || 'general_feedback' }
    });
    window.dispatchEvent(event);
};
exports.showFeedbackForm = showFeedbackForm;
//# sourceMappingURL=feedback-system.js.map