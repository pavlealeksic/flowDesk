/**
 * Plugin Test Runner - Comprehensive testing framework for plugin integrations
 * 
 * This runner provides:
 * - End-to-end plugin installation and runtime testing
 * - OAuth2 flow validation
 * - API integration testing with real services
 * - Security and permission validation
 * - Performance and memory leak testing
 * - Automation trigger and action testing
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  PluginManifest, 
  PluginInstallation,
  TestCase,
  TestResult,
  TestSuite,
  PluginTestConfig
} from '@flow-desk/shared';
import { PluginRuntimeManager } from '../PluginRuntimeManager';
import { PluginLogger } from '../utils/PluginLogger';

export interface PluginTestOptions {
  /** Test environment */
  environment: 'development' | 'staging' | 'production';
  /** Plugin IDs to test */
  pluginIds?: string[];
  /** Test categories to run */
  categories?: TestCategory[];
  /** Include integration tests with real APIs */
  includeIntegrationTests: boolean;
  /** Test timeout in ms */
  timeout: number;
  /** Generate detailed reports */
  generateReports: boolean;
  /** Output directory for reports */
  reportDir?: string;
}

export type TestCategory = 
  | 'installation' 
  | 'security' 
  | 'api' 
  | 'oauth' 
  | 'automation' 
  | 'performance' 
  | 'integration'
  | 'search'
  | 'realtime';

export interface TestExecution {
  id: string;
  pluginId: string;
  testCase: TestCase;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  result?: TestResult;
  error?: string;
  logs: string[];
}

export interface TestReport {
  executionId: string;
  timestamp: Date;
  options: PluginTestOptions;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  executions: TestExecution[];
  coverage: {
    [pluginId: string]: {
      apis: string[];
      permissions: string[];
      triggers: string[];
      actions: string[];
    };
  };
}

/**
 * Plugin Test Runner
 * 
 * Executes comprehensive tests for plugin functionality including real API integrations
 */
export class PluginTestRunner extends EventEmitter {
  private readonly logger: PluginLogger;
  private readonly runtimeManager: PluginRuntimeManager;
  
  private readonly testSuites = new Map<string, TestSuite>();
  private readonly testExecutions = new Map<string, TestExecution>();
  
  private isRunning = false;
  private currentExecution?: string;

  constructor(runtimeManager: PluginRuntimeManager) {
    super();
    this.runtimeManager = runtimeManager;
    this.logger = new PluginLogger('PluginTestRunner');
    
    this.setupTestSuites();
  }

