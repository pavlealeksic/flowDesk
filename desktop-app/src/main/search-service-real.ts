/**
 * Real Search Service Implementation
 * 
 * This service provides real full-text search indexing using MiniSearch library.
 * It indexes content from Gmail, Calendar, Slack, Teams, Jira, and GitHub.
 */

import MiniSearch, { SearchResult } from 'minisearch';
import log from 'electron-log';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

// Document interface for indexing
interface SearchDocument {
  id: string;
  title: string;
  content: string;
  source: 'gmail' | 'calendar' | 'slack' | 'teams' | 'jira' | 'github';
  sourceId: string; // Original ID from source system
  type: 'email' | 'event' | 'message' | 'issue' | 'repository' | 'notification';
  metadata: {
    accountId: string;
    url?: string;
    author?: string;
    date?: Date;
    tags?: string[];
    [key: string]: any;
  };
  indexed: Date;
}

// Search options
interface SearchOptions {
  source?: string[];
  type?: string[];
  dateRange?: { start: Date; end: Date };
  author?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// Search result with highlights
interface EnhancedSearchResult extends SearchResult {
  document: SearchDocument;
  highlights: { field: string; highlight: string }[];
}

export class RealSearchService {
  private searchIndex: MiniSearch;
  private documents: Map<string, SearchDocument> = new Map();
  private store: Store;

  constructor() {
    this.store = new Store({
      name: 'flow-desk-search-index'
    });

    // Initialize MiniSearch with configuration
    this.searchIndex = new MiniSearch({
      fields: ['title', 'content', 'author', 'tags'], // Fields to index
      storeFields: ['title', 'content', 'source', 'type', 'metadata'], // Fields to store
      searchOptions: {
        boost: { title: 2 }, // Boost title matches
        fuzzy: 0.2, // Allow fuzzy matching
        prefix: true, // Allow prefix matching
        combineWith: 'AND' // Default operator
      }
    });

    this.loadStoredIndex();
  }

  private async loadStoredIndex() {
    try {
      const storedDocuments = this.store.get('documents', []) as SearchDocument[];
      for (const doc of storedDocuments) {
        this.documents.set(doc.id, doc);
        this.searchIndex.add({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          author: doc.metadata.author || '',
          tags: (doc.metadata.tags || []).join(' '),
          source: doc.source,
          type: doc.type,
          metadata: doc.metadata
        });
      }
      log.info(`Loaded ${storedDocuments.length} documents into search index`);
    } catch (error) {
      log.error('Failed to load search index:', error);
    }
  }

  private saveIndex() {
    try {
      const documentsArray = Array.from(this.documents.values());
      this.store.set('documents', documentsArray);
    } catch (error) {
      log.error('Failed to save search index:', error);
    }
  }

  /**
   * Index Gmail messages
   */
  async indexGmailMessages(accountId: string, messages: any[]): Promise<number> {
    let indexed = 0;
    
    for (const message of messages) {
      try {
        const doc: SearchDocument = {
          id: `gmail-${message.id}`,
          title: message.subject || '(No Subject)',
          content: `${message.from} ${message.subject} ${message.bodyText || ''}`,
          source: 'gmail',
          sourceId: message.id,
          type: 'email',
          metadata: {
            accountId,
            author: message.fromAddress,
            date: new Date(message.receivedAt),
            url: `https://mail.google.com/mail/u/0/#inbox/${message.id}`,
            tags: message.labels || []
          },
          indexed: new Date()
        };

        this.documents.set(doc.id, doc);
        this.searchIndex.add({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          author: doc.metadata.author || '',
          tags: (doc.metadata.tags || []).join(' '),
          source: doc.source,
          type: doc.type,
          metadata: doc.metadata
        });

        indexed++;
      } catch (error) {
        log.warn(`Failed to index Gmail message ${message.id}:`, error);
      }
    }

    if (indexed > 0) {
      this.saveIndex();
      log.info(`Indexed ${indexed} Gmail messages`);
    }

    return indexed;
  }

