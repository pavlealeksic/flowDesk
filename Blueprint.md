# Flow Desk - Product Vision

**Flow Desk** is a privacy‑first, cross‑platform "work OS" that ships with **Mail + Calendar by default** and provides a secure, sandboxed **plugin ecosystem** (Slack, Teams, Notion, Zoom, etc.). Users get desktop (Electron), mobile (React Native), and a Next.js server for website, licensing, and user dashboard.

**Hard requirements:**

* Monorepo with:

  * `mobile-app/` → **React Native** (iOS/Android)
  * `desktop-app/` → **Electron** (macOS/Windows/Linux)
  * `server/` → **Next.js** (website, dashboard, licensing, billing, plugin registry)
  * `shared/` → Rust + TS shared services, types, SDKs
* **Local-first config sync**: Encrypted file-based sync via user-controlled storage (iCloud, OneDrive, Dropbox, Google Drive, LAN). No central server required.
* **Clerk** for user management (auth flows, team accounts, sessions).
* All core engines (mail, calendar, search, plugin runtime) are shared and engine-agnostic.

---

# Repository & Project Structure

```
root/
 ├─ mobile-app/     # React Native app (iOS/Android)
 ├─ desktop-app/    # Electron app (macOS/Windows/Linux)
 ├─ server/         # Next.js (website, dashboard, licensing, plugins)
 ├─ shared/         # Shared models, Rust engines, TS SDKs
```

---

# Config & Sync

* **Local‑first config only** by default. No central server is required for single‑user setups.
* **What syncs**: workspaces, app lists, plugin settings, rules/filters, keybindings, UI prefs. **What doesn’t** (by default): mail bodies/files/content.
* **Storage format**: `config.json` + encrypted `secrets.bin` (schema‑versioned). Secrets wrapped with device keys; decrypted only in memory.
* **Crypto**: X25519 device key pairs; a per‑account **Workspace Sync Key** encrypts config; E2E via libsodium sealed boxes.
* **Transports (choose any)**:

  * **Cloud‑folder sync**: iCloud, OneDrive, Dropbox, Google Drive (provider is untrusted storage; files are E2E‑encrypted).
  * **LAN sync**: mDNS discovery + WebRTC datachannel; E2E; never leaves LAN.
  * **Import/Export**: Encrypted archive (`.workosync`) + QR pairing.
* **Conflicts**: vector clocks + per‑section merge UI.
* **Future (optional upgrade)**: relay service for convenience (still E2E); not required for MVP.

---

# Personas & Jobs-to-be-Done

* **Agencies/Freelancers**: multiple client mail/slack/teams.
* **Ops/Support**: dashboards, alerts in unified notifications.
* **Founders/ICs**: schedule, triage, automation.

---

# Flagship Features

## 1) Workspaces & Containers

* Chromium partitions per workspace.
* Proxy, UA, extension, ephemeral mode per workspace.

## 2) Mail Engine

* Gmail API, Microsoft Graph, generic IMAP/SMTP.
* Rust service with Maildir cache + SQLite metadata.
* Filters, snooze, follow-ups, signatures, PGP/S-MIME.
* Rich compose editor with templates, undo/delay send.

## 3) Calendar Engine

* Google, Microsoft Graph, CalDAV.
* Views: Day/Week/Month/Agenda, NL quick add.
* Free/busy overlay, meeting links, proposals.

## 4) Unified Search

* Rust Tantivy index: mail, events, files, chats.
* Providers: Gmail, Graph, Slack, Teams, Notion, Asana, Jira, Zoom, Drive, OneDrive.
* <300ms local results.

## 5) Notifications Hub

* Central pane; rules, digests, DND.
* Bundling, focus sessions.

## 6) Service Integration Architecture

**Core Services (Protocol-Based - Apple Mail Approach):**
* **Mail Engine**: Universal IMAP/SMTP with predefined configs for easy setup
* **Calendar Engine**: Universal CalDAV with predefined configs for easy setup

**Predefined Mail Server Configurations:**
* **Gmail**: imap.gmail.com:993/smtp.gmail.com:587 (OAuth2 or App Passwords)
* **Outlook/Hotmail**: outlook.office365.com:993/smtp-mail.outlook.com:587
* **Yahoo Mail**: imap.mail.yahoo.com:993/smtp.mail.yahoo.com:587
* **ProtonMail**: 127.0.0.1:1143 (via ProtonMail Bridge)
* **FastMail**: imap.fastmail.com:993/smtp.fastmail.com:587
* **iCloud Mail**: imap.mail.me.com:993/smtp.mail.me.com:587
* **Custom IMAP**: Manual server configuration for any provider

