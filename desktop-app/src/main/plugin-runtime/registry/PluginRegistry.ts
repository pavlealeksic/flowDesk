/**
 * Plugin Registry - Manages plugin discovery and metadata
 * 
 * Handles plugin discovery, caching, and metadata management for
 * both local and remote plugin sources.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { 
  PluginManifest, 
  PluginRegistryEntry,
  PluginCategory,
  PluginType,
  Platform 
} from '@flow-desk/shared';
import { PluginManifestLoader } from '../manifest/PluginManifestLoader';
import { PluginLogger } from '../utils/PluginLogger';

export interface RegistryOptions {
  /** Enable caching of registry data */
  enableCache: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  /** Remote registry URLs */
  remoteRegistries: string[];
  /** Enable auto-discovery of local plugins */
  autoDiscovery: boolean;
  /** Development mode (load unsigned plugins) */
  developmentMode: boolean;
}

export interface PluginSearchFilter {
  /** Search by category */
  category?: PluginCategory;
  /** Search by type */
  type?: PluginType;
  /** Search by platform */
  platform?: Platform;
  /** Search by tags */
  tags?: string[];
  /** Search by text query */
  query?: string;
  /** Include only verified plugins */
  verifiedOnly?: boolean;
  /** Include only free plugins */
  freeOnly?: boolean;
  /** Minimum rating */
  minRating?: number;
}

export interface PluginSearchResult {
  /** Matching plugins */
  plugins: PluginRegistryEntry[];
  /** Total count (for pagination) */
  totalCount: number;
  /** Search facets */
  facets: {
    categories: Array<{ category: PluginCategory; count: number }>;
    types: Array<{ type: PluginType; count: number }>;
    tags: Array<{ tag: string; count: number }>;
  };
}

/**
 * Plugin Registry
 * 
 * Central registry for plugin discovery and metadata management.
 */
export class PluginRegistry extends EventEmitter {
  private readonly logger: PluginLogger;
  private readonly pluginDir: string;
  private readonly manifestLoader: PluginManifestLoader;
  private readonly options: RegistryOptions;
  
  private readonly localPlugins = new Map<string, PluginRegistryEntry>();
  private readonly remotePlugins = new Map<string, PluginRegistryEntry>();
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  
  private lastDiscoveryTime = 0;
  private isInitialized = false;

  constructor(pluginDir: string, options: Partial<RegistryOptions> = {}) {
    super();
    
    this.pluginDir = pluginDir;
    this.manifestLoader = new PluginManifestLoader();
    this.logger = new PluginLogger('PluginRegistry');
    
    this.options = {
      enableCache: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      remoteRegistries: [],
      autoDiscovery: true,
      developmentMode: false,
      ...options
    };
  }

  /**
   * Initialize the registry
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Plugin registry already initialized');
    }

    this.logger.info('Initializing plugin registry');

    try {
      // Discover local plugins
      if (this.options.autoDiscovery) {
        await this.discoverLocalPlugins();
      }

      // Load remote registries
      if (this.options.remoteRegistries.length > 0) {
        await this.loadRemoteRegistries();
      }

      this.isInitialized = true;
      this.logger.info('Plugin registry initialized', {
        localPlugins: this.localPlugins.size,
        remotePlugins: this.remotePlugins.size
      });
    } catch (error) {
      this.logger.error('Failed to initialize plugin registry', error);
      throw error;
    }
  }

  /**
   * Search for plugins
   */
  async searchPlugins(
    filter: PluginSearchFilter = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<PluginSearchResult> {
    const allPlugins = [
      ...Array.from(this.localPlugins.values()),
      ...Array.from(this.remotePlugins.values())
    ];

    // Apply filters
    let filteredPlugins = allPlugins.filter(plugin => {
      // Category filter
      if (filter.category && plugin.manifest.category !== filter.category) {
        return false;
      }

      // Type filter
      if (filter.type && plugin.manifest.type !== filter.type) {
        return false;
      }

      // Platform filter
      if (filter.platform && !plugin.manifest.platforms.includes(filter.platform)) {
        return false;
      }

      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        const hasAllTags = filter.tags.every(tag => 
          plugin.manifest.tags.includes(tag)
        );
        if (!hasAllTags) return false;
      }

      // Text query filter
      if (filter.query) {
        const query = filter.query.toLowerCase();
        const searchable = [
          plugin.manifest.name,
          plugin.manifest.description,
          plugin.manifest.author,
          ...plugin.manifest.tags
        ].join(' ').toLowerCase();
        
        if (!searchable.includes(query)) return false;
      }

      // Verified filter
      if (filter.verifiedOnly && !plugin.registry.verified) {
        return false;
      }

      // Free filter
      if (filter.freeOnly && plugin.manifest.marketplace?.pricing.model !== 'free') {
        return false;
      }

      // Rating filter
      if (filter.minRating && (!plugin.registry.rating || plugin.registry.rating < filter.minRating)) {
        return false;
      }

      return true;
    });

    // Sort by relevance/rating
    filteredPlugins.sort((a, b) => {
      // Verified plugins first
      if (a.registry.verified !== b.registry.verified) {
        return a.registry.verified ? -1 : 1;
      }
      
      // Then by rating
      const ratingA = a.registry.rating || 0;
      const ratingB = b.registry.rating || 0;
      if (ratingA !== ratingB) {
        return ratingB - ratingA;
      }
      
      // Then by download count
      return b.registry.downloadCount - a.registry.downloadCount;
    });

    const totalCount = filteredPlugins.length;

    // Apply pagination
    const paginatedPlugins = filteredPlugins.slice(offset, offset + limit);

    // Generate facets
    const facets = this.generateSearchFacets(allPlugins);

    return {
      plugins: paginatedPlugins,
      totalCount,
      facets
    };
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): PluginRegistryEntry | undefined {
    return this.localPlugins.get(pluginId) || this.remotePlugins.get(pluginId);
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): PluginRegistryEntry[] {
    return [
      ...Array.from(this.localPlugins.values()),
      ...Array.from(this.remotePlugins.values())
    ];
  }

