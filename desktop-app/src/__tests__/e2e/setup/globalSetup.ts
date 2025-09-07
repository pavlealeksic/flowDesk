/**
 * Global setup for Playwright E2E tests
 * Handles Electron app building and preparation
 */

import { FullConfig } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

let buildProcess: ChildProcess | null = null;

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🔧 Setting up E2E test environment...');

  try {
    // Clean up any existing test data
    await cleanupTestData();

    // Build the Electron application for testing
    await buildElectronApp();

    // Wait for build to complete
    await waitForBuild();

    console.log('✅ E2E test environment ready');
  } catch (error) {
    console.error('❌ Failed to setup E2E test environment:', error);
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
      console.log(`🧹 Cleaned up test directory: ${dir}`);
    } catch (error) {
      // Directory might not exist, which is fine
      console.log(`ℹ️  Test directory doesn't exist or already clean: ${dir}`);
    }
  }
}

async function buildElectronApp(): Promise<void> {
  console.log('🔨 Building Electron application...');

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
        console.log('✅ Electron application built successfully');
        resolve();
      } else {
        console.error('❌ Electron build failed with code:', code);
        console.error('Build stdout:', stdout);
        console.error('Build stderr:', stderr);
        reject(new Error(`Build process exited with code ${code}`));
      }
    });

    buildProcess.on('error', (error) => {
      console.error('❌ Failed to start build process:', error);
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

  console.log('⏳ Waiting for build artifacts...');

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
        console.log('✅ All required build artifacts found');
        return;
      }
    } catch (error) {
      console.log('⏳ Still waiting for build artifacts...');
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error('Timeout waiting for build artifacts');
}

export default globalSetup;