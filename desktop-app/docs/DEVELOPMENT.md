# Development Guide

This guide covers everything developers need to know to set up, build, test, and contribute to Flow Desk.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Building the Application](#building-the-application)
- [Testing Strategy](#testing-strategy)
- [Debugging](#debugging)
- [Adding Features](#adding-features)
- [Performance Optimization](#performance-optimization)
- [Deployment](#deployment)

## Getting Started

### Prerequisites

Before starting development, ensure you have:

- **Node.js 18+**: Download from [nodejs.org](https://nodejs.org)
- **npm 8+** or **yarn 1.22+**: Comes with Node.js
- **Git**: For version control
- **VS Code**: Recommended IDE with extensions (see below)

### System-Specific Requirements

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Verify installation
node --version  # Should be 18+
npm --version   # Should be 8+
```

#### Windows
```bash
# Install Visual Studio Build Tools or Visual Studio Community
# Download from: https://visualstudio.microsoft.com/downloads/

# Install Windows SDK (required for native modules)
```

#### Linux (Ubuntu/Debian)
```bash
# Install build essentials
sudo apt update
sudo apt install build-essential libnss3-dev libatk-bridge2.0-dev libdrm2-dev libxcomposite-dev libxdamage-dev libxrandr-dev libgbm-dev libxss1 libasound2-dev
```

### Repository Setup

```bash
# Clone the repository
git clone <repository-url>
cd flowDesk/desktop-app

# Install dependencies
npm install

# Verify installation
npm run type-check
```

### Recommended VS Code Extensions

Add to `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "formulahendry.auto-rename-tag",
    "ms-playwright.playwright"
  ]
}
```

## Development Environment

### Environment Variables

Create `.env.local` for development configuration:

```bash
# Development settings
NODE_ENV=development
ELECTRON_IS_DEV=true

# Debug settings
DEBUG=flow-desk:*
ELECTRON_ENABLE_LOGGING=true

# Performance monitoring
REACT_APP_PERFORMANCE_MONITORING=true
```

### Development Scripts

```bash
# Start development server (hot reload)
npm run dev

# Start development with debugging
npm run dev:debug

# Build for development
npm run build:dev

# Type checking (watch mode)
npm run type-check:watch

# Linting (watch mode)
npm run lint:watch
```

### Project Structure Deep Dive

```
desktop-app/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts          # Application entry point
│   │   ├── workspace.ts     # Workspace management
│   │   ├── security-config.ts # Security policies
│   │   ├── notification-manager.ts # System notifications
│   │   └── constants/       # Main process constants
│   ├── renderer/            # React application
│   │   ├── App.tsx         # Root component
│   │   ├── store/          # Redux store configuration
│   │   │   ├── index.ts    # Store setup
│   │   │   └── slices/     # Redux slices
│   │   ├── components/     # React components
│   │   │   ├── ui/         # Reusable UI components
│   │   │   ├── layout/     # Layout components
│   │   │   └── workspace/  # Workspace-specific components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── contexts/       # React contexts
│   │   └── utils/          # Utility functions
│   ├── preload/            # Preload scripts
│   │   └── preload.ts      # IPC API definitions
│   └── types/              # TypeScript definitions
├── docs/                   # Documentation
├── assets/                 # Static assets
├── build/                  # Build output
└── dist/                   # Distribution packages
```

## Building the Application

### Development Build

```bash
# Build all components
npm run build

# Build main process only
npm run build:main

# Build renderer only
npm run build:renderer

# Build preload scripts
npm run build:preload
```

### Production Build

```bash
# Full production build
npm run build:production

# Create distribution packages
npm run dist

# Platform-specific builds
npm run dist:mac
npm run dist:win
npm run dist:linux
```

### Build Configuration

The build process uses several configuration files:

#### TypeScript Configuration

**`tsconfig.json`** (Renderer):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "types": ["node", "react", "react-dom"]
  },
  "include": ["src/renderer/**/*", "src/types/**/*"]
}
```

**`tsconfig.main.json`** (Main Process):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2020",
    "types": ["node", "electron"]
  },
  "include": ["src/main/**/*", "src/preload/**/*"]
}
```

#### Vite Configuration

**`vite.config.ts`** (Renderer):
```typescript
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/renderer',
    sourcemap: true,
    rollupOptions: {
      external: ['electron']
    }
  }
});
```

## Testing Strategy

### Test Structure

```
__tests__/
├── unit/                   # Unit tests
│   ├── main/              # Main process tests
│   ├── renderer/          # Renderer process tests
│   └── utils/             # Utility tests
├── integration/           # Integration tests
│   ├── workspace/         # Workspace integration tests
│   └── ipc/              # IPC communication tests
└── e2e/                  # End-to-end tests
    ├── workspace-flows/   # Complete workspace workflows
    └── service-management/ # Service management flows
