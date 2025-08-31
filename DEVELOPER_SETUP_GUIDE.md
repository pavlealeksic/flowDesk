# Flow Desk Developer Setup Guide

## Overview

This guide provides comprehensive instructions for setting up a local development environment for Flow Desk, including all necessary tools, dependencies, and workflows for contributing to the project.

---

## Prerequisites and System Requirements

### Required Software

#### Operating System Support
- **macOS:** 11.0+ (Big Sur or later)
- **Windows:** 10+ or Windows 11 with WSL2
- **Linux:** Ubuntu 20.04+, Fedora 35+, or equivalent

#### Core Development Tools
- **Node.js:** v18.0.0 or higher (LTS recommended)
- **npm:** v8.0.0 or higher (comes with Node.js)
- **Git:** Latest version
- **Rust:** 1.70.0+ (for shared package compilation)
- **Python:** 3.8+ (for native module compilation)

#### Platform-Specific Requirements

**macOS Development:**
- **Xcode:** Latest version (for iOS development)
- **Xcode Command Line Tools:** `xcode-select --install`
- **Homebrew:** Package manager for additional tools

**Windows Development:**
- **WSL2:** Windows Subsystem for Linux 2
- **Windows Terminal:** Modern terminal application
- **Visual Studio Build Tools:** For native module compilation

**Linux Development:**
- **build-essential:** Essential build tools
- **libssl-dev:** SSL development headers
- **pkg-config:** Package configuration tool

### Recommended Development Tools

#### Code Editors and IDEs
- **Visual Studio Code** (Primary recommendation)
- **WebStorm** (JetBrains IDE alternative)
- **Cursor** (AI-powered code editor)

#### Essential VS Code Extensions
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "rust-lang.rust-analyzer",
    "ms-python.python",
    "ms-vscode.cmake-tools",
    "expo.vscode-expo-tools",
    "ms-vscode-remote.remote-containers"
  ]
}
```

#### Terminal and Shell Tools
- **Oh My Zsh** or **Fish Shell** (enhanced shell experience)
- **Starship** (cross-shell prompt)
- **direnv** (automatic environment loading)
- **fzf** (fuzzy file finder)

---

## Local Development Environment Setup

### 1. Initial Repository Setup

#### Clone Repository
```bash
# Clone the repository
git clone https://github.com/your-org/flow-desk.git
cd flow-desk

