declare global {
  interface Window {
    flowDesk: typeof import('../preload/preload').flowDeskAPI;
    electronAPI: any;
    Electron: any;
  }

  const __DEV__: boolean;
}

export {};
