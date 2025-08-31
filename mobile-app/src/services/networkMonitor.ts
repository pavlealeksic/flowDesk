/**
 * Network Monitor Service - Tracks network connectivity for offline-first architecture
 */

import NetInfo from '@react-native-community/netinfo';
import { useStore } from '../store';

export class NetworkMonitor {
  private static instance: NetworkMonitor | null = null;
  private unsubscribe: (() => void) | null = null;
  
  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }
  
  start() {
    if (this.unsubscribe) {
      return; // Already started
    }
    
    // Initial network state check
    NetInfo.fetch().then(state => {
      this.handleNetworkStateChange(state);
    });
    
    // Subscribe to network state changes
    this.unsubscribe = NetInfo.addEventListener(state => {
      this.handleNetworkStateChange(state);
    });
  }
  
  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
  
  private handleNetworkStateChange(state: any) {
    const isOnline = state.isConnected && state.isInternetReachable !== false;
    
    // Update store with network status
    useStore.getState().setOfflineStatus(!isOnline);
    
    // Update sync status
    if (useStore.getState().status) {
      useStore.getState().status.isOnline = isOnline;
    }
    
    // Trigger sync when coming back online
    if (isOnline && useStore.getState().canSync?.()) {
      setTimeout(() => {
        useStore.getState().syncNow?.();
      }, 1000); // Small delay to ensure connection is stable
    }
    
    console.log(`Network state changed: ${isOnline ? 'online' : 'offline'}`);
  }
  
  async getCurrentNetworkState() {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      details: state.details,
    };
  }
}

// Auto-start network monitoring
export const startNetworkMonitoring = () => {
  NetworkMonitor.getInstance().start();
};

export const stopNetworkMonitoring = () => {
  NetworkMonitor.getInstance().stop();
};