# Set up git hooks
git config core.hooksPath .githooks
chmod +x .githooks/*
```

#### Environment Configuration
```bash
# Copy environment template
cp server/.env.example server/.env.local

# Generate required secrets
./scripts/generate-dev-secrets.sh

# Install direnv (optional but recommended)
echo "export NODE_ENV=development" > .envrc
direnv allow
```

### 2. Dependency Installation

#### Install Node.js Dependencies
```bash
# Install dependencies for all workspaces
npm install

# Verify installation
npm run --workspaces list
```

#### Install Rust Toolchain
```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install required targets
rustup target add x86_64-apple-darwin # macOS
rustup target add x86_64-pc-windows-gnu # Windows
rustup target add x86_64-unknown-linux-gnu # Linux

# Install additional tools
cargo install cargo-watch  # File watching for Rust
cargo install cargo-edit   # Cargo.toml editing
```

#### Platform-Specific Mobile Setup

**iOS Development (macOS only):**
```bash
# Install iOS Simulator
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# Install React Native CLI
npm install -g @react-native-community/cli

# Install CocoaPods (iOS dependency manager)
sudo gem install cocoapods

# Setup iOS dependencies
cd mobile-app/ios && pod install
```

**Android Development:**
```bash
# Install Android Studio and SDK
# Download from https://developer.android.com/studio

# Set environment variables (add to ~/.bashrc or ~/.zshrc)
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
export ANDROID_HOME=$HOME/Android/Sdk          # Linux
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Install Expo CLI
npm install -g @expo/cli
```

### 3. Database Setup

#### Local PostgreSQL Installation

**Using Docker (Recommended):**
```bash
# Start PostgreSQL with Docker Compose
docker-compose -f docker-compose.dev.yml up -d postgres

# Or using Docker directly
docker run --name flowdesk-postgres \
  -e POSTGRES_DB=flowdesk_dev \
  -e POSTGRES_USER=flowdesk \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15
```

**Native Installation:**
```bash
# macOS (using Homebrew)
brew install postgresql@15
brew services start postgresql@15
createdb flowdesk_dev

# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb flowdesk_dev

# Create user and set permissions
sudo -u postgres psql
CREATE USER flowdesk WITH ENCRYPTED PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE flowdesk_dev TO flowdesk;
\q
```

#### Database Migration and Seeding
```bash
cd server

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed development data
npx prisma db seed
```

### 4. Redis Setup (Optional)

#### Using Docker
```bash
docker run --name flowdesk-redis -p 6379:6379 -d redis:7-alpine
```

#### Native Installation
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis-server
```

---

## Monorepo Tooling and Scripts

### 1. Turborepo Configuration

#### Understanding the Build Pipeline
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

#### Available Scripts
```bash
# Development
npm run dev                    # Start all development servers
npm run dev:server            # Start Next.js server only
npm run dev:desktop           # Start Electron app only
npm run dev:mobile            # Start React Native/Expo only

# Building
npm run build                 # Build all packages
npm run build:server          # Build server only
npm run build:desktop         # Build desktop app only
npm run build:mobile          # Build mobile app only
npm run build:shared          # Build shared package only

# Testing
npm run test                  # Run all tests
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Run tests with coverage report

# Code Quality
npm run lint                  # Lint all packages
npm run lint:fix              # Fix linting issues
npm run format                # Format all code
npm run type-check            # TypeScript type checking

# Utilities
npm run clean                 # Clean all build artifacts
npm run reset                 # Clean and reinstall dependencies
```

### 2. Workspace-Specific Commands

#### Server Workspace
```bash
# Development
cd server
npm run dev                   # Start Next.js dev server
npm run build                 # Build for production
npm run start                 # Start production server

# Database
npm run db:migrate            # Run database migrations
npm run db:seed               # Seed development data
npm run db:studio             # Open Prisma Studio
npm run db:reset              # Reset database

# Testing
npm run test                  # Run server tests
npm run test:e2e              # Run end-to-end tests
```

#### Desktop Workspace
```bash
cd desktop-app
npm run dev                   # Start Electron in development
npm run build                 # Build for current platform
npm run build:mac             # Build for macOS
npm run build:win             # Build for Windows
npm run build:linux           # Build for Linux
npm run package               # Package without building
```

#### Mobile Workspace
```bash
cd mobile-app
npm run dev                   # Start Expo development server
npm run ios                   # Run on iOS simulator
npm run android               # Run on Android emulator
npm run build:ios             # Build for iOS
npm run build:android         # Build for Android
npm run eas:build             # Build with EAS
npm run eas:submit            # Submit to app stores
```

#### Shared Workspace
```bash
cd shared
npm run build                 # Build TypeScript and Rust
npm run build:rust            # Build Rust library only
npm run build:ts              # Build TypeScript only
npm run dev                   # Watch mode for development
```

### 3. Development Workflow

#### Git Workflow
```bash
# Create feature branch
git checkout -b feature/new-feature-name

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create pull request
git push origin feature/new-feature-name
```

#### Code Quality Workflow
```bash
# Before committing (automated via git hooks)
npm run lint                  # Check for linting issues
npm run format                # Format code
npm run type-check            # Check TypeScript types
npm run test                  # Run tests

# Fix issues
npm run lint:fix              # Auto-fix linting issues
npm run format                # Auto-format code
```

---

## Testing Procedures and Guidelines

### 1. Testing Strategy

#### Test Types and Coverage
- **Unit Tests:** Individual functions and components (>80% coverage)
- **Integration Tests:** API endpoints and database operations (>70% coverage)
- **E2E Tests:** Critical user flows (key paths covered)
- **Visual Regression Tests:** UI components and layouts
- **Performance Tests:** API response times and load testing

#### Testing Tools
- **Unit Testing:** Vitest, Jest
- **React Testing:** React Testing Library
- **E2E Testing:** Playwright
- **Mobile Testing:** Detox (React Native)
- **Visual Testing:** Chromatic (Storybook)

### 2. Running Tests

#### Unit and Integration Tests
```bash
# Run all tests
npm run test

# Run tests for specific workspace
npm run test --workspace=server
npm run test --workspace=desktop-app
npm run test --workspace=mobile-app

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests matching pattern
npm run test -- --grep "authentication"
```

#### End-to-End Tests
```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
cd server
npm run test:e2e

# Run specific test file
npx playwright test auth.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

#### Mobile Tests
```bash
cd mobile-app

# iOS tests
npm run test:ios

# Android tests  
npm run test:android

# Detox E2E tests
npm run test:detox
```

### 3. Writing Tests

#### Unit Test Example
```typescript
// __tests__/lib/auth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { validateToken } from '../lib/auth'

describe('Authentication', () => {
  it('should validate a valid JWT token', async () => {
    const token = 'valid.jwt.token'
    const result = await validateToken(token)
    
    expect(result).toBeDefined()
    expect(result.userId).toBe('user123')
  })

  it('should reject an invalid token', async () => {
    const token = 'invalid.token'
    
    await expect(validateToken(token)).rejects.toThrow('Invalid token')
  })
})
```

#### Integration Test Example
```typescript
// __tests__/api/users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestApp } from '../helpers/test-app'
import { createTestUser } from '../helpers/test-data'

describe('/api/users', () => {
  let app: any
  let testUser: any

  beforeAll(async () => {
    app = await createTestApp()
    testUser = await createTestUser()
  })

  afterAll(async () => {
    await app.cleanup()
  })

  it('should get user profile', async () => {
    const response = await app
      .get(`/api/users/${testUser.id}`)
      .set('Authorization', `Bearer ${testUser.token}`)
      .expect(200)

    expect(response.body).toMatchObject({
      id: testUser.id,
      email: testUser.email
    })
  })
})
```

#### E2E Test Example
```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/sign-in')
    
    await page.fill('[data-testid=email-input]', 'test@example.com')
    await page.fill('[data-testid=password-input]', 'password123')
    await page.click('[data-testid=login-button]')
    
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid=user-menu]')).toBeVisible()
  })
})
```

### 4. Test Data Management

#### Test Database Setup
```typescript
// helpers/test-db.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_TEST_URL
    }
  }
})

export async function setupTestDatabase() {
  // Run migrations
  await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS test`
  
  // Clear existing data
  await prisma.user.deleteMany()
  await prisma.plugin.deleteMany()
  
  return prisma
}

export async function teardownTestDatabase() {
  await prisma.$disconnect()
}
```

#### Test Factories
```typescript
// helpers/test-factories.ts
import { faker } from '@faker-js/faker'
import { User, Plugin } from '@prisma/client'

export function createUserData(overrides: Partial<User> = {}): Omit<User, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    clerkId: faker.string.uuid(),
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    ...overrides
  }
}

export function createPluginData(overrides: Partial<Plugin> = {}): Omit<Plugin, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()),
    description: faker.lorem.sentence(),
    author: faker.person.fullName(),
    authorEmail: faker.internet.email(),
    category: 'PRODUCTIVITY',
    ...overrides
  }
}
```

---

## Code Quality and Linting Setup

### 1. ESLint Configuration

#### Root ESLint Config (.eslintrc.js)
```javascript
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'next/core-web-vitals',
    'prettier'
  ],
  plugins: ['@typescript-eslint', 'import'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // TypeScript rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-const': 'error',
    
    // Import rules
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }
    ],
    
    // General rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error'
  },
  overrides: [
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
}
```

#### Workspace-Specific Configs
```javascript
// server/.eslintrc.js
module.exports = {
  extends: ['../eslintrc.js', 'next/core-web-vitals'],
  rules: {
    // Next.js specific rules
    '@next/next/no-html-link-for-pages': 'off'
  }
}

// mobile-app/.eslintrc.js
module.exports = {
  extends: ['../eslintrc.js', '@react-native-community'],
  plugins: ['react-native'],
  rules: {
    // React Native specific rules
    'react-native/no-unused-styles': 'error',
    'react-native/no-inline-styles': 'warn'
  }
}
```

### 2. Prettier Configuration

#### Prettier Config (.prettierrc)
```json
{
  "semi": false,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

#### Prettier Ignore (.prettierignore)
```
.next
.expo
dist
build
coverage
node_modules
*.min.js
*.min.css
public
```

### 3. TypeScript Configuration

#### Root TypeScript Config (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../shared/src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist", "build"]
}
```

### 4. Git Hooks with Husky

#### Pre-commit Hook (.husky/pre-commit)
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linting and formatting
npm run lint
npm run format:check

# Run type checking
npm run type-check

# Run tests for changed files
npm run test -- --passWithNoTests --findRelatedTests $(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|jsx)$' | xargs)
```

#### Commit Message Hook (.husky/commit-msg)
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Validate commit message format
npx commitlint --edit $1
```

#### Commitlint Configuration (.commitlintrc.js)
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting, missing semicolons, etc
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'test',     // Adding tests
        'chore',    // Updating build tasks, package manager configs, etc
        'perf',     // Performance improvements
        'ci',       // CI/CD changes
        'build',    // Build system changes
        'revert'    // Revert previous commit
      ]
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-max-length': [2, 'always', 72]
  }
}
```

---

## Documentation and Contribution Guidelines

### 1. Documentation Standards

#### Code Documentation
```typescript
/**
 * Validates and authenticates a user token
 * 
 * @param token - JWT token to validate
 * @param options - Validation options
 * @param options.skipExpiry - Skip expiration check
 * @returns Promise resolving to user data
 * @throws {AuthenticationError} When token is invalid
 * 
 * @example
 * ```typescript
 * const user = await validateToken('jwt.token.here')
 * console.log(user.id) // user123
 * ```
 */