  /**
   * Index calendar events
   */
  async indexCalendarEvents(accountId: string, events: any[]): Promise<number> {
    let indexed = 0;
    
    for (const event of events) {
      try {
        const doc: SearchDocument = {
          id: `calendar-${event.id}`,
          title: event.title || '(No Title)',
          content: `${event.title} ${event.description || ''} ${event.location || ''} ${event.attendees?.join(' ') || ''}`,
          source: 'calendar',
          sourceId: event.id,
          type: 'event',
          metadata: {
            accountId,
            author: event.organizer,
            date: new Date(event.startTime),
            tags: [],
            location: event.location,
            attendees: event.attendees
          },
          indexed: new Date()
        };

        this.documents.set(doc.id, doc);
        this.searchIndex.add({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          author: doc.metadata.author || '',
          tags: (doc.metadata.tags || []).join(' '),
          source: doc.source,
          type: doc.type,
          metadata: doc.metadata
        });

        indexed++;
      } catch (error) {
        log.warn(`Failed to index calendar event ${event.id}:`, error);
      }
    }

    if (indexed > 0) {
      this.saveIndex();
      log.info(`Indexed ${indexed} calendar events`);
    }

    return indexed;
  }

  /**
   * Index Slack messages
   */
  async indexSlackMessages(accountId: string, messages: any[]): Promise<number> {
    let indexed = 0;
    
    for (const message of messages) {
      try {
        const doc: SearchDocument = {
          id: `slack-${message.id}`,
          title: `${message.userName}: ${message.text.substring(0, 50)}...`,
          content: `${message.userName} ${message.text}`,
          source: 'slack',
          sourceId: message.id,
          type: 'message',
          metadata: {
            accountId,
            author: message.userName,
            date: new Date(message.timestamp),
            channelId: message.channelId,
            tags: []
          },
          indexed: new Date()
        };

        this.documents.set(doc.id, doc);
        this.searchIndex.add({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          author: doc.metadata.author || '',
          tags: (doc.metadata.tags || []).join(' '),
          source: doc.source,
          type: doc.type,
          metadata: doc.metadata
        });

        indexed++;
      } catch (error) {
        log.warn(`Failed to index Slack message ${message.id}:`, error);
      }
    }

    if (indexed > 0) {
      this.saveIndex();
      log.info(`Indexed ${indexed} Slack messages`);
    }

    return indexed;
  }

  /**
   * Index Jira issues
   */
  async indexJiraIssues(accountId: string, issues: any[]): Promise<number> {
    let indexed = 0;
    
    for (const issue of issues) {
      try {
        const doc: SearchDocument = {
          id: `jira-${issue.id}`,
          title: `${issue.key}: ${issue.summary}`,
          content: `${issue.key} ${issue.summary} ${issue.description} ${issue.assignee?.displayName || ''} ${issue.labels?.join(' ') || ''}`,
          source: 'jira',
          sourceId: issue.id,
          type: 'issue',
          metadata: {
            accountId,
            author: issue.reporter?.displayName,
            date: new Date(issue.created),
            url: `${issue.htmlUrl || ''}`,
            tags: issue.labels || [],
            status: issue.status?.name,
            priority: issue.priority?.name,
            assignee: issue.assignee?.displayName
          },
          indexed: new Date()
        };

        this.documents.set(doc.id, doc);
        this.searchIndex.add({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          author: doc.metadata.author || '',
          tags: (doc.metadata.tags || []).join(' '),
          source: doc.source,
          type: doc.type,
          metadata: doc.metadata
        });

        indexed++;
      } catch (error) {
        log.warn(`Failed to index Jira issue ${issue.id}:`, error);
      }
    }

    if (indexed > 0) {
      this.saveIndex();
      log.info(`Indexed ${indexed} Jira issues`);
    }

    return indexed;
  }

  /**
   * Index GitHub repositories
   */
  async indexGitHubRepositories(accountId: string, repositories: any[]): Promise<number> {
    let indexed = 0;
    
    for (const repo of repositories) {
      try {
        const doc: SearchDocument = {
          id: `github-repo-${repo.id}`,
          title: repo.fullName,
          content: `${repo.name} ${repo.fullName} ${repo.description} ${repo.language}`,
          source: 'github',
          sourceId: repo.id.toString(),
          type: 'repository',
          metadata: {
            accountId,
            author: repo.fullName.split('/')[0],
            date: new Date(repo.updatedAt),
            url: repo.htmlUrl,
            tags: [repo.language].filter(Boolean),
            stars: repo.stargazersCount,
            forks: repo.forksCount
          },
          indexed: new Date()
        };

        this.documents.set(doc.id, doc);
        this.searchIndex.add({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          author: doc.metadata.author || '',
          tags: (doc.metadata.tags || []).join(' '),
          source: doc.source,
          type: doc.type,
          metadata: doc.metadata
        });

        indexed++;
      } catch (error) {
        log.warn(`Failed to index GitHub repository ${repo.id}:`, error);
      }
    }

    if (indexed > 0) {
      this.saveIndex();
      log.info(`Indexed ${indexed} GitHub repositories`);
    }

    return indexed;
  }