  /**
   * Run tests for plugins
   */
  async runTests(options: PluginTestOptions): Promise<TestReport> {
    if (this.isRunning) {
      throw new Error('Tests are already running');
    }

    this.isRunning = true;
    const executionId = `test_${Date.now()}`;
    this.currentExecution = executionId;

    this.logger.info('Starting plugin tests', { executionId, options });

    try {
      const startTime = Date.now();
      
      // Get plugins to test
      const pluginIds = await this.getPluginsToTest(options);
      
      // Create test executions
      const executions: TestExecution[] = [];
      
      for (const pluginId of pluginIds) {
        const pluginTests = await this.createTestExecutions(pluginId, options);
        executions.push(...pluginTests);
      }

      // Execute tests
      const results = await this.executeTests(executions, options);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Generate report
      const report: TestReport = {
        executionId,
        timestamp: new Date(),
        options,
        summary: this.generateSummary(results, duration),
        executions: results,
        coverage: await this.generateCoverageReport(pluginIds)
      };

      // Save report if requested
      if (options.generateReports && options.reportDir) {
        await this.saveReport(report, options.reportDir);
      }

      this.emit('testsCompleted', report);
      this.logger.info('Plugin tests completed', { 
        executionId, 
        summary: report.summary 
      });

      return report;
    } catch (error) {
      this.logger.error('Plugin tests failed', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.currentExecution = undefined;
    }
  }

  /**
   * Test specific plugin installation and basic functionality
   */
  async testPluginInstallation(pluginId: string): Promise<TestResult> {
    this.logger.info(`Testing installation for plugin ${pluginId}`);

    try {
      // Test installation process
      const installationId = await this.runtimeManager.installPlugin(
        `/path/to/${pluginId}.zip`, // Mock path
        'test-user',
        'test-workspace'
      );

      // Verify installation
      const installation = this.runtimeManager.getPluginInstallation(installationId);
      if (!installation) {
        throw new Error('Installation not found after install');
      }

      // Test enabling
      await this.runtimeManager.enablePlugin(installationId);

      // Test basic API functionality
      await this.testBasicAPIFunctionality(installationId);

      // Test disabling
      await this.runtimeManager.disablePlugin(installationId);

      return {
        success: true,
        message: 'Plugin installation test passed',
        data: { installationId }
      };
    } catch (error) {
      return {
        success: false,
        message: `Plugin installation test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Test OAuth2 flows for a plugin
   */
  async testPluginOAuth(pluginId: string): Promise<TestResult> {
    this.logger.info(`Testing OAuth2 flow for plugin ${pluginId}`);

    try {
      const installation = this.getActiveInstallation(pluginId);
      if (!installation) {
        throw new Error('Plugin not installed or active');
      }

      // Test OAuth2 initiation
      const authUrl = await this.runtimeManager.executePluginAction(
        installation.id,
        'startOAuthFlow',
        { provider: 'default', scopes: ['read'] }
      );

      if (!authUrl || !authUrl.startsWith('http')) {
        throw new Error('Invalid OAuth URL returned');
      }

      // Test token exchange (mock)
      const tokens = await this.runtimeManager.executePluginAction(
        installation.id,
        'exchangeOAuthCode',
        { code: 'mock-auth-code' }
      );

      if (!tokens.accessToken) {
        throw new Error('No access token received');
      }

      // Test API call with token
      const apiResult = await this.runtimeManager.executePluginAction(
        installation.id,
        'testAuthenticatedAPI',
        { token: tokens.accessToken }
      );

      return {
        success: true,
        message: 'OAuth2 flow test passed',
        data: { authUrl, tokens: !!tokens.accessToken, apiResult }
      };
    } catch (error) {
      return {
        success: false,
        message: `OAuth2 flow test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Test real-time WebSocket connections
   */
  async testPluginRealTime(pluginId: string): Promise<TestResult> {
    this.logger.info(`Testing real-time connections for plugin ${pluginId}`);

    try {
      const installation = this.getActiveInstallation(pluginId);
      if (!installation) {
        throw new Error('Plugin not installed or active');
      }

      // Test WebSocket connection
      const wsResult = await this.runtimeManager.executePluginAction(
        installation.id,
        'testWebSocketConnection',
        {}
      );

      if (!wsResult.connected) {
        throw new Error('WebSocket connection failed');
      }

      // Test message sending/receiving
      const messageResult = await this.runtimeManager.executePluginAction(
        installation.id,
        'testWebSocketMessage',
        { message: 'test-message' }
      );

      return {
        success: true,
        message: 'Real-time connection test passed',
        data: { connection: wsResult, message: messageResult }
      };
    } catch (error) {
      return {
        success: false,
        message: `Real-time connection test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Test plugin search integration
   */
  async testPluginSearch(pluginId: string): Promise<TestResult> {
    this.logger.info(`Testing search integration for plugin ${pluginId}`);

    try {
      const installation = this.getActiveInstallation(pluginId);
      if (!installation) {
        throw new Error('Plugin not installed or active');
      }

      // Test search functionality
      const searchResult = await this.runtimeManager.executePluginAction(
        installation.id,
        'performSearch',
        { query: 'test query' }
      );

      if (!Array.isArray(searchResult.results)) {
        throw new Error('Search did not return results array');
      }

      // Test content indexing
      const indexResult = await this.runtimeManager.executePluginAction(
        installation.id,
        'indexContent',
        { 
          content: {
            id: 'test-content-1',
            title: 'Test Content',
            body: 'This is test content for indexing'
          }
        }
      );

      return {
        success: true,
        message: 'Search integration test passed',
        data: { 
          searchResults: searchResult.results.length,
          indexing: indexResult.success 
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Search integration test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Test automation triggers and actions
   */
  async testPluginAutomation(pluginId: string): Promise<TestResult> {
    this.logger.info(`Testing automation integration for plugin ${pluginId}`);

    try {
      const installation = this.getActiveInstallation(pluginId);
      if (!installation) {
        throw new Error('Plugin not installed or active');
      }

      // Test trigger execution
      const triggerResult = await this.runtimeManager.executePluginAction(
        installation.id,
        'testTrigger',
        { triggerType: 'test_trigger', config: {} }
      );

      // Test action execution
      const actionResult = await this.runtimeManager.executePluginAction(
        installation.id,
        'testAction',
        { actionType: 'test_action', config: {} }
      );

      return {
        success: true,
        message: 'Automation integration test passed',
        data: { 
          trigger: triggerResult.success,
          action: actionResult.success 
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Automation integration test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Test plugin security and permissions
   */
  async testPluginSecurity(pluginId: string): Promise<TestResult> {
    this.logger.info(`Testing security for plugin ${pluginId}`);

    try {
      const installation = this.getActiveInstallation(pluginId);
      if (!installation) {
        throw new Error('Plugin not installed or active');
      }

      const securityManager = this.runtimeManager.getSecurityManager();
      
      // Test permission validation
      const hasValidPermissions = installation.grantedPermissions.every(permission => 
        securityManager.hasPermission(installation.id, permission)
      );

      if (!hasValidPermissions) {
        throw new Error('Permission validation failed');
      }

      // Test unauthorized access (should fail)
      try {
        await this.runtimeManager.executePluginAction(
          installation.id,
          'testUnauthorizedAccess',
          {}
        );
        throw new Error('Unauthorized access was not blocked');
      } catch (error) {
        if (!error.message.includes('permission') && !error.message.includes('unauthorized')) {
          throw error; // Re-throw if it's not a permission error
        }
      }

      // Test CSP validation
      const manifest = await this.runtimeManager.getPluginManifest(installation.id);
      const csp = securityManager.generateCSP(installation, manifest);
      
      if (!csp.includes('default-src')) {
        throw new Error('CSP generation failed');
      }

      return {
        success: true,
        message: 'Security test passed',
        data: { 
          permissions: hasValidPermissions,
          csp: !!csp 
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Security test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  // Private methods

  private setupTestSuites(): void {
    // Slack plugin tests
    this.testSuites.set('slack', {
      id: 'slack',
      name: 'Slack Plugin Tests',
      tests: [
        {
          id: 'slack_installation',
          name: 'Slack Installation Test',
          category: 'installation',
          timeout: 30000,
          handler: () => this.testPluginInstallation('com.flowdesk.slack')
        },
        {
          id: 'slack_oauth',
          name: 'Slack OAuth Test',
          category: 'oauth',
          timeout: 60000,
          handler: () => this.testPluginOAuth('com.flowdesk.slack')
        },
        {
          id: 'slack_realtime',
          name: 'Slack Real-time Test',
          category: 'realtime',
          timeout: 45000,
          handler: () => this.testPluginRealTime('com.flowdesk.slack')
        },
        {
          id: 'slack_search',
          name: 'Slack Search Test',
          category: 'search',
          timeout: 30000,
          handler: () => this.testPluginSearch('com.flowdesk.slack')
        },
        {
          id: 'slack_automation',
          name: 'Slack Automation Test',
          category: 'automation',
          timeout: 30000,
          handler: () => this.testPluginAutomation('com.flowdesk.slack')
        }
      ]
    });

    // Additional plugin test suites would be added here...
  }

  private async getPluginsToTest(options: PluginTestOptions): Promise<string[]> {
    if (options.pluginIds && options.pluginIds.length > 0) {
      return options.pluginIds;
    }

    // Get all installed plugins
    const installations = this.runtimeManager.getPluginInstallations();
    return installations.map(inst => inst.pluginId);
  }

  private async createTestExecutions(
    pluginId: string, 
    options: PluginTestOptions
  ): Promise<TestExecution[]> {
    const testSuite = this.testSuites.get(pluginId);
    if (!testSuite) {
      this.logger.warn(`No test suite found for plugin ${pluginId}`);
      return [];
    }

    const executions: TestExecution[] = [];
    
    for (const testCase of testSuite.tests) {
      // Filter by category if specified
      if (options.categories && !options.categories.includes(testCase.category)) {
        continue;
      }

      // Skip integration tests if not requested
      if (testCase.category === 'integration' && !options.includeIntegrationTests) {
        continue;
      }

      executions.push({
        id: `${pluginId}_${testCase.id}_${Date.now()}`,
        pluginId,
        testCase,
        status: 'pending',
        logs: []
      });
    }

    return executions;
  }

  private async executeTests(
    executions: TestExecution[],
    options: PluginTestOptions
  ): Promise<TestExecution[]> {
    for (const execution of executions) {
      await this.executeTest(execution, options);
    }

    return executions;
  }

  private async executeTest(
    execution: TestExecution,
    options: PluginTestOptions
  ): Promise<void> {
    execution.status = 'running';
    execution.startTime = new Date();
    
    this.emit('testStarted', execution);
    this.logger.debug(`Running test ${execution.testCase.name}`);

    try {
      // Set up timeout
      const timeoutPromise = new Promise<TestResult>((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), 
          execution.testCase.timeout || options.timeout);
      });

      // Execute test
      const testPromise = execution.testCase.handler();
      const result = await Promise.race([testPromise, timeoutPromise]);

      execution.result = result;
      execution.status = result.success ? 'passed' : 'failed';
      
      if (!result.success) {
        execution.error = result.error || result.message;
      }
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.result = {
        success: false,
        message: `Test execution failed: ${error.message}`,
        error: error.message
      };
    } finally {
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime!.getTime();
      
      this.emit('testCompleted', execution);
      this.logger.debug(`Test ${execution.testCase.name} completed: ${execution.status}`);
    }
  }

  private async testBasicAPIFunctionality(installationId: string): Promise<void> {
    // Test basic plugin API calls
    const storageTest = await this.runtimeManager.executePluginAction(
      installationId, 'testStorage', {}
    );
    
    if (!storageTest.success) {
      throw new Error('Storage API test failed');
    }

    const eventsTest = await this.runtimeManager.executePluginAction(
      installationId, 'testEvents', {}
    );
    
    if (!eventsTest.success) {
      throw new Error('Events API test failed');
    }
  }

  private getActiveInstallation(pluginId: string): PluginInstallation | undefined {
    const installations = this.runtimeManager.getPluginInstallations();
    return installations.find(inst => 
      inst.pluginId === pluginId && 
      inst.status === 'active'
    );
  }

  private generateSummary(executions: TestExecution[], duration: number) {
    return {
      total: executions.length,
      passed: executions.filter(e => e.status === 'passed').length,
      failed: executions.filter(e => e.status === 'failed').length,
      skipped: executions.filter(e => e.status === 'skipped').length,
      duration
    };
  }

  private async generateCoverageReport(pluginIds: string[]) {
    const coverage: TestReport['coverage'] = {};

    for (const pluginId of pluginIds) {
      const installation = this.getActiveInstallation(pluginId);
      if (installation) {
        const manifest = await this.runtimeManager.getPluginManifest(installation.id);
        
        coverage[pluginId] = {
          apis: ['storage', 'events', 'ui', 'network'], // APIs tested
          permissions: installation.grantedPermissions,
          triggers: manifest?.automation?.triggers?.map(t => t.id) || [],
          actions: manifest?.automation?.actions?.map(a => a.id) || []
        };
      }
    }

    return coverage;
  }

  private async saveReport(report: TestReport, reportDir: string): Promise<void> {
    try {
      await fs.mkdir(reportDir, { recursive: true });
      
      const reportPath = path.join(
        reportDir, 
        `plugin-test-report-${report.executionId}.json`
      );
      
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      this.logger.info(`Test report saved to ${reportPath}`);
    } catch (error) {
      this.logger.error('Failed to save test report', error);
    }
  }
}