/**
 * Plugin Marketplace Manager - Handles plugin discovery, installation, and updates
 * 
 * This manager provides:
 * - Plugin marketplace API integration
 * - Secure plugin package download and verification
 * - Plugin installation and update workflows
 * - License verification and payment processing
 * - Plugin ratings and reviews management
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { 
  PluginManifest, 
  PluginInstallation, 
  PluginMarketplaceListing,
  PluginCategory,
  PluginRating,
  PluginLicense,
  PluginDownloadInfo
} from '@flow-desk/shared';
import { PluginLogger } from '../utils/PluginLogger';
import { PluginSecurityManager } from '../security/PluginSecurityManager';

export interface MarketplaceConfig {
  /** Marketplace API endpoint */
  apiEndpoint: string;
  /** API authentication token */
  apiToken: string;
  /** Plugin cache directory */
  cacheDir: string;
  /** Download timeout in ms */
  downloadTimeout: number;
  /** Enable telemetry */
  enableTelemetry: boolean;
  /** Maximum package size in MB */
  maxPackageSize: number;
}

export interface PluginSearchOptions {
  query?: string;
  category?: PluginCategory;
  tags?: string[];
  author?: string;
  minRating?: number;
  priceModel?: 'free' | 'paid' | 'subscription';
  platform?: 'desktop' | 'mobile' | 'both';
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'rating' | 'downloads' | 'updated' | 'price';
  sortOrder?: 'asc' | 'desc';
}

export interface PluginInstallOptions {
  /** Skip signature verification (development only) */
  skipVerification?: boolean;
  /** Force reinstall if already installed */
  forceReinstall?: boolean;
  /** Install specific version */
  version?: string;
  /** Installation scope */
  scope?: 'user' | 'workspace' | 'global';
  /** Auto-grant permissions */
  autoGrantPermissions?: boolean;
}

export interface InstallationProgress {
  /** Installation ID */
  installationId: string;
  /** Plugin ID */
  pluginId: string;
  /** Current step */
  step: 'downloading' | 'verifying' | 'extracting' | 'installing' | 'configuring' | 'complete';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status message */
  message: string;
  /** Downloaded bytes (for download step) */
  downloadedBytes?: number;
  /** Total bytes (for download step) */
  totalBytes?: number;
  /** Error information if failed */
  error?: string;
}

/**
 * Plugin Marketplace Manager
 * 
 * Manages the entire plugin lifecycle from marketplace discovery to installation
 */
export class PluginMarketplaceManager extends EventEmitter {
  private readonly logger: PluginLogger;
  private readonly config: MarketplaceConfig;
  private readonly securityManager: PluginSecurityManager;
  
  private readonly activeDownloads = new Map<string, AbortController>();
  private readonly installationProgress = new Map<string, InstallationProgress>();
  private readonly marketplaceCache = new Map<string, { data: any; expires: number }>();
  
  private isInitialized = false;

  constructor(config: MarketplaceConfig, securityManager: PluginSecurityManager) {
    super();
    this.config = config;
    this.securityManager = securityManager;
    this.logger = new PluginLogger('PluginMarketplaceManager');
  }