  /**
   * Search across all indexed content
   */
  search(query: string, options: SearchOptions = {}): EnhancedSearchResult[] {
    const startTime = Date.now();
    
    try {
      // Perform search
      let results = this.searchIndex.search(query, {
        combineWith: 'AND',
        fuzzy: 0.2,
        prefix: true,
        boost: { title: 2 }
      });

      // Apply filters
      if (options.source?.length) {
        results = results.filter(r => {
          const doc = this.documents.get(r.id);
          return doc && options.source!.includes(doc.source);
        });
      }

      if (options.type?.length) {
        results = results.filter(r => {
          const doc = this.documents.get(r.id);
          return doc && options.type!.includes(doc.type);
        });
      }

      if (options.dateRange) {
        results = results.filter(r => {
          const doc = this.documents.get(r.id);
          if (!doc || !doc.metadata.date) return false;
          const date = new Date(doc.metadata.date);
          return date >= options.dateRange!.start && date <= options.dateRange!.end;
        });
      }

      if (options.author) {
        results = results.filter(r => {
          const doc = this.documents.get(r.id);
          return doc && doc.metadata.author?.toLowerCase().includes(options.author!.toLowerCase());
        });
      }

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || 50;
      results = results.slice(offset, offset + limit);

      // Enhance results with document data and highlights
      const enhancedResults: EnhancedSearchResult[] = results.map(result => {
        const doc = this.documents.get(result.id)!;
        const highlights = this.generateHighlights(doc, query);
        
        return {
          ...result,
          document: doc,
          highlights
        };
      });

      const searchTime = Date.now() - startTime;
      log.debug(`Search completed in ${searchTime}ms, found ${enhancedResults.length} results`);

      return enhancedResults;

    } catch (error) {
      log.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Generate search result highlights
   */
  private generateHighlights(doc: SearchDocument, query: string): { field: string; highlight: string }[] {
    const highlights: { field: string; highlight: string }[] = [];
    const queryTerms = query.toLowerCase().split(/\s+/);

    // Highlight in title
    const titleHighlight = this.highlightText(doc.title, queryTerms);
    if (titleHighlight !== doc.title) {
      highlights.push({ field: 'title', highlight: titleHighlight });
    }

    // Highlight in content (first 200 chars with context)
    const contentSnippet = this.extractSnippet(doc.content, queryTerms, 200);
    highlights.push({ field: 'content', highlight: contentSnippet });

    return highlights;
  }

  private highlightText(text: string, queryTerms: string[]): string {
    let highlighted = text;
    
    for (const term of queryTerms) {
      if (term.length < 2) continue;
      const regex = new RegExp(`\\b(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    }
    
    return highlighted;
  }

  private extractSnippet(text: string, queryTerms: string[], maxLength: number): string {
    const lowerText = text.toLowerCase();
    
    // Find first occurrence of any query term
    let firstMatch = -1;
    for (const term of queryTerms) {
      if (term.length < 2) continue;
      const index = lowerText.indexOf(term.toLowerCase());
      if (index >= 0 && (firstMatch === -1 || index < firstMatch)) {
        firstMatch = index;
      }
    }

    // If no match found, return beginning of text
    if (firstMatch === -1) {
      const snippet = text.substring(0, maxLength);
      return snippet.length < text.length ? snippet + '...' : snippet;
    }

    // Extract snippet around the match
    const start = Math.max(0, firstMatch - 50);
    const end = Math.min(text.length, firstMatch + maxLength - 50);
    let snippet = text.substring(start, end);

    // Add ellipsis if we're not at the beginning/end
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    // Highlight query terms in snippet
    return this.highlightText(snippet, queryTerms);
  }

  /**
   * Index any document
   */
  async indexDocument(doc: SearchDocument): Promise<void> {
    try {
      this.documents.set(doc.id, doc);
      this.searchIndex.add({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        author: doc.metadata.author || '',
        tags: (doc.metadata.tags || []).join(' '),
        source: doc.source,
        type: doc.type,
        metadata: doc.metadata
      });

      this.saveIndex();
      log.debug(`Indexed document: ${doc.title}`);
    } catch (error) {
      log.error('Failed to index document:', error);
    }
  }

  /**
   * Remove document from index
   */
  async removeDocument(documentId: string): Promise<void> {
    try {
      this.documents.delete(documentId);
      this.searchIndex.remove({ id: documentId });
      this.saveIndex();
      log.debug(`Removed document from index: ${documentId}`);
    } catch (error) {
      log.error('Failed to remove document:', error);
    }
  }

  /**
   * Get search suggestions
   */
  getSuggestions(query: string, limit: number = 5): string[] {
    try {
      const suggestions = this.searchIndex.autoSuggest(query, {
        boost: { title: 2 },
        fuzzy: 0.2
      });

      return suggestions
        .map(s => s.suggestion)
        .slice(0, limit);

    } catch (error) {
      log.error('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Get search facets (aggregated data)
   */
  getSearchFacets(query?: string): {
    sources: { [key: string]: number };
    types: { [key: string]: number };
    authors: { [key: string]: number };
    tags: { [key: string]: number };
  } {
    const facets = {
      sources: {} as { [key: string]: number },
      types: {} as { [key: string]: number },
      authors: {} as { [key: string]: number },
      tags: {} as { [key: string]: number }
    };

    let documentsToAnalyze: SearchDocument[];
    
    if (query) {
      // Get documents from search results
      const searchResults = this.search(query, { limit: 1000 });
      documentsToAnalyze = searchResults.map(r => r.document);
    } else {
      // Use all documents
      documentsToAnalyze = Array.from(this.documents.values());
    }

    for (const doc of documentsToAnalyze) {
      // Count sources
      facets.sources[doc.source] = (facets.sources[doc.source] || 0) + 1;
      
      // Count types
      facets.types[doc.type] = (facets.types[doc.type] || 0) + 1;
      
      // Count authors
      if (doc.metadata.author) {
        facets.authors[doc.metadata.author] = (facets.authors[doc.metadata.author] || 0) + 1;
      }
      
      // Count tags
      for (const tag of doc.metadata.tags || []) {
        facets.tags[tag] = (facets.tags[tag] || 0) + 1;
      }
    }

    return facets;
  }

  /**
   * Get search statistics
   */
  getSearchStats(): {
    totalDocuments: number;
    documentsBySource: { [key: string]: number };
    documentsByType: { [key: string]: number };
    indexSize: number;
    lastIndexed: Date;
  } {
    const documents = Array.from(this.documents.values());
    
    const stats = {
      totalDocuments: documents.length,
      documentsBySource: {} as { [key: string]: number },
      documentsByType: {} as { [key: string]: number },
      indexSize: JSON.stringify(documents).length,
      lastIndexed: new Date()
    };

    for (const doc of documents) {
      stats.documentsBySource[doc.source] = (stats.documentsBySource[doc.source] || 0) + 1;
      stats.documentsByType[doc.type] = (stats.documentsByType[doc.type] || 0) + 1;
      
      if (doc.indexed > stats.lastIndexed) {
        stats.lastIndexed = doc.indexed;
      }
    }

    return stats;
  }

  /**
   * Clear index for specific source
   */
  async clearSourceIndex(source: string, accountId?: string): Promise<number> {
    const documentsToRemove = Array.from(this.documents.values())
      .filter(doc => doc.source === source && (!accountId || doc.metadata.accountId === accountId));

    for (const doc of documentsToRemove) {
      this.documents.delete(doc.id);
      this.searchIndex.remove({ id: doc.id });
    }

    if (documentsToRemove.length > 0) {
      this.saveIndex();
      log.info(`Cleared ${documentsToRemove.length} documents from ${source} index`);
    }

    return documentsToRemove.length;
  }

  /**
   * Reindex all content (useful for schema changes)
   */
  async reindexAll(): Promise<void> {
    try {
      // Clear current index
      this.searchIndex.removeAll();
      
      // Re-add all documents
      for (const doc of this.documents.values()) {
        this.searchIndex.add({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          author: doc.metadata.author || '',
          tags: (doc.metadata.tags || []).join(' '),
          source: doc.source,
          type: doc.type,
          metadata: doc.metadata
        });
      }

      this.saveIndex();
      log.info('Reindexed all documents');
    } catch (error) {
      log.error('Failed to reindex:', error);
      throw new Error(`Reindex failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get document by ID
   */
  getDocument(documentId: string): SearchDocument | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Get all documents for source
   */
  getDocumentsBySource(source: string, accountId?: string): SearchDocument[] {
    return Array.from(this.documents.values())
      .filter(doc => doc.source === source && (!accountId || doc.metadata.accountId === accountId));
  }
}

export default RealSearchService;