import { EventEmitter } from 'events';
import log from 'electron-log';

export interface SyncStatus {
  accountId: string;
  isRunning: boolean;
  lastSync?: Date;
  progress: number;
  error?: string;
}

export class MailSyncManager extends EventEmitter {
  private syncStatuses: Map<string, SyncStatus> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
  }

  async startSync(accountId: string): Promise<void> {
    const status: SyncStatus = {
      accountId,
      isRunning: true,
      progress: 0,
      lastSync: new Date(),
    };

    this.syncStatuses.set(accountId, status);
    this.emit('sync-started', { accountId });

    // Simulate sync progress
    const interval = setInterval(() => {
      const currentStatus = this.syncStatuses.get(accountId);
      if (currentStatus && currentStatus.isRunning) {
        currentStatus.progress = Math.min(100, currentStatus.progress + 10);
        this.emit('sync-progress', { accountId, progress: currentStatus.progress });
        
        if (currentStatus.progress >= 100) {
          this.completeSync(accountId);
        }
      }
    }, 500);

    this.syncIntervals.set(accountId, interval);
  }

  private completeSync(accountId: string): void {
    const interval = this.syncIntervals.get(accountId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(accountId);
    }

    const status = this.syncStatuses.get(accountId);
    if (status) {
      status.isRunning = false;
      status.progress = 100;
      this.emit('sync-completed', { accountId });
    }
  }

  async stopSync(accountId: string): Promise<void> {
    const interval = this.syncIntervals.get(accountId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(accountId);
    }

    const status = this.syncStatuses.get(accountId);
    if (status) {
      status.isRunning = false;
      this.emit('sync-stopped', { accountId });
    }
  }

  getSyncStatus(accountId: string): SyncStatus | undefined {
    return this.syncStatuses.get(accountId);
  }

  getAllSyncStatuses(): SyncStatus[] {
    return Array.from(this.syncStatuses.values());
  }

  async shutdown(): Promise<void> {
    for (const [accountId] of this.syncStatuses) {
      await this.stopSync(accountId);
    }
    this.removeAllListeners();
  }
}