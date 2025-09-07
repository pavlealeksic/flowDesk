/**
 * Comprehensive Electron API mocks for testing
 * Provides mock implementations for all Electron modules used in the application
 */

export interface MockBrowserWindow {
  id: number;
  webContents: MockWebContents;
  isDestroyed: () => boolean;
  close: () => void;
  focus: () => void;
  show: () => void;
  hide: () => void;
  minimize: () => void;
  maximize: () => void;
  unmaximize: () => void;
  setFullScreen: (flag: boolean) => void;
  isFullScreen: () => boolean;
  setBounds: (bounds: { x?: number; y?: number; width?: number; height?: number }) => void;
  getBounds: () => { x: number; y: number; width: number; height: number };
  getContentBounds: () => { x: number; y: number; width: number; height: number };
  setSize: (width: number, height: number, animate?: boolean) => void;
  getSize: () => [number, number];
  setPosition: (x: number, y: number, animate?: boolean) => void;
  getPosition: () => [number, number];
  setTitle: (title: string) => void;
  getTitle: () => string;
  loadFile: (filePath: string) => Promise<void>;
  loadURL: (url: string) => Promise<void>;
  addBrowserView: (browserView: MockBrowserView) => void;
  removeBrowserView: (browserView: MockBrowserView) => void;
  getBrowserViews: () => MockBrowserView[];
  on: (event: string, listener: (...args: any[]) => void) => MockBrowserWindow;
  once: (event: string, listener: (...args: any[]) => void) => MockBrowserWindow;
  off: (event: string, listener: (...args: any[]) => void) => MockBrowserWindow;
  emit: (event: string, ...args: any[]) => boolean;
  removeAllListeners: (event?: string) => MockBrowserWindow;
}

export interface MockWebContents {
  id: number;
  session: MockSession;
  loadURL: jest.Mock;
  loadFile: jest.Mock;
  getURL: jest.Mock;
  getTitle: jest.Mock;
  isLoading: jest.Mock;
  isDestroyed: jest.Mock;
  focus: jest.Mock;
  isFocused: jest.Mock;
  canGoBack: jest.Mock;
  canGoForward: jest.Mock;
  goBack: jest.Mock;
  goForward: jest.Mock;
  reload: jest.Mock;
  reloadIgnoringCache: jest.Mock;
  stop: jest.Mock;
  openDevTools: jest.Mock;
  closeDevTools: jest.Mock;
  isDevToolsOpened: jest.Mock;
  send: jest.Mock;
  sendToFrame: jest.Mock;
  setWindowOpenHandler: jest.Mock;
  on: jest.Mock;
  once: jest.Mock;
  off: jest.Mock;
  emit: jest.Mock;
  removeAllListeners: jest.Mock;
}

export interface MockBrowserView {
  id: number;
  webContents: MockWebContents;
  setBounds: jest.Mock;
  getBounds: jest.Mock;
  setBackgroundColor: jest.Mock;
  setAutoResize: jest.Mock;
  destroy: jest.Mock;
  isDestroyed: jest.Mock;
}

export interface MockSession {
  id: string;
  clearStorageData: jest.Mock;
  clearCache: jest.Mock;
  clearAuthCache: jest.Mock;
  clearHostResolverCache: jest.Mock;
  webRequest: {
    onBeforeSendHeaders: jest.Mock;
    onHeadersReceived: jest.Mock;
    onBeforeRequest: jest.Mock;
    onCompleted: jest.Mock;
    onErrorOccurred: jest.Mock;
  };
  cookies: {
    get: jest.Mock;
    set: jest.Mock;
    remove: jest.Mock;
  };
}

export interface MockIpcMain {
  handle: jest.Mock;
  on: jest.Mock;
  once: jest.Mock;
  removeHandler: jest.Mock;
  removeAllListeners: jest.Mock;
}

export interface MockIpcRenderer {
  invoke: jest.Mock;
  send: jest.Mock;
  on: jest.Mock;
  once: jest.Mock;
  removeAllListeners: jest.Mock;
}

export interface MockDialog {
  showOpenDialog: jest.Mock;
  showSaveDialog: jest.Mock;
  showMessageBox: jest.Mock;
  showErrorBox: jest.Mock;
  showCertificateTrustDialog: jest.Mock;
}

export interface MockShell {
  openExternal: jest.Mock;
  openPath: jest.Mock;
  showItemInFolder: jest.Mock;
  moveItemToTrash: jest.Mock;
  beep: jest.Mock;
}

