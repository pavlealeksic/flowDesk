/**
 * Mock for electron-log module
 * Provides jest mock functions for all electron-log functionality
 */

interface MockLogger {
  error: jest.Mock;
  warn: jest.Mock;
  info: jest.Mock;
  verbose: jest.Mock;
  debug: jest.Mock;
  silly: jest.Mock;
  log: jest.Mock;
}

interface MockTransport {
  level: string;
  format: string;
}

interface MockTransports {
  file: MockTransport;
  console: MockTransport;
  remote: MockTransport;
}

const createMockLogger = (): MockLogger => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
  log: jest.fn()
});

const mockLogger = createMockLogger();

const mockTransports: MockTransports = {
  file: {
    level: 'info',
    format: '{h}:{i}:{s}:{ms} {text}'
  },
  console: {
    level: 'debug',
    format: '{h}:{i}:{s}:{ms} {text}'
  },
  remote: {
    level: 'error',
    format: '{h}:{i}:{s}:{ms} {text}'
  }
};

const mockElectronLog = {
  ...mockLogger,
  transports: mockTransports,
  
  // Create new logger instance
  create: jest.fn().mockImplementation((name?: string) => createMockLogger()),
  
  // Log levels
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
    silly: 5
  },
  
  // Variables
  variables: {
    label: 'main',
    version: '1.0.0'
  },
  
  // Hooks
  hooks: {
    processMessage: {
      add: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  
  // Scope functionality
  scope: jest.fn().mockImplementation((label?: string) => ({
    ...createMockLogger(),
    label
  })),
  
  // Catch errors
  catchErrors: jest.fn(),
  
  // Initialize
  initialize: jest.fn(),
  
  // Error handling
  errorHandler: {
    startCatching: jest.fn(),
    stopCatching: jest.fn()
  }
};

// Export both default and named exports to handle different import styles
module.exports = mockElectronLog;
module.exports.default = mockElectronLog;