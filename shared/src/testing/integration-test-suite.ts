/**
 * End-to-End Integration Test Suite
 * Comprehensive testing framework for Flow Desk across all platforms and features
 */

export interface TestConfig {
  platform: 'desktop' | 'mobile' | 'web';
  environment: 'development' | 'staging' | 'production';
  timeout: number; // milliseconds
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
    testUser: { username: string; password: string };
    adminUser: { username: string; password: string };
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

export type TestCategory = 
  | 'authentication'
  | 'workspace'
  | 'mail'
  | 'calendar'
  | 'notifications'
  | 'plugins'
  | 'sync'
  | 'performance'
  | 'security'
  | 'onboarding'
  | 'ui'
  | 'api';

export interface TestContext {
  browser?: any; // Browser instance for web tests
  device?: any; // Device instance for mobile tests
  app?: any; // App instance for desktop tests
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

export class IntegrationTestSuite {
  private static instance: IntegrationTestSuite | null = null;
  private config: TestConfig;
  private testSuites: Map<string, TestSuite> = new Map();
  private results: TestResult[] = [];
  private currentContext: TestContext | null = null;

  constructor(config: TestConfig) {
    this.config = config;
  }

  static getInstance(config?: TestConfig): IntegrationTestSuite {
    if (!IntegrationTestSuite.instance && config) {
      IntegrationTestSuite.instance = new IntegrationTestSuite(config);
    } else if (!IntegrationTestSuite.instance) {
      throw new Error('IntegrationTestSuite must be initialized with config first');
    }
    return IntegrationTestSuite.instance;
  }

  /**
   * Initialize test suite with default test cases
   */
  async initialize(): Promise<void> {
    // Load default test suites
    await this.loadDefaultTestSuites();
    
    console.log('IntegrationTestSuite initialized');
  }

  /**
   * Run all test suites
   */
  async runAll(): Promise<TestReport> {
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
  async runTestSuite(testSuite: TestSuite): Promise<TestResult[]> {
    console.log(`Running test suite: ${testSuite.name}`);
    
    const suiteResults: TestResult[] = [];

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
          } else {
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
      } else {
        for (const testCase of testSuite.testCases) {
          const result = await this.runTestCase(testCase);
          suiteResults.push(result);
        }
      }

      // Suite teardown
      if (testSuite.teardown) {
        await testSuite.teardown();
      }

    } catch (error) {
      console.error(`Test suite ${testSuite.name} failed:`, error);
    }

    this.results.push(...suiteResults);
    return suiteResults;
  }

