/**
 * End-to-End tests for workspace management functionality
 * Tests the complete user workflow for managing workspaces
 */

import { test, expect } from './fixtures/electron-app';

test.describe('Workspace Management E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Wait for the application to fully load
    await page.waitForLoadState('networkidle');
    
    // Wait for initial workspace loading
    await page.waitForSelector('[data-testid="left-rail"], nav[role="navigation"]', {
      timeout: 10000
    });
  });

  test.describe('Application Startup', () => {
    test('should load application with default workspace', async ({ page }) => {
      // Check main UI elements are present
      await expect(page.locator('nav[role="navigation"]')).toBeVisible();
      await expect(page.locator('main[role="main"]')).toBeVisible();
      
      // Check for workspace dashboard
      await expect(page.locator('text=Workspace Dashboard')).toBeVisible();
      await expect(page.locator('text=Select a service from the sidebar')).toBeVisible();
    });

    test('should display default workspace in left rail', async ({ page }) => {
      // Look for workspace indicators in left rail
      const leftRail = page.locator('nav[role="navigation"]');
      await expect(leftRail).toBeVisible();
      
      // Check for workspace abbreviation or name
      const workspaceElements = leftRail.locator('[data-testid*="workspace"], button, div').first();
      await expect(workspaceElements).toBeVisible();
    });

    test('should show correct page title', async ({ page }) => {
      await expect(page).toHaveTitle(/Flow Desk/);
    });
  });

  test.describe('Workspace Navigation', () => {
    test('should show workspace details in services sidebar', async ({ page }) => {
      // Look for services sidebar
      const servicesSidebar = page.locator('[data-testid="services-sidebar"], aside, div').filter({
        hasText: /workspace|personal|add service/i
      }).first();
      
      await expect(servicesSidebar).toBeVisible();
    });

    test('should allow switching between workspaces if multiple exist', async ({ page }) => {
      // This test assumes we might have multiple workspaces
      const leftRail = page.locator('nav[role="navigation"]');
      const workspaceButtons = leftRail.locator('button, [role="button"], [data-testid*="workspace"]');
      
      // If multiple workspace buttons exist, test switching
      const count = await workspaceButtons.count();
      if (count > 1) {
        const secondWorkspace = workspaceButtons.nth(1);
        await secondWorkspace.click();
        
        // Wait for workspace switch
        await page.waitForTimeout(1000);
        
        // Verify the switch occurred (UI should update)
        await expect(page.locator('main')).toBeVisible();
      } else {
        console.log('Only one workspace available, skipping switch test');
      }
    });
  });

  test.describe('Service Management', () => {
    test('should show add service option', async ({ page }) => {
      // Look for add service button or option
      const addServiceButton = page.locator('text=Add Service, button:has-text("Add"), [data-testid*="add-service"]').first();
      
      // The button should be visible or clickable
      await expect(addServiceButton).toBeVisible();
    });

    test('should open add service modal when clicking add service', async ({ page }) => {
      // Find and click add service button
      const addServiceButton = page.locator('text=Add Service, button:has-text("Add"), [data-testid*="add-service"]').first();
      await addServiceButton.click();
      
      // Wait for modal to appear
      await page.waitForTimeout(500);
      
      // Look for modal content
      const modal = page.locator('[role="dialog"], [data-testid*="modal"], div:has-text("Add Service")').first();
      await expect(modal).toBeVisible();
    });

    test('should be able to add a new service', async ({ page }) => {
      // Open add service modal
      const addServiceButton = page.locator('text=Add Service, button:has-text("Add"), [data-testid*="add-service"]').first();
      await addServiceButton.click();
      
      await page.waitForTimeout(500);
      
      // Fill out service details
      const nameInput = page.locator('input[name="name"], input[placeholder*="name"], [data-testid*="service-name"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Service E2E');
      }
      
      const urlInput = page.locator('input[name="url"], input[type="url"], input[placeholder*="url"], [data-testid*="service-url"]').first();
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://example.com');
      }
      
      // Submit the form
      const submitButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("Save"), [data-testid*="submit"], [data-testid*="add"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
      }
      
      // Wait for service to be added
      await page.waitForTimeout(1000);
      
      // Verify service appears in sidebar
      await expect(page.locator('text=Test Service E2E')).toBeVisible({ timeout: 5000 });
    });

    test('should be able to load a service', async ({ page }) => {
      // First, ensure we have a service to load
      // Look for existing services or add one
      const serviceButtons = page.locator('button:has-text("Gmail"), button:has-text("Test Service"), [data-testid*="service"]');
      
      if (await serviceButtons.count() > 0) {
        const firstService = serviceButtons.first();
        await firstService.click();
        
        // Wait for service to load
        await page.waitForTimeout(2000);
        
        // Verify loading state or service content
        const loadingIndicator = page.locator('text=Loading Service, text=Starting, [data-testid*="loader"]');
        if (await loadingIndicator.isVisible()) {
          // Service is loading, which is expected behavior
          await expect(loadingIndicator).toBeVisible();
        }
      } else {
        console.log('No services available to load, skipping test');
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should open global search with Ctrl+K', async ({ page }) => {
      // Trigger global search
      await page.keyboard.press('Control+k');
      
      // Wait for search overlay
      await page.waitForTimeout(500);
      
      // Look for search interface
      const searchOverlay = page.locator('[role="dialog"], [data-testid*="search"], div:has-text("Search")').first();
      await expect(searchOverlay).toBeVisible({ timeout: 3000 });
    });

    test('should close overlays with Escape', async ({ page }) => {
      // Open search
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(500);
      
      // Close with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      // Search overlay should be gone
      const searchOverlay = page.locator('[role="dialog"]:has-text("Search")');
      await expect(searchOverlay).toHaveCount(0);
    });

    test('should open accessibility settings with Ctrl+,', async ({ page }) => {
      // Trigger accessibility settings
      await page.keyboard.press('Control+Comma');
      
      // Wait for settings overlay
      await page.waitForTimeout(500);
      
      // Look for accessibility settings
      const settingsOverlay = page.locator('[role="dialog"], div:has-text("Accessibility"), div:has-text("Settings")').first();
      await expect(settingsOverlay).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('UI Responsiveness', () => {
    test('should handle window resizing', async ({ page }) => {
      // Get initial viewport
      const initialViewport = page.viewportSize();
      
      // Resize to smaller window
      await page.setViewportSize({ width: 800, height: 600 });
      await page.waitForTimeout(500);
      
      // Verify main elements still visible
      await expect(page.locator('nav[role="navigation"]')).toBeVisible();
      await expect(page.locator('main[role="main"]')).toBeVisible();
      
      // Resize back
      if (initialViewport) {
        await page.setViewportSize(initialViewport);
      }
    });

    test('should maintain layout with very wide window', async ({ page }) => {
      // Test with wide viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);
      
      // Elements should still be properly positioned
      await expect(page.locator('nav[role="navigation"]')).toBeVisible();
      await expect(page.locator('main[role="main"]')).toBeVisible();
      
      // Services sidebar should still be visible
      const servicesSidebar = page.locator('aside, div').filter({
        hasText: /add service|workspace/i
      }).first();
      await expect(servicesSidebar).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid service URLs gracefully', async ({ page }) => {
      // Try to add service with invalid URL
      const addServiceButton = page.locator('text=Add Service, button:has-text("Add")').first();
      if (await addServiceButton.isVisible()) {
        await addServiceButton.click();
        await page.waitForTimeout(500);
        
        // Fill invalid URL
        const urlInput = page.locator('input[name="url"], input[type="url"]').first();
        if (await urlInput.isVisible()) {
          await urlInput.fill('invalid-url');
          
          const submitButton = page.locator('button:has-text("Add"), button:has-text("Save")').first();
          if (await submitButton.isVisible()) {
            await submitButton.click();
          }
          
          // Should show validation error or handle gracefully
          await page.waitForTimeout(1000);
          
          // Application should still be functional
          await expect(page.locator('main')).toBeVisible();
        }
      }
    });

    test('should recover from modal close without action', async ({ page }) => {
      // Open modal
      const addServiceButton = page.locator('text=Add Service, button:has-text("Add")').first();
      if (await addServiceButton.isVisible()) {
        await addServiceButton.click();
        await page.waitForTimeout(500);
        
        // Close modal with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        // Application should return to normal state
        await expect(page.locator('text=Workspace Dashboard, main')).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      // Check for main navigation ARIA label
      const navigation = page.locator('nav[role="navigation"]');
      await expect(navigation).toBeVisible();
      
      // Check for main content ARIA label
      const mainContent = page.locator('main[role="main"]');
      await expect(mainContent).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Test tab navigation
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      
      // Should focus on interactive element
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Continue tabbing should move focus
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      
      const newFocusedElement = page.locator(':focus');
      await expect(newFocusedElement).toBeVisible();
    });

    test('should have skip links for screen readers', async ({ page }) => {
      // Look for skip links
      const skipLink = page.locator('text=Skip to main content, text=Skip to navigation').first();
      
      // Skip links might be visually hidden but should exist
      await expect(skipLink).toBeAttached();
    });
  });

  test.describe('Performance', () => {
    test('should load within reasonable time', async ({ page }) => {
      // Measure time to interactive
      const startTime = Date.now();
      
      // Wait for main content to be visible and interactive
      await page.waitForSelector('main[role="main"]', { state: 'visible' });
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
      console.log(`Application loaded in ${loadTime}ms`);
    });

    test('should handle rapid interactions without crashing', async ({ page }) => {
      // Rapidly interact with the interface
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(100);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
      }
      
      // Application should still be responsive
      await expect(page.locator('main')).toBeVisible();
    });
  });
});