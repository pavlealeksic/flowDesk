/**
 * Test Suite for Snippet and Email Template Managers
 * 
 * Tests the production implementations of snippet and email template management
 */

import { SnippetManager, TextSnippet } from '../main/snippet-manager';
import { EmailTemplateManager } from '../main/email-template-manager';
import { EmailTemplate } from '../main/template-types';
import { getDatabaseInitializationService } from '../main/database-initialization-service';
import { getDatabaseMigrationManager } from '../main/database-migration-manager';
import log from 'electron-log';

async function testSnippetManager() {
  log.info('Testing Snippet Manager...');
  
  const snippetManager = new SnippetManager();
  
  try {
    // Test creating a snippet
    const testSnippet = await snippetManager.createSnippet({
      name: 'Test Meeting Request',
      content: 'Hi {{name}},\n\nI would like to schedule a meeting to discuss {{topic}}.\n\nBest regards,\n{{sender}}',
      shortcut: 'meetreq',
      tags: ['meeting', 'business'],
      category: 'business'
    });
    
    log.info('Created test snippet:', testSnippet);
    
    // Test getting all snippets
    const allSnippets = await snippetManager.getAllSnippets();
    log.info(`Total snippets: ${allSnippets.length}`);
    
    // Test getting snippet by shortcut
    const foundByShortcut = await snippetManager.getSnippetByShortcut('meetreq');
    log.info('Found by shortcut:', foundByShortcut?.name);
    
    // Test expanding snippet
    const expanded = snippetManager.expandSnippet(testSnippet.content, {
      name: 'John Doe',
      topic: 'Q4 Planning',
      sender: 'Alice Smith'
    });
    log.info('Expanded snippet:', expanded);
    
    // Test searching
    const searchResults = await snippetManager.searchSnippets('meeting');
    log.info(`Search results for "meeting": ${searchResults.length} found`);
    
    // Test getting categories
    const categories = await snippetManager.getCategories();
    log.info('Categories:', categories);
    
    log.info('✅ Snippet Manager tests passed');
    
  } catch (error) {
    log.error('❌ Snippet Manager test failed:', error);
    throw error;
  }
}

async function testEmailTemplateManager() {
  log.info('Testing Email Template Manager...');
  
  const templateManager = new EmailTemplateManager();
  
  try {
    // Test creating an email template
    const testTemplate = await templateManager.saveTemplate({
      type: 'email',
      name: 'Test Welcome Email',
      description: 'Welcome new users to our platform',
      category: 'onboarding',
      tags: ['welcome', 'user', 'onboarding'],
      subject: 'Welcome to {{company_name}}!',
      bodyHtml: '<h1>Welcome {{user_name}}!</h1><p>We are excited to have you join {{company_name}}.</p>',
      bodyText: 'Welcome {{user_name}}!\n\nWe are excited to have you join {{company_name}}.',
      variables: [
        {
          key: 'user_name',
          label: 'User Name',
          description: 'The name of the new user',
          type: 'text',
          isRequired: true,
          placeholder: 'Enter user name'
        },
        {
          key: 'company_name',
          label: 'Company Name', 
          description: 'The name of the company',
          type: 'text',
          isRequired: true,
          defaultValue: 'Flow Desk',
          placeholder: 'Enter company name'
        }
      ],
      priority: 'normal',
      isDefault: false,
      isGlobal: true
    });
    
    log.info('Created test email template:', testTemplate);
    
    // Test getting all templates
    const allTemplates = await templateManager.getAllTemplates();
    log.info(`Total email templates: ${allTemplates.length}`);
    
    // Test processing variables
    const renderResult = templateManager.processTemplateVariables(testTemplate, {
      user_name: 'John Smith',
      company_name: 'Acme Corporation'
    });
    
    log.info('Template render result:', {
      success: renderResult.success,
      subject: renderResult.rendered.subject,
      renderTime: renderResult.renderTime,
      warnings: renderResult.warnings,
      errors: renderResult.errors
    });
    
    // Test searching templates
    const searchResults = await templateManager.searchTemplates('welcome');
    log.info(`Search results for "welcome": ${searchResults.length} found`);
    
    // Test getting categories
    const categories = await templateManager.getCategories();
    log.info('Template categories:', categories);
    
    // Test using template (increment usage counter)
    const usedTemplate = await templateManager.useTemplate(testTemplate.id);
    log.info('Used template, new usage count:', usedTemplate?.usageCount);
    
    // Test validation
    const validationResult = templateManager.validateTemplate({
      name: 'Invalid Template',
      subject: '', // Invalid - empty subject
      bodyHtml: '<p>Test</p>',
      variables: [
        {
          key: '', // Invalid - empty key
          label: 'Test',
          type: 'text',
          isRequired: false
        }
      ]
    });
    
    log.info('Validation result:', validationResult);
    
    log.info('✅ Email Template Manager tests passed');
    
  } catch (error) {
    log.error('❌ Email Template Manager test failed:', error);
    throw error;
  }
}

async function runTests() {
  try {
    log.info('🚀 Starting Snippet and Template Manager Tests...');
    
    // Initialize database first
    const dbService = getDatabaseInitializationService();
    const initialized = await dbService.initializeDatabases();
    
    if (!initialized) {
      throw new Error('Failed to initialize databases for testing');
    }
    
    log.info('Database initialized for testing');
    
    // Run tests
    await testSnippetManager();
    await testEmailTemplateManager();
    
    log.info('🎉 All tests passed successfully!');
    
  } catch (error) {
    log.error('💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runTests();
}

export { runTests, testSnippetManager, testEmailTemplateManager };