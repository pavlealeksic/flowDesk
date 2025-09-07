# Flow Desk Logging System

A comprehensive, production-ready logging system for the Flow Desk Electron application that provides structured logging across all processes with proper error handling, performance monitoring, and security considerations.

## Features

### Core Features
- **Multi-Process Support**: Works across main, renderer, and preload processes
- **Structured Logging**: JSON-formatted logs with contextual information
- **Log Levels**: Error, Warn, Info, Debug, Trace with environment-based filtering
- **File Rotation**: Automatic log file management with size and count limits
- **Performance Logging**: Built-in timing and performance measurement
- **User Action Logging**: Track user interactions for debugging and analytics
- **Security**: Automatic sensitive data redaction
- **IPC Communication**: Seamless logging across process boundaries

### Production Features
- **Environment-based Configuration**: Different log levels for development/production
- **Memory Efficient**: Asynchronous logging with minimal performance impact
- **Error Resilience**: Fallback mechanisms when logging fails
- **TypeScript Support**: Full type safety and IntelliSense
- **Hot-reloadable Configuration**: Update logging settings at runtime

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Main Process  │    │ Renderer Process │    │ Preload Process │
│                 │    │                 │    │                 │
│ MainLogger      │◄──►│ RendererLogger  │◄──►│ PreloadLogger   │
│ - File Writing  │    │ - IPC Bridge    │    │ - IPC Bridge    │
│ - Log Rotation  │    │ - React Hooks   │    │ - Security Log  │
│ - IPC Handlers  │    │ - Redux Logging │    │ - API Logging   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                          ┌───────▼───────┐
                          │  Log Files    │
                          │  (~/.../logs) │
                          └───────────────┘
```

## Quick Start

### 1. Basic Usage

#### Main Process
```typescript
import { mainLoggingService } from './logging/LoggingService';

class MyService {
  private logger = mainLoggingService.createLogger('MyService');
  
  async doSomething() {
    this.logger.info('Starting operation', { operationId: '123' });
    
    try {
      const result = await someAsyncOperation();
      this.logger.info('Operation completed', { operationId: '123' }, { result });
    } catch (error) {
      this.logger.error('Operation failed', error, { operationId: '123' });
    }
  }
}
```

#### Renderer Process (React Component)
```typescript
import { useLogger } from '../logging/RendererLoggingService';

function MyComponent() {
  const logger = useLogger('MyComponent');
  
  const handleClick = () => {
    logger.userAction('button-click', { buttonId: 'submit' });
    
    // Your component logic
  };
  
  useEffect(() => {
    logger.info('Component mounted');
    
    return () => {
      logger.info('Component unmounting');
    };
  }, []);
}
```

#### Preload Process
```typescript
import { preloadLogger } from './PreloadLogger';

// Security validation
try {
  validateApiCall(request);
  preloadLogger.info('API call validated', { endpoint: request.url });
} catch (error) {
  preloadLogger.error('API validation failed', error, { endpoint: request.url });
}
```

### 2. Performance Logging

```typescript
// Measure operation performance
logger.time('database-query');
const results = await database.query(sql);
logger.timeEnd('database-query'); // Automatically logs duration

// Manual performance logging
const start = performance.now();
await heavyOperation();
const duration = performance.now() - start;
logger.info('Heavy operation completed', undefined, { duration });
```

### 3. User Action Logging

```typescript
// Track user interactions
logger.userAction('workspace-switch', { 
  fromWorkspaceId: 'old-123',
  toWorkspaceId: 'new-456'
});

