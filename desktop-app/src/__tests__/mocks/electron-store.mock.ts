/**
 * Mock for electron-store module
 * Provides jest mock functions for electron-store functionality
 */

interface MockStoreData {
  [key: string]: any;
}

class MockElectronStore {
  private data: MockStoreData = {};
  
  get = jest.fn().mockImplementation((key?: string, defaultValue?: any) => {
    if (key === undefined) {
      return this.data;
    }
    return this.data.hasOwnProperty(key) ? this.data[key] : defaultValue;
  });
  
  set = jest.fn().mockImplementation((key: string | MockStoreData, value?: any) => {
    if (typeof key === 'object') {
      Object.assign(this.data, key);
    } else {
      this.data[key] = value;
    }
  });
  
  has = jest.fn().mockImplementation((key: string) => {
    return this.data.hasOwnProperty(key);
  });
  
  delete = jest.fn().mockImplementation((key: string) => {
    delete this.data[key];
  });
  
  clear = jest.fn().mockImplementation(() => {
    this.data = {};
  });
  
  reset = jest.fn().mockImplementation((...keys: string[]) => {
    if (keys.length === 0) {
      this.data = {};
    } else {
      keys.forEach(key => delete this.data[key]);
    }
  });
  
  size = jest.fn().mockImplementation(() => {
    return Object.keys(this.data).length;
  });
  
  store = jest.fn().mockImplementation(() => {
    return { ...this.data };
  });
  
  path = jest.fn().mockReturnValue('/mock/path/config.json');
  
  onDidChange = jest.fn().mockImplementation((key: string, callback: (newValue?: any, oldValue?: any) => void) => {
    // Return unsubscribe function
    return jest.fn();
  });
  
  onDidAnyChange = jest.fn().mockImplementation((callback: (newValue?: any, oldValue?: any) => void) => {
    // Return unsubscribe function
    return jest.fn();
  });
  
  openInEditor = jest.fn();
  
  // Mock methods for testing
  __setMockData = (data: MockStoreData) => {
    this.data = { ...data };
  };
  
  __getMockData = () => {
    return { ...this.data };
  };
  
  __clearMockData = () => {
    this.data = {};
  };
  
  __resetMocks = () => {
    jest.clearAllMocks();
    this.data = {};
  };
}

// Create the mock constructor
const mockElectronStore = jest.fn().mockImplementation((options?: any) => {
  return new MockElectronStore();
});

// Add static methods
mockElectronStore.initRenderer = jest.fn();

// Export both default and named exports
module.exports = mockElectronStore;
module.exports.default = mockElectronStore;
module.exports.MockElectronStore = MockElectronStore;