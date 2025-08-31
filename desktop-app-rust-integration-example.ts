/**
 * Desktop App Rust Integration Example
 * 
 * This example shows how the desktop app can integrate with the Rust library
 * for mail, calendar, search, and crypto functionality.
 */

// Import the Rust library wrapper
import { 
  FlowDeskRust, 
  RustSearchEngine, 
  RustMailEngine, 
  RustCalendarEngine,
  SearchResult
} from './shared/rust-lib/flow-desk-rust';

/**
 * Enhanced Search Service using Rust backend
 */
export class RustSearchService {
  private searchEngine: RustSearchEngine;
  private initialized = false;

  constructor() {
    this.searchEngine = new RustSearchEngine();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log('🔍 Initializing Rust search engine...');
      // The search engine is already initialized in the constructor
      this.initialized = true;
      console.log('✅ Rust search engine ready');
    } catch (error) {
      console.error('❌ Failed to initialize search engine:', error);
      throw error;
    }
  }

  async indexDocument(
    id: string, 
    title: string, 
    content: string, 
    source: string = 'desktop-app'
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return this.searchEngine.addDocument(id, title, content, source);
    } catch (error) {
      console.error('❌ Failed to index document:', error);
      return false;
    }
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const startTime = Date.now();
      const results = this.searchEngine.search(query, limit);
      const searchTime = Date.now() - startTime;
      
      console.log(`🔍 Search "${query}" completed in ${searchTime}ms (${results.length} results)`);
      return results;
    } catch (error) {
      console.error('❌ Search failed:', error);
      return [];
    }
  }

  destroy(): void {
    if (this.searchEngine) {
      this.searchEngine.destroy();
      this.initialized = false;
    }
  }
}

/**
 * Enhanced Mail Service using Rust backend
 */
export class RustMailService {
  private mailEngine: RustMailEngine;
  private initialized = false;

  constructor() {
    this.mailEngine = new RustMailEngine();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log('📧 Initializing Rust mail engine...');
      this.initialized = true;
      console.log('✅ Rust mail engine ready');
    } catch (error) {
      console.error('❌ Failed to initialize mail engine:', error);
      throw error;
    }
  }

  async addAccount(
    accountId: string,
    email: string,
    provider: string,
    displayName: string
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`📧 Adding mail account: ${email} (${provider})`);
      const result = this.mailEngine.addAccount(accountId, email, provider, displayName);
      
      if (result) {
        console.log(`✅ Mail account added: ${email}`);
      } else {
        console.log(`❌ Failed to add mail account: ${email}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to add mail account:', error);
      return false;
    }
  }

  async getAccounts(): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return this.mailEngine.getAccounts();
    } catch (error) {
      console.error('❌ Failed to get mail accounts:', error);
      return [];
    }
  }

  destroy(): void {
    if (this.mailEngine) {
      this.mailEngine.destroy();
      this.initialized = false;
    }
  }
}

/**
 * Enhanced Calendar Service using Rust backend
 */
export class RustCalendarService {
  private calendarEngine: RustCalendarEngine;
  private initialized = false;

  constructor() {
    this.calendarEngine = new RustCalendarEngine();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log('📅 Initializing Rust calendar engine...');
      this.initialized = true;
      console.log('✅ Rust calendar engine ready');
    } catch (error) {
      console.error('❌ Failed to initialize calendar engine:', error);
      throw error;
    }
  }

  async addAccount(
    accountId: string,
    email: string,
    provider: string,
    displayName: string
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`📅 Adding calendar account: ${email} (${provider})`);
      const result = this.calendarEngine.addAccount(accountId, email, provider, displayName);
      
      if (result) {
        console.log(`✅ Calendar account added: ${email}`);
      } else {
        console.log(`❌ Failed to add calendar account: ${email}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to add calendar account:', error);
      return false;
    }
  }

  async getAccounts(): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return this.calendarEngine.getAccounts();
    } catch (error) {
      console.error('❌ Failed to get calendar accounts:', error);
      return [];
    }
  }

  destroy(): void {
    if (this.calendarEngine) {
      this.calendarEngine.destroy();
      this.initialized = false;
    }
  }
}

/**
 * Enhanced Crypto Service using Rust backend
 */