```

### Unit Testing

#### Main Process Tests (Jest)

```typescript
// __tests__/unit/main/workspace.test.ts
import { WorkspaceManager } from '../../../src/main/workspace';

describe('WorkspaceManager', () => {
  let manager: WorkspaceManager;

  beforeEach(() => {
    manager = new WorkspaceManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  test('should create workspace with valid data', async () => {
    const workspace = await manager.createWorkspace({
      name: 'Test Workspace',
      color: '#4285f4'
    });

    expect(workspace.id).toBeDefined();
    expect(workspace.name).toBe('Test Workspace');
    expect(workspace.abbreviation).toBe('TE');
  });
});
```

#### Renderer Tests (Vitest + Testing Library)

```typescript
// __tests__/unit/renderer/App.test.tsx
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../../../src/renderer/store';
import App from '../../../src/renderer/App';

const AppWithProvider = () => (
  <Provider store={store}>
    <App />
  </Provider>
);

test('renders workspace dashboard', () => {
  render(<AppWithProvider />);
  expect(screen.getByText(/workspace dashboard/i)).toBeInTheDocument();
});
```

### Integration Testing

```typescript
// __tests__/integration/workspace-ipc.test.ts
import { app, BrowserWindow } from 'electron';
import { WorkspaceManager } from '../../src/main/workspace';

describe('Workspace IPC Integration', () => {
  let mainWindow: BrowserWindow;
  let workspaceManager: WorkspaceManager;

  beforeAll(async () => {
    await app.whenReady();
    mainWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    workspaceManager = new WorkspaceManager();
    workspaceManager.setMainWindow(mainWindow);
  });

  afterAll(async () => {
    mainWindow.close();
    app.quit();
  });

  test('should handle workspace creation through IPC', async () => {
    // Test IPC communication flow
  });
});
```

### E2E Testing (Playwright)

```typescript
// __tests__/e2e/workspace-management.spec.ts
import { test, expect } from '@playwright/test';
import { ElectronApplication, Page, _electron as electron } from 'playwright';

test.describe('Workspace Management', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['dist/main.js']
    });
    page = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('should create new workspace', async () => {
    // Click add workspace button
    await page.click('[data-testid="add-workspace"]');
    
    // Fill workspace form
    await page.fill('[data-testid="workspace-name"]', 'E2E Test Workspace');
    await page.click('[data-testid="create-workspace"]');
    
    // Verify workspace appears
    await expect(page.locator('[data-testid="workspace-item"]')).toContainText('E2E Test Workspace');
  });
});
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Debugging

### Main Process Debugging

#### VS Code Configuration (`.vscode/launch.json`)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "runtimeArgs": ["--inspect=5858", "dist/main.js"],
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Debug Renderer Process",
      "type": "chrome",
      "request": "attach",
      "port": 9222,
      "webRoot": "${workspaceFolder}/src/renderer"
    }
  ]
}
```

#### Command Line Debugging

```bash
# Debug main process
npm run dev:main -- --inspect-brk=9229

# Debug with Chrome DevTools
node --inspect-brk=9229 dist/main.js

# Debug renderer in browser
npm run dev:renderer
# Open Chrome to http://localhost:5173
```

### Renderer Process Debugging

```bash
# Enable React DevTools
npm install -D @electron/remote react-devtools

# In development, press Cmd+Shift+I (macOS) or F12 (Windows/Linux)
```

### Debug Logging

```typescript
// Use structured logging
import { mainLoggingService } from './logging/LoggingService';

const logger = mainLoggingService.createLogger('WorkspaceManager');

logger.debug('Workspace data loaded', { count: workspaces.length });
logger.info('Workspace created', { workspaceId: workspace.id });
logger.error('Failed to create workspace', error);
```

### Performance Debugging

```bash
# Enable performance monitoring
export REACT_APP_PERFORMANCE_MONITORING=true
npm run dev

# Profile bundle size
npm run build:renderer:analyze

# Memory profiling
node --inspect --max-old-space-size=4096 dist/main.js
```

## Adding Features

### Adding a New Service Type

1. **Update Service Type Registry**

```typescript
// src/renderer/constants/serviceTypes.ts
export const SERVICE_TYPES = {
  slack: {
    name: 'Slack',
    icon: 'slack.svg',
    defaultUrl: 'https://app.slack.com',
    category: 'communication'
  },
  newService: {  // Add new service
    name: 'New Service',
    icon: 'new-service.svg',
    defaultUrl: 'https://newservice.com',
    category: 'productivity'
  }
};
```

2. **Add Service Icon**

```bash
# Add icon to assets
cp new-service.svg assets/service-icons/
```

3. **Update Service Configuration**

```typescript
// src/main/workspace.ts
private getServiceDefaults(type: string) {
  switch (type) {
    case 'newService':
      return {
        webviewOptions: {
          webSecurity: true,
          contextIsolation: true
        },
        customHeaders: {
          'User-Agent': 'FlowDesk/1.0'
        }
      };
    default:
      return {};
  }
}
```

### Adding a New Component

1. **Create Component File**

```typescript
// src/renderer/components/workspace/NewComponent.tsx
import React from 'react';

