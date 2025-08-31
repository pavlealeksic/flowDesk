/**
 * Plugin Lifecycle Manager - Manages plugin installation, updates, and uninstallation
 * 
 * This manager handles all aspects of plugin lifecycle including:
 * - Installation from packages
 * - Version updates and migrations
 * - Uninstallation and cleanup
 * - Package extraction and validation
 * - File system operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { 
  PluginManifest, 
  PluginInstallation, 
  PluginInstallationStatus,
  CreatePluginInstallationInput 
} from '@flow-desk/shared';
import { PluginStorageManager } from '../storage/PluginStorageManager';
import { PluginSecurityManager } from '../security/PluginSecurityManager';
import { PluginManifestLoader } from '../manifest/PluginManifestLoader';
import { PluginLogger } from '../utils/PluginLogger';
import { PluginPackageExtractor } from './PluginPackageExtractor';

export interface InstallationOptions {
  /** Force installation even if plugin already exists */
  force?: boolean;
  /** Skip signature verification */
  skipSignatureVerification?: boolean;
  /** Automatically grant requested permissions */
  autoGrantPermissions?: boolean;
  /** Installation source */
  source?: 'marketplace' | 'sideload' | 'development';
}

export interface UpdateOptions {
  /** Allow downgrade */
  allowDowngrade?: boolean;
  /** Preserve user data */
  preserveUserData?: boolean;
  /** Update dependencies */
  updateDependencies?: boolean;
}

/**
 * Plugin Lifecycle Manager
 * 
 * Coordinates the complete lifecycle of plugins from installation to removal.
 */
export class PluginLifecycleManager extends EventEmitter {
  private readonly logger: PluginLogger;
  private readonly pluginDir: string;
  private readonly storageManager: PluginStorageManager;
  private readonly securityManager: PluginSecurityManager;
  private readonly manifestLoader: PluginManifestLoader;
  private readonly packageExtractor: PluginPackageExtractor;
  
  private readonly installations = new Map<string, PluginInstallation>();
  private readonly installationLocks = new Set<string>();

  constructor(
    pluginDir: string,
    storageManager: PluginStorageManager,
    securityManager: PluginSecurityManager
  ) {
    super();
    this.pluginDir = pluginDir;
    this.storageManager = storageManager;
    this.securityManager = securityManager;
    this.manifestLoader = new PluginManifestLoader();
    this.packageExtractor = new PluginPackageExtractor();
    this.logger = new PluginLogger('PluginLifecycleManager');
  }

