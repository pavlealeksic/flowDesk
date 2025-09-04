/**
 * Flow Desk Preload Script - Final Implementation
 *
 * Exposes secure APIs for IMAP mail, CalDAV calendar, and workspace management
 */
import type { Workspace, WorkspaceService, MailAccount, MailFolder, EmailMessage, CalendarAccount, CalendarEvent, CreateWorkspaceData, CreatePartitionData, CreateWindowData, GetMessagesOptions } from '../types/preload';
interface FlowDeskAPI {
    app: {
        getVersion(): Promise<string>;
        getPlatform(): Promise<string>;
    };
    view: {
        switch(view: 'mail' | 'calendar' | 'workspace'): Promise<void>;
        onViewChanged(callback: (view: string) => void): void;
    };
    workspace: {
        getAll(): Promise<Workspace[]>;
        list(): Promise<Workspace[]>;
        getById(workspaceId: string): Promise<Workspace | null>;
        getCurrent(): Promise<Workspace | null>;
        create(workspaceData: CreateWorkspaceData): Promise<string>;
        update(workspaceId: string, updates: Partial<Workspace>): Promise<void>;
        delete(workspaceId: string): Promise<void>;
        switch(workspaceId: string): Promise<void>;
        listPartitions(): Promise<unknown[]>;
        createPartition(partitionData: CreatePartitionData): Promise<unknown>;
        updatePartition(partitionId: string, updates: Partial<CreatePartitionData>): Promise<unknown>;
        getWindows(workspaceId: string): Promise<unknown[]>;
        createWindow(windowData: CreateWindowData): Promise<unknown>;
        clearData(workspaceId: string): Promise<unknown>;
        addService(workspaceId: string, serviceName: string, serviceType: string, url: string): Promise<string>;
        updateService(workspaceId: string, serviceId: string, updates: {
            name?: string;
            url?: string;
            isEnabled?: boolean;
        }): Promise<void>;
        removeService(workspaceId: string, serviceId: string): Promise<void>;
        loadService(workspaceId: string, serviceId: string): Promise<void>;
        getPredefinedServices(): Promise<Record<string, {
            name: string;
            url: string;
            type: string;
        }>>;
    };
    mail: {
        getAccounts(): Promise<MailAccount[]>;
        addAccount(account: Partial<MailAccount>): Promise<MailAccount>;
        updateAccount(accountId: string, updates: Partial<MailAccount>): Promise<MailAccount | null>;
        removeAccount(accountId: string): Promise<boolean>;
        getFolders(accountId: string): Promise<MailFolder[]>;
        getMessages(accountId: string, folderId?: string, options?: GetMessagesOptions): Promise<EmailMessage[]>;
        sendMessage(accountId: string, message: Partial<EmailMessage>): Promise<boolean>;
        markMessageRead(accountId: string, messageId: string, read: boolean): Promise<boolean>;
        markMessageStarred(accountId: string, messageId: string, starred: boolean): Promise<boolean>;
        deleteMessage(accountId: string, messageId: string): Promise<boolean>;
        getUnifiedMessages(limit?: number): Promise<EmailMessage[]>;
        getSmartMailboxMessages(criteria: string): Promise<EmailMessage[]>;
        getMessageThread(accountId: string, threadId: string): Promise<EmailMessage[]>;
        scheduleMessage(accountId: string, message: any, scheduledDate: Date): Promise<string>;
        getScheduledMessages(accountId: string): Promise<any[]>;
        cancelScheduledMessage(accountId: string, messageId: string): Promise<boolean>;
        getEmailAliases(accountId: string): Promise<any[]>;
        addEmailAlias(accountId: string, address: string, name: string): Promise<any>;
        removeEmailAlias(accountId: string, aliasAddress: string): Promise<boolean>;
        searchMessages(query: string, options?: {
            accountId?: string;
            folderId?: string;
        }): Promise<EmailMessage[]>;
        syncAccount(accountId: string): Promise<boolean>;
        syncAll(): Promise<void>;
        getSyncStatus(): Promise<Record<string, any>>;
        startSync(): Promise<boolean>;
        stopSync(): Promise<boolean>;
        startOAuthFlow(providerId: string): Promise<{
            success: boolean;
            email?: string;
            config?: any;
            error?: string;
            setupInstructions?: string[];
        }>;
        authenticateProvider(providerId: string): Promise<{
            success: boolean;
            accountId?: string;
            email?: string;
            error?: string;
        }>;
        getProviderStatus(providerId?: string): Promise<any>;
        getConfiguredProviders(): Promise<Array<{
            providerId: string;
            name: string;
            configured: boolean;
        }>>;
        refreshToken(accountId: string, providerId: string): Promise<{
            success: boolean;
            error?: string;
        }>;
        revokeToken(accountId: string, providerId: string): Promise<{
            success: boolean;
            error?: string;
        }>;
        getTokenStatus(accountId?: string, providerId?: string): Promise<any>;
        startIdle(accountId: string): Promise<boolean>;
        stopIdle(accountId: string): Promise<boolean>;
        downloadAttachment(attachment: {
            filename: string;
            data: string;
            mimeType: string;
        }): Promise<{
            success: boolean;
            path?: string;
            error?: string;
        }>;
        getAllTemplates(): Promise<any[]>;
        getTemplatesByCategory(category: string): Promise<any[]>;
        getTemplate(templateId: string): Promise<any>;
        saveTemplate(template: any): Promise<string>;
        updateTemplate(templateId: string, updates: any): Promise<boolean>;
        deleteTemplate(templateId: string): Promise<boolean>;
        useTemplate(templateId: string): Promise<any>;
        searchTemplates(query: string): Promise<any[]>;
        processTemplateVariables(template: any, variables: any): Promise<{
            subject: string;
            body: string;
        }>;
        scheduleEmail(emailData: any, scheduledTime: Date): Promise<string>;
        cancelScheduledEmail(emailId: string): Promise<boolean>;
        getScheduledEmails(): Promise<any[]>;
        snoozeEmail(messageId: string, accountId: string, snoozeUntil: Date, reason: string): Promise<string>;
        getSnoozedEmails(): Promise<any[]>;
        getSchedulerStats(): Promise<any>;
        getAllRules(): Promise<any[]>;
        getRulesByAccount(accountId: string): Promise<any[]>;
        createRule(ruleData: any): Promise<string>;
        updateRule(ruleId: string, updates: any): Promise<boolean>;
        deleteRule(ruleId: string): Promise<boolean>;
        testRule(ruleId: string, testMessage: any): Promise<boolean>;
        getRuleStats(): Promise<any>;
        processMessage(message: any): Promise<any>;
        getAllSnippets(): Promise<any[]>;
        getSnippetsByCategory(category: string): Promise<any[]>;
        saveSnippet(snippet: any): Promise<string>;
        updateSnippet(snippetId: string, updates: any): Promise<boolean>;
        deleteSnippet(snippetId: string): Promise<boolean>;
        useSnippet(snippetId: string): Promise<any>;
        searchSnippets(query: string): Promise<any[]>;
        getSnippetByShortcut(shortcut: string): Promise<any>;
        onSyncStarted(callback: (data: {
            accountId: string;
        }) => void): () => void;
        onSyncCompleted(callback: (data: {
            accountId: string;
            syncResult: any;
        }) => void): () => void;
        onSyncError(callback: (data: {
            accountId: string;
            error: string;
        }) => void): () => void;
        onNewMessages(callback: (data: {
            accountId: string;
            count: number;
        }) => void): () => void;
    };
    calendar: {
        getUserAccounts(userId: string): Promise<{
            success: boolean;
            data?: CalendarAccount[];
            error?: string;
        }>;
        createAccount(accountData: any): Promise<{
            success: boolean;
            data?: CalendarAccount;
            error?: string;
        }>;
        updateAccount(accountId: string, updates: any): Promise<{
            success: boolean;
            data?: CalendarAccount;
            error?: string;
        }>;
        deleteAccount(accountId: string): Promise<{
            success: boolean;
            error?: string;
        }>;
        getAccounts(): Promise<CalendarAccount[]>;
        addAccount(email: string, password: string, serverConfig?: any): Promise<CalendarAccount>;
        removeAccount(accountId: string): Promise<void>;
        listCalendars(accountId: string): Promise<{
            success: boolean;
            data?: Calendar[];
            error?: string;
        }>;
        getCalendars(accountId: string): Promise<Calendar[]>;
        getEventsInRange(calendarIds: string[], timeMin: string, timeMax: string): Promise<{
            success: boolean;
            data?: CalendarEvent[];
            error?: string;
        }>;
        createEvent(eventData: any): Promise<{
            success: boolean;
            data?: CalendarEvent;
            error?: string;
        }>;
        updateEvent(calendarId: string, eventId: string, updates: any): Promise<{
            success: boolean;
            data?: CalendarEvent;
            error?: string;
        }>;
        deleteEvent(calendarId: string, eventId: string): Promise<{
            success: boolean;
            error?: string;
        }>;
        searchEvents(query: string, limit?: number): Promise<{
            success: boolean;
            data?: CalendarEvent[];
            error?: string;
        }>;
        getEvents(accountId: string, startDate: string, endDate: string): Promise<CalendarEvent[]>;
        syncAccount(accountId: string, force?: boolean): Promise<{
            success: boolean;
            data?: any;
            error?: string;
        }>;
        syncAll(): Promise<void>;
        onAccountCreated(callback: (account: CalendarAccount) => void): () => void;
        onAccountUpdated(callback: (account: CalendarAccount) => void): () => void;
        onAccountDeleted(callback: (data: {
            accountId: string;
        }) => void): () => void;
        onEventCreated(callback: (event: CalendarEvent) => void): () => void;
        onEventUpdated(callback: (event: CalendarEvent) => void): () => void;
        onEventDeleted(callback: (data: {
            calendarId: string;
            eventId: string;
        }) => void): () => void;
        onSyncStatusUpdated(callback: (data: {
            accountId: string;
            status: any;
        }) => void): () => void;
        removeAllListeners(): void;
    };
    system: {
        getInfo(): Promise<{
            platform: string;
            version: string;
            arch: string;
        }>;
    };
    settings: {
        get(): Promise<any>;
        set(key: string, value: any): Promise<boolean>;
        update(settings: any): Promise<void>;
    };
    searchAPI: {
        search(options: {
            query: string;
            limit: number;
            offset: number;
        }): Promise<{
            success: boolean;
            data?: any;
            error?: string;
        }>;
        getSuggestions(partialQuery: string, limit: number): Promise<{
            success: boolean;
            data?: any;
            error?: string;
        }>;
        indexDocument(document: any): Promise<{
            success: boolean;
            error?: string;
        }>;
        initialize(): Promise<{
            success: boolean;
            error?: string;
        }>;
        getAnalytics(): Promise<{
            success: boolean;
            data?: any;
            error?: string;
        }>;
    };
    theme: {
        get(): Promise<any>;
        set(theme: any): Promise<any>;
    };
    window: {
        minimize(): Promise<void>;
        maximize(): Promise<void>;
        close(): Promise<void>;
    };
    on(channel: string, callback: (...args: unknown[]) => void): void;
    off(channel: string, callback: (...args: unknown[]) => void): void;
}
interface Calendar {
    id: string;
    accountId: string;
    name: string;
    color: string;
    isPrimary: boolean;
    isWritable: boolean;
}
export type { FlowDeskAPI, Workspace, WorkspaceService, MailAccount, MailFolder, EmailMessage, CalendarAccount, CalendarEvent };
//# sourceMappingURL=preload.d.ts.map