"use strict";
/**
 * Complete Workspace Manager with Real Rust Backend Integration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceManager = void 0;
const events_1 = require("events");
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
const rust_engine_integration_1 = require("../lib/rust-integration/rust-engine-integration");
const layout_1 = require("./constants/layout");
class WorkspaceManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.workspaces = new Map();
        this.initialized = false;
        this.browserViews = new Map();
        this.workspaceSessions = new Map();
        this.browserViewsHidden = false;
        this.initializeWorkspaces();
    }
    async initializeWorkspaces() {
        try {
            // Load workspaces from Rust backend
            const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('collaboration_list_workspaces', []);
            if (result.success && result.result) {
                const workspaces = result.result;
                for (const workspace of workspaces) {
                    this.workspaces.set(workspace.id, workspace);
                }
                electron_log_1.default.info(`Loaded ${workspaces.length} workspaces from backend`);
            }
            else {
                // Create default workspace if none exist
                await this.createDefaultWorkspace();
            }
            this.initialized = true;
            this.emit('workspaces-loaded', Array.from(this.workspaces.values()));
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize workspaces:', error);
            // Fallback to default workspace
            await this.createDefaultWorkspace();
            this.initialized = true;
        }
    }
    async createDefaultWorkspace() {
        const defaultWorkspace = await this.createWorkspace('Personal Workspace', '#4285f4', 'workspace-default', 'shared', 'Your personal email and calendar workspace');
        this.setCurrentWorkspace(defaultWorkspace.id);
    }
    generateAbbreviation(name) {
        const words = name.trim().split(/\s+/);
        if (words.length === 1) {
            // Single word - use first two letters
            return words[0].substring(0, 2).toUpperCase();
        }
        else {
            // Multiple words - use first letter of first two words
            return (words[0][0] + words[1][0]).toUpperCase();
        }
    }
    async createWorkspace(name, color, icon, browserIsolation, description) {
        const workspace = {
            id: `ws_${Date.now()}`,
            name,
            abbreviation: this.generateAbbreviation(name),
            description,
            color: color || '#4285f4',
            icon: icon || 'workspace-default',
            browserIsolation: browserIsolation || 'shared',
            members: [],
            settings: {
                theme: 'auto',
                notifications: true,
                autoSync: true,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: 'en',
            },
            services: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            // Additional fields for compatibility
            created: new Date(),
            lastAccessed: new Date(),
            isActive: false,
        };
        this.workspaces.set(workspace.id, workspace);
        // Persist to Rust backend
        try {
            const result = await rust_engine_integration_1.rustEngineIntegration.callRustFunction('collaboration_create_workspace', [
                workspace.name,
                workspace.description || ''
            ]);
            if (result.success && result.result && result.result.workspace_id) {
                workspace.id = result.result.workspace_id;
                this.workspaces.delete(`ws_${Date.now()}`);
                this.workspaces.set(workspace.id, workspace);
            }
        }
        catch (error) {
            electron_log_1.default.error('Failed to persist workspace to backend:', error);
        }
        this.emit('workspace-created', workspace);
        electron_log_1.default.info(`Created workspace: ${workspace.name} (${workspace.id})`);
        return workspace;
    }
    async addServiceToWorkspace(workspaceId, serviceName, serviceType, url) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace not found: ${workspaceId}`);
        }
        const service = {
            id: `service_${Date.now()}`,
            name: serviceName,
            type: serviceType,
            url,
            icon: this.getServiceIcon(serviceType),
            color: this.getServiceColor(serviceType),
            isEnabled: true,
            config: {
                integration: 'browser',
                permissions: [],
                webviewOptions: {}
            },
        };
        workspace.services.push(service);
        workspace.updatedAt = new Date();
        await this.saveWorkspace(workspace);
        this.emit('service-added', { workspace, service });
        electron_log_1.default.info(`Added service ${serviceName} to workspace ${workspace.name}`);
        return service.id;
    }
    getServiceIcon(serviceType) {
        const iconMap = {
            'communication': 'chat-icon',
            'productivity': 'document-icon',
            'development': 'code-icon',
            'email': 'email-icon',
            'calendar': 'calendar-icon',
            'notes': 'notes-icon',
            'crm': 'contact-icon',
            'project': 'project-icon',
        };
        return iconMap[serviceType] || 'service-default';
    }
    getServiceColor(serviceType) {
        const colorMap = {
            'communication': '#4A154B',
            'productivity': '#000000',
            'development': '#181717',
            'email': '#1a73e8',
            'calendar': '#137333',
            'notes': '#f9ab00',
            'crm': '#ff6900',
            'project': '#8e24aa',
        };
        return colorMap[serviceType] || '#666666';
    }
    async saveWorkspace(workspace) {
        try {
            await rust_engine_integration_1.rustEngineIntegration.callRustFunction('collaboration_update_workspace', [
                workspace.id,
                {
                    name: workspace.name,
                    description: workspace.description,
                    color: workspace.color,
                    icon: workspace.icon,
                    settings: workspace.settings,
                    services: workspace.services,
                    updatedAt: workspace.updatedAt,
                }
            ]);
        }
        catch (error) {
            electron_log_1.default.error(`Failed to save workspace ${workspace.id} to backend:`, error);
        }
    }
    getCurrentWorkspace() {
        // If no current workspace is set, auto-select the first one
        if (!this.currentWorkspace && this.workspaces.size > 0) {
            const firstWorkspace = this.workspaces.values().next().value;
            if (firstWorkspace) {
                this.currentWorkspace = firstWorkspace.id;
                electron_log_1.default.info(`Auto-selected first workspace as current: ${firstWorkspace.name} (${firstWorkspace.id})`);
            }
        }
        return this.currentWorkspace ? this.workspaces.get(this.currentWorkspace) : undefined;
    }
    setCurrentWorkspace(workspaceId) {
        if (this.workspaces.has(workspaceId)) {
            this.currentWorkspace = workspaceId;
            this.emit('workspace-changed', this.workspaces.get(workspaceId));
        }
    }
    getAllWorkspaces() {
        return Array.from(this.workspaces.values());
    }
    getWorkspace(id) {
        return this.workspaces.get(id);
    }
    // Methods expected by main.ts
    getWorkspaces() {
        return this.getAllWorkspaces();
    }
    getActiveWorkspace() {
        return this.getCurrentWorkspace();
    }
    async switchWorkspace(workspaceId) {
        this.setCurrentWorkspace(workspaceId);
    }
    async updateWorkspace(workspaceId, updates) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace not found: ${workspaceId}`);
        }
        Object.assign(workspace, updates);
        workspace.updatedAt = new Date();
        await this.saveWorkspace(workspace);
        this.emit('workspace-updated', workspace);
    }
    async deleteWorkspace(workspaceId) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace not found: ${workspaceId}`);
        }
        try {
            await rust_engine_integration_1.rustEngineIntegration.callRustFunction('collaboration_delete_workspace', [workspaceId]);
        }
        catch (error) {
            electron_log_1.default.error('Failed to delete workspace from backend:', error);
        }
        this.workspaces.delete(workspaceId);
        this.emit('workspace-deleted', workspace);
        electron_log_1.default.info(`Deleted workspace: ${workspace.name}`);
    }
    async removeServiceFromWorkspace(workspaceId, serviceId) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace not found: ${workspaceId}`);
        }
        const serviceIndex = workspace.services.findIndex(s => s.id === serviceId);
        if (serviceIndex >= 0) {
            workspace.services.splice(serviceIndex, 1);
            workspace.updatedAt = new Date();
            await this.saveWorkspace(workspace);
        }
    }
    async updateServiceInWorkspace(workspaceId, serviceId, updates) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace)
            return;
        const service = workspace.services.find(s => s.id === serviceId);
        if (service) {
            Object.assign(service, updates);
            workspace.updatedAt = new Date();
            await this.saveWorkspace(workspace);
        }
    }
    async loadService(workspaceId, serviceId, mainWindow) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace || !mainWindow) {
            electron_log_1.default.warn(`Cannot load service: workspace=${!!workspace}, mainWindow=${!!mainWindow}`);
            return;
        }
        // Only allow service loading if we're actually in workspace view
        // This prevents BrowserViews from appearing in mail/calendar views
        const currentView = mainWindow.currentView;
        if (currentView && currentView !== 'workspace') {
            electron_log_1.default.warn(`Attempted to load service while in ${currentView} view - blocked`);
            return;
        }
        const service = workspace.services.find(s => s.id === serviceId);
        if (!service) {
            electron_log_1.default.warn(`Service not found: ${serviceId} in workspace ${workspaceId}`);
            return;
        }
        try {
            // Get or create workspace session for isolation
            await this.ensureWorkspaceSession(workspace);
            // Get or create browser view for service
            let browserView = this.browserViews.get(`${workspaceId}:${serviceId}`);
            if (!browserView) {
                browserView = await this.createServiceBrowserView(workspace, service);
                this.browserViews.set(`${workspaceId}:${serviceId}`, browserView);
            }
            // Attach to main window and configure bounds
            mainWindow.setBrowserView(browserView);
            this.configureBrowserViewBounds(browserView, mainWindow);
            // Load service URL if not already loaded
            if (browserView.webContents.getURL() !== service.url) {
                await browserView.webContents.loadURL(service.url);
            }
            this.emit('service-loaded', { workspace, service, browserView });
            electron_log_1.default.info(`Loaded service ${service.name} in workspace ${workspace.name}`);
            return browserView;
        }
        catch (error) {
            electron_log_1.default.error(`Failed to load service ${service.name}:`, error);
            this.emit('service-load-error', { workspace, service, error });
        }
    }
    getPredefinedServices() {
        const services = this.getPredefinedServicesList();
        const result = {};
        services.forEach(service => {
            result[service.id] = {
                name: service.name,
                url: service.url,
                type: service.type
            };
        });
        return result;
    }
    getPredefinedServicesList() {
        return [
            // Task Management & Project Management
            { id: 'asana-template', name: 'Asana', type: 'browser-service', url: 'https://app.asana.com', icon: 'asana-icon', color: '#f06a6a', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:asana', allowExternalUrls: true } } },
            { id: 'trello-template', name: 'Trello', type: 'browser-service', url: 'https://trello.com', icon: 'trello-icon', color: '#0079BF', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:trello', allowExternalUrls: true } } },
            { id: 'monday-template', name: 'Monday.com', type: 'browser-service', url: 'https://monday.com', icon: 'monday-icon', color: '#ff3d57', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:monday', allowExternalUrls: true } } },
            { id: 'todoist-template', name: 'Todoist', type: 'browser-service', url: 'https://todoist.com/app', icon: 'todoist-icon', color: '#e44332', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:todoist', allowExternalUrls: true } } },
            { id: 'clickup-template', name: 'ClickUp', type: 'browser-service', url: 'https://app.clickup.com', icon: 'clickup-icon', color: '#7b68ee', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:clickup', allowExternalUrls: true } } },
            { id: 'linear-template', name: 'Linear', type: 'browser-service', url: 'https://linear.app', icon: 'linear-icon', color: '#5e6ad2', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:linear', allowExternalUrls: true } } },
            { id: 'basecamp-template', name: 'Basecamp', type: 'browser-service', url: 'https://basecamp.com', icon: 'basecamp-icon', color: '#1f5a41', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:basecamp', allowExternalUrls: true } } },
            { id: 'height-template', name: 'Height', type: 'browser-service', url: 'https://height.app', icon: 'height-icon', color: '#4c6ef5', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:height', allowExternalUrls: true } } },
            // Communication & Collaboration
            { id: 'slack-template', name: 'Slack', type: 'browser-service', url: 'https://app.slack.com', icon: 'slack-icon', color: '#4A154B', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:slack', allowExternalUrls: true } } },
            { id: 'discord-template', name: 'Discord', type: 'browser-service', url: 'https://discord.com/app', icon: 'discord-icon', color: '#5865F2', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:discord', allowExternalUrls: true } } },
            { id: 'teams-template', name: 'Microsoft Teams', type: 'browser-service', url: 'https://teams.microsoft.com', icon: 'teams-icon', color: '#6264A7', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:teams', allowExternalUrls: true } } },
            { id: 'zoom-template', name: 'Zoom', type: 'browser-service', url: 'https://zoom.us/wc', icon: 'zoom-icon', color: '#2D8CFF', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:zoom', allowExternalUrls: true } } },
            { id: 'meet-template', name: 'Google Meet', type: 'browser-service', url: 'https://meet.google.com', icon: 'meet-icon', color: '#00ac47', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:meet', allowExternalUrls: true } } },
            { id: 'telegram-template', name: 'Telegram Web', type: 'browser-service', url: 'https://web.telegram.org', icon: 'telegram-icon', color: '#0088cc', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:telegram', allowExternalUrls: true } } },
            { id: 'whatsapp-template', name: 'WhatsApp Web', type: 'browser-service', url: 'https://web.whatsapp.com', icon: 'whatsapp-icon', color: '#25d366', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:whatsapp', allowExternalUrls: true } } },
            // Development & Code Management
            { id: 'github-template', name: 'GitHub', type: 'browser-service', url: 'https://github.com', icon: 'github-icon', color: '#181717', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:github', allowExternalUrls: true } } },
            { id: 'gitlab-template', name: 'GitLab', type: 'browser-service', url: 'https://gitlab.com', icon: 'gitlab-icon', color: '#FC6D26', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:gitlab', allowExternalUrls: true } } },
            { id: 'bitbucket-template', name: 'Bitbucket', type: 'browser-service', url: 'https://bitbucket.org', icon: 'bitbucket-icon', color: '#0052CC', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:bitbucket', allowExternalUrls: true } } },
            { id: 'jira-template', name: 'Jira', type: 'browser-service', url: 'https://atlassian.net', icon: 'jira-icon', color: '#0052CC', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:jira', allowExternalUrls: true } } },
            { id: 'confluence-template', name: 'Confluence', type: 'browser-service', url: 'https://confluence.atlassian.com', icon: 'confluence-icon', color: '#172b4d', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:confluence', allowExternalUrls: true } } },
            { id: 'jenkins-template', name: 'Jenkins', type: 'browser-service', url: 'https://jenkins.io', icon: 'jenkins-icon', color: '#335061', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:jenkins', allowExternalUrls: true } } },
            // Productivity & Notes
            { id: 'notion-template', name: 'Notion', type: 'browser-service', url: 'https://notion.so', icon: 'notion-icon', color: '#000000', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:notion', allowExternalUrls: true } } },
            { id: 'obsidian-template', name: 'Obsidian', type: 'browser-service', url: 'https://obsidian.md', icon: 'obsidian-icon', color: '#7C3AED', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:obsidian', allowExternalUrls: true } } },
            { id: 'evernote-template', name: 'Evernote', type: 'browser-service', url: 'https://evernote.com/client/web', icon: 'evernote-icon', color: '#00A82D', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:evernote', allowExternalUrls: true } } },
            { id: 'onenote-template', name: 'OneNote', type: 'browser-service', url: 'https://onenote.com', icon: 'onenote-icon', color: '#7719AA', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:onenote', allowExternalUrls: true } } },
            { id: 'logseq-template', name: 'Logseq', type: 'browser-service', url: 'https://logseq.com', icon: 'logseq-icon', color: '#002b36', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:logseq', allowExternalUrls: true } } },
            // Google Workspace
            { id: 'gdrive-template', name: 'Google Drive', type: 'browser-service', url: 'https://drive.google.com', icon: 'gdrive-icon', color: '#1a73e8', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:gdrive', allowExternalUrls: true } } },
            { id: 'gdocs-template', name: 'Google Docs', type: 'browser-service', url: 'https://docs.google.com', icon: 'gdocs-icon', color: '#4285f4', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:gdocs', allowExternalUrls: true } } },
            { id: 'gsheets-template', name: 'Google Sheets', type: 'browser-service', url: 'https://sheets.google.com', icon: 'gsheets-icon', color: '#137333', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:gsheets', allowExternalUrls: true } } },
            { id: 'gslides-template', name: 'Google Slides', type: 'browser-service', url: 'https://slides.google.com', icon: 'gslides-icon', color: '#f9ab00', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:gslides', allowExternalUrls: true } } },
            // Microsoft Office & OneDrive
            { id: 'onedrive-template', name: 'OneDrive', type: 'browser-service', url: 'https://onedrive.live.com', icon: 'onedrive-icon', color: '#0078d4', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:onedrive', allowExternalUrls: true } } },
            { id: 'office-template', name: 'Office 365', type: 'browser-service', url: 'https://office.com', icon: 'office-icon', color: '#D13438', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:office', allowExternalUrls: true } } },
            { id: 'sharepoint-template', name: 'SharePoint', type: 'browser-service', url: 'https://sharepoint.com', icon: 'sharepoint-icon', color: '#0078d4', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:sharepoint', allowExternalUrls: true } } },
            // Cloud Storage & File Sharing
            { id: 'dropbox-template', name: 'Dropbox', type: 'browser-service', url: 'https://dropbox.com', icon: 'dropbox-icon', color: '#0061FF', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:dropbox', allowExternalUrls: true } } },
            { id: 'box-template', name: 'Box', type: 'browser-service', url: 'https://app.box.com', icon: 'box-icon', color: '#0061D5', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:box', allowExternalUrls: true } } },
            // Design & Creative
            { id: 'figma-template', name: 'Figma', type: 'browser-service', url: 'https://figma.com', icon: 'figma-icon', color: '#F24E1E', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:figma', allowExternalUrls: true } } },
            { id: 'canva-template', name: 'Canva', type: 'browser-service', url: 'https://canva.com', icon: 'canva-icon', color: '#00C4CC', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:canva', allowExternalUrls: true } } },
            { id: 'adobe-template', name: 'Adobe Creative Cloud', type: 'browser-service', url: 'https://creativecloud.adobe.com', icon: 'adobe-icon', color: '#FF0000', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:adobe', allowExternalUrls: true } } },
            { id: 'sketch-template', name: 'Sketch', type: 'browser-service', url: 'https://sketch.com', icon: 'sketch-icon', color: '#F7B500', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:sketch', allowExternalUrls: true } } },
            // Business & CRM
            { id: 'salesforce-template', name: 'Salesforce', type: 'browser-service', url: 'https://login.salesforce.com', icon: 'salesforce-icon', color: '#00A1E0', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:salesforce', allowExternalUrls: true } } },
            { id: 'hubspot-template', name: 'HubSpot', type: 'browser-service', url: 'https://app.hubspot.com', icon: 'hubspot-icon', color: '#FF7A59', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:hubspot', allowExternalUrls: true } } },
            { id: 'zendesk-template', name: 'Zendesk', type: 'browser-service', url: 'https://zendesk.com', icon: 'zendesk-icon', color: '#03363D', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:zendesk', allowExternalUrls: true } } },
            { id: 'intercom-template', name: 'Intercom', type: 'browser-service', url: 'https://app.intercom.com', icon: 'intercom-icon', color: '#1f8ded', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:intercom', allowExternalUrls: true } } },
            { id: 'pipedrive-template', name: 'Pipedrive', type: 'browser-service', url: 'https://app.pipedrive.com', icon: 'pipedrive-icon', color: '#28a745', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:pipedrive', allowExternalUrls: true } } },
            // Analytics & Marketing
            { id: 'analytics-template', name: 'Google Analytics', type: 'browser-service', url: 'https://analytics.google.com', icon: 'analytics-icon', color: '#E37400', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:analytics', allowExternalUrls: true } } },
            { id: 'mixpanel-template', name: 'Mixpanel', type: 'browser-service', url: 'https://mixpanel.com', icon: 'mixpanel-icon', color: '#674ea7', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:mixpanel', allowExternalUrls: true } } },
            { id: 'amplitude-template', name: 'Amplitude', type: 'browser-service', url: 'https://app.amplitude.com', icon: 'amplitude-icon', color: '#0066FF', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:amplitude', allowExternalUrls: true } } },
            // Social Media Management
            { id: 'buffer-template', name: 'Buffer', type: 'browser-service', url: 'https://buffer.com', icon: 'buffer-icon', color: '#168eea', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:buffer', allowExternalUrls: true } } },
            { id: 'hootsuite-template', name: 'Hootsuite', type: 'browser-service', url: 'https://hootsuite.com', icon: 'hootsuite-icon', color: '#143d52', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:hootsuite', allowExternalUrls: true } } },
            // Finance & Accounting
            { id: 'quickbooks-template', name: 'QuickBooks', type: 'browser-service', url: 'https://qbo.intuit.com', icon: 'quickbooks-icon', color: '#0077C5', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:quickbooks', allowExternalUrls: true } } },
            { id: 'xero-template', name: 'Xero', type: 'browser-service', url: 'https://go.xero.com', icon: 'xero-icon', color: '#13B5EA', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:xero', allowExternalUrls: true } } },
            { id: 'stripe-template', name: 'Stripe', type: 'browser-service', url: 'https://dashboard.stripe.com', icon: 'stripe-icon', color: '#635BFF', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:stripe', allowExternalUrls: true } } },
            // Custom Service
            { id: 'custom-template', name: 'Custom Service', type: 'browser-service', url: '', icon: 'custom-icon', color: '#666666', isEnabled: false, config: { integration: 'browser', webviewOptions: { partition: 'persist:custom', allowExternalUrls: true } } }
        ];
    }
    async ensureWorkspaceSession(workspace) {
        if (!this.workspaceSessions.has(workspace.id)) {
            await this.createWorkspaceSession(workspace);
        }
    }
    async createWorkspaceSession(workspace) {
        const partitionName = workspace.browserIsolation === 'isolated'
            ? `persist:workspace-${workspace.id}`
            : 'persist:shared';
        const workspaceSession = electron_1.session.fromPartition(partitionName);
        // Configure session security and permissions
        workspaceSession.setPermissionRequestHandler((webContents, permission, callback) => {
            // Allow permissions needed for productivity services
            const allowedPermissions = [
                'notifications',
                'camera',
                'microphone',
                'clipboard-read',
                'clipboard-sanitized-write',
                'display-capture',
                'geolocation'
            ];
            callback(allowedPermissions.includes(permission));
        });
        // Configure user agent if needed
        workspaceSession.setUserAgent(workspaceSession.getUserAgent() + ' FlowDesk/' + require('electron').app.getVersion());
        this.workspaceSessions.set(workspace.id, workspaceSession);
        electron_log_1.default.debug(`Created ${workspace.browserIsolation} session for workspace: ${workspace.name} (${workspace.id})`);
    }
    async createServiceBrowserView(workspace, service) {
        const workspaceSession = this.workspaceSessions.get(workspace.id);
        if (!workspaceSession) {
            throw new Error(`No session found for workspace: ${workspace.id}`);
        }
        // Use service-specific partition if configured, otherwise use workspace session
        const partition = service.config.webviewOptions?.partition || `persist:workspace-${workspace.id}`;
        const serviceSession = partition !== `persist:workspace-${workspace.id}`
            ? electron_1.session.fromPartition(partition)
            : workspaceSession;
        const browserView = new electron_1.BrowserView({
            webPreferences: {
                session: serviceSession,
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
                experimentalFeatures: false,
                backgroundThrottling: false, // Keep responsive
                ...service.config.webviewOptions
            }
        });
        // Configure navigation security
        browserView.webContents.on('will-navigate', (event, navigationUrl) => {
            try {
                const serviceUrl = new URL(service.url);
                const targetUrl = new URL(navigationUrl);
                // Allow same-origin navigation and configured domains
                const allowedDomains = this.getAllowedDomainsForService(service);
                const isAllowedDomain = allowedDomains.some(domain => targetUrl.hostname === domain || targetUrl.hostname.endsWith('.' + domain));
                if (!isAllowedDomain && targetUrl.hostname !== serviceUrl.hostname) {
                    event.preventDefault();
                    electron_1.shell.openExternal(navigationUrl);
                    electron_log_1.default.info(`External navigation blocked: ${navigationUrl} (opened in system browser)`);
                }
            }
            catch (error) {
                electron_log_1.default.warn('Navigation URL parse error:', error);
                event.preventDefault();
            }
        });
        // Handle new window requests
        browserView.webContents.setWindowOpenHandler(({ url, frameName, disposition }) => {
            electron_1.shell.openExternal(url);
            return { action: 'deny' };
        });
        // Handle download requests
        browserView.webContents.session.on('will-download', (event, item, webContents) => {
            electron_log_1.default.info(`Download started: ${item.getFilename()} from ${service.name}`);
        });
        electron_log_1.default.debug(`Created BrowserView for service: ${service.name} in workspace: ${workspace.name}`);
        return browserView;
    }
    getAllowedDomainsForService(service) {
        // Define allowed domains for each service type
        const serviceDomainsMap = {
            'slack': ['slack.com', 'slack-edge.com', 'slack-msgs.com'],
            'notion': ['notion.so', 'notion.site', 'notion-static.com'],
            'github': ['github.com', 'githubusercontent.com', 'githubassets.com'],
            'gmail': ['gmail.com', 'google.com', 'accounts.google.com'],
            'gdrive': ['drive.google.com', 'docs.google.com', 'sheets.google.com', 'slides.google.com'],
            'teams': ['teams.microsoft.com', 'login.microsoftonline.com', 'office.com'],
            'discord': ['discord.com', 'discordapp.com'],
            'zoom': ['zoom.us', 'zoom.com'],
            'trello': ['trello.com', 'atlassian.com'],
            'asana': ['asana.com'],
            'jira': ['atlassian.net', 'atlassian.com'],
        };
        try {
            const baseUrl = new URL(service.url);
            const baseDomain = baseUrl.hostname;
            // Get predefined domains for this service type
            const predefinedDomains = serviceDomainsMap[service.name.toLowerCase()] || [];
            return [baseDomain, ...predefinedDomains];
        }
        catch (error) {
            electron_log_1.default.warn(`Invalid service URL: ${service.url}`, error);
            return [];
        }
    }
    configureBrowserViewBounds(browserView, mainWindow) {
        const contentBounds = mainWindow.getContentBounds();
        // Calculate main content area bounds accounting for both sidebars in workspace view
        const mainContentArea = {
            x: layout_1.LAYOUT_CONSTANTS.BROWSER_VIEW_OFFSET_X, // 320px (both sidebars)
            y: layout_1.LAYOUT_CONSTANTS.BROWSER_VIEW_OFFSET_Y, // 0px (no top bar)
            width: Math.max(200, contentBounds.width - layout_1.LAYOUT_CONSTANTS.TOTAL_SIDEBAR_WIDTH), // Minimum 200px width
            height: Math.max(100, contentBounds.height - layout_1.LAYOUT_CONSTANTS.TOP_BAR_HEIGHT) // Minimum 100px height
        };
        // Ensure bounds are valid
        if (mainContentArea.width <= 0 || mainContentArea.height <= 0) {
            electron_log_1.default.warn('Invalid BrowserView bounds calculated, hiding BrowserView');
            mainWindow.setBrowserView(null);
            return;
        }
        browserView.setBounds(mainContentArea);
        electron_log_1.default.debug(`Configured BrowserView bounds:`, {
            contentBounds,
            layoutConstants: layout_1.LAYOUT_CONSTANTS,
            calculatedBounds: mainContentArea
        });
    }
    /**
     * Hide all BrowserViews from the main window
     */
    hideAllBrowserViews(mainWindow) {
        if (!mainWindow)
            return;
        // Remove any currently attached BrowserView
        if (mainWindow.getBrowserView()) {
            mainWindow.setBrowserView(null);
            electron_log_1.default.debug('Removed BrowserView from main window');
        }
    }
    /**
     * Get all active BrowserViews for cleanup
     */
    getAllBrowserViews() {
        return Array.from(this.browserViews.values());
    }
    /**
     * Show a specific service BrowserView (only for workspace view)
     */
    async showServiceBrowserView(workspaceId, serviceId, mainWindow) {
        if (!mainWindow)
            return;
        const browserViewKey = `${workspaceId}:${serviceId}`;
        const browserView = this.browserViews.get(browserViewKey);
        if (browserView) {
            // First hide any existing BrowserView
            this.hideAllBrowserViews(mainWindow);
            // Then show the requested one
            mainWindow.setBrowserView(browserView);
            this.configureBrowserViewBounds(browserView, mainWindow);
            electron_log_1.default.debug(`Showed BrowserView for service: ${serviceId}`);
        }
    }
    async closeService(workspaceId, serviceId) {
        const browserViewKey = `${workspaceId}:${serviceId}`;
        const browserView = this.browserViews.get(browserViewKey);
        if (browserView) {
            try {
                browserView.webContents.close();
            }
            catch (error) {
                electron_log_1.default.warn('Error closing browser view:', error);
            }
            this.browserViews.delete(browserViewKey);
            electron_log_1.default.info(`Closed service ${serviceId} in workspace ${workspaceId}`);
        }
    }
    /**
     * Hide all active browser views in the current workspace
     */
    async hideBrowserViews() {
        if (this.browserViewsHidden) {
            return; // Already hidden
        }
        try {
            const browserViewEntries = Array.from(this.browserViews.entries());
            for (const [key, browserView] of browserViewEntries) {
                try {
                    // Hide the browser view by setting visibility to false
                    browserView.webContents.setVisualZoomLevelLimits(1, 1);
                    browserView.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
                    electron_log_1.default.debug(`Hidden browser view: ${key}`);
                }
                catch (error) {
                    electron_log_1.default.warn(`Error hiding browser view ${key}:`, error);
                }
            }
            this.browserViewsHidden = true;
            this.emit('browser-views-hidden');
            electron_log_1.default.info('All browser views have been hidden');
        }
        catch (error) {
            electron_log_1.default.error('Error hiding browser views:', error);
            throw error;
        }
    }
    /**
     * Show previously hidden browser views in the current workspace
     */
    async showBrowserViews() {
        if (!this.browserViewsHidden) {
            return; // Already visible
        }
        try {
            // Find the main window to restore proper bounds
            const { BrowserWindow } = require('electron');
            const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (!mainWindow) {
                electron_log_1.default.warn('No main window found to restore browser view bounds');
                return;
            }
            // Mark as not hidden first, then update bounds
            this.browserViewsHidden = false;
            // Use the centralized method to restore bounds for all browser views
            this.updateBrowserViewBounds(mainWindow);
            this.emit('browser-views-shown');
            electron_log_1.default.info('All browser views have been restored');
        }
        catch (error) {
            electron_log_1.default.error('Error showing browser views:', error);
            // Revert hidden state if restore failed
            this.browserViewsHidden = true;
            throw error;
        }
    }
    /**
     * Check if browser views are currently hidden
     * @returns true if browser views are hidden, false otherwise
     */
    areBrowserViewsHidden() {
        return this.browserViewsHidden;
    }
    /**
     * Update bounds for all browser views when window resizes
     * @param mainWindow The main window to get bounds from
     */
    updateBrowserViewBounds(mainWindow) {
        if (this.browserViewsHidden) {
            return; // Don't update bounds if views are hidden
        }
        const browserViewEntries = Array.from(this.browserViews.entries());
        for (const [key, browserView] of browserViewEntries) {
            try {
                this.configureBrowserViewBounds(browserView, mainWindow);
                electron_log_1.default.debug(`Updated bounds for browser view: ${key}`);
            }
            catch (error) {
                electron_log_1.default.warn(`Error updating bounds for browser view ${key}:`, error);
            }
        }
    }
    async cleanup() {
        // Close all browser views
        const browserViewEntries = Array.from(this.browserViews.entries());
        for (const [key, browserView] of browserViewEntries) {
            try {
                browserView.webContents.close();
            }
            catch (error) {
                electron_log_1.default.warn(`Error closing browser view ${key}:`, error);
            }
        }
        this.browserViews.clear();
        // Clear workspace sessions
        this.workspaceSessions.clear();
        // Save workspace data
        const workspaces = Array.from(this.workspaces.values());
        for (const workspace of workspaces) {
            await this.saveWorkspace(workspace);
        }
        await this.shutdown();
    }
    async shutdown() {
        this.removeAllListeners();
    }
}
exports.WorkspaceManager = WorkspaceManager;
