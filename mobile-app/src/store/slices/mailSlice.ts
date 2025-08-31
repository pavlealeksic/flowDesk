/**
 * Mail Store Slice - Manages email accounts, messages, and operations
 */

import { StateCreator } from 'zustand';
import type { EmailAccount, EmailMessage } from '@flow-desk/shared';

export type MailProvider = 'gmail' | 'outlook' | 'imap' | 'exchange';

export interface MailAccount extends EmailAccount {
  provider: MailProvider;
  displayName: string;
  email: string;
  isEnabled: boolean;
  lastSyncTime?: Date;
  syncError?: string;
  unreadCount: number;
  folders: MailFolder[];
  settings: {
    syncInterval: number; // minutes
    downloadAttachments: boolean;
    pushNotifications: boolean;
    signature?: string;
    replyTo?: string;
  };
}

export interface MailFolder {
  id: string;
  name: string;
  displayName: string;
  type: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'custom';
  unreadCount: number;
  totalCount: number;
  isSelectable: boolean;
  parentId?: string;
}

export interface MailMessage extends EmailMessage {
  accountId: string;
  folderId: string;
  threadId?: string;
  isUnread: boolean;
  isStarred: boolean;
  isFlagged: boolean;
  labels: string[];
  attachments: MailAttachment[];
  snippet: string;
  importance: 'low' | 'normal' | 'high';
  sensitivity: 'normal' | 'personal' | 'private' | 'confidential';
}

export interface MailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentId?: string;
  downloadUrl?: string;
  isDownloaded: boolean;
}

export interface MailThread {
  id: string;
  subject: string;
  participants: string[];
  messageCount: number;
  unreadCount: number;
  lastMessageAt: Date;
  isStarred: boolean;
  labels: string[];
  messages: MailMessage[];
}

export interface MailComposer {
  id: string;
  accountId: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  attachments: File[];
  isDraft: boolean;
  replyToMessageId?: string;
  forwardMessageId?: string;
  scheduledTime?: Date;
}

