/**
 * Playwright fixture for Electron application
 * Handles launching and managing the Electron app for E2E tests
 */

import { test as base, ElectronApplication, Page, _electron as electron } from '@playwright/test';
import path from 'path';

export interface ElectronFixture {
  electronApp: ElectronApplication;
  page: Page;
}

export const test = base.extend<ElectronFixture>({
  electronApp: async ({ }, use) => {
    // Launch Electron app
    const electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../../dist/desktop-app/src/main/main.js'),
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--enable-features=OverlayScrollbar'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1'
      }
    });

    // Wait for the app to be ready
    await electronApp.evaluate(async ({ app }) => {
      return app.whenReady();
    });

    await use(electronApp);

    // Close the app
    await electronApp.close();
  },

  page: async ({ electronApp }, use) => {
    // Get the first BrowserWindow
    const page = await electronApp.firstWindow();
    
    // Ensure the page is ready
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for React to mount
    await page.waitForSelector('[data-testid="app-root"], main', { 
      timeout: 30000 
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';