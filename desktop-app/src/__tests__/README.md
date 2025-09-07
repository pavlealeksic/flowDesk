# Flow Desk Testing Suite

This comprehensive testing suite ensures the reliability, functionality, and performance of the Flow Desk Electron application. The testing strategy covers unit tests, integration tests, and end-to-end tests for all critical components.

## 🏗️ Testing Architecture

### Test Types

1. **Unit Tests** - Test individual components and functions in isolation
2. **Integration Tests** - Test interactions between components and systems
3. **End-to-End Tests** - Test complete user workflows in the actual application

### Testing Frameworks

- **Jest** - Main process unit and integration testing
- **Vitest** - Renderer process unit testing (faster than Jest for React)
- **Playwright** - End-to-end testing for Electron applications
- **React Testing Library** - React component testing utilities

## 📁 Directory Structure

```
src/__tests__/
├── README.md                     # This file - testing documentation
├── setup/                        # Test configuration and setup files
│   ├── vitestSetup.ts            # Vitest (renderer) test setup
│   └── jestSetup.ts              # Jest (main process) test setup
├── mocks/                        # Mock implementations
│   ├── electron.mock.ts          # Comprehensive Electron API mocks
│   ├── electron-log.mock.ts      # Electron log module mock
│   └── electron-store.mock.ts    # Electron store module mock
├── main/                         # Main process unit tests
│   ├── workspace.test.ts         # WorkspaceManager class tests
│   └── main.test.ts              # Main application process tests
├── renderer/                     # Renderer process unit tests
│   ├── App.test.tsx              # Main App component tests
│   └── store/                    # Redux store tests
│       └── workspaceSlice.test.ts # Workspace Redux slice tests
├── integration/                  # Integration tests
│   ├── ipc-communication.test.ts # IPC message flow tests
│   └── workspace-persistence.test.ts # File system integration tests
└── e2e/                          # End-to-end tests
    ├── setup/                    # E2E test setup
    │   ├── globalSetup.ts        # Playwright global setup
    │   └── globalTeardown.ts     # Playwright global teardown
    ├── fixtures/                 # Test fixtures and utilities
    │   └── electron-app.ts       # Electron app fixture for Playwright
    └── workspace-management.spec.ts # E2E workflow tests
```

## 🚀 Running Tests

### Quick Commands

```bash
# Run all tests (unit + integration)
npm test

# Run all tests including E2E
npm run test:all

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only

# Watch mode for development
npm run test:watch         # Watch renderer tests
npm run test:watch:main    # Watch main process tests

# Coverage reports
npm run test:coverage      # Generate coverage reports
npm run test:coverage:all  # Coverage + E2E tests
```

### Detailed Commands

```bash
# Unit Tests
npm run test:unit:main     # Main process unit tests (Jest)
npm run test:unit:renderer # Renderer unit tests (Vitest)

# E2E Tests with options
npm run test:e2e:headed    # Run E2E tests with visible browser
npm run test:e2e:debug     # Run E2E tests in debug mode

# CI/CD pipeline
npm run test:ci            # Run all tests with CI reporters
```

## 🎯 Test Coverage

### Coverage Targets

- **Overall Coverage**: 80%+
- **Critical Components**: 90%+
  - WorkspaceManager: 90%+
  - Main process (main.ts): 80%+
  - IPC handlers: 100%
- **React Components**: 70%+
- **Redux Store**: 80%+

### Coverage Exclusions

- Type definition files (*.d.ts)
- Test files themselves
- Build and configuration files
- Example and demo code
- External dependencies

### Viewing Coverage Reports

```bash
npm run test:coverage
# Coverage reports generated in:
# - coverage/main/      (Jest/main process coverage)
# - coverage/renderer/  (Vitest/renderer coverage)
# - coverage/           (Combined HTML report)
```

## 🧪 Test Categories

### Unit Tests

#### Main Process Tests (`src/__tests__/main/`)

- **WorkspaceManager** (`workspace.test.ts`)
  - Workspace CRUD operations
  - Service management
  - Browser view management
  - File system persistence
  - Error handling and recovery

- **Main Application** (`main.test.ts`)
  - Application initialization
  - IPC handler registration
  - Security configuration
  - Menu setup
  - Window management

#### Renderer Tests (`src/__tests__/renderer/`)

- **App Component** (`App.test.tsx`)
  - Component rendering and layout
  - Workspace switching
  - Service loading
  - Keyboard shortcuts
  - Modal management
  - Error boundaries

- **Redux Store** (`store/workspaceSlice.test.ts`)
  - Action creators
  - Reducers
  - Selectors
  - Async thunks
  - State normalization

### Integration Tests (`src/__tests__/integration/`)

