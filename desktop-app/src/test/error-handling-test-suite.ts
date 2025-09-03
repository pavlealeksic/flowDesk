/**
 * Comprehensive Error Handling Test Suite
 * 
 * Tests all aspects of the error handling system including Rust communication,
 * circuit breakers, graceful degradation, and user notifications.
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { EventEmitter } from 'events';
import { 
  RustErrorHandler,
  CircuitBreaker,
  CircuitState,
  safeRustCall,
  resilientRustCall,
  criticalRustCall,
  formatErrorForUser
} from '../main/rust-error-handler';
import {
  GracefulDegradationManager,
  DegradationLevel,
  getGracefulDegradationManager
} from '../main/graceful-degradation';
import {
  UserNotificationManager,
  NotificationType,
  ActionType,
  getUserNotificationManager
} from '../main/user-error-notifications';

describe('Error Handling System', () => {
  let rustErrorHandler: RustErrorHandler;
  let degradationManager: GracefulDegradationManager;
  let notificationManager: UserNotificationManager;

  beforeEach(() => {
    rustErrorHandler = new RustErrorHandler();
    degradationManager = new GracefulDegradationManager();
    notificationManager = new UserNotificationManager();
  });

  afterEach(() => {
    // Clean up any intervals or timeouts
    rustErrorHandler.clearErrorStatistics();
    if ((degradationManager as any).healthCheckInterval) {
      clearInterval((degradationManager as any).healthCheckInterval);
    }
  });

  describe('Circuit Breaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1000,
        halfOpenMaxCalls: 2
      });
    });

    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).to.equal(CircuitState.CLOSED);
    });

    it('should transition to OPEN after threshold failures', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // First two failures should keep circuit CLOSED
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected
        }
        expect(circuitBreaker.getState()).to.equal(CircuitState.CLOSED);
      }

      // Third failure should open the circuit
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected
      }
      expect(circuitBreaker.getState()).to.equal(CircuitState.OPEN);
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Force circuit to OPEN state
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected
        }
      }
      expect(circuitBreaker.getState()).to.equal(CircuitState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next execution should transition to HALF_OPEN
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected
      }
      expect(circuitBreaker.getState()).to.equal(CircuitState.HALF_OPEN);
    });

    it('should reset to CLOSED on successful execution', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      const successfulOperation = async () => {
        return 'success';
      };

      // Force circuit to OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected
        }
      }

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Successful operation should reset circuit
      const result = await circuitBreaker.execute(successfulOperation);
      expect(result).to.equal('success');
      expect(circuitBreaker.getState()).to.equal(CircuitState.CLOSED);
    });
  });

  describe('Rust Error Handler', () => {
    it('should retry failed operations', async () => {
      let attemptCount = 0;
      const operation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await safeRustCall('test_operation', operation, {
        retryAttempts: 3
      });

      expect(result).to.equal('success');
      expect(attemptCount).to.equal(3);
    });

    it('should use fallback when primary operation fails', async () => {
      const failingOperation = async () => {
        throw new Error('Primary operation failed');
      };

      const fallbackOperation = async () => {
        return 'fallback_result';
      };

      const result = await resilientRustCall(
        'test_operation',
        failingOperation,
        fallbackOperation
      );

      expect(result).to.equal('fallback_result');
    });

    it('should track error statistics', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      try {
        await safeRustCall('test_operation', failingOperation, {
          retryAttempts: 1
        });
      } catch (error) {
        // Expected
      }

      const stats = rustErrorHandler.getErrorStatistics();
      expect(stats['test_operation']).to.exist;
      expect(stats['test_operation'].count).to.be.greaterThan(0);
    });

    it('should emit error events', (done) => {
      const failingOperation = async () => {
        throw new Error('Test error');
      };

      rustErrorHandler.once('error', (errorInfo) => {
        expect(errorInfo.operationName).to.equal('test_operation');
        expect(errorInfo.error).to.exist;
        done();
      });

      safeRustCall('test_operation', failingOperation, {
        retryAttempts: 1
      }).catch(() => {
        // Expected
      });
    });

    it('should parse FlowDesk errors correctly', () => {
      const flowDeskErrorJson = JSON.stringify({
        error_type: 'authentication',
        message: 'Token expired',
        operation: 'sync_mail',
        component: 'mail',
        is_retryable: false,
        requires_user_action: true,
        severity: 'high',
        auth_url: 'https://accounts.google.com/oauth'
      });

      const error = new Error(flowDeskErrorJson);
      const parsedError = (rustErrorHandler as any).parseFlowDeskError(error);

      expect(parsedError.error_type).to.equal('authentication');
      expect(parsedError.requires_user_action).to.be.true;
      expect(parsedError.auth_url).to.equal('https://accounts.google.com/oauth');
    });
  });

  describe('Graceful Degradation Manager', () => {
    beforeEach(async () => {
      await degradationManager.initialize();
    });

    afterEach(() => {
      degradationManager.shutdown();
    });

    it('should initialize with no degradation', () => {
      const state = degradationManager.getCurrentState();
      expect(state.level).to.equal(DegradationLevel.NONE);
    });

    it('should detect service degradation', async () => {
      // Mock service health check to simulate failure
      const originalCheckHealth = (degradationManager as any).checkServiceHealth;
      (degradationManager as any).checkServiceHealth = sinon.stub().resolves(false);

      await degradationManager.forceServiceCheck();

      const state = degradationManager.getCurrentState();
      expect(state.level).to.not.equal(DegradationLevel.NONE);

      // Restore original method
      (degradationManager as any).checkServiceHealth = originalCheckHealth;
    });

    it('should provide fallback implementations', () => {
      const fallbacks = degradationManager.getFallbackImplementations();
      expect(fallbacks).to.exist;
      expect(fallbacks.fallbackMailSync).to.be.a('function');
      expect(fallbacks.fallbackSendMail).to.be.a('function');
      expect(fallbacks.fallbackCalendarSync).to.be.a('function');
    });

    it('should emit degradation change events', (done) => {
      degradationManager.once('degradation-changed', (event) => {
        expect(event.previousLevel).to.exist;
        expect(event.newLevel).to.exist;
        expect(event.state).to.exist;
        done();
      });

      // Force a degradation change
      (degradationManager as any).updateDegradationState(
        DegradationLevel.PARTIAL,
        { 'mail-sync': { available: false, degraded: true, fallbackActive: true, lastCheck: new Date() } }
      );
    });

    it('should track service availability', () => {
      const isMailAvailable = degradationManager.isServiceAvailable('mail-sync');
      const isFallbackActive = degradationManager.isFallbackActive('mail-sync');
      
      expect(typeof isMailAvailable).to.equal('boolean');
      expect(typeof isFallbackActive).to.equal('boolean');
    });
  });

  describe('User Notification Manager', () => {
    it('should create notifications from FlowDesk errors', () => {
      const flowDeskError = {
        error_type: 'authentication',
        message: 'Token expired',
        operation: 'sync_mail',
        component: 'mail',
        is_retryable: false,
        requires_user_action: true,
        severity: 'high' as const,
        auth_url: 'https://accounts.google.com/oauth',
        recovery_suggestion: 'Please re-authenticate your account',
        context: '{}'
      };

      const notificationId = notificationManager.showErrorNotification(flowDeskError);
      
      expect(notificationId).to.be.a('string');
      
      const activeNotifications = notificationManager.getActiveNotifications();
      expect(activeNotifications).to.have.length(1);
      
      const notification = activeNotifications[0];
      expect(notification.type).to.equal(NotificationType.ERROR);
      expect(notification.title).to.include('Authentication Required');
      expect(notification.actions).to.have.length.greaterThan(0);
      
      const reAuthAction = notification.actions.find(a => a.type === ActionType.OPEN_URL);
      expect(reAuthAction).to.exist;
      expect(reAuthAction?.url).to.equal('https://accounts.google.com/oauth');
    });

    it('should track notification history', () => {
      const notification = {
        id: 'test-notification',
        type: NotificationType.INFO,
        title: 'Test Notification',
        message: 'This is a test',
        actions: [],
        timestamp: new Date()
      };

      notificationManager.showNotification(notification);
      
      const history = notificationManager.getNotificationHistory();
      expect(history).to.have.length(1);
      expect(history[0].id).to.equal('test-notification');
    });

    it('should dismiss notifications', () => {
      const notification = {
        id: 'test-notification',
        type: NotificationType.INFO,
        title: 'Test Notification',
        message: 'This is a test',
        actions: [],
        timestamp: new Date()
      };

      notificationManager.showNotification(notification);
      expect(notificationManager.getActiveNotifications()).to.have.length(1);

      (notificationManager as any).dismissNotification('test-notification');
      expect(notificationManager.getActiveNotifications()).to.have.length(0);
    });

    it('should emit notification events', (done) => {
      notificationManager.once('notification-shown', (notification) => {
        expect(notification.id).to.equal('test-notification');
        done();
      });

      const notification = {
        id: 'test-notification',
        type: NotificationType.INFO,
        title: 'Test Notification',
        message: 'This is a test',
        actions: [],
        timestamp: new Date()
      };

      notificationManager.showNotification(notification);
    });

    it('should format errors for UI correctly', () => {
      const error = new Error('Test error');
      (error as any).flowDeskError = {
        error_type: 'network',
        message: 'Network connection failed',
        is_retryable: true,
        requires_user_action: false,
        severity: 'medium'
      };
      (error as any).isFlowDeskError = true;

      const formatted = formatErrorForUser(error);
      
      expect(formatted.title).to.equal('Connection Issue');
      expect(formatted.severity).to.equal('medium');
      expect(formatted.actions).to.have.length.greaterThan(0);
      
      const retryAction = formatted.actions.find(a => a.action === 'retry');
      expect(retryAction).to.exist;
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete error flow from Rust to UI', async () => {
      const mockWindow = new EventEmitter();
      mockWindow.webContents = {
        send: sinon.spy(),
        on: sinon.spy()
      } as any;

      const integratedNotificationManager = new UserNotificationManager(mockWindow as any);
      
      let notificationShown = false;
      integratedNotificationManager.on('notification-shown', (notification) => {
        notificationShown = true;
        expect(notification.type).to.equal(NotificationType.ERROR);
      });

      // Simulate a Rust error
      const flowDeskError = {
        error_type: 'authentication',
        message: 'Token expired',
        operation: 'sync_mail',
        component: 'mail',
        is_retryable: false,
        requires_user_action: true,
        severity: 'high' as const,
        auth_url: 'https://accounts.google.com/oauth',
        recovery_suggestion: 'Please re-authenticate your account',
        context: '{}'
      };

      integratedNotificationManager.showErrorNotification(flowDeskError);

      expect(notificationShown).to.be.true;
      expect((mockWindow.webContents.send as sinon.SinonSpy).calledWith('user-notification')).to.be.true;
    });

    it('should handle service degradation with fallbacks', async () => {
      const fallbacks = degradationManager.getFallbackImplementations();
      
      // Test mail sync fallback
      const mailSyncResult = await fallbacks.fallbackMailSync('test-account');
      expect(mailSyncResult.success).to.be.false; // No cached data initially
      expect(mailSyncResult.message).to.include('No cached mail data');

      // Test draft queueing
      const draftId = await fallbacks.fallbackSendMail('test-account', {
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Test message'
      });
      expect(draftId).to.be.a('string');
      expect(draftId).to.include('draft_');

      // Test search fallback
      const searchResults = await fallbacks.fallbackMailSearch('test query');
      expect(Array.isArray(searchResults)).to.be.true;
    });

    it('should recover from errors and process queued operations', async () => {
      const fallbacks = degradationManager.getFallbackImplementations();
      
      // Queue some operations
      await fallbacks.fallbackSendMail('account1', { subject: 'Test 1' });
      await fallbacks.fallbackSendMail('account2', { subject: 'Test 2' });
      await fallbacks.fallbackCreateEvent('calendar1', { title: 'Test Event' });

      // Process queued operations
      const result = await fallbacks.processQueuedOperations();
      
      expect(result.processed).to.be.greaterThan(0);
      expect(result.failed).to.equal(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle high frequency errors without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate many errors
      for (let i = 0; i < 1000; i++) {
        try {
          await safeRustCall(`test_operation_${i % 10}`, async () => {
            throw new Error(`Test error ${i}`);
          }, { retryAttempts: 1 });
        } catch (error) {
          // Expected
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).to.be.lessThan(50 * 1024 * 1024);
    });

    it('should handle concurrent error scenarios', async () => {
      const concurrentOperations = [];
      
      for (let i = 0; i < 50; i++) {
        concurrentOperations.push(
          safeRustCall(`concurrent_operation_${i}`, async () => {
            if (Math.random() < 0.3) {
              throw new Error(`Random failure ${i}`);
            }
            return `success_${i}`;
          }, { retryAttempts: 2 })
        );
      }

      const results = await Promise.allSettled(concurrentOperations);
      
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;
      
      expect(successes + failures).to.equal(50);
      expect(successes).to.be.greaterThan(0); // Some should succeed
      
      // Error handler should still be responsive
      const stats = rustErrorHandler.getErrorStatistics();
      expect(Object.keys(stats).length).to.be.greaterThan(0);
    });
  });
});

// Run the tests
if (require.main === module) {
  console.log('Running Error Handling Test Suite...');
  
  // In a real test environment, you would use a test runner like Mocha
  // This is a simplified version for demonstration
  const runTests = async () => {
    try {
      console.log('✅ All error handling tests would run here');
      console.log('📊 Test coverage: Circuit breakers, retry mechanisms, graceful degradation, user notifications');
      console.log('🔧 Integration tests: End-to-end error flows, service recovery, queue processing');
      console.log('⚡ Performance tests: Memory usage, concurrent errors, high frequency scenarios');
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    }
  };

  runTests();
}