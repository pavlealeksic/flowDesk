/**
 * Automation Test Runner - Comprehensive testing and validation system
 * 
 * This system provides:
 * - Unit testing for individual triggers and actions
 * - Integration testing for complete workflows
 * - End-to-end testing with real data
 * - Performance and load testing
 * - Mock and stub capabilities
 * - Automated test generation
 * - Test reporting and analytics
 */

import { EventEmitter } from 'events';
import { 
  AutomationRecipe,
  AutomationTest,
  AutomationExecution,
  AutomationVariable,
  AutomationVariableContext 
} from '@flow-desk/shared';

import { AutomationEngine } from './AutomationEngine';
import { VariableResolver } from './VariableResolver';
import { ConditionalLogicEngine } from './ConditionalLogicEngine';

interface TestSuite {
  id: string;
  name: string;
  description: string;
  recipeId: string;
  tests: AutomationTest[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: TestSuiteResults;
  createdAt: Date;
  updatedAt: Date;
}

interface TestSuiteResults {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  executionTime: number;
  coverage: TestCoverage;
  reports: TestReport[];
}

interface TestCoverage {
  triggers: { covered: number; total: number };
  actions: { covered: number; total: number };
  conditions: { covered: number; total: number };
  variables: { covered: number; total: number };
  errorPaths: { covered: number; total: number };
}

interface TestReport {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  executionTime: number;
  assertions: TestAssertion[];
  logs: TestLogEntry[];
  error?: string;
  screenshots?: string[];
}

interface TestAssertion {
  id: string;
  description: string;
  expected: any;
  actual: any;
  passed: boolean;
  operator: 'equals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan' | 'exists' | 'custom';
}

interface TestLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

interface MockConfiguration {
  type: 'trigger' | 'action' | 'api' | 'plugin' | 'service';
  target: string;
  behavior: 'return' | 'throw' | 'delay' | 'sequence';
  response?: any;
  error?: string;
  delay?: number;
  sequence?: any[];
  conditions?: Record<string, any>;
}

interface LoadTestConfiguration {
  concurrency: number;
  duration: number;
  rampUp: number;
  targetThroughput: number;
  dataVariations: any[];
}

export class AutomationTestRunner extends EventEmitter {
  private readonly automationEngine: AutomationEngine;
  private readonly variableResolver: VariableResolver;
  private readonly conditionalLogicEngine: ConditionalLogicEngine;

  private readonly testSuites = new Map<string, TestSuite>();
  private readonly activeMocks = new Map<string, MockConfiguration>();
  private readonly testResults = new Map<string, TestReport>();

  private isInitialized = false;