  /**
   * Initialize the lifecycle manager
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing plugin lifecycle manager');

    try {
      // Ensure plugin directory exists
      await this.ensurePluginDirectoryStructure();
      
      // Load existing installations
      await this.loadExistingInstallations();
      
      this.logger.info('Plugin lifecycle manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize plugin lifecycle manager', error);
      throw error;
    }
  }

  /**
   * Shutdown the lifecycle manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down plugin lifecycle manager');
    
    // Wait for any ongoing installations to complete
    while (this.installationLocks.size > 0) {
      this.logger.info(`Waiting for ${this.installationLocks.size} installations to complete`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.installations.clear();
    this.logger.info('Plugin lifecycle manager shut down');
  }

  /**
   * Install a plugin from a package
   */
  async installPlugin(
    packagePath: string,
    userId: string,
    workspaceId?: string,
    options: InstallationOptions = {}
  ): Promise<PluginInstallation> {
    this.logger.info(`Installing plugin from ${packagePath}`);

    try {
      // Extract and validate package
      const extractedPath = await this.packageExtractor.extract(packagePath);
      
      // Load and validate manifest
      const manifestResult = await this.manifestLoader.loadFromDirectory(extractedPath);
      
      if (!manifestResult.isValid) {
        throw new Error(`Invalid plugin manifest: ${manifestResult.errors.join(', ')}`);
      }

      const manifest = manifestResult.manifest;
      const pluginId = manifest.id;

      // Check for installation lock
      if (this.installationLocks.has(pluginId)) {
        throw new Error(`Plugin ${pluginId} is already being installed`);
      }

      // Set installation lock
      this.installationLocks.add(pluginId);

      try {
        // Check if plugin already exists
        const existingInstallation = await this.findExistingInstallation(pluginId, userId, workspaceId);
        
        if (existingInstallation && !options.force) {
          throw new Error(`Plugin ${pluginId} is already installed`);
        }

        // Verify package signature
        if (!options.skipSignatureVerification) {
          const signatureValid = await this.securityManager.verifyPluginSignature(packagePath, manifest);
          if (!signatureValid) {
            throw new Error(`Plugin signature verification failed for ${pluginId}`);
          }
        }

        // Validate permissions
        const permissionValidation = this.securityManager.validatePermissions(
          manifest,
          manifest.permissions
        );
        
        if (!permissionValidation.valid) {
          throw new Error(`Permission validation failed: ${permissionValidation.violations.join(', ')}`);
        }

        // Create installation record
        const installationId = this.generateInstallationId(pluginId, userId, workspaceId);
        
        const installationData: CreatePluginInstallationInput = {
          id: installationId,
          userId,
          workspaceId,
          pluginId,
          version: manifest.version,
          status: 'installing' as PluginInstallationStatus,
          config: {},
          settings: {
            enabled: true,
            autoUpdate: true,
            visible: true,
            order: 0,
            notifications: {
              enabled: true,
              types: ['updates', 'errors']
            }
          },
          grantedPermissions: options.autoGrantPermissions ? 
            manifest.permissions : 
            [], // Will be granted through UI flow
          grantedScopes: options.autoGrantPermissions ? 
            manifest.scopes : 
            []
        };

        // Create plugin directory
        const pluginInstallDir = path.join(this.pluginDir, pluginId, manifest.version);
        await fs.mkdir(pluginInstallDir, { recursive: true });

        // Copy plugin files
        await this.copyPluginFiles(extractedPath, pluginInstallDir);

        // Save manifest
        await fs.writeFile(
          path.join(pluginInstallDir, 'plugin.json'),
          JSON.stringify(manifest, null, 2),
          'utf-8'
        );

        // Create installation record
        const installation: PluginInstallation = {
          ...installationData,
          installedAt: new Date(),
          updatedAt: new Date(),
          status: 'active'
        };

        // Save installation to storage
        await this.storageManager.savePluginInstallation(installation);
        
        // Store in memory
        this.installations.set(installationId, installation);

        this.logger.info(`Plugin ${pluginId} installed successfully`);
        this.emit('pluginInstalled', installation);

        return installation;
      } finally {
        // Clean up extracted files
        await this.packageExtractor.cleanup(extractedPath);
        
        // Remove installation lock
        this.installationLocks.delete(pluginId);
      }
    } catch (error) {
      this.logger.error(`Failed to install plugin from ${packagePath}`, error);
      throw error;
    }
  }

