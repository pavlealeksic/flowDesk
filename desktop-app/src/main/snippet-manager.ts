import log from 'electron-log';
import { getDatabaseInitializationService } from './database-initialization-service';
import { generateId } from './utils/id-generator';

export interface TextSnippet {
  id: string;
  name: string;
  content: string;
  shortcut?: string;
  tags: string[];
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SnippetRow {
  id: string;
  name: string;
  content: string;
  shortcut: string | null;
  tags: string;
  category: string;
  created_at: string;
  updated_at: string;
}

interface SQLite3Database {
  exec(sql: string, callback?: (err: Error | null) => void): void;
  get(sql: string, params?: any, callback?: (err: Error | null, row?: any) => void): void;
  all(sql: string, params?: any, callback?: (err: Error | null, rows?: any[]) => void): void;
  run(sql: string, params?: any, callback?: (err: Error | null) => void): void;
  close(callback?: (err: Error | null) => void): void;
  serialize(callback?: () => void): void;
}

interface SQLite3Module {
  Database: new (filename: string, mode?: number, callback?: (err: Error | null) => void) => SQLite3Database;
  OPEN_READWRITE: number;
  OPEN_CREATE: number;
  OPEN_READONLY: number;
  verbose(): SQLite3Module;
}

export class SnippetManager {
  private dbPath: string;
  private sqlite3?: SQLite3Module;

  constructor() {
    const dbService = getDatabaseInitializationService();
    this.dbPath = dbService.getConfig().mailDbPath;
  }

  /**
   * Load SQLite3 module
   */
  private async loadSQLite3(): Promise<SQLite3Module> {
    if (this.sqlite3) {
      return this.sqlite3;
    }

    try {
      const sqlite3Module = require('sqlite3').verbose();
      if (!sqlite3Module) {
        throw new Error('Failed to load SQLite3 module');
      }
      this.sqlite3 = sqlite3Module;
      return sqlite3Module;
    } catch (error) {
      throw new Error('SQLite3 module not available. Please install sqlite3: npm install sqlite3');
    }
  }

