"use strict";
/**
 * Comprehensive Service Icon Configuration
 * Maps all 44+ services to their real favicon URLs and local fallbacks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllServiceIcons = exports.getServicesByCategory = exports.getServiceFallbackUrl = exports.getServiceIconUrl = exports.getServiceIcon = exports.SERVICE_ICONS = void 0;
exports.SERVICE_ICONS = {
    // Task Management & Project Management
    'asana-template': {
        id: 'asana-template',
        name: 'Asana',
        faviconUrl: 'https://app.asana.com/favicon.ico',
        localIcon: '/assets/service-icons/asana.svg',
        fallbackIcon: 'https://logo.clearbit.com/asana.com',
        color: '#f06a6a',
        category: 'project-management'
    },
    'trello-template': {
        id: 'trello-template',
        name: 'Trello',
        faviconUrl: 'https://trello.com/favicon.ico',
        localIcon: '/assets/service-icons/trello.png',
        fallbackIcon: 'https://logo.clearbit.com/trello.com',
        color: '#0079BF',
        category: 'project-management'
    },
    'monday-template': {
        id: 'monday-template',
        name: 'Monday.com',
        faviconUrl: 'https://monday.com/favicon.ico',
        localIcon: '/assets/service-icons/monday.png',
        fallbackIcon: 'https://logo.clearbit.com/monday.com',
        color: '#ff3d57',
        category: 'project-management'
    },
    'todoist-template': {
        id: 'todoist-template',
        name: 'Todoist',
        faviconUrl: 'https://todoist.com/favicon.ico',
        localIcon: '/assets/service-icons/todoist.png',
        fallbackIcon: 'https://logo.clearbit.com/todoist.com',
        color: '#e44332',
        category: 'project-management'
    },
    'clickup-template': {
        id: 'clickup-template',
        name: 'ClickUp',
        faviconUrl: 'https://app.clickup.com/favicon.ico',
        localIcon: '/assets/service-icons/clickup.png',
        fallbackIcon: 'https://logo.clearbit.com/clickup.com',
        color: '#7b68ee',
        category: 'project-management'
    },
    'linear-template': {
        id: 'linear-template',
        name: 'Linear',
        faviconUrl: 'https://linear.app/favicon.ico',
        localIcon: '/assets/service-icons/linear.ico',
        fallbackIcon: 'https://logo.clearbit.com/linear.app',
        color: '#5e6ad2',
        category: 'project-management'
    },
    'basecamp-template': {
        id: 'basecamp-template',
        name: 'Basecamp',
        faviconUrl: 'https://basecamp.com/favicon.ico',
        localIcon: '/assets/service-icons/basecamp.png',
        fallbackIcon: 'https://logo.clearbit.com/basecamp.com',
        color: '#1f5a41',
        category: 'project-management'
    },
    'height-template': {
        id: 'height-template',
        name: 'Height',
        faviconUrl: 'https://height.app/favicon.ico',
        localIcon: '/assets/service-icons/height.png',
        fallbackIcon: 'https://logo.clearbit.com/height.app',
        color: '#4c6ef5',
        category: 'project-management'
    },
    // Communication & Collaboration
    'slack-template': {
        id: 'slack-template',
        name: 'Slack',
        faviconUrl: 'https://slack.com/favicon.ico',
        localIcon: '/assets/service-icons/slack.svg',
        fallbackIcon: 'https://logo.clearbit.com/slack.com',
        color: '#4A154B',
        category: 'communication'
    },
    'discord-template': {
        id: 'discord-template',
        name: 'Discord',
        faviconUrl: 'https://discord.com/assets/847541504914fd33810e70a0ea73177e.ico',
        localIcon: '/assets/service-icons/discord.svg',
        fallbackIcon: 'https://logo.clearbit.com/discord.com',
        color: '#5865F2',
        category: 'communication'
    },
    'teams-template': {
        id: 'teams-template',
        name: 'Microsoft Teams',
        faviconUrl: 'https://teams.microsoft.com/favicon.ico',
        localIcon: '/assets/service-icons/teams.svg',
        fallbackIcon: 'https://logo.clearbit.com/teams.microsoft.com',
        color: '#6264A7',
        category: 'communication'
    },
    'zoom-template': {
        id: 'zoom-template',
        name: 'Zoom',
        faviconUrl: 'https://zoom.us/favicon.ico',
        localIcon: '/assets/service-icons/zoom.png',
        fallbackIcon: 'https://logo.clearbit.com/zoom.us',
        color: '#2D8CFF',
        category: 'communication'
    },
    'meet-template': {
        id: 'meet-template',
        name: 'Google Meet',
        faviconUrl: 'https://meet.google.com/favicon.ico',
        localIcon: '/assets/service-icons/meet.png',
        fallbackIcon: 'https://logo.clearbit.com/meet.google.com',
        color: '#00ac47',
        category: 'communication'
    },
    'telegram-template': {
        id: 'telegram-template',
        name: 'Telegram Web',
        faviconUrl: 'https://web.telegram.org/favicon.ico',
        localIcon: '/assets/service-icons/telegram.png',
        fallbackIcon: 'https://logo.clearbit.com/telegram.org',
        color: '#0088cc',
        category: 'communication'
    },
    'whatsapp-template': {
        id: 'whatsapp-template',
        name: 'WhatsApp Web',
        faviconUrl: 'https://web.whatsapp.com/favicon.ico',
        localIcon: '/assets/service-icons/whatsapp.png',
        fallbackIcon: 'https://logo.clearbit.com/whatsapp.com',
        color: '#25d366',
        category: 'communication'
    },
    // Development & Code Management
    'github-template': {
        id: 'github-template',
        name: 'GitHub',
        faviconUrl: 'https://github.com/favicon.ico',
        localIcon: '/assets/service-icons/github.svg',
        fallbackIcon: 'https://logo.clearbit.com/github.com',
        color: '#181717',
        category: 'development'
    },
    'gitlab-template': {
        id: 'gitlab-template',
        name: 'GitLab',
        faviconUrl: 'https://gitlab.com/assets/favicon.ico',
        localIcon: '/assets/service-icons/gitlab.svg',
        fallbackIcon: 'https://logo.clearbit.com/gitlab.com',
        color: '#FC6D26',
        category: 'development'
    },
    'bitbucket-template': {
        id: 'bitbucket-template',
        name: 'Bitbucket',
        faviconUrl: 'https://bitbucket.org/favicon.ico',
        localIcon: '/assets/service-icons/bitbucket.png',
        fallbackIcon: 'https://logo.clearbit.com/bitbucket.org',
        color: '#0052CC',
        category: 'development'
    },
    'jira-template': {
        id: 'jira-template',
        name: 'Jira',
        faviconUrl: 'https://id.atlassian.com/favicon.ico',
        localIcon: '/assets/service-icons/jira.png',
        fallbackIcon: 'https://logo.clearbit.com/atlassian.com',
        color: '#0052CC',
        category: 'development'
    },
    'confluence-template': {
        id: 'confluence-template',
        name: 'Confluence',
        faviconUrl: 'https://confluence.atlassian.com/favicon.ico',
        localIcon: '/assets/service-icons/confluence.png',
        fallbackIcon: 'https://logo.clearbit.com/atlassian.com',
        color: '#172b4d',
        category: 'development'
    },
    'jenkins-template': {
        id: 'jenkins-template',
        name: 'Jenkins',
        faviconUrl: 'https://www.jenkins.io/favicon.ico',
        localIcon: '/assets/service-icons/jenkins.png',
        fallbackIcon: 'https://logo.clearbit.com/jenkins.io',
        color: '#335061',
        category: 'development'
    },
    // Productivity & Notes
    'notion-template': {
        id: 'notion-template',
        name: 'Notion',
        faviconUrl: 'https://notion.so/favicon.ico',
        localIcon: '/assets/service-icons/notion.png',
        fallbackIcon: 'https://logo.clearbit.com/notion.so',
        color: '#000000',
        category: 'productivity'
    },
    'obsidian-template': {
        id: 'obsidian-template',
        name: 'Obsidian',
        faviconUrl: 'https://obsidian.md/favicon.ico',
        localIcon: '/assets/service-icons/obsidian.png',
        fallbackIcon: 'https://logo.clearbit.com/obsidian.md',
        color: '#7C3AED',
        category: 'productivity'
    },
    'evernote-template': {
        id: 'evernote-template',
        name: 'Evernote',
        faviconUrl: 'https://evernote.com/favicon.ico',
        localIcon: '/assets/service-icons/evernote.png',
        fallbackIcon: 'https://logo.clearbit.com/evernote.com',
        color: '#00A82D',
        category: 'productivity'
    },
    'onenote-template': {
        id: 'onenote-template',
        name: 'OneNote',
        faviconUrl: 'https://www.onenote.com/favicon.ico',
        localIcon: '/assets/service-icons/onenote.png',
        fallbackIcon: 'https://logo.clearbit.com/onenote.com',
        color: '#7719AA',
        category: 'productivity'
    },
    'logseq-template': {
        id: 'logseq-template',
        name: 'Logseq',
        faviconUrl: 'https://logseq.com/favicon.ico',
        localIcon: '/assets/service-icons/logseq.png',
        fallbackIcon: 'https://logo.clearbit.com/logseq.com',
        color: '#002b36',
        category: 'productivity'
    },
    // Google Workspace
    'gdrive-template': {
        id: 'gdrive-template',
        name: 'Google Drive',
        faviconUrl: 'https://drive.google.com/favicon.ico',
        localIcon: '/assets/service-icons/googledrive.png',
        fallbackIcon: 'https://logo.clearbit.com/drive.google.com',
        color: '#1a73e8',
        category: 'cloud-storage'
    },
    'gdocs-template': {
        id: 'gdocs-template',
        name: 'Google Docs',
        faviconUrl: 'https://docs.google.com/favicon.ico',
        localIcon: '/assets/service-icons/gdocs.png',
        fallbackIcon: 'https://logo.clearbit.com/docs.google.com',
        color: '#4285f4',
        category: 'productivity'
    },
    'gsheets-template': {
        id: 'gsheets-template',
        name: 'Google Sheets',
        faviconUrl: 'https://sheets.google.com/favicon.ico',
        localIcon: '/assets/service-icons/gsheets.png',
        fallbackIcon: 'https://logo.clearbit.com/sheets.google.com',
        color: '#137333',
        category: 'productivity'
    },
    'gslides-template': {
        id: 'gslides-template',
        name: 'Google Slides',
        faviconUrl: 'https://slides.google.com/favicon.ico',
        localIcon: '/assets/service-icons/gslides.png',
        fallbackIcon: 'https://logo.clearbit.com/slides.google.com',
        color: '#f9ab00',
        category: 'productivity'
    },
    // Microsoft Office & OneDrive
    'onedrive-template': {
        id: 'onedrive-template',
        name: 'OneDrive',
        faviconUrl: 'https://onedrive.live.com/favicon.ico',
        localIcon: '/assets/service-icons/onedrive.png',
        fallbackIcon: 'https://logo.clearbit.com/onedrive.live.com',
        color: '#0078d4',
        category: 'cloud-storage'
    },
    'office-template': {
        id: 'office-template',
        name: 'Office 365',
        faviconUrl: 'https://www.office.com/favicon.ico',
        localIcon: '/assets/service-icons/office.png',
        fallbackIcon: 'https://logo.clearbit.com/office.com',
        color: '#D13438',
        category: 'productivity'
    },
    'sharepoint-template': {
        id: 'sharepoint-template',
        name: 'SharePoint',
        faviconUrl: 'https://sharepoint.com/favicon.ico',
        localIcon: '/assets/service-icons/sharepoint.png',
        fallbackIcon: 'https://logo.clearbit.com/sharepoint.com',
        color: '#0078d4',
        category: 'collaboration'
    },
    // Cloud Storage & File Sharing
    'dropbox-template': {
        id: 'dropbox-template',
        name: 'Dropbox',
        faviconUrl: 'https://www.dropbox.com/favicon.ico',
        localIcon: '/assets/service-icons/dropbox.png',
        fallbackIcon: 'https://logo.clearbit.com/dropbox.com',
        color: '#0061FF',
        category: 'cloud-storage'
    },
    'box-template': {
        id: 'box-template',
        name: 'Box',
        faviconUrl: 'https://app.box.com/favicon.ico',
        localIcon: '/assets/service-icons/box.png',
        fallbackIcon: 'https://logo.clearbit.com/box.com',
        color: '#0061D5',
        category: 'cloud-storage'
    },
    // Design & Creative
    'figma-template': {
        id: 'figma-template',
        name: 'Figma',
        faviconUrl: 'https://www.figma.com/favicon.ico',
        localIcon: '/assets/service-icons/figma.svg',
        fallbackIcon: 'https://logo.clearbit.com/figma.com',
        color: '#F24E1E',
        category: 'design'
    },
    'canva-template': {
        id: 'canva-template',
        name: 'Canva',
        faviconUrl: 'https://www.canva.com/favicon.ico',
        localIcon: '/assets/service-icons/canva.png',
        fallbackIcon: 'https://logo.clearbit.com/canva.com',
        color: '#00C4CC',
        category: 'design'
    },
    'adobe-template': {
        id: 'adobe-template',
        name: 'Adobe Creative Cloud',
        faviconUrl: 'https://creativecloud.adobe.com/favicon.ico',
        localIcon: '/assets/service-icons/adobe.png',
        fallbackIcon: 'https://logo.clearbit.com/adobe.com',
        color: '#FF0000',
        category: 'design'
    },
    'sketch-template': {
        id: 'sketch-template',
        name: 'Sketch',
        faviconUrl: 'https://www.sketch.com/favicon.ico',
        localIcon: '/assets/service-icons/sketch.png',
        fallbackIcon: 'https://logo.clearbit.com/sketch.com',
        color: '#F7B500',
        category: 'design'
    },
    'miro-template': {
        id: 'miro-template',
        name: 'Miro',
        faviconUrl: 'https://miro.com/favicon.ico',
        localIcon: '/assets/service-icons/miro.ico',
        fallbackIcon: 'https://logo.clearbit.com/miro.com',
        color: '#050038',
        category: 'design'
    },
    // Business & CRM
    'salesforce-template': {
        id: 'salesforce-template',
        name: 'Salesforce',
        faviconUrl: 'https://login.salesforce.com/favicon.ico',
        localIcon: '/assets/service-icons/salesforce.png',
        fallbackIcon: 'https://logo.clearbit.com/salesforce.com',
        color: '#00A1E0',
        category: 'crm'
    },
    'hubspot-template': {
        id: 'hubspot-template',
        name: 'HubSpot',
        faviconUrl: 'https://app.hubspot.com/favicon.ico',
        localIcon: '/assets/service-icons/hubspot.ico',
        fallbackIcon: 'https://logo.clearbit.com/hubspot.com',
        color: '#FF7A59',
        category: 'crm'
    },
    'zendesk-template': {
        id: 'zendesk-template',
        name: 'Zendesk',
        faviconUrl: 'https://www.zendesk.com/favicon.ico',
        localIcon: '/assets/service-icons/zendesk.png',
        fallbackIcon: 'https://logo.clearbit.com/zendesk.com',
        color: '#03363D',
        category: 'support'
    },
    'intercom-template': {
        id: 'intercom-template',
        name: 'Intercom',
        faviconUrl: 'https://app.intercom.com/favicon.ico',
        localIcon: '/assets/service-icons/intercom.png',
        fallbackIcon: 'https://logo.clearbit.com/intercom.com',
        color: '#1f8ded',
        category: 'support'
    },
    'pipedrive-template': {
        id: 'pipedrive-template',
        name: 'Pipedrive',
        faviconUrl: 'https://app.pipedrive.com/favicon.ico',
        localIcon: '/assets/service-icons/pipedrive.png',
        fallbackIcon: 'https://logo.clearbit.com/pipedrive.com',
        color: '#28a745',
        category: 'crm'
    },
    // Analytics & Marketing
    'analytics-template': {
        id: 'analytics-template',
        name: 'Google Analytics',
        faviconUrl: 'https://analytics.google.com/favicon.ico',
        localIcon: '/assets/service-icons/analytics.png',
        fallbackIcon: 'https://logo.clearbit.com/analytics.google.com',
        color: '#E37400',
        category: 'analytics'
    },
    'mixpanel-template': {
        id: 'mixpanel-template',
        name: 'Mixpanel',
        faviconUrl: 'https://mixpanel.com/favicon.ico',
        localIcon: '/assets/service-icons/mixpanel.png',
        fallbackIcon: 'https://logo.clearbit.com/mixpanel.com',
        color: '#674ea7',
        category: 'analytics'
    },
    'amplitude-template': {
        id: 'amplitude-template',
        name: 'Amplitude',
        faviconUrl: 'https://app.amplitude.com/favicon.ico',
        localIcon: '/assets/service-icons/amplitude.png',
        fallbackIcon: 'https://logo.clearbit.com/amplitude.com',
        color: '#0066FF',
        category: 'analytics'
    },
    // Social Media Management
    'buffer-template': {
        id: 'buffer-template',
        name: 'Buffer',
        faviconUrl: 'https://buffer.com/favicon.ico',
        localIcon: '/assets/service-icons/buffer.png',
        fallbackIcon: 'https://logo.clearbit.com/buffer.com',
        color: '#168eea',
        category: 'social-media'
    },
    'hootsuite-template': {
        id: 'hootsuite-template',
        name: 'Hootsuite',
        faviconUrl: 'https://hootsuite.com/favicon.ico',
        localIcon: '/assets/service-icons/hootsuite.png',
        fallbackIcon: 'https://logo.clearbit.com/hootsuite.com',
        color: '#143d52',
        category: 'social-media'
    },
    // Finance & Accounting
    'quickbooks-template': {
        id: 'quickbooks-template',
        name: 'QuickBooks',
        faviconUrl: 'https://qbo.intuit.com/favicon.ico',
        localIcon: '/assets/service-icons/quickbooks.png',
        fallbackIcon: 'https://logo.clearbit.com/quickbooks.intuit.com',
        color: '#0077C5',
        category: 'finance'
    },
    'xero-template': {
        id: 'xero-template',
        name: 'Xero',
        faviconUrl: 'https://go.xero.com/favicon.ico',
        localIcon: '/assets/service-icons/xero.png',
        fallbackIcon: 'https://logo.clearbit.com/xero.com',
        color: '#13B5EA',
        category: 'finance'
    },
    'stripe-template': {
        id: 'stripe-template',
        name: 'Stripe',
        faviconUrl: 'https://dashboard.stripe.com/favicon.ico',
        localIcon: '/assets/service-icons/stripe.png',
        fallbackIcon: 'https://logo.clearbit.com/stripe.com',
        color: '#635BFF',
        category: 'finance'
    },
    // Custom Service
    'custom-template': {
        id: 'custom-template',
        name: 'Custom Service',
        faviconUrl: '',
        localIcon: '/assets/service-icons/default.svg',
        fallbackIcon: '/assets/service-icons/default.svg',
        color: '#666666',
        category: 'custom'
    }
};
// Helper functions for working with service icons
const getServiceIcon = (serviceId) => {
    return exports.SERVICE_ICONS[serviceId] || null;
};
exports.getServiceIcon = getServiceIcon;
const getServiceIconUrl = (serviceId, preferLocal = false) => {
    const config = exports.SERVICE_ICONS[serviceId];
    if (!config)
        return exports.SERVICE_ICONS['custom-template'].localIcon;
    if (preferLocal) {
        return config.localIcon;
    }
    return config.faviconUrl || config.localIcon;
};
exports.getServiceIconUrl = getServiceIconUrl;
const getServiceFallbackUrl = (serviceId) => {
    const config = exports.SERVICE_ICONS[serviceId];
    return config?.fallbackIcon || exports.SERVICE_ICONS['custom-template'].localIcon;
};
exports.getServiceFallbackUrl = getServiceFallbackUrl;
const getServicesByCategory = () => {
    const categories = {};
    Object.values(exports.SERVICE_ICONS).forEach(config => {
        if (!categories[config.category]) {
            categories[config.category] = [];
        }
        categories[config.category].push(config);
    });
    return categories;
};
exports.getServicesByCategory = getServicesByCategory;
const getAllServiceIcons = () => {
    return Object.values(exports.SERVICE_ICONS);
};
exports.getAllServiceIcons = getAllServiceIcons;
//# sourceMappingURL=service-icons.js.map