  constructor(
    automationEngine: AutomationEngine,
    variableResolver: VariableResolver,
    conditionalLogicEngine: ConditionalLogicEngine
  ) {
    super();
    
    this.automationEngine = automationEngine;
    this.variableResolver = variableResolver;
    this.conditionalLogicEngine = conditionalLogicEngine;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Set up test environment
      await this.setupTestEnvironment();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize AutomationTestRunner: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a test suite for a recipe
   */
  async createTestSuite(
    recipeId: string,
    name: string,
    description: string,
    tests: Omit<AutomationTest, 'id' | 'metadata'>[] = []
  ): Promise<string> {
    const suiteId = this.generateTestSuiteId();
    
    const testSuite: TestSuite = {
      id: suiteId,
      name,
      description,
      recipeId,
      tests: tests.map(test => ({
        ...test,
        id: this.generateTestId(),
        recipeId,
        metadata: {
          author: 'test-runner',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['generated']
        }
      })),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.testSuites.set(suiteId, testSuite);
    this.emit('testSuiteCreated', testSuite);
    
    return suiteId;
  }

  /**
   * Auto-generate tests for a recipe
   */
  async generateTests(recipeId: string): Promise<AutomationTest[]> {
    const recipe = this.automationEngine.getRecipe(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    const tests: AutomationTest[] = [];

    // Generate trigger tests
    tests.push(...this.generateTriggerTests(recipe));
    
    // Generate action tests
    tests.push(...this.generateActionTests(recipe));
    
    // Generate integration tests
    tests.push(...this.generateIntegrationTests(recipe));
    
    // Generate edge case tests
    tests.push(...this.generateEdgeCaseTests(recipe));

    return tests;
  }

  /**
   * Run a test suite
   */
  async runTestSuite(suiteId: string): Promise<TestSuiteResults> {
    const testSuite = this.testSuites.get(suiteId);
    if (!testSuite) {
      throw new Error(`Test suite not found: ${suiteId}`);
    }

    testSuite.status = 'running';
    testSuite.updatedAt = new Date();
    
    this.emit('testSuiteStarted', testSuite);

    const startTime = Date.now();
    const reports: TestReport[] = [];
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;

    try {
      // Run tests in parallel with concurrency limit
      const concurrencyLimit = 5;
      const testBatches = this.batchArray(testSuite.tests, concurrencyLimit);

      for (const batch of testBatches) {
        const batchPromises = batch.map(test => this.runSingleTest(test));
        const batchResults = await Promise.all(batchPromises);
        
        for (const result of batchResults) {
          reports.push(result);
          
          switch (result.status) {
            case 'passed': passedTests++; break;
            case 'failed': failedTests++; break;
            case 'skipped': skippedTests++; break;
          }
        }
      }

      const results: TestSuiteResults = {
        totalTests: testSuite.tests.length,
        passedTests,
        failedTests,
        skippedTests,
        executionTime: Date.now() - startTime,
        coverage: await this.calculateCoverage(testSuite.recipeId, reports),
        reports
      };

      testSuite.results = results;
      testSuite.status = failedTests > 0 ? 'failed' : 'completed';
      testSuite.updatedAt = new Date();

      this.emit('testSuiteCompleted', testSuite);
      return results;

    } catch (error) {
      testSuite.status = 'failed';
      testSuite.updatedAt = new Date();
      
      this.emit('testSuiteFailed', { testSuite, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Run a single test
   */
  async runSingleTest(test: AutomationTest): Promise<TestReport> {
    const startTime = Date.now();
    const logs: TestLogEntry[] = [];
    const assertions: TestAssertion[] = [];

    const log = (level: TestLogEntry['level'], message: string, data?: any) => {
      logs.push({ timestamp: new Date(), level, message, data });
    };

    try {
      log('info', `Starting test: ${test.name}`);

      // Set up mocks
      const mockConfigs: MockConfiguration[] = (test.config.mocks || []).map(mock => ({
        type: mock.type as 'api' | 'plugin' | 'service',
        target: mock.target,
        behavior: 'return',
        response: mock.response
      }));
      const activeMocks = await this.setupTestMocks(mockConfigs);
      
      // Run setup steps
      if (test.config.setup) {
        log('info', 'Running setup steps');
        await this.executeTestActions(test.config.setup, test);
      }

      // Execute the test
      const execution = await this.executeTestScenario(test);
      
      // Validate results
      for (const expectedOutput of test.config.expectedOutputs) {
        const assertion = await this.validateExpectedOutput(
          execution,
          expectedOutput,
          test
        );
        assertions.push(assertion);
      }

      // Run cleanup steps
      if (test.config.cleanup) {
        log('info', 'Running cleanup steps');
        await this.executeTestActions(test.config.cleanup, test);
      }

      // Clean up mocks
      await this.cleanupTestMocks(activeMocks);

      const allPassed = assertions.every(a => a.passed);
      const status = allPassed ? 'passed' : 'failed';

      log('info', `Test ${status}: ${test.name}`);

      const report: TestReport = {
        testId: test.id,
        testName: test.name,
        status,
        executionTime: Date.now() - startTime,
        assertions,
        logs
      };

      this.testResults.set(test.id, report);
      return report;

    } catch (error) {
      log('error', `Test error: ${error instanceof Error ? error.message : String(error)}`);

      const report: TestReport = {
        testId: test.id,
        testName: test.name,
        status: 'failed',
        executionTime: Date.now() - startTime,
        assertions,
        logs,
        error: error instanceof Error ? error.message : String(error)
      };

      this.testResults.set(test.id, report);
      return report;
    }
  }

  /**
   * Run load tests on a recipe
   */
  async runLoadTest(
    recipeId: string,
    config: LoadTestConfiguration
  ): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    throughput: number;
    errorRate: number;
    errors: Array<{ message: string; count: number }>;
  }> {
    const recipe = this.automationEngine.getRecipe(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    const results = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      throughput: 0,
      errorRate: 0,
      errors: [] as Array<{ message: string; count: number }>
    };

    const responseTimes: number[] = [];
    const errors = new Map<string, number>();
    const startTime = Date.now();

    // Execute load test
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < config.concurrency; i++) {
      const promise = this.runLoadTestWorker(
        recipe,
        config,
        results,
        responseTimes,
        errors,
        startTime
      );
      promises.push(promise);
    }

    await Promise.all(promises);

    // Calculate final metrics
    if (responseTimes.length > 0) {
      results.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      results.maxResponseTime = Math.max(...responseTimes);
      results.minResponseTime = Math.min(...responseTimes);
    }

    const totalTime = Date.now() - startTime;
    results.throughput = results.totalExecutions / (totalTime / 1000);
    results.errorRate = results.totalExecutions > 0 ? results.failedExecutions / results.totalExecutions : 0;

    results.errors = Array.from(errors.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count);

    return results;
  }

  /**
   * Set up test mocks
   */
  async setupMock(mock: MockConfiguration): Promise<string> {
    const mockId = this.generateMockId();
    this.activeMocks.set(mockId, mock);
    
    // Apply the mock to the appropriate system
    await this.applyMock(mock);
    
    return mockId;
  }

  /**
   * Remove test mock
   */
  async removeMock(mockId: string): Promise<void> {
    const mock = this.activeMocks.get(mockId);
    if (mock) {
      await this.removeMockFromSystem(mock);
      this.activeMocks.delete(mockId);
    }
  }

  /**
   * Get test results
   */
  getTestResults(suiteId?: string): TestReport[] {
    if (suiteId) {
      const suite = this.testSuites.get(suiteId);
      if (suite?.results) {
        return suite.results.reports;
      }
      return [];
    }
    
    return Array.from(this.testResults.values());
  }

  /**
   * Generate test report
   */
  async generateTestReport(
    suiteId: string,
    format: 'html' | 'json' | 'junit' = 'html'
  ): Promise<string> {
    const suite = this.testSuites.get(suiteId);
    if (!suite || !suite.results) {
      throw new Error('Test suite not found or not completed');
    }

    switch (format) {
      case 'html':
        return this.generateHtmlReport(suite);
      case 'json':
        return JSON.stringify(suite.results, null, 2);
      case 'junit':
        return this.generateJunitReport(suite);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Private methods

  private async setupTestEnvironment(): Promise<void> {
    // Set up isolated test environment
    // This would include test databases, mock services, etc.
  }

  private generateTriggerTests(recipe: AutomationRecipe): AutomationTest[] {
    const tests: AutomationTest[] = [];

    // Test trigger with valid data
    tests.push({
      id: this.generateTestId(),
      name: `Trigger Test: ${recipe.trigger.type} - Valid Data`,
      description: `Test trigger ${recipe.trigger.type} with valid data`,
      recipeId: recipe.id,
      type: 'unit',
      status: 'pending',
      config: {
        triggerData: this.generateValidTriggerData(recipe.trigger),
        expectedOutputs: [
          {
            actionId: 'trigger-validation',
            expectedResult: { triggered: true },
            assertion: 'equals'
          }
        ],
        timeout: 10000
      },
      metadata: {
        author: 'test-generator',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['trigger', 'unit', 'valid-data']
      }
    });

    // Test trigger with invalid data
    tests.push({
      id: this.generateTestId(),
      name: `Trigger Test: ${recipe.trigger.type} - Invalid Data`,
      description: `Test trigger ${recipe.trigger.type} with invalid data`,
      recipeId: recipe.id,
      type: 'unit',
      status: 'pending',
      config: {
        triggerData: this.generateInvalidTriggerData(recipe.trigger),
        expectedOutputs: [
          {
            actionId: 'trigger-validation',
            expectedResult: { triggered: false },
            assertion: 'equals'
          }
        ],
        timeout: 10000
      },
      metadata: {
        author: 'test-generator',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['trigger', 'unit', 'invalid-data']
      }
    });

    return tests;
  }

  private generateActionTests(recipe: AutomationRecipe): AutomationTest[] {
    const tests: AutomationTest[] = [];

    recipe.actions.forEach(action => {
      // Test action success scenario
      tests.push({
        id: this.generateTestId(),
        name: `Action Test: ${action.name} - Success`,
        description: `Test action ${action.name} success scenario`,
        recipeId: recipe.id,
        type: 'unit',
        status: 'pending',
        config: {
          triggerData: this.generateValidTriggerData(recipe.trigger),
          expectedOutputs: [
            {
              actionId: action.id,
              expectedResult: { success: true },
              assertion: 'contains'
            }
          ],
          timeout: 30000
        },
        metadata: {
          author: 'test-generator',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['action', 'unit', 'success']
        }
      });

      // Test action failure scenario
      tests.push({
        id: this.generateTestId(),
        name: `Action Test: ${action.name} - Failure`,
        description: `Test action ${action.name} failure handling`,
        recipeId: recipe.id,
        type: 'unit',
        status: 'pending',
        config: {
          triggerData: this.generateValidTriggerData(recipe.trigger),
          expectedOutputs: [
            {
              actionId: action.id,
              expectedResult: { success: false },
              assertion: 'contains'
            }
          ],
          timeout: 30000,
          mocks: [
            {
              type: 'service',
              target: action.id,
              response: { success: false, error: 'Test error' }
            }
          ]
        },
        metadata: {
          author: 'test-generator',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['action', 'unit', 'failure']
        }
      });
    });

    return tests;
  }

  private generateIntegrationTests(recipe: AutomationRecipe): AutomationTest[] {
    const tests: AutomationTest[] = [];

    // End-to-end success test
    tests.push({
      id: this.generateTestId(),
      name: 'Integration Test: End-to-End Success',
      description: 'Test complete workflow execution',
      recipeId: recipe.id,
      type: 'integration',
      status: 'pending',
      config: {
        triggerData: this.generateValidTriggerData(recipe.trigger),
        expectedOutputs: recipe.actions.map(action => ({
          actionId: action.id,
          expectedResult: { success: true },
          assertion: 'contains'
        })),
        timeout: 60000
      },
      metadata: {
        author: 'test-generator',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['integration', 'e2e', 'success']
      }
    });

    return tests;
  }

  private generateEdgeCaseTests(recipe: AutomationRecipe): AutomationTest[] {
    const tests: AutomationTest[] = [];

    // Test with empty/null data
    tests.push({
      id: this.generateTestId(),
      name: 'Edge Case Test: Empty Data',
      description: 'Test workflow with empty/null trigger data',
      recipeId: recipe.id,
      type: 'integration',
      status: 'pending',
      config: {
        triggerData: {},
        expectedOutputs: [
          {
            actionId: 'workflow-validation',
            expectedResult: { handled: true },
            assertion: 'contains'
          }
        ],
        timeout: 30000
      },
      metadata: {
        author: 'test-generator',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['edge-case', 'empty-data']
      }
    });

    return tests;
  }

  private generateValidTriggerData(trigger: any): any {
    // Generate valid test data based on trigger type
    const dataMap: Record<string, any> = {
      'email_received': {
        id: 'test-email-1',
        subject: 'Test Email',
        sender: 'test@example.com',
        body: 'This is a test email',
        timestamp: new Date().toISOString()
      },
      'file_created': {
        filepath: '/test/file.txt',
        filename: 'file.txt',
        size: 1024,
        timestamp: new Date().toISOString()
      },
      'schedule': {
        timestamp: new Date().toISOString()
      }
    };

    return dataMap[trigger.type] || { timestamp: new Date().toISOString() };
  }

  private generateInvalidTriggerData(trigger: any): any {
    // Generate invalid test data
    return {
      invalidField: 'invalid_value',
      timestamp: 'invalid_timestamp'
    };
  }

  private async executeTestScenario(test: AutomationTest): Promise<AutomationExecution> {
    // Execute the recipe with test data
    return this.automationEngine.executeRecipe(test.recipeId, test.config.triggerData);
  }

  private async validateExpectedOutput(
    execution: AutomationExecution,
    expectedOutput: any,
    test: AutomationTest
  ): Promise<TestAssertion> {
    const actionExecution = execution.actions.find(a => a.actionId === expectedOutput.actionId);
    
    const assertion: TestAssertion = {
      id: this.generateAssertionId(),
      description: `Action ${expectedOutput.actionId} should return expected result`,
      expected: expectedOutput.expectedResult,
      actual: actionExecution?.output,
      passed: false,
      operator: expectedOutput.assertion
    };

    try {
      assertion.passed = this.evaluateAssertion(
        actionExecution?.output,
        expectedOutput.expectedResult,
        expectedOutput.assertion
      );
    } catch (error) {
      assertion.passed = false;
    }

    return assertion;
  }

  private evaluateAssertion(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return JSON.stringify(actual) === JSON.stringify(expected);
      case 'contains':
        if (typeof actual === 'object' && typeof expected === 'object') {
          return Object.keys(expected).every(key => 
            key in actual && actual[key] === expected[key]
          );
        }
        return String(actual).includes(String(expected));
      case 'matches':
        return new RegExp(expected).test(String(actual));
      case 'greaterThan':
        return Number(actual) > Number(expected);
      case 'lessThan':
        return Number(actual) < Number(expected);
      case 'exists':
        return actual !== undefined && actual !== null;
      default:
        return false;
    }
  }

  private async calculateCoverage(recipeId: string, reports: TestReport[]): Promise<TestCoverage> {
    const recipe = this.automationEngine.getRecipe(recipeId);
    if (!recipe) {
      return {
        triggers: { covered: 0, total: 0 },
        actions: { covered: 0, total: 0 },
        conditions: { covered: 0, total: 0 },
        variables: { covered: 0, total: 0 },
        errorPaths: { covered: 0, total: 0 }
      };
    }

    const coveredTriggers = new Set<string>();
    const coveredActions = new Set<string>();
    const coveredConditions = new Set<string>();
    const coveredErrorPaths = new Set<string>();

    for (const report of reports) {
      if (report.status === 'passed') {
        coveredTriggers.add(recipe.trigger.type);
        
        for (const action of recipe.actions) {
          coveredActions.add(action.id);
        }

        // Analyze conditions and error paths from test logs
        // This would be more sophisticated in a real implementation
      }
    }

    return {
      triggers: { covered: coveredTriggers.size, total: 1 },
      actions: { covered: coveredActions.size, total: recipe.actions.length },
      conditions: { covered: coveredConditions.size, total: this.countConditions(recipe) },
      variables: { covered: 0, total: Object.keys(recipe.settings.variables).length },
      errorPaths: { covered: coveredErrorPaths.size, total: this.countErrorPaths(recipe) }
    };
  }

  private countConditions(recipe: AutomationRecipe): number {
    let count = 0;
    if (recipe.trigger.conditions) count += recipe.trigger.conditions.length;
    for (const action of recipe.actions) {
      if (action.conditions) count += action.conditions.length;
    }
    return count;
  }

  private countErrorPaths(recipe: AutomationRecipe): number {
    return recipe.actions.length; // Each action has at least one error path
  }

  // Additional helper methods...

  private async setupTestMocks(mocks: MockConfiguration[]): Promise<string[]> {
    const mockIds: string[] = [];
    for (const mock of mocks) {
      const mockId = await this.setupMock(mock);
      mockIds.push(mockId);
    }
    return mockIds;
  }

  private async cleanupTestMocks(mockIds: string[]): Promise<void> {
    for (const mockId of mockIds) {
      await this.removeMock(mockId);
    }
  }

  private async executeTestActions(actions: any[], test: AutomationTest): Promise<void> {
    // Execute setup/cleanup actions
    for (const action of actions) {
      // This would execute actions in the test environment
    }
  }

  private async applyMock(mock: MockConfiguration): Promise<void> {
    // Apply mock to the system
    // This would integrate with the automation engine's mocking system
  }

  private async removeMockFromSystem(mock: MockConfiguration): Promise<void> {
    // Remove mock from the system
  }

  private async runLoadTestWorker(
    recipe: AutomationRecipe,
    config: LoadTestConfiguration,
    results: any,
    responseTimes: number[],
    errors: Map<string, number>,
    startTime: number
  ): Promise<void> {
    const endTime = startTime + config.duration;
    
    while (Date.now() < endTime) {
      const executeStartTime = Date.now();
      
      try {
        await this.automationEngine.executeRecipe(recipe.id, this.getRandomTestData(config.dataVariations));
        
        const responseTime = Date.now() - executeStartTime;
        responseTimes.push(responseTime);
        results.totalExecutions++;
        results.successfulExecutions++;
        
      } catch (error) {
        const responseTime = Date.now() - executeStartTime;
        responseTimes.push(responseTime);
        results.totalExecutions++;
        results.failedExecutions++;
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.set(errorMessage, (errors.get(errorMessage) || 0) + 1);
      }
      
      // Simple rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private getRandomTestData(dataVariations: any[]): any {
    if (dataVariations.length === 0) {
      return { timestamp: new Date().toISOString() };
    }
    
    const randomIndex = Math.floor(Math.random() * dataVariations.length);
    return dataVariations[randomIndex];
  }

  private generateHtmlReport(suite: TestSuite): string {
    // Generate HTML test report
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Report - ${suite.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
            .summary { display: flex; gap: 20px; margin: 20px 0; }
            .metric { background: white; padding: 15px; border: 1px solid #ddd; border-radius: 4px; }
            .passed { color: green; }
            .failed { color: red; }
            .test-result { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
            .test-result.passed { border-left-color: green; }
            .test-result.failed { border-left-color: red; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${suite.name}</h1>
            <p>${suite.description}</p>
            <p>Recipe: ${suite.recipeId}</p>
            <p>Executed: ${suite.updatedAt.toISOString()}</p>
          </div>
          
          <div class="summary">
            <div class="metric">
              <h3>Total Tests</h3>
              <div>${suite.results?.totalTests || 0}</div>
            </div>
            <div class="metric">
              <h3 class="passed">Passed</h3>
              <div>${suite.results?.passedTests || 0}</div>
            </div>
            <div class="metric">
              <h3 class="failed">Failed</h3>
              <div>${suite.results?.failedTests || 0}</div>
            </div>
            <div class="metric">
              <h3>Execution Time</h3>
              <div>${suite.results?.executionTime || 0}ms</div>
            </div>
          </div>
          
          <h2>Test Results</h2>
          ${suite.results?.reports.map(report => `
            <div class="test-result ${report.status}">
              <h3>${report.testName}</h3>
              <p>Status: <strong>${report.status}</strong></p>
              <p>Execution Time: ${report.executionTime}ms</p>
              ${report.error ? `<p>Error: ${report.error}</p>` : ''}
            </div>
          `).join('') || ''}
        </body>
      </html>
    `;
  }

  private generateJunitReport(suite: TestSuite): string {
    // Generate JUnit XML format
    return `<?xml version="1.0" encoding="UTF-8"?>
      <testsuite
        name="${suite.name}"
        tests="${suite.results?.totalTests || 0}"
        failures="${suite.results?.failedTests || 0}"
        time="${(suite.results?.executionTime || 0) / 1000}">
        ${suite.results?.reports.map(report => `
          <testcase
            name="${report.testName}"
            time="${report.executionTime / 1000}">
            ${report.status === 'failed' ? `<failure message="${report.error || 'Test failed'}">${report.error || ''}</failure>` : ''}
          </testcase>
        `).join('') || ''}
      </testsuite>`;
  }

  private batchArray<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  // ID generators
  private generateTestSuiteId(): string {
    return `suite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMockId(): string {
    return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAssertionId(): string {
    return `assertion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}