  /**
   * Update a plugin to a new version
   */
  async updatePlugin(
    installationId: string,
    newPackagePath: string,
    options: UpdateOptions = {}
  ): Promise<PluginInstallation> {
    const installation = this.installations.get(installationId);
    if (!installation) {
      throw new Error(`Installation ${installationId} not found`);
    }

    this.logger.info(`Updating plugin ${installation.pluginId} from ${installation.version}`);

    try {
      // Extract and validate new package
      const extractedPath = await this.packageExtractor.extract(newPackagePath);
      
      const manifestResult = await this.manifestLoader.loadFromDirectory(extractedPath);
      if (!manifestResult.isValid) {
        throw new Error(`Invalid plugin manifest: ${manifestResult.errors.join(', ')}`);
      }

      const newManifest = manifestResult.manifest;
      
      // Verify it's the same plugin
      if (newManifest.id !== installation.pluginId) {
        throw new Error(`Plugin ID mismatch: expected ${installation.pluginId}, got ${newManifest.id}`);
      }

      // Check version compatibility
      const isNewer = this.isNewerVersion(newManifest.version, installation.version);
      if (!isNewer && !options.allowDowngrade) {
        throw new Error(`New version ${newManifest.version} is not newer than ${installation.version}`);
      }

      // Update installation status
      installation.status = 'updating';
      await this.storageManager.savePluginInstallation(installation);

      try {
        // Backup current installation if preserving user data
        let backupPath: string | undefined;
        if (options.preserveUserData) {
          backupPath = await this.createInstallationBackup(installation);
        }

        // Create new plugin directory
        const newPluginDir = path.join(this.pluginDir, installation.pluginId, newManifest.version);
        await fs.mkdir(newPluginDir, { recursive: true });

        // Copy new plugin files
        await this.copyPluginFiles(extractedPath, newPluginDir);

        // Save new manifest
        await fs.writeFile(
          path.join(newPluginDir, 'plugin.json'),
          JSON.stringify(newManifest, null, 2),
          'utf-8'
        );

        // Restore user data if requested
        if (backupPath && options.preserveUserData) {
          await this.restoreUserData(backupPath, newPluginDir);
        }

        // Update installation record
        installation.version = newManifest.version;
        installation.status = 'active';
        installation.updatedAt = new Date();

        // Update permissions if needed (may require user confirmation)
        const newPermissions = newManifest.permissions;
        const hasNewPermissions = newPermissions.some(p => !installation.grantedPermissions.includes(p));
        
        if (hasNewPermissions) {
          this.logger.warn(`Plugin ${installation.pluginId} requests new permissions after update`);
          // In a full implementation, this would trigger a permission request UI
        }

        await this.storageManager.savePluginInstallation(installation);
        this.installations.set(installationId, installation);

        // Clean up old version
        await this.cleanupOldVersion(installation.pluginId, installation.version);

        // Clean up backup
        if (backupPath) {
          await this.cleanupBackup(backupPath);
        }

        this.logger.info(`Plugin ${installation.pluginId} updated to version ${newManifest.version}`);
        this.emit('pluginUpdated', installation);

        return installation;
      } catch (updateError) {
        // Rollback on failure
        installation.status = 'error';
        await this.storageManager.savePluginInstallation(installation);
        throw updateError;
      } finally {
        await this.packageExtractor.cleanup(extractedPath);
      }
    } catch (error) {
      this.logger.error(`Failed to update plugin ${installation.pluginId}`, error);
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(installationId: string): Promise<void> {
    const installation = this.installations.get(installationId);
    if (!installation) {
      throw new Error(`Installation ${installationId} not found`);
    }

    this.logger.info(`Uninstalling plugin ${installation.pluginId}`);

    try {
      // Update status
      installation.status = 'uninstalling';
      await this.storageManager.savePluginInstallation(installation);

      // Remove plugin files
      const pluginDir = path.join(this.pluginDir, installation.pluginId);
      await this.removeDirectory(pluginDir);

      // Remove from storage
      await this.storageManager.removePluginInstallation(installationId);
      
      // Remove from memory
      this.installations.delete(installationId);

      this.logger.info(`Plugin ${installation.pluginId} uninstalled successfully`);
      this.emit('pluginUninstalled', installation);
    } catch (error) {
      // Rollback status on error
      installation.status = 'error';
      await this.storageManager.savePluginInstallation(installation);
      
      this.logger.error(`Failed to uninstall plugin ${installation.pluginId}`, error);
      throw error;
    }
  }

  /**
   * Load plugin manifest from installation
   */
  async loadPluginManifest(installationId: string): Promise<PluginManifest> {
    const installation = this.installations.get(installationId);
    if (!installation) {
      throw new Error(`Installation ${installationId} not found`);
    }

    const manifestPath = path.join(
      this.pluginDir,
      installation.pluginId,
      installation.version,
      'plugin.json'
    );

    const manifestResult = await this.manifestLoader.loadFromFile(manifestPath);
    
    if (!manifestResult.isValid) {
      throw new Error(`Invalid manifest for plugin ${installation.pluginId}: ${manifestResult.errors.join(', ')}`);
    }

    return manifestResult.manifest;
  }

  /**
   * Get all plugin installations
   */
  getInstallations(): PluginInstallation[] {
    return Array.from(this.installations.values());
  }

  /**
   * Get plugin installation by ID
   */
  getInstallation(installationId: string): PluginInstallation | undefined {
    return this.installations.get(installationId);
  }

  /**
   * Private: Ensure plugin directory structure exists
   */
  private async ensurePluginDirectoryStructure(): Promise<void> {
    await fs.mkdir(this.pluginDir, { recursive: true });
    await fs.mkdir(path.join(this.pluginDir, '.cache'), { recursive: true });
    await fs.mkdir(path.join(this.pluginDir, '.temp'), { recursive: true });
  }

  /**
   * Private: Load existing installations from storage
   */
  private async loadExistingInstallations(): Promise<void> {
    try {
      const installations = await this.storageManager.loadPluginInstallations();
      
      for (const installation of installations) {
        this.installations.set(installation.id, installation);
      }
      
      this.logger.info(`Loaded ${installations.length} existing plugin installations`);
    } catch (error) {
      this.logger.warn('Failed to load existing installations', error);
    }
  }

  /**
   * Private: Find existing installation
   */
  private async findExistingInstallation(
    pluginId: string,
    userId: string,
    workspaceId?: string
  ): Promise<PluginInstallation | undefined> {
    return Array.from(this.installations.values()).find(
      installation => 
        installation.pluginId === pluginId &&
        installation.userId === userId &&
        installation.workspaceId === workspaceId
    );
  }

  /**
   * Private: Generate installation ID
   */
  private generateInstallationId(pluginId: string, userId: string, workspaceId?: string): string {
    const data = `${pluginId}-${userId}-${workspaceId || 'global'}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Private: Copy plugin files
   */
  private async copyPluginFiles(sourcePath: string, destinationPath: string): Promise<void> {
    const entries = await fs.readdir(sourcePath, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(sourcePath, entry.name);
      const destPath = path.join(destinationPath, entry.name);
      
      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await this.copyPluginFiles(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Private: Remove directory recursively
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(`Failed to remove directory ${dirPath}`, error);
    }
  }

  /**
   * Private: Check if version is newer
   */
  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    // Simple version comparison - in production, use semver
    const newParts = newVersion.split('.').map(Number);
    const currentParts = currentVersion.split('.').map(Number);
    
    for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
      const newPart = newParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      
      if (newPart > currentPart) return true;
      if (newPart < currentPart) return false;
    }
    
    return false;
  }

  /**
   * Private: Create installation backup
   */
  private async createInstallationBackup(installation: PluginInstallation): Promise<string> {
    const backupDir = path.join(this.pluginDir, '.temp', `backup-${installation.id}-${Date.now()}`);
    const sourceDir = path.join(this.pluginDir, installation.pluginId, installation.version);
    
    await fs.mkdir(backupDir, { recursive: true });
    await this.copyPluginFiles(sourceDir, backupDir);
    
    return backupDir;
  }

  /**
   * Private: Restore user data from backup
   */
  private async restoreUserData(backupPath: string, newPluginDir: string): Promise<void> {
    // Copy user data files (configuration, cache, etc.)
    const userDataFiles = ['config.json', 'cache', 'user-data'];
    
    for (const fileName of userDataFiles) {
      const backupFile = path.join(backupPath, fileName);
      const newFile = path.join(newPluginDir, fileName);
      
      try {
        await fs.access(backupFile);
        const stat = await fs.stat(backupFile);
        
        if (stat.isDirectory()) {
          await fs.mkdir(newFile, { recursive: true });
          await this.copyPluginFiles(backupFile, newFile);
        } else {
          await fs.copyFile(backupFile, newFile);
        }
      } catch (error) {
        // File doesn't exist, skip
      }
    }
  }

  /**
   * Private: Cleanup old plugin version
   */
  private async cleanupOldVersion(pluginId: string, currentVersion: string): Promise<void> {
    const pluginBaseDir = path.join(this.pluginDir, pluginId);
    
    try {
      const versions = await fs.readdir(pluginBaseDir);
      const oldVersions = versions.filter(v => v !== currentVersion);
      
      // Keep only the last 2 versions for rollback
      if (oldVersions.length > 2) {
        const versionsToDelete = oldVersions.slice(0, -2);
        
        for (const version of versionsToDelete) {
          const versionDir = path.join(pluginBaseDir, version);
          await this.removeDirectory(versionDir);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup old versions for ${pluginId}`, error);
    }
  }

  /**
   * Private: Cleanup backup directory
   */
  private async cleanupBackup(backupPath: string): Promise<void> {
    try {
      await this.removeDirectory(backupPath);
    } catch (error) {
      this.logger.warn(`Failed to cleanup backup ${backupPath}`, error);
    }
  }
}