**Predefined Calendar Server Configurations:**
* **Google Calendar**: caldav.google.com/calendar/dav (OAuth2)
* **iCloud Calendar**: caldav.icloud.com:443
* **Exchange/Outlook**: Exchange Web Services or CalDAV endpoint
* **FastMail Calendar**: caldav.fastmail.com:443
* **Custom CalDAV**: Manual server configuration

**Web Services (Chrome Browser Instances):**
* **Messaging/Collab**: Slack, Teams, Discord, WhatsApp, Telegram, Signal - Browser instances in Chromium partitions
* **Docs/PM**: Notion, Confluence, Asana, Trello, Jira, ClickUp, Linear, Monday - Browser instances
* **Cloud Storage**: Google Drive, OneDrive, Dropbox, Box - Browser instances
* **Meetings**: Zoom, Meet, Webex, Teams Meetings - Browser instances
* **Dev Tools**: GitHub, GitLab, Bitbucket - Browser instances
* **CRM/Support**: HubSpot, Salesforce, Zendesk, Intercom - Browser instances

**Benefits of Browser Approach:**
* No API version breaking changes or maintenance
* Always up-to-date web interfaces from providers
* No complex OAuth flows for individual services
* Automatic feature updates from service providers
* Better security isolation per service
* Simplified development and maintenance
* Users get the full web experience they're familiar with
* **Social/Marketing**: Twitter/X, LinkedIn, Meta Pages, Mailchimp.
* **Other**: Todoist, Evernote, Figma, Miro.

## 7) Automations & Quick Actions

* Recipe engine: trigger + actions.
* Example: “When email starred → create Jira issue.”
* Logs, retries, Cmd-K integration.

## 8) Privacy & Security

* Tokens in OS keychains.
* System browser OAuth + PKCE.
* Transparent permissions ledger.

## 9) AI-Powered Workflow Intelligence

* **Smart Email Triage**: AI categorizes emails by urgency, context, and required actions.
* **Meeting Insights**: Automatic meeting summaries, action items extraction, and follow-up suggestions.
* **Context Switching**: AI understands your work context and suggests relevant apps/documents when switching between tasks.
* **Smart Scheduling**: AI suggests optimal meeting times based on energy patterns and workload analysis.

## 10) Advanced Productivity Features

* **Focus Sessions**: Pomodoro timer with app blocking, distraction filtering, and productivity tracking.
* **Workspace Presets**: Save and restore entire workspace states (open apps, layouts, configurations) for different projects.
* **Smart Notifications**: ML-based notification filtering that learns from your response patterns.
* **Universal Clipboard**: Encrypted clipboard sync across all devices with rich content support (images, files, formatted text).

## 11) Collaboration & Team Features

* **Team Spaces**: Shared workspaces with role-based access, team calendars, and collaborative dashboards.
* **Status Sync**: Automatic status updates across platforms based on calendar and activity.
* **Meeting Room Integration**: Smart meeting room booking with equipment status and availability.
* **Team Analytics**: Privacy-respecting team productivity insights and collaboration patterns.

---

# Official Plugin Catalog (v1→v2)

**All plugins are first‑class and ship as signed packages.** Each plugin declares scopes, UI (if any), automations, and search contributions. Some are **connector‑only** (no UI), others expose Panels/Views.

## Communication & Meetings

* **Slack** (DMs, channels, mentions, unread badges, message actions)
* **Microsoft Teams** (chats/teams/unreads, meetings join)
* **Discord** (DMs/servers/unreads)
* **Telegram** (personal + work numbers via multi‑session)
* **WhatsApp** (multi‑account via workspaces)
* **Signal** (where desktop/web is available)
* **Zoom** (meetings, recordings, schedule)
* **Google Meet** (schedule/join, recordings metadata)
* **Webex** (meetings)
* **Calendly / Cal.com** (availability links, booking management)

## Mail/Calendar Providers (beyond core)

* **Fastmail** (IMAP/CalDAV presets)
* **Proton Mail/Calendar** (bridge support where available)
* **Yahoo/AOL** (IMAP presets)

## Project & Issue Tracking

* **Jira**, **Asana**, **Trello**, **Linear**, **ClickUp**, **YouTrack**, **Monday.com**

## Dev & CI/CD

