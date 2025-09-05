"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailSyncManager = void 0;
const events_1 = require("events");
const electron_log_1 = __importDefault(require("electron-log"));
class MailSyncManager extends events_1.EventEmitter {
    constructor(notificationManager) {
        super();
        this.syncStatuses = new Map();
        this.syncIntervals = new Map();
        this.notificationManager = notificationManager;
    }
    async initialize() {
        electron_log_1.default.info('Mail sync manager initializing...');
        // Any initialization logic would go here
    }
    async startSync(accountId) {
        const status = {
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
    completeSync(accountId) {
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
    async stopSync(accountId) {
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
    getSyncStatus(accountId) {
        return this.syncStatuses.get(accountId);
    }
    getAllSyncStatuses() {
        return Array.from(this.syncStatuses.values());
    }
    async cleanup() {
        await this.shutdown();
    }
    async shutdown() {
        for (const [accountId] of this.syncStatuses) {
            await this.stopSync(accountId);
        }
        this.removeAllListeners();
    }
}
exports.MailSyncManager = MailSyncManager;