export interface MockApp {
  quit: jest.Mock;
  exit: jest.Mock;
  relaunch: jest.Mock;
  isReady: jest.Mock;
  whenReady: jest.Mock;
  dock: {
    setBadge: jest.Mock;
    getBadge: jest.Mock;
    hide: jest.Mock;
    show: jest.Mock;
  };
  getVersion: jest.Mock;
  getName: jest.Mock;
  setName: jest.Mock;
  getPath: jest.Mock;
  getAppPath: jest.Mock;
  setPath: jest.Mock;
  requestSingleInstanceLock: jest.Mock;
  hasSingleInstanceLock: jest.Mock;
  releaseSingleInstanceLock: jest.Mock;
  setAboutPanelOptions: jest.Mock;
  getLoginItemSettings: jest.Mock;
  setLoginItemSettings: jest.Mock;
  on: jest.Mock;
  once: jest.Mock;
  off: jest.Mock;
  emit: jest.Mock;
  removeAllListeners: jest.Mock;
}

export interface MockMenu {
  buildFromTemplate: jest.Mock;
  setApplicationMenu: jest.Mock;
  getApplicationMenu: jest.Mock;
  popup: jest.Mock;
  closePopup: jest.Mock;
}

// Create mock instances
let mockWindowIdCounter = 1;
let mockBrowserViewIdCounter = 1;
let mockSessionIdCounter = 1;

const createMockWebContents = (): MockWebContents => ({
  id: mockWindowIdCounter++,
  session: createMockSession(),
  loadURL: jest.fn().mockResolvedValue(undefined),
  loadFile: jest.fn().mockResolvedValue(undefined),
  getURL: jest.fn().mockReturnValue('about:blank'),
  getTitle: jest.fn().mockReturnValue('Mock Window'),
  isLoading: jest.fn().mockReturnValue(false),
  isDestroyed: jest.fn().mockReturnValue(false),
  focus: jest.fn(),
  isFocused: jest.fn().mockReturnValue(true),
  canGoBack: jest.fn().mockReturnValue(false),
  canGoForward: jest.fn().mockReturnValue(false),
  goBack: jest.fn(),
  goForward: jest.fn(),
  reload: jest.fn(),
  reloadIgnoringCache: jest.fn(),
  stop: jest.fn(),
  openDevTools: jest.fn(),
  closeDevTools: jest.fn(),
  isDevToolsOpened: jest.fn().mockReturnValue(false),
  send: jest.fn(),
  sendToFrame: jest.fn(),
  setWindowOpenHandler: jest.fn(),
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockReturnThis(),
  off: jest.fn().mockReturnThis(),
  emit: jest.fn().mockReturnValue(true),
  removeAllListeners: jest.fn().mockReturnThis()
});

const createMockSession = (): MockSession => ({
  id: `mock-session-${mockSessionIdCounter++}`,
  clearStorageData: jest.fn().mockResolvedValue(undefined),
  clearCache: jest.fn().mockResolvedValue(undefined),
  clearAuthCache: jest.fn().mockResolvedValue(undefined),
  clearHostResolverCache: jest.fn(),
  webRequest: {
    onBeforeSendHeaders: jest.fn(),
    onHeadersReceived: jest.fn(),
    onBeforeRequest: jest.fn(),
    onCompleted: jest.fn(),
    onErrorOccurred: jest.fn()
  },
  cookies: {
    get: jest.fn().mockResolvedValue([]),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  }
});

const createMockBrowserWindow = (): MockBrowserWindow => {
  const id = mockWindowIdCounter++;
  const mockWindow: MockBrowserWindow = {
    id,
    webContents: createMockWebContents(),
    isDestroyed: jest.fn().mockReturnValue(false),
    close: jest.fn(),
    focus: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    minimize: jest.fn(),
    maximize: jest.fn(),
    unmaximize: jest.fn(),
    setFullScreen: jest.fn(),
    isFullScreen: jest.fn().mockReturnValue(false),
    setBounds: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 1024, height: 768 }),
    getContentBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 1024, height: 768 }),
    setSize: jest.fn(),
    getSize: jest.fn().mockReturnValue([1024, 768]),
    setPosition: jest.fn(),
    getPosition: jest.fn().mockReturnValue([0, 0]),
    setTitle: jest.fn(),
    getTitle: jest.fn().mockReturnValue('Mock Window'),
    loadFile: jest.fn().mockResolvedValue(undefined),
    loadURL: jest.fn().mockResolvedValue(undefined),
    addBrowserView: jest.fn(),
    removeBrowserView: jest.fn(),
    getBrowserViews: jest.fn().mockReturnValue([]),
    on: jest.fn().mockReturnValue(mockWindow),
    once: jest.fn().mockReturnValue(mockWindow),
    off: jest.fn().mockReturnValue(mockWindow),
    emit: jest.fn().mockReturnValue(true),
    removeAllListeners: jest.fn().mockReturnValue(mockWindow)
  };
  
  return mockWindow;
};