export async function validateToken(
  token: string,
  options: { skipExpiry?: boolean } = {}
): Promise<UserData> {
  // Implementation...
}
```

#### API Documentation
```typescript
/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Implementation...
}
```

### 2. Contribution Workflow

#### Pull Request Template
```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for hard-to-understand areas
- [ ] Documentation updated
- [ ] No new warnings introduced

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Additional Notes
Any additional information about the changes.
```

#### Code Review Guidelines
```markdown
# Code Review Guidelines

## What to Look For

### Functionality
- [ ] Code works as intended
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] Performance considerations addressed

### Code Quality
- [ ] Code is readable and maintainable
- [ ] Functions are focused and not too large
- [ ] Naming is clear and consistent
- [ ] No code duplication

### Security
- [ ] Input validation is present
- [ ] No sensitive data in logs
- [ ] Authentication/authorization checks
- [ ] SQL injection prevention

### Testing
- [ ] Adequate test coverage
- [ ] Tests are meaningful
- [ ] Tests pass consistently
- [ ] Performance tests if needed
```

### 3. Development Environment Debugging

#### VS Code Debug Configuration
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server/node_modules/.bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}/server",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Debug Desktop App",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/desktop-app/node_modules/.bin/electron",
      "args": ["dist/main/main.js"],
      "cwd": "${workspaceFolder}/desktop-app"
    }
  ]
}
```

