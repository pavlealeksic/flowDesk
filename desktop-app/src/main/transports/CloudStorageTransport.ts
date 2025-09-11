/**
 * Cloud Storage Transport
 * 
 * Handles synchronization through cloud storage services like iCloud Drive,
 * OneDrive, Google Drive, and Dropbox.
 */

import { BaseSyncTransport } from '@flow-desk/shared/types';
import { WorkspaceSyncConfig } from '@flow-desk/shared/sync/WorkspaceSyncEngine';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import { createLogger } from '../shared/logging/LoggerFactory';

export type CloudProvider = 'icloud' | 'onedrive' | 'googledrive' | 'dropbox';

export class CloudStorageTransport implements BaseSyncTransport {
  public readonly name: string;
  private provider: CloudProvider;
  private syncDirectory: string;
  private configFileName = 'flowdesk-config.encrypted';
  private lockFileName = 'flowdesk-sync.lock';

  constructor(provider: CloudProvider) {
    this.provider = provider;
    this.name = `${provider}_storage`;
    this.syncDirectory = this.getCloudSyncDirectory();
  }

  /**
   * Check if the transport is available
   */
  isAvailable(): boolean {
    try {
      // Check if the cloud sync directory exists and is accessible
      return this.syncDirectory !== '' && this.checkDirectoryAccess(this.syncDirectory);
    } catch {
      return false;
    }
  }

