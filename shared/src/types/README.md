# Flow Desk Shared Types

This package provides comprehensive TypeScript type definitions for the entire Flow Desk ecosystem. All types are production-ready, include Zod schemas for runtime validation, and follow strict TypeScript patterns with proper generics and utility types.

## 📁 Type Modules

### Core Domain Types

| Module | Description | Key Types |
|--------|-------------|-----------|
| **[user.ts](./user.ts)** | User & organization management | `User`, `Organization`, `Team`, `OrganizationMembership`, `TeamMembership` |
| **[mail.ts](./mail.ts)** | Email system | `MailAccount`, `EmailMessage`, `EmailThread`, `MailFolder`, `EmailFilter` |
| **[calendar.ts](./calendar.ts)** | Calendar & events | `CalendarAccount`, `CalendarEvent`, `RecurrenceRule`, `CalendarPrivacySync` |
| **[plugin.ts](./plugin.ts)** | Plugin system | `PluginManifest`, `PluginInstallation`, `PluginAPI`, `SearchProvider` |

### System Types

| Module | Description | Key Types |
|--------|-------------|-----------|
| **[config.ts](./config.ts)** | Config sync & workspaces | `WorkspaceConfig`, `SyncSettings`, `SyncState`, `SyncDevice` |
| **[search.ts](./search.ts)** | Unified search system | `SearchQuery`, `SearchResult`, `SearchProvider`, `SearchIndexDocument` |
| **[notifications.ts](./notifications.ts)** | Notification system | `Notification`, `NotificationRule`, `NotificationDigest`, `DoNotDisturb` |
| **[automations.ts](./automations.ts)** | Automation recipes | `AutomationRecipe`, `AutomationTrigger`, `AutomationAction` |

### Business Types

| Module | Description | Key Types |
|--------|-------------|-----------|
| **[billing.ts](./billing.ts)** | Billing & licensing | `Subscription`, `License`, `LicenseDevice`, `Payment`, `Invoice` |
| **[security.ts](./security.ts)** | Security & audit | `AuthToken`, `AuditLogEntry`, `SecurityPolicy`, `SecurityIncident` |

### Utility Types

| Module | Description | Key Types |
|--------|-------------|-----------|
| **[errors.ts](./errors.ts)** | Error handling | `FlowDeskError`, `Result<T>`, `ErrorCodes`, Custom error classes |
| **[api.ts](./api.ts)** | API patterns | `ApiResponse<T>`, `ListParams`, `PaginationMeta`, `BulkOperation` |

## 🚀 Quick Start

### Basic Usage

```typescript
import { 
  User, 
  EmailMessage, 
  CalendarEvent,
  ApiResponse,
  FlowDeskError 
} from '@flow-desk/shared/types';

// Type-safe user creation
const user: User = {
  id: 'usr_123',
  email: 'john@example.com',
  name: 'John Doe',
  timezone: 'America/New_York',
  locale: 'en-US',
  // ... other required fields
};

// API response handling
const response: ApiResponse<User[]> = {
  success: true,
  data: [user],
  timestamp: new Date()
};
```

### Runtime Validation with Zod

```typescript
import { UserSchema, EmailMessageSchema } from '@flow-desk/shared/types';

// Validate user data at runtime
const userData = UserSchema.parse(rawUserData);

// Safe parsing with error handling
const result = UserSchema.safeParse(rawUserData);
if (result.success) {
  console.log('Valid user:', result.data);
} else {
  console.error('Validation errors:', result.error.errors);
}
```

### Error Handling

```typescript
import { 
  FlowDeskError, 
  ValidationError, 
  NotFoundError, 
  Result, 
  Ok, 
  Err 
} from '@flow-desk/shared/types';

// Function that returns a Result type
function findUser(id: string): Result<User, FlowDeskError> {
  if (!id) {
    return Err(new ValidationError('INVALID_ID', 'User ID is required', 'id'));
  }
  
  const user = getUserById(id);
  if (!user) {
    return Err(new NotFoundError('USER_NOT_FOUND', 'User not found', 'user', id));
  }
  
  return Ok(user);
}

// Usage
const userResult = findUser('usr_123');
if (userResult.success) {
  console.log('Found user:', userResult.data);
} else {
  console.error('Error:', userResult.error.message);
  
  // Type-safe error handling
  if (userResult.error instanceof ValidationError) {
    console.log('Validation failed for field:', userResult.error.field);
  }
}
```

## 🏗️ Type Patterns

### Generic Types

Many types use generics for flexibility:

```typescript
// API responses are generic
type UserListResponse = ApiResponse<User[]>;
type SearchResponse = ApiResponse<SearchResult[]>;

// Results can wrap any type
type UserResult = Result<User, FlowDeskError>;
type BatchResult = Result<BulkOperationResponse<User>, FlowDeskError>;
```

