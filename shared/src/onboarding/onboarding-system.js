"use strict";
/**
 * User Onboarding and Tutorial System
 * Comprehensive system for user onboarding, feature tutorials, and progressive disclosure
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTutorial = exports.startOnboarding = exports.getOnboardingSystem = exports.createOnboardingSystem = exports.OnboardingSystem = void 0;
class OnboardingSystem {
    constructor(config) {
        this.flows = new Map();
        this.tutorials = new Map();
        this.userProgress = new Map();
        this.activeFlow = null;
        this.activeTutorial = null;
        this.currentUser = null;
        this.analytics = new Map();
        this.config = config;
    }
    static getInstance(config) {
        if (!OnboardingSystem.instance && config) {
            OnboardingSystem.instance = new OnboardingSystem(config);
        }
        else if (!OnboardingSystem.instance) {
            throw new Error('OnboardingSystem must be initialized with config first');
        }
        return OnboardingSystem.instance;
    }
    /**
     * Initialize onboarding system
     */
    async initialize(userId) {
        this.currentUser = userId;
        // Load default flows and tutorials
        await this.loadDefaultFlows();
        await this.loadDefaultTutorials();
        // Load user progress
        await this.loadUserProgress(userId);
        // Set up event listeners
        this.setupEventListeners();
        // Check for onboarding triggers
        await this.checkOnboardingTriggers();
        console.log('OnboardingSystem initialized for user:', userId);
    }
    /**
     * Start onboarding flow
     */
    async startFlow(flowId, userId) {
        const user = userId || this.currentUser;
        if (!user) {
            throw new Error('User ID is required');
        }
        const flow = this.flows.get(flowId);
        if (!flow) {
            throw new Error(`Onboarding flow not found: ${flowId}`);
        }
        // Check if user is eligible for this flow
        if (!this.isUserEligible(user, flow.targetUsers)) {
            throw new Error('User not eligible for this onboarding flow');
        }
        // Check if flow is already in progress
        const existingProgress = this.getUserProgress(user, flowId);
        if (existingProgress && existingProgress.status === 'in_progress') {
            this.activeFlow = existingProgress;
            return existingProgress;
        }
        // Create new progress
        const progress = {
            userId: user,
            flowId,
            currentStepId: flow.steps[0].id,
            completedSteps: [],
            skippedSteps: [],
            startedAt: Date.now(),
            lastUpdated: Date.now(),
            status: 'in_progress',
            data: {}
        };
        // Store progress
        this.setUserProgress(user, progress);
        this.activeFlow = progress;
        // Update analytics
        this.updateFlowAnalytics(flowId, 'started');
        // Show first step
        await this.showStep(flow.steps[0]);
        return progress;
    }
    /**
     * Advance to next step
     */
    async nextStep(stepData) {
        if (!this.activeFlow) {
            throw new Error('No active onboarding flow');
        }
        const flow = this.flows.get(this.activeFlow.flowId);
        if (!flow) {
            throw new Error('Onboarding flow not found');
        }
        const currentStepIndex = flow.steps.findIndex(step => step.id === this.activeFlow.currentStepId);
        if (currentStepIndex === -1) {
            throw new Error('Current step not found');
        }
        const currentStep = flow.steps[currentStepIndex];
        // Validate step if required
        if (currentStep.validation.required && currentStep.validation.validator) {
            const validationResult = currentStep.validation.validator(stepData);
            if (validationResult !== true) {
                throw new Error(typeof validationResult === 'string' ? validationResult : 'Step validation failed');
            }
        }
        // Mark current step as completed
        this.activeFlow.completedSteps.push(this.activeFlow.currentStepId);
        this.activeFlow.data = { ...this.activeFlow.data, ...stepData };
        this.activeFlow.lastUpdated = Date.now();
        // Update step analytics
        this.updateStepAnalytics(this.activeFlow.flowId, this.activeFlow.currentStepId, 'completed');
        // Check if this is the last step
        if (currentStepIndex === flow.steps.length - 1) {
            await this.completeFlow();
            return;
        }
        // Move to next step
        const nextStep = flow.steps[currentStepIndex + 1];
        this.activeFlow.currentStepId = nextStep.id;
        // Save progress
        this.setUserProgress(this.activeFlow.userId, this.activeFlow);
        // Show next step
        await this.showStep(nextStep);
    }
    /**
     * Go to previous step
     */
    async previousStep() {
        if (!this.activeFlow) {
            throw new Error('No active onboarding flow');
        }
        const flow = this.flows.get(this.activeFlow.flowId);
        if (!flow) {
            throw new Error('Onboarding flow not found');
        }
        const currentStepIndex = flow.steps.findIndex(step => step.id === this.activeFlow.currentStepId);
        if (currentStepIndex <= 0) {
            throw new Error('Already at first step');
        }
        const previousStep = flow.steps[currentStepIndex - 1];
        // Remove previous step from completed if it was completed
        const completedIndex = this.activeFlow.completedSteps.indexOf(previousStep.id);
        if (completedIndex > -1) {
            this.activeFlow.completedSteps.splice(completedIndex, 1);
        }
        this.activeFlow.currentStepId = previousStep.id;
        this.activeFlow.lastUpdated = Date.now();
        // Save progress
        this.setUserProgress(this.activeFlow.userId, this.activeFlow);
        // Show previous step
        await this.showStep(previousStep);
    }
    /**
     * Skip current step
     */
    async skipStep() {
        if (!this.activeFlow) {
            throw new Error('No active onboarding flow');
        }
        const flow = this.flows.get(this.activeFlow.flowId);
        if (!flow) {
            throw new Error('Onboarding flow not found');
        }
        const currentStepIndex = flow.steps.findIndex(step => step.id === this.activeFlow.currentStepId);
        const currentStep = flow.steps[currentStepIndex];
        if (!currentStep.navigation.allowSkip) {
            throw new Error('Current step cannot be skipped');
        }
        // Mark step as skipped
        this.activeFlow.skippedSteps.push(this.activeFlow.currentStepId);
        this.activeFlow.lastUpdated = Date.now();
        // Update step analytics
        this.updateStepAnalytics(this.activeFlow.flowId, this.activeFlow.currentStepId, 'skipped');
        // Check if this is the last step
        if (currentStepIndex === flow.steps.length - 1) {
            await this.completeFlow();
            return;
        }
        // Move to next step
        const nextStep = flow.steps[currentStepIndex + 1];
        this.activeFlow.currentStepId = nextStep.id;
        // Save progress
        this.setUserProgress(this.activeFlow.userId, this.activeFlow);
        // Show next step
        await this.showStep(nextStep);
    }
    /**
     * Complete onboarding flow
     */
    async completeFlow() {
        if (!this.activeFlow) {
            throw new Error('No active onboarding flow');
        }
        this.activeFlow.status = 'completed';
        this.activeFlow.completedAt = Date.now();
        this.activeFlow.lastUpdated = Date.now();
        // Save progress
        this.setUserProgress(this.activeFlow.userId, this.activeFlow);
        // Update analytics
        this.updateFlowAnalytics(this.activeFlow.flowId, 'completed');
        // Emit completion event
        this.emitEvent('onboarding:flow:completed', {
            flowId: this.activeFlow.flowId,
            userId: this.activeFlow.userId,
            duration: this.activeFlow.completedAt - this.activeFlow.startedAt
        });
        this.activeFlow = null;
    }
    /**
     * Abandon onboarding flow
     */
    async abandonFlow(reason) {
        if (!this.activeFlow) {
            return;
        }
        this.activeFlow.status = 'abandoned';
        this.activeFlow.lastUpdated = Date.now();
        // Save progress
        this.setUserProgress(this.activeFlow.userId, this.activeFlow);
        // Update analytics
        this.updateFlowAnalytics(this.activeFlow.flowId, 'abandoned');
        // Emit abandonment event
        this.emitEvent('onboarding:flow:abandoned', {
            flowId: this.activeFlow.flowId,
            userId: this.activeFlow.userId,
            currentStep: this.activeFlow.currentStepId,
            reason
        });
        this.activeFlow = null;
    }
    /**
     * Start tutorial
     */
    async startTutorial(tutorialId) {
        const tutorial = this.tutorials.get(tutorialId);
        if (!tutorial) {
            throw new Error(`Tutorial not found: ${tutorialId}`);
        }
        if (!tutorial.enabled) {
            return;
        }
        this.activeTutorial = tutorial;
        // Show tutorial
        await this.showTutorial(tutorial);
        // Emit event
        this.emitEvent('onboarding:tutorial:started', {
            tutorialId,
            userId: this.currentUser
        });
    }
    /**
     * Check for tutorial triggers
     */
    async checkTutorialTriggers(event, data) {
        for (const tutorial of this.tutorials.values()) {
            if (this.shouldTriggerTutorial(tutorial, event, data)) {
                await this.startTutorial(tutorial.id);
                break; // Only show one tutorial at a time
            }
        }
    }
    /**
     * Get user progress for all flows
     */
    getUserProgressAll(userId) {
        return this.userProgress.get(userId) || [];
    }
    /**
     * Get user progress for specific flow
     */
    getUserProgress(userId, flowId) {
        const userFlows = this.userProgress.get(userId) || [];
        return userFlows.find(p => p.flowId === flowId) || null;
    }
    /**
     * Get onboarding analytics
     */
    getAnalytics(flowId) {
        if (flowId) {
            return this.analytics.get(flowId) || this.createEmptyAnalytics();
        }
        return this.analytics;
    }
    /**
     * Create custom onboarding flow
     */
    async createFlow(flow) {
        const flowWithAnalytics = {
            ...flow,
            analytics: this.createEmptyAnalytics()
        };
        this.flows.set(flow.id, flowWithAnalytics);
        this.analytics.set(flow.id, flowWithAnalytics.analytics);
        return flow.id;
    }
    /**
     * Create custom tutorial
     */
    async createTutorial(tutorial) {
        this.tutorials.set(tutorial.id, tutorial);
        return tutorial.id;
    }
    // Private methods
    async loadDefaultFlows() {
        // Welcome flow for new users
        const welcomeFlow = {
            id: 'welcome_flow',
            name: 'Welcome to Flow Desk',
            description: 'Get started with Flow Desk basics',
            version: '1.0.0',
            targetUsers: {
                userTypes: ['new'],
                platforms: ['desktop', 'mobile'],
                features: [],
                excludeIf: [],
                includeIf: []
            },
            steps: [
                {
                    id: 'welcome',
                    type: 'welcome',
                    title: 'Welcome to Flow Desk!',
                    description: 'Your privacy-first work OS with powerful automation',
                    content: {
                        text: 'Flow Desk helps you manage your work across multiple apps while keeping your data private and secure.',
                        imageUrl: '/images/onboarding/welcome.png'
                    },
                    actions: [
                        {
                            id: 'get_started',
                            type: 'next',
                            label: 'Get Started',
                            style: 'primary'
                        }
                    ],
                    validation: { required: false, blocksProgress: false },
                    navigation: { allowBack: false, allowSkip: true, allowClose: true, autoAdvance: false },
                    timing: {},
                    accessibility: {
                        screenReader: true,
                        keyboardNavigation: true,
                        highContrast: false,
                        fontSize: 'normal',
                        reducedMotion: false
                    },
                    personalization: {
                        adaptToUserBehavior: false,
                        skipIfCompleted: true,
                        customizeContent: false,
                        rememberPreferences: true
                    }
                },
                {
                    id: 'workspace_setup',
                    type: 'form',
                    title: 'Set Up Your First Workspace',
                    description: 'Create a workspace to organize your apps and data',
                    content: {
                        forms: [
                            {
                                id: 'workspace_name',
                                type: 'text',
                                label: 'Workspace Name',
                                placeholder: 'My Work Workspace',
                                required: true,
                                validation: { minLength: 1, maxLength: 50 }
                            },
                            {
                                id: 'workspace_type',
                                type: 'select',
                                label: 'Workspace Type',
                                required: true,
                                options: ['Personal', 'Business', 'Creative', 'Development']
                            }
                        ]
                    },
                    actions: [
                        {
                            id: 'create_workspace',
                            type: 'next',
                            label: 'Create Workspace',
                            style: 'primary',
                            condition: { type: 'form_valid' }
                        }
                    ],
                    validation: { required: true, blocksProgress: true },
                    navigation: { allowBack: true, allowSkip: false, allowClose: false, autoAdvance: false },
                    timing: {},
                    accessibility: {
                        screenReader: true,
                        keyboardNavigation: true,
                        highContrast: false,
                        fontSize: 'normal',
                        reducedMotion: false
                    },
                    personalization: {
                        adaptToUserBehavior: true,
                        skipIfCompleted: false,
                        customizeContent: true,
                        rememberPreferences: true
                    }
                },
                {
                    id: 'connect_accounts',
                    type: 'checklist',
                    title: 'Connect Your Accounts',
                    description: 'Connect your work accounts to get started',
                    content: {
                        checklist: [
                            {
                                id: 'connect_email',
                                text: 'Connect your email account (Gmail, Outlook)',
                                completed: false,
                                optional: false,
                                action: 'connect_email'
                            },
                            {
                                id: 'connect_calendar',
                                text: 'Connect your calendar',
                                completed: false,
                                optional: true,
                                action: 'connect_calendar'
                            },
                            {
                                id: 'connect_slack',
                                text: 'Connect Slack workspace',
                                completed: false,
                                optional: true,
                                action: 'connect_slack'
                            }
                        ]
                    },
                    actions: [
                        {
                            id: 'continue',
                            type: 'next',
                            label: 'Continue',
                            style: 'primary'
                        }
                    ],
                    validation: { required: false, blocksProgress: false },
                    navigation: { allowBack: true, allowSkip: true, allowClose: false, autoAdvance: false },
                    timing: {},
                    accessibility: {
                        screenReader: true,
                        keyboardNavigation: true,
                        highContrast: false,
                        fontSize: 'normal',
                        reducedMotion: false
                    },
                    personalization: {
                        adaptToUserBehavior: true,
                        skipIfCompleted: true,
                        customizeContent: true,
                        rememberPreferences: true
                    }
                }
            ],
            prerequisites: [],
            estimatedDuration: 5,
            priority: 'high',
            enabled: true,
            analytics: this.createEmptyAnalytics()
        };
        this.flows.set(welcomeFlow.id, welcomeFlow);
        this.analytics.set(welcomeFlow.id, welcomeFlow.analytics);
    }
    async loadDefaultTutorials() {
        // Mail tutorial
        const mailTutorial = {
            id: 'mail_basics',
            name: 'Mail Basics',
            description: 'Learn how to manage your email effectively',
            category: 'core_features',
            feature: 'mail',
            trigger: {
                type: 'feature_first_use',
                condition: { event: 'mail_opened' }
            },
            steps: [
                {
                    id: 'compose',
                    element: '[data-testid="compose-button"]',
                    title: 'Compose Email',
                    description: 'Click here to compose a new email',
                    position: 'bottom',
                    showArrow: true,
                    highlightElement: true,
                    allowClose: true,
                    actions: [
                        { label: 'Next', type: 'next' }
                    ]
                },
                {
                    id: 'inbox',
                    element: '[data-testid="inbox"]',
                    title: 'Your Inbox',
                    description: 'All your emails appear here. Click on any email to read it.',
                    position: 'right',
                    showArrow: true,
                    highlightElement: true,
                    allowClose: true,
                    actions: [
                        { label: 'Got it', type: 'finish' }
                    ]
                }
            ],
            priority: 1,
            enabled: true
        };
        this.tutorials.set(mailTutorial.id, mailTutorial);
    }
    isUserEligible(userId, targeting) {
        // Check user type, platform, etc.
        // This would integrate with your user management system
        return true; // Simplified for demo
    }
    shouldTriggerTutorial(tutorial, event, data) {
        const trigger = tutorial.trigger;
        switch (trigger.type) {
            case 'feature_first_use':
                return event === trigger.condition?.event;
            case 'user_struggle':
                // Detect user struggle patterns
                return false;
            case 'manual':
                return false; // Only triggered manually
            default:
                return false;
        }
    }
    async showStep(step) {
        // Emit event for UI to render step
        this.emitEvent('onboarding:step:show', {
            step,
            flowId: this.activeFlow?.flowId,
            progress: this.activeFlow
        });
        // Update step analytics
        if (this.activeFlow) {
            this.updateStepAnalytics(this.activeFlow.flowId, step.id, 'viewed');
        }
        // Auto-advance if configured
        if (step.navigation.autoAdvance && step.navigation.autoAdvanceDelay) {
            setTimeout(() => {
                this.nextStep();
            }, step.navigation.autoAdvanceDelay);
        }
    }
    async showTutorial(tutorial) {
        // Emit event for UI to render tutorial
        this.emitEvent('onboarding:tutorial:show', {
            tutorial,
            userId: this.currentUser
        });
    }
    setUserProgress(userId, progress) {
        const userFlows = this.userProgress.get(userId) || [];
        const existingIndex = userFlows.findIndex(p => p.flowId === progress.flowId);
        if (existingIndex >= 0) {
            userFlows[existingIndex] = progress;
        }
        else {
            userFlows.push(progress);
        }
        this.userProgress.set(userId, userFlows);
        this.saveUserProgress(userId);
    }
    async loadUserProgress(userId) {
        // Load from storage - this would integrate with your data layer
        const stored = localStorage?.getItem(`onboarding_progress_${userId}`);
        if (stored) {
            this.userProgress.set(userId, JSON.parse(stored));
        }
    }
    saveUserProgress(userId) {
        // Save to storage
        const progress = this.userProgress.get(userId);
        if (progress && localStorage) {
            localStorage.setItem(`onboarding_progress_${userId}`, JSON.stringify(progress));
        }
    }
    updateFlowAnalytics(flowId, event) {
        const analytics = this.analytics.get(flowId) || this.createEmptyAnalytics();
        switch (event) {
            case 'started':
                analytics.totalStarted++;
                break;
            case 'completed':
                analytics.totalCompleted++;
                break;
            case 'abandoned':
                analytics.totalAbandoned++;
                break;
        }
        // Recalculate completion rate
        analytics.completionRate = analytics.totalStarted > 0
            ? (analytics.totalCompleted / analytics.totalStarted) * 100
            : 0;
        this.analytics.set(flowId, analytics);
    }
    updateStepAnalytics(flowId, stepId, event) {
        const analytics = this.analytics.get(flowId) || this.createEmptyAnalytics();
        if (!analytics.stepAnalytics[stepId]) {
            analytics.stepAnalytics[stepId] = {
                views: 0,
                completions: 0,
                skips: 0,
                averageTime: 0,
                interactionRate: 0
            };
        }
        const stepAnalytics = analytics.stepAnalytics[stepId];
        switch (event) {
            case 'viewed':
                stepAnalytics.views++;
                break;
            case 'completed':
                stepAnalytics.completions++;
                break;
            case 'skipped':
                stepAnalytics.skips++;
                break;
        }
        // Update interaction rate
        stepAnalytics.interactionRate = stepAnalytics.views > 0
            ? ((stepAnalytics.completions + stepAnalytics.skips) / stepAnalytics.views) * 100
            : 0;
        this.analytics.set(flowId, analytics);
    }
    createEmptyAnalytics() {
        return {
            totalStarted: 0,
            totalCompleted: 0,
            totalAbandoned: 0,
            averageDuration: 0,
            completionRate: 0,
            dropoffPoints: [],
            stepAnalytics: {}
        };
    }
    setupEventListeners() {
        // Set up event listeners for triggers
        if (typeof window !== 'undefined') {
            window.addEventListener('flowdesk:feature-used', (event) => {
                this.checkTutorialTriggers('feature_used', event.detail);
            });
        }
    }
    async checkOnboardingTriggers() {
        if (!this.currentUser)
            return;
        // Check if user needs onboarding
        const userFlows = this.getUserProgressAll(this.currentUser);
        const welcomeFlow = userFlows.find(p => p.flowId === 'welcome_flow');
        if (!welcomeFlow || welcomeFlow.status === 'not_started') {
            // Start welcome flow for new users
            setTimeout(() => {
                this.startFlow('welcome_flow');
            }, 1000);
        }
    }
    emitEvent(eventName, data) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
        }
    }
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Cleanup resources
     */
    dispose() {
        this.flows.clear();
        this.tutorials.clear();
        this.userProgress.clear();
        this.analytics.clear();
        this.activeFlow = null;
        this.activeTutorial = null;
        this.currentUser = null;
    }
}
exports.OnboardingSystem = OnboardingSystem;
OnboardingSystem.instance = null;
// Helper functions
const createOnboardingSystem = (config) => {
    return new OnboardingSystem(config);
};
exports.createOnboardingSystem = createOnboardingSystem;
const getOnboardingSystem = () => {
    return OnboardingSystem.getInstance();
};
exports.getOnboardingSystem = getOnboardingSystem;
const startOnboarding = (flowId, userId) => {
    return OnboardingSystem.getInstance().startFlow(flowId, userId);
};
exports.startOnboarding = startOnboarding;
const startTutorial = (tutorialId) => {
    return OnboardingSystem.getInstance().startTutorial(tutorialId);
};
exports.startTutorial = startTutorial;
//# sourceMappingURL=onboarding-system.js.map