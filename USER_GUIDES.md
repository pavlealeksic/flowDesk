# Flow Desk User Guides

## Overview

Welcome to Flow Desk, the privacy-first, cross-platform work OS that unifies your productivity tools. This comprehensive user guide covers installation, onboarding, features, and troubleshooting to help you get the most out of Flow Desk.

---

## Table of Contents

1. [Installation and Setup](#installation-and-setup)
2. [Getting Started and Onboarding](#getting-started-and-onboarding)
3. [Core Features](#core-features)
4. [Plugin System](#plugin-system)
5. [Advanced Features](#advanced-features)
6. [Troubleshooting](#troubleshooting)
7. [Tips and Best Practices](#tips-and-best-practices)

---

## Installation and Setup

### System Requirements

#### Desktop Application
- **macOS:** 11.0 (Big Sur) or later
- **Windows:** Windows 10 (version 1903) or later
- **Linux:** Ubuntu 20.04, Fedora 35, or equivalent
- **RAM:** 4GB minimum, 8GB recommended
- **Storage:** 2GB available space
- **Internet:** Required for sync and plugin functionality

#### Mobile Application
- **iOS:** iOS 14.0 or later
- **Android:** Android 8.0 (API level 26) or later
- **Storage:** 500MB available space

### Desktop Installation

#### macOS Installation
1. **Download:** Visit [flowdesk.com/download](https://flowdesk.com/download)
2. **Install:** Open the downloaded `.dmg` file and drag Flow Desk to Applications
3. **First Launch:** Right-click and select "Open" to bypass Gatekeeper (first time only)
4. **Permissions:** Grant necessary permissions when prompted:
   - **Calendar Access:** For calendar integration
   - **Contacts Access:** For email autocomplete
   - **Network Access:** For syncing and plugins

#### Windows Installation
1. **Download:** Get the `.exe` installer from [flowdesk.com/download](https://flowdesk.com/download)
2. **Install:** Run the installer as Administrator
3. **Windows Defender:** Allow the application if Windows Defender blocks it
4. **First Launch:** Start Flow Desk from the Start Menu or Desktop shortcut

#### Linux Installation

**AppImage (Recommended):**
```bash
# Download AppImage
curl -L -o FlowDesk.AppImage https://releases.flowdesk.com/latest/FlowDesk.AppImage

# Make executable
chmod +x FlowDesk.AppImage

# Run
./FlowDesk.AppImage
```

**Package Installation:**
```bash
# Ubuntu/Debian
wget -qO- https://releases.flowdesk.com/gpg.key | sudo apt-key add -
echo "deb https://releases.flowdesk.com/apt/ stable main" | sudo tee /etc/apt/sources.list.d/flowdesk.list
sudo apt update && sudo apt install flowdesk

# Fedora/RHEL
sudo dnf config-manager --add-repo https://releases.flowdesk.com/rpm/flowdesk.repo
sudo dnf install flowdesk
```

### Mobile Installation

#### iOS Installation
1. **App Store:** Search for "Flow Desk" in the App Store
2. **Install:** Tap "Get" to download and install
3. **Sign In:** Use your Flow Desk account or create a new one

#### Android Installation
1. **Google Play:** Search for "Flow Desk" in Google Play Store
2. **Install:** Tap "Install" to download
3. **Permissions:** Grant necessary permissions for notifications and calendar access

### Account Creation

1. **Visit:** [flowdesk.com/sign-up](https://flowdesk.com/sign-up)
2. **Choose Method:**
   - Email and password
   - Google account
   - Microsoft account
   - GitHub account
3. **Verify Email:** Check your email and click the verification link
4. **Choose Plan:** Select Starter, Pro, or Team plan
5. **Complete Setup:** Follow the onboarding process

---

## Getting Started and Onboarding

### Initial Setup Wizard

When you first launch Flow Desk, you'll be guided through a setup process:

#### Step 1: Welcome and Account
- **Sign In:** Use your existing account or create a new one
- **Sync Setup:** Choose how to sync your data across devices
- **Privacy Settings:** Configure your privacy preferences

#### Step 2: Email Integration
Flow Desk will help you connect your email accounts:

1. **Choose Provider:** Gmail, Outlook, or IMAP
2. **Authentication:** Sign in securely using OAuth
3. **Permissions:** Grant necessary permissions for mail access
4. **Test Connection:** Verify your email is working correctly

#### Step 3: Calendar Integration
Connect your calendars for unified scheduling:

1. **Select Calendars:** Choose which calendars to sync
2. **Privacy Settings:** Configure cross-calendar privacy sync
3. **Notification Preferences:** Set up calendar notifications

#### Step 4: Plugin Selection
Choose essential plugins to enhance your workflow:

- **Communication:** Slack, Microsoft Teams, Discord
- **Productivity:** Notion, Asana, Trello
- **Development:** GitHub, GitLab
- **Storage:** Google Drive, OneDrive, Dropbox

### Workspace Setup

#### Creating Your First Workspace
1. **Open Workspace Manager:** Click the workspace icon in the left sidebar
2. **Create Workspace:** Click "+" to create a new workspace
3. **Configure:**
   - **Name:** Give your workspace a descriptive name
   - **Icon:** Choose an icon or upload your own
   - **Privacy Mode:** Enable for sensitive work
   - **Proxy Settings:** Configure if needed
4. **Add Applications:** Install plugins and configure integrations

#### Workspace Templates
Flow Desk provides pre-configured workspace templates:

- **Freelancer:** Email, calendar, project management, invoicing
- **Developer:** GitHub, Slack, calendar, documentation tools
- **Agency:** Client communication, project tracking, time management
- **Support:** Ticketing, knowledge base, team communication

### Interface Overview

#### Left Sidebar
- **Workspaces:** Switch between different work contexts
- **Mail:** Unified inbox across all email accounts
- **Calendar:** Integrated calendar view
- **Search:** Universal search across all connected services
- **Notifications:** Centralized notification hub
- **Plugins:** Installed applications and integrations

#### Main Content Area
- **Primary View:** Current application or content
- **Tabs:** Multiple applications open simultaneously  
- **Quick Actions:** Cmd+K (Mac) or Ctrl+K (Windows/Linux)

#### Right Panel (Optional)
- **Plugin Panels:** Side panels for quick access
- **Calendar Widget:** Upcoming events
- **Notification Center:** Recent alerts
- **Quick Notes:** Temporary notes and reminders

---

## Core Features

### Email Management

#### Unified Inbox
Flow Desk combines all your email accounts into a single, intelligent inbox:

**Features:**
- **Smart Filtering:** Automatic categorization of emails
- **Unified Search:** Search across all email accounts
- **Thread Management:** Intelligent conversation grouping
- **Snooze and Schedule:** Defer emails and schedule sending

**Getting Started:**
1. **Connect Accounts:** Add Gmail, Outlook, or IMAP accounts
2. **Configure Filters:** Set up rules for automatic organization
3. **Customize Views:** Choose inbox layout and density
4. **Set Notifications:** Configure email notification preferences

#### Compose and Reply
**Rich Text Editor:**
- **Templates:** Pre-designed email templates
- **Signatures:** Multiple signatures per account
- **Attachments:** Drag-and-drop file attachments
- **Scheduling:** Schedule emails for later delivery
- **Undo Send:** Recall sent emails within time window

**Keyboard Shortcuts:**
- `Cmd+N` / `Ctrl+N`: New email
- `Cmd+R` / `Ctrl+R`: Reply
- `Cmd+Shift+R` / `Ctrl+Shift+R`: Reply all
- `Cmd+F` / `Ctrl+F`: Forward email
- `Cmd+Enter` / `Ctrl+Enter`: Send email

### Calendar Integration

#### Multi-Calendar View
Flow Desk provides a unified view of all your calendars:

**Supported Services:**
- Google Calendar
- Microsoft Outlook Calendar
- Apple Calendar (CalDAV)
- Custom CalDAV servers

**View Options:**
- **Day View:** Detailed hourly schedule
- **Week View:** Week overview with time blocks
- **Month View:** Monthly calendar grid
- **Agenda View:** List of upcoming events

#### Event Management
**Creating Events:**
1. **Quick Add:** Type natural language (e.g., "Meeting with John tomorrow at 2pm")
2. **Detailed Form:** Click date/time slot for full event creation
3. **Templates:** Use meeting templates for recurring event types

**Event Features:**
- **Meeting Links:** Automatic Zoom/Meet link generation
- **Attendees:** Add participants and send invitations
- **Reminders:** Multiple reminder options
- **Recurring Events:** Complex recurrence patterns
- **Time Zone Support:** Multi-timezone scheduling

#### Privacy Sync
Flow Desk's unique privacy sync feature mirrors events across calendars while protecting sensitive information:

**How It Works:**
1. **Select Source Calendar:** Choose calendar with detailed events
2. **Choose Target Calendar:** Select calendar for privacy blocks
3. **Configure Privacy:** Set generic title (default: "Busy")
4. **Automatic Sync:** Events appear as busy blocks without details

**Use Cases:**
- Sync personal calendar to work calendar
- Show availability without revealing details
- Coordinate across different calendar systems

### Unified Search

#### Global Search
Flow Desk's powerful search engine finds information across all connected services:

**What You Can Search:**
- **Emails:** Subject, content, attachments, metadata
- **Calendar Events:** Titles, descriptions, locations, attendees
- **Documents:** Google Drive, OneDrive, Dropbox files
- **Messages:** Slack, Teams, Discord conversations
- **Projects:** Asana, Trello, Jira items
- **Code:** GitHub repositories and issues

**Search Tips:**
- **Natural Language:** "emails from John last week"
- **Filters:** `from:john@company.com after:2025-01-01`
- **File Types:** `filetype:pdf meeting notes`
- **Services:** `in:slack mentions me`

#### Search Interface
**Access Search:**
- **Global Search:** Cmd+K (Mac) or Ctrl+K (Windows/Linux)
- **Service-Specific:** Click search within any plugin
- **Mobile:** Tap search icon in navigation

**Search Results:**
- **Grouped by Service:** Results organized by source
- **Relevance Ranking:** Most relevant results first
- **Preview:** Quick preview without opening full application
- **Actions:** Direct actions on search results

### Notifications Hub

#### Centralized Notifications
All notifications from connected services appear in one place:

**Notification Sources:**
- Email notifications
- Calendar reminders
- Slack mentions and DMs
- GitHub pull requests
- Asana task assignments
- Custom notifications from plugins

#### Smart Filtering
**Notification Rules:**
1. **Priority Filtering:** VIP senders and important keywords
2. **Time-Based Rules:** Do Not Disturb schedules
3. **Context Filtering:** Different rules per workspace
4. **Bundling:** Group similar notifications

**Focus Modes:**
- **Do Not Disturb:** Block non-critical notifications
- **Work Mode:** Only work-related notifications
- **Personal Mode:** Only personal notifications
- **Custom Modes:** Create your own notification rules

---

## Plugin System

### Installing Plugins

#### Plugin Marketplace
1. **Open Plugin Manager:** Click "Plugins" in left sidebar
2. **Browse Categories:** Communication, Productivity, Developer Tools, etc.
3. **Search:** Find specific plugins by name or functionality
4. **Install:** Click "Install" for free plugins or "Purchase" for paid ones

#### Popular Plugins

**Communication:**
- **Slack:** Team communication and file sharing
- **Microsoft Teams:** Enterprise collaboration
- **Discord:** Gaming and community communication
- **Zoom:** Video conferencing and meetings
- **WhatsApp Business:** Business messaging

**Productivity:**
- **Notion:** All-in-one workspace
- **Asana:** Project and task management
- **Trello:** Kanban-style project boards
- **Monday.com:** Work management platform
- **Todoist:** Personal task management

**Developer Tools:**
- **GitHub:** Code repositories and collaboration
- **GitLab:** DevOps and CI/CD platform
- **Jira:** Issue tracking and project management
- **Linear:** Modern issue tracking
- **Sentry:** Error monitoring and debugging

### Configuring Plugins

#### Authentication Setup
Most plugins require authentication with their respective services:

1. **Click Configure:** After installing a plugin
2. **OAuth Flow:** Sign in to the service securely
3. **Permissions:** Review and accept required permissions
4. **Test Connection:** Verify the plugin is working correctly

#### Plugin Settings
Each plugin has configurable options:

**Common Settings:**
- **Notifications:** Enable/disable plugin notifications
- **Sync Frequency:** How often to check for updates
- **Workspace Access:** Which workspaces can use the plugin
- **Privacy Settings:** Data sharing and storage preferences

#### Custom Plugins
Advanced users can create custom plugins:

1. **Developer Mode:** Enable in Settings > Advanced
2. **Plugin Template:** Use provided template or start from scratch
3. **Local Testing:** Test plugins in development mode
4. **Packaging:** Create distributable plugin packages

### Managing Plugins

#### Plugin Updates
- **Automatic Updates:** Enable for seamless plugin updates
- **Manual Updates:** Review changes before updating
- **Beta Channel:** Get early access to new features

#### Plugin Permissions
Review and manage plugin permissions:

1. **Permission Audit:** Settings > Security > Plugin Permissions
2. **Revoke Access:** Remove permissions for unused features
3. **Scope Limiting:** Restrict plugin access to specific data

#### Troubleshooting Plugins
Common plugin issues and solutions:

**Plugin Not Loading:**
- Check internet connection
- Verify plugin is compatible with your Flow Desk version
- Restart Flow Desk
- Reinstall the plugin

**Authentication Errors:**
- Re-authenticate with the service
- Check service status pages
- Verify account permissions
- Clear plugin data and reconfigure

---

## Advanced Features

### Automation Engine

#### Creating Automations
Flow Desk's automation engine connects your tools and creates powerful workflows:

**Automation Types:**
- **Triggers:** Events that start automations
- **Conditions:** Logic that determines when to act
- **Actions:** What happens when conditions are met

#### Example Automations

**Email to Task:**
- **Trigger:** Starred email received
- **Condition:** Email from specific sender
- **Action:** Create Asana task with email content

**Meeting Preparation:**
- **Trigger:** 30 minutes before meeting
- **Condition:** Meeting has external attendees
- **Action:** Send reminder with meeting prep materials

**Status Sync:**
- **Trigger:** Calendar event starts
- **Condition:** Event title contains "Focus"
- **Action:** Set Slack status to "In deep work"

#### Building Automations
1. **Open Automation Builder:** Click "Automations" in settings
2. **Choose Trigger:** Select what starts the automation
3. **Add Conditions:** Define when automation should run
4. **Configure Actions:** Set what happens
5. **Test:** Run automation with test data
6. **Activate:** Turn on automation

### Cross-Platform Sync

#### Sync Configuration
Flow Desk syncs your configuration and preferences across all devices:

**What Syncs:**
- Workspace layouts and settings
- Plugin configurations
- Email signatures and templates
- Automation rules
- Custom shortcuts and preferences

**Sync Methods:**
- **Cloud Sync:** iCloud, OneDrive, Google Drive, Dropbox
- **LAN Sync:** Local network synchronization
- **Manual Export/Import:** Encrypted backup files

#### Setting Up Sync
1. **Choose Sync Method:** Settings > Sync > Storage Provider
2. **Authentication:** Sign in to your storage provider
3. **Encryption:** Configure end-to-end encryption
4. **Sync Scope:** Choose what to sync
5. **Conflict Resolution:** Set merge preferences

### Security and Privacy

#### Privacy Features
Flow Desk is designed with privacy as a core principle:

**Data Protection:**
- **Local Storage:** Data stored locally by default
- **End-to-End Encryption:** Synced data is encrypted
- **No Tracking:** No user behavior tracking
- **Minimal Data Collection:** Only essential data collected

#### Security Settings
**Account Security:**
- **Two-Factor Authentication:** Add extra security layer
- **Session Management:** Monitor active sessions
- **Login Alerts:** Get notified of new logins
- **Password Requirements:** Strong password enforcement

**Application Security:**
- **Plugin Sandboxing:** Plugins run in isolated environments
- **Permission System:** Granular control over plugin access
- **Network Security:** Secure connections to all services
- **Local Encryption:** Sensitive data encrypted at rest

### Customization

#### Themes and Appearance
**Theme Options:**
- **Light Mode:** Clean, bright interface
- **Dark Mode:** Reduced eye strain for low light
- **Auto Mode:** Follow system theme
- **Custom Themes:** Create your own color schemes

**Layout Customization:**
- **Sidebar Width:** Adjust sidebar size
- **Density:** Compact or comfortable spacing
- **Font Size:** Adjust text size for readability
- **Panel Layout:** Customize main interface layout

#### Keyboard Shortcuts
Flow Desk supports extensive keyboard shortcuts for power users:

**Global Shortcuts:**
- `Cmd+K` / `Ctrl+K`: Quick actions and search
- `Cmd+,` / `Ctrl+,`: Settings
- `Cmd+1-9` / `Ctrl+1-9`: Switch workspaces
- `Cmd+T` / `Ctrl+T`: New tab
- `Cmd+W` / `Ctrl+W`: Close tab

**Custom Shortcuts:**
1. **Settings > Keyboard:** Open keyboard settings
2. **Add Shortcut:** Define custom key combinations
3. **Assign Actions:** Connect to specific functions
4. **Import/Export:** Share shortcut configurations

---

## Troubleshooting

### Common Issues

#### Installation Problems

**macOS: "App can't be opened"**
- **Solution:** Right-click app and select "Open", then click "Open" in dialog
- **Alternative:** System Preferences > Security & Privacy > Allow app

**Windows: "Windows protected your PC"**
- **Solution:** Click "More info" then "Run anyway"
- **Note:** This is normal for new applications

**Linux: AppImage won't run**
- **Solution:** Make file executable: `chmod +x FlowDesk.AppImage`
- **Dependencies:** Install fuse: `sudo apt install fuse`

#### Sync Issues

**Sync Not Working:**
1. Check internet connection
2. Verify storage provider credentials
3. Check available storage space
4. Restart Flow Desk
5. Reset sync in Settings > Sync > Reset

**Conflicting Changes:**
1. Review conflict resolution options
2. Choose merge strategy or manual resolution
3. Create backup before resolving conflicts

#### Plugin Issues

**Plugin Won't Load:**
- **Check Compatibility:** Ensure plugin supports your Flow Desk version
- **Clear Cache:** Settings > Advanced > Clear Plugin Cache
- **Reinstall:** Remove and reinstall the plugin
- **Check Logs:** Help > Show Logs for error details

**Authentication Failures:**
- **Re-authenticate:** Remove and re-add account in plugin settings
- **Check Permissions:** Verify account has necessary permissions
- **Service Status:** Check if the service is experiencing issues

### Performance Issues

#### Slow Performance
**General Optimization:**
1. **Close Unused Plugins:** Disable plugins you don't actively use
2. **Reduce Sync Frequency:** Adjust sync intervals in settings
3. **Clear Cache:** Clear application cache regularly
4. **Restart Application:** Restart Flow Desk daily

**Memory Usage:**
- **Check Resource Monitor:** Help > Resource Monitor
- **Close Heavy Plugins:** Identify memory-intensive plugins
- **Reduce Simultaneous Connections:** Limit concurrent sync operations

#### Network Issues
**Connection Problems:**
1. **Check Internet:** Verify internet connectivity
2. **Firewall Settings:** Ensure Flow Desk isn't blocked
3. **Proxy Configuration:** Configure proxy settings if needed
4. **DNS Issues:** Try different DNS servers (8.8.8.8, 1.1.1.1)

### Data Recovery

#### Backup and Restore
**Creating Backups:**
1. **Settings > Data:** Open data management
2. **Export Data:** Create encrypted backup file
3. **Save Securely:** Store backup in safe location
4. **Regular Backups:** Set up automatic backup schedule

**Restoring Data:**
1. **Import Backup:** Settings > Data > Import
2. **Select File:** Choose backup file
3. **Verify Data:** Check that all data restored correctly
4. **Reconfigure Plugins:** Re-authenticate services if needed

#### Lost Configuration
**Configuration Recovery:**
1. **Check Sync Storage:** Look for configuration files in sync location
2. **Previous Versions:** Restore from automatic backups
3. **Factory Reset:** Reset to defaults and reconfigure
4. **Support:** Contact support for advanced recovery

### Getting Help

#### Self-Help Resources
- **Documentation:** [docs.flowdesk.com](https://docs.flowdesk.com)
- **FAQ:** [flowdesk.com/faq](https://flowdesk.com/faq)
- **Video Tutorials:** [youtube.com/flowdesk](https://youtube.com/flowdesk)
- **Community Forum:** [community.flowdesk.com](https://community.flowdesk.com)

#### Contact Support
**Before Contacting Support:**
1. Check this troubleshooting guide
2. Search the community forum
3. Try basic troubleshooting steps
4. Gather system information and error logs

**Support Channels:**
- **Email:** support@flowdesk.com
- **Live Chat:** Available during business hours
- **Premium Support:** Priority support for Pro and Team users
- **Enterprise Support:** Dedicated support for Enterprise customers

**Include in Support Request:**
- Flow Desk version number
- Operating system and version
- Steps to reproduce the issue
- Error messages or screenshots
- Log files (Help > Export Logs)

---

## Tips and Best Practices

### Productivity Tips

#### Workspace Organization
**Best Practices:**
1. **Dedicated Workspaces:** Create separate workspaces for different projects or clients
2. **Consistent Naming:** Use clear, descriptive workspace names
3. **Color Coding:** Use different icons or colors for easy identification
4. **Regular Cleanup:** Remove unused workspaces periodically

#### Email Management
**Inbox Zero Strategy:**
1. **Process Regularly:** Check email at designated times
2. **Quick Actions:** Use keyboard shortcuts for common actions
3. **Smart Filters:** Set up rules to automatically organize emails
4. **Template Usage:** Create templates for frequent responses

#### Calendar Optimization
**Scheduling Tips:**
1. **Time Blocking:** Block time for focused work
2. **Buffer Time:** Add buffers between meetings
3. **Privacy Sync:** Use privacy sync to protect personal time
4. **Meeting Hygiene:** Always include agendas and clear objectives

### Security Best Practices

#### Account Security
1. **Strong Passwords:** Use unique, complex passwords
2. **Two-Factor Authentication:** Enable 2FA on all accounts
3. **Regular Reviews:** Review connected services and permissions
4. **Session Monitoring:** Monitor active sessions regularly

#### Plugin Security
1. **Minimal Permissions:** Only grant necessary permissions
2. **Regular Audits:** Review plugin permissions quarterly
3. **Trusted Sources:** Only install plugins from verified developers
4. **Update Promptly:** Keep plugins updated for security patches

### Collaboration Tips

#### Team Usage
**Setting Up Teams:**
1. **Shared Workspaces:** Create workspaces for team projects
2. **Permission Management:** Assign appropriate access levels
3. **Template Sharing:** Share automation and workspace templates
4. **Regular Syncs:** Schedule team check-ins and training

#### Client Management
**For Agencies and Freelancers:**
1. **Client Workspaces:** Separate workspace per client
2. **Privacy Settings:** Ensure client data separation
3. **Access Control:** Limit team member access as needed
4. **Professional Boundaries:** Use privacy sync to separate work/personal

### Performance Optimization

#### System Performance
1. **Regular Updates:** Keep Flow Desk updated
2. **System Resources:** Monitor CPU and memory usage
3. **Plugin Management:** Disable unused plugins
4. **Cache Management:** Clear cache regularly

#### Network Optimization
1. **Sync Scheduling:** Schedule sync during off-peak hours
2. **Connection Priorities:** Prioritize important services
3. **Offline Preparation:** Cache important data for offline use
4. **Bandwidth Management:** Adjust sync frequency based on connection

### Automation Ideas

#### Email Automation
- Auto-file emails by sender or subject
- Create tasks from starred emails
- Send follow-up reminders for unanswered emails
- Automatically forward emails to team members

#### Calendar Automation
- Block focus time based on task priorities
- Automatically join meetings from calendar events
- Send meeting preparation reminders
- Update status across services during meetings

#### Project Management
- Create calendar events from project deadlines
- Update project status based on email responses
- Notify team members of project milestones
- Generate daily standup reports

---

## Keyboard Shortcuts Reference

### Global Shortcuts
| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Quick Actions | `Cmd+K` | `Ctrl+K` |
| Settings | `Cmd+,` | `Ctrl+,` |
| New Tab | `Cmd+T` | `Ctrl+T` |
| Close Tab | `Cmd+W` | `Ctrl+W` |
| Next Tab | `Cmd+Shift+]` | `Ctrl+Tab` |
| Previous Tab | `Cmd+Shift+[` | `Ctrl+Shift+Tab` |
| Search | `Cmd+F` | `Ctrl+F` |
| Refresh | `Cmd+R` | `Ctrl+R` |

### Workspace Shortcuts
| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Switch Workspace 1-9 | `Cmd+1-9` | `Ctrl+1-9` |
| Next Workspace | `Cmd+Shift+Right` | `Ctrl+Shift+Right` |
| Previous Workspace | `Cmd+Shift+Left` | `Ctrl+Shift+Left` |
| New Workspace | `Cmd+Shift+N` | `Ctrl+Shift+N` |

### Email Shortcuts
| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Compose | `Cmd+N` | `Ctrl+N` |
| Reply | `Cmd+R` | `Ctrl+R` |
| Reply All | `Cmd+Shift+R` | `Ctrl+Shift+R` |
| Forward | `Cmd+F` | `Ctrl+F` |
| Send | `Cmd+Enter` | `Ctrl+Enter` |
| Archive | `E` | `E` |
| Delete | `Delete` | `Delete` |
| Star | `S` | `S` |

### Calendar Shortcuts
| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| New Event | `Cmd+N` | `Ctrl+N` |
| Today | `Cmd+T` | `Ctrl+T` |
| Previous Period | `Left Arrow` | `Left Arrow` |
| Next Period | `Right Arrow` | `Right Arrow` |
| Day View | `1` | `1` |
| Week View | `2` | `2` |
| Month View | `3` | `3` |
| Agenda View | `4` | `4` |

---

This comprehensive user guide covers all aspects of using Flow Desk effectively. For additional help, visit our documentation site or contact our support team.