#### Debugging Commands
```bash
# Debug server with Node.js inspector
cd server
node --inspect-brk node_modules/.bin/next dev

# Debug tests with VS Code
npm run test:debug

# Debug Rust code (requires rust-lldb)
cd shared/rust-lib
cargo build
rust-lldb target/debug/rust-lib

# Debug mobile app
cd mobile-app
npm run ios -- --configuration Debug
npm run android -- --mode debug
```

### 4. Performance Profiling

#### Bundle Analysis
```bash
# Analyze Next.js bundles
cd server
npm run build
npx @next/bundle-analyzer

# Analyze mobile bundles
cd mobile-app
npx expo export --dump-assetmap
```

#### Performance Monitoring in Development
```typescript
// lib/dev-profiler.ts
export class DevProfiler {
  private static timers = new Map<string, number>()

  static start(label: string) {
    this.timers.set(label, performance.now())
  }

  static end(label: string) {
    const start = this.timers.get(label)
    if (start) {
      const duration = performance.now() - start
      console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`)
      this.timers.delete(label)
    }
  }

  static measure<T>(label: string, fn: () => T): T {
    this.start(label)
    const result = fn()
    this.end(label)
    return result
  }
}

// Usage in development
if (process.env.NODE_ENV === 'development') {
  DevProfiler.start('database-query')
  const users = await prisma.user.findMany()
  DevProfiler.end('database-query')
}
```

---

## Advanced Development Topics

### 1. Plugin Development

#### Creating a New Plugin
```bash
# Generate plugin template
npm run create:plugin my-plugin

# Plugin structure
plugins/my-plugin/
├── plugin.json          # Plugin manifest
├── assets/              # Icons, images
├── src/
│   ├── index.ts        # Main plugin file
│   └── components/     # Plugin UI components
└── types/              # TypeScript types
```

#### Plugin Manifest Example
```json
{
  "name": "My Plugin",
  "slug": "my-plugin",
  "version": "1.0.0",
  "description": "Example plugin for Flow Desk",
  "author": "Developer Name",
  "permissions": ["calendar:read", "notifications:send"],
  "entrypoints": {
    "main": "dist/index.js",
    "panel": "dist/panel.html"
  },
  "api": {
    "oauth": {
      "clientId": "{{OAUTH_CLIENT_ID}}",
      "scopes": ["read", "write"]
    }
  }
}
```

### 2. Rust Development

#### Building Rust Components
```bash
cd shared/rust-lib

# Development build
cargo build

# Release build
cargo build --release

# Run tests
cargo test

# Watch for changes
cargo watch -x build

# Generate bindings
cargo install napi-cli
napi build --platform
```

#### Rust-Node.js Bindings Example
```rust
// src/lib.rs
use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub fn search_emails(query: String) -> Result<Vec<String>> {
    // Implement email search logic
    Ok(vec![])
}

#[napi]
pub struct CalendarEngine {
    // Calendar engine implementation
}

#[napi]
impl CalendarEngine {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {}
    }
    
    #[napi]
    pub fn sync_events(&self) -> Result<u32> {
        // Sync calendar events
        Ok(0)
    }
}
```

### 3. Cross-Platform Development

#### Electron Main Process Development
```typescript
// desktop-app/src/main/main.ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { searchEmails } from '@shared/rust-lib'

class MainProcess {
  private mainWindow: BrowserWindow | null = null

  constructor() {
    this.setupEventListeners()
    this.setupIPC()
  }

  private setupIPC() {
    ipcMain.handle('search:emails', async (_, query: string) => {
      return searchEmails(query)
    })
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    })
  }
}

new MainProcess()
```

---

This developer setup guide provides everything needed to contribute effectively to the Flow Desk project. Follow these guidelines to maintain code quality and consistency across the codebase.