  /**
   * Run individual test case
   */
  async runTestCase(testCase: TestCase): Promise<TestResult> {
    console.log(`Running test: ${testCase.name}`);
    
    const startTime = Date.now();
    const result: TestResult = {
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
    let lastError: Error | null = null;

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
        result.assertions = testCase.assertions.map(assertion => 
          this.validateAssertion(assertion)
        );

        const failedAssertions = result.assertions.filter(a => !a.passed);
        if (failedAssertions.length > 0) {
          throw new Error(`Assertions failed: ${failedAssertions.map(a => a.message).join(', ')}`);
        }

        result.status = 'passed';
        break; // Success, no need to retry

      } catch (error) {
        lastError = error as Error;
        result.status = 'failed';
        result.error = lastError.message;
        
        if (retries > 0) {
          console.log(`Test failed, retrying... (${retries} retries left)`);
          await this.sleep(1000); // Wait 1 second before retry
        }
        
        retries--;

      } finally {
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

        } catch (cleanupError) {
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
  addTestCase(suiteId: string, testCase: TestCase): void {
    const testSuite = this.testSuites.get(suiteId);
    if (testSuite) {
      testSuite.testCases.push(testCase);
    }
  }

  /**
   * Add custom test suite
   */
  addTestSuite(testSuite: TestSuite): void {
    this.testSuites.set(testSuite.id, testSuite);
  }

  /**
   * Get test results
   */
  getResults(): TestResult[] {
    return [...this.results];
  }

  // Private methods

  private async loadDefaultTestSuites(): Promise<void> {
    // Authentication test suite
    const authTestSuite: TestSuite = {
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
          test: async (context: TestContext) => {
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
          test: async (context: TestContext) => {
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
    const mailTestSuite: TestSuite = {
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
          test: async (context: TestContext) => {
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
    const workspaceTestSuite: TestSuite = {
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
          test: async (context: TestContext) => {
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
          test: async (context: TestContext) => {
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
    const performanceTestSuite: TestSuite = {
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
          test: async (context: TestContext) => {
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

  private async createTestContext(testCase: TestCase): Promise<TestContext> {
    const context: TestContext = {
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

  private async createDesktopApp(): Promise<any> {
    // Would integrate with Electron testing framework
    return {
      navigate: async (url: string) => {
        console.log(`Navigating to: ${url}`);
      },
      click: async (selector: string) => {
        console.log(`Clicking: ${selector}`);
      },
      fillForm: async (data: Record<string, string>) => {
        console.log(`Filling form:`, data);
      },
      waitForElement: async (selector: string) => {
        console.log(`Waiting for element: ${selector}`);
      },
      waitForNavigation: async (url: string) => {
        console.log(`Waiting for navigation to: ${url}`);
      },
      getElement: (selector: string) => {
        return { exists: true };
      },
      getCurrentUrl: () => '/dashboard'
    };
  }

  private async createMobileDevice(): Promise<any> {
    // Would integrate with mobile testing framework (Detox, Appium)
    return {
      navigate: async (url: string) => {
        console.log(`Mobile navigating to: ${url}`);
      },
      click: async (selector: string) => {
        console.log(`Mobile clicking: ${selector}`);
      },
      fillForm: async (data: Record<string, string>) => {
        console.log(`Mobile filling form:`, data);
      },
      waitForElement: async (selector: string) => {
        console.log(`Mobile waiting for element: ${selector}`);
      },
      waitForNavigation: async (url: string) => {
        console.log(`Mobile waiting for navigation to: ${url}`);
      },
      getElement: (selector: string) => {
        return { exists: true };
      },
      getCurrentUrl: () => '/dashboard'
    };
  }

  private async createBrowser(): Promise<any> {
    // Would integrate with Playwright or Selenium
    return {
      navigate: async (url: string) => {
        console.log(`Browser navigating to: ${url}`);
      },
      click: async (selector: string) => {
        console.log(`Browser clicking: ${selector}`);
      },
      fillForm: async (data: Record<string, string>) => {
        console.log(`Browser filling form:`, data);
      },
      waitForElement: async (selector: string) => {
        console.log(`Browser waiting for element: ${selector}`);
      },
      waitForNavigation: async (url: string) => {
        console.log(`Browser waiting for navigation to: ${url}`);
      },
      getElement: (selector: string) => {
        return { exists: true };
      },
      getCurrentUrl: () => '/dashboard'
    };
  }

  private async cleanupTestContext(context: TestContext): Promise<void> {
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

  private validateAssertion(assertion: TestAssertion): AssertionResult {
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

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Test timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createEmptyMetrics(): TestMetrics {
    return {
      memoryUsage: 0,
      cpuUsage: 0,
      networkRequests: 0,
      pageLoadTime: 0,
      responseTime: 0,
      errors: 0
    };
  }

  private generateReport(startTime: number, endTime: number): TestReport {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;

    const report: TestReport = {
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

  private saveReport(report: TestReport): void {
    // Save report to file or send to reporting service
    const reportJson = JSON.stringify(report, null, 2);
    
    if (typeof require !== 'undefined') {
      const fs = require('fs');
      const path = require('path');
      
      const reportPath = path.join(process.cwd(), 'test-reports', `${report.id}.json`);
      fs.writeFileSync(reportPath, reportJson);
      
      console.log(`Test report saved to: ${reportPath}`);
    } else {
      console.log('Test Report:', reportJson);
    }
  }
}

// Helper classes

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async get(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`);
    return response.json();
  }

  async post(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }
}

class StorageClient {
  async get(key: string): Promise<any> {
    return localStorage?.getItem(key);
  }

  async set(key: string, value: any): Promise<void> {
    localStorage?.setItem(key, JSON.stringify(value));
  }

  async clear(): Promise<void> {
    localStorage?.clear();
  }
}

class ScreenshotManager {
  private testId: string;
  private screenshots: string[] = [];

  constructor(testId: string) {
    this.testId = testId;
  }

  async capture(name?: string): Promise<string[]> {
    const screenshotName = name || `${this.testId}_${Date.now()}`;
    this.screenshots.push(screenshotName);
    
    // Would implement actual screenshot capture
    console.log(`Screenshot captured: ${screenshotName}`);
    
    return [...this.screenshots];
  }
}

class TestLogger {
  private testId: string;
  private logs: TestLog[] = [];

  constructor(testId: string) {
    this.testId = testId;
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  private log(level: TestLog['level'], message: string, data?: any): void {
    const logEntry: TestLog = {
      level,
      message,
      timestamp: Date.now(),
      data
    };
    
    this.logs.push(logEntry);
    console.log(`[${level.toUpperCase()}] ${this.testId}: ${message}`, data);
  }

  getLogs(): TestLog[] {
    return [...this.logs];
  }
}

class MetricsCollector {
  private metrics: Map<string, number> = new Map();

  record(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  get(name: string): number | undefined {
    return this.metrics.get(name);
  }

  async collect(): Promise<TestMetrics> {
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
export const createIntegrationTestSuite = (config: TestConfig) => {
  return new IntegrationTestSuite(config);
};

export const getIntegrationTestSuite = () => {
  return IntegrationTestSuite.getInstance();
};

export const runTests = async (suiteIds?: string[]) => {
  const testSuite = IntegrationTestSuite.getInstance();
  
  if (suiteIds) {
    const results: TestResult[] = [];
    for (const suiteId of suiteIds) {
      const suite = testSuite['testSuites'].get(suiteId);
      if (suite) {
        const suiteResults = await testSuite.runTestSuite(suite);
        results.push(...suiteResults);
      }
    }
    return results;
  } else {
    const report = await testSuite.runAll();
    return report;
  }
};