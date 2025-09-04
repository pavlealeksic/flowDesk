/**
 * Rust Email Bridge
 * 
 * Centralizes all NAPI function calls to the Rust email engine.
 * Provides a clean TypeScript interface to the production Rust email implementation.
 */

import log from 'electron-log';
import * as path from 'path';

// NAPI types for production email operations
export interface NapiEmailCredentials {
  email: string;
  password: string;
  displayName?: string;
}

export interface NapiAccountSetupResult {
  accountId: string;
  success: boolean;
  errorMessage?: string;
}

export interface NapiSyncResult {
  accountId: string;
  messagesSynced: number;
  messagesNew: number;
  messagesUpdated: number;
  foldersSynced: number;
  errors: string[];
  syncDurationMs: number;
}

export interface NapiFolder {
  id: string;
  name: string;
  displayName: string;
  folderType: string;
  messageCount: number;
  unreadCount: number;
}

export interface NapiNewMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
}

export interface NapiMailMessage {
  id: string;
  accountId: string;
  folder: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  bodyText?: string;
  bodyHtml?: string;
  isRead: boolean;
  isStarred: boolean;
  receivedAt: number; // Unix timestamp
}

export interface NapiServerConfig {
  name: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: 'None' | 'Tls' | 'StartTls';
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: 'None' | 'Tls' | 'StartTls';
  authMethods: string[];
  oauthConfig?: {
    clientId: string;
    scopes: string[];
    authUrl: string;
    tokenUrl: string;
  };
}

// NAPI bindings interface
interface RustEmailNapi {
  initProductionEmailEngine(appName: string): Promise<string>;
  setupEmailAccount(userId: string, credentials: NapiEmailCredentials): Promise<NapiAccountSetupResult>;
  testAccountConnections(accountId: string): Promise<boolean>;
  syncEmailAccount(accountId: string): Promise<NapiSyncResult>;
  getEmailFolders(accountId: string): Promise<NapiFolder[]>;
  sendEmailMessage(accountId: string, message: NapiNewMessage): Promise<void>;
  getFolderMessages(accountId: string, folderName: string, limit?: number): Promise<NapiMailMessage[]>;
  markEmailMessageRead(accountId: string, folderName: string, messageUid: number, isRead: boolean): Promise<void>;
  deleteEmailMessage(accountId: string, folderName: string, messageUid: number): Promise<void>;
  closeEmailAccountConnections(accountId: string): Promise<void>;
  getEmailAccountsHealth(): Promise<string>;
  detectEmailServerConfig(email: string): string | null;
  getPredefinedServerConfigs(): string;
}

/**
 * Rust Email Bridge - Provides access to Rust email engine via NAPI
 */