* **GitHub**, **GitLab**, **Bitbucket** (notifications, PRs, issues)
* **Jenkins**, **CircleCI**, **GitHub Actions** (builds, artifacts)
* **Sentry**, **Bugsnag** (errors), **Datadog**, **New Relic**, **Elastic**, **Grafana/Prometheus** (alerts/dashboards)
* **PagerDuty**, **Opsgenie** (on‑call alerts; ack from Cmd‑K)

## Docs, Notes & Files

* **Notion**, **Confluence**, **Coda**, **Evernote**, **Obsidian (read‑only via vault export)**
* **Google Drive/Docs/Sheets/Slides**, **OneDrive/SharePoint**, **Dropbox**, **Box** (browse, quick open, search metadata)

## CRM, Sales & Support

* **Salesforce**, **HubSpot**, **Pipedrive**, **Zoho CRM**
* **Zendesk**, **Freshdesk**, **Intercom**, **Help Scout**

## Marketing & Comms

* **Mailchimp**, **SendGrid**, **Brevo (Sendinblue)**, **Customer.io**
* **Hootsuite/Buffer** (queues, approvals)

## Finance & Payments

* **Stripe** (dashboard shortcuts, alerts), **Paddle**
* **QuickBooks Online**, **Xero** (notifications)

## Cloud & Infra

* **AWS Console**, **Azure Portal**, **Google Cloud Console** (bookmarks, service shortcuts, auth profiles)
* **Cloudflare**, **Vercel**, **Netlify**, **Fly.io**, **Heroku**

## Time & Productivity

