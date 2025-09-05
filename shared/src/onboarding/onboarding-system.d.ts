/**
 * User Onboarding and Tutorial System
 * Comprehensive system for user onboarding, feature tutorials, and progressive disclosure
 */
export interface OnboardingConfig {
    enableOnboarding: boolean;
    enableTutorials: boolean;
    enableTooltips: boolean;
    progressTracking: boolean;
    personalizedFlow: boolean;
    skipAllowed: boolean;
    analytics: boolean;
    multiLanguage: boolean;
    defaultLanguage: string;
}
export interface OnboardingFlow {
    id: string;
    name: string;
    description: string;
    version: string;
    targetUsers: UserTargeting;
    steps: OnboardingStep[];
    prerequisites: string[];
    estimatedDuration: number;
    priority: 'low' | 'normal' | 'high' | 'critical';
    enabled: boolean;
    analytics: FlowAnalytics;
}
export interface UserTargeting {
    userTypes: string[];
    platforms: string[];
    features: string[];
    excludeIf: TargetingCondition[];
    includeIf: TargetingCondition[];
}
export interface TargetingCondition {
    type: 'feature_used' | 'time_since_signup' | 'workspace_count' | 'user_role' | 'custom';
    operator: 'equals' | 'greater' | 'less' | 'contains' | 'not_contains';
    value: any;
}
export interface OnboardingStep {
    id: string;
    type: StepType;
    title: string;
    description: string;
    content: StepContent;
    actions: StepAction[];
    validation: StepValidation;
    navigation: StepNavigation;
    timing: StepTiming;
    accessibility: AccessibilityOptions;
    personalization: PersonalizationOptions;
}
export type StepType = 'welcome' | 'tutorial' | 'form' | 'demo' | 'interactive' | 'video' | 'tooltip' | 'modal' | 'overlay' | 'spotlight' | 'checklist';
export interface StepContent {
    text?: string;
    html?: string;
    videoUrl?: string;
    imageUrl?: string;
    component?: string;
    interactive?: InteractiveElement[];
    forms?: FormField[];
    checklist?: ChecklistItem[];
}
export interface InteractiveElement {
    type: 'button' | 'input' | 'dropdown' | 'checkbox' | 'slider';
    selector: string;
    action: 'click' | 'type' | 'select' | 'check';
    value?: any;
    required: boolean;
    highlight: boolean;
    tooltip?: string;
}
export interface FormField {
    id: string;
    type: 'text' | 'email' | 'select' | 'checkbox' | 'radio';
    label: string;
    placeholder?: string;
    required: boolean;
    options?: string[];
    validation?: FormValidation;
}
export interface FormValidation {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    custom?: (value: any) => boolean | string;
}
export interface ChecklistItem {
    id: string;
    text: string;
    completed: boolean;
    optional: boolean;
    action?: string;
    link?: string;
}
export interface StepAction {
    id: string;
    type: 'next' | 'previous' | 'skip' | 'finish' | 'custom';
    label: string;
    style: 'primary' | 'secondary' | 'danger' | 'link';
    condition?: ActionCondition;
    handler?: Function;
}
export interface ActionCondition {
    type: 'form_valid' | 'interaction_complete' | 'time_elapsed' | 'custom';
    value?: any;
}
export interface StepValidation {
    required: boolean;
    validator?: (stepData: any) => boolean | string;
    blocksProgress: boolean;
}
export interface StepNavigation {
    allowBack: boolean;
    allowSkip: boolean;
    allowClose: boolean;
    autoAdvance: boolean;
    autoAdvanceDelay?: number;
}
export interface StepTiming {
    showDelay?: number;
    hideDelay?: number;
    maxDuration?: number;
}
export interface AccessibilityOptions {
    screenReader: boolean;
    keyboardNavigation: boolean;
    highContrast: boolean;
    fontSize: 'normal' | 'large' | 'xlarge';
    reducedMotion: boolean;
}
export interface PersonalizationOptions {
    adaptToUserBehavior: boolean;
    skipIfCompleted: boolean;
    customizeContent: boolean;
    rememberPreferences: boolean;
}
export interface OnboardingProgress {
    userId: string;
    flowId: string;
    currentStepId: string;
    completedSteps: string[];
    skippedSteps: string[];
    startedAt: number;
    lastUpdated: number;
    completedAt?: number;
    status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
    data: Record<string, any>;
}
export interface FlowAnalytics {
    totalStarted: number;
    totalCompleted: number;
    totalAbandoned: number;
    averageDuration: number;
    completionRate: number;
    dropoffPoints: DropoffPoint[];
    stepAnalytics: Record<string, StepAnalytics>;
}
export interface DropoffPoint {
    stepId: string;
    dropoffRate: number;
    commonReasons: string[];
}
export interface StepAnalytics {
    views: number;
    completions: number;
    skips: number;
    averageTime: number;
    interactionRate: number;
}
export interface Tutorial {
    id: string;
    name: string;
    description: string;
    category: string;
    feature: string;
    trigger: TutorialTrigger;
    steps: TutorialStep[];
    priority: number;
    enabled: boolean;
}
export interface TutorialTrigger {
    type: 'manual' | 'feature_first_use' | 'user_struggle' | 'new_feature' | 'time_based';
    condition?: TriggerCondition;
    cooldown?: number;
    maxShows?: number;
}
export interface TriggerCondition {
    event?: string;
    url?: string;
    element?: string;
    userProperty?: string;
    customCheck?: Function;
}
export interface TutorialStep {
    id: string;
    element: string;
    title: string;
    description: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    showArrow: boolean;
    highlightElement: boolean;
    allowClose: boolean;
    actions: TutorialAction[];
}
export interface TutorialAction {
    label: string;
    type: 'next' | 'previous' | 'finish' | 'custom';
    handler?: Function;
}
export declare class OnboardingSystem {
    private static instance;
    private config;
    private flows;
    private tutorials;
    private userProgress;
    private activeFlow;
    private activeTutorial;
    private currentUser;
    private analytics;
    constructor(config: OnboardingConfig);
    static getInstance(config?: OnboardingConfig): OnboardingSystem;
    /**
     * Initialize onboarding system
     */
    initialize(userId: string): Promise<void>;
    /**
     * Start onboarding flow
     */
    startFlow(flowId: string, userId?: string): Promise<OnboardingProgress>;
    /**
     * Advance to next step
     */
    nextStep(stepData?: any): Promise<void>;
    /**
     * Go to previous step
     */
    previousStep(): Promise<void>;
    /**
     * Skip current step
     */
    skipStep(): Promise<void>;
    /**
     * Complete onboarding flow
     */
    completeFlow(): Promise<void>;
    /**
     * Abandon onboarding flow
     */
    abandonFlow(reason?: string): Promise<void>;
    /**
     * Start tutorial
     */
    startTutorial(tutorialId: string): Promise<void>;
    /**
     * Check for tutorial triggers
     */
    checkTutorialTriggers(event: string, data?: any): Promise<void>;
    /**
     * Get user progress for all flows
     */
    getUserProgressAll(userId: string): OnboardingProgress[];
    /**
     * Get user progress for specific flow
     */
    getUserProgress(userId: string, flowId: string): OnboardingProgress | null;
    /**
     * Get onboarding analytics
     */
    getAnalytics(flowId?: string): FlowAnalytics | Map<string, FlowAnalytics>;
    /**
     * Create custom onboarding flow
     */
    createFlow(flow: Omit<OnboardingFlow, 'analytics'>): Promise<string>;
    /**
     * Create custom tutorial
     */
    createTutorial(tutorial: Tutorial): Promise<string>;
    private loadDefaultFlows;
    private loadDefaultTutorials;
    private isUserEligible;
    private shouldTriggerTutorial;
    private showStep;
    private showTutorial;
    private setUserProgress;
    private loadUserProgress;
    private saveUserProgress;
    private updateFlowAnalytics;
    private updateStepAnalytics;
    private createEmptyAnalytics;
    private setupEventListeners;
    private checkOnboardingTriggers;
    private emitEvent;
    private generateId;
    /**
     * Cleanup resources
     */
    dispose(): void;
}
export declare const createOnboardingSystem: (config: OnboardingConfig) => OnboardingSystem;
export declare const getOnboardingSystem: () => OnboardingSystem;
export declare const startOnboarding: (flowId: string, userId?: string) => Promise<OnboardingProgress>;
export declare const startTutorial: (tutorialId: string) => Promise<void>;
//# sourceMappingURL=onboarding-system.d.ts.map