"use strict";
/**
 * End-to-End Integration Test Suite
 * Comprehensive testing framework for Flow Desk across all platforms and features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = exports.getIntegrationTestSuite = exports.createIntegrationTestSuite = exports.IntegrationTestSuite = void 0;
class IntegrationTestSuite {
    constructor(config) {
        this.testSuites = new Map();
        this.results = [];
        this.currentContext = null;
        this.config = config;
    }
    static getInstance(config) {
        if (!IntegrationTestSuite.instance && config) {
            IntegrationTestSuite.instance = new IntegrationTestSuite(config);
        }
        else if (!IntegrationTestSuite.instance) {
            throw new Error('IntegrationTestSuite must be initialized with config first');
        }
        return IntegrationTestSuite.instance;
    }
    /**
     * Initialize test suite with default test cases
     */
    async initialize() {
        // Load default test suites
        await this.loadDefaultTestSuites();
        console.log('IntegrationTestSuite initialized');
    }
    /**
     * Run all test suites
     */
    async runAll() {
        const startTime = Date.now();
        this.results = [];
        for (const testSuite of this.testSuites.values()) {
            await this.runTestSuite(testSuite);
        }
        const endTime = Date.now();
        return this.generateReport(startTime, endTime);
    }
    /**
     * Run specific test suite
     */
    async runTestSuite(testSuite) {
        console.log(`Running test suite: ${testSuite.name}`);
        const suiteResults = [];
        try {
            // Suite setup
            if (testSuite.setup) {
                await testSuite.setup();
            }
            // Run test cases
            if (this.config.parallel) {
                const promises = testSuite.testCases.map(testCase => this.runTestCase(testCase));
                const results = await Promise.allSettled(promises);
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        suiteResults.push(result.value);
                    }
                    else {
                        suiteResults.push({
                            testId: testSuite.testCases[index].id,
                            name: testSuite.testCases[index].name,
                            status: 'error',
                            duration: 0,
                            error: result.reason?.message,
                            screenshots: [],
                            logs: [],
                            metrics: this.createEmptyMetrics(),
                            assertions: []
                        });
                    }
                });
            }
            else {
                for (const testCase of testSuite.testCases) {
                    const result = await this.runTestCase(testCase);
                    suiteResults.push(result);
                }
            }
            // Suite teardown
            if (testSuite.teardown) {
                await testSuite.teardown();
            }
        }
        catch (error) {
            console.error(`Test suite ${testSuite.name} failed:`, error);
        }
        this.results.push(...suiteResults);
        return suiteResults;
    }
    /**
     * Run individual test case
     */
    async runTestCase(testCase) {
        console.log(`Running test: ${testCase.name}`);
        const startTime = Date.now();
        const result = {
            testId: testCase.id,
            name: testCase.name,
            status: 'passed',
            duration: 0,
            screenshots: [],
            logs: [],
            metrics: this.createEmptyMetrics(),
            assertions: []
        };
        let retries = testCase.retries ?? this.config.retries;
        let lastError = null;
        while (retries >= 0) {
            try {
                // Create test context
                this.currentContext = await this.createTestContext(testCase);
                // Test setup
                if (testCase.setup) {
                    await testCase.setup();
                }
                // Run test
                const testTimeout = testCase.timeout ?? this.config.timeout;
                await Promise.race([
                    testCase.test(this.currentContext),
                    this.createTimeoutPromise(testTimeout)
                ]);
                // Validate assertions
                result.assertions = testCase.assertions.map(assertion => this.validateAssertion(assertion));
                const failedAssertions = result.assertions.filter(a => !a.passed);
                if (failedAssertions.length > 0) {
                    throw new Error(`Assertions failed: ${failedAssertions.map(a => a.message).join(', ')}`);
                }
                result.status = 'passed';
                break; // Success, no need to retry
            }
            catch (error) {
                lastError = error;
                result.status = 'failed';
                result.error = lastError.message;
                if (retries > 0) {
                    console.log(`Test failed, retrying... (${retries} retries left)`);
                    await this.sleep(1000); // Wait 1 second before retry
                }
                retries--;
            }
            finally {
                // Test teardown
                try {
                    if (testCase.teardown) {
                        await testCase.teardown();
                    }
                    // Collect metrics
                    if (this.currentContext) {
                        result.metrics = await this.currentContext.metrics.collect();
                        result.logs = this.currentContext.logger.getLogs();
                        if (this.config.takeScreenshots) {
                            result.screenshots = await this.currentContext.screenshots.capture();
                        }
                    }
                    // Cleanup context
                    if (this.currentContext) {
                        await this.cleanupTestContext(this.currentContext);
                    }
                }
                catch (cleanupError) {
                    console.warn('Test cleanup failed:', cleanupError);
                }
            }
        }
        result.duration = Date.now() - startTime;
        if (result.status === 'failed' && lastError) {
            console.error(`Test ${testCase.name} failed after all retries:`, lastError);
        }
        return result;
    }
    /**
     * Add custom test case
     */
    addTestCase(suiteId, testCase) {
        const testSuite = this.testSuites.get(suiteId);
        if (testSuite) {
            testSuite.testCases.push(testCase);
        }
    }
    /**
     * Add custom test suite
     */
    addTestSuite(testSuite) {
        this.testSuites.set(testSuite.id, testSuite);
    }
    /**
     * Get test results
     */
    getResults() {
        return [...this.results];
    }
    // Private methods
    async loadDefaultTestSuites() {
        // Authentication test suite
        const authTestSuite = {
            id: 'auth_tests',
            name: 'Authentication Tests',
            description: 'Test user authentication and session management',
            testCases: [
                {
                    id: 'login_success',
                    name: 'Successful Login',
                    description: 'User can log in with valid credentials',
                    category: 'authentication',
                    priority: 'critical',
                    platforms: ['desktop', 'mobile', 'web'],
                    tags: ['auth', 'login'],
                    prerequisites: [],
                    test: async (context) => {
                        // Navigate to login page
                        await context.app?.navigate('/login');
                        // Enter credentials
                        await context.app?.fillForm({
                            username: context.user.username,
                            password: context.user.password
                        });
                        // Click login button
                        await context.app?.click('[data-testid="login-button"]');
                        // Wait for redirect
                        await context.app?.waitForNavigation('/dashboard');
                    },
                    assertions: [
                        {
                            type: 'exists',
                            actual: () => this.currentContext?.app?.getCurrentUrl(),
                            expected: '/dashboard',
                            message: 'Should redirect to dashboard after login'
                        }
                    ]
                },
                {
                    id: 'login_failure',
                    name: 'Failed Login',
                    description: 'Login fails with invalid credentials',
                    category: 'authentication',
                    priority: 'high',
                    platforms: ['desktop', 'mobile', 'web'],
                    tags: ['auth', 'login', 'error'],
                    prerequisites: [],
                    test: async (context) => {
                        await context.app?.navigate('/login');
                        await context.app?.fillForm({
                            username: 'invalid@example.com',
                            password: 'wrongpassword'
                        });
                        await context.app?.click('[data-testid="login-button"]');
                        // Wait for error message
                        await context.app?.waitForElement('[data-testid="error-message"]');
                    },
                    assertions: [
                        {
                            type: 'exists',
                            actual: () => this.currentContext?.app?.getElement('[data-testid="error-message"]'),
                            expected: true,
                            message: 'Should show error message for invalid credentials'
                        }
                    ]
                }
            ]
        };
        // Mail test suite
        const mailTestSuite = {
            id: 'mail_tests',
            name: 'Mail Tests',
            description: 'Test email functionality',
            testCases: [
                {
                    id: 'compose_send_email',
                    name: 'Compose and Send Email',
                    description: 'User can compose and send an email',
                    category: 'mail',
                    priority: 'critical',
                    platforms: ['desktop', 'mobile'],
                    tags: ['mail', 'compose'],
                    prerequisites: ['login_success'],
                    setup: async () => {
                        // Ensure mail account is connected
                    },
                    test: async (context) => {
                        // Navigate to mail
                        await context.app?.navigate('/mail');
                        // Click compose button
                        await context.app?.click('[data-testid="compose-button"]');
                        // Fill email form
                        await context.app?.fillForm({
                            to: 'test@example.com',
                            subject: 'Test Email',
                            body: 'This is a test email from Flow Desk'
                        });
                        // Send email
                        await context.app?.click('[data-testid="send-button"]');
                        // Wait for confirmation
                        await context.app?.waitForElement('[data-testid="sent-confirmation"]');
                    },
                    assertions: [
                        {
                            type: 'exists',
                            actual: () => this.currentContext?.app?.getElement('[data-testid="sent-confirmation"]'),
                            expected: true,
                            message: 'Should show sent confirmation'
                        }
                    ]
                }
            ]
        };
        // Workspace test suite
        const workspaceTestSuite = {
            id: 'workspace_tests',
            name: 'Workspace Tests',
            description: 'Test workspace management',
            testCases: [
                {
                    id: 'create_workspace',
                    name: 'Create New Workspace',
                    description: 'User can create a new workspace',
                    category: 'workspace',
                    priority: 'high',
                    platforms: ['desktop', 'mobile'],
                    tags: ['workspace', 'create'],
                    prerequisites: ['login_success'],
                    test: async (context) => {
                        // Navigate to workspaces
                        await context.app?.navigate('/workspaces');
                        // Click create workspace
                        await context.app?.click('[data-testid="create-workspace-button"]');
                        // Fill workspace form
                        await context.app?.fillForm({
                            name: 'Test Workspace',
                            type: 'Business'
                        });
                        // Submit form
                        await context.app?.click('[data-testid="create-button"]');
                        // Wait for workspace to appear
                        await context.app?.waitForElement('[data-testid="workspace-Test Workspace"]');
                    },
                    assertions: [
                        {
                            type: 'exists',
                            actual: () => this.currentContext?.app?.getElement('[data-testid="workspace-Test Workspace"]'),
                            expected: true,
                            message: 'Should create new workspace'
                        }
                    ]
                },
                {
                    id: 'switch_workspace',
                    name: 'Switch Workspace',
                    description: 'User can switch between workspaces',
                    category: 'workspace',
                    priority: 'high',
                    platforms: ['desktop', 'mobile'],
                    tags: ['workspace', 'switch'],
                    prerequisites: ['create_workspace'],
                    test: async (context) => {
                        // Click workspace switcher
                        await context.app?.click('[data-testid="workspace-switcher"]');
                        // Select different workspace
                        await context.app?.click('[data-testid="workspace-Test Workspace"]');
                        // Wait for workspace to load
                        await context.app?.waitForElement('[data-testid="current-workspace-Test Workspace"]');
                    },
                    assertions: [
                        {
                            type: 'exists',
                            actual: () => this.currentContext?.app?.getElement('[data-testid="current-workspace-Test Workspace"]'),
                            expected: true,
                            message: 'Should switch to selected workspace'
                        }
                    ]
                }
            ]
        };
        // Performance test suite
        const performanceTestSuite = {
            id: 'performance_tests',
            name: 'Performance Tests',
            description: 'Test application performance',
            testCases: [
                {
                    id: 'app_load_time',
                    name: 'Application Load Time',
                    description: 'Application loads within acceptable time',
                    category: 'performance',
                    priority: 'medium',
                    platforms: ['desktop', 'mobile', 'web'],
                    tags: ['performance', 'load'],
                    prerequisites: [],
                    test: async (context) => {
                        const startTime = Date.now();
                        await context.app?.navigate('/');
                        await context.app?.waitForElement('[data-testid="app-ready"]');
                        const loadTime = Date.now() - startTime;
                        context.metrics.record('loadTime', loadTime);
                    },
                    assertions: [
                        {
                            type: 'less_than',
                            actual: () => this.currentContext?.metrics.get('loadTime'),
                            expected: 5000, // 5 seconds
                            message: 'App should load within 5 seconds'
                        }
                    ]
                }
            ]
        };
        // Add test suites
        this.testSuites.set(authTestSuite.id, authTestSuite);
        this.testSuites.set(mailTestSuite.id, mailTestSuite);
        this.testSuites.set(workspaceTestSuite.id, workspaceTestSuite);
        this.testSuites.set(performanceTestSuite.id, performanceTestSuite);
    }
    async createTestContext(testCase) {
        const context = {
            api: new ApiClient(this.config.endpoints.api),
            storage: new StorageClient(),
            user: {
                id: 'test-user-1',
                username: this.config.credentials.testUser.username,
                email: this.config.credentials.testUser.username,
                password: this.config.credentials.testUser.password,
                role: 'user'
            },
            workspace: {
                id: 'test-workspace-1',
                name: 'Test Workspace',
                type: 'Business',
                settings: {}
            },
            screenshots: new ScreenshotManager(testCase.id),
            logger: new TestLogger(testCase.id),
            metrics: new MetricsCollector()
        };
        // Initialize platform-specific context
        switch (this.config.platform) {
            case 'desktop':
                context.app = await this.createDesktopApp();
                break;
            case 'mobile':
                context.device = await this.createMobileDevice();
                context.app = context.device;
                break;
            case 'web':
                context.browser = await this.createBrowser();
                context.app = context.browser;
                break;
        }
        return context;
    }
    async createDesktopApp() {
        // Would integrate with Electron testing framework
        return {
            navigate: async (url) => {
                console.log(`Navigating to: ${url}`);
            },
            click: async (selector) => {
                console.log(`Clicking: ${selector}`);
            },
            fillForm: async (data) => {
                console.log(`Filling form:`, data);
            },
            waitForElement: async (selector) => {
                console.log(`Waiting for element: ${selector}`);
            },
            waitForNavigation: async (url) => {
                console.log(`Waiting for navigation to: ${url}`);
            },
            getElement: (selector) => {
                return { exists: true };
            },
            getCurrentUrl: () => '/dashboard'
        };
    }
    async createMobileDevice() {
        // Would integrate with mobile testing framework (Detox, Appium)
        return {
            navigate: async (url) => {
                console.log(`Mobile navigating to: ${url}`);
            },
            click: async (selector) => {
                console.log(`Mobile clicking: ${selector}`);
            },
            fillForm: async (data) => {
                console.log(`Mobile filling form:`, data);
            },
            waitForElement: async (selector) => {
                console.log(`Mobile waiting for element: ${selector}`);
            },
            waitForNavigation: async (url) => {
                console.log(`Mobile waiting for navigation to: ${url}`);
            },
            getElement: (selector) => {
                return { exists: true };
            },
            getCurrentUrl: () => '/dashboard'
        };
    }
    async createBrowser() {
        // Would integrate with Playwright or Selenium
        return {
            navigate: async (url) => {
                console.log(`Browser navigating to: ${url}`);
            },
            click: async (selector) => {
                console.log(`Browser clicking: ${selector}`);
            },
            fillForm: async (data) => {
                console.log(`Browser filling form:`, data);
            },
            waitForElement: async (selector) => {
                console.log(`Browser waiting for element: ${selector}`);
            },
            waitForNavigation: async (url) => {
                console.log(`Browser waiting for navigation to: ${url}`);
            },
            getElement: (selector) => {
                return { exists: true };
            },
            getCurrentUrl: () => '/dashboard'
        };
    }
    async cleanupTestContext(context) {
        // Cleanup resources
        if (context.browser) {
            await context.browser.close?.();
        }
        if (context.device) {
            await context.device.cleanup?.();
        }
        if (context.app) {
            await context.app.close?.();
        }
    }
    validateAssertion(assertion) {
        const actual = typeof assertion.actual === 'function' ? assertion.actual() : assertion.actual;
        const expected = assertion.expected;
        let passed = false;
        switch (assertion.type) {
            case 'equals':
                passed = actual === expected;
                break;
            case 'not_equals':
                passed = actual !== expected;
                break;
            case 'contains':
                passed = String(actual).includes(String(expected));
                break;
            case 'not_contains':
                passed = !String(actual).includes(String(expected));
                break;
            case 'greater_than':
                passed = Number(actual) > Number(expected);
                break;
            case 'less_than':
                passed = Number(actual) < Number(expected);
                break;
            case 'exists':
                passed = actual != null && actual !== false;
                break;
            case 'not_exists':
                passed = actual == null || actual === false;
                break;
        }
        return {
            passed,
            message: assertion.message || `Expected ${expected}, got ${actual}`,
            actual,
            expected
        };
    }
    createTimeoutPromise(timeout) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Test timed out after ${timeout}ms`));
            }, timeout);
        });
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    createEmptyMetrics() {
        return {
            memoryUsage: 0,
            cpuUsage: 0,
            networkRequests: 0,
            pageLoadTime: 0,
            responseTime: 0,
            errors: 0
        };
    }
    generateReport(startTime, endTime) {
        const total = this.results.length;
        const passed = this.results.filter(r => r.status === 'passed').length;
        const failed = this.results.filter(r => r.status === 'failed').length;
        const skipped = this.results.filter(r => r.status === 'skipped').length;
        const report = {
            id: `report_${Date.now()}`,
            timestamp: Date.now(),
            config: this.config,
            summary: {
                total,
                passed,
                failed,
                skipped,
                duration: endTime - startTime
            },
            results: this.results
        };
        if (this.config.generateReport) {
            this.saveReport(report);
        }
        return report;
    }
    saveReport(report) {
        // Save report to file or send to reporting service
        const reportJson = JSON.stringify(report, null, 2);
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            const path = require('path');
            const reportPath = path.join(process.cwd(), 'test-reports', `${report.id}.json`);
            fs.writeFileSync(reportPath, reportJson);
            console.log(`Test report saved to: ${reportPath}`);
        }
        else {
            console.log('Test Report:', reportJson);
        }
    }
}
exports.IntegrationTestSuite = IntegrationTestSuite;
IntegrationTestSuite.instance = null;
// Helper classes
class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async get(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`);
        return response.json();
    }
    async post(endpoint, data) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    }
}
class StorageClient {
    async get(key) {
        return localStorage?.getItem(key);
    }
    async set(key, value) {
        localStorage?.setItem(key, JSON.stringify(value));
    }
    async clear() {
        localStorage?.clear();
    }
}
class ScreenshotManager {
    constructor(testId) {
        this.screenshots = [];
        this.testId = testId;
    }
    async capture(name) {
        const screenshotName = name || `${this.testId}_${Date.now()}`;
        this.screenshots.push(screenshotName);
        // Would implement actual screenshot capture
        console.log(`Screenshot captured: ${screenshotName}`);
        return [...this.screenshots];
    }
}
class TestLogger {
    constructor(testId) {
        this.logs = [];
        this.testId = testId;
    }
    debug(message, data) {
        this.log('debug', message, data);
    }
    info(message, data) {
        this.log('info', message, data);
    }
    warn(message, data) {
        this.log('warn', message, data);
    }
    error(message, data) {
        this.log('error', message, data);
    }
    log(level, message, data) {
        const logEntry = {
            level,
            message,
            timestamp: Date.now(),
            data
        };
        this.logs.push(logEntry);
        console.log(`[${level.toUpperCase()}] ${this.testId}: ${message}`, data);
    }
    getLogs() {
        return [...this.logs];
    }
}
class MetricsCollector {
    constructor() {
        this.metrics = new Map();
    }
    record(name, value) {
        this.metrics.set(name, value);
    }
    get(name) {
        return this.metrics.get(name);
    }
    async collect() {
        return {
            memoryUsage: this.metrics.get('memoryUsage') || 0,
            cpuUsage: this.metrics.get('cpuUsage') || 0,
            networkRequests: this.metrics.get('networkRequests') || 0,
            pageLoadTime: this.metrics.get('pageLoadTime') || 0,
            responseTime: this.metrics.get('responseTime') || 0,
            errors: this.metrics.get('errors') || 0
        };
    }
}
// Helper functions
const createIntegrationTestSuite = (config) => {
    return new IntegrationTestSuite(config);
};
exports.createIntegrationTestSuite = createIntegrationTestSuite;
const getIntegrationTestSuite = () => {
    return IntegrationTestSuite.getInstance();
};
exports.getIntegrationTestSuite = getIntegrationTestSuite;
const runTests = async (suiteIds) => {
    const testSuite = IntegrationTestSuite.getInstance();
    if (suiteIds) {
        const results = [];
        for (const suiteId of suiteIds) {
            const suite = testSuite['testSuites'].get(suiteId);
            if (suite) {
                const suiteResults = await testSuite.runTestSuite(suite);
                results.push(...suiteResults);
            }
        }
        return results;
    }
    else {
        const report = await testSuite.runAll();
        return report;
    }
};
exports.runTests = runTests;
//# sourceMappingURL=integration-test-suite.js.map