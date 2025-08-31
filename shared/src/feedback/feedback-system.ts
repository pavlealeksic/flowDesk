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
  options?: string[]; // For select/radio fields
  defaultValue?: any;
  conditional?: FieldCondition; // Show field based on other field values
}

export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'email' 
  | 'select' 
  | 'radio' 
  | 'checkbox' 
  | 'rating' 
  | 'file' 
  | 'screenshot' 
  | 'video'
  | 'slider'
  | 'date';

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  fileTypes?: string[];
  maxFileSize?: number; // bytes
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
  delay?: number; // ms
  maxOccurrences?: number;
  cooldown?: number; // ms between triggers
}

export type TriggerType = 
  | 'error_occurred' 
  | 'feature_used' 
  | 'time_spent' 
  | 'page_visit' 
  | 'user_action' 
  | 'performance_issue'
  | 'inactivity'
  | 'exit_intent'
  | 'milestone_reached';

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
  showToUsers: string[]; // User roles or IDs
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
  viewport: { width: number; height: number };
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
  screenRecording?: string; // base64 encoded
}

export interface PerformanceMetrics {
  loadTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}

export interface SentimentAnalysis {
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  emotions: Record<string, number>;
  keywords: string[];
  intent: 'complaint' | 'suggestion' | 'compliment' | 'question' | 'bug_report';
}

export type FeedbackStatus = 
  | 'new' 
  | 'in_review' 
  | 'in_progress' 
  | 'waiting_user' 
  | 'resolved' 
  | 'closed' 
  | 'spam';

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
  responseTime: number; // average response time in hours
  resolutionTime: number; // average resolution time in hours
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
  period: string; // 'day', 'week', 'month'
  submissions: number;
  averageRating: number;
  sentiment: number;
}

export class FeedbackSystem {
  private static instance: FeedbackSystem | null = null;
  private forms: Map<string, FeedbackForm> = new Map();
  private submissions: Map<string, SubmittedFeedback> = new Map();
  private triggers: Map<string, { lastTriggered: number; count: number }> = new Map();
  private analytics: FeedbackAnalytics | null = null;
  private screenRecorder: MediaRecorder | null = null;
  private isRecording: boolean = false;

  static getInstance(): FeedbackSystem {
    if (!FeedbackSystem.instance) {
      FeedbackSystem.instance = new FeedbackSystem();
    }
    return FeedbackSystem.instance;
  }

