/**
 * Comprehensive Search Engine Integration Test
 * 
 * This test verifies the complete search functionality:
 * - Tantivy search engine initialization
 * - Email and calendar content indexing
 * - Full-text search with relevance ranking
 * - Search suggestions and analytics
 * - Multi-source content search
 */

import { getSearchService } from '../main/search-service-rust';
import log from 'electron-log';

export class SearchIntegrationTest {
  private testResults: Array<{ test: string; result: string; success: boolean }> = [];

  async runAllTests(): Promise<void> {
    log.info('Starting comprehensive search engine integration tests...');
    
    try {
      // Test 1: Initialize search engine
      await this.runTest('Initialize Search Engine', async () => {
        const searchService = getSearchService();
        await searchService.initialize();
        
        if (!searchService.isInitialized()) {
          throw new Error('Search service not properly initialized');
        }
        
        return 'Search engine initialized with Tantivy backend successfully';
      });

      // Test 2: Index sample documents
      await this.runTest('Index Sample Documents', async () => {
        const searchService = getSearchService();
        
        const sampleDocs = [
          {
            id: 'doc_1',
            title: 'Weekly Team Meeting',
            content: 'Discuss project progress, upcoming deadlines, and team coordination for Q4 deliverables',
            contentType: 'document',
            provider: 'test',
            metadata: { type: 'meeting_notes', priority: 'high' },
            lastModified: new Date()
          },
          {
            id: 'doc_2', 
            title: 'Product Roadmap Review',
            content: 'Strategic planning session covering feature development, user feedback integration, and market analysis',
            contentType: 'document',
            provider: 'test',
            metadata: { type: 'planning', priority: 'medium' },
            lastModified: new Date()
          },
          {
            id: 'doc_3',
            title: 'Technical Architecture Decision',
            content: 'Rust backend implementation using Tantivy search engine for improved performance and reliability',
            contentType: 'document',
            provider: 'test',
            metadata: { type: 'technical', priority: 'high' },
            lastModified: new Date()
          }
        ];

        let indexed = 0;
        for (const doc of sampleDocs) {
          await searchService.indexDocument(doc);
          indexed++;
        }

        return `Successfully indexed ${indexed} sample documents`;
      });

      // Test 3: Index sample email message
      await this.runTest('Index Sample Email', async () => {
        const searchService = getSearchService();
        
        await searchService.indexEmailMessage({
          id: 'email_test_001',
          accountId: 'test_account',
          subject: 'Important Project Update - Q4 Goals',
          fromAddress: 'manager@company.com',
          fromName: 'Project Manager',
          toAddresses: ['team@company.com'],
          bodyText: 'Hi team, I wanted to provide an update on our Q4 objectives and the new Rust-based search system implementation. The Tantivy integration is showing excellent performance improvements.',
          bodyHtml: '<p>Hi team, I wanted to provide an update on our Q4 objectives and the new <strong>Rust-based search system</strong> implementation. The Tantivy integration is showing excellent performance improvements.</p>',
          receivedAt: new Date(),
          folder: 'inbox'
        });

        return 'Sample email message indexed successfully';
      });

      // Test 4: Index sample calendar event
      await this.runTest('Index Sample Calendar Event', async () => {
        const searchService = getSearchService();
        
        await searchService.indexCalendarEvent({
          id: 'event_test_001',
          calendarId: 'primary',
          title: 'Sprint Planning Meeting',
          description: 'Plan next sprint including Rust search engine optimization and Tantivy performance tuning',
          location: 'Conference Room A',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // Tomorrow + 1 hour
          isAllDay: false,
          organizer: 'scrum.master@company.com',
          attendees: ['dev.team@company.com', 'product.owner@company.com'],
          status: 'confirmed'
        });

        return 'Sample calendar event indexed successfully';
      });

      // Test 5: Basic search functionality
      await this.runTest('Basic Search Functionality', async () => {
        const searchService = getSearchService();
        
        const searchResults = await searchService.search({
          query: 'Rust Tantivy',
          limit: 10
        });

        if (searchResults.results.length === 0) {
          throw new Error('Search returned no results for "Rust Tantivy"');
        }

        const hasRelevantResults = searchResults.results.some(result => 
          result.title.toLowerCase().includes('rust') || 
          result.content?.toLowerCase().includes('tantivy') ||
          result.title.toLowerCase().includes('technical') ||
          result.content?.toLowerCase().includes('rust')
        );

        if (!hasRelevantResults) {
          throw new Error('Search results do not contain relevant content');
        }

        return `Search returned ${searchResults.results.length} relevant results in ${searchResults.took}ms`;
      });

      // Test 6: Multi-content-type search
      await this.runTest('Multi-Content-Type Search', async () => {
        const searchService = getSearchService();
        
        // Search for meeting-related content across all content types
        const searchResults = await searchService.search({
          query: 'meeting planning',
          limit: 10
        });

        const contentTypes = new Set(searchResults.results.map(r => r.contentType));
        
        return `Found meeting content across ${contentTypes.size} content types: ${Array.from(contentTypes).join(', ')}`;
      });

      // Test 7: Search suggestions
      await this.runTest('Search Suggestions', async () => {
        const searchService = getSearchService();
        
        const suggestions = await searchService.getSuggestions('rust', 5);
        
        if (suggestions.length === 0) {
          throw new Error('No search suggestions returned');
        }

        return `Generated ${suggestions.length} suggestions: ${suggestions.join(', ')}`;
      });

      // Test 8: Search analytics
      await this.runTest('Search Analytics', async () => {
        const searchService = getSearchService();
        
        const analytics = await searchService.getAnalytics();
        
        if (!analytics.totalDocuments || analytics.totalDocuments === 0) {
          throw new Error('Analytics shows no indexed documents');
        }

        return `Analytics: ${analytics.totalDocuments} docs, ${analytics.totalQueries} queries, ${analytics.avgQueryTime.toFixed(2)}ms avg response`;
      });

      // Test 9: Document deletion
      await this.runTest('Document Deletion', async () => {
        const searchService = getSearchService();
        
        const deleted = await searchService.deleteDocument('doc_1');
        
        if (!deleted) {
          throw new Error('Document deletion failed');
        }

        // Verify document is no longer searchable
        const searchResults = await searchService.search({
          query: 'Weekly Team Meeting',
          limit: 10
        });

        const deletedDocFound = searchResults.results.some(result => result.id === 'doc_1');
        if (deletedDocFound) {
          throw new Error('Deleted document still appears in search results');
        }

        return 'Document successfully deleted and removed from index';
      });

      // Test 10: Index optimization
      await this.runTest('Index Optimization', async () => {
        const searchService = getSearchService();
        
        await searchService.optimizeIndices();
        
        return 'Search index optimization completed successfully';
      });

      // Test 11: Performance test
      await this.runTest('Search Performance Test', async () => {
        const searchService = getSearchService();
        
        const queries = ['project', 'meeting', 'rust', 'tantivy', 'planning'];
        const results = [];

        for (const query of queries) {
          const startTime = Date.now();
          const searchResult = await searchService.search({ query, limit: 5 });
          const endTime = Date.now();
          
          results.push({
            query,
            time: endTime - startTime,
            count: searchResult.results.length
          });
        }

        const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
        const totalResults = results.reduce((sum, r) => sum + r.count, 0);

        if (avgTime > 300) {
          throw new Error(`Average search time ${avgTime}ms exceeds 300ms target`);
        }

        return `Performance test: ${totalResults} results across ${queries.length} queries, avg ${avgTime.toFixed(2)}ms`;
      });

      log.info('All search integration tests completed successfully!');
      
    } catch (error) {
      log.error('Search integration tests failed:', error);
      throw error;
    }
  }

  private async runTest(testName: string, testFn: () => Promise<string>): Promise<void> {
    try {
      log.info(`Running test: ${testName}`);
      const result = await testFn();
      this.testResults.push({ test: testName, result, success: true });
      log.info(`✅ ${testName}: ${result}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.testResults.push({ test: testName, result: errorMessage, success: false });
      log.error(`❌ ${testName}: ${errorMessage}`);
      throw error;
    }
  }

  getTestResults(): Array<{ test: string; result: string; success: boolean }> {
    return this.testResults;
  }

  getTestSummary(): { total: number; passed: number; failed: number; successRate: number } {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.success).length;
    const failed = total - passed;
    const successRate = total > 0 ? (passed / total) * 100 : 0;

    return { total, passed, failed, successRate };
  }
}

// Export for use in main process
export async function runSearchIntegrationTests(): Promise<void> {
  const tester = new SearchIntegrationTest();
  await tester.runAllTests();
  
  const summary = tester.getTestSummary();
  log.info(`Search Integration Test Summary: ${summary.passed}/${summary.total} tests passed (${summary.successRate.toFixed(1)}%)`);
  
  if (summary.failed > 0) {
    throw new Error(`${summary.failed} search integration tests failed`);
  }
}