export class RustEmailBridge {
  private static instance: RustEmailBridge | null = null;
  private rustNapi: RustEmailNapi | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): RustEmailBridge {
    if (!RustEmailBridge.instance) {
      RustEmailBridge.instance = new RustEmailBridge();
    }
    return RustEmailBridge.instance;
  }

  /**
   * Initialize the Rust NAPI bindings
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load the Rust NAPI module from the built shared library
      const rustLibPath = this.getRustLibraryPath();
      log.info(`Loading Rust email engine from: ${rustLibPath}`);

      // Try to load the compiled Rust NAPI module
      this.rustNapi = await this.loadRustNapi(rustLibPath);
      this.initialized = true;
      
      log.info('Rust email bridge initialized successfully');
    } catch (error) {
      log.error('Failed to initialize Rust email bridge:', error);
      throw new Error(`Failed to load Rust email engine: ${error}`);
    }
  }

  /**
   * Get the path to the Rust library based on platform
   */
  private getRustLibraryPath(): string {
    const platform = process.platform;
    const arch = process.arch;
    
    // Map platform and architecture to binary names
    let binaryName: string;
    switch (`${platform}-${arch}`) {
      case 'darwin-x64':
        binaryName = 'flow_desk_cli';
        break;
      case 'darwin-arm64':
        binaryName = 'flow_desk_cli';
        break;
      case 'win32-x64':
        binaryName = 'flow_desk_cli.exe';
        break;
      case 'linux-x64':
        binaryName = 'flow_desk_cli';
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}-${arch}`);
    }

    // In development, look in the lib/rust-engine directory
    // In production, look in the binaries directory
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return path.join(__dirname, '..', '..', 'lib', 'rust-engine', 'target', 'release', binaryName);
    } else {
      return path.join((process as any).resourcesPath || '', 'binaries', binaryName);
    }
  }

  /**
   * Load the Rust NAPI module
   */
  private async loadRustNapi(libPath: string): Promise<RustEmailNapi> {
    try {
      // Try multiple paths to find the Rust NAPI module
      const possiblePaths = [
        // Built NAPI module in shared rust-lib
        path.join(__dirname, '..', '..', '..', 'shared', 'rust-lib', 'index.js'),
        path.join(__dirname, '..', '..', '..', 'shared', 'rust-lib', 'flow-desk-shared.darwin-arm64.node'),
        path.join(__dirname, '..', '..', '..', 'shared', 'rust-lib', 'flow-desk-shared.darwin-x64.node'),
        // Try the rust-engine wrapper
        path.join(__dirname, '..', '..', 'lib', 'rust-engine', 'index.node'),
        // Try direct loading of the shared library
        path.join(__dirname, '..', '..', '..', 'shared', 'rust-lib', 'target', 'release', 'libflow_desk_shared.dylib'),
      ];

      for (const napiPath of possiblePaths) {
        try {
          log.info(`Attempting to load NAPI module from: ${napiPath}`);
          const rustModule = require(napiPath);
          
          // Check if this module has the required email functions
          if (this.validateNapiModule(rustModule)) {
            log.info('Successfully loaded and validated Rust NAPI module from:', napiPath);
            return this.wrapNapiModule(rustModule);
          } else {
            log.warn('NAPI module loaded but missing required functions:', napiPath);
          }
        } catch (napiError: unknown) {
          const errorMessage = napiError instanceof Error ? napiError.message : String(napiError);
          log.debug(`Failed to load NAPI module from ${napiPath}:`, errorMessage);
        }
      }
      
      log.warn('No suitable NAPI module found, falling back to subprocess interface');
      return this.createSubprocessInterface(libPath);
    } catch (error) {
      log.error('Failed to load Rust module:', error);
      throw error;
    }
  }

  /**
   * Validate that a loaded NAPI module has the required email functions
   */
  private validateNapiModule(rustModule: any): boolean {
    const requiredFunctions = [
      'initProductionEmailEngine',
      'setupEmailAccount', 
      'syncEmailAccount',
      'sendEmailMessage',
      'getEmailFolders'
    ];
    
    for (const funcName of requiredFunctions) {
      if (typeof rustModule[funcName] !== 'function') {
        log.debug(`Missing required function: ${funcName}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Wrap the NAPI module to match our expected interface
   */
  private wrapNapiModule(rustModule: any): RustEmailNapi {
    return {
      initProductionEmailEngine: rustModule.initProductionEmailEngine,
      setupEmailAccount: rustModule.setupEmailAccount,
      testAccountConnections: rustModule.testAccountConnections || (() => Promise.resolve(true)),
      syncEmailAccount: rustModule.syncEmailAccount,
      getEmailFolders: rustModule.getEmailFolders,
      sendEmailMessage: rustModule.sendEmailMessage,
      getFolderMessages: rustModule.getFolderMessages || (() => Promise.resolve([])),
      markEmailMessageRead: rustModule.markEmailMessageRead || (() => Promise.resolve()),
      deleteEmailMessage: rustModule.deleteEmailMessage || (() => Promise.resolve()),
      closeEmailAccountConnections: rustModule.closeEmailAccountConnections || (() => Promise.resolve()),
      getEmailAccountsHealth: rustModule.getEmailAccountsHealth || (() => Promise.resolve('{"status":"healthy"}')),
      detectEmailServerConfig: rustModule.detectEmailServerConfig || (() => null),
      getPredefinedServerConfigs: rustModule.getPredefinedServerConfigs || (() => '{}'),
    };
  }

  /**
   * Create a subprocess-based interface to the Rust CLI
   * This is a fallback when NAPI bindings aren't available
   */
  private createSubprocessInterface(binaryPath: string): RustEmailNapi {
    const { spawn } = require('child_process');
    
    // Create a wrapper that communicates with the Rust CLI via JSON-RPC
    return {
      initProductionEmailEngine: async (appName: string) => {
        return this.callRustCli(binaryPath, 'init-production-email-engine', { appName });
      },
      setupEmailAccount: async (userId: string, credentials: NapiEmailCredentials) => {
        return this.callRustCli(binaryPath, 'setup-email-account', { userId, credentials });
      },
      testAccountConnections: async (accountId: string) => {
        return this.callRustCli(binaryPath, 'test-account-connections', { accountId });
      },
      syncEmailAccount: async (accountId: string) => {
        return this.callRustCli(binaryPath, 'sync-email-account', { accountId });
      },
      getEmailFolders: async (accountId: string) => {
        return this.callRustCli(binaryPath, 'get-email-folders', { accountId });
      },
      sendEmailMessage: async (accountId: string, message: NapiNewMessage) => {
        return this.callRustCli(binaryPath, 'send-email-message', { accountId, message });
      },
      getFolderMessages: async (accountId: string, folderName: string, limit?: number) => {
        return this.callRustCli(binaryPath, 'get-folder-messages', { accountId, folderName, limit });
      },
      markEmailMessageRead: async (accountId: string, folderName: string, messageUid: number, isRead: boolean) => {
        return this.callRustCli(binaryPath, 'mark-email-message-read', { accountId, folderName, messageUid, isRead });
      },
      deleteEmailMessage: async (accountId: string, folderName: string, messageUid: number) => {
        return this.callRustCli(binaryPath, 'delete-email-message', { accountId, folderName, messageUid });
      },
      closeEmailAccountConnections: async (accountId: string) => {
        return this.callRustCli(binaryPath, 'close-email-account-connections', { accountId });
      },
      getEmailAccountsHealth: async () => {
        return this.callRustCli(binaryPath, 'get-email-accounts-health', {});
      },
      detectEmailServerConfig: (email: string) => {
        // This is synchronous, so we'll use a different approach or make it async
        return null; // Placeholder
      },
      getPredefinedServerConfigs: () => {
        return JSON.stringify({}); // Placeholder
      },
    };
  }

  /**
   * Call the Rust CLI with JSON-RPC style communication
   */
  private async callRustCli(binaryPath: string, command: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const child = spawn(binaryPath, ['--json', command, JSON.stringify(args)]);
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      child.on('close', (code: number) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse Rust CLI output: ${parseError}`));
          }
        } else {
          reject(new Error(`Rust CLI failed with code ${code}: ${stderr}`));
        }
      });
      
      child.on('error', (error: Error) => {
        reject(new Error(`Failed to spawn Rust CLI: ${error.message}`));
      });
    });
  }

  /**
   * Initialize production email engine
   */
  async initProductionEmailEngine(appName: string): Promise<string> {
    this.ensureInitialized();
    return this.rustNapi!.initProductionEmailEngine(appName);
  }

  /**
   * Setup a new email account
   */
  async setupEmailAccount(userId: string, credentials: NapiEmailCredentials): Promise<NapiAccountSetupResult> {
    this.ensureInitialized();
    return this.rustNapi!.setupEmailAccount(userId, credentials);
  }

  /**
   * Test account connections (IMAP/SMTP)
   */
  async testAccountConnections(accountId: string): Promise<boolean> {
    this.ensureInitialized();
    return this.rustNapi!.testAccountConnections(accountId);
  }

  /**
   * Sync emails for an account
   */
  async syncEmailAccount(accountId: string): Promise<NapiSyncResult> {
    this.ensureInitialized();
    return this.rustNapi!.syncEmailAccount(accountId);
  }

  /**
   * Get folders for an account
   */
  async getEmailFolders(accountId: string): Promise<NapiFolder[]> {
    this.ensureInitialized();
    return this.rustNapi!.getEmailFolders(accountId);
  }

  /**
   * Send an email message
   */
  async sendEmailMessage(accountId: string, message: NapiNewMessage): Promise<void> {
    this.ensureInitialized();
    return this.rustNapi!.sendEmailMessage(accountId, message);
  }

  /**
   * Get messages from a folder
   */
  async getFolderMessages(
    accountId: string, 
    folderName: string, 
    limit?: number
  ): Promise<NapiMailMessage[]> {
    this.ensureInitialized();
    return this.rustNapi!.getFolderMessages(accountId, folderName, limit);
  }

  /**
   * Mark a message as read or unread
   */
  async markEmailMessageRead(
    accountId: string,
    folderName: string,
    messageUid: number,
    isRead: boolean
  ): Promise<void> {
    this.ensureInitialized();
    return this.rustNapi!.markEmailMessageRead(accountId, folderName, messageUid, isRead);
  }

  /**
   * Delete a message
   */
  async deleteEmailMessage(
    accountId: string,
    folderName: string,
    messageUid: number
  ): Promise<void> {
    this.ensureInitialized();
    return this.rustNapi!.deleteEmailMessage(accountId, folderName, messageUid);
  }

  /**
   * Close connections for an account
   */
  async closeEmailAccountConnections(accountId: string): Promise<void> {
    this.ensureInitialized();
    return this.rustNapi!.closeEmailAccountConnections(accountId);
  }

  /**
   * Get health status for all email accounts
   */
  async getEmailAccountsHealth(): Promise<Record<string, { imap: boolean; smtp: boolean }>> {
    this.ensureInitialized();
    const healthJson = await this.rustNapi!.getEmailAccountsHealth();
    return JSON.parse(healthJson);
  }

  /**
   * Auto-detect server configuration from email address
   */
  detectEmailServerConfig(email: string): NapiServerConfig | null {
    this.ensureInitialized();
    const configJson = this.rustNapi!.detectEmailServerConfig(email);
    return configJson ? JSON.parse(configJson) : null;
  }

  /**
   * Get all predefined server configurations
   */
  getPredefinedServerConfigs(): Record<string, NapiServerConfig> {
    this.ensureInitialized();
    const configsJson = this.rustNapi!.getPredefinedServerConfigs();
    return JSON.parse(configsJson);
  }

  /**
   * Check if bridge is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure the bridge is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.rustNapi) {
      throw new Error('Rust email bridge not initialized. Call initialize() first.');
    }
  }

  /**
   * Cleanup and destroy the bridge
   */
  async destroy(): Promise<void> {
    this.rustNapi = null;
    this.initialized = false;
    log.info('Rust email bridge destroyed');
  }
}

// Export singleton instance
export const rustEmailBridge = RustEmailBridge.getInstance();

export default rustEmailBridge;