logger.userAction('service-add', { 
  workspaceId: 'ws-123',
  serviceType: 'slack'
});
```

### 4. Structured Logging

```typescript
logger.structured('info', 'User login successful', {
  userId: user.id,
  loginMethod: 'oauth',
  duration: loginTime,
  ipAddress: request.ip,
  userAgent: request.userAgent
});
```

## Configuration

### Default Configuration

```typescript
{
  level: 'info', // 'error' | 'warn' | 'info' | 'debug' | 'trace'
  enableConsole: false, // true in development
  enableFile: true,
  fileSettings: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5, // Keep 5 log files
    directory: '~/.../userData/logs'
  },
  enablePerformance: false, // true in development
  enableUserActions: true,
  sensitiveDataPatterns: [
    /password=[\w\d]+/gi,
    /token=[\w\d\-_]+/gi,
    // ... more patterns
  ]
}
```

### Runtime Configuration Updates

```typescript
// Update logging configuration
const loggingService = RendererLoggingService.getInstance();
loggingService.updateConfig({
  level: 'debug',
  enablePerformance: true
});
```

## Log Output Format

### File Logs (JSON)
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "User workspace switched",
  "context": {
    "process": "main",
    "component": "WorkspaceManager",
    "userId": "user-123",
    "workspaceId": "ws-456",
    "sessionId": "session-789",
    "action": "workspace-switch"
  },
  "metadata": {
    "fromWorkspace": "ws-123",
    "toWorkspace": "ws-456",
    "userAction": true
  }
}
```

### Console Output (Development)
```
[10:30:45] INFO  [WorkspaceManager] User workspace switched (workspace: ws-456) {"fromWorkspace":"ws-123","toWorkspace":"ws-456"}
```

## Security Features

### Sensitive Data Redaction
- Automatic redaction of passwords, tokens, and secrets
- Configurable regex patterns for custom sensitive data
- Safe logging of user actions without exposing private information

### Process Isolation
- Renderer process cannot directly write to log files
- All file operations happen in the main process
- Secure IPC communication for log transport

## Performance Considerations

### Async Logging
- Non-blocking log operations
- Batch processing for high-volume logging
- Minimal impact on application performance

### Memory Management
- Automatic cleanup of in-memory log queues
- Efficient JSON serialization
- Log rotation prevents disk space issues

## Error Handling

### Graceful Degradation
```typescript
// If logging fails, app continues normally
try {
  logger.info('Operation started');
  await criticalOperation();
} catch (loggingError) {
  // Fallback to console in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('Logging failed:', loggingError);
  }
  // App continues normally
}
```

### Error Recovery
- Automatic retry mechanisms for transient failures
- Fallback to console logging when file system is unavailable
- Circuit breaker pattern for persistent logging failures

## Development Tools

### Console Replacement Script
Run the automated script to replace all console statements:

```bash
# Replace all console.log statements with proper logging
node scripts/replace-console-logs.js
```

### Log Analysis
```bash
# View recent logs
tail -f ~/.../userData/logs/flowdesk-main.log | jq '.'

# Search for errors
grep '"level":"error"' ~/.../userData/logs/flowdesk-main.log | jq '.'

# User action analysis
grep '"userAction":true' ~/.../userData/logs/flowdesk-main.log | jq '.context.action' | sort | uniq -c
```

## Best Practices

### 1. Use Appropriate Log Levels
- **ERROR**: Application errors, exceptions, failed operations
- **WARN**: Deprecated features, fallbacks, performance warnings
- **INFO**: Important user actions, application lifecycle events
- **DEBUG**: Detailed debugging information, data flows
- **TRACE**: Very detailed execution flow, typically for troubleshooting

### 2. Provide Context
```typescript
// Good - includes context
logger.info('Service loaded successfully', 
  { workspaceId: 'ws-123', serviceId: 'svc-456' },
  { serviceType: 'slack', loadTime: 1250 }
);

// Bad - no context
logger.info('Service loaded');
```

### 3. Use Child Loggers
```typescript
// Create child logger with inherited context
const childLogger = logger.child({ workspaceId: 'ws-123' });

// All logs from child will include workspaceId
childLogger.info('Service added'); // Includes workspaceId automatically
```

### 4. Performance Logging
```typescript
// Use built-in performance timing
logger.time('expensive-operation');
await expensiveOperation();
logger.timeEnd('expensive-operation');

// Include memory usage for memory-intensive operations
const memBefore = process.memoryUsage().heapUsed;
await memoryIntensiveOperation();
const memAfter = process.memoryUsage().heapUsed;
logger.info('Memory intensive operation completed', undefined, {
  memoryDelta: memAfter - memBefore
});
```

