import type { FlowDeskAPI } from './preload';

declare global {
  interface Window {
    flowDesk: FlowDeskAPI;
    searchAPI: FlowDeskAPI['searchAPI'];
    electronAPI: FlowDeskAPI;
    Electron: any;
  }

  const __DEV__: boolean;
}

export {};
