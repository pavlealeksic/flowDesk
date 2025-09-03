import type { FlowDeskAPI } from './preload';

declare global {
  interface Window {
    flowDesk: FlowDeskAPI;
    searchAPI: FlowDeskAPI['searchAPI'];
  }

  const __DEV__: boolean;
}

export {};
