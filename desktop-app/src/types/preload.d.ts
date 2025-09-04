/**
 * Type definitions for the renderer process preload API
 * These types are exported from the preload script and used in renderer components
 */
export interface Workspace {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
    icon?: string;
    browserIsolation?: 'shared' | 'isolated';
    services: WorkspaceService[];
    members?: string[];
    created: Date;
    lastAccessed: Date;
    isActive: boolean;
}
export interface WorkspaceService {
    id: string;
    name: string;
    type: string;
    url: string;
    iconUrl?: string;
    isEnabled: boolean;
    config: Record<string, unknown>;
}
export interface MailAccount {
    id: string;
    email: string;
    displayName: string;
    provider: string;
    isEnabled: boolean;
    config?: Record<string, unknown>;
}
export interface MailFolder {
    id: string;
    name: string;
    unreadCount: number;
    type: 'inbox' | 'sent' | 'drafts' | 'trash' | 'custom';
}
export interface EmailMessage {
    id: string;
    subject: string;
    from: {
        name: string;
        address: string;
    };
    to: {
        name: string;
        address: string;
    }[];
    cc?: {
        name: string;
        address: string;
    }[];
    bcc?: {
        name: string;
        address: string;
    }[];
    date: Date;
    bodyText: string;
    bodyHtml: string;
    snippet?: string;
    flags: {
        isRead: boolean;
        isStarred: boolean;
        hasAttachments: boolean;
    };
    attachments?: EmailAttachment[];
    accountId: string;
    folderId: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string[];
}
export interface EmailAttachment {
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    isInline: boolean;
    contentId?: string;
    data?: string;
}
export interface CalendarAccount {
    id: string;
    email: string;
    displayName: string;
    provider: string;
    serverConfig?: CalendarServerConfig;
    isEnabled: boolean;
}
export interface CalendarServerConfig {
    serverUrl?: string;
    port?: number;
    ssl?: boolean;
    authType?: 'basic' | 'oauth2';
}
export interface Calendar {
    id: string;
    accountId: string;
    name: string;
    color: string;
    isPrimary: boolean;
    isWritable: boolean;
    description?: string;
    timezone?: string;
}
export interface CalendarEvent {
    id: string;
    calendarId: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    attendees: string[];
    organizer?: string;
    isAllDay: boolean;
    recurrence?: string;
    status?: 'confirmed' | 'tentative' | 'cancelled';
    visibility?: 'private' | 'public' | 'confidential';
    reminders?: CalendarReminder[];
    createdAt?: Date;
    updatedAt?: Date;
}
export interface CalendarReminder {
    method: 'email' | 'popup' | 'sms';
    minutesBefore: number;
}
export interface CreateWorkspaceData {
    name: string;
    icon?: string;
    color?: string;
    browserIsolation?: 'shared' | 'isolated';
    description?: string;
}
export interface CreatePartitionData {
    name: string;
    type?: string;
    description?: string;
}
export interface CreateWindowData {
    title: string;
    url?: string;
    width?: number;
    height?: number;
}
export interface GetMessagesOptions {
    limit?: number;
    offset?: number;
    since?: Date;
    before?: Date;
    unreadOnly?: boolean;
    sortBy?: 'date' | 'subject' | 'from';
    sortOrder?: 'asc' | 'desc';
}
export interface SendMessageOptions {
    cc?: string[];
    bcc?: string[];
    attachments?: EmailAttachment[];
    priority?: 'high' | 'normal' | 'low';
    deliveryReceipt?: boolean;
    readReceipt?: boolean;
}
export interface SearchMessagesOptions {
    accountIds?: string[];
    folders?: string[];
    limit?: number;
    offset?: number;
    dateFrom?: Date;
    dateTo?: Date;
}
export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    category: string;
    variables?: string[];
    isDefault?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface EmailRule {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
    enabled: boolean;
    conditions: EmailRuleCondition[];
    actions: EmailRuleAction[];
    priority: number;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface EmailRuleCondition {
    field: 'from' | 'to' | 'subject' | 'body' | 'has_attachment';
    operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';
    value: string;
    caseSensitive?: boolean;
}
export interface EmailRuleAction {
    type: 'move_to_folder' | 'add_label' | 'forward' | 'delete' | 'mark_as_read' | 'mark_as_important';
    value?: string;
}
export interface TextSnippet {
    id: string;
    name: string;
    content: string;
    category: string;
    shortcut?: string;
    variables?: string[];
    isGlobal?: boolean;
    tags: string[];
    createdAt?: Date;
    updatedAt?: Date;
}
export interface SearchOptions {
    query: string;
    limit: number;
    offset: number;
    sources?: string[];
    filters?: Record<string, unknown>;
}
export interface SearchResult {
    id: string;
    title: string;
    content: string;
    source: string;
    score?: number;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface AppSettings {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    autoSync: boolean;
    language: string;
    timezone: string;
    defaultEmailSignature?: string;
    compactMode?: boolean;
    showUnreadCounts?: boolean;
    enableShortcuts?: boolean;
}
export interface ThemeSettings {
    theme: 'light' | 'dark' | 'auto';
    accentColor: string;
    fontSize?: 'small' | 'medium' | 'large';
    compactMode?: boolean;
}
export interface SystemInfo {
    platform: string;
    version: string;
    arch: string;
    deviceId: string;
    isDarkMode: boolean;
    isHighContrast: boolean;
}
export interface APIResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface SyncStatus {
    issyncing: boolean;
    lastSync: Date;
    error?: string;
}
export interface FlowDeskAPI {
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
        updateService(workspaceId: string, serviceId: string, updates: Partial<WorkspaceService>): Promise<void>;
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
        searchMessages(query: string, options?: SearchMessagesOptions): Promise<EmailMessage[]>;
        syncAccount(accountId: string): Promise<boolean>;
        syncAll(): Promise<void>;
        getSyncStatus(): Promise<Record<string, SyncStatus>>;
        startSync(): Promise<boolean>;
        stopSync(): Promise<boolean>;
        downloadAttachment(attachment: {
            filename: string;
            data: string;
            mimeType: string;
        }): Promise<APIResponse<{
            path: string;
        }>>;
        onSyncStarted(callback: (data: {
            accountId: string;
        }) => void): () => void;
        onSyncCompleted(callback: (data: {
            accountId: string;
            syncResult: unknown;
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
        getUserAccounts(userId: string): Promise<APIResponse<CalendarAccount[]>>;
        createAccount(accountData: Partial<CalendarAccount>): Promise<APIResponse<CalendarAccount>>;
        updateAccount(accountId: string, updates: Partial<CalendarAccount>): Promise<APIResponse<CalendarAccount>>;
        deleteAccount(accountId: string): Promise<APIResponse<void>>;
        getAccounts(): Promise<CalendarAccount[]>;
        addAccount(email: string, password: string, serverConfig?: CalendarServerConfig): Promise<CalendarAccount>;
        removeAccount(accountId: string): Promise<void>;
        listCalendars(accountId: string): Promise<APIResponse<Calendar[]>>;
        getCalendars(accountId: string): Promise<Calendar[]>;
        getEventsInRange(calendarIds: string[], timeMin: string, timeMax: string): Promise<APIResponse<CalendarEvent[]>>;
        getEvents(accountId: string, startDate: string, endDate: string): Promise<CalendarEvent[]>;
        createEvent(eventData: Partial<CalendarEvent>): Promise<APIResponse<CalendarEvent>>;
        updateEvent(calendarId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<APIResponse<CalendarEvent>>;
        deleteEvent(calendarId: string, eventId: string): Promise<APIResponse<void>>;
        searchEvents(query: string, limit?: number): Promise<APIResponse<CalendarEvent[]>>;
        syncAccount(accountId: string, force?: boolean): Promise<APIResponse<unknown>>;
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
            status: unknown;
        }) => void): () => void;
        removeAllListeners(): void;
    };
    system: {
        getInfo(): Promise<SystemInfo>;
    };
    settings: {
        get(): Promise<AppSettings>;
        set(key: string, value: unknown): Promise<boolean>;
        update(settings: Partial<AppSettings>): Promise<void>;
    };
    searchAPI: {
        search(options: SearchOptions): Promise<APIResponse<{
            results: SearchResult[];
            total: number;
        }>>;
        getSuggestions(partialQuery: string, limit: number): Promise<APIResponse<string[]>>;
        indexDocument(document: Partial<SearchResult>): Promise<APIResponse<void>>;
        initialize(): Promise<APIResponse<void>>;
        getAnalytics(): Promise<APIResponse<Record<string, unknown>>>;
    };
    theme: {
        get(): Promise<ThemeSettings>;
        set(theme: ThemeSettings): Promise<unknown>;
    };
    window: {
        minimize(): Promise<void>;
        maximize(): Promise<void>;
        close(): Promise<void>;
    };
    on(channel: string, callback: (...args: unknown[]) => void): void;
    off(channel: string, callback: (...args: unknown[]) => void): void;
}
//# sourceMappingURL=preload.d.ts.map