# Contributing to Flow Desk

Thank you for your interest in contributing to Flow Desk! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Documentation](#documentation)
- [Testing](#testing)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct adapted from the [Contributor Covenant](https://www.contributor-covenant.org/). By participating, you are expected to uphold this code.

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 18+ installed
- Git configured with your name and email
- A GitHub account
- Familiarity with TypeScript, React, and Electron

### Setting Up Development Environment

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/flowDesk.git
   cd flowDesk/desktop-app
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/flowDesk.git
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Verify setup**
   ```bash
   npm run type-check
   npm test
   npm run dev
   ```

### Project Structure Familiarity

Take time to understand the project structure:

```
desktop-app/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React UI
│   ├── preload/        # Preload scripts
│   └── types/          # TypeScript definitions
├── docs/               # Documentation
├── __tests__/          # Test files
└── assets/             # Static assets
```

## Development Process

### Branch Strategy

We use a feature branch workflow:

1. **Main branch**: Always deployable, protected
2. **Feature branches**: One per feature/fix
3. **Release branches**: For release preparation

### Workflow

1. **Create feature branch**
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/amazing-feature
   ```

2. **Make changes**
   - Write code following our standards
   - Add/update tests
   - Update documentation

3. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/amazing-feature
   # Create pull request on GitHub
   ```

### Commit Message Format

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes

**Examples:**
```
feat(workspace): add workspace color themes
fix(security): resolve XSS vulnerability in service URLs
docs: update installation instructions
test(workspace): add tests for workspace creation
```

## Coding Standards

### TypeScript Guidelines

1. **Use strict TypeScript configuration**
   ```typescript
   // Always provide explicit types for public APIs
   export interface WorkspaceConfig {
     name: string;
     color: string;
     browserIsolation: 'shared' | 'isolated';
   }
   
   // Use proper return type annotations
   async function createWorkspace(config: WorkspaceConfig): Promise<Workspace> {
     // Implementation
   }
   ```

2. **Avoid `any` type**
   ```typescript
   // Bad
   function processData(data: any): any {
     return data.someProperty;
   }
   
   // Good
   interface DataStructure {
     someProperty: string;
   }
   
   function processData(data: DataStructure): string {
     return data.someProperty;
   }
   ```

3. **Use proper error handling**
   ```typescript
   // Bad
   try {
     await riskyOperation();
   } catch (error) {
     console.log(error);
   }
   
   // Good
   try {
     await riskyOperation();
   } catch (error) {
     logger.error('Risky operation failed', error as Error);
     throw new WorkspaceError('Failed to process workspace', 'OPERATION_FAILED');
   }
   ```

### React Guidelines

1. **Use functional components with hooks**
   ```typescript
   // Preferred
   const WorkspaceList: React.FC<WorkspaceListProps> = ({ workspaces, onSelect }) => {
     const [selectedId, setSelectedId] = useState<string | null>(null);
     
     const handleWorkspaceClick = useCallback((id: string) => {
       setSelectedId(id);
       onSelect(id);
     }, [onSelect]);
     
     return (
       <div>
         {workspaces.map(workspace => (
           <WorkspaceItem
             key={workspace.id}
             workspace={workspace}
             isSelected={selectedId === workspace.id}
             onClick={handleWorkspaceClick}
           />
         ))}
       </div>
     );
   };
   ```

2. **Optimize performance**
   ```typescript
   // Use React.memo for expensive components
   const ExpensiveComponent = React.memo<Props>(({ data }) => {
     return <div>{/* Expensive rendering */}</div>;
   });
   
   // Memoize expensive calculations
   const processedData = useMemo(() => {
     return expensiveProcessing(rawData);
   }, [rawData]);
   
   // Use useCallback for event handlers
   const handleClick = useCallback((id: string) => {
     onItemClick(id);
   }, [onItemClick]);
   ```

3. **Handle loading and error states**
   ```typescript
   const DataComponent: React.FC = () => {
     const [data, setData] = useState<Data | null>(null);
     const [isLoading, setIsLoading] = useState(true);
     const [error, setError] = useState<string | null>(null);
     
     useEffect(() => {
       loadData()
         .then(setData)
         .catch(err => setError(err.message))
         .finally(() => setIsLoading(false));
     }, []);
     
     if (isLoading) return <LoadingSpinner />;
     if (error) return <ErrorMessage error={error} />;
     if (!data) return <EmptyState />;
     
     return <DataDisplay data={data} />;
   };
   ```

### Electron Guidelines

1. **Security first**
   ```typescript
   // Always disable node integration in renderer
   const window = new BrowserWindow({
     webPreferences: {
       nodeIntegration: false,
       contextIsolation: true,
       sandbox: true
     }
   });
   ```

2. **Proper IPC communication**
   ```typescript
   // Main process - validate all inputs
   ipcMain.handle('workspace:create', async (event, data: unknown) => {
     const validatedData = validateWorkspaceData(data);
     return await workspaceManager.createWorkspace(validatedData);
   });
   
   // Preload - expose minimal API
   contextBridge.exposeInMainWorld('api', {
     createWorkspace: (data: WorkspaceCreateData) => 
       ipcRenderer.invoke('workspace:create', data)
   });
   ```

### Code Organization

1. **File naming conventions**
   - Components: `PascalCase.tsx` (e.g., `WorkspaceList.tsx`)
   - Utilities: `camelCase.ts` (e.g., `dataHelpers.ts`)
   - Constants: `UPPER_SNAKE_CASE.ts` (e.g., `API_ENDPOINTS.ts`)
   - Types: `camelCase.d.ts` (e.g., `workspace.d.ts`)

2. **Import organization**
   ```typescript
   // 1. Node modules
   import React, { useState, useCallback } from 'react';
   import { useDispatch } from 'react-redux';
   
   // 2. Internal modules
   import { WorkspaceService } from '../services/WorkspaceService';
   import { Button, Input } from '../ui';
   
   // 3. Types
   import type { Workspace } from '../types/workspace';
   
   // 4. Relative imports
   import './Component.css';
   ```

3. **Component structure**
   ```typescript
   // 1. Imports
   
   // 2. Types and interfaces
   interface ComponentProps {
     // props definition
   }
   
   // 3. Component implementation
   export const Component: React.FC<ComponentProps> = ({ ...props }) => {
     // 4. Hooks
     const [state, setState] = useState();
     
     // 5. Event handlers
     const handleClick = useCallback(() => {
       // handler implementation
     }, []);
     
     // 6. Effects
     useEffect(() => {
       // effect implementation
     }, []);
     
     // 7. Render
     return (
       <div>
         {/* JSX */}
       </div>
     );
   };
   
   // 8. Default export
   export default Component;
   ```

## Pull Request Process

### Before Submitting

1. **Run all checks**
   ```bash
   npm run type-check
   npm run lint
   npm test
   npm run build
   ```

2. **Update documentation**
   - Update README if needed
   - Add/update JSDoc comments
   - Update API documentation

3. **Add tests**
   - Unit tests for new functionality
   - Integration tests for complex features
   - Update existing tests if behavior changes

### PR Requirements

Your pull request must:

- [ ] Have a clear, descriptive title
- [ ] Include a detailed description of changes
- [ ] Reference related issues
- [ ] Pass all CI checks
- [ ] Have test coverage for new code
- [ ] Update documentation
- [ ] Follow coding standards

### PR Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Code is commented appropriately
- [ ] Documentation updated
- [ ] Tests added/updated
```

### Review Process

1. **Automated checks**: CI must pass
2. **Code review**: At least one maintainer approval required
3. **Testing**: Reviewers may test functionality
4. **Documentation review**: Ensure docs are updated
5. **Merge**: Maintainer will merge when ready

## Issue Guidelines

### Reporting Bugs

Use the bug report template:

```markdown
**Describe the bug**
Clear description of the bug.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Environment**
- OS: [e.g. macOS 12.0]
- Node version: [e.g. 18.17.0]
- App version: [e.g. 1.0.0]

**Additional context**
Logs, screenshots, etc.
```

### Feature Requests

Use the feature request template:

```markdown
**Is your feature request related to a problem?**
Description of the problem.

**Describe the solution you'd like**
Clear description of desired solution.

**Describe alternatives you've considered**
Alternative solutions or features.

**Additional context**
Mockups, examples, etc.
```

### Issue Labels

We use these labels to organize issues:

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Documentation improvements
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention needed
- `priority: high`: High priority
- `priority: low`: Low priority
- `status: investigating`: Under investigation
- `status: blocked`: Blocked by dependencies

## Documentation

### Writing Documentation

1. **Use clear, concise language**
2. **Provide examples** for complex concepts
3. **Keep it updated** with code changes
4. **Use proper markdown formatting**

### Documentation Types

1. **API Documentation**: JSDoc comments in code
2. **User Guides**: Step-by-step instructions
3. **Architecture Docs**: System design and decisions
4. **Contributing Guide**: This document
5. **Troubleshooting**: Common issues and solutions

### JSDoc Standards

```typescript
/**
 * Creates a new workspace with the specified configuration
 * 
 * @param data - Workspace configuration data
 * @param data.name - Human-readable workspace name
 * @param data.color - Hex color code for workspace theming
 * @param data.browserIsolation - Data isolation strategy
 * @returns Promise that resolves to the created workspace
 * @throws {WorkspaceError} When workspace creation fails
 * 
 * @example
 * ```typescript
 * const workspace = await createWorkspace({
 *   name: 'Development',
 *   color: '#4285f4',
 *   browserIsolation: 'isolated'
 * });
 * ```
 */
async function createWorkspace(data: WorkspaceCreateData): Promise<Workspace> {
  // Implementation
}
```

## Testing

### Testing Requirements

1. **Unit tests** for all new functionality
2. **Integration tests** for complex features
3. **E2E tests** for critical user flows
4. **Minimum 80% code coverage** for new code

### Writing Tests

#### Unit Tests

```typescript
// __tests__/unit/workspace/WorkspaceManager.test.ts
import { WorkspaceManager } from '../../../src/main/workspace';

describe('WorkspaceManager', () => {
  let manager: WorkspaceManager;

  beforeEach(() => {
    manager = new WorkspaceManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('createWorkspace', () => {
    test('should create workspace with valid data', async () => {
      const data = {
        name: 'Test Workspace',
        color: '#4285f4',
        browserIsolation: 'isolated' as const
      };

      const workspace = await manager.createWorkspace(data);

      expect(workspace).toBeDefined();
      expect(workspace.name).toBe(data.name);
      expect(workspace.color).toBe(data.color);
      expect(workspace.id).toBeDefined();
    });

    test('should throw error with invalid data', async () => {
      const invalidData = {
        name: '',
        color: 'invalid-color'
      };

      await expect(manager.createWorkspace(invalidData as any))
        .rejects.toThrow('Invalid workspace data');
    });
  });
});
```

#### Integration Tests

```typescript
// __tests__/integration/workspace-ipc.test.ts
import { app } from 'electron';
import { setupTestApp, teardownTestApp } from '../helpers/testApp';

describe('Workspace IPC Integration', () => {
  beforeAll(async () => {
    await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  test('should create workspace via IPC', async () => {
    const workspaceData = {
      name: 'Integration Test',
      color: '#ff6b6b'
    };

    const workspaceId = await window.electronAPI.workspace.create(workspaceData);
    expect(workspaceId).toBeDefined();

    const workspace = await window.electronAPI.workspace.get(workspaceId);
    expect(workspace.name).toBe(workspaceData.name);
  });
});
```

#### E2E Tests

```typescript
// __tests__/e2e/workspace-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Workspace Management', () => {
  test('should create and manage workspaces', async ({ page }) => {
    // Start the application
    await page.goto('/');

    // Create new workspace
    await page.click('[data-testid="add-workspace"]');
    await page.fill('[data-testid="workspace-name"]', 'E2E Test Workspace');
    await page.selectOption('[data-testid="workspace-color"]', '#4285f4');
    await page.click('[data-testid="create-workspace"]');

    // Verify workspace appears
    await expect(page.locator('[data-testid="workspace-item"]')).toContainText('E2E Test Workspace');

    // Switch to workspace
    await page.click('[data-testid="workspace-item"]');
    await expect(page.locator('[data-testid="active-workspace"]')).toContainText('E2E Test Workspace');
  });
});
```

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Create release branch**
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b release/v1.2.0
   ```

2. **Update version**
   ```bash
   npm version minor  # or major/patch
   ```

3. **Update changelog**
   ```markdown
   ## [1.2.0] - 2024-01-15
   
   ### Added
   - New workspace color themes
   - Service preloading for better performance
   
   ### Changed
   - Improved startup time by 30%
   - Updated security policies
   
   ### Fixed
   - Memory leak in browser view management
   - Service loading timeout issues
   ```

4. **Create PR for release branch**
5. **Tag release after merge**
   ```bash
   git tag v1.2.0
   git push upstream v1.2.0
   ```

6. **Create GitHub release**
7. **Deploy/distribute** the new version

### Pre-release Testing

Before releasing:

- [ ] All CI checks pass
- [ ] Manual testing on all platforms
- [ ] Performance benchmarks meet standards
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Migration guides written (if needed)

## Recognition

Contributors will be recognized in:

- README contributors section
- Release notes
- GitHub contributors page
- Special recognition for significant contributions

## Questions?

- **General questions**: Open a GitHub Discussion
- **Bug reports**: Create an issue with the bug template
- **Feature requests**: Create an issue with the feature template
- **Security issues**: Email security@flowdesk.com
- **Chat**: Join our Discord/Slack community

Thank you for contributing to Flow Desk! 🚀