  /**
   * Initialize feedback system
   */
  async initialize(): Promise<void> {
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
  async createForm(form: Omit<FeedbackForm, 'id'>): Promise<string> {
    const formId = this.generateId();
    const fullForm: FeedbackForm = {
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
  getForm(formId: string): FeedbackForm | null {
    return this.forms.get(formId) || null;
  }

  /**
   * Get all forms visible to user
   */
  getVisibleForms(userId: string, workspaceId: string, platform: string): FeedbackForm[] {
    return Array.from(this.forms.values()).filter(form => 
      this.isFormVisible(form, userId, workspaceId, platform)
    );
  }

  /**
   * Submit feedback
   */
  async submitFeedback(
    formId: string,
    responses: Record<string, any>,
    attachments: FeedbackAttachment[] = [],
    metadata?: Partial<FeedbackMetadata>
  ): Promise<string> {
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
    const submission: SubmittedFeedback = {
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
      } as FeedbackMetadata,
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
  async triggerFeedback(event: string, data?: any): Promise<string | null> {
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
  async startScreenRecording(): Promise<void> {
    if (this.isRecording || typeof navigator === 'undefined') {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' },
        audio: false
      });

      this.screenRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      const recordedChunks: Blob[] = [];

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

    } catch (error) {
      console.error('Failed to start screen recording:', error);
    }
  }

  /**
   * Stop screen recording
   */
  stopScreenRecording(): void {
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
  async takeScreenshot(): Promise<FeedbackAttachment | null> {
    if (typeof html2canvas === 'undefined') {
      console.warn('html2canvas not available for screenshots');
      return null;
    }

    try {
      const canvas = await (window as any).html2canvas(document.body, {
        height: window.innerHeight,
        width: window.innerWidth,
        useCORS: true
      });

      return new Promise((resolve) => {
        canvas.toBlob((blob: Blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => {
              const attachment: FeedbackAttachment = {
                id: this.generateId(),
                type: 'image',
                name: `screenshot_${Date.now()}.png`,
                size: blob.size,
                mimeType: 'image/png',
                data: new Uint8Array(reader.result as ArrayBuffer)
              };
              resolve(attachment);
            };
            reader.readAsArrayBuffer(blob);
          } else {
            resolve(null);
          }
        }, 'image/png', 0.8);
      });

    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return null;
    }
  }

  /**
   * Get feedback analytics
   */
  getAnalytics(): FeedbackAnalytics | null {
    return this.analytics;
  }

  /**
   * Get submission by ID
   */
  getSubmission(submissionId: string): SubmittedFeedback | null {
    return this.submissions.get(submissionId) || null;
  }

  /**
   * Update submission status
   */
  async updateSubmissionStatus(submissionId: string, status: FeedbackStatus, note?: string): Promise<void> {
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

  private async loadDefaultForms(): Promise<void> {
    // General feedback form
    const generalForm: FeedbackForm = {
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

  private setupTriggerListeners(): void {
    if (typeof window !== 'undefined') {
      // Listen for error events
      window.addEventListener('flowdesk:error-notification', (event: any) => {
        this.triggerFeedback('error_occurred', {
          errorType: event.detail.errorReport.level === 'error' ? 'user_facing' : 'background'
        });
      });

      // Listen for feature usage events
      window.addEventListener('flowdesk:feature-used', (event: any) => {
        this.triggerFeedback('feature_used', event.detail);
      });
    }
  }

  private shouldTrigger(trigger: FeedbackTrigger, event: string, data?: any): boolean {
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

  private isFormVisible(form: FeedbackForm, userId: string, workspaceId: string, platform: string): boolean {
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

  private validateResponses(form: FeedbackForm, responses: Record<string, any>): string[] {
    const errors: string[] = [];
    
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

  private evaluateCondition(condition: FieldCondition, responses: Record<string, any>): boolean {
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

  private async processSubmission(submission: SubmittedFeedback): Promise<void> {
    // Process attachments
    for (const attachment of submission.attachments) {
      if (attachment.type === 'image') {
        // Generate thumbnail for images
        attachment.thumbnail = await this.generateThumbnail(attachment.data);
      }
    }
    
    await this.saveSubmissions();
  }

  private async routeFeedback(submission: SubmittedFeedback): Promise<void> {
    const form = this.getForm(submission.formId);
    if (!form) return;
    
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

  private matchesEscalationRule(submission: SubmittedFeedback, rule: EscalationRule): boolean {
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

  private shouldNotifyIntegration(submission: SubmittedFeedback, integration: FeedbackIntegration): boolean {
    if (integration.conditions?.severity && !integration.conditions.severity.includes(submission.priority)) {
      return false;
    }
    
    return true;
  }

  private async sendIntegrationNotification(submission: SubmittedFeedback, integration: FeedbackIntegration): Promise<void> {
    // Implementation would depend on the integration type
    console.log(`Sending notification to ${integration.type}:`, submission.id);
  }

  private async analyzeSentiment(responses: Record<string, any>): Promise<SentimentAnalysis> {
    // Simple sentiment analysis - in production, use a proper NLP service
    const text = Object.values(responses).join(' ').toLowerCase();
    
    const positiveWords = ['good', 'great', 'excellent', 'love', 'amazing', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'broken', 'useless'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (text.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (text.includes(word)) negativeCount++;
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

  private generateTags(responses: Record<string, any>, form: FeedbackForm): string[] {
    const tags: string[] = [];
    
    // Add form-based tags
    tags.push(`form:${form.id}`);
    
    // Add response-based tags
    if (responses.type) {
      tags.push(`type:${responses.type.toLowerCase().replace(' ', '_')}`);
    }
    
    return tags;
  }

  private calculatePriority(responses: Record<string, any>, form: FeedbackForm): 'low' | 'medium' | 'high' | 'critical' {
    // Simple priority calculation based on responses
    if (responses.type === 'Bug Report' && responses.rating && responses.rating <= 2) {
      return 'high';
    }
    
    if (responses.type === 'Feature Request') {
      return 'medium';
    }
    
    return 'low';
  }

  private emitFeedbackTrigger(formId: string, delay?: number): void {
    const showForm = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flowdesk:show-feedback', {
          detail: { formId }
        }));
      }
    };
    
    if (delay) {
      setTimeout(showForm, delay);
    } else {
      showForm();
    }
  }

  private async getDeviceInfo(): Promise<DeviceInfo> {
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

  private getOS(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'Windows';
    if (platform.includes('mac')) return 'macOS';
    if (platform.includes('linux')) return 'Linux';
    return 'unknown';
  }

  private getBrowser(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome')) return 'Chrome';
    if (userAgent.includes('firefox')) return 'Firefox';
    if (userAgent.includes('safari')) return 'Safari';
    if (userAgent.includes('edge')) return 'Edge';
    return 'unknown';
  }

  private getSessionId(): string {
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

  private getBreadcrumbs(): any[] {
    // Get breadcrumbs from error handler if available
    return [];
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    if (typeof performance !== 'undefined') {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
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

  private async generateThumbnail(imageData: Uint8Array): Promise<Uint8Array> {
    // Generate thumbnail from image data
    // This is a placeholder - in practice, you'd use a proper image processing library
    return imageData;
  }

  private storeRecording(blob: Blob): void {
    // Store recording for later attachment to feedback
    // This would typically be stored temporarily
    console.log('Screen recording stored:', blob.size, 'bytes');
  }

  private async loadAnalytics(): Promise<void> {
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

  private async updateAnalytics(submission: SubmittedFeedback): Promise<void> {
    if (!this.analytics) return;
    
    this.analytics.totalSubmissions++;
    // Update other analytics...
  }

  private async saveForms(): Promise<void> {
    // Save forms to storage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('feedback_forms', JSON.stringify(Array.from(this.forms.values())));
    }
  }

  private async saveSubmissions(): Promise<void> {
    // Save submissions to storage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('feedback_submissions', JSON.stringify(Array.from(this.submissions.values())));
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions
export const getFeedbackSystem = () => {
  return FeedbackSystem.getInstance();
};

export const showFeedbackForm = (formId?: string) => {
  const system = FeedbackSystem.getInstance();
  const event = new CustomEvent('flowdesk:show-feedback', {
    detail: { formId: formId || 'general_feedback' }
  });
  window.dispatchEvent(event);
};