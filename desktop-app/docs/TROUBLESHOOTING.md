# Flow Desk Troubleshooting Guide

This guide helps developers and users diagnose and resolve common issues with Flow Desk.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Development Issues](#development-issues)
- [Runtime Issues](#runtime-issues)
- [Performance Problems](#performance-problems)
- [Error Messages](#error-messages)
- [Debug Tools](#debug-tools)
- [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check Script

Run this script to quickly identify common problems:

```bash
#!/bin/bash
echo "Flow Desk Health Check"
echo "======================"

# Check Node.js version
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"
if [[ $NODE_VERSION < "v18" ]]; then
  echo "❌ Node.js version should be 18 or higher"
else
  echo "✅ Node.js version is compatible"
fi

# Check npm version
NPM_VERSION=$(npm --version)
echo "npm version: $NPM_VERSION"

# Check if dependencies are installed
if [ -d "node_modules" ]; then
  echo "✅ Dependencies are installed"
else
  echo "❌ Dependencies not installed. Run: npm install"
fi

# Check for common files
FILES=("package.json" "src/main/main.ts" "src/renderer/App.tsx" "src/preload/preload.ts")
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file exists"
  else
    echo "❌ $file is missing"
  fi
done

# Check TypeScript compilation
echo "Checking TypeScript compilation..."
if npm run type-check > /dev/null 2>&1; then
  echo "✅ TypeScript compilation successful"
else
  echo "❌ TypeScript compilation failed"
fi

echo "======================"
echo "Health check complete"
```

### System Information

```typescript
// src/main/diagnostics.ts
export const getSystemInfo = () => {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    v8Version: process.versions.v8,
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    uptime: process.uptime(),
    workingDirectory: process.cwd()
  };
};
```

## Common Issues

### Installation Problems

#### Issue: `npm install` fails with permission errors

**Symptoms:**
```
Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solutions:**

1. **Use a Node version manager (Recommended)**:
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 18
nvm install 18
nvm use 18
```

2. **Fix npm permissions**:
```bash
# Create global directory for npm
mkdir ~/.npm-global

# Configure npm to use new directory
npm config set prefix '~/.npm-global'

# Add to PATH in ~/.bashrc or ~/.zshrc
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
```

#### Issue: Native module compilation fails

**Symptoms:**
```
Error: Python executable not found
gyp ERR! configure error
```

**Solutions:**

**macOS:**
```bash
# Install Xcode command line tools
xcode-select --install

# If using M1 Mac, you might need Rosetta
sudo softwareupdate --install-rosetta
```

**Windows:**
```bash
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/

# Or install via npm
npm install -g windows-build-tools
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install build-essential python3-dev
```

### Application Won't Start

#### Issue: App crashes on startup

**Symptoms:**
- Application window never appears
- Process exits immediately
- No error messages in console

**Debug Steps:**

1. **Enable detailed logging**:
```bash
DEBUG=* npm run dev
```

2. **Check for missing files**:
```bash
ls -la dist/main.js  # Should exist after build
ls -la dist/preload.js
ls -la dist/renderer/
```

3. **Start with minimal configuration**:
```typescript
// Minimal main.ts for testing
import { app, BrowserWindow } from 'electron';

app.whenReady().then(() => {
  const window = new BrowserWindow({
    width: 800,
    height: 600
  });
  
  window.loadFile('dist/renderer/index.html');
  console.log('Application started successfully');
});
```

#### Issue: White screen on startup

**Symptoms:**
- Application window opens but shows blank white screen
- No React components render
- Console shows loading errors

**Debug Steps:**

1. **Check renderer process console**:
```bash
# Open DevTools in the app
# Or check browser console if using dev server
```

2. **Verify build outputs**:
```bash
# Check if renderer files exist
ls -la dist/renderer/index.html
ls -la dist/renderer/assets/

# Check for build errors
npm run build:renderer
```

3. **Test renderer independently**:
```bash
# Start only the renderer dev server
npm run dev:renderer
# Open http://localhost:5173 in browser
```

### Workspace and Service Issues

#### Issue: Workspaces not saving

**Symptoms:**
- Created workspaces disappear after restart
- Workspace data not persisted
- Error messages about file access

**Debug Steps:**

1. **Check data directory permissions**:
```typescript
// Add to main process for debugging
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const dataPath = join(process.cwd(), 'data');
console.log('Data path:', dataPath);
console.log('Data directory exists:', existsSync(dataPath));

try {
  if (!existsSync(dataPath)) {
    mkdirSync(dataPath, { recursive: true });
    console.log('Created data directory');
  }
} catch (error) {
  console.error('Failed to create data directory:', error);
}
```

2. **Check file permissions**:
```bash
# Check if the app can write to the data directory
ls -la data/
chmod 755 data/  # Fix permissions if needed
```

3. **Verify JSON structure**:
```typescript
// Add validation to workspace loading
try {
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  console.log('Loaded workspace data:', data);
} catch (error) {
  console.error('Invalid JSON in workspace file:', error);
  // Backup corrupted file and create new one
}
```

#### Issue: Services not loading

**Symptoms:**
- Service browser views show blank or error pages
- Network errors in service content
- Services appear to load but don't display content

**Debug Steps:**

1. **Check service URLs**:
```typescript
// Add URL validation
const validateServiceUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    console.log('Service URL:', {
      protocol: parsed.protocol,
      host: parsed.host,
      pathname: parsed.pathname
    });
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (error) {
    console.error('Invalid service URL:', error);
    return false;
  }
};
```

2. **Check browser view creation**:
```typescript
// Add error handling to browser view creation
try {
  const browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Service failed to load:', errorCode, errorDescription);
  });
  
  browserView.webContents.on('did-finish-load', () => {
    console.log('Service loaded successfully');
  });
  
} catch (error) {
  console.error('Failed to create browser view:', error);
}
```

3. **Network debugging**:
```typescript
// Monitor network requests
session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
  console.log('Network request:', details.url);
  callback({ cancel: false });
});

session.defaultSession.webRequest.onErrorOccurred((details) => {
  console.error('Network error:', details.error, details.url);
});
```

## Development Issues

### Build Problems

#### Issue: TypeScript compilation errors

**Symptoms:**
```
error TS2307: Cannot find module 'electron'
error TS2304: Cannot find name 'window'
```

**Solutions:**

1. **Install type definitions**:
```bash
npm install -D @types/node @types/electron
```

2. **Check TypeScript configuration**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "types": ["node", "electron"],
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

3. **Verify type imports**:
```typescript
// Correct imports
import { app, BrowserWindow } from 'electron';
import type { IpcRendererEvent } from 'electron';
```

#### Issue: Module resolution errors

**Symptoms:**
```
Module not found: Can't resolve './components/Component'
Failed to resolve import "./utils/helper"
```

**Solutions:**

1. **Check file extensions**:
```typescript
// Make sure file extensions match
import Component from './Component.tsx';  // Not .ts
import helper from './helper.ts';         // Not .js
```

2. **Verify path aliases**:
```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components')
    }
  }
});
```

3. **Case sensitivity issues**:
```bash
# Check actual file names (case sensitive on Linux/Mac)
ls -la src/components/
```

### Testing Issues

#### Issue: Tests fail with module import errors

**Symptoms:**
```
Jest encountered an unexpected token
SyntaxError: Cannot use import statement outside a module
```

**Solutions:**

1. **Configure Jest for ES modules**:
```json
// package.json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "jsdom",
    "extensionsToTreatAsEsm": [".ts", ".tsx"],
    "transform": {
      "^.+\\.tsx?$": "ts-jest"
    }
  }
}
```

2. **Mock Electron modules**:
```typescript
// __mocks__/electron.js
module.exports = {
  app: {
    whenReady: () => Promise.resolve(),
    on: jest.fn(),
    quit: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    show: jest.fn()
  })),
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn()
  }
};
```

## Runtime Issues

### Memory Leaks

#### Issue: Application memory usage grows over time

**Symptoms:**
- Application becomes slower
- System memory usage increases continuously
- Eventually crashes or becomes unresponsive

**Debug Steps:**

1. **Enable memory monitoring**:
```typescript
// Add to main process
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
    external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
  });
}, 10000);
```

2. **Check for proper cleanup**:
```typescript
// Ensure browser views are properly destroyed
const cleanupBrowserView = (browserView: BrowserView) => {
  if (browserView && !browserView.webContents.isDestroyed()) {
    browserView.webContents.removeAllListeners();
    (browserView.webContents as any).destroy();
  }
};
```

3. **Use memory profiling**:
```bash
# Start with Node.js memory profiling
node --inspect --max-old-space-size=4096 dist/main.js

# Connect Chrome DevTools to chrome://inspect
```

### Performance Issues

#### Issue: UI becomes unresponsive

**Symptoms:**
- Click events delayed or ignored
- Animations stutter or freeze
- High CPU usage

**Debug Steps:**

1. **Profile React components**:
```typescript
// Enable React DevTools Profiler
import { Profiler } from 'react';

const onRenderCallback = (id, phase, actualDuration) => {
  console.log('Render:', { id, phase, actualDuration });
};

<Profiler id="App" onRender={onRenderCallback}>
  <App />
</Profiler>
```

2. **Check for expensive operations**:
```typescript
// Wrap expensive operations
const expensiveOperation = (data) => {
  const start = performance.now();
  const result = processData(data);
  const duration = performance.now() - start;
  
  if (duration > 100) {
    console.warn(`Expensive operation took ${duration}ms`);
  }
  
  return result;
};
```

## Error Messages

### Common Error Patterns

#### `Error: Cannot find module 'xxx'`

**Cause**: Missing dependency or incorrect import path

**Solutions**:
```bash
# Install missing package
npm install xxx

# Check import path
import { something } from './correct/path';
```

#### `SecurityError: Failed to read the 'localStorage' property`

**Cause**: Browser security restrictions in Electron context

**Solutions**:
```typescript
// Use Electron's session storage instead
import { session } from 'electron';

const storage = session.defaultSession;
storage.cookies.set({ url: 'https://app.local', name: 'key', value: 'value' });
```

#### `TypeError: Cannot read property 'xxx' of undefined`

**Cause**: Accessing properties on undefined objects

**Solutions**:
```typescript
// Add null checks
const value = object?.property?.subproperty;

// Use optional chaining and nullish coalescing
const result = data?.items?.length ?? 0;
```

### IPC Communication Errors

#### `Error: Object could not be cloned`

**Cause**: Trying to send non-serializable data through IPC

**Solutions**:
```typescript
// Convert to plain objects before sending
const plainObject = JSON.parse(JSON.stringify(complexObject));
ipcRenderer.invoke('channel', plainObject);

// Or use structured cloning
const clonedObject = structuredClone(originalObject);
```

#### `Error: IPC channel 'xxx' not found`

**Cause**: Handler not registered or channel name mismatch

**Solutions**:
```typescript
// Ensure handler is registered in main process
ipcMain.handle('workspace:create', async (event, data) => {
  // Handler implementation
});

// Match channel names exactly
ipcRenderer.invoke('workspace:create', data);  // Must match exactly
```

## Debug Tools

### Logging Configuration

```typescript
// Enhanced logging setup
import log from 'electron-log';

// Configure log levels
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB

// Structured logging
const createLogger = (component: string) => ({
  debug: (message: string, meta?: any) => log.debug(`[${component}] ${message}`, meta),
  info: (message: string, meta?: any) => log.info(`[${component}] ${message}`, meta),
  warn: (message: string, meta?: any) => log.warn(`[${component}] ${message}`, meta),
  error: (message: string, error?: Error) => log.error(`[${component}] ${message}`, error)
});
```

### DevTools Integration

```typescript
// Enable DevTools in development
if (process.env.NODE_ENV === 'development') {
  // Install React DevTools
  const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');
  
  app.whenReady().then(() => {
    installExtension(REACT_DEVELOPER_TOOLS)
      .then((name) => console.log(`Added Extension: ${name}`))
      .catch((err) => console.log('An error occurred: ', err));
  });
}
```

### Error Reporting

```typescript
// Global error handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Send to error reporting service in production
  if (process.env.NODE_ENV === 'production') {
    sendErrorReport(error);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Send to error reporting service
});

// React error boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('React error:', error, errorInfo);
    // Send to error reporting service
  }
  
  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please restart the application.</div>;
    }
    return this.props.children;
  }
}
```

## Getting Help

### Before Reporting Issues

1. **Check the logs**:
   - Main process logs: Check terminal output
   - Renderer logs: Open DevTools (Cmd/Ctrl + Shift + I)
   - File logs: Look in the application data directory

2. **Reproduce the issue**:
   - Create minimal reproduction steps
   - Test on a clean installation
   - Try different operating systems if possible

3. **Gather system information**:
```bash
# Run diagnostics
npm run diagnostics

# Or manually collect
node --version
npm --version
cat package.json | grep "electron"
uname -a  # Linux/Mac
systeminfo  # Windows
```

### Issue Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. macOS 12.0, Windows 11, Ubuntu 20.04]
- Node.js version: [e.g. v18.17.0]
- npm version: [e.g. 9.6.7]
- Electron version: [e.g. 26.2.0]
- App version: [e.g. 1.0.0]

**Additional context**
- Console logs
- Error messages
- Any other context
```

### Community Resources

- **Documentation**: Check the docs/ directory
- **Issue Tracker**: Search existing issues on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Discord/Slack**: Join community chat (if available)

---

This troubleshooting guide covers the most common issues encountered when developing and using Flow Desk. If you encounter an issue not covered here, please report it so we can improve the documentation.