  /**
   * Download configuration from cloud storage
   */
  async downloadConfiguration(): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error(`${this.provider} storage not available`);
    }

    try {
      const configPath = path.join(this.syncDirectory, this.configFileName);
      
      // Check if config file exists
      try {
        await fs.access(configPath);
      } catch {
        // Return empty configuration if file doesn't exist
        return this.createEmptyConfig();
      }

      // Read and decrypt configuration
      const encryptedData = await fs.readFile(configPath, 'utf8');
      const decryptedData = await this.decrypt(encryptedData);
      
      return JSON.parse(decryptedData);
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: [`Failed to download configuration from ${this.provider}:`, error], method: 'console.error' });
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Upload configuration to cloud storage
   */
  async uploadConfiguration(config: any): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error(`${this.provider} storage not available`);
    }

    try {
      // Acquire lock to prevent concurrent writes
      await this.acquireLock();

      const configPath = path.join(this.syncDirectory, this.configFileName);
      
      // Encrypt and write configuration
      const jsonData = JSON.stringify(config, null, 2);
      const encryptedData = await this.encrypt(jsonData);
      
      // Write to temporary file first, then move to avoid partial writes
      const tempPath = `${configPath}.tmp`;
      await fs.writeFile(tempPath, encryptedData, 'utf8');
      await fs.rename(tempPath, configPath);

      // Release lock
      await this.releaseLock();
    } catch (error) {
      await this.releaseLock(); // Ensure lock is released on error
      logger.error('Console error', undefined, { originalArgs: [`Failed to upload configuration to ${this.provider}:`, error], method: 'console.error' });
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Check if the transport supports real-time updates
   */
  supportsRealTimeUpdates(): boolean {
    // Cloud storage typically doesn't support real-time push notifications
    // but we can implement polling
    return false;
  }

  /**
   * Get the last modification time of the remote configuration
   */
  async getLastModified(): Promise<Date> {
    if (!this.isAvailable()) {
      throw new Error(`${this.provider} storage not available`);
    }

    try {
      const configPath = path.join(this.syncDirectory, this.configFileName);
      const stats = await fs.stat(configPath);
      return stats.mtime;
    } catch (error) {
      // Return epoch if file doesn't exist
      return new Date(0);
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{ used: number; available: number; total: number }> {
    try {
      const configPath = path.join(this.syncDirectory, this.configFileName);
      let used = 0;
      
      try {
        const stats = await fs.stat(configPath);
        used = stats.size;
      } catch {
        // File doesn't exist
      }

      // Get available space (this is platform-specific)
      const available = await this.getAvailableSpace(this.syncDirectory);
      
      return {
        used,
        available,
        total: used + available,
      };
    } catch (error) {
      return { used: 0, available: 0, total: 0 };
    }
  }

  /**
   * Test the connection to the cloud storage
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        return false;
      }

      // Try to write a test file
      const testPath = path.join(this.syncDirectory, 'flowdesk-test.tmp');
      await fs.writeFile(testPath, 'test', 'utf8');
      await fs.unlink(testPath);
      
      return true;
    } catch {
      return false;
    }
  }

  // Private methods

  private getCloudSyncDirectory(): string {
    switch (this.provider) {
      case 'icloud':
        return this.getiCloudDirectory();
      case 'onedrive':
        return this.getOneDriveDirectory();
      case 'googledrive':
        return this.getGoogleDriveDirectory();
      case 'dropbox':
        return this.getDropboxDirectory();
      default:
        throw new Error(`Unsupported cloud provider: ${this.provider}`);
    }
  }

  private getiCloudDirectory(): string {
    if (process.platform !== 'darwin') return '';
    
    try {
      const iCloudPath = path.join(
        process.env.HOME || '',
        'Library/Mobile Documents/com~apple~CloudDocs',
        'FlowDesk'
      );
      
      // Create directory if it doesn't exist
      try {
        execSync(`mkdir -p "${iCloudPath}"`, { stdio: 'ignore' });
      } catch {
        // Directory might already exist
      }
      
      return iCloudPath;
    } catch {
      return '';
    }
  }

  private getOneDriveDirectory(): string {
    if (process.platform !== 'win32') return '';
    
    try {
      const oneDrivePath = path.join(
        process.env.USERPROFILE || '',
        'OneDrive',
        'FlowDesk'
      );
      
      // Create directory if it doesn't exist
      try {
        execSync(`mkdir "${oneDrivePath}"`, { stdio: 'ignore' });
      } catch {
        // Directory might already exist
      }
      
      return oneDrivePath;
    } catch {
      return '';
    }
  }

  private getGoogleDriveDirectory(): string {
    // Google Drive File Stream path
    let drivePath = '';
    
    switch (process.platform) {
      case 'win32':
        drivePath = 'G:\\My Drive\\FlowDesk'; // Default Google Drive letter
        break;
      case 'darwin':
        drivePath = path.join(process.env.HOME || '', 'Google Drive', 'My Drive', 'FlowDesk');
        break;
      default:
        return '';
    }
    
    try {
      // Create directory if it doesn't exist
      execSync(`mkdir -p "${drivePath}"`, { stdio: 'ignore' });
      return drivePath;
    } catch {
      return '';
    }
  }

  private getDropboxDirectory(): string {
    try {
      const dropboxPath = path.join(
        process.env.HOME || process.env.USERPROFILE || '',
        'Dropbox',
        'FlowDesk'
      );
      
      // Create directory if it doesn't exist
      try {
        const command = process.platform === 'win32' ? 
          `mkdir "${dropboxPath}"` : 
          `mkdir -p "${dropboxPath}"`;
        execSync(command, { stdio: 'ignore' });
      } catch {
        // Directory might already exist
      }
      
      return dropboxPath;
    } catch {
      return '';
    }
  }

  private checkDirectoryAccess(directory: string): boolean {
    try {
      execSync(`ls "${directory}"`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async acquireLock(): Promise<void> {
    const lockPath = path.join(this.syncDirectory, this.lockFileName);
    const lockData = {
      timestamp: Date.now(),
      pid: process.pid,
      device: app.getName(),
    };
    
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (attempts < maxAttempts) {
      try {
        // Check if lock exists
        try {
          const lockContent = await fs.readFile(lockPath, 'utf8');
          const existingLock = JSON.parse(lockContent);
          
          // Check if lock is stale (older than 2 minutes)
          if (Date.now() - existingLock.timestamp > 120000) {
            await fs.unlink(lockPath);
          } else {
            // Wait and retry
            await this.sleep(1000);
            attempts++;
            continue;
          }
        } catch {
          // Lock file doesn't exist, we can proceed
        }
        
        // Create lock file
        await fs.writeFile(lockPath, JSON.stringify(lockData), { flag: 'wx' });
        return; // Lock acquired
      } catch (error) {
        if (error.code === 'EEXIST') {
          // Lock exists, wait and retry
          await this.sleep(1000);
          attempts++;
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Failed to acquire sync lock - timeout');
  }

  private async releaseLock(): Promise<void> {
    const lockPath = path.join(this.syncDirectory, this.lockFileName);
    try {
      await fs.unlink(lockPath);
    } catch {
      // Lock might not exist or already be removed
    }
  }

  private async encrypt(data: string): Promise<string> {
    // Simple base64 encoding for now - in production, use proper encryption
    // This would integrate with the crypto utilities from shared/src/crypto
    return Buffer.from(data).toString('base64');
  }

  private async decrypt(encryptedData: string): Promise<string> {
    // Simple base64 decoding for now - in production, use proper decryption
    return Buffer.from(encryptedData, 'base64').toString('utf8');
  }

  private createEmptyConfig(): any {
    return {
      workspaces: [],
      plugins: {},
      preferences: {} as any,
      version: 'v1.0.0',
      timestamp: Date.now(),
      deviceId: 'empty',
    };
  }

  private async getAvailableSpace(directory: string): Promise<number> {
    try {
      if (process.platform === 'win32') {
        const output = execSync(`dir "${directory}" /-c`, { encoding: 'utf8' });
        // Parse Windows dir output for free space
        const match = output.match(/(\d+) bytes free/);
        return match ? parseInt(match[1]) : 0;
      } else {
        const output = execSync(`df -k "${directory}"`, { encoding: 'utf8' });
        // Parse df output for available space
        const lines = output.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].trim().split(/\s+/);
          return parseInt(parts[3]) * 1024; // Convert KB to bytes
        }
      }
    } catch {
      // Return 0 if we can't determine space
    }
    
    return 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}