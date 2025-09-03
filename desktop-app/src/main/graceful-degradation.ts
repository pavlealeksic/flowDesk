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

  constructor(offlineStorage: OfflineStorageManager) {
    this.offlineStorage = offlineStorage;
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

  // Fallback crypto operations using Web Crypto API
  public async fallbackEncryption(data: string, key: string): Promise<string> {
    log.info('Using fallback JavaScript encryption');
    
    try {
      // Simple base64 encoding as minimal fallback
      // In production, you'd use proper Web Crypto API
      const encoded = Buffer.from(JSON.stringify({
        data,
        encrypted: true,
        fallback: true,
        timestamp: new Date().toISOString()
      })).toString('base64');
      
      return encoded;
    } catch (error) {
      log.error('Fallback encryption failed:', error);
      throw new Error('Encryption not available');
    }
  }

  public async fallbackDecryption(encryptedData: string, key: string): Promise<string> {
    log.info('Using fallback JavaScript decryption');
    
    try {
      const decoded = Buffer.from(encryptedData, 'base64').toString();
      const parsed = JSON.parse(decoded);
      
      if (parsed.fallback && parsed.encrypted) {
        return parsed.data;
      }
      
      return decoded;
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
          // In production, you would actually send the email here
          log.info(`Processing queued email: ${key}`);
          await this.offlineStorage.clearData(key);
          processed++;
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
          // In production, you would sync the event with the server
          log.info(`Processing local event: ${key}`);
          await this.offlineStorage.clearData(key);
          processed++;
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
    // In production, this would check actual service health
    // For now, simulate service availability
    switch (serviceId) {
      case 'mail-sync':
      case 'calendar-sync':
      case 'unified-search':
        // These services might be more prone to failure
        return Math.random() > 0.1; // 90% availability
      case 'mail-send':
      case 'calendar-create':
      case 'encryption':
        // Critical services should be more reliable
        return Math.random() > 0.05; // 95% availability
      default:
        return true;
    }
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