/**
 * Global setup for Playwright E2E tests
 * Handles Electron app building and preparation
 */

import { FullConfig } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { useLogger } from '../logging/RendererLoggingService';

let buildProcess: ChildProcess | null = null;

async function globalSetup(config: FullConfig): Promise<void> {
  logger.debug('Console log', undefined, { originalArgs: ['🔧 Setting up E2E test environment...'], method: 'console.log' });

  try {
    // Clean up any existing test data
    await cleanupTestData();

    // Build the Electron application for testing
    await buildElectronApp();

    // Wait for build to complete
    await waitForBuild();

    logger.debug('Console log', undefined, { originalArgs: ['✅ E2E test environment ready'], method: 'console.log' });
  } catch (error) {
    logger.error('Console error', undefined, { originalArgs: ['❌ Failed to setup E2E test environment:', error], method: 'console.error' });
    throw error;
  }
}

async function cleanupTestData(): Promise<void> {
  const testDataDirs = [
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), 'test-results'),
    path.join(process.cwd(), 'coverage/e2e')
  ];

  for (const dir of testDataDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      logger.debug('Console log', undefined, { originalArgs: [`🧹 Cleaned up test directory: ${dir}`], method: 'console.log' });
    } catch (error) {
      // Directory might not exist, which is fine
      logger.debug('Console log', undefined, { originalArgs: [`ℹ️  Test directory doesn't exist or already clean: ${dir}`], method: 'console.log' });
    }
  }
}

async function buildElectronApp(): Promise<void> {
  logger.debug('Console log', undefined, { originalArgs: ['🔨 Building Electron application...'], method: 'console.log' });

  return new Promise((resolve, reject) => {
    // Build the main and renderer processes
    buildProcess = spawn('npm', ['run', 'build'], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    buildProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    buildProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        logger.debug('Console log', undefined, { originalArgs: ['✅ Electron application built successfully'], method: 'console.log' });
        resolve();
      } else {
        logger.error('Console error', undefined, { originalArgs: ['❌ Electron build failed with code:', code], method: 'console.error' });
        logger.error('Console error', undefined, { originalArgs: ['Build stdout:', stdout], method: 'console.error' });
        logger.error('Console error', undefined, { originalArgs: ['Build stderr:', stderr], method: 'console.error' });
        reject(new Error(`Build process exited with code ${code}`));
      }
    });

    buildProcess.on('error', (error) => {
      logger.error('Console error', undefined, { originalArgs: ['❌ Failed to start build process:', error], method: 'console.error' });
      reject(error);
    });
  });
}

async function waitForBuild(): Promise<void> {
  const maxWaitTime = 60000; // 1 minute
  const checkInterval = 1000; // 1 second
  const startTime = Date.now();

  const requiredFiles = [
    'dist/desktop-app/src/main/main.js',
    'dist/desktop-app/src/preload/preload.js'
  ];

  logger.debug('Console log', undefined, { originalArgs: ['⏳ Waiting for build artifacts...'], method: 'console.log' });

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const allFilesExist = await Promise.all(
        requiredFiles.map(async (file) => {
          try {
            await fs.access(path.join(process.cwd(), file));
            return true;
          } catch {
            return false;
          }
        })
      );

      if (allFilesExist.every(exists => exists)) {
        logger.debug('Console log', undefined, { originalArgs: ['✅ All required build artifacts found'], method: 'console.log' });
        return;
      }
    } catch (error) {
      logger.debug('Console log', undefined, { originalArgs: ['⏳ Still waiting for build artifacts...'], method: 'console.log' });
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error('Timeout waiting for build artifacts');
}

export default globalSetup;