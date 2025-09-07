/**
 * Global teardown for Playwright E2E tests
 * Handles cleanup after all tests complete
 */

import { FullConfig } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('🧹 Cleaning up E2E test environment...');

  try {
    // Clean up test artifacts
    await cleanupTestArtifacts();

    // Generate test summary
    await generateTestSummary();

    console.log('✅ E2E test environment cleaned up');
  } catch (error) {
    console.error('❌ Failed to cleanup E2E test environment:', error);
    // Don't throw as this shouldn't fail the tests
  }
}

async function cleanupTestArtifacts(): Promise<void> {
  const artifactDirs = [
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), 'temp-e2e-data')
  ];

  for (const dir of artifactDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`🗑️  Cleaned up: ${dir}`);
    } catch (error) {
      console.log(`ℹ️  Could not clean up ${dir}:`, error);
    }
  }
}

async function generateTestSummary(): Promise<void> {
  try {
    const resultsDir = path.join(process.cwd(), 'test-results');
    const summaryFile = path.join(resultsDir, 'e2e-summary.json');

    // Check if results exist
    try {
      await fs.access(resultsDir);
    } catch {
      console.log('ℹ️  No test results directory found, skipping summary generation');
      return;
    }

    const summary = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      testRun: {
        type: 'e2e',
        framework: 'playwright',
        electronApp: 'Flow Desk'
      }
    };

    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`📊 Test summary generated: ${summaryFile}`);
  } catch (error) {
    console.log('ℹ️  Could not generate test summary:', error);
  }
}

export default globalTeardown;