export interface MailSlice {
  // State
  accounts: MailAccount[];
  messages: MailMessage[];
  threads: MailThread[];
  composers: MailComposer[];
  activeAccountId: string | null;
  selectedFolderId: string | null;
  selectedMessageId: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  
  // Account management
  addAccount: (account: Omit<MailAccount, 'id' | 'unreadCount' | 'folders'>) => Promise<string>;
  updateAccount: (id: string, updates: Partial<MailAccount>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  setActiveAccount: (id: string) => void;
  syncAccount: (id: string) => Promise<void>;
  syncAllAccounts: () => Promise<void>;
  
  // Message management
  loadMessages: (accountId: string, folderId: string, limit?: number, offset?: number) => Promise<void>;
  getMessage: (messageId: string) => MailMessage | null;
  markAsRead: (messageId: string) => Promise<void>;
  markAsUnread: (messageId: string) => Promise<void>;
  starMessage: (messageId: string) => Promise<void>;
  unstarMessage: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  moveMessage: (messageId: string, folderId: string) => Promise<void>;
  archiveMessage: (messageId: string) => Promise<void>;
  
  // Thread management
  loadThread: (threadId: string) => Promise<void>;
  markThreadAsRead: (threadId: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  archiveThread: (threadId: string) => Promise<void>;
  
  // Composer management
  createComposer: (accountId: string, type?: 'new' | 'reply' | 'forward', messageId?: string) => string;
  updateComposer: (id: string, updates: Partial<MailComposer>) => void;
  saveDraft: (id: string) => Promise<void>;
  sendMessage: (id: string, options?: { delayDelivery?: Date }) => Promise<void>;
  discardComposer: (id: string) => void;
  
  // Search and filtering
  searchMessages: (query: string, accountId?: string, folderId?: string) => Promise<MailMessage[]>;
  getUnreadCount: (accountId?: string) => number;
  
  // UI state
  setSelectedFolder: (folderId: string) => void;
  setSelectedMessage: (messageId: string) => void;
  clearSelection: () => void;
}

export const createMailStore: StateCreator<
  any,
  [],
  [],
  MailSlice
> = (set, get) => ({
  // Initial state
  accounts: [],
  messages: [],
  threads: [],
  composers: [],
  activeAccountId: null,
  selectedFolderId: null,
  selectedMessageId: null,
  isLoading: false,
  isSyncing: false,
  error: null,
  
  // Account management
  addAccount: async (accountData) => {
    try {
      // Use the mail service to add the account
      const { mailService } = await import('../../services/mailService');
      const account = await mailService.addAccount(accountData);
      
      // Add to local state
      set((state: any) => {
        state.accounts.push(account);
        if (!state.activeAccountId) {
          state.activeAccountId = account.id;
        }
      });
      
      // Trigger initial sync
      await get().syncAccount(account.id);
      
      return account.id;
    } catch (error) {
      console.error('Failed to add account:', error);
      throw error;
    }
  },
  
  updateAccount: async (id, updates) => {
    set((state: any) => {
      const index = state.accounts.findIndex((a: MailAccount) => a.id === id);
      if (index >= 0) {
        state.accounts[index] = { ...state.accounts[index], ...updates };
      }
    });
  },
  
  removeAccount: async (id) => {
    set((state: any) => {
      state.accounts = state.accounts.filter((a: MailAccount) => a.id !== id);
      state.messages = state.messages.filter((m: MailMessage) => m.accountId !== id);
      state.threads = state.threads.filter((t: MailThread) => 
        !t.messages.some(m => m.accountId === id)
      );
      
      if (state.activeAccountId === id) {
        state.activeAccountId = state.accounts[0]?.id || null;
      }
    });
  },
  
  setActiveAccount: (id) => {
    set((state: any) => {
      state.activeAccountId = id;
      state.selectedFolderId = 'inbox'; // Default to inbox
      state.selectedMessageId = null;
    });
  },
  
  syncAccount: async (id) => {
    const account = get().accounts.find(a => a.id === id);
    if (!account) return;
    
    set((state: any) => {
      state.isSyncing = true;
      state.error = null;
    });
    
    try {
      // Mock sync - in production, this would connect to the actual mail service
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate some mock messages for demonstration
      const mockMessages: MailMessage[] = [
        {
          id: `msg_${Date.now()}_1`,
          accountId: id,
          folderId: 'inbox',
          subject: 'Welcome to Flow Desk',
          body: 'Thank you for using Flow Desk! This is a sample email.',
          fromAddress: 'welcome@flowdesk.app',
          toAddresses: [account.email],
          ccAddresses: [],
          bccAddresses: [],
          receivedAt: new Date(),
          isRead: false,
          isUnread: true,
          isStarred: false,
          isFlagged: false,
          labels: [],
          attachments: [],
          snippet: 'Thank you for using Flow Desk! This is a sample...',
          importance: 'normal',
          sensitivity: 'normal',
        },
      ];
      
      set((state: any) => {
        // Remove old messages for this account
        state.messages = state.messages.filter((m: MailMessage) => m.accountId !== id);
        // Add new messages
        state.messages.push(...mockMessages);
        
        // Update account sync time
        const accountIndex = state.accounts.findIndex((a: MailAccount) => a.id === id);
        if (accountIndex >= 0) {
          state.accounts[accountIndex].lastSyncTime = new Date();
          state.accounts[accountIndex].unreadCount = mockMessages.filter(m => m.isUnread).length;
        }
        
        state.isSyncing = false;
      });
    } catch (error) {
      console.error('Sync error:', error);
      set((state: any) => {
        state.isSyncing = false;
        state.error = error instanceof Error ? error.message : 'Sync failed';
        
        // Update account with sync error
        const accountIndex = state.accounts.findIndex((a: MailAccount) => a.id === id);
        if (accountIndex >= 0) {
          state.accounts[accountIndex].syncError = error instanceof Error ? error.message : 'Sync failed';
        }
      });
    }
  },
  
  syncAllAccounts: async () => {
    const accounts = get().accounts.filter(a => a.isEnabled);
    await Promise.all(accounts.map(account => get().syncAccount(account.id)));
  },
  
  // Message management
  loadMessages: async (accountId, folderId, limit = 50, offset = 0) => {
    set((state: any) => {
      state.isLoading = true;
      state.error = null;
    });
    
    try {
      // Mock implementation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      set((state: any) => {
        state.isLoading = false;
      });
    } catch (error) {
      set((state: any) => {
        state.isLoading = false;
        state.error = error instanceof Error ? error.message : 'Failed to load messages';
      });
    }
  },
  
  getMessage: (messageId) => {
    return get().messages.find(m => m.id === messageId) || null;
  },
  
  markAsRead: async (messageId) => {
    set((state: any) => {
      const message = state.messages.find((m: MailMessage) => m.id === messageId);
      if (message && message.isUnread) {
        message.isUnread = false;
        message.isRead = true;
        
        // Update account unread count
        const account = state.accounts.find((a: MailAccount) => a.id === message.accountId);
        if (account) {
          account.unreadCount = Math.max(0, account.unreadCount - 1);
        }
      }
    });
  },
  
  markAsUnread: async (messageId) => {
    set((state: any) => {
      const message = state.messages.find((m: MailMessage) => m.id === messageId);
      if (message && !message.isUnread) {
        message.isUnread = true;
        message.isRead = false;
        
        // Update account unread count
        const account = state.accounts.find((a: MailAccount) => a.id === message.accountId);
        if (account) {
          account.unreadCount += 1;
        }
      }
    });
  },
  
  starMessage: async (messageId) => {
    set((state: any) => {
      const message = state.messages.find((m: MailMessage) => m.id === messageId);
      if (message) {
        message.isStarred = true;
      }
    });
  },
  
  unstarMessage: async (messageId) => {
    set((state: any) => {
      const message = state.messages.find((m: MailMessage) => m.id === messageId);
      if (message) {
        message.isStarred = false;
      }
    });
  },
  
  deleteMessage: async (messageId) => {
    set((state: any) => {
      const messageIndex = state.messages.findIndex((m: MailMessage) => m.id === messageId);
      if (messageIndex >= 0) {
        const message = state.messages[messageIndex];
        
        // Update unread count if message was unread
        if (message.isUnread) {
          const account = state.accounts.find((a: MailAccount) => a.id === message.accountId);
          if (account) {
            account.unreadCount = Math.max(0, account.unreadCount - 1);
          }
        }
        
        state.messages.splice(messageIndex, 1);
        
        // Clear selection if this message was selected
        if (state.selectedMessageId === messageId) {
          state.selectedMessageId = null;
        }
      }
    });
  },
  
  moveMessage: async (messageId, folderId) => {
    set((state: any) => {
      const message = state.messages.find((m: MailMessage) => m.id === messageId);
      if (message) {
        message.folderId = folderId;
      }
    });
  },
  
  archiveMessage: async (messageId) => {
    // Move to archive folder or remove from inbox
    await get().moveMessage(messageId, 'archive');
  },
  
  // Thread management
  loadThread: async (threadId) => {
    // Mock implementation
  },
  
  markThreadAsRead: async (threadId) => {
    const thread = get().threads.find(t => t.id === threadId);
    if (thread) {
      await Promise.all(
        thread.messages.map(message => get().markAsRead(message.id))
      );
    }
  },
  
  deleteThread: async (threadId) => {
    const thread = get().threads.find(t => t.id === threadId);
    if (thread) {
      await Promise.all(
        thread.messages.map(message => get().deleteMessage(message.id))
      );
    }
  },
  
  archiveThread: async (threadId) => {
    const thread = get().threads.find(t => t.id === threadId);
    if (thread) {
      await Promise.all(
        thread.messages.map(message => get().archiveMessage(message.id))
      );
    }
  },
  
  // Composer management
  createComposer: (accountId, type = 'new', messageId) => {
    const id = `composer_${Date.now()}`;
    const composer: MailComposer = {
      id,
      accountId,
      to: [],
      cc: [],
      bcc: [],
      subject: '',
      body: '',
      attachments: [],
      isDraft: true,
      replyToMessageId: type === 'reply' ? messageId : undefined,
      forwardMessageId: type === 'forward' ? messageId : undefined,
    };
    
    // Pre-fill for reply/forward
    if (messageId && (type === 'reply' || type === 'forward')) {
      const message = get().getMessage(messageId);
      if (message) {
        if (type === 'reply') {
          composer.to = [message.fromAddress];
          composer.subject = `Re: ${message.subject}`;
        } else if (type === 'forward') {
          composer.subject = `Fwd: ${message.subject}`;
        }
      }
    }
    
    set((state: any) => {
      state.composers.push(composer);
    });
    
    return id;
  },
  
  updateComposer: (id, updates) => {
    set((state: any) => {
      const index = state.composers.findIndex((c: MailComposer) => c.id === id);
      if (index >= 0) {
        state.composers[index] = { ...state.composers[index], ...updates };
      }
    });
  },
  
  saveDraft: async (id) => {
    const composer = get().composers.find(c => c.id === id);
    if (composer) {
      // Save as draft in mail service
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  },
  
  sendMessage: async (id, options) => {
    const composer = get().composers.find(c => c.id === id);
    if (!composer) return;
    
    try {
      // Send via mail service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Remove from composers after sending
      get().discardComposer(id);
    } catch (error) {
      console.error('Send error:', error);
      throw error;
    }
  },
  
  discardComposer: (id) => {
    set((state: any) => {
      state.composers = state.composers.filter((c: MailComposer) => c.id !== id);
    });
  },
  
  // Search and filtering
  searchMessages: async (query, accountId, folderId) => {
    let messages = get().messages;
    
    if (accountId) {
      messages = messages.filter(m => m.accountId === accountId);
    }
    
    if (folderId) {
      messages = messages.filter(m => m.folderId === folderId);
    }
    
    if (query) {
      const lowerQuery = query.toLowerCase();
      messages = messages.filter(m =>
        m.subject.toLowerCase().includes(lowerQuery) ||
        m.body.toLowerCase().includes(lowerQuery) ||
        m.fromAddress.toLowerCase().includes(lowerQuery)
      );
    }
    
    return messages;
  },
  
  getUnreadCount: (accountId) => {
    if (accountId) {
      const account = get().accounts.find(a => a.id === accountId);
      return account?.unreadCount || 0;
    }
    
    return get().accounts.reduce((total, account) => total + account.unreadCount, 0);
  },
  
  // UI state
  setSelectedFolder: (folderId) => {
    set((state: any) => {
      state.selectedFolderId = folderId;
      state.selectedMessageId = null;
    });
  },
  
  setSelectedMessage: (messageId) => {
    set((state: any) => {
      state.selectedMessageId = messageId;
    });
    
    // Auto-mark as read when selected
    get().markAsRead(messageId);
  },
  
  clearSelection: () => {
    set((state: any) => {
      state.selectedMessageId = null;
    });
  },
});