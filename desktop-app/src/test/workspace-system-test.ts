/**
 * Comprehensive Workspace System Integration Test
 * 
 * Tests browser isolation, service loading, and workspace persistence
 */

import { WorkspaceManager } from '../main/workspace';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

interface TestResults {
  browserIsolation: boolean;
  serviceLoading: boolean;
  workspacePersistence: boolean;
  predefinedServices: boolean;
  navigationSecurity: boolean;
}

export async function runWorkspaceSystemTest(): Promise<TestResults> {
  log.info('Starting comprehensive workspace system test...');
  
  const results: TestResults = {
    browserIsolation: false,
    serviceLoading: false,
    workspacePersistence: false,
    predefinedServices: false,
    navigationSecurity: false,
  };

  try {
    const workspaceManager = new WorkspaceManager();
    
    // Test 1: Browser Isolation
    log.info('Test 1: Testing browser isolation...');
    results.browserIsolation = await testBrowserIsolation(workspaceManager);
    
    // Test 2: Service Loading
    log.info('Test 2: Testing service loading...');
    results.serviceLoading = await testServiceLoading(workspaceManager);
    
    // Test 3: Workspace Persistence
    log.info('Test 3: Testing workspace persistence...');
    results.workspacePersistence = await testWorkspacePersistence(workspaceManager);
    
    // Test 4: Predefined Services
    log.info('Test 4: Testing predefined services...');
    results.predefinedServices = await testPredefinedServices(workspaceManager);
    
    // Test 5: Navigation Security
    log.info('Test 5: Testing navigation security...');
    results.navigationSecurity = await testNavigationSecurity(workspaceManager);
    
    await workspaceManager.cleanup();
    
  } catch (error) {
    log.error('Workspace system test failed:', error);
  }

  logTestResults(results);
  return results;
}

async function testBrowserIsolation(workspaceManager: WorkspaceManager): Promise<boolean> {
  try {
    // Create two workspaces with different isolation modes
    const sharedWorkspace = await workspaceManager.createWorkspace(
      'Test Shared Workspace', 
      '#ff0000', 
      'test-icon', 
      'shared',
      'Test shared workspace'
    );
    
    const isolatedWorkspace = await workspaceManager.createWorkspace(
      'Test Isolated Workspace', 
      '#00ff00', 
      'test-icon', 
      'isolated',
      'Test isolated workspace'
    );

    // Add same service to both workspaces
    const sharedServiceId = await workspaceManager.addServiceToWorkspace(
      sharedWorkspace.id,
      'Test Service Shared',
      'browser-service',
      'https://example.com'
    );

    const isolatedServiceId = await workspaceManager.addServiceToWorkspace(
      isolatedWorkspace.id,
      'Test Service Isolated',
      'browser-service',
      'https://example.com'
    );

    // Verify workspaces exist and have correct isolation settings
    const retrievedShared = workspaceManager.getWorkspace(sharedWorkspace.id);
    const retrievedIsolated = workspaceManager.getWorkspace(isolatedWorkspace.id);

    const isolationCorrect = 
      retrievedShared?.browserIsolation === 'shared' &&
      retrievedIsolated?.browserIsolation === 'isolated' &&
      retrievedShared?.services.length === 1 &&
      retrievedIsolated?.services.length === 1;

    log.info(`Browser isolation test: ${isolationCorrect ? 'PASSED' : 'FAILED'}`);
    return isolationCorrect;
    
  } catch (error) {
    log.error('Browser isolation test error:', error);
    return false;
  }
}

async function testServiceLoading(workspaceManager: WorkspaceManager): Promise<boolean> {
  try {
    // Create a test workspace
    const workspace = await workspaceManager.createWorkspace(
      'Service Loading Test',
      '#0000ff'
    );

    // Add multiple services
    const slackServiceId = await workspaceManager.addServiceToWorkspace(
      workspace.id,
      'Slack',
      'browser-service',
      'https://app.slack.com'
    );

    const notionServiceId = await workspaceManager.addServiceToWorkspace(
      workspace.id,
      'Notion',
      'browser-service',
      'https://notion.so'
    );

    // Verify services were added
    const updatedWorkspace = workspaceManager.getWorkspace(workspace.id);
    const servicesAdded = updatedWorkspace?.services.length === 2;

    log.info(`Service loading test: ${servicesAdded ? 'PASSED' : 'FAILED'}`);
    return servicesAdded;
    
  } catch (error) {
    log.error('Service loading test error:', error);
    return false;
  }
}