  /**
   * Get plugins by category
   */
  getPluginsByCategory(category: PluginCategory): PluginRegistryEntry[] {
    return this.getAllPlugins().filter(plugin => plugin.manifest.category === category);
  }

  /**
   * Get featured plugins
   */
  getFeaturedPlugins(limit: number = 10): PluginRegistryEntry[] {
    return this.getAllPlugins()
      .filter(plugin => plugin.registry.featured)
      .sort((a, b) => b.registry.downloadCount - a.registry.downloadCount)
      .slice(0, limit);
  }

  /**
   * Get plugin statistics
   */
  getStatistics(): {
    totalPlugins: number;
    localPlugins: number;
    remotePlugins: number;
    byCategory: Record<PluginCategory, number>;
    byType: Record<PluginType, number>;
    verified: number;
    featured: number;
  } {
    const allPlugins = this.getAllPlugins();
    const byCategory = {} as Record<PluginCategory, number>;
    const byType = {} as Record<PluginType, number>;
    
    let verified = 0;
    let featured = 0;

    for (const plugin of allPlugins) {
      byCategory[plugin.manifest.category] = (byCategory[plugin.manifest.category] || 0) + 1;
      byType[plugin.manifest.type] = (byType[plugin.manifest.type] || 0) + 1;
      
      if (plugin.registry.verified) verified++;
      if (plugin.registry.featured) featured++;
    }

    return {
      totalPlugins: allPlugins.length,
      localPlugins: this.localPlugins.size,
      remotePlugins: this.remotePlugins.size,
      byCategory,
      byType,
      verified,
      featured
    };
  }

  /**
   * Refresh registry data
   */
  async refresh(): Promise<void> {
    this.logger.info('Refreshing plugin registry');

    try {
      // Clear cache
      this.cache.clear();

      // Rediscover local plugins
      await this.discoverLocalPlugins();

      // Reload remote registries
      if (this.options.remoteRegistries.length > 0) {
        await this.loadRemoteRegistries();
      }

      this.emit('refreshed');
      this.logger.info('Plugin registry refreshed');
    } catch (error) {
      this.logger.error('Failed to refresh plugin registry', error);
      throw error;
    }
  }

  /**
   * Add remote registry URL
   */
  addRemoteRegistry(url: string): void {
    if (!this.options.remoteRegistries.includes(url)) {
      this.options.remoteRegistries.push(url);
      this.logger.info(`Added remote registry: ${url}`);
    }
  }

  /**
   * Remove remote registry URL
   */
  removeRemoteRegistry(url: string): void {
    const index = this.options.remoteRegistries.indexOf(url);
    if (index >= 0) {
      this.options.remoteRegistries.splice(index, 1);
      this.logger.info(`Removed remote registry: ${url}`);
    }
  }

  /**
   * Private: Discover local plugins
   */
  private async discoverLocalPlugins(): Promise<void> {
    this.logger.debug('Discovering local plugins');
    
    this.localPlugins.clear();

    try {
      const entries = await fs.readdir(this.pluginDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.discoverPluginVersions(entry.name);
        }
      }
    } catch (error) {
      // Plugin directory might not exist yet
      this.logger.debug('Plugin directory not found, skipping local discovery');
    }

