/**
 * Import/Export Transport
 * 
 * Handles manual import and export of configuration files
 * for backup and migration purposes.
 */

import { BaseSyncTransport } from '@flow-desk/shared/types';
import { WorkspaceSyncConfig } from '@flow-desk/shared/sync/WorkspaceSyncEngine';
import { dialog, app } from 'electron';
import { promises as fs } from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { createLogger } from '../shared/logging/LoggerFactory';

export class ImportExportTransport implements BaseSyncTransport {
  public readonly name = 'import_export';
  
  private lastExportPath: string | null = null;
  private lastImportPath: string | null = null;

  /**
   * Check if the transport is available
   */
  isAvailable(): boolean {
    // Import/export is always available as it's file-based
    return true;
  }

  /**
   * Download configuration (import from file)
   */
  async downloadConfiguration(): Promise<any> {
    try {
      // Show file picker dialog
      const result = await dialog.showOpenDialog({
        title: 'Import Flow Desk Configuration',
        filters: [
          { name: 'Flow Desk Config', extensions: ['workosync', 'json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error('Import cancelled by user');
      }

      const filePath = result.filePaths[0];
      this.lastImportPath = filePath;

      // Read and parse the configuration file
      const fileContent = await fs.readFile(filePath, 'utf8');
      const importData = this.parseImportFile(fileContent);

      // Validate the configuration structure
      this.validateConfiguration(importData);

      return importData;
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to import configuration:', error], method: 'console.error' });
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  /**
   * Upload configuration (export to file)
   */
  async uploadConfiguration(config: any): Promise<void> {
    try {
      // Generate default filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultName = `flowdesk-config-${timestamp}.workosync`;

      // Show save dialog
      const result = await dialog.showSaveDialog({
        title: 'Export Flow Desk Configuration',
        defaultPath: defaultName,
        filters: [
          { name: 'Flow Desk Config', extensions: ['workosync'] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        throw new Error('Export cancelled by user');
      }

      const filePath = result.filePath;
      this.lastExportPath = filePath;

      // Prepare export data with metadata
      const exportData = this.prepareExportData(config);

      // Determine format based on file extension
      const extension = path.extname(filePath).toLowerCase();
      const isEncrypted = extension === '.workosync';

      let fileContent: string;
      
      if (isEncrypted) {
        // Encrypt the configuration
        fileContent = await this.encryptConfiguration(exportData);
      } else {
        // Plain JSON export
        fileContent = JSON.stringify(exportData, null, 2);
      }

      // Write to file
      await fs.writeFile(filePath, fileContent, 'utf8');

      logger.debug('Console log', undefined, { originalArgs: [`Configuration exported to: ${filePath}`], method: 'console.log' });
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to export configuration:', error], method: 'console.error' });
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Check if the transport supports real-time updates
   */
  supportsRealTimeUpdates(): boolean {
    return false;
  }

  /**
   * Get the last modification time
   */
  async getLastModified(): Promise<Date> {
    if (!this.lastImportPath) {
      return new Date(0);
    }

    try {
      const stats = await fs.stat(this.lastImportPath);
      return stats.mtime;
    } catch {
      return new Date(0);
    }
  }

  /**
   * Export configuration with password protection
   */
  async exportWithPassword(config: any, password: string): Promise<string> {
    try {
      const exportData = this.prepareExportData(config);
      const encrypted = await this.encryptWithPassword(exportData, password);
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `flowdesk-config-${timestamp}.workosync`;
      
      // Save to downloads or documents folder
      const downloadsPath = app.getPath('downloads');
      const filePath = path.join(downloadsPath, filename);
      
      await fs.writeFile(filePath, encrypted, 'utf8');
      
      return filePath;
    } catch (error) {
      throw new Error(`Password-protected export failed: ${error.message}`);
    }
  }

  /**
   * Import configuration with password
   */
  async importWithPassword(filePath: string, password: string): Promise<any> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const decrypted = await this.decryptWithPassword(fileContent, password);
      const config = JSON.parse(decrypted);
      
      this.validateConfiguration(config);
      return config;
    } catch (error) {
      throw new Error(`Password-protected import failed: ${error.message}`);
    }
  }

  /**
   * Create a quick backup
   */
  async createQuickBackup(config: any): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `flowdesk-backup-${timestamp}.json`;
      
      // Save to user data directory
      const userDataPath = app.getPath('userData');
      const backupsDir = path.join(userDataPath, 'backups');
      
      // Ensure backups directory exists
      try {
        await fs.mkdir(backupsDir, { recursive: true });
      } catch {
        // Directory already exists
      }
      
      const filePath = path.join(backupsDir, filename);
      const exportData = this.prepareExportData(config);
      
      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
      
      return filePath;
    } catch (error) {
      throw new Error(`Quick backup failed: ${error.message}`);
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{ path: string; created: Date; size: number }>> {
    try {
      const userDataPath = app.getPath('userData');
      const backupsDir = path.join(userDataPath, 'backups');
      
      try {
        const files = await fs.readdir(backupsDir);
        const backups = [];
        
        for (const file of files) {
          if (file.startsWith('flowdesk-backup-') && file.endsWith('.json')) {
            const filePath = path.join(backupsDir, file);
            const stats = await fs.stat(filePath);
            
            backups.push({
              path: filePath,
              created: stats.birthtime,
              size: stats.size,
            });
          }
        }
        
        return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
      } catch {
        return [];
      }
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to list backups:', error], method: 'console.error' });
      return [];
    }
  }

  /**
   * Clean old backups (keep last N backups)
   */
  async cleanOldBackups(keepCount: number = 10): Promise<number> {
    try {
      const backups = await this.listBackups();
      
      if (backups.length <= keepCount) {
        return 0;
      }
      
      const toDelete = backups.slice(keepCount);
      let deletedCount = 0;
      
      for (const backup of toDelete) {
        try {
          await fs.unlink(backup.path);
          deletedCount++;
        } catch (error) {
          logger.error('Console error', undefined, { originalArgs: [`Failed to delete backup ${backup.path}:`, error], method: 'console.error' });
        }
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to clean old backups:', error], method: 'console.error' });
      return 0;
    }
  }

  // Private methods

  private parseImportFile(content: string): any {
    try {
      // Try to parse as encrypted file first
      try {
        const decrypted = this.decryptConfiguration(content);
        return JSON.parse(decrypted);
      } catch {
        // If decryption fails, try as plain JSON
        return JSON.parse(content);
      }
    } catch (error) {
      throw new Error('Invalid configuration file format');
    }
  }

  private prepareExportData(config: any): any {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: {
        app: 'Flow Desk',
        platform: process.platform,
        version: app.getVersion(),
      },
      configuration: config,
      metadata: {
        workspaceCount: config.workspaces.length,
        pluginCount: Object.keys(config.plugins).length,
        hasPreferences: Object.keys(config.preferences).length > 0,
      },
    };
  }

  private validateConfiguration(config: any): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration: not an object');
    }

    // If it's an export wrapper, extract the actual configuration
    if (config.configuration) {
      config = config.configuration;
    }

    if (!Array.isArray(config.workspaces)) {
      throw new Error('Invalid configuration: workspaces must be an array');
    }

    if (!config.plugins || typeof config.plugins !== 'object') {
      throw new Error('Invalid configuration: plugins must be an object');
    }

    if (!config.preferences || typeof config.preferences !== 'object') {
      throw new Error('Invalid configuration: preferences must be an object');
    }

    if (!config.version) {
      throw new Error('Invalid configuration: version is required');
    }
  }

  private async encryptConfiguration(data: any): Promise<string> {
    try {
      // Simple encryption using built-in crypto
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher('aes-256-cbc', key);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return key + iv + encrypted data (base64 encoded)
      const combined = {
        key: key.toString('hex'),
        iv: iv.toString('hex'),
        data: encrypted,
      };
      
      return Buffer.from(JSON.stringify(combined)).toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  private decryptConfiguration(encryptedData: string): string {
    try {
      const combined = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
      const key = Buffer.from(combined.key, 'hex');
      const iv = Buffer.from(combined.iv, 'hex');
      
      const decipher = crypto.createDecipher('aes-256-cbc', key);
      let decrypted = decipher.update(combined.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  private async encryptWithPassword(data: any, password: string): Promise<string> {
    try {
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      const combined = {
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted,
      };
      
      return Buffer.from(JSON.stringify(combined)).toString('base64');
    } catch (error) {
      throw new Error(`Password encryption failed: ${error.message}`);
    }
  }

  private async decryptWithPassword(encryptedData: string, password: string): Promise<string> {
    try {
      const combined = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
      const salt = Buffer.from(combined.salt, 'hex');
      const iv = Buffer.from(combined.iv, 'hex');
      const authTag = Buffer.from(combined.authTag, 'hex');
      const key = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
      
      const decipher = crypto.createDecipherGCM('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(combined.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Invalid password or corrupted data');
    }
  }
}