export class RustCryptoService {
  private rustLib: FlowDeskRust;
  private initialized = false;

  constructor() {
    this.rustLib = new FlowDeskRust();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log('🔐 Initializing Rust crypto service...');
      this.rustLib.init();
      this.initialized = true;
      console.log('✅ Rust crypto service ready');
    } catch (error) {
      console.error('❌ Failed to initialize crypto service:', error);
      throw error;
    }
  }

  async hashPassword(password: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return this.rustLib.hashPassword(password);
    } catch (error) {
      console.error('❌ Password hashing failed:', error);
      throw error;
    }
  }

  async encryptData(data: string, key: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return this.rustLib.encryptData(data, key);
    } catch (error) {
      console.error('❌ Data encryption failed:', error);
      throw error;
    }
  }

  async decryptData(encryptedData: string, key: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return this.rustLib.decryptData(encryptedData, key);
    } catch (error) {
      console.error('❌ Data decryption failed:', error);
      throw error;
    }
  }
}

/**
 * Main Flow Desk service that coordinates all Rust services
 */
export class FlowDeskService {
  private searchService: RustSearchService;
  private mailService: RustMailService;
  private calendarService: RustCalendarService;
  private cryptoService: RustCryptoService;
  private initialized = false;

  constructor() {
    this.searchService = new RustSearchService();
    this.mailService = new RustMailService();
    this.calendarService = new RustCalendarService();
    this.cryptoService = new RustCryptoService();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🚀 Initializing Flow Desk service with Rust backend...');
      
      // Initialize all services in parallel
      await Promise.all([
        this.searchService.initialize(),
        this.mailService.initialize(),
        this.calendarService.initialize(),
        this.cryptoService.initialize()
      ]);

      this.initialized = true;
      console.log('✅ Flow Desk service ready with Rust backend!');
    } catch (error) {
      console.error('❌ Failed to initialize Flow Desk service:', error);
      throw error;
    }
  }

  // Expose services
  get search(): RustSearchService {
    return this.searchService;
  }

  get mail(): RustMailService {
    return this.mailService;
  }

  get calendar(): RustCalendarService {
    return this.calendarService;
  }

  get crypto(): RustCryptoService {
    return this.cryptoService;
  }

  /**
   * Unified search across all data sources
   */
  async unifiedSearch(query: string, limit: number = 20): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`🔍 Performing unified search for: "${query}"`);
    
    try {
      // This would search across mail, calendar, and indexed documents
      const results = await this.searchService.search(query, limit);
      
      console.log(`📊 Unified search found ${results.length} results`);
      return results;
    } catch (error) {
      console.error('❌ Unified search failed:', error);
      return [];
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    console.log('🧹 Cleaning up Flow Desk service...');
    
    this.searchService.destroy();
    this.mailService.destroy();
    this.calendarService.destroy();
    
    this.initialized = false;
    console.log('✅ Flow Desk service cleanup complete');
  }
}

/**
 * React hook for using Flow Desk service in components
 */
export function useFlowDesk() {
  const [service] = React.useState(() => new FlowDeskService());
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const initializeService = async () => {
      try {
        await service.initialize();
        if (mounted) {
          setIsInitialized(true);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Initialization failed');
        }
      }
    };

    initializeService();

    return () => {
      mounted = false;
      service.destroy();
    };
  }, [service]);

  return {
    service: isInitialized ? service : null,
    isInitialized,
    error
  };
}

// Example usage in a React component
/*
function SearchComponent() {
  const { service, isInitialized, error } = useFlowDesk();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);

  const handleSearch = async () => {
    if (!service || !query.trim()) return;
    
    try {
      const searchResults = await service.unifiedSearch(query, 10);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  if (error) {
    return <div>Error initializing Flow Desk: {error}</div>;
  }

  if (!isInitialized) {
    return <div>Initializing Flow Desk Rust backend...</div>;
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search across mail, calendar, documents..."
      />
      <button onClick={handleSearch}>Search</button>
      
      <div>
        {results.map(result => (
          <div key={result.id}>
            <h3>{result.title}</h3>
            <p>{result.content}</p>
            <small>Score: {result.score}, Source: {result.source}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
*/

// Export default service instance
export default new FlowDeskService();