- **IPC Communication** (`ipc-communication.test.ts`)
  - Complete IPC message flows
  - Error handling across processes
  - Concurrent request handling
  - Handler registration validation

- **Workspace Persistence** (`workspace-persistence.test.ts`)
  - File system operations
  - Data integrity
  - Crash recovery scenarios
  - Large dataset handling

### End-to-End Tests (`src/__tests__/e2e/`)

- **Workspace Management** (`workspace-management.spec.ts`)
  - Application startup
  - Workspace navigation
  - Service management workflows
  - Keyboard navigation
  - UI responsiveness
  - Error handling
  - Accessibility compliance
  - Performance benchmarks

## 🔧 Configuration Files

### Jest Configuration (`jest.config.js`)
- Main process testing configuration
- Module mocking setup
- Coverage thresholds
- Timeout settings

### Vitest Configuration (`vitest.config.ts`)
- Renderer process testing configuration
- React component testing setup
- Coverage configuration
- Test environment setup

### Playwright Configuration (`playwright.config.ts`)
- Electron E2E testing configuration
- Browser automation settings
- Test reporting
- Screenshot and video capture

## 🎭 Mocking Strategy

### Electron API Mocks (`mocks/electron.mock.ts`)

Comprehensive mocks for:
- BrowserWindow and BrowserView
- IPC communication (ipcMain/ipcRenderer)
- Session management
- Dialog and shell operations
- Menu and system preferences

### Testing Utilities

- Window management helpers
- Event simulation utilities
- State assertion helpers
- Data generation functions

## 🐛 Debugging Tests

### Main Process Tests
```bash
# Debug Jest tests
npm run test:watch:main -- --verbose

# Debug specific test file
npx jest src/__tests__/main/workspace.test.ts --verbose
```

### Renderer Tests
```bash
# Debug Vitest tests
npm run test:watch

# Debug with UI
npx vitest --ui
```

### E2E Tests
```bash
# Debug E2E tests with visible browser
npm run test:e2e:debug

# Generate test traces
npx playwright test --trace on
```

## 🎯 Best Practices

### Writing Tests

1. **Descriptive Test Names**: Use clear, specific test descriptions
2. **AAA Pattern**: Arrange, Act, Assert
3. **Isolation**: Each test should be independent
4. **Mocking**: Mock external dependencies appropriately
5. **Error Cases**: Test both success and failure scenarios
6. **Edge Cases**: Test boundary conditions and unusual inputs

### Test Structure

```typescript
describe('Component/Feature Name', () => {
  beforeEach(() => {
    // Setup for each test
  });

  describe('Specific Functionality', () => {
    test('should handle specific scenario correctly', async () => {
      // Arrange
      const mockData = createMockData();
      
      // Act
      const result = await functionUnderTest(mockData);
      
      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Performance Testing

- Measure load times
- Test with large datasets
- Monitor memory usage
- Verify no memory leaks

### Accessibility Testing

- Test keyboard navigation
- Verify ARIA labels
- Check screen reader compatibility
- Test color contrast and visual elements

## 📊 CI/CD Integration

### Pre-commit Hooks
```bash
# Run before every commit
npm run pretest    # Type checking
npm test          # Unit and integration tests
npm run lint      # Code linting
```

### CI Pipeline
```bash
# Complete CI pipeline
npm run test:ci
# Includes:
# - Type checking
# - Unit tests
# - Integration tests
# - E2E tests
# - Coverage reporting
# - JSON test reports
```

## 🚨 Troubleshooting

### Common Issues

1. **Electron App Won't Launch**
   - Ensure app is built: `npm run build`
   - Check main process path in E2E fixtures
   - Verify dependencies are installed

2. **Tests Timing Out**
   - Increase timeout in configuration files
   - Check for hanging promises
   - Verify mock implementations

3. **Coverage Not Accurate**
   - Ensure source maps are generated
   - Check coverage exclusion patterns
   - Verify test file patterns

4. **E2E Tests Flaky**
   - Add proper wait conditions
   - Increase retry counts
   - Check for race conditions

### Debug Commands
```bash
# Verbose test output
npm test -- --verbose

# Run single test file
npx jest src/__tests__/main/workspace.test.ts

# Run specific test pattern
npm test -- --testNamePattern="should create workspace"

# Generate detailed coverage
npm run test:coverage -- --verbose
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/tutorial/automated-testing)

## 🤝 Contributing

When adding new features:

1. **Write tests first** (TDD approach)
2. **Ensure existing tests pass**
3. **Add integration tests** for new IPC handlers
4. **Update E2E tests** for new user workflows
5. **Maintain coverage thresholds**
6. **Update this documentation** as needed

---

*This testing suite ensures Flow Desk maintains high quality and reliability as it evolves. All tests are designed to be fast, reliable, and comprehensive.*