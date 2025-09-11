# Flow Desk Logging Guide

## Overview

Flow Desk uses a comprehensive, structured logging system that provides consistent logging across all processes (main, renderer, and preload). The system is designed to be production-ready with proper log levels, sensitive data filtering, and environment-based configuration.

## Quick Start

### For Main Process Files

```typescript
import { createLogger } from '../shared/logging/LoggerFactory';

// Create logger for your component
const logger = createLogger('YourComponentName');

// Basic logging
logger.info('Component initialized');
logger.error('Something went wrong', error);
logger.warn('Deprecated feature used');
logger.debug('Debug information', { data: someVariable });
```

### For Renderer Process Components

```typescript
import { useLogger } from '../logging/RendererLoggingService';

function MyComponent() {
  // Use React hook for component-specific logging
  const logger = useLogger('MyComponent');

  useEffect(() => {
    logger.info('Component mounted');
    return () => logger.info('Component unmounted');
  }, []);

  const handleClick = () => {
    logger.userAction('button_clicked', { buttonId: 'submit' });
  };
}
```

### For Preload Process

```typescript
import { PreloadLogger } from './PreloadLogger';

// Create preload logger
const logger = new PreloadLogger('YourPreloadComponent');

// Logging works the same way
logger.info('Preload script initialized');
```

## Log Levels

The logging system supports five log levels:

- **`error`** - Critical errors that need immediate attention
- **`warn`** - Warning conditions that should be investigated
- **`info`** - Important informational messages
- **`debug`** - Detailed debugging information
- **`trace`** - Very detailed tracing information

## Environment-Based Configuration

Logging behavior automatically adjusts based on environment:

### Development (`NODE_ENV=development`)
- Log level: `debug`
- Console output: Enabled
- File logging: Enabled
- Performance logging: Enabled
- User action logging: Enabled

### Production (`NODE_ENV=production`)
- Log level: `info`
- Console output: Disabled
- File logging: Enabled
- Performance logging: Disabled
- User action logging: Enabled

### Test (`NODE_ENV=test`)
- Log level: `warn`
- Console output: Disabled
- File logging: Disabled
- Performance logging: Disabled
- User action logging: Disabled

## Advanced Features

### Structured Logging

```typescript
// Log with context and metadata
logger.info('User action completed', 
  { userId: '123', action: 'file_upload' },
  { fileSize: 1024, fileType: 'pdf' }
);
```

### Performance Timing

```typescript
// Time operations
logger.time('database_query');
// ... perform operation
logger.timeEnd('database_query'); // Automatically logs duration
```

### User Action Logging

```typescript
// Log user actions for analytics
logger.userAction('workspace_created', 
  { workspaceId: 'new-workspace-123' },
  { template: 'blank' }
);
```

### Child Loggers

```typescript
// Create child logger with inherited context
const childLogger = logger.child({ userId: '123', sessionId: 'abc' });

// All logs from childLogger will include the context
childLogger.info('User performed action');
```

### Error Handling

```typescript
// Log errors with proper stack traces
try {
  // some operation
} catch (error) {
  logger.error('Operation failed', error, 
    { operation: 'database_query', userId: '123' }
  );
}
```

## Sensitive Data Protection

The logging system automatically redacts sensitive data:

### Automatic Redaction

Patterns that are automatically redacted:
- Passwords: `password=secret123` → `password=[REDACTED]`
- Tokens: `token=abc123` → `token=[REDACTED]`
- API keys: `api_key=xyz789` → `api_key=[REDACTED]`
- Authorization headers: `authorization: bearer token123` → `authorization: bearer [REDACTED]`

### Custom Redaction Patterns

```typescript
import { getLoggingConfig } from '../shared/logging/config';

const customConfig = getLoggingConfig({
  sensitiveDataPatterns: [
    ...getLoggingConfig().sensitiveDataPatterns,
    /custom_secret=[\w\d]+/gi,
    /private_key=[\w\d\-_]+/gi
  ]
});
```

## Configuration

### Environment Variables

```bash
# Override default log level
LOG_LEVEL=debug

# Enable/disable console output
ENABLE_CONSOLE_LOGS=true

# Configure file logging
LOG_MAX_FILE_SIZE=20971520  # 20MB
LOG_MAX_FILES=10
LOG_DIRECTORY=/custom/log/path

# Enable specific logging features
ENABLE_PERFORMANCE_LOGS=true
ENABLE_USER_ACTION_LOGS=true
```

### Component-Specific Configuration

```typescript
import { getComponentConfig } from '../shared/logging/config';

// Get configuration optimized for specific component
const config = getComponentConfig('PerformanceMonitor');
// Returns: { level: 'warn', enablePerformance: true, ... }
```

## Migration from Console Statements

### Before
```typescript
console.log('User logged in:', user);
console.error('Failed to load data:', error);
console.warn('Deprecated API used');
```

### After
```typescript
logger.info('User logged in', undefined, { user });
logger.error('Failed to load data', error, { operation: 'data_load' });
logger.warn('Deprecated API used', { api: 'old_version', method: 'console.warn' });
```

## File Structure