  /**
   * Open database connection
   */
  private async openDatabase(): Promise<SQLite3Database> {
    const sqlite3 = await this.loadSQLite3();
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err: Error | null) => {
        if (err) {
          reject(new Error(`Failed to open database: ${err.message}`));
        } else {
          resolve(db);
        }
      });
    });
  }

  /**
   * Convert database row to TextSnippet
   */
  private rowToSnippet(row: SnippetRow): TextSnippet {
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      shortcut: row.shortcut || undefined,
      tags: JSON.parse(row.tags || '[]'),
      category: row.category,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Convert TextSnippet to database parameters
   */
  private snippetToParams(snippet: Partial<TextSnippet>): any {
    return {
      id: snippet.id,
      name: snippet.name,
      content: snippet.content,
      shortcut: snippet.shortcut || null,
      tags: JSON.stringify(snippet.tags || []),
      category: snippet.category || 'general',
      created_at: snippet.createdAt?.toISOString(),
      updated_at: snippet.updatedAt?.toISOString() || new Date().toISOString()
    };
  }

  async createSnippet(snippet: Omit<TextSnippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<TextSnippet> {
    const newSnippet: TextSnippet = {
      ...snippet,
      id: generateId('snip'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const params = this.snippetToParams(newSnippet);
      
      db.run(
        `INSERT INTO snippets (id, name, content, shortcut, tags, category, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [params.id, params.name, params.content, params.shortcut, params.tags, params.category, params.created_at, params.updated_at],
        function (err: Error | null) {
          db.close();
          if (err) {
            log.error('Failed to create snippet:', err);
            reject(new Error(`Failed to create snippet: ${err.message}`));
          } else {
            log.info(`Created snippet: ${newSnippet.name}`);
            resolve(newSnippet);
          }
        }
      );
    });
  }

  async getSnippet(id: string): Promise<TextSnippet | undefined> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM snippets WHERE id = ?',
        [id],
        (err: Error | null, row?: SnippetRow) => {
          db.close();
          if (err) {
            log.error('Failed to get snippet:', err);
            reject(new Error(`Failed to get snippet: ${err.message}`));
          } else if (row) {
            resolve(this.rowToSnippet(row));
          } else {
            resolve(undefined);
          }
        }
      );
    });
  }

  async getSnippetByShortcut(shortcut: string): Promise<TextSnippet | undefined> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM snippets WHERE shortcut = ? LIMIT 1',
        [shortcut],
        (err: Error | null, row?: SnippetRow) => {
          db.close();
          if (err) {
            log.error('Failed to get snippet by shortcut:', err);
            reject(new Error(`Failed to get snippet by shortcut: ${err.message}`));
          } else if (row) {
            resolve(this.rowToSnippet(row));
          } else {
            resolve(undefined);
          }
        }
      );
    });
  }

  async getAllSnippets(): Promise<TextSnippet[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM snippets ORDER BY name ASC',
        [],
        (err: Error | null, rows?: SnippetRow[]) => {
          db.close();
          if (err) {
            log.error('Failed to get all snippets:', err);
            reject(new Error(`Failed to get all snippets: ${err.message}`));
          } else {
            const snippets = (rows || []).map(row => this.rowToSnippet(row));
            resolve(snippets);
          }
        }
      );
    });
  }

  async updateSnippet(id: string, updates: Partial<TextSnippet>): Promise<TextSnippet | undefined> {
    const existingSnippet = await this.getSnippet(id);
    if (!existingSnippet) return undefined;

    const updatedSnippet = {
      ...existingSnippet,
      ...updates,
      id: existingSnippet.id,
      createdAt: existingSnippet.createdAt,
      updatedAt: new Date(),
    };

    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const params = this.snippetToParams(updatedSnippet);
      
      db.run(
        `UPDATE snippets SET name = ?, content = ?, shortcut = ?, tags = ?, category = ?, updated_at = ? 
         WHERE id = ?`,
        [params.name, params.content, params.shortcut, params.tags, params.category, params.updated_at, id],
        function (this: any, err: Error | null) {
          db.close();
          if (err) {
            log.error('Failed to update snippet:', err);
            reject(new Error(`Failed to update snippet: ${err.message}`));
          } else if (this.changes === 0) {
            resolve(undefined);
          } else {
            log.info(`Updated snippet: ${updatedSnippet.name}`);
            resolve(updatedSnippet);
          }
        }
      );
    });
  }

  async deleteSnippet(id: string): Promise<boolean> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM snippets WHERE id = ?',
        [id],
        function (this: any, err: Error | null) {
          db.close();
          if (err) {
            log.error('Failed to delete snippet:', err);
            reject(new Error(`Failed to delete snippet: ${err.message}`));
          } else {
            const success = this.changes > 0;
            if (success) {
              log.info(`Deleted snippet with id: ${id}`);
            }
            resolve(success);
          }
        }
      );
    });
  }

  expandSnippet(text: string, variables: Record<string, string> = {}): string {
    let expandedText = text;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      expandedText = expandedText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    return expandedText;
  }

  // Additional methods expected by main.ts
  async getSnippetsByCategory(category: string): Promise<TextSnippet[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM snippets WHERE category = ? ORDER BY name ASC',
        [category],
        (err: Error | null, rows?: SnippetRow[]) => {
          db.close();
          if (err) {
            log.error('Failed to get snippets by category:', err);
            reject(new Error(`Failed to get snippets by category: ${err.message}`));
          } else {
            const snippets = (rows || []).map(row => this.rowToSnippet(row));
            resolve(snippets);
          }
        }
      );
    });
  }

  async saveSnippet(snippet: Omit<TextSnippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<TextSnippet> {
    return this.createSnippet(snippet);
  }

  async useSnippet(id: string): Promise<TextSnippet | undefined> {
    // Record usage analytics
    const snippet = await this.getSnippet(id);
    if (snippet) {
      await this.recordSnippetUsage(id);
    }
    return snippet;
  }

  async searchSnippets(query: string): Promise<TextSnippet[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      const searchQuery = `%${query.toLowerCase()}%`;
      db.all(
        `SELECT * FROM snippets 
         WHERE LOWER(name) LIKE ? 
         OR LOWER(content) LIKE ? 
         OR LOWER(tags) LIKE ?
         OR LOWER(category) LIKE ?
         ORDER BY name ASC`,
        [searchQuery, searchQuery, searchQuery, searchQuery],
        (err: Error | null, rows?: SnippetRow[]) => {
          db.close();
          if (err) {
            log.error('Failed to search snippets:', err);
            reject(new Error(`Failed to search snippets: ${err.message}`));
          } else {
            const snippets = (rows || []).map(row => this.rowToSnippet(row));
            resolve(snippets);
          }
        }
      );
    });
  }

  async getSnippetsByShortcut(shortcut: string): Promise<TextSnippet[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM snippets WHERE shortcut = ? ORDER BY name ASC',
        [shortcut],
        (err: Error | null, rows?: SnippetRow[]) => {
          db.close();
          if (err) {
            log.error('Failed to get snippets by shortcut:', err);
            reject(new Error(`Failed to get snippets by shortcut: ${err.message}`));
          } else {
            const snippets = (rows || []).map(row => this.rowToSnippet(row));
            resolve(snippets);
          }
        }
      );
    });
  }

  /**
   * Record snippet usage for analytics
   */
  private async recordSnippetUsage(snippetId: string): Promise<void> {
    try {
      const db = await this.openDatabase();
      
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO template_usage (id, template_id, template_type, used_at, context) 
           VALUES (?, ?, 'snippet', CURRENT_TIMESTAMP, 'snippet_manager')`,
          [generateId('usage'), snippetId],
          function (err: Error | null) {
            db.close();
            if (err) {
              log.warn('Failed to record snippet usage:', err);
              // Don't reject, as this is non-critical
            }
            resolve();
          }
        );
      });
    } catch (error) {
      log.warn('Failed to record snippet usage:', error);
    }
  }

  /**
   * Get all categories with snippet counts
   */
  async getCategories(): Promise<Array<{ category: string; count: number }>> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT category, COUNT(*) as count FROM snippets GROUP BY category ORDER BY category ASC',
        [],
        (err: Error | null, rows?: any[]) => {
          db.close();
          if (err) {
            log.error('Failed to get categories:', err);
            reject(new Error(`Failed to get categories: ${err.message}`));
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Get most used snippets
   */
  async getMostUsedSnippets(limit: number = 10): Promise<TextSnippet[]> {
    const db = await this.openDatabase();
    
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT s.*, COUNT(tu.id) as usage_count 
         FROM snippets s 
         LEFT JOIN template_usage tu ON s.id = tu.template_id AND tu.template_type = 'snippet'
         GROUP BY s.id 
         ORDER BY usage_count DESC, s.name ASC 
         LIMIT ?`,
        [limit],
        (err: Error | null, rows?: SnippetRow[]) => {
          db.close();
          if (err) {
            log.error('Failed to get most used snippets:', err);
            reject(new Error(`Failed to get most used snippets: ${err.message}`));
          } else {
            const snippets = (rows || []).map(row => this.rowToSnippet(row));
            resolve(snippets);
          }
        }
      );
    });
  }

  /**
   * Import snippets from array
   */
  async importSnippets(snippets: Omit<TextSnippet, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<{
    imported: number;
    failed: number;
    errors: string[];
  }> {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const snippet of snippets) {
      try {
        await this.createSnippet(snippet);
        imported++;
      } catch (error) {
        failed++;
        errors.push(`Failed to import snippet "${snippet.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    log.info(`Imported ${imported} snippets, ${failed} failed`);
    return { imported, failed, errors };
  }

  /**
   * Export all snippets
   */
  async exportSnippets(): Promise<TextSnippet[]> {
    return this.getAllSnippets();
  }
}