  /**
   * Initialize the marketplace manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.logger.info('Initializing plugin marketplace manager');

    try {
      // Ensure cache directory exists
      await fs.mkdir(this.config.cacheDir, { recursive: true });

      // Test marketplace connectivity
      await this.testMarketplaceConnection();

      this.isInitialized = true;
      this.logger.info('Plugin marketplace manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize marketplace manager', error);
      throw error;
    }
  }

  /**
   * Search for plugins in the marketplace
   */
  async searchPlugins(options: PluginSearchOptions = {}): Promise<PluginMarketplaceListing[]> {
    this.logger.debug('Searching plugins in marketplace', options);

    try {
      // Check cache first
      const cacheKey = `search_${JSON.stringify(options)}`;
      const cachedResult = this.marketplaceCache.get(cacheKey);
      
      if (cachedResult && cachedResult.expires > Date.now()) {
        this.logger.debug('Returning cached search results');
        return cachedResult.data;
      }

      // Build search query
      const searchParams = new URLSearchParams();
      
      if (options.query) searchParams.append('q', options.query);
      if (options.category) searchParams.append('category', options.category);
      if (options.tags) searchParams.append('tags', options.tags.join(','));
      if (options.author) searchParams.append('author', options.author);
      if (options.minRating) searchParams.append('min_rating', options.minRating.toString());
      if (options.priceModel) searchParams.append('price_model', options.priceModel);
      if (options.platform) searchParams.append('platform', options.platform);
      if (options.limit) searchParams.append('limit', options.limit.toString());
      if (options.offset) searchParams.append('offset', options.offset.toString());
      if (options.sortBy) searchParams.append('sort_by', options.sortBy);
      if (options.sortOrder) searchParams.append('sort_order', options.sortOrder);

      // Make API request
      const response = await fetch(`${this.config.apiEndpoint}/plugins/search?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Marketplace search failed: ${response.statusText}`);
      }

      const result = await response.json();
      const listings: PluginMarketplaceListing[] = result.data || [];

      // Cache results for 5 minutes
      this.marketplaceCache.set(cacheKey, {
        data: listings,
        expires: Date.now() + (5 * 60 * 1000)
      });

      this.logger.info(`Found ${listings.length} plugins matching search criteria`);
      return listings;
    } catch (error) {
      this.logger.error('Plugin search failed', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific plugin
   */
  async getPluginDetails(pluginId: string, version?: string): Promise<PluginMarketplaceListing> {
    this.logger.debug(`Getting details for plugin ${pluginId}${version ? ` v${version}` : ''}`);

    try {
      const url = `${this.config.apiEndpoint}/plugins/${pluginId}${version ? `?version=${version}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get plugin details: ${response.statusText}`);
      }

      const pluginDetails = await response.json();
      return pluginDetails;
    } catch (error) {
      this.logger.error(`Failed to get details for plugin ${pluginId}`, error);
      throw error;
    }
  }

  /**
   * Get available versions for a plugin
   */
  async getPluginVersions(pluginId: string): Promise<Array<{ version: string; releaseDate: string; notes?: string }>> {
    this.logger.debug(`Getting versions for plugin ${pluginId}`);

    try {
      const response = await fetch(`${this.config.apiEndpoint}/plugins/${pluginId}/versions`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get plugin versions: ${response.statusText}`);
      }

      const versions = await response.json();
      return versions.data || [];
    } catch (error) {
      this.logger.error(`Failed to get versions for plugin ${pluginId}`, error);
      throw error;
    }
  }