```
src/
├── shared/
│   └── logging/
│       ├── LoggerFactory.ts     # Universal logger factory
│       ├── ConsoleReplacer.ts  # Console replacement utilities
│       └── config.ts           # Configuration management
├── main/
│   └── logging/
│       └── LoggingService.ts    # Main process logging
├── renderer/
│   └── logging/
│       └── RendererLoggingService.ts  # Renderer process logging
└── preload/
    └── PreloadLogger.ts        # Preload process logging
```

## Best Practices

### 1. Use Appropriate Log Levels
- **Error**: Only for actual errors that need attention
- **Warn**: For concerning but non-critical situations
- **Info**: For important business events
- **Debug**: For development troubleshooting
- **Trace**: For very detailed execution flow

### 2. Include Context
```typescript
// Good
logger.info('User created workspace', 
  { userId: '123', workspaceId: '456' },
  { workspaceName: 'My Project', template: 'blank' }
);

// Less useful
logger.info('Workspace created');
```

### 3. Don't Log Sensitive Data
```typescript
// Bad - logs password
logger.info('User login', { password: user.password });

// Good - password is automatically redacted
logger.info('User login', { user: { id: user.id, email: user.email } });
```

### 4. Use Structured Data
```typescript
// Good - structured
logger.error('Database query failed', error, {
  operation: 'user_select',
  query: 'SELECT * FROM users',
  duration: 145,
  userId: '123'
});

// Less useful - unstructured
logger.error('Database query failed: ' + error.message);
```

### 5. Consider Performance
```typescript
// Good - only log in development
if (process.env.NODE_ENV === 'development') {
  logger.debug('Expensive debug operation', { largeData });
}

// Better - use appropriate log level
logger.debug('Expensive debug operation', { largeData }); // Only logged in debug mode
```

## Troubleshooting

### Logs Not Appearing

1. **Check log level**: Ensure your message level is enabled
   ```typescript
   // Check current log level
   import { getLoggerConfig } from '../shared/logging/config';
   console.log('Current log level:', getLoggerConfig().level);
   ```

2. **Check file logging**: Verify file logging is enabled
   ```typescript
   const config = getLoggerConfig();
   console.log('File logging enabled:', config.enableFile);
   console.log('Log directory:', config.fileSettings?.directory);
   ```

3. **Check console output**: Console logging is disabled in production
   ```typescript
   console.log('Console logging enabled:', config.enableConsole);
   ```

### Performance Issues

1. **Reduce log level in production**
   ```typescript
   LOG_LEVEL=warn npm run build
   ```

2. **Disable performance logging**
   ```typescript
   ENABLE_PERFORMANCE_LOGS=false
   ```

3. **Adjust file rotation settings**
   ```typescript
   LOG_MAX_FILE_SIZE=5242880  # 5MB
   LOG_MAX_FILES=3
   ```

## Integration with Existing Code

### Adding Logging to Existing Components

1. **Import the logger factory**
   ```typescript
   import { createLogger } from '../shared/logging/LoggerFactory';
   ```

2. **Create logger instance**
   ```typescript
   const logger = createLogger('YourComponent');
   ```

3. **Replace console statements**
   ```typescript
   // Before
   console.log('Operation completed');
   
   // After
   logger.info('Operation completed', undefined, { method: 'console.log' });
   ```

### Automated Migration

Use the provided script to automatically replace console statements:

```bash
# Preview changes (dry run)
node scripts/replace-console-logs.js --dry-run

# Apply changes
node scripts/replace-console-logs.js

# Replace in specific component only
node scripts/replace-console-logs.js --component=App
```

## Testing

### Unit Testing with Mocks

```typescript
import { createLogger } from '../shared/logging/LoggerFactory';

// Mock logger for testing
jest.mock('../shared/logging/LoggerFactory');
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

createLogger.mockReturnValue(mockLogger);

// Your test
test('component logs correctly', () => {
  const component = new MyComponent();
  component.doSomething();
  
  expect(mockLogger.info).toHaveBeenCalledWith(
    'Component action performed',
    expect.any(Object),
    expect.any(Object)
  );
});
```

### Log Testing Utilities

```typescript
import { getTestConfig } from '../shared/logging/config';

// Use test configuration for unit tests
const testLogger = createLogger('TestComponent', getTestConfig());
```

## Monitoring and Analytics

### Log File Location

- **Development**: `./logs/flowdesk-main.log`
- **Production**: `~/Library/Application Support/FlowDesk/logs/flowdesk-main.log` (macOS)
- **Windows**: `%APPDATA%/FlowDesk/logs/flowdesk-main.log`
- **Linux**: `~/.local/state/flowdesk/logs/flowdesk-main.log`

### Log Rotation

Logs are automatically rotated when they exceed the maximum size:
- Default max size: 10MB
- Default max files: 5
- Files are named: `flowdesk-main.log.1`, `flowdesk-main.log.2`, etc.

### Viewing Logs

```bash
# View current logs
tail -f logs/flowdesk-main.log

# View logs with filtering
grep "level=error" logs/flowdesk-main.log

# View logs for specific component
grep "component=MyComponent" logs/flowdesk-main.log
```