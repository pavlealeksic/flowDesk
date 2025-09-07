# Flow Desk API Reference

This document provides comprehensive API documentation for Flow Desk's main process, renderer process, and IPC communication protocols.

## Table of Contents

- [IPC API](#ipc-api)
- [WorkspaceManager API](#workspacemanager-api)
- [Redux Store API](#redux-store-api)
- [Component Props](#component-props)
- [Type Definitions](#type-definitions)
- [Error Types](#error-types)

## IPC API

The IPC API provides secure communication between the main and renderer processes through the preload script.

### Workspace Operations

#### `window.flowDesk.workspace.create(data)`

Creates a new workspace with the specified configuration.

**Parameters:**
- `data` (object): Workspace configuration
  - `name` (string): Human-readable workspace name
  - `icon?` (string): Optional custom icon URL or file path
  - `color` (string): Hex color code for workspace theming
  - `browserIsolation?` ('shared' | 'isolated'): Data isolation strategy

**Returns:** `Promise<string>` - The created workspace ID

**Example:**
```typescript
const workspaceId = await window.flowDesk.workspace.create({
  name: 'Development Team',
  color: '#4285f4',
  browserIsolation: 'isolated'
});
```

**Throws:**
- `Error` - If workspace name is invalid or creation fails

---

#### `window.flowDesk.workspace.list()`

Retrieves all workspaces.

**Returns:** `Promise<Workspace[]>` - Array of workspace objects

**Example:**
```typescript
const workspaces = await window.flowDesk.workspace.list();
console.log(`Found ${workspaces.length} workspaces`);
```

---

#### `window.flowDesk.workspace.get(id)`

Retrieves a specific workspace by ID.

**Parameters:**
- `id` (string): Workspace ID

**Returns:** `Promise<Workspace | null>` - Workspace object or null if not found

**Example:**
```typescript
const workspace = await window.flowDesk.workspace.get('workspace-id');
if (workspace) {
  console.log(`Workspace: ${workspace.name}`);
}
```

---

#### `window.flowDesk.workspace.getCurrent()`

Gets the currently active workspace.

**Returns:** `Promise<Workspace | null>` - Current workspace or null

**Example:**
```typescript
const currentWorkspace = await window.flowDesk.workspace.getCurrent();
```

---

#### `window.flowDesk.workspace.switch(id)`

Switches to a different workspace.

**Parameters:**
- `id` (string): Workspace ID to switch to

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.flowDesk.workspace.switch('workspace-id');
```

---

#### `window.flowDesk.workspace.update(id, updates)`

Updates workspace properties.

**Parameters:**
- `id` (string): Workspace ID
- `updates` (Partial<Workspace>): Properties to update

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.flowDesk.workspace.update('workspace-id', {
  name: 'Updated Name',
  color: '#ff6b6b'
});
```

---

#### `window.flowDesk.workspace.delete(id)`

Deletes a workspace and all its services.

**Parameters:**
- `id` (string): Workspace ID to delete

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.flowDesk.workspace.delete('workspace-id');
```

### Service Operations

#### `window.flowDesk.workspace.addService(workspaceId, name, type, url)`

Adds a new service to a workspace.

**Parameters:**
- `workspaceId` (string): Target workspace ID
- `name` (string): Service display name
- `type` (string): Service type (e.g., 'slack', 'github')
- `url` (string): Service URL

**Returns:** `Promise<string>` - The created service ID

**Example:**
```typescript
const serviceId = await window.flowDesk.workspace.addService(
  'workspace-id',
  'Team Slack',
  'slack',
  'https://team.slack.com'
);
```

---

#### `window.flowDesk.workspace.removeService(workspaceId, serviceId)`

Removes a service from a workspace.

**Parameters:**
- `workspaceId` (string): Workspace ID
- `serviceId` (string): Service ID to remove

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.flowDesk.workspace.removeService('workspace-id', 'service-id');
```

---

#### `window.flowDesk.workspace.loadService(workspaceId, serviceId)`

Loads a service in a browser view.

**Parameters:**
- `workspaceId` (string): Workspace ID
- `serviceId` (string): Service ID to load

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.flowDesk.workspace.loadService('workspace-id', 'service-id');
```

### Browser View Control

#### `window.flowDesk.browserView.hide()`

Hides the currently visible browser view.

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.flowDesk.browserView.hide();
```

---

#### `window.flowDesk.browserView.show()`

Shows the current browser view if one is loaded.

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.flowDesk.browserView.show();
```

### Theme Operations

#### `window.flowDesk.theme.get()`

Gets current theme settings.

**Returns:** `Promise<ThemeSettings>`

**Example:**
```typescript
const theme = await window.flowDesk.theme.get();
console.log(`Current theme: ${theme.mode}`);
```

---

#### `window.flowDesk.theme.set(settings)`

Updates theme settings.

**Parameters:**
- `settings` (ThemeSettings): New theme configuration

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.flowDesk.theme.set({
  mode: 'dark',
  accentColor: '#4285f4',
  fontSize: 16
});
```

### System Integration

#### `window.flowDesk.system.showNotification(options)`

Shows a system notification.

**Parameters:**
- `options` (NotificationOptions): Notification configuration
  - `title` (string): Notification title
  - `body?` (string): Optional notification body
  - `icon?` (string): Optional icon URL
  - `silent?` (boolean): Whether to play sound

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.flowDesk.system.showNotification({
  title: 'Workspace Switched',
  body: 'Now viewing Development workspace',
  silent: false
});
```

---

#### `window.flowDesk.system.openExternal(url)`

Opens a URL in the default system browser.

**Parameters:**
- `url` (string): URL to open

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.flowDesk.system.openExternal('https://github.com');
```

## WorkspaceManager API

The `WorkspaceManager` class provides the core workspace management functionality in the main process.

### Class: WorkspaceManager

**Extends:** `EventEmitter`

#### Constructor

```typescript
new WorkspaceManager()
```

Creates a new WorkspaceManager instance, initializes data storage, and loads existing workspaces.

#### Methods

##### `setMainWindow(window: BrowserWindow): void`

**Description:** Set the main Electron window and configure browser view management

**Parameters:**
- `window` (BrowserWindow): The main Electron window

**Example:**
```typescript
const workspaceManager = new WorkspaceManager();
workspaceManager.setMainWindow(mainWindow);
```

##### `createWorkspace(data): Promise<Workspace>`

**Description:** Create a new workspace with the specified configuration

**Parameters:**
- `data` (object): Workspace configuration
  - `name` (string): Human-readable workspace name
  - `icon?` (string): Optional custom icon URL or file path
  - `color` (string): Hex color code for workspace theming
  - `browserIsolation?` ('shared' | 'isolated'): Data isolation strategy

**Returns:** `Promise<Workspace>` - The created workspace object

**Fires:** `workspace-created` event

##### `getWorkspaces(): Promise<Workspace[]>`

**Description:** Get all workspaces

**Returns:** `Promise<Workspace[]>` - Array of workspace objects

##### `getWorkspace(id: string): Promise<Workspace | null>`

**Description:** Get a specific workspace by ID

**Parameters:**
- `id` (string): Workspace ID

**Returns:** `Promise<Workspace | null>` - Workspace object or null

##### `switchWorkspace(id: string): Promise<void>`

**Description:** Switch to a different workspace

**Parameters:**
- `id` (string): Workspace ID to switch to

**Fires:** `workspace-switched` event

##### `updateWorkspace(id: string, updates: Partial<Workspace>): Promise<void>`

**Description:** Update workspace properties

**Parameters:**
- `id` (string): Workspace ID
- `updates` (Partial<Workspace>): Properties to update

**Fires:** `workspace-updated` event

##### `deleteWorkspace(id: string): Promise<void>`

**Description:** Delete a workspace and all its services

**Parameters:**
- `id` (string): Workspace ID to delete

**Fires:** `workspace-deleted` event

##### `createService(workspaceId: string, name: string, type: string, url: string): Promise<string>`

**Description:** Create a new service within a workspace

**Parameters:**
- `workspaceId` (string): Target workspace ID
- `name` (string): Service display name
- `type` (string): Service type identifier
- `url` (string): Service URL

**Returns:** `Promise<string>` - The created service ID

**Fires:** `service-created` event

##### `deleteService(workspaceId: string, serviceId: string): Promise<void>`

**Description:** Delete a service from a workspace

**Parameters:**
- `workspaceId` (string): Workspace ID
- `serviceId` (string): Service ID to delete

**Fires:** `service-deleted` event

##### `loadService(workspaceId: string, serviceId: string): Promise<void>`

**Description:** Load a service in a browser view with proper isolation and security

**Parameters:**
- `workspaceId` (string): ID of the workspace containing the service
- `serviceId` (string): ID of the service to load

**Fires:** `service-loaded` event

##### `hideBrowserView(): void`

**Description:** Hide the currently visible browser view

##### `showBrowserView(): void`

**Description:** Show the current browser view if one is loaded

#### Events

The WorkspaceManager emits the following events:

##### `workspace-created`

**Parameters:**
- `workspace` (Workspace): The created workspace object

##### `workspace-deleted`

**Parameters:**
- `workspaceId` (string): ID of the deleted workspace

##### `workspace-switched`

**Parameters:**
- `workspaceId` (string): ID of the newly active workspace

##### `workspace-updated`

**Parameters:**
- `workspaceId` (string): ID of the updated workspace
- `workspace` (Workspace): Updated workspace object

##### `service-created`

**Parameters:**
- `workspaceId` (string): ID of the containing workspace
- `service` (WorkspaceService): The created service object

##### `service-deleted`

**Parameters:**
- `workspaceId` (string): ID of the containing workspace
- `serviceId` (string): ID of the deleted service

##### `service-loaded`

**Parameters:**
- `workspaceId` (string): ID of the containing workspace
- `serviceId` (string): ID of the loaded service

##### `workspace-data-cleared`

**Parameters:**
- `workspaceId` (string): ID of the workspace whose data was cleared

## Redux Store API

The Redux store manages application state using Redux Toolkit.

### Workspace Slice

#### State Structure

```typescript
interface WorkspaceState {
  workspaces: Record<string, WorkspaceData>;
  currentWorkspaceId: string | null;
  partitions: Record<string, WorkspacePartitionConfig>;
  windows: Record<string, WorkspaceWindow[]>;
  isLoading: boolean;
  error: string | null;
  syncStatus: {
    isSync: boolean;
    lastSync: string | null;
    error: string | null;
  };
}
```

#### Actions

##### `loadWorkspaces()`

**Description:** Load all workspaces from the main process

**Returns:** `AsyncThunk<WorkspaceLoadResult, void>`

**Example:**
```typescript
dispatch(loadWorkspaces());
```

##### `switchWorkspace(workspaceId: string)`

**Description:** Switch to a different workspace

**Parameters:**
- `workspaceId` (string): Workspace ID to switch to

**Returns:** `AsyncThunk<string, string>`

**Example:**
```typescript
dispatch(switchWorkspace('workspace-id'));
```

##### `createWorkspace(workspace)`

**Description:** Create a new workspace

**Parameters:**
- `workspace` (Omit<WorkspaceData, 'createdAt' | 'updatedAt'>): Workspace data

**Returns:** `AsyncThunk<WorkspaceCreationResult, WorkspaceData>`

**Example:**
```typescript
dispatch(createWorkspace({
  name: 'New Workspace',
  color: '#4285f4'
}));
```

##### `updateWorkspace({workspaceId, updates})`

**Description:** Update workspace properties

**Parameters:**
- `workspaceId` (string): Workspace ID
- `updates` (Partial<WorkspaceData>): Properties to update

**Returns:** `AsyncThunk<UpdateResult, UpdateParams>`

**Example:**
```typescript
dispatch(updateWorkspace({
  workspaceId: 'workspace-id',
  updates: { name: 'Updated Name' }
}));
```

##### `deleteWorkspace(workspaceId: string)`

**Description:** Delete a workspace

**Parameters:**
- `workspaceId` (string): Workspace ID to delete

**Returns:** `AsyncThunk<string, string>`

**Example:**
```typescript
dispatch(deleteWorkspace('workspace-id'));
```

#### Selectors

##### `selectAllWorkspaces(state)`

**Description:** Select all workspaces as an array

**Returns:** `Workspace[]`

##### `selectCurrentWorkspace(state)`

**Description:** Select the currently active workspace

**Returns:** `Workspace | null`

##### `selectWorkspaceById(id)`

**Description:** Create a selector for a specific workspace

**Parameters:**
- `id` (string): Workspace ID

**Returns:** `(state) => Workspace | null`

##### `selectWorkspaceLoading(state)`

**Description:** Select loading state

**Returns:** `boolean`

##### `selectWorkspaceError(state)`

**Description:** Select error state

**Returns:** `string | null`

## Component Props

### FlowDeskLeftRail Props

```typescript
interface FlowDeskLeftRailProps {
  onWorkspaceSelect: (workspaceId: string) => void;
  activeWorkspaceId?: string;
}
```

### ServicesSidebar Props

```typescript
interface ServicesSidebarProps {
  workspaceId?: string;
  workspaceName?: string;
  services: Service[];
  activeServiceId?: string;
  onServiceSelect: (serviceId: string) => void;
  onAddService: () => void;
  onEditService?: (serviceId: string) => void;
  onDeleteService?: (serviceId: string) => void;
  onEditWorkspace?: (workspaceId: string) => void;
  onWorkspaceSettings?: (workspaceId: string) => void;
  className?: string;
}
```

## Type Definitions

### Core Types

#### Workspace

```typescript
interface Workspace {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  icon?: string;
  browserIsolation: 'shared' | 'isolated';
  services: WorkspaceService[];
  members?: string[];
  created: Date;
  lastAccessed: Date;
  isActive: boolean;
}
```

#### WorkspaceService

```typescript
interface WorkspaceService {
  id: string;
  name: string;
  type: string;
  url: string;
  iconUrl?: string;
  isEnabled: boolean;
  config: {
    webviewOptions?: WebviewOptions;
    customHeaders?: Record<string, string>;
    userAgent?: string;
  };
}
```

#### WebviewOptions

```typescript
interface WebviewOptions {
  partition?: string;
  allowExternalUrls?: boolean;
  nodeIntegration?: boolean;
  contextIsolation?: boolean;
  webSecurity?: boolean;
}
```

#### ThemeSettings

```typescript
interface ThemeSettings {
  mode: 'light' | 'dark' | 'system';
  accentColor: string;
  fontSize: number;
}
```

#### NotificationOptions

```typescript
interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  silent?: boolean;
}
```

## Error Types

### WorkspaceError

```typescript
class WorkspaceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'WorkspaceError';
  }
}
```

**Common Error Codes:**
- `WORKSPACE_NOT_FOUND` - Workspace ID does not exist
- `SERVICE_NOT_FOUND` - Service ID does not exist
- `INVALID_WORKSPACE_DATA` - Workspace data validation failed
- `MAIN_WINDOW_NOT_SET` - Main window not configured
- `BROWSER_VIEW_CREATION_FAILED` - Failed to create browser view

### ValidationError

```typescript
class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

**Common Cases:**
- Invalid URL format
- Invalid color format
- Missing required fields
- Exceeds maximum length

---

This API reference provides comprehensive documentation for all public interfaces in Flow Desk. For implementation details, refer to the source code and architecture documentation.