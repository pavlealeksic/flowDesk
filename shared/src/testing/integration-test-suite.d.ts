/**
 * End-to-End Integration Test Suite
 * Comprehensive testing framework for Flow Desk across all platforms and features
 */
export interface TestConfig {
    platform: 'desktop' | 'mobile' | 'web';
    environment: 'development' | 'staging' | 'production';
    timeout: number;
    retries: number;
    parallel: boolean;
    headless: boolean;
    recordVideo: boolean;
    takeScreenshots: boolean;
    generateReport: boolean;
    coverage: boolean;
    endpoints: {
        api: string;
        websocket: string;
        auth: string;
    };
    credentials: {
        testUser: {
            username: string;
            password: string;
        };
        adminUser: {
            username: string;
            password: string;
        };
    };
}
export interface TestCase {
    id: string;
    name: string;
    description: string;
    category: TestCategory;
    priority: 'low' | 'medium' | 'high' | 'critical';
    platforms: string[];
    tags: string[];
    prerequisites: string[];
    timeout?: number;
    retries?: number;
    setup?: () => Promise<void>;
    teardown?: () => Promise<void>;
    test: (context: TestContext) => Promise<void>;
    assertions: TestAssertion[];
}
export type TestCategory = 'authentication' | 'workspace' | 'mail' | 'calendar' | 'notifications' | 'plugins' | 'sync' | 'performance' | 'security' | 'onboarding' | 'ui' | 'api';
export interface TestContext {
    browser?: any;
    device?: any;
    app?: any;
    api: ApiClient;
    storage: StorageClient;
    user: TestUser;
    workspace: TestWorkspace;
    screenshots: ScreenshotManager;
    logger: TestLogger;
    metrics: MetricsCollector;
}
export interface TestAssertion {
    type: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
    actual: any;
    expected: any;
    message?: string;
}
export interface TestUser {
    id: string;
    username: string;
    email: string;
    password: string;
    role: 'user' | 'admin';
    session?: string;
    tokens?: any;
}
export interface TestWorkspace {
    id: string;
    name: string;
    type: string;
    settings: any;
}
export interface TestSuite {
    id: string;
    name: string;
    description: string;
    testCases: TestCase[];
    setup?: () => Promise<void>;
    teardown?: () => Promise<void>;
}
export interface TestResult {
    testId: string;
    name: string;
    status: 'passed' | 'failed' | 'skipped' | 'error';
    duration: number;
    error?: string;
    screenshots: string[];
    logs: TestLog[];
    metrics: TestMetrics;
    assertions: AssertionResult[];
}
export interface AssertionResult {
    passed: boolean;
    message: string;
    actual: any;
    expected: any;
}
export interface TestLog {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: number;
    data?: any;
}
export interface TestMetrics {
    memoryUsage: number;
    cpuUsage: number;
    networkRequests: number;
    pageLoadTime: number;
    responseTime: number;
    errors: number;
}
export interface TestReport {
    id: string;
    timestamp: number;
    config: TestConfig;
    summary: {
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        duration: number;
    };
    results: TestResult[];
    coverage?: CoverageReport;
}
export interface CoverageReport {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
    files: Record<string, FileCoverage>;
}
export interface FileCoverage {
    path: string;
    statements: number;
    branches: number;
    functions: number;
    lines: number;
}
export declare class IntegrationTestSuite {
    private static instance;
    private config;
    private testSuites;
    private results;
    private currentContext;
    constructor(config: TestConfig);
    static getInstance(config?: TestConfig): IntegrationTestSuite;
    /**
     * Initialize test suite with default test cases
     */
    initialize(): Promise<void>;
    /**
     * Run all test suites
     */
    runAll(): Promise<TestReport>;
    /**
     * Run specific test suite
     */
    runTestSuite(testSuite: TestSuite): Promise<TestResult[]>;
    /**
     * Run individual test case
     */
    runTestCase(testCase: TestCase): Promise<TestResult>;
    /**
     * Add custom test case
     */
    addTestCase(suiteId: string, testCase: TestCase): void;
    /**
     * Add custom test suite
     */
    addTestSuite(testSuite: TestSuite): void;
    /**
     * Get test results
     */
    getResults(): TestResult[];
    private loadDefaultTestSuites;
    private createTestContext;
    private createDesktopApp;
    private createMobileDevice;
    private createBrowser;
    private cleanupTestContext;
    private validateAssertion;
    private createTimeoutPromise;
    private sleep;
    private createEmptyMetrics;
    private generateReport;
    private saveReport;
}
declare class ApiClient {
    private baseUrl;
    constructor(baseUrl: string);
    get(endpoint: string): Promise<any>;
    post(endpoint: string, data: any): Promise<any>;
}
declare class StorageClient {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    clear(): Promise<void>;
}
declare class ScreenshotManager {
    private testId;
    private screenshots;
    constructor(testId: string);
    capture(name?: string): Promise<string[]>;
}
declare class TestLogger {
    private testId;
    private logs;
    constructor(testId: string);
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, data?: any): void;
    private log;
    getLogs(): TestLog[];
}
declare class MetricsCollector {
    private metrics;
    record(name: string, value: number): void;
    get(name: string): number | undefined;
    collect(): Promise<TestMetrics>;
}
export declare const createIntegrationTestSuite: (config: TestConfig) => IntegrationTestSuite;
export declare const getIntegrationTestSuite: () => IntegrationTestSuite;
export declare const runTests: (suiteIds?: string[]) => Promise<TestReport | TestResult[]>;
export {};
//# sourceMappingURL=integration-test-suite.d.ts.map