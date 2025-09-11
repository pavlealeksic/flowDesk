import { jest } from '@jest/globals';

// Setup for Node.js (main process) testing with Jest

// Mock Electron modules at the module level
jest.mock('electron', () => require('../mocks/electron.mock'));
jest.mock('electron-log', () => require('../mocks/electron-log.mock'));
jest.mock('electron-store', () => require('../mocks/electron-store.mock'));

// Mock Node.js modules that might be problematic in tests
jest.mock('crypto', () => ({
  randomBytes: jest.fn((size: number) => ({
    toString: jest.fn((encoding: string) => 'mock-random-string-' + size)
  }))
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/')),
  dirname: jest.fn((path: string) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path: string) => path.split('/').pop() || ''),
  extname: jest.fn((path: string) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  })
}));

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Mock timers if needed
  jest.useFakeTimers();
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset modules between tests
  jest.resetModules();
});

afterEach(() => {
  // Cleanup after each test
  jest.clearAllMocks();
  jest.clearAllTimers();
});

afterAll(() => {
  // Restore all mocks
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// Global error handler for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});