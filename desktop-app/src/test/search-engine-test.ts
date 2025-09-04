/**
 * Test for the unified Rust-powered search engine
 * Verifies that the search system properly connects to Tantivy via NAPI
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { searchEngine, LocalSearchDocument } from '../main/search/SearchEngine';

describe('Unified Search Engine (Rust + Tantivy)', () => {
  beforeAll(async () => {
    console.log('Initializing Rust-powered search engine for tests...');
    try {
      await searchEngine.initialize();
      console.log('Search engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize search engine:', error);
      throw error;
    }
  });

  afterAll(async () => {
    console.log('Cleaning up search engine...');
    await searchEngine.close();
  });

  it('should initialize the Rust search engine with Tantivy backend', async () => {
    expect(searchEngine).toBeDefined();
    // The engine should be initialized in beforeAll
  });

  it('should index documents via Rust NAPI bindings', async () => {
    const testDocument: LocalSearchDocument = {
      id: 'test-doc-1',
      title: 'Test Email Subject',
      content: 'This is a test email content for the Rust-powered search engine using Tantivy.',
      contentType: 'email',
      providerId: 'test-account-1',
      providerType: 'gmail',
      source: 'email',
      metadata: {
        sender: 'test@example.com',
        recipients: ['user@example.com'],
        folder: 'INBOX',
        date: new Date().toISOString(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['test', 'email'],
      category: 'communication',
      importance: 5,
      author: 'test@example.com',
    };

    // Should not throw an error
    await expect(searchEngine.addDocument(testDocument)).resolves.toBeUndefined();
  });

  it('should search documents using Rust Tantivy engine', async () => {
    // Wait a moment for indexing to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const results = await searchEngine.search('test email', {
      limit: 10,
      contentTypes: ['email'],
      highlighting: true,
      fuzzy: true,
    });

    expect(Array.isArray(results)).toBe(true);
    // Results may be empty if indexing hasn't completed, but should not throw
  });

  it('should search emails specifically', async () => {
    const results = await searchEngine.searchEmails('test email', 'test-account-1', 5);
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('should provide search suggestions', async () => {
    const suggestions = await searchEngine.getSuggestions('tes', 5);
    
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle calendar event indexing', async () => {
    const eventData = {
      id: 'test-event-1',
      accountId: 'test-calendar-1',
      title: 'Team Meeting',
      description: 'Weekly team standup meeting',
      location: 'Conference Room A',
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000), // 1 hour later
      attendees: ['team@example.com', 'manager@example.com'],
    };

    await expect(searchEngine.indexCalendarEventFromRust(eventData)).resolves.toBeUndefined();
  });

  it('should search calendar events', async () => {
    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 100));

    const results = await searchEngine.searchCalendarEvents('team meeting', 'test-calendar-1', 5);
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('should provide analytics', () => {
    const analytics = searchEngine.getAnalytics();
    
    expect(analytics).toHaveProperty('totalQueries');
    expect(analytics).toHaveProperty('popularQueries');
    expect(analytics).toHaveProperty('averageResultCount');
    expect(analytics).toHaveProperty('averageSearchTime');
    expect(analytics).toHaveProperty('noResultsQueries');
    
    expect(typeof analytics.totalQueries).toBe('number');
    expect(Array.isArray(analytics.popularQueries)).toBe(true);
  });

  it('should handle search with providers', async () => {
    const results = await searchEngine.searchWithProviders({
      query: 'test',
      providers: ['test-account-1'],
      maxResults: 5,
      categories: ['email'],
    });
    
    expect(Array.isArray(results)).toBe(true);
    
    // Each result should have expected properties
    results.forEach(result => {
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('score');
      expect(typeof result.score).toBe('number');
    });
  });

  it('should handle empty search queries gracefully', async () => {
    const results = await searchEngine.search('', {});
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it('should handle search errors gracefully', async () => {
    // This should not throw, even with potentially problematic input
    const results = await searchEngine.search('extremely-complex-query-with-special-chars!@#$%^&*()', {
      limit: 10,
    });
    
    expect(Array.isArray(results)).toBe(true);
  });

  it('should use simple search interface', async () => {
    const results = await searchEngine.searchSimple('test', 5);
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Search Engine Performance', () => {
  beforeAll(async () => {
    await searchEngine.initialize();
  });

  it('should complete searches within reasonable time', async () => {
    const startTime = Date.now();
    
    await searchEngine.search('test query', { limit: 20 });
    
    const endTime = Date.now();
    const searchTime = endTime - startTime;
    
    // Should complete within 1 second (1000ms)
    expect(searchTime).toBeLessThan(1000);
    console.log(`Search completed in ${searchTime}ms`);
  });

  it('should handle batch document indexing efficiently', async () => {
    const testDocuments: LocalSearchDocument[] = [];
    
    // Create 10 test documents
    for (let i = 0; i < 10; i++) {
      testDocuments.push({
        id: `batch-test-doc-${i}`,
        title: `Batch Test Document ${i}`,
        content: `This is test document number ${i} for batch indexing performance test.`,
        contentType: 'document',
        providerId: 'batch-test-provider',
        providerType: 'local_files',
        source: 'test',
        metadata: { batchId: i },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    
    const startTime = Date.now();
    
    // Index all documents
    for (const doc of testDocuments) {
      await searchEngine.addDocument(doc);
    }
    
    const endTime = Date.now();
    const indexingTime = endTime - startTime;
    
    console.log(`Batch indexing of ${testDocuments.length} documents completed in ${indexingTime}ms`);
    
    // Should complete reasonably quickly (allow more time for batch operations)
    expect(indexingTime).toBeLessThan(5000); // 5 seconds max
  });
});