interface NewComponentProps {
  title: string;
  onAction: (id: string) => void;
}

export const NewComponent: React.FC<NewComponentProps> = ({
  title,
  onAction
}) => {
  return (
    <div className="new-component">
      <h2>{title}</h2>
      {/* Component implementation */}
    </div>
  );
};

export default NewComponent;
```

2. **Add Tests**

```typescript
// __tests__/unit/renderer/components/NewComponent.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import NewComponent from '../../../../src/renderer/components/workspace/NewComponent';

test('renders component with title', () => {
  const mockAction = jest.fn();
  render(<NewComponent title="Test Title" onAction={mockAction} />);
  
  expect(screen.getByText('Test Title')).toBeInTheDocument();
});
```

3. **Update Component Index**

```typescript
// src/renderer/components/index.ts
export { default as NewComponent } from './workspace/NewComponent';
```

### Adding Redux State

1. **Create Slice**

```typescript
// src/renderer/store/slices/newFeatureSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

interface NewFeatureState {
  data: any[];
  isLoading: boolean;
  error: string | null;
}

const initialState: NewFeatureState = {
  data: [],
  isLoading: false,
  error: null
};

export const fetchData = createAsyncThunk(
  'newFeature/fetchData',
  async () => {
    // API call implementation
  }
);

const newFeatureSlice = createSlice({
  name: 'newFeature',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchData.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.data = action.payload;
      })
      .addCase(fetchData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Unknown error';
      });
  }
});

export const { clearError } = newFeatureSlice.actions;
export default newFeatureSlice.reducer;
```

2. **Add to Store**

```typescript
// src/renderer/store/index.ts
import newFeatureReducer from './slices/newFeatureSlice';

export const store = configureStore({
  reducer: {
    workspace: workspaceReducer,
    theme: themeReducer,
    newFeature: newFeatureReducer  // Add new reducer
  }
});
```

### Adding IPC Endpoints

1. **Define API in Preload**

```typescript
// src/preload/preload.ts
const flowDeskAPI = {
  // Existing APIs...
  newFeature: {
    getData: (): Promise<any[]> =>
      ipcRenderer.invoke('newFeature:getData'),
    
    updateData: (id: string, data: any): Promise<void> =>
      ipcRenderer.invoke('newFeature:updateData', validateId(id), data)
  }
};
```

2. **Implement in Main Process**

```typescript
// src/main/main.ts
ipcMain.handle('newFeature:getData', async () => {
  try {
    // Implementation
    return data;
  } catch (error) {
    this.logger.error('Failed to get data', error);
    throw error;
  }
});

ipcMain.handle('newFeature:updateData', async (event, id: string, data: any) => {
  try {
    // Implementation
    this.logger.info('Data updated', { id });
  } catch (error) {
    this.logger.error('Failed to update data', error);
    throw error;
  }
});
```

## Performance Optimization

### Bundle Analysis

```bash
# Analyze bundle size
npm run build:renderer:analyze

# View bundle report
open dist/bundle-analysis.html
```

### Memory Optimization

```typescript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo<Props>(({ data }) => {
  return <div>{/* Expensive rendering */}</div>;
});

// Memoize expensive calculations
const memoizedValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);

// Cleanup effects
useEffect(() => {
  const timer = setInterval(() => {}, 1000);
  return () => clearInterval(timer);
}, []);
```

### Performance Monitoring

```typescript
// Enable performance monitoring in development
if (process.env.NODE_ENV === 'development') {
  import('./utils/performanceMonitor').then(({ startMonitoring }) => {
    startMonitoring();
  });
}
```

## Deployment

### Build Pipeline

```yaml
# .github/workflows/build.yml
name: Build and Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm test
      
  build:
    needs: test
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run dist
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ matrix.os }}
          path: build/
```

### Release Process

1. **Version Bump**

```bash
# Update version in package.json
npm version patch  # or minor/major

# Create git tag
git push origin --tags
```

2. **Build for All Platforms**

```bash
# macOS (requires macOS)
npm run dist:mac

# Windows (can build on any platform)
npm run dist:win

# Linux
npm run dist:linux
```

3. **Code Signing** (macOS)

```bash
# Set up certificates in keychain
export CSC_NAME="Developer ID Application: Your Name"
npm run dist:mac
```

### Distribution

```bash
# Upload to app stores or distribution platforms
# Configure auto-updater for seamless updates
```

---

This development guide provides comprehensive information for contributing to Flow Desk. For specific issues or questions, refer to the issue tracker or start a discussion.