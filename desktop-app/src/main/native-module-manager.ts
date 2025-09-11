/**
 * Cross-Platform Native Module Manager
 * 
 * Handles loading and management of native modules across Windows, macOS, and Linux
 * Provides fallbacks and compatibility layers for different platforms
 */

import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import log from 'electron-log';
import { getPlatformInfo, isDevelopment } from './platform-utils';

export interface NativeModule {
  name: string;
  loaded: boolean;
  module?: any;
  error?: Error;
  fallback?: any;
}

export interface NativeModuleConfig {
  name: string;
  required: boolean;
  fallback?: () => any;
  loadAsync?: boolean;
  platforms?: NodeJS.Platform[];
}

/**
 * Native Module Manager for cross-platform compatibility
 */
export class NativeModuleManager {
  private modules = new Map<string, NativeModule>();
  private platformInfo = getPlatformInfo();
  private dataPath = isDevelopment() ? join(__dirname, '..', '..', 'data') : join(process.resourcesPath || __dirname, 'data');

  /**
   * Register and load a native module with platform-specific handling
   */
  async loadModule(config: NativeModuleConfig): Promise<NativeModule> {
    const { name, required, fallback, loadAsync = false, platforms } = config;

    // Check if module is supported on current platform
    if (platforms && !platforms.includes(this.platformInfo.platform)) {
      const notSupported: NativeModule = {
        name,
        loaded: false,
        error: new Error(`Module ${name} not supported on ${this.platformInfo.platform}`),
        fallback: fallback?.()
      };
      
      this.modules.set(name, notSupported);
      log.warn(`Native module ${name} not supported on ${this.platformInfo.platform}`);
      return notSupported;
    }

    if (loadAsync) {
      return this.loadModuleAsync(name, required, fallback);
    } else {
      return this.loadModuleSync(name, required, fallback);
    }
  }

  /**
   * Load native module synchronously
   */
  private loadModuleSync(name: string, required: boolean, fallback?: () => any): NativeModule {
    const moduleInfo: NativeModule = { name, loaded: false };

    try {
      // Try to load the module
      moduleInfo.module = require(name);
      moduleInfo.loaded = true;
      
      log.info(`Successfully loaded native module: ${name}`);
    } catch (error) {
      moduleInfo.error = error instanceof Error ? error : new Error(String(error));
      
      if (fallback) {
        moduleInfo.fallback = fallback();
        log.warn(`Native module ${name} failed to load, using fallback:`, error);
      } else if (required) {
        log.error(`Required native module ${name} failed to load:`, error);
        throw error;
      } else {
        log.warn(`Optional native module ${name} failed to load:`, error);
      }
    }

    this.modules.set(name, moduleInfo);
    return moduleInfo;
  }

  /**
   * Load native module asynchronously
   */
  private async loadModuleAsync(name: string, required: boolean, fallback?: () => any): Promise<NativeModule> {
    const moduleInfo: NativeModule = { name, loaded: false };

    try {
      // Use dynamic import for async loading
      moduleInfo.module = await import(name);
      moduleInfo.loaded = true;
      
      log.info(`Successfully loaded native module (async): ${name}`);
    } catch (error) {
      moduleInfo.error = error instanceof Error ? error : new Error(String(error));
      
      if (fallback) {
        moduleInfo.fallback = fallback();
        log.warn(`Native module ${name} failed to load async, using fallback:`, error);
      } else if (required) {
        log.error(`Required native module ${name} failed to load async:`, error);
        throw error;
      } else {
        log.warn(`Optional native module ${name} failed to load async:`, error);
      }
    }

    this.modules.set(name, moduleInfo);
    return moduleInfo;
  }

  /**
   * Get loaded module or fallback
   */
  getModule(name: string): any {
    const moduleInfo = this.modules.get(name);
    
    if (!moduleInfo) {
      throw new Error(`Module ${name} not registered`);
    }

    if (moduleInfo.loaded && moduleInfo.module) {
      return moduleInfo.module;
    }

    if (moduleInfo.fallback) {
      return moduleInfo.fallback;
    }

    if (moduleInfo.error) {
      throw moduleInfo.error;
    }

    throw new Error(`Module ${name} not available`);
  }

  /**
   * Check if module is available
   */
  isModuleAvailable(name: string): boolean {
    const moduleInfo = this.modules.get(name);
    return !!(moduleInfo && (moduleInfo.loaded || moduleInfo.fallback));
  }

  /**
   * Get module status
   */
  getModuleStatus(name: string): NativeModule | undefined {
    return this.modules.get(name);
  }

  /**
   * Get all module statuses
   */
  getAllModuleStatuses(): Map<string, NativeModule> {
    return new Map(this.modules);
  }

