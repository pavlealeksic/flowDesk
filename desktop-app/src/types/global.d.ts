declare global {
  interface Window {
    flowDesk: import('../preload/preload').FlowDeskAPI;
    searchAPI: import('../preload/preload').FlowDeskAPI['searchAPI'];
    electronAPI: import('../preload/preload').FlowDeskAPI;
    Electron: any;
  }

  const __DEV__: boolean;
}

export {};
