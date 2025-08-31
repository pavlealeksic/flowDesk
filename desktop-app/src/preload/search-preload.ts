/**
 * Preload script for search functionality
 */

import { contextBridge, ipcRenderer } from 'electron';
import { 
  SearchQuery, 
  SearchDocument, 
  SearchResponse,
  SearchAnalytics 
} from '@flow-desk/shared/types/search';

export interface SearchAPI {
  // Initialize search engine
  initialize(): Promise<{ success: boolean; error?: string }>;
  
  // Search operations
  search(query: SearchQuery): Promise<{
    success: boolean;
    data?: SearchResponse;
    error?: string;
    code?: string;
  }>;
  
  // Document operations
  indexDocument(document: SearchDocument): Promise<{
    success: boolean;
    error?: string;
    code?: string;
  }>;
  
  indexDocuments(documents: SearchDocument[]): Promise<{
    success: boolean;
    data?: number;
    error?: string;
    code?: string;
  }>;
  
  deleteDocument(documentId: string): Promise<{
    success: boolean;
    data?: boolean;
    error?: string;
    code?: string;
  }>;
  
  // Suggestions
  getSuggestions(partialQuery: string, limit?: number): Promise<{
    success: boolean;
    data: string[];
  }>;
  
  // Analytics
  getAnalytics(): Promise<{
    success: boolean;
    data?: SearchAnalytics;
    error?: string;
    code?: string;
  }>;
  
  // Maintenance operations
  optimizeIndices(): Promise<{
    success: boolean;
    error?: string;
    code?: string;
  }>;
  
  clearCache(): Promise<{
    success: boolean;
    error?: string;
    code?: string;
  }>;
  
  // Status
  isInitialized(): Promise<{
    success: boolean;
    data: boolean;
  }>;
}

const searchAPI: SearchAPI = {
  initialize: () => ipcRenderer.invoke('search:initialize'),
  
  search: (query: SearchQuery) => ipcRenderer.invoke('search:query', query),
  
  indexDocument: (document: SearchDocument) => 
    ipcRenderer.invoke('search:index-document', document),
    
  indexDocuments: (documents: SearchDocument[]) => 
    ipcRenderer.invoke('search:index-documents', documents),
    
  deleteDocument: (documentId: string) => 
    ipcRenderer.invoke('search:delete-document', documentId),
    
  getSuggestions: (partialQuery: string, limit?: number) => 
    ipcRenderer.invoke('search:suggestions', partialQuery, limit),
    
  getAnalytics: () => ipcRenderer.invoke('search:analytics'),
  
  optimizeIndices: () => ipcRenderer.invoke('search:optimize'),
  
  clearCache: () => ipcRenderer.invoke('search:clear-cache'),
  
  isInitialized: () => ipcRenderer.invoke('search:is-initialized'),
};

export function exposeSearchAPI(): void {
  contextBridge.exposeInMainWorld('searchAPI', searchAPI);
}

// Type declaration for the exposed API
declare global {
  interface Window {
    searchAPI: SearchAPI;
  }
}