### Utility Types

Common utility types for CRUD operations:

```typescript
import { CreateInput, UpdateInput } from '@flow-desk/shared/types';

// Automatically excludes id, createdAt, updatedAt
type CreateUserInput = CreateInput<User>;

// Automatically makes fields optional except id, createdAt
type UpdateUserInput = UpdateInput<User>;

// Use in functions
function createUser(input: CreateUserInput): Promise<User> {
  // Implementation
}

function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  // Implementation
}
```

### Filter & Search Types

Type-safe filtering and searching:

```typescript
import { ListParams, FilterExpression, SearchParams } from '@flow-desk/shared/types';

// List users with filtering, sorting, and pagination
const listParams: ListParams = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  where: [
    { field: 'isActive', operator: 'eq', value: true },
    { field: 'name', operator: 'contains', value: 'John' }
  ]
};

// Search across multiple content types
const searchParams: SearchParams = {
  query: 'project update',
  types: ['email', 'calendar_event', 'message'],
  options: {
    fuzzy: true,
    highlighting: true
  }
};
```

## 🔐 Security & Validation

### Runtime Type Safety

All critical types include Zod schemas:

```typescript
import { z } from 'zod';
import { UserSchema, EmailMessageSchema } from '@flow-desk/shared/types';

// Validate API inputs
const createUserSchema = UserSchema.omit({ id: true, createdAt: true, updatedAt: true });

export function validateCreateUser(data: unknown) {
  return createUserSchema.parse(data);
}

// Validate configuration
const configSchema = z.object({
  apiUrl: z.string().url(),
  timeout: z.number().positive(),
  retries: z.number().min(0).max(5)
});

const config = configSchema.parse(process.env);
```

### Error Classification

Errors are properly categorized with inheritance:

```typescript
try {
  await someOperation();
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
    logValidationError(error.field, error.constraint);
  } else if (error instanceof AuthenticationError) {
    // Handle auth errors
    redirectToLogin();
  } else if (error instanceof RateLimitError) {
    // Handle rate limiting
    retryAfter(error.retryDelay);
  } else if (error instanceof FlowDeskError) {
    // Handle other known errors
    showErrorMessage(error.message);
  } else {
    // Handle unknown errors
    reportUnknownError(error);
  }
}
```

## 📊 Plugin Development

### Plugin Types

Comprehensive types for plugin development:

```typescript
import { 
  PluginManifest, 
  PluginAPI, 
  PluginInstallation,
  SearchProvider,
  AutomationTrigger
} from '@flow-desk/shared/types';

// Plugin manifest
const manifest: PluginManifest = {
  id: 'my-plugin',
  name: 'My Awesome Plugin',
  version: '1.0.0',
  type: 'connector',
  category: 'productivity',
  permissions: ['read:emails', 'write:calendar'],
  // ... other fields
};

// Plugin runtime API
function initPlugin(api: PluginAPI) {
  // Type-safe API usage
  api.storage.get<UserConfig>('config').then(config => {
    // Use config
  });
  
  api.events.on('email.received', (data) => {
    // Handle email events
  });
}
```

### Search Provider Integration

```typescript
import { SearchProvider, SearchResult } from '@flow-desk/shared/types';

const mySearchProvider: SearchProvider = {
  id: 'my-provider',
  type: 'custom',
  name: 'My Search Provider',
  enabled: true,
  config: {
    settings: {
      apiKey: 'encrypted_key',
      baseUrl: 'https://api.example.com'
    }
  },
  capabilities: {
    textSearch: true,
    semanticSearch: false,
    facets: true,
    // ... other capabilities
  },
  // ... other fields
};
```

## 🔄 State Management

### Config Sync Types

Local-first configuration synchronization:

```typescript
import { 
  WorkspaceConfig, 
  SyncState, 
  SyncDevice,
  ConfigChangeEvent 
} from '@flow-desk/shared/types';

// Workspace configuration
const config: WorkspaceConfig = {
  version: '1.0',
  workspace: {
    id: 'ws_123',
    name: 'My Workspace',
    type: 'personal',
    // ... other fields
  },
  // ... preferences, apps, plugins, etc.
};

// Sync state tracking
const syncState: SyncState = {
  status: 'syncing',
  lastSync: new Date(),
  pendingChanges: 3,
  conflicts: 0,
  vectorClock: { device1: 5, device2: 3 }
};
```

## 🔍 Advanced Patterns

### Automation System

Type-safe automation recipes:

```typescript
import { 
  AutomationRecipe, 
  AutomationTrigger, 
  AutomationAction,
  EmailTriggerConfig,
  NotificationActionConfig
} from '@flow-desk/shared/types';

const emailToNotificationRecipe: AutomationRecipe = {
  id: 'recipe_123',
  name: 'VIP Email Notifications',
  trigger: {
    type: 'email_received',
    config: {
      type: 'email_received',
      accountIds: ['acc_123'],
      senderFilters: ['boss@company.com']
    } as EmailTriggerConfig
  },
  actions: [
    {
      id: 'action_1',
      type: 'send_notification',
      name: 'Send Push Notification',
      config: {
        type: 'send_notification',
        notification: {
          title: 'VIP Email Received',
          message: 'You have a new email from {{sender}}',
          priority: 'high',
          channels: ['desktop', 'mobile']
        }
      } as NotificationActionConfig,
      errorHandling: {
        strategy: 'retry',
        logErrors: true,
        notifyOnError: false
      },
      continueOnError: true
    }
  ],
  // ... other fields
};
```

### Billing & Licensing

Comprehensive billing system types:

```typescript
import { 
  Subscription, 
  License, 
  LicenseDevice,
  LicenseVerificationResult 
} from '@flow-desk/shared/types';

// Subscription management
const subscription: Subscription = {
  id: 'sub_123',
  organizationId: 'org_123',
  plan: 'pro',
  interval: 'yearly',
  status: 'active',
  limits: {
    maxMembers: 10,
    maxWorkspaces: 5,
    maxConnectedAccounts: 20,
    // ... other limits
  },
  // ... other fields
};

// License verification
function verifyLicense(licenseKey: string): LicenseVerificationResult {
  // Implementation would verify the JWT license
  return {
    valid: true,
    status: 'active',
    license: /* license object */,
    verifiedAt: new Date(),
    offlineVerification: false
  };
}
```

## 📚 Best Practices

### 1. Always Use Runtime Validation

```typescript
// ✅ Good - validate input data
import { UserSchema } from '@flow-desk/shared/types';

function createUser(rawData: unknown) {
  const userData = UserSchema.parse(rawData);
  return saveUser(userData);
}

// ❌ Bad - trusting input without validation
function createUser(userData: User) {
  return saveUser(userData); // userData might be invalid
}
```

### 2. Use Result Types for Error Handling

```typescript
// ✅ Good - explicit error handling
import { Result, Ok, Err, NotFoundError } from '@flow-desk/shared/types';

async function getUser(id: string): Promise<Result<User, FlowDeskError>> {
  try {
    const user = await userRepository.findById(id);
    return user ? Ok(user) : Err(new NotFoundError('USER_NOT_FOUND', 'User not found'));
  } catch (error) {
    return Err(toFlowDeskError(error));
  }
}

// ❌ Bad - throwing exceptions
async function getUser(id: string): Promise<User> {
  const user = await userRepository.findById(id);
  if (!user) throw new Error('User not found'); // Untyped error
  return user;
}
```

### 3. Leverage Utility Types

```typescript
// ✅ Good - use provided utility types
import { CreateInput, UpdateInput, ListParams } from '@flow-desk/shared/types';

type CreateUserData = CreateInput<User>;
type UpdateUserData = UpdateInput<User>;

// ❌ Bad - manually defining types
type CreateUserData = {
  email: string;
  name: string;
  // ... manually excluding fields, prone to errors
};
```

### 4. Type-Safe Event Handling

```typescript
// ✅ Good - use typed event emitter
import { TypedEventEmitter, EventMap } from '@flow-desk/shared/types';

const emitter: TypedEventEmitter = createEventEmitter();

// Type-safe event emission
emitter.emit('user.created', { userId: 'usr_123', user: userData });

// Type-safe event handling
emitter.on('user.created', (data) => {
  // data is properly typed as EventMap['user.created']
  console.log('User created:', data.userId);
});
```

## 🧪 Testing

### Type Testing

```typescript
import { expectType } from 'tsd';
import { User, CreateInput, Result } from '@flow-desk/shared/types';

// Test type correctness
expectType<CreateInput<User>>(userCreateData);
expectType<Result<User>>(userResult);

// Test that excluded fields are properly omitted
const createData: CreateInput<User> = {
  email: 'test@example.com',
  name: 'Test User',
  // id: 'test', // ✅ This should cause a TypeScript error
};
```

### Runtime Testing

```typescript
import { describe, it, expect } from 'vitest';
import { UserSchema, ValidationError } from '@flow-desk/shared/types';

describe('User validation', () => {
  it('should validate correct user data', () => {
    const validUser = {
      id: 'usr_123',
      email: 'test@example.com',
      name: 'Test User',
      // ... other required fields
    };
    
    expect(() => UserSchema.parse(validUser)).not.toThrow();
  });
  
  it('should reject invalid email', () => {
    const invalidUser = {
      // ... other fields
      email: 'invalid-email'
    };
    
    expect(() => UserSchema.parse(invalidUser)).toThrow();
  });
});
```

## 📄 License

This package is part of the Flow Desk project and follows the same licensing terms.