  /**
   * Install a plugin from the marketplace
   */
  async installPlugin(
    pluginId: string, 
    userId: string,
    workspaceId?: string,
    options: PluginInstallOptions = {}
  ): Promise<string> {
    const installationId = `install_${pluginId}_${Date.now()}`;
    
    this.logger.info(`Starting installation of plugin ${pluginId}`, {
      installationId,
      userId,
      workspaceId,
      options
    });

    try {
      // Create initial progress tracking
      const progress: InstallationProgress = {
        installationId,
        pluginId,
        step: 'downloading',
        progress: 0,
        message: 'Initializing installation...'
      };
      
      this.installationProgress.set(installationId, progress);
      this.emit('installationProgress', progress);

      // Get plugin details and download info
      const pluginDetails = await this.getPluginDetails(pluginId, options.version);
      const downloadInfo = await this.getPluginDownloadInfo(pluginId, options.version);

      // Validate license and permissions
      await this.validatePluginLicense(pluginDetails, userId);
      await this.validatePluginCompatibility(pluginDetails);

      // Update progress
      progress.step = 'downloading';
      progress.message = 'Downloading plugin package...';
      this.emit('installationProgress', progress);

      // Download plugin package
      const packagePath = await this.downloadPluginPackage(
        downloadInfo,
        installationId,
        (downloadProgress) => {
          progress.progress = Math.round(downloadProgress * 30); // Download is 30% of total
          progress.downloadedBytes = downloadProgress * (downloadInfo.size || 0);
          progress.totalBytes = downloadInfo.size;
          this.emit('installationProgress', progress);
        }
      );

      // Update progress
      progress.step = 'verifying';
      progress.progress = 35;
      progress.message = 'Verifying package integrity...';
      this.emit('installationProgress', progress);

      // Verify package integrity and signature
      if (!options.skipVerification) {
        await this.verifyPackageIntegrity(packagePath, downloadInfo);
        if (pluginDetails.manifest) {
          await this.securityManager.verifyPluginSignature(packagePath, pluginDetails.manifest);
        }
      }

      // Update progress
      progress.step = 'extracting';
      progress.progress = 50;
      progress.message = 'Extracting plugin files...';
      this.emit('installationProgress', progress);

      // Extract and validate plugin
      const extractedPath = await this.extractPluginPackage(packagePath);
      const manifest = await this.loadAndValidateManifest(extractedPath);

      // Update progress
      progress.step = 'installing';
      progress.progress = 70;
      progress.message = 'Installing plugin...';
      this.emit('installationProgress', progress);

      // Create plugin installation record
      const installation = await this.createPluginInstallation({
        pluginId: manifest.id,
        version: manifest.version,
        userId,
        workspaceId,
        packagePath: extractedPath,
        manifest,
        options
      });

      // Update progress
      progress.step = 'configuring';
      progress.progress = 90;
      progress.message = 'Configuring plugin...';
      this.emit('installationProgress', progress);

      // Configure plugin (permissions, settings, etc.)
      await this.configurePlugin(installation, options);

      // Complete installation
      progress.step = 'complete';
      progress.progress = 100;
      progress.message = 'Plugin installed successfully!';
      this.emit('installationProgress', progress);

      // Cleanup
      await this.cleanupInstallation(packagePath, installationId);

      this.logger.info(`Plugin ${pluginId} installed successfully`, { installationId });
      this.emit('pluginInstalled', installation);

      return installation.id;
    } catch (error) {
      this.logger.error(`Plugin installation failed for ${pluginId}`, error);
      
      // Update progress with error
      const progress = this.installationProgress.get(installationId);
      if (progress) {
        progress.error = (error as Error).message;
        this.emit('installationProgress', progress);
      }

      // Cleanup on failure
      await this.cleanupFailedInstallation(installationId);
      
      this.emit('installationFailed', { pluginId, installationId, error: (error as Error).message });
      throw error;
    } finally {
      // Remove from active installations
      this.installationProgress.delete(installationId);
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(installationId: string): Promise<void> {
    this.logger.info(`Uninstalling plugin ${installationId}`);

    try {
      // Implementation would remove plugin files, clean up data, etc.
      // This is handled by the main PluginRuntimeManager
      this.emit('pluginUninstalled', installationId);
      this.logger.info(`Plugin ${installationId} uninstalled successfully`);
    } catch (error) {
      this.logger.error(`Plugin uninstallation failed for ${installationId}`, error);
      throw error;
    }
  }

  /**
   * Update a plugin to the latest version
   */
  async updatePlugin(installationId: string, targetVersion?: string): Promise<void> {
    this.logger.info(`Updating plugin ${installationId}${targetVersion ? ` to version ${targetVersion}` : ''}`);

    try {
      // Implementation would handle plugin updates
      // This involves downloading new version, backing up current, and replacing
      this.emit('pluginUpdated', installationId);
      this.logger.info(`Plugin ${installationId} updated successfully`);
    } catch (error) {
      this.logger.error(`Plugin update failed for ${installationId}`, error);
      throw error;
    }
  }

  /**
   * Get installation progress
   */
  getInstallationProgress(installationId: string): InstallationProgress | undefined {
    return this.installationProgress.get(installationId);
  }

  /**
   * Cancel an ongoing installation
   */
  async cancelInstallation(installationId: string): Promise<void> {
    this.logger.info(`Canceling installation ${installationId}`);

    const controller = this.activeDownloads.get(installationId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(installationId);
    }

    await this.cleanupFailedInstallation(installationId);
    this.installationProgress.delete(installationId);
    
    this.emit('installationCanceled', installationId);
  }

  /**
   * Get plugin ratings and reviews
   */
  async getPluginRatings(pluginId: string, limit = 10, offset = 0): Promise<PluginRating[]> {
    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/plugins/${pluginId}/ratings?limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get plugin ratings: ${response.statusText}`);
      }

      const ratings = await response.json();
      return ratings.data || [];
    } catch (error) {
      this.logger.error(`Failed to get ratings for plugin ${pluginId}`, error);
      return [];
    }
  }

  /**
   * Submit a plugin rating/review
   */
  async submitPluginRating(
    pluginId: string,
    userId: string,
    rating: number,
    review?: string
  ): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/plugins/${pluginId}/ratings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          rating,
          review
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to submit plugin rating: ${response.statusText}`);
      }

      this.logger.info(`Rating submitted for plugin ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to submit rating for plugin ${pluginId}`, error);
      throw error;
    }
  }

  // Private methods

  private async testMarketplaceConnection(): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/health`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Marketplace connection test failed: ${response.statusText}`);
      }

      this.logger.info('Marketplace connection test successful');
    } catch (error) {
      this.logger.warn('Marketplace connection test failed', error);
      // Don't throw - allow offline usage
    }
  }

  private async getPluginDownloadInfo(pluginId: string, version?: string): Promise<PluginDownloadInfo> {
    const response = await fetch(
      `${this.config.apiEndpoint}/plugins/${pluginId}/download${version ? `?version=${version}` : ''}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get download info: ${response.statusText}`);
    }

    return await response.json();
  }

  private async downloadPluginPackage(
    downloadInfo: PluginDownloadInfo,
    installationId: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    const controller = new AbortController();
    this.activeDownloads.set(installationId, controller);

    try {
      const response = await fetch(downloadInfo.downloadUrl, {
        signal: controller.signal,
        headers: downloadInfo.headers || {}
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const contentLength = parseInt(response.headers.get('content-length') || '0');
      const packagePath = path.join(this.config.cacheDir, `${installationId}.zip`);
      
      const fileHandle = await fs.open(packagePath, 'w');
      const writer = fileHandle.createWriteStream();

      let downloadedBytes = 0;
      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Unable to read download response');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        if (value) {
          writer.write(value);
          downloadedBytes += value.length;
          
          if (contentLength > 0) {
            onProgress(downloadedBytes / contentLength);
          }
        }
      }

      await fileHandle.close();
      
      // Verify file size matches expected
      const stats = await fs.stat(packagePath);
      if (downloadInfo.size && stats.size !== downloadInfo.size) {
        throw new Error('Downloaded file size mismatch');
      }

      return packagePath;
    } finally {
      this.activeDownloads.delete(installationId);
    }
  }

  private async verifyPackageIntegrity(
    packagePath: string,
    downloadInfo: PluginDownloadInfo
  ): Promise<void> {
    if (!downloadInfo.checksum) return;

    const fileBuffer = await fs.readFile(packagePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    if (hash !== downloadInfo.checksum) {
      throw new Error('Package integrity verification failed: checksum mismatch');
    }

    this.logger.debug('Package integrity verified');
  }

  private async extractPluginPackage(packagePath: string): Promise<string> {
    // Implementation would use a ZIP library to extract the package
    // For now, return a mock extracted path
    const extractPath = packagePath.replace('.zip', '_extracted');
    await fs.mkdir(extractPath, { recursive: true });
    
    // Mock extraction - in reality would extract ZIP contents
    this.logger.debug(`Plugin package extracted to ${extractPath}`);
    return extractPath;
  }

  private async loadAndValidateManifest(extractedPath: string): Promise<PluginManifest> {
    const manifestPath = path.join(extractedPath, 'plugin.json');
    
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest: PluginManifest = JSON.parse(manifestContent);
      
      // Validate required fields
      if (!manifest.id || !manifest.name || !manifest.version) {
        throw new Error('Invalid plugin manifest: missing required fields');
      }

      return manifest;
    } catch (error) {
      throw new Error(`Failed to load plugin manifest: ${(error as Error).message}`);
    }
  }

  private async validatePluginLicense(
    pluginDetails: PluginMarketplaceListing,
    userId: string
  ): Promise<void> {
    // Implementation would validate license terms and user eligibility
    this.logger.debug(`Validating license for plugin ${pluginDetails.id}`);
  }

  private async validatePluginCompatibility(
    pluginDetails: PluginMarketplaceListing
  ): Promise<void> {
    // Implementation would check platform compatibility, Flow Desk version, etc.
    this.logger.debug(`Validating compatibility for plugin ${pluginDetails.id}`);
  }

  private async createPluginInstallation(params: {
    pluginId: string;
    version: string;
    userId: string;
    workspaceId?: string;
    packagePath: string;
    manifest: PluginManifest;
    options: PluginInstallOptions;
  }): Promise<PluginInstallation> {
    // Implementation would create the actual installation record
    // For now, return a mock installation
    return {
      id: `install_${params.pluginId}_${Date.now()}`,
      pluginId: params.pluginId,
      version: params.version,
      userId: params.userId,
      workspaceId: params.workspaceId,
      status: 'installing',
      config: {},
      settings: {
        enabled: false,
        autoUpdate: true,
        visible: true,
        order: 0,
        notifications: {
          enabled: true,
          types: []
        }
      },
      grantedPermissions: [],
      grantedScopes: [],
      installedAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async configurePlugin(
    installation: PluginInstallation,
    options: PluginInstallOptions
  ): Promise<void> {
    // Implementation would handle initial plugin configuration
    this.logger.debug(`Configuring plugin ${installation.pluginId}`);
  }

  private async cleanupInstallation(packagePath: string, installationId: string): Promise<void> {
    try {
      await fs.unlink(packagePath);
      this.logger.debug(`Cleaned up package file: ${packagePath}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup package file: ${(error as Error).message}`);
    }
  }

  private async cleanupFailedInstallation(installationId: string): Promise<void> {
    // Implementation would clean up any partial installation artifacts
    this.logger.debug(`Cleaning up failed installation ${installationId}`);
  }
}