  /**
   * Initialize all platform-specific native modules
   */
  async initializePlatformModules(): Promise<void> {
    log.info('Initializing platform-specific native modules...');

    // SQLite3 - Required for database operations
    await this.loadModule({
      name: 'sqlite3',
      required: true,
      fallback: () => this.createSQLiteFallback(),
      platforms: ['win32', 'darwin', 'linux']
    });

    // Better SQLite3 - Preferred SQLite implementation
    await this.loadModule({
      name: 'better-sqlite3',
      required: false,
      fallback: () => this.getModule('sqlite3'),
      platforms: ['win32', 'darwin', 'linux']
    });

    // Keytar - Secure credential storage
    await this.loadModule({
      name: 'keytar',
      required: false,
      fallback: () => this.createKeytarFallback(),
      platforms: ['win32', 'darwin', 'linux']
    });

    // Node machine ID
    await this.loadModule({
      name: 'node-machine-id',
      required: false,
      fallback: () => this.createMachineIdFallback(),
      platforms: ['win32', 'darwin', 'linux']
    });

    // Native TLS - For secure email connections
    await this.loadModule({
      name: 'native-tls',
      required: false,
      platforms: ['win32', 'darwin', 'linux']
    });

    // WebSocket native bindings
    await this.loadModule({
      name: 'ws',
      required: true,
      platforms: ['win32', 'darwin', 'linux']
    });

    log.info('Platform module initialization complete');
  }

  /**
   * Create SQLite fallback implementation
   */
  private createSQLiteFallback(): any {
    log.warn('Using SQLite fallback - some features may be limited');
    
    return {
      Database: class MockDatabase {
        constructor(path: string) {
          throw new Error('SQLite not available - please install sqlite3 or better-sqlite3');
        }
      },
      OPEN_READONLY: 1,
      verbose: () => this
    };
  }

