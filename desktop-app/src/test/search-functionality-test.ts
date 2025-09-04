/**
 * Search Functionality End-to-End Test
 * 
 * This test verifies that the search system works properly:
 * 1. Search service initializes correctly
 * 2. Documents can be indexed
 * 3. Search returns relevant results
 * 4. Suggestions work properly
 */

import { getSearchService } from '../main/search-service-rust';
import log from 'electron-log';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  data?: any;
}

export async function runSearchFunctionalityTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    log.info('Starting search functionality test...');
    
    // Test 1: Initialize search service
    const searchService = getSearchService();
    await searchService.initialize();
    results.push({
      test: 'Search Service Initialization',
      passed: searchService.isInitialized(),
      data: { initialized: searchService.isInitialized() }
    });
    
    // Test 2: Index test documents
    const testDocuments = [
      {
        id: 'test-email-1',
        title: 'Important Meeting Tomorrow',
        content: 'Hi team, we have an important quarterly review meeting tomorrow at 2 PM in the conference room.',
        contentType: 'email',
        provider: 'test',
        metadata: { from: 'manager@company.com', folder: 'inbox' },
        lastModified: new Date()
      },
      {
        id: 'test-email-2', 
        title: 'Project Update',
        content: 'The new feature development is progressing well. We expect to complete testing by next week.',
        contentType: 'email',
        provider: 'test',
        metadata: { from: 'developer@company.com', folder: 'inbox' },
        lastModified: new Date()
      },
      {
        id: 'test-calendar-1',
        title: 'Weekly Team Standup',
        content: 'Regular weekly standup meeting to discuss progress and blockers',
        contentType: 'calendar',
        provider: 'test',
        metadata: { location: 'Room 101', organizer: 'scrum@company.com' },
        lastModified: new Date()
      }
    ];
    
    try {
      for (const doc of testDocuments) {
        await searchService.indexDocument(doc);
      }
      results.push({
        test: 'Document Indexing',
        passed: true,
        data: { documentsIndexed: testDocuments.length }
      });
    } catch (error) {
      results.push({
        test: 'Document Indexing',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Test 3: Search for documents
    try {
      const searchQuery = {
        query: 'meeting',
        limit: 10,
        offset: 0
      };
      
      const searchResponse = await searchService.search(searchQuery);
      const hasResults = searchResponse.results.length > 0;
      const hasCorrectResults = searchResponse.results.some(r => 
        r.title.toLowerCase().includes('meeting') || 
        r.content.toLowerCase().includes('meeting')
      );
      
      results.push({
        test: 'Search Query Execution',
        passed: hasResults && hasCorrectResults,
        data: {
          query: 'meeting',
          totalResults: searchResponse.total,
          resultsReturned: searchResponse.results.length,
          executionTime: searchResponse.took,
          sampleResults: searchResponse.results.slice(0, 2).map(r => ({
            id: r.id,
            title: r.title,
            score: r.score
          }))
        }
      });
    } catch (error) {
      results.push({
        test: 'Search Query Execution',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Test 4: Search suggestions
    try {
      const suggestions = await searchService.getSuggestions('meet', 5);
      const hasSuggestions = suggestions.length > 0;
      
      results.push({
        test: 'Search Suggestions',
        passed: hasSuggestions,
        data: {
          partialQuery: 'meet',
          suggestionsCount: suggestions.length,
          suggestions: suggestions
        }
      });
    } catch (error) {
      results.push({
        test: 'Search Suggestions',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Test 5: Email indexing
    try {
      await searchService.indexEmailMessage({
        id: 'test-email-auto',
        accountId: 'test-account',
        subject: 'Automated Test Email',
        fromAddress: 'test@example.com',
        fromName: 'Test Sender',
        toAddresses: ['recipient@example.com'],
        bodyText: 'This is a test email for automated indexing verification',
        bodyHtml: '<p>This is a test email for automated indexing verification</p>',
        receivedAt: new Date(),
        folder: 'inbox'
      });
      
      // Search for the indexed email
      const emailSearchResponse = await searchService.search({
        query: 'automated test email',
        limit: 5,
        offset: 0
      });
      
      const foundEmail = emailSearchResponse.results.some(r => 
        r.id === 'test-email-auto' || r.title.includes('Automated Test Email')
      );
      
      results.push({
        test: 'Email Message Indexing',
        passed: foundEmail,
        data: {
          indexedEmail: 'test-email-auto',
          searchResults: emailSearchResponse.results.length,
          foundInSearch: foundEmail
        }
      });
    } catch (error) {
      results.push({
        test: 'Email Message Indexing',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Test 6: Calendar event indexing
    try {
      await searchService.indexCalendarEvent({
        id: 'test-calendar-auto',
        calendarId: 'test-calendar',
        title: 'Automated Test Event',
        description: 'This is a test calendar event for automated indexing verification',
        location: 'Test Room',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000), // 1 hour later
        isAllDay: false,
        organizer: 'test@example.com',
        attendees: ['attendee@example.com'],
        status: 'confirmed'
      });
      
      // Search for the indexed event
      const calendarSearchResponse = await searchService.search({
        query: 'automated test event',
        limit: 5,
        offset: 0
      });
      
      const foundEvent = calendarSearchResponse.results.some(r => 
        r.id === 'test-calendar-auto' || r.title.includes('Automated Test Event')
      );
      
      results.push({
        test: 'Calendar Event Indexing',
        passed: foundEvent,
        data: {
          indexedEvent: 'test-calendar-auto',
          searchResults: calendarSearchResponse.results.length,
          foundInSearch: foundEvent
        }
      });
    } catch (error) {
      results.push({
        test: 'Calendar Event Indexing',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Test 7: Search analytics
    try {
      const analytics = await searchService.getAnalytics();
      const hasAnalytics = analytics && typeof analytics.totalDocuments === 'number';
      
      results.push({
        test: 'Search Analytics',
        passed: hasAnalytics,
        data: analytics
      });
    } catch (error) {
      results.push({
        test: 'Search Analytics',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    log.info('Search functionality test completed');
    
  } catch (error) {
    log.error('Search functionality test failed:', error);
    results.push({
      test: 'Overall Test Execution',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  return results;
}

// Function to display test results in a readable format
export function displayTestResults(results: TestResult[]): void {
  console.log('\n=== SEARCH FUNCTIONALITY TEST RESULTS ===\n');
  
  let passed = 0;
  let total = results.length;
  
  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.test}: ${status}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
    }
    
    if (result.passed) passed++;
    console.log('');
  });
  
  console.log(`=== SUMMARY: ${passed}/${total} tests passed ===\n`);
  
  if (passed === total) {
    console.log('🎉 All search functionality tests passed! Search system is working correctly.');
  } else {
    console.log('⚠️  Some search functionality tests failed. Please check the errors above.');
  }
}

// Export for easy testing
if (require.main === module) {
  runSearchFunctionalityTest().then(results => {
    displayTestResults(results);
    process.exit(results.every(r => r.passed) ? 0 : 1);
  });
}