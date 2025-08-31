/**
 * IPC handlers for search functionality
 */

import { ipcMain } from 'electron';
import { getSearchService } from './search-service-rust';
import log from 'electron-log';

export function setupSearchIPC(): void {
  const searchService = getSearchService();

  // Initialize search service
  ipcMain.handle('search:initialize', async () => {
    try {
      await searchService.initialize();
      return { success: true };
    } catch (error) {
      log.error('Search initialization failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });

  // Execute search query
  ipcMain.handle('search:query', async (_, query: any) => {
    try {
      const response = await searchService.search(query);
      return { success: true, data: response };
    } catch (error) {
      log.error('Search query failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        code: 'SEARCH_FAILED'
      };
    }
  });

  // Index a single document
  ipcMain.handle('search:index-document', async (_, document: any) => {
    try {
      await searchService.indexDocument(document);
      return { success: true };
    } catch (error) {
      log.error('Document indexing failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        code: 'INDEX_FAILED'
      };
    }
  });

  // Index multiple documents
  ipcMain.handle('search:index-documents', async (_, documents: any[]) => {
    try {
      const count = await searchService.indexDocuments(documents);
      return { success: true, data: count };
    } catch (error) {
      log.error('Batch document indexing failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        code: 'BATCH_INDEX_FAILED'
      };
    }
  });

  // Delete a document
  ipcMain.handle('search:delete-document', async (_, documentId: string) => {
    try {
      const deleted = await searchService.deleteDocument(documentId);
      return { success: true, data: deleted };
    } catch (error) {
      log.error('Document deletion failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        code: 'DELETE_FAILED'
      };
    }
  });

  // Get search suggestions
  ipcMain.handle('search:suggestions', async (_, partialQuery: string, limit?: number) => {
    try {
      const suggestions = await searchService.getSuggestions(partialQuery, limit);
      return { success: true, data: suggestions };
    } catch (error) {
      log.error('Getting suggestions failed:', error);
      return { 
        success: true, // Don't fail for suggestions, just return empty
        data: [] 
      };
    }
  });

  // Get search analytics
  ipcMain.handle('search:analytics', async () => {
    try {
      const analytics = await searchService.getAnalytics();
      return { success: true, data: analytics };
    } catch (error) {
      log.error('Getting analytics failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        code: 'ANALYTICS_FAILED'
      };
    }
  });

  // Optimize indices
  ipcMain.handle('search:optimize', async () => {
    try {
      await searchService.optimizeIndices();
      return { success: true };
    } catch (error) {
      log.error('Index optimization failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        code: 'OPTIMIZE_FAILED'
      };
    }
  });

  // Clear cache
  ipcMain.handle('search:clear-cache', async () => {
    try {
      await searchService.clearCache();
      return { success: true };
    } catch (error) {
      log.error('Cache clearing failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        code: 'CACHE_CLEAR_FAILED'
      };
    }
  });

  // Check if search is initialized
  ipcMain.handle('search:is-initialized', () => {
    return { success: true, data: searchService.isInitialized() };
  });
}