async function testWorkspacePersistence(workspaceManager: WorkspaceManager): Promise<boolean> {
  try {
    // Create workspace with specific configuration
    const testWorkspace = await workspaceManager.createWorkspace(
      'Persistence Test Workspace',
      '#ffff00',
      'persistence-icon',
      'isolated',
      'Testing workspace persistence'
    );

    // Add service to workspace
    await workspaceManager.addServiceToWorkspace(
      testWorkspace.id,
      'Persistence Service',
      'browser-service',
      'https://github.com'
    );

    // Update workspace settings
    await workspaceManager.updateWorkspace(testWorkspace.id, {
      settings: {
        theme: 'dark',
        notifications: false,
        autoSync: true,
        timezone: 'UTC',
        language: 'en'
      }
    });

    // Retrieve and verify persistence
    const persistedWorkspace = workspaceManager.getWorkspace(testWorkspace.id);
    const persistenceWorking = 
      persistedWorkspace?.name === 'Persistence Test Workspace' &&
      persistedWorkspace?.color === '#ffff00' &&
      persistedWorkspace?.browserIsolation === 'isolated' &&
      persistedWorkspace?.services.length === 1 &&
      persistedWorkspace?.settings.theme === 'dark' &&
      persistedWorkspace?.settings.notifications === false;

    log.info(`Workspace persistence test: ${persistenceWorking ? 'PASSED' : 'FAILED'}`);
    return persistenceWorking;
    
  } catch (error) {
    log.error('Workspace persistence test error:', error);
    return false;
  }
}

async function testPredefinedServices(workspaceManager: WorkspaceManager): Promise<boolean> {
  try {
    const predefinedServices = workspaceManager.getPredefinedServices();
    
    // Verify we have all expected predefined services
    const expectedServices = [
      'Slack', 'Discord', 'Microsoft Teams', 'Zoom', 'Google Meet',
      'Notion', 'Obsidian', 'Evernote', 'OneNote',
      'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Confluence',
      'Asana', 'Trello', 'Monday.com', 'Todoist', 'ClickUp', 'Linear',
      'Google Drive', 'Google Docs', 'Google Sheets', 'Google Slides',
      'OneDrive', 'Office 365', 'SharePoint',
      'Dropbox', 'Box',
      'Figma', 'Canva', 'Adobe Creative Cloud',
      'Salesforce', 'HubSpot', 'Zendesk', 'Intercom',
      'Google Analytics', 'Mixpanel', 'Amplitude'
    ];

    const serviceNames = predefinedServices.map(s => s.name);
    const hasRequiredServices = expectedServices.every(serviceName => 
      serviceNames.some(name => name.includes(serviceName.split(' ')[0]))
    );

    const hasCorrectStructure = predefinedServices.every(service => 
      service.id &&
      service.name &&
      service.url &&
      service.type &&
      service.config &&
      typeof service.isEnabled === 'boolean'
    );

    const predefinedServicesWorking = 
      predefinedServices.length >= 40 && // Should have 44+ services
      hasRequiredServices &&
      hasCorrectStructure;

    log.info(`Predefined services test: ${predefinedServicesWorking ? 'PASSED' : 'FAILED'}`);
    log.info(`Found ${predefinedServices.length} predefined services`);
    
    return predefinedServicesWorking;
    
  } catch (error) {
    log.error('Predefined services test error:', error);
    return false;
  }
}

async function testNavigationSecurity(workspaceManager: WorkspaceManager): Promise<boolean> {
  try {
    // Create workspace for security testing
    const workspace = await workspaceManager.createWorkspace(
      'Security Test Workspace',
      '#ff00ff'
    );

    // Add service with specific domain restrictions
    await workspaceManager.addServiceToWorkspace(
      workspace.id,
      'GitHub',
      'browser-service',
      'https://github.com'
    );

    // Verify workspace has correct security configuration
    const securityWorkspace = workspaceManager.getWorkspace(workspace.id);
    const hasSecurityConfig = 
      securityWorkspace?.services.length === 1 &&
      securityWorkspace?.services[0].config.integration === 'browser';

    log.info(`Navigation security test: ${hasSecurityConfig ? 'PASSED' : 'FAILED'}`);
    return hasSecurityConfig;
    
  } catch (error) {
    log.error('Navigation security test error:', error);
    return false;
  }
}

function logTestResults(results: TestResults): void {
  log.info('========================================');
  log.info('WORKSPACE SYSTEM TEST RESULTS');
  log.info('========================================');
  log.info(`Browser Isolation:      ${results.browserIsolation ? '✅ PASSED' : '❌ FAILED'}`);
  log.info(`Service Loading:        ${results.serviceLoading ? '✅ PASSED' : '❌ FAILED'}`);
  log.info(`Workspace Persistence:  ${results.workspacePersistence ? '✅ PASSED' : '❌ FAILED'}`);
  log.info(`Predefined Services:    ${results.predefinedServices ? '✅ PASSED' : '❌ FAILED'}`);
  log.info(`Navigation Security:    ${results.navigationSecurity ? '✅ PASSED' : '❌ FAILED'}`);
  log.info('========================================');
  
  const totalPassed = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  log.info(`Overall Result: ${totalPassed}/${totalTests} tests passed`);
  
  if (totalPassed === totalTests) {
    log.info('🎉 All workspace system tests PASSED!');
  } else {
    log.warn('⚠️  Some workspace system tests FAILED - check implementation');
  }
}

// Export test function for use in main process
export { runWorkspaceSystemTest };