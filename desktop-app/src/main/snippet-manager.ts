import log from 'electron-log';

export interface TextSnippet {
  id: string;
  name: string;
  content: string;
  shortcut?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class SnippetManager {
  private snippets: Map<string, TextSnippet> = new Map();

  constructor() {
    this.loadDefaultSnippets();
  }

  private loadDefaultSnippets(): void {
    const defaults: TextSnippet[] = [
      {
        id: 'signature',
        name: 'Email Signature',
        content: 'Best regards,\n{{name}}\n{{title}}\n{{company}}',
        shortcut: 'sig',
        tags: ['signature'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'thanks',
        name: 'Thank You',
        content: 'Thank you for your time and consideration.',
        shortcut: 'ty',
        tags: ['courtesy'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const snippet of defaults) {
      this.snippets.set(snippet.id, snippet);
    }
  }

  async createSnippet(snippet: Omit<TextSnippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<TextSnippet> {
    const newSnippet: TextSnippet = {
      ...snippet,
      id: `snip_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.snippets.set(newSnippet.id, newSnippet);
    log.info(`Created snippet: ${newSnippet.name}`);
    return newSnippet;
  }

  getSnippet(id: string): TextSnippet | undefined {
    return this.snippets.get(id);
  }

  getSnippetByShortcut(shortcut: string): TextSnippet | undefined {
    return Array.from(this.snippets.values())
      .find(snippet => snippet.shortcut === shortcut);
  }

  getAllSnippets(): TextSnippet[] {
    return Array.from(this.snippets.values());
  }

  async updateSnippet(id: string, updates: Partial<TextSnippet>): Promise<TextSnippet | undefined> {
    const snippet = this.snippets.get(id);
    if (!snippet) return undefined;

    const updatedSnippet = {
      ...snippet,
      ...updates,
      id: snippet.id,
      createdAt: snippet.createdAt,
      updatedAt: new Date(),
    };

    this.snippets.set(id, updatedSnippet);
    return updatedSnippet;
  }

  async deleteSnippet(id: string): Promise<boolean> {
    return this.snippets.delete(id);
  }

  expandSnippet(text: string, variables: Record<string, string> = {}): string {
    let expandedText = text;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      expandedText = expandedText.replace(new RegExp(placeholder, 'g'), value);
    }

    return expandedText;
  }
}