### 5. Error Logging
```typescript
// Always include the error object
try {
  await operation();
} catch (error) {
  // Good - includes full error information
  logger.error('Operation failed', error, { operationId: '123' });
  
  // Bad - loses stack trace and error details
  logger.error('Operation failed: ' + error.message);
}
```

## Troubleshooting

### Common Issues

#### 1. Logs Not Appearing
- Check log level configuration
- Verify file permissions in log directory
- Check if IPC communication is working (renderer/preload)

#### 2. Performance Impact
- Reduce log level in production
- Disable performance logging in production
- Check if log rotation is working properly

#### 3. Missing Context
- Use child loggers for automatic context inheritance
- Include relevant IDs in all log calls
- Use structured logging for complex data

### Debug Mode
```typescript
// Enable verbose logging for troubleshooting
loggingService.updateConfig({
  level: 'trace',
  enableConsole: true,
  enablePerformance: true
});
```

## Migration Guide

### Replacing Console Statements

The automated script handles most cases, but you may need manual updates for:

1. **Complex Console Statements**
   ```typescript
   // Before
   console.log('User data:', { user: userData, workspace: workspaceData });
   
   // After
   logger.info('User data loaded', 
     { userId: userData.id, workspaceId: workspaceData.id },
     { userData, workspaceData }
   );
   ```

2. **Error Handling**
   ```typescript
   // Before
   console.error('Failed to load:', error);
   
   // After
   logger.error('Failed to load user data', error, { 
     userId: userData?.id 
   });
   ```

3. **Performance Monitoring**
   ```typescript
   // Before
   const start = Date.now();
   await operation();
   console.log('Operation took:', Date.now() - start, 'ms');
   
   // After
   logger.time('operation');
   await operation();
   logger.timeEnd('operation');
   ```

## File Structure

```
src/
├── types/
│   └── logging.ts              # TypeScript interfaces and types
├── main/
│   └── logging/
│       └── LoggingService.ts   # Main process logging implementation
├── renderer/
│   └── logging/
│       └── RendererLoggingService.ts # Renderer process logging
├── preload/
│   └── PreloadLogger.ts        # Preload process logging
└── scripts/
    └── replace-console-logs.js # Automated console replacement
```

## API Reference

### Main Process Logger

#### `createLogger(component: string, baseContext?: Partial<LogContext>): ILogger`
Creates a new logger instance for the specified component.

#### Log Methods
- `error(message: string, error?: Error, context?: LogContext, metadata?: Record<string, unknown>): void`
- `warn(message: string, context?: LogContext, metadata?: Record<string, unknown>): void`
- `info(message: string, context?: LogContext, metadata?: Record<string, unknown>): void`
- `debug(message: string, context?: LogContext, metadata?: Record<string, unknown>): void`
- `trace(message: string, context?: LogContext, metadata?: Record<string, unknown>): void`

#### Performance Methods
- `time(label: string, context?: LogContext): void`
- `timeEnd(label: string, context?: LogContext): void`

#### Utility Methods
- `userAction(action: string, context?: LogContext, metadata?: Record<string, unknown>): void`
- `structured(level: LogLevel, message: string, data: Record<string, unknown>, context?: LogContext): void`
- `child(context: Partial<LogContext>): ILogger`

### Renderer Process Hooks

#### `useLogger(component: string, baseContext?: Partial<LogContext>): ILogger`
React hook that returns a logger instance for the component.

#### `logError(error: Error, errorInfo?: { componentStack: string }, context?: LogContext): void`
Utility function for logging React error boundary errors.

### Configuration Types

See `src/types/logging.ts` for complete type definitions.

---

## Support

For questions or issues with the logging system:

1. Check this documentation
2. Review the TypeScript type definitions
3. Examine the example implementations
4. Check the automated replacement script for complex cases

The logging system is designed to be robust, performant, and easy to use across all parts of the Flow Desk application.