const createMockBrowserView = (): MockBrowserView => ({
  id: mockBrowserViewIdCounter++,
  webContents: createMockWebContents(),
  setBounds: jest.fn(),
  getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
  setBackgroundColor: jest.fn(),
  setAutoResize: jest.fn(),
  destroy: jest.fn(),
  isDestroyed: jest.fn().mockReturnValue(false)
});

// Mock Electron modules
const mockApp: MockApp = {
  quit: jest.fn(),
  exit: jest.fn(),
  relaunch: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
  whenReady: jest.fn().mockResolvedValue(undefined),
  dock: {
    setBadge: jest.fn(),
    getBadge: jest.fn().mockReturnValue(''),
    hide: jest.fn(),
    show: jest.fn()
  },
  getVersion: jest.fn().mockReturnValue('1.0.0'),
  getName: jest.fn().mockReturnValue('Flow Desk'),
  setName: jest.fn(),
  getPath: jest.fn().mockReturnValue('/mock/path'),
  getAppPath: jest.fn().mockReturnValue('/mock/app/path'),
  setPath: jest.fn(),
  requestSingleInstanceLock: jest.fn().mockReturnValue(true),
  hasSingleInstanceLock: jest.fn().mockReturnValue(true),
  releaseSingleInstanceLock: jest.fn(),
  setAboutPanelOptions: jest.fn(),
  getLoginItemSettings: jest.fn().mockReturnValue({ openAtLogin: false }),
  setLoginItemSettings: jest.fn(),
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockReturnThis(),
  off: jest.fn().mockReturnThis(),
  emit: jest.fn().mockReturnValue(true),
  removeAllListeners: jest.fn().mockReturnThis()
};

const mockBrowserWindow = jest.fn().mockImplementation((options?) => createMockBrowserWindow());
mockBrowserWindow.getAllWindows = jest.fn().mockReturnValue([]);
mockBrowserWindow.getFocusedWindow = jest.fn().mockReturnValue(null);

const mockBrowserView = jest.fn().mockImplementation((options?) => createMockBrowserView());

const mockIpcMain: MockIpcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeHandler: jest.fn(),
  removeAllListeners: jest.fn()
};

const mockIpcRenderer: MockIpcRenderer = {
  invoke: jest.fn().mockResolvedValue(undefined),
  send: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeAllListeners: jest.fn()
};

const mockDialog: MockDialog = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
  showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: undefined }),
  showMessageBox: jest.fn().mockResolvedValue({ response: 0, checkboxChecked: false }),
  showErrorBox: jest.fn(),
  showCertificateTrustDialog: jest.fn().mockResolvedValue(undefined)
};

const mockShell: MockShell = {
  openExternal: jest.fn().mockResolvedValue(undefined),
  openPath: jest.fn().mockResolvedValue(''),
  showItemInFolder: jest.fn(),
  moveItemToTrash: jest.fn().mockReturnValue(true),
  beep: jest.fn()
};

const mockSession = {
  fromPartition: jest.fn().mockImplementation((partition: string) => createMockSession()),
  defaultSession: createMockSession()
};

const mockMenu: MockMenu = {
  buildFromTemplate: jest.fn().mockReturnValue({}),
  setApplicationMenu: jest.fn(),
  getApplicationMenu: jest.fn().mockReturnValue(null),
  popup: jest.fn(),
  closePopup: jest.fn()
};

const mockSystemPreferences = {
  isDarkMode: jest.fn().mockReturnValue(false),
  getAccentColor: jest.fn().mockReturnValue('#007acc'),
  getSystemColor: jest.fn().mockReturnValue('#ffffff'),
  isInvertedColorScheme: jest.fn().mockReturnValue(false),
  getMediaAccessStatus: jest.fn().mockReturnValue('granted'),
  askForMediaAccess: jest.fn().mockResolvedValue(true)
};

// Main export - the Electron module mock
module.exports = {
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  BrowserView: mockBrowserView,
  ipcMain: mockIpcMain,
  ipcRenderer: mockIpcRenderer,
  dialog: mockDialog,
  shell: mockShell,
  session: mockSession,
  Menu: mockMenu,
  systemPreferences: mockSystemPreferences,
  
  // Utility functions for tests
  __resetMocks: () => {
    jest.clearAllMocks();
    mockWindowIdCounter = 1;
    mockBrowserViewIdCounter = 1;
    mockSessionIdCounter = 1;
  },
  
  __createMockBrowserWindow: createMockBrowserWindow,
  __createMockBrowserView: createMockBrowserView,
  __createMockSession: createMockSession
};