* **Toggl Track**, **Harvest**, **RescueTime**/**Rize** (focus stats)
* **Todoist**, **Things 3** (where API/web), **Microsoft To Do**

## AI & Tools

* **ChatGPT**, **Claude**, **Gemini** (web panels, quick prompts)
* **Readwise**, **Raycast AI** hooks (connector‑only)
* **GitHub Copilot**, **Cursor AI** (code assistance integration)
* **Perplexity**, **You.com** (research and search enhancement)

## Password Managers (lightweight helpers)

* **1Password**, **Bitwarden** (unlock signal + quick‑fill handoff; no secrets stored by us)

## Social & Messaging (lightweight)

* **LinkedIn**, **X (Twitter)**, **Facebook Pages** (notifications; open‑in‑app)

> All plugins provide: unread/badge hooks, Cmd‑K actions, notification routing, optional automation triggers/actions, and search metadata contributions where API allows.

---

# Server App (Next.js)

* **Website/Docs**: marketing pages, docs, downloads (SSR for SEO).
* **Auth & User Management**: **Clerk** for signup/login, sessions, orgs/teams, MFA. (The desktop/mobile apps use Clerk tokens only for our portal; provider tokens for Gmail/Slack/etc. never touch this server.)
* **Billing & Licensing**: Stripe checkout; signed, offline‑verifiable licenses; device/seat management; webhooks to update entitlements.
* **Dashboard**: manage licenses, devices, plugin purchases, invoices.
* **Plugin Registry**: upload/signed plugin packages, versioning, changelogs; per‑plugin licensing hooks.
* **Privacy**: No mail/calendar/chat content processed; no third‑party provider refresh tokens stored.

---

# UI Design

## Layout Structure

**Primary Sidebar (Far Left):**
* **Mail Button** - Global mail client view (above workspace list)
* **Calendar Button** - Global calendar view (above workspace list)  
* **Workspace List** - Small squares with 2-letter workspace abbreviations (e.g., "WK" for Work, "PR" for Personal)
* **Add Workspace** - Plus button at bottom

**Secondary Sidebar (Service List):**
* Shows services configured for the selected workspace only
* Service icons with names (Slack, Notion, GitHub, etc.)
* Each service opens as Chrome browser instance in main view
* Add Service button for current workspace

**Main View Area:**
* **Mail View**: Traditional 3-pane email client (folders tree, message list, message content) - Real Gmail/Outlook API
* **Calendar View**: Calendar interface with multiple views (day/week/month) - Real Google Calendar API  
* **Service Views**: Chrome browser instances for web services (Slack, Notion, Jira, etc.) - No API maintenance needed

**Key Features:**
* Workspace isolation - each workspace has its own set of configured services
* Global mail/calendar access from any workspace context
* Browser-based services for maximum compatibility and auto-updates
* Clean, focused interface per workspace with service organization

---

# Implementation Phases

## M0 — Monorepo Skeleton

* Scaffold `mobile-app`, `desktop-app`, `server`, `shared`.
* Electron shell, RN shell, Next.js skeleton.
* Config sync MVP.

## M1 — Mail & Calendar Core

* Rust mail/calendar engines; desktop+mobile UIs.
* Local sync and indexing.

## M2 — Plugins & Search

* Plugin SDK/runtime.
* Build initial plugins (Slack, Teams, Notion, Asana, Drive, Zoom).
* Unified search with provider connectors.

## M3 — Notifications & Automations

* Notifications hub.
* Recipe runner with sample automations.

## M4 — Server Expansion

* Stripe billing, Clerk auth.
* Dashboard (licenses/devices/teams).
* Plugin registry.

---

# Next Steps

1. Scaffold repo with folders.
2. Implement Rust engines + Node/RN bridges.
3. Implement local-only config sync lib.
4. Build Mail+Calendar MVP.
5. Stand up Next.js server with Clerk + Stripe.
6. Implement first plugins.
7. Iterate on search, notifications, automations.

---

# Calendar Feature: Cross‑Calendar Privacy Sync

**Goal:** With one click, mirror events from one calendar to another as privacy‑safe “busy blocks.” By default, the copied event title is **“Private”** (customizable), and sensitive details are stripped.

## What It Does

* **Source → Target calendars**: User selects one or more **source calendars** and one or more **target calendars** across providers (Google, Microsoft 365/Graph, CalDAV).
* **Copy as busy block**: For each event on a source calendar, create/update a corresponding event on the target calendar(s) with:

  * **Title**: default "Private" or user‑defined template (e.g., "Busy", "Hold", or template like `{{emoji}} {{label}}`).
  * **Visibility**: set to *busy*; **strip description, attendees, attachments, conferencing links, and location** by default.
  * **Time**: same start/end; keep all‑day flag; respect time zones.
  * **Recurrence**: mirror recurring rules; propagate exceptions (edits to single instances).
* **Bi‑directional option** (off by default): Advanced users can turn on reverse‑sync for specific pairs.

## Advanced Mode (Per‑Event Prompt)

* A checkbox **“Advanced mode: confirm each event”** switches the workflow to interactive:

  * For each new/changed event detected, show a **preview dialog** with: time, source title, sanitized target title, and target calendar(s).
  * Per‑event controls: **Skip**, **Copy once**, **Always copy similar** (creates a rule), **Edit target title** for this instance.

## Title Controls

* **Default title**: "Private" (editable in settings).
* **Custom title field**: user can set a static replacement or a template with allowed tokens:

  * Allowed tokens (non‑revealing): `{{free_busy}}`, `{{duration}}`, `{{workspace}}`, `{{emoji}}`.
  * No source content tokens (to prevent leakage).

## Conflict & Idempotency

* Each mirrored event stores a hidden **sync marker** in target (extended properties) with `sourceCalendarId`, `sourceEventId`, `hash`.
* Updates only if `hash` changes; safe on re‑runs; **never duplicates**.
* **Deletions**: if source event is deleted/cancelled → delete the mirrored target event (or mark as free if configured).

## Recurring & Exceptions

* Propagate RRULE/EXDATE/RECURRENCE‑ID.
* If a single instance changes time, only that instance’s mirror updates.
* If a series title changes and a static target title is used, **do not** surface the change (privacy). If using an allowed token template, apply accordingly.

## Filtering & Windows

* Sync window: configurable (e.g., next 60 days + past 7 days). Rolling background task.
* Filters: only work hours, only specific labels/colors, exclude all‑day, minimum duration, etc.

## Provider Details

* **Google Calendar**: use Events with `visibility=private` and extendedProperties for sync markers.
* **Microsoft 365/Graph**: use categories for internal markers (if needed) and `isPrivate`/`sensitivity=private` equivalents.
* **CalDAV**: store X‑PROPERTY for sync markers in VEVENT; ensure servers preserve custom props.

## UX

* Settings → **Privacy Sync**: pick sources/targets, title template, filters, window, and **Advanced mode** toggle.
* **Cmd‑K action**: “Sync my calendars now.”
* Status toasts and a small **activity log** with Undo for last N operations.

## Offline & Errors

* Works offline (queued writes); retries with backoff on provider rate limits.
* Clear error badges with details; never exposes source content to targets.

## Tests (Acceptance)

* Create event on source → target gets busy block titled per template within 5s (or next sync tick).
* Edit time on source → target updates; title remains privacy‑safe.
* Delete source → target deleted.
* Recurring + exception case mirrors correctly.
* Advanced mode prompts per event; choices respected.

