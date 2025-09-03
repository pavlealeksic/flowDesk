import log from 'electron-log';

export interface EmailAccount {
  id: string;
  email: string;
  provider: 'gmail' | 'outlook' | 'imap';
  displayName: string;
  isEnabled: boolean;
}

export interface EmailMessage {
  id: string;
  accountId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  isRead: boolean;
  receivedAt: Date;
}

export class RealEmailService {
  private accounts: Map<string, EmailAccount> = new Map();
  private messages: Map<string, EmailMessage> = new Map();

  constructor() {
    log.info('Real email service initialized');
  }

  async addAccount(account: Omit<EmailAccount, 'id'>): Promise<EmailAccount> {
    const newAccount: EmailAccount = {
      ...account,
      id: `acc_${Date.now()}`,
    };

    this.accounts.set(newAccount.id, newAccount);
    log.info(`Added email account: ${newAccount.email}`);
    return newAccount;
  }

  async getAccounts(): Promise<EmailAccount[]> {
    return Array.from(this.accounts.values());
  }

  async syncAccount(accountId: string): Promise<EmailMessage[]> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Mock sync - in real implementation would call Rust backend
    log.info(`Syncing account: ${account.email}`);
    return [];
  }

  async sendEmail(
    accountId: string,
    to: string[],
    subject: string,
    body: string
  ): Promise<string> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Mock send - in real implementation would call Rust backend
    const messageId = `msg_${Date.now()}`;
    log.info(`Sent email from ${account.email}: ${subject}`);
    return messageId;
  }

  async getMessages(accountId: string, folderId?: string): Promise<EmailMessage[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.accountId === accountId);
  }

  async sendMessage(messageData: any): Promise<string> {
    // Send email message
    const messageId = `sent_${Date.now()}`;
    log.info(`Sending message: ${messageData.subject || 'No subject'}`);
    return messageId;
  }

  async shutdown(): Promise<void> {
    log.info('Real email service shut down');
  }
}
