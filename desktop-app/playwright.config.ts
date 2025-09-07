import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

/**
 * Playwright configuration for E2E testing of Electron application
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src/__tests__/e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/e2e-html-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }]
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Capture video on failure */
    video: 'retain-on-failure',
    
    /* Timeout for each action */
    actionTimeout: 30000,
    
    /* Timeout for navigation */
    navigationTimeout: 30000
  },

  /* Global setup and teardown */
  globalSetup: './src/__tests__/e2e/setup/globalSetup.ts',
  globalTeardown: './src/__tests__/e2e/setup/globalTeardown.ts',

  /* Configure projects for major browsers and Electron */
  projects: [
    {
      name: 'electron-setup',
      testMatch: /.*\.setup\.ts/,
    },
    
    {
      name: 'electron-e2e',
      use: {
        ...devices['Desktop Chrome'],
        // Custom Electron configuration will be added in setup
      },
      dependencies: ['electron-setup'],
      testMatch: /.*\.spec\.ts/,
    }
  ],

  /* Test timeouts */
  timeout: 60000,
  expect: {
    timeout: 10000
  },

  /* Output directories */
  outputDir: 'test-results/e2e-artifacts',

  /* Update snapshots with --update-snapshots */
  updateSnapshots: 'missing',

  /* Test file patterns */
  testMatch: [
    '**/e2e/**/*.spec.ts',
    '**/e2e/**/*.e2e.ts'
  ],

  /* Ignore patterns */
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.d.ts'
  ]
});