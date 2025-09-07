/** @type {import('jest').Config} */
module.exports = {
  // Main process testing with Jest
  displayName: 'Main Process Tests',
  testMatch: [
    '<rootDir>/src/__tests__/main/**/*.test.{js,ts}',
    '<rootDir>/src/__tests__/integration/**/*.test.{js,ts}'
  ],
  
  // Test environment for Node.js (main process)
  testEnvironment: 'node',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/jestSetup.ts'],
  
  // Module transformation
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'es2020'
      }
    }]
  },
  
  // Module name mapping (correct property name)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
    '^@preload/(.*)$': '<rootDir>/src/preload/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@tests/(.*)$': '<rootDir>/src/__tests__/$1',
    'electron': '<rootDir>/src/__tests__/mocks/electron.mock.ts',
    'electron-log': '<rootDir>/src/__tests__/mocks/electron-log.mock.ts',
    'electron-store': '<rootDir>/src/__tests__/mocks/electron-store.mock.ts'
  },
  
  // Coverage configuration (disabled for now to focus on functionality)
  collectCoverage: false,
  
  // Test timeout
  testTimeout: 30000,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Error handling
  bail: false,
  errorOnDeprecated: false,
  
  // Files to ignore
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/src/__tests__/renderer/',
    '<rootDir>/src/__tests__/e2e/'
  ]
};