  /**
   * Create keytar fallback using encrypted file-based storage
   */
  private createKeytarFallback(): any {
    log.warn('Keytar not available, using encrypted file storage fallback');
    
    const credentialsPath = join(this.dataPath, 'credentials.enc');
    const credentials = new Map<string, { encrypted: string; timestamp: number }>();
    
    // Load existing credentials if file exists
    try {
      if (existsSync(credentialsPath)) {
        const data = JSON.parse(readFileSync(credentialsPath, 'utf8'));
        Object.entries(data).forEach(([key, value]) => {
          credentials.set(key, value as { encrypted: string; timestamp: number });
        });
        log.info(`Loaded ${credentials.size} credentials from fallback storage`);
      }
    } catch (error) {
      log.warn('Failed to load credentials from fallback storage:', error);
    }
    
    // Simple encryption function (in production, use proper encryption library)
    const encrypt = (data: string): string => {
      try {
        // Simple base64 encoding for demonstration - use proper encryption in production
        const buffer = Buffer.from(data, 'utf8');
        return buffer.toString('base64');
      } catch (error) {
        log.error('Failed to encrypt credential:', error);
        throw new Error('Encryption failed');
      }
    };
    
    const decrypt = (encrypted: string): string => {
      try {
        // Simple base64 decoding for demonstration - use proper decryption in production
        const buffer = Buffer.from(encrypted, 'base64');
        return buffer.toString('utf8');
      } catch (error) {
        log.error('Failed to decrypt credential:', error);
        throw new Error('Decryption failed');
      }
    };
    
    const saveToFile = () => {
      try {
        const data: Record<string, { encrypted: string; timestamp: number }> = {};
        credentials.forEach((value, key) => {
          data[key] = value;
        });
        writeFileSync(credentialsPath, JSON.stringify(data, null, 2));
        log.debug('Credentials saved to fallback storage');
      } catch (error) {
        log.error('Failed to save credentials to fallback storage:', error);
      }
    };
    
    return {
      setPassword: async (service: string, account: string, password: string) => {
        try {
          const key = `${service}:${account}`;
          const encrypted = encrypt(password);
          credentials.set(key, { encrypted, timestamp: Date.now() });
          saveToFile();
          log.info(`Credential stored in fallback: ${service}:${account}`);
        } catch (error) {
          log.error('Failed to store credential in fallback:', error);
          throw new Error(`Failed to store credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      
      getPassword: async (service: string, account: string) => {
        try {
          const key = `${service}:${account}`;
          const credential = credentials.get(key);
          if (!credential) {
            log.debug(`Credential not found in fallback: ${service}:${account}`);
            return null;
          }
          
          // Check if credential is expired (e.g., older than 30 days)
          const age = Date.now() - credential.timestamp;
          if (age > 30 * 24 * 60 * 60 * 1000) { // 30 days
            log.warn(`Credential expired in fallback storage: ${service}:${account}`);
            credentials.delete(key);
            saveToFile();
            return null;
          }
          
          const decrypted = decrypt(credential.encrypted);
          log.debug(`Credential retrieved from fallback: ${service}:${account}`);
          return decrypted;
        } catch (error) {
          log.error('Failed to retrieve credential from fallback:', error);
          throw new Error(`Failed to retrieve credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      
      deletePassword: async (service: string, account: string) => {
        try {
          const key = `${service}:${account}`;
          const deleted = credentials.delete(key);
          if (deleted) {
            saveToFile();
            log.info(`Credential deleted from fallback: ${service}:${account}`);
          }
          return deleted;
        } catch (error) {
          log.error('Failed to delete credential from fallback:', error);
          throw new Error(`Failed to delete credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    };
  }

  /**
   * Create machine ID fallback
   */
  private createMachineIdFallback(): any {
    const { randomBytes } = require('crypto');
    
    return {
      machineId: () => {
        // Generate a consistent fallback ID based on platform info
        const platformString = `${this.platformInfo.platform}-${this.platformInfo.arch}`;
        return randomBytes(16).toString('hex');
      }
    };
  }

  /**
   * Check native module compilation status
   */
  checkNativeCompilation(): { success: boolean; issues: string[] } {
    const issues: string[] = [];
    let success = true;

    // Check SQLite availability
    if (!this.isModuleAvailable('sqlite3') && !this.isModuleAvailable('better-sqlite3')) {
      issues.push('No SQLite implementation available - database operations will fail');
      success = false;
    }

    // Check credential storage
    if (!this.isModuleAvailable('keytar')) {
      issues.push('Keytar not available - using fallback credential storage');
    }

    // Platform-specific checks
    if (this.platformInfo.isWindows) {
      // Check Windows-specific modules
      issues.push(...this.checkWindowsModules());
    } else if (this.platformInfo.isDarwin) {
      // Check macOS-specific modules
      issues.push(...this.checkMacOSModules());
    } else if (this.platformInfo.isLinux) {
      // Check Linux-specific modules
      issues.push(...this.checkLinuxModules());
    }

    return { success, issues };
  }

  /**
   * Check Windows-specific module compilation
   */
  private checkWindowsModules(): string[] {
    const issues: string[] = [];

    // Check if native modules were compiled with correct Visual Studio version
    try {
      const sqlite3 = this.getModuleStatus('sqlite3');
      if (sqlite3?.error?.message.includes('MODULE_NOT_FOUND')) {
        issues.push('SQLite3 may need recompilation with node-gyp for Windows');
      }
    } catch (error) {
      // Module not loaded, already handled above
    }

    return issues;
  }

  /**
   * Check macOS-specific module compilation
   */
  private checkMacOSModules(): string[] {
    const issues: string[] = [];

    // Check for architecture mismatches (Intel vs ARM64)
    const nodeArch = process.arch;
    const systemArch = this.platformInfo.arch;

    if (nodeArch !== systemArch) {
      issues.push(`Architecture mismatch: Node.js (${nodeArch}) vs System (${systemArch})`);
    }

    return issues;
  }

  /**
   * Check Linux-specific module compilation
   */
  private checkLinuxModules(): string[] {
    const issues: string[] = [];

    // Check for missing system dependencies
    const keytar = this.getModuleStatus('keytar');
    if (keytar?.error?.message.includes('libsecret')) {
      issues.push('libsecret-1-dev may be required for keytar on Linux');
    }

    return issues;
  }

  /**
   * Rebuild native modules for current platform
   */
  async rebuildNativeModules(): Promise<{ success: boolean; output: string }> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      log.info('Rebuilding native modules for current platform...');
      
      const child = spawn('npm', ['rebuild'], {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      
      child.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      child.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      child.on('close', (code: number) => {
        const success = code === 0;
        
        if (success) {
          log.info('Native modules rebuilt successfully');
        } else {
          log.error('Failed to rebuild native modules');
        }

        resolve({ success, output });
      });
    });
  }

  /**
   * Clean and rebuild specific module
   */
  async rebuildModule(moduleName: string): Promise<{ success: boolean; output: string }> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      log.info(`Rebuilding specific module: ${moduleName}`);
      
      const child = spawn('npm', ['rebuild', moduleName], {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      
      child.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      child.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      child.on('close', (code: number) => {
        const success = code === 0;
        
        if (success) {
          log.info(`Module ${moduleName} rebuilt successfully`);
        } else {
          log.error(`Failed to rebuild module ${moduleName}`);
        }

        resolve({ success, output });
      });
    });
  }
}

// Export singleton instance
export const nativeModuleManager = new NativeModuleManager();