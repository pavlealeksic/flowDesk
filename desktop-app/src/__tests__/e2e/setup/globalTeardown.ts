/**
 * Global teardown for Playwright E2E tests
 * Handles cleanup after all tests complete
 */

import { FullConfig } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { useLogger } from '../logging/RendererLoggingService';

async function globalTeardown(config: FullConfig): Promise<void> {
  logger.debug('Console log', undefined, { originalArgs: ['🧹 Cleaning up E2E test environment...'], method: 'console.log' });

  try {
    // Clean up test artifacts
    await cleanupTestArtifacts();

    // Generate test summary
    await generateTestSummary();

    logger.debug('Console log', undefined, { originalArgs: ['✅ E2E test environment cleaned up'], method: 'console.log' });
  } catch (error) {
    logger.error('Console error', undefined, { originalArgs: ['❌ Failed to cleanup E2E test environment:', error], method: 'console.error' });
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
      logger.debug('Console log', undefined, { originalArgs: [`🗑️  Cleaned up: ${dir}`], method: 'console.log' });
    } catch (error) {
      logger.debug('Console log', undefined, { originalArgs: [`ℹ️  Could not clean up ${dir}:`, error], method: 'console.log' });
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
      logger.debug('Console log', undefined, { originalArgs: ['ℹ️  No test results directory found, skipping summary generation'], method: 'console.log' });
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
    logger.debug('Console log', undefined, { originalArgs: [`📊 Test summary generated: ${summaryFile}`], method: 'console.log' });
  } catch (error) {
    logger.debug('Console log', undefined, { originalArgs: ['ℹ️  Could not generate test summary:', error], method: 'console.log' });
  }
}

export default globalTeardown;