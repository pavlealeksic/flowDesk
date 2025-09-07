import { expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock global objects that would be available in Electron renderer
beforeAll(() => {
  // Mock window.flowDesk API
  Object.defineProperty(window, 'flowDesk', {
    value: {
      workspace: {
        create: vi.fn(),
        list: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        addService: vi.fn(),
        removeService: vi.fn(),
        loadService: vi.fn(),
        switch: vi.fn(),
        update: vi.fn(),
        clearData: vi.fn(),
        getWindows: vi.fn(),
        createWindow: vi.fn()
      },
      browserView: {
        hide: vi.fn(),
        show: vi.fn()
      },
      theme: {
        get: vi.fn(),
        set: vi.fn()
      },
      system: {
        showNotification: vi.fn(),
        showDialog: vi.fn(),
        openExternal: vi.fn()
      },
      settings: {
        get: vi.fn(),
        set: vi.fn()
      }
    },
    writable: true,
    configurable: true
  });

  // Mock IntersectionObserver for components that might use it
  Object.defineProperty(window, 'IntersectionObserver', {
    value: vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
    writable: true,
  });

  // Mock ResizeObserver for components that might use it
  Object.defineProperty(window, 'ResizeObserver', {
    value: vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
    writable: true,
  });

  // Mock matchMedia for responsive components
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  });

  // Mock HTMLElement methods that might not be available in test environment
  if (typeof HTMLElement !== 'undefined') {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.focus = vi.fn();
    HTMLElement.prototype.blur = vi.fn();
  }

  // Mock console methods for cleaner test output
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset window.flowDesk to default state
  if (window.flowDesk) {
    Object.values(window.flowDesk).forEach(api => {
      if (typeof api === 'object' && api !== null) {
        Object.values(api).forEach(method => {
          if (vi.isMockFunction(method)) {
            method.mockReset();
          }
        });
      }
    });
  }
});

afterEach(() => {
  // Cleanup after each test
  vi.clearAllMocks();
  vi.clearAllTimers();
  
  // Clean up DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

afterAll(() => {
  // Global cleanup
  vi.restoreAllMocks();
});