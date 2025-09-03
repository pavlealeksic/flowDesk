/**
 * Search Engine
 * Handles full-text search across all data sources
 */

export interface LocalSearchDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalSearchResult {
  id: string;
  title: string;
  content: string;
  source: string;
  score: number;
  highlights: string[];
  metadata: Record<string, any>;
}

export interface LocalSearchOptions {
  limit?: number;
  offset?: number;
  sources?: string[];
  sortBy?: 'relevance' | 'date' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export class LocalSearchEngine {
  private documents: Map<string, LocalSearchDocument> = new Map();
  private index: Map<string, Set<string>> = new Map(); // word -> document IDs

  async initialize(): Promise<void> {
    // Mock initialization
    console.log('Local search engine initialized');
  }

  addDocument(document: LocalSearchDocument): void {
    this.documents.set(document.id, document);
    this.indexDocument(document);
  }

  removeDocument(documentId: string): void {
    const document = this.documents.get(documentId);
    if (document) {
      this.removeFromIndex(document);
      this.documents.delete(documentId);
    }
  }

  updateDocument(documentId: string, updates: Partial<LocalSearchDocument>): void {
    const document = this.documents.get(documentId);
    if (document) {
      // Remove old index entries
      this.removeFromIndex(document);
      
      // Update document
      Object.assign(document, updates, { updatedAt: new Date() });
      
      // Re-index
      this.indexDocument(document);
    }
  }

  search(query: string, options: LocalSearchOptions = {}): LocalSearchResult[] {
    const {
      limit = 10,
      offset = 0,
      sources,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = options;

    const queryWords = this.tokenize(query.toLowerCase());
    const documentScores: Map<string, number> = new Map();

    // Find matching documents
    for (const word of queryWords) {
      const documentIds = this.index.get(word);
      if (documentIds) {
        for (const docId of documentIds) {
          const currentScore = documentScores.get(docId) || 0;
          documentScores.set(docId, currentScore + 1);
        }
      }
    }

    // Convert to results
    let results: LocalSearchResult[] = [];
    for (const [docId, score] of documentScores.entries()) {
      const document = this.documents.get(docId);
      if (document && (!sources || sources.includes(document.source))) {
        results.push({
          id: document.id,
          title: document.title,
          content: this.truncateContent(document.content),
          source: document.source,
          score: score / queryWords.length, // Normalize score
          highlights: this.getHighlights(document, queryWords),
          metadata: document.metadata
        });
      }
    }

    // Sort results
    results.sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return sortOrder === 'desc' ? b.score - a.score : a.score - b.score;
        case 'date':
          const aDoc = this.documents.get(a.id)!;
          const bDoc = this.documents.get(b.id)!;
          const aTime = aDoc.updatedAt.getTime();
          const bTime = bDoc.updatedAt.getTime();
          return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
        case 'title':
          return sortOrder === 'desc' ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    // Apply pagination
    return results.slice(offset, offset + limit);
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  getDocument(id: string): LocalSearchDocument | undefined {
    return this.documents.get(id);
  }

  clearIndex(): void {
    this.documents.clear();
    this.index.clear();
  }

  async searchWithProviders(options: {
    query: string;
    providers?: string[];
    maxResults?: number;
  }): Promise<Array<{
    id: string;
    title: string;
    description: string;
    url: string;
    provider: string;
  }>> {
    const results = this.search(options.query, {
      limit: options.maxResults || 10,
      sources: options.providers
    });

    return results.map(result => ({
      id: result.id,
      title: result.title,
      description: result.content,
      url: `search://${result.id}`,
      provider: result.source
    }));
  }

  private indexDocument(document: LocalSearchDocument): void {
    const words = [
      ...this.tokenize(document.title.toLowerCase()),
      ...this.tokenize(document.content.toLowerCase())
    ];

    for (const word of words) {
      if (!this.index.has(word)) {
        this.index.set(word, new Set());
      }
      this.index.get(word)!.add(document.id);
    }
  }

  private removeFromIndex(document: LocalSearchDocument): void {
    const words = [
      ...this.tokenize(document.title.toLowerCase()),
      ...this.tokenize(document.content.toLowerCase())
    ];

    for (const word of words) {
      const documentIds = this.index.get(word);
      if (documentIds) {
        documentIds.delete(document.id);
        if (documentIds.size === 0) {
          this.index.delete(word);
        }
      }
    }
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private truncateContent(content: string, maxLength: number = 200): string {
    return content.length > maxLength 
      ? content.substring(0, maxLength) + '...'
      : content;
  }

  private getHighlights(document: LocalSearchDocument, queryWords: string[]): string[] {
    const highlights: string[] = [];
    const content = document.content.toLowerCase();
    
    for (const word of queryWords) {
      const index = content.indexOf(word);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + word.length + 50);
        highlights.push(document.content.substring(start, end));
      }
    }
    
    return highlights;
  }
}

export const searchEngine = new LocalSearchEngine();