import { EventEmitter } from 'events';
import log from 'electron-log';

export interface ScheduledEmail {
  id: string;
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  scheduledFor: Date;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  createdAt: Date;
  sentAt?: Date;
  error?: string;
}

export class EmailScheduler extends EventEmitter {
  private scheduledEmails: Map<string, ScheduledEmail> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.loadScheduledEmails();
  }

  private async loadScheduledEmails(): Promise<void> {
    // In a real implementation, this would load from database
    log.info('Email scheduler initialized');
  }

  async scheduleEmail(email: Omit<ScheduledEmail, 'id' | 'status' | 'createdAt'>): Promise<ScheduledEmail> {
    const scheduledEmail: ScheduledEmail = {
      ...email,
      id: `sched_${Date.now()}`,
      status: 'scheduled',
      createdAt: new Date(),
    };

    this.scheduledEmails.set(scheduledEmail.id, scheduledEmail);

    // Schedule the actual sending
    const delay = scheduledEmail.scheduledFor.getTime() - Date.now();
    if (delay > 0) {
      const timer = setTimeout(() => {
        this.sendScheduledEmail(scheduledEmail.id);
      }, delay);
      
      this.timers.set(scheduledEmail.id, timer);
    } else {
      // Send immediately if scheduled time has passed
      await this.sendScheduledEmail(scheduledEmail.id);
    }

    log.info(`Scheduled email for ${scheduledEmail.scheduledFor}`);
    this.emit('email-scheduled', scheduledEmail);
    return scheduledEmail;
  }

  private async sendScheduledEmail(emailId: string): Promise<void> {
    const email = this.scheduledEmails.get(emailId);
    if (!email || email.status !== 'scheduled') return;

    try {
      // Call the mail engine to send the email
      // In a real implementation, this would use the mail engine
      email.status = 'sent';
      email.sentAt = new Date();
      
      log.info(`Sent scheduled email: ${email.subject}`);
      this.emit('email-sent', email);
    } catch (error) {
      email.status = 'failed';
      email.error = error instanceof Error ? error.message : 'Unknown error';
      
      log.error(`Failed to send scheduled email: ${error}`);
      this.emit('email-failed', { email, error });
    }

    // Clean up timer
    const timer = this.timers.get(emailId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(emailId);
    }
  }

  async cancelScheduledEmail(emailId: string): Promise<boolean> {
    const email = this.scheduledEmails.get(emailId);
    if (!email || email.status !== 'scheduled') return false;

    email.status = 'cancelled';
    
    // Clear timer
    const timer = this.timers.get(emailId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(emailId);
    }

    this.emit('email-cancelled', email);
    log.info(`Cancelled scheduled email: ${email.subject}`);
    return true;
  }

  getScheduledEmails(): ScheduledEmail[] {
    return Array.from(this.scheduledEmails.values());
  }

  getScheduledEmail(id: string): ScheduledEmail | undefined {
    return this.scheduledEmails.get(id);
  }

  async initialize(): Promise<void> {
    // Initialize the scheduler
    await this.loadScheduledEmails();
    log.info('Email scheduler initialized');
  }

  async getSnoozedEmails(): Promise<ScheduledEmail[]> {
    // Return emails that are snoozed (scheduled for later)
    return Array.from(this.scheduledEmails.values()).filter(email => 
      email.status === 'scheduled' && email.scheduledFor > new Date()
    );
  }

  async snoozeEmail(
    messageId: string, 
    accountId: string, 
    snoozeUntil: Date, 
    reason?: string
  ): Promise<ScheduledEmail | null> {
    // This would integrate with the email engine to snooze an existing email
    // For now, create a scheduled reminder
    try {
      const snoozeRecord: Omit<ScheduledEmail, 'id' | 'status' | 'createdAt'> = {
        accountId,
        to: [], // Would get from original email
        subject: `Snoozed: ${reason || 'Email reminder'}`,
        body: `Reminder for message: ${messageId}`,
        scheduledFor: snoozeUntil,
      };

      return await this.scheduleEmail(snoozeRecord);
    } catch (error) {
      log.error('Failed to snooze email:', error);
      return null;
    }
  }

  async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.removeAllListeners();
    log.info('Email scheduler shut down');
  }
}