    this.lastDiscoveryTime = Date.now();
    this.logger.debug(`Discovered ${this.localPlugins.size} local plugins`);
  }

  /**
   * Private: Discover plugin versions in a plugin directory
   */
  private async discoverPluginVersions(pluginId: string): Promise<void> {
    const pluginBaseDir = path.join(this.pluginDir, pluginId);
    
    try {
      const versions = await fs.readdir(pluginBaseDir, { withFileTypes: true });
      
      // Find the latest version
      const versionDirs = versions
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort((a, b) => this.compareVersions(b, a)); // Descending order

      if (versionDirs.length === 0) return;

      const latestVersion = versionDirs[0];
      const pluginDir = path.join(pluginBaseDir, latestVersion);

      // Load manifest
      const manifestResult = await this.manifestLoader.loadFromDirectory(pluginDir);
      
      if (!manifestResult.isValid) {
        this.logger.warn(`Invalid manifest for plugin ${pluginId}`, manifestResult.errors);
        return;
      }

      // Create registry entry
      const registryEntry: PluginRegistryEntry = {
        manifest: manifestResult.manifest,
        package: {
          url: `file://${pluginDir}`,
          hash: '', // Would be calculated from package content
          size: await this.getDirectorySize(pluginDir),
          signature: undefined
        },
        registry: {
          id: `local-${pluginId}`,
          publishedAt: new Date(),
          updatedAt: new Date(),
          downloadCount: 0,
          rating: undefined,
          reviewCount: undefined,
          verified: this.options.developmentMode, // Only verified in dev mode for local plugins
          featured: false
        }
      };

      this.localPlugins.set(pluginId, registryEntry);
      this.logger.debug(`Added local plugin: ${pluginId}@${latestVersion}`);
    } catch (error) {
      this.logger.warn(`Failed to process plugin directory: ${pluginId}`, error);
    }
  }

  /**
   * Private: Load remote registries
   */
  private async loadRemoteRegistries(): Promise<void> {
    this.logger.debug('Loading remote registries');
    
    this.remotePlugins.clear();

    for (const registryUrl of this.options.remoteRegistries) {
      try {
        await this.loadRemoteRegistry(registryUrl);
      } catch (error) {
        this.logger.warn(`Failed to load remote registry: ${registryUrl}`, error);
      }
    }

    this.logger.debug(`Loaded ${this.remotePlugins.size} remote plugins`);
  }

  /**
   * Private: Load single remote registry
   */
  private async loadRemoteRegistry(registryUrl: string): Promise<void> {
    // Check cache first
    const cacheKey = `registry-${registryUrl}`;
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      this.logger.debug(`Using cached data for registry: ${registryUrl}`);
      this.processRemoteRegistryData(cached);
      return;
    }

    // In a full implementation, you would fetch from the remote registry
    // For now, we'll just log that we would fetch
    this.logger.debug(`Would fetch remote registry: ${registryUrl}`);
    
    // Mock remote registry data
    const mockData: PluginRegistryEntry[] = [];
    
    this.processRemoteRegistryData(mockData);
    this.setCached(cacheKey, mockData);
  }

  /**
   * Private: Process remote registry data
   */
  private processRemoteRegistryData(entries: PluginRegistryEntry[]): void {
    for (const entry of entries) {
      // Don't override local plugins with remote ones
      if (!this.localPlugins.has(entry.manifest.id)) {
        this.remotePlugins.set(entry.manifest.id, entry);
      }
    }
  }

  /**
   * Private: Generate search facets
   */
  private generateSearchFacets(plugins: PluginRegistryEntry[]): PluginSearchResult['facets'] {
    const categoryCounts = new Map<PluginCategory, number>();
    const typeCounts = new Map<PluginType, number>();
    const tagCounts = new Map<string, number>();

    for (const plugin of plugins) {
      // Count categories
      const categoryCount = categoryCounts.get(plugin.manifest.category) || 0;
      categoryCounts.set(plugin.manifest.category, categoryCount + 1);

      // Count types
      const typeCount = typeCounts.get(plugin.manifest.type) || 0;
      typeCounts.set(plugin.manifest.type, typeCount + 1);

      // Count tags
      for (const tag of plugin.manifest.tags) {
        const tagCount = tagCounts.get(tag) || 0;
        tagCounts.set(tag, tagCount + 1);
      }
    }

    return {
      categories: Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      
      types: Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      
      tags: Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20) // Top 20 tags
    };
  }

  /**
   * Private: Compare semantic versions
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      
      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }
    
    return 0;
  }

  /**
   * Private: Get directory size
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return totalSize;
  }

  /**
   * Private: Get cached value
   */
  private getCached(key: string): any {
    if (!this.options.enableCache) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.options.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Private: Set cached value
   */
  private setCached(key: string, data: any): void {
    if (!this.options.enableCache) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}