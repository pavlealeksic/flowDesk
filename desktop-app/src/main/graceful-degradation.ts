/**
 * Graceful Degradation Patterns for Flow Desk
 * 
 * This module implements graceful degradation strategies that allow the application
 * to continue functioning even when core Rust services are unavailable.
 */

import { EventEmitter } from 'events';
import { app, BrowserWindow } from 'electron';
import log from 'electron-log';
import path from 'path';
import fs from 'fs/promises';
import { RealEmailService, SendEmailOptions } from './real-email-service';
import { GoogleCalendarService } from './google-calendar-service';
import * as CryptoJS from 'crypto-js';
import * as crypto from 'crypto';
import { net } from 'electron';

// Types for degradation modes
export enum DegradationLevel {
  NONE = 'none',
  PARTIAL = 'partial',
  OFFLINE = 'offline',
  CRITICAL = 'critical'
}

export interface ServiceCapability {
  name: string;
  essential: boolean;
  fallback?: string;
  dependencies: string[];
}

export interface DegradationState {
  level: DegradationLevel;
  services: { [key: string]: ServiceStatus };
  capabilities: string[];
  limitations: string[];
  timestamp: Date;
}

export interface ServiceStatus {
  available: boolean;
  degraded: boolean;
  fallbackActive: boolean;
  lastError?: string;
  lastCheck: Date;
}

// Service capabilities configuration
const SERVICE_CAPABILITIES: { [key: string]: ServiceCapability } = {
  'mail-sync': {
    name: 'Mail Synchronization',
    essential: false,
    fallback: 'offline-cache',
    dependencies: ['rust-engine', 'network']
  },
  'mail-send': {
    name: 'Send Email',
    essential: true,
    fallback: 'draft-queue',
    dependencies: ['rust-engine', 'network', 'authentication']
  },
  'mail-search': {
    name: 'Email Search',
    essential: false,
    fallback: 'local-search',
    dependencies: ['rust-engine']
  },
  'calendar-sync': {
    name: 'Calendar Synchronization',
    essential: false,
    fallback: 'offline-cache',
    dependencies: ['rust-engine', 'network']
  },
  'calendar-create': {
    name: 'Create Calendar Events',
    essential: true,
    fallback: 'local-storage',
    dependencies: ['rust-engine']
  },
  'unified-search': {
    name: 'Unified Search',
    essential: false,
    fallback: 'basic-search',
    dependencies: ['rust-engine', 'search-index']
  },
  'encryption': {
    name: 'Data Encryption',
    essential: true,
    fallback: 'js-crypto',
    dependencies: ['rust-engine']
  }
};

// Offline storage manager
class OfflineStorageManager {
  private storageDir: string;

  constructor() {
    this.storageDir = path.join(app.getPath('userData'), 'offline-storage');
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      log.error('Failed to initialize offline storage:', error);
    }
  }

  public async storeData(key: string, data: any): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
        version: 1
      }));
    } catch (error) {
      log.error(`Failed to store offline data for ${key}:`, error);
    }
  }

  public async retrieveData(key: string): Promise<any | null> {
    try {
      const filePath = path.join(this.storageDir, `${key}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed.data;
    } catch (error) {
      return null;
    }
  }

  public async listKeys(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.storageDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  public async clearData(key?: string): Promise<void> {
    try {
      if (key) {
        const filePath = path.join(this.storageDir, `${key}.json`);
        await fs.unlink(filePath);
      } else {
        const files = await fs.readdir(this.storageDir);
        await Promise.all(
          files.map(file => fs.unlink(path.join(this.storageDir, file)))
        );
      }
    } catch (error) {
      log.error('Failed to clear offline data:', error);
    }
  }
}

// Fallback implementations
class FallbackImplementations {
  private offlineStorage: OfflineStorageManager;
  private emailService: RealEmailService;
  private calendarService: GoogleCalendarService;

  constructor(offlineStorage: OfflineStorageManager) {
    this.offlineStorage = offlineStorage;
    this.emailService = new RealEmailService();
    this.calendarService = new GoogleCalendarService();
  }

  // Fallback mail operations
  public async fallbackMailSync(accountId: string): Promise<any> {
    log.info(`Using fallback mail sync for account ${accountId}`);
    
    // Try to return cached data
    const cachedData = await this.offlineStorage.retrieveData(`mail-${accountId}`);
    if (cachedData) {
      return {
        success: true,
        source: 'cache',
        data: cachedData,
        message: 'Using cached mail data'
      };
    }

    return {
      success: false,
      source: 'fallback',
      message: 'No cached mail data available. Sync will resume when service is restored.'
    };
  }

  public async fallbackSendMail(accountId: string, message: any): Promise<string> {
    log.info(`Queuing email for later sending: account ${accountId}`);
    
    // Store in draft queue for later sending
    const draftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.offlineStorage.storeData(`draft-${draftId}`, {
      accountId,
      message,
      status: 'queued',
      createdAt: new Date().toISOString()
    });

    return draftId;
  }

  public async fallbackMailSearch(query: string): Promise<any[]> {
    log.info(`Using fallback mail search for query: ${query}`);
    
    // Simple local search through cached data
    const keys = await this.offlineStorage.listKeys();
    const mailKeys = keys.filter(key => key.startsWith('mail-'));
    
    const results: any[] = [];
    for (const key of mailKeys) {
      const data = await this.offlineStorage.retrieveData(key);
      if (data && Array.isArray(data)) {
        const filtered = data.filter((item: any) => 
          JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
        );
        results.push(...filtered);
      }
    }

    return results.slice(0, 50); // Limit to 50 results
  }

  // Fallback calendar operations
  public async fallbackCalendarSync(accountId: string): Promise<any> {
    log.info(`Using fallback calendar sync for account ${accountId}`);
    
    const cachedData = await this.offlineStorage.retrieveData(`calendar-${accountId}`);
    if (cachedData) {
      return {
        success: true,
        source: 'cache',
        data: cachedData,
        message: 'Using cached calendar data'
      };
    }

    return {
      success: false,
      source: 'fallback',
      message: 'No cached calendar data available'
    };
  }

  public async fallbackCreateEvent(calendarId: string, eventData: any): Promise<string> {
    log.info(`Storing calendar event locally: calendar ${calendarId}`);
    
    const eventId = `local_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.offlineStorage.storeData(`event-${eventId}`, {
      calendarId,
      ...eventData,
      id: eventId,
      status: 'pending_sync',
      createdAt: new Date().toISOString()
    });

    return eventId;
  }

  // Fallback search operations
  public async fallbackUnifiedSearch(query: string): Promise<any[]> {
    log.info(`Using fallback unified search for query: ${query}`);
    
    // Combine results from cached mail and calendar data
    const mailResults = await this.fallbackMailSearch(query);
    
    const results = [
      ...mailResults.map(item => ({
        ...item,
        type: 'mail',
        relevance: 0.8
      }))
    ];

    return results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  }

  // Fallback crypto operations using Web Crypto API and crypto-js
  public async fallbackEncryption(data: string, key: string): Promise<string> {
    log.info('Using fallback JavaScript encryption with crypto-js');
    
    try {
      // Use crypto-js for proper encryption
      const derivedKey = CryptoJS.PBKDF2(key, 'flow-desk-salt', {
        keySize: 256/32,
        iterations: 100000
      });
      
      // Generate a random IV for each encryption
      const iv = CryptoJS.lib.WordArray.random(128/8);
      
      // Encrypt the data
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify({
        data,
        encrypted: true,
        fallback: true,
        timestamp: new Date().toISOString()
      }), derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      // Combine IV and encrypted data
      const combined = {
        iv: iv.toString(CryptoJS.enc.Hex),
        data: encrypted.toString()
      };
      
      return Buffer.from(JSON.stringify(combined)).toString('base64');
    } catch (error) {
      log.error('Fallback encryption failed:', error);
      throw new Error('Encryption not available');
    }
  }

  public async fallbackDecryption(encryptedData: string, key: string): Promise<string> {
    log.info('Using fallback JavaScript decryption with crypto-js');
    
    try {
      const decodedBase64 = Buffer.from(encryptedData, 'base64').toString();
      const combined = JSON.parse(decodedBase64);
      
      // Check if it's the new encrypted format
      if (combined.iv && combined.data) {
        // Use crypto-js for proper decryption
        const derivedKey = CryptoJS.PBKDF2(key, 'flow-desk-salt', {
          keySize: 256/32,
          iterations: 100000
        });
        
        const iv = CryptoJS.enc.Hex.parse(combined.iv);
        
        const decrypted = CryptoJS.AES.decrypt(combined.data, derivedKey, {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        
        const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
        const parsed = JSON.parse(decryptedString);
        
        if (parsed.fallback && parsed.encrypted) {
          return parsed.data;
        }
        
        return decryptedString;
      } else {
        // Handle old format (base64 only)
        const parsed = combined;
        if (parsed.fallback && parsed.encrypted) {
          return parsed.data;
        }
        return decodedBase64;
      }
    } catch (error) {
      log.error('Fallback decryption failed:', error);
      throw new Error('Decryption not available');
    }
  }

  // Process queued operations when service is restored
  public async processQueuedOperations(): Promise<{ processed: number; failed: number }> {
    log.info('Processing queued operations after service restoration');
    
    const keys = await this.offlineStorage.listKeys();
    const draftKeys = keys.filter(key => key.startsWith('draft-'));
    const eventKeys = keys.filter(key => key.startsWith('event-'));
    
    let processed = 0;
    let failed = 0;

    // Process draft emails
    for (const key of draftKeys) {
      try {
        const draft = await this.offlineStorage.retrieveData(key);
        if (draft && draft.status === 'queued') {
          log.info(`Processing queued email: ${key}`);
          
          // Actually send the email using the real email service
          try {
            const emailOptions: SendEmailOptions = {
              to: draft.message.to || [],
              cc: draft.message.cc,
              bcc: draft.message.bcc,
              subject: draft.message.subject,
              text: draft.message.text,
              html: draft.message.html,
              attachments: draft.message.attachments
            };
            
            const messageId = await this.emailService.sendEmail(draft.accountId, emailOptions);
            log.info(`Successfully sent queued email ${key}, message ID: ${messageId}`);
            
            await this.offlineStorage.clearData(key);
            processed++;
          } catch (sendError) {
            log.error(`Failed to send queued email ${key}:`, sendError);
            // Update draft status to failed for retry later
            draft.status = 'failed';
            draft.lastError = sendError instanceof Error ? sendError.message : 'Unknown error';
            draft.retryCount = (draft.retryCount || 0) + 1;
            await this.offlineStorage.storeData(key, draft);
            failed++;
          }
        }
      } catch (error) {
        log.error(`Failed to process draft ${key}:`, error);
        failed++;
      }
    }

    // Process local events
    for (const key of eventKeys) {
      try {
        const event = await this.offlineStorage.retrieveData(key);
        if (event && event.status === 'pending_sync') {
          log.info(`Processing local event: ${key}`);
          
          // Actually sync the event with the calendar service
          try {
            // Get calendar account associated with this event
            const calendarAccounts = this.calendarService.getAccounts();
            const account = calendarAccounts.find(acc => 
              acc.id === event.accountId || acc.email === event.accountEmail
            );
            
            if (account) {
              const eventId = await this.calendarService.createEvent(
                account.id,
                event.calendarId,
                event.title,
                new Date(event.startTime),
                new Date(event.endTime),
                event.description,
                event.location,
                event.attendees || []
              );
              
              log.info(`Successfully synced local event ${key}, calendar event ID: ${eventId}`);
              await this.offlineStorage.clearData(key);
              processed++;
            } else {
              log.warn(`No calendar account found for event ${key}`);
              // Keep the event for later retry
              event.retryCount = (event.retryCount || 0) + 1;
              event.lastError = 'No calendar account found';
              await this.offlineStorage.storeData(key, event);
              failed++;
            }
          } catch (syncError) {
            log.error(`Failed to sync local event ${key}:`, syncError);
            // Update event status for retry later
            event.status = 'sync_failed';
            event.lastError = syncError instanceof Error ? syncError.message : 'Unknown error';
            event.retryCount = (event.retryCount || 0) + 1;
            await this.offlineStorage.storeData(key, event);
            failed++;
          }
        }
      } catch (error) {
        log.error(`Failed to process event ${key}:`, error);
        failed++;
      }
    }

    return { processed, failed };
  }
}

// Main graceful degradation manager
export class GracefulDegradationManager extends EventEmitter {
  private degradationState: DegradationState;
  private offlineStorage: OfflineStorageManager;
  private fallbackImplementations: FallbackImplementations;
  private mainWindow?: BrowserWindow;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(mainWindow?: BrowserWindow) {
    super();
    this.mainWindow = mainWindow;
    this.offlineStorage = new OfflineStorageManager();
    this.fallbackImplementations = new FallbackImplementations(this.offlineStorage);
    
    this.degradationState = {
      level: DegradationLevel.NONE,
      services: {},
      capabilities: [],
      limitations: [],
      timestamp: new Date()
    };
  }

  public async initialize(): Promise<void> {
    await this.offlineStorage.initialize();
    this.startHealthMonitoring();
    log.info('Graceful degradation manager initialized');
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.assessSystemHealth();
    }, 30000); // Check every 30 seconds
  }

  public shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  private async assessSystemHealth(): Promise<void> {
    const serviceStatuses: { [key: string]: ServiceStatus } = {};
    
    // Check each service capability
    for (const [serviceId, capability] of Object.entries(SERVICE_CAPABILITIES)) {
      try {
        const isAvailable = await this.checkServiceHealth(serviceId);
        serviceStatuses[serviceId] = {
          available: isAvailable,
          degraded: !isAvailable,
          fallbackActive: !isAvailable && !!capability.fallback,
          lastCheck: new Date()
        };
      } catch (error) {
        serviceStatuses[serviceId] = {
          available: false,
          degraded: true,
          fallbackActive: !!capability.fallback,
          lastError: error instanceof Error ? error.message : String(error),
          lastCheck: new Date()
        };
      }
    }

    const newDegradationLevel = this.calculateDegradationLevel(serviceStatuses);
    
    if (newDegradationLevel !== this.degradationState.level) {
      await this.updateDegradationState(newDegradationLevel, serviceStatuses);
    }
  }

  private async checkServiceHealth(serviceId: string): Promise<boolean> {
    try {
      switch (serviceId) {
        case 'mail-sync':
        case 'mail-send':
          return await this.checkEmailServiceHealth();
        case 'mail-search':
          return await this.checkEmailSearchHealth();
        case 'calendar-sync':
        case 'calendar-create':
          return await this.checkCalendarServiceHealth();
        case 'unified-search':
          return await this.checkUnifiedSearchHealth();
        case 'encryption':
          return await this.checkEncryptionHealth();
        default:
          return true;
      }
    } catch (error) {
      log.error(`Health check failed for service ${serviceId}:`, error);
      return false;
    }
  }
  
  private async checkEmailServiceHealth(): Promise<boolean> {
    try {
      // Check if we have any configured email accounts
      const accounts = await this.emailService.getAccounts();
      if (accounts.length === 0) {
        return false; // No accounts configured
      }
      
      // Test connection for at least one account
      for (const account of accounts.slice(0, 1)) { // Test first account only
        try {
          const connectionTest = await this.emailService.testAccountConnection(account.id);
          if (connectionTest.imap || connectionTest.smtp) {
            return true; // At least one connection type working
          }
        } catch (error) {
          log.warn(`Email account ${account.id} connection test failed:`, error);
          continue; // Try next account
        }
      }
      
      return false;
    } catch (error) {
      log.error('Email service health check failed:', error);
      return false;
    }
  }
  
  private async checkEmailSearchHealth(): Promise<boolean> {
    try {
      const accounts = await this.emailService.getAccounts();
      if (accounts.length === 0) return false;
      
      // Test search capability on first account
      const account = accounts[0];
      await this.emailService.searchMessages(account.id, 'test', 'INBOX');
      return true;
    } catch (error) {
      log.warn('Email search health check failed:', error);
      return false;
    }
  }
  
  private async checkCalendarServiceHealth(): Promise<boolean> {
    try {
      const accounts = this.calendarService.getAccounts();
      if (accounts.length === 0) {
        return false; // No calendar accounts configured
      }
      
      // Test calendar account health
      for (const account of accounts.slice(0, 1)) { // Test first account only
        try {
          const healthCheck = await this.calendarService.checkAccountHealth(account.id);
          if (healthCheck.isHealthy) {
            return true;
          }
        } catch (error) {
          log.warn(`Calendar account ${account.id} health check failed:`, error);
          continue;
        }
      }
      
      return false;
    } catch (error) {
      log.error('Calendar service health check failed:', error);
      return false;
    }
  }
  
  private async checkUnifiedSearchHealth(): Promise<boolean> {
    try {
      // Check if basic search dependencies are available
      const emailHealthy = await this.checkEmailSearchHealth();
      const calendarHealthy = await this.checkCalendarServiceHealth();
      
      // Unified search is healthy if at least one underlying service is healthy
      return emailHealthy || calendarHealthy;
    } catch (error) {
      log.error('Unified search health check failed:', error);
      return false;
    }
  }
  
  private async checkEncryptionHealth(): Promise<boolean> {
    try {
      // Test encryption/decryption capability
      const testData = 'health-check-test-data';
      const testKey = 'test-key';
      
      const encrypted = await this.fallbackEncryption(testData, testKey);
      const decrypted = await this.fallbackDecryption(encrypted, testKey);
      
      return decrypted === testData;
    } catch (error) {
      log.error('Encryption health check failed:', error);
      return false;
    }
  }
  
  private async checkNetworkConnectivity(url: string = 'https://www.google.com'): Promise<boolean> {
    return new Promise((resolve) => {
      const request = net.request({
        method: 'HEAD',
        url: url,
        timeout: 5000
      });
      
      request.on('response', (response) => {
        resolve(response.statusCode >= 200 && response.statusCode < 300);
      });
      
      request.on('error', () => {
        resolve(false);
      });
      
      request.end();
    });
  }

  private calculateDegradationLevel(serviceStatuses: { [key: string]: ServiceStatus }): DegradationLevel {
    const totalServices = Object.keys(serviceStatuses).length;
    const unavailableServices = Object.values(serviceStatuses).filter(s => !s.available).length;
    const criticalServicesDown = Object.entries(serviceStatuses)
      .filter(([id, status]) => !status.available && SERVICE_CAPABILITIES[id]?.essential)
      .length;

    if (criticalServicesDown > 0) {
      return DegradationLevel.CRITICAL;
    }

    if (unavailableServices === 0) {
      return DegradationLevel.NONE;
    }

    if (unavailableServices / totalServices > 0.5) {
      return DegradationLevel.OFFLINE;
    }

    return DegradationLevel.PARTIAL;
  }

  private async updateDegradationState(
    newLevel: DegradationLevel,
    serviceStatuses: { [key: string]: ServiceStatus }
  ): Promise<void> {
    const previousLevel = this.degradationState.level;
    
    this.degradationState = {
      level: newLevel,
      services: serviceStatuses,
      capabilities: this.getAvailableCapabilities(serviceStatuses),
      limitations: this.getLimitations(serviceStatuses),
      timestamp: new Date()
    };

    log.info(`Degradation level changed from ${previousLevel} to ${newLevel}`);
    this.emit('degradation-changed', {
      previousLevel,
      newLevel,
      state: this.degradationState
    });

    // Notify the renderer process
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('system:degradation-changed', {
        level: newLevel,
        services: serviceStatuses,
        capabilities: this.degradationState.capabilities,
        limitations: this.degradationState.limitations
      });
    }

    // Handle service restoration
    if (previousLevel !== DegradationLevel.NONE && newLevel === DegradationLevel.NONE) {
      await this.handleServiceRestoration();
    }
  }

  private getAvailableCapabilities(serviceStatuses: { [key: string]: ServiceStatus }): string[] {
    return Object.entries(serviceStatuses)
      .filter(([_, status]) => status.available || status.fallbackActive)
      .map(([id]) => SERVICE_CAPABILITIES[id]?.name)
      .filter(Boolean);
  }

  private getLimitations(serviceStatuses: { [key: string]: ServiceStatus }): string[] {
    const limitations: string[] = [];
    
    for (const [serviceId, status] of Object.entries(serviceStatuses)) {
      if (!status.available) {
        const capability = SERVICE_CAPABILITIES[serviceId];
        if (capability) {
          if (status.fallbackActive) {
            limitations.push(`${capability.name} is using limited offline mode`);
          } else {
            limitations.push(`${capability.name} is currently unavailable`);
          }
        }
      }
    }

    return limitations;
  }

  private async handleServiceRestoration(): Promise<void> {
    log.info('All services restored, processing queued operations');
    
    try {
      const result = await this.fallbackImplementations.processQueuedOperations();
      log.info(`Processed ${result.processed} queued operations, ${result.failed} failed`);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('system:queued-operations-processed', result);
      }
    } catch (error) {
      log.error('Failed to process queued operations:', error);
    }
  }

  // Public API for fallback operations
  public getFallbackImplementations(): FallbackImplementations {
    return this.fallbackImplementations;
  }

  public getCurrentState(): DegradationState {
    return { ...this.degradationState };
  }

  public isServiceAvailable(serviceId: string): boolean {
    return this.degradationState.services[serviceId]?.available || false;
  }

  public isFallbackActive(serviceId: string): boolean {
    return this.degradationState.services[serviceId]?.fallbackActive || false;
  }

  public async forceServiceCheck(): Promise<void> {
    await this.assessSystemHealth();
  }

  public async clearOfflineStorage(): Promise<void> {
    await this.offlineStorage.clearData();
    log.info('Offline storage cleared');
  }
}

// Export singleton instance
let gracefulDegradationManager: GracefulDegradationManager | null = null;

export function getGracefulDegradationManager(mainWindow?: BrowserWindow): GracefulDegradationManager {
  if (!gracefulDegradationManager) {
    gracefulDegradationManager = new GracefulDegradationManager(mainWindow);
  }
  return gracefulDegradationManager;
}

export { FallbackImplementations, OfflineStorageManager };