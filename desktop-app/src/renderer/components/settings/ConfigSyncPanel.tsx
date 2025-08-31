/**
 * Config Sync Settings Panel
 * 
 * Enhanced UI for managing configuration synchronization settings,
 * including real-time sync status, transport configuration, sync controls,
 * device management, and QR code pairing.
 */

import React from 'react';
import { EnhancedConfigSyncPanel } from './EnhancedConfigSyncPanel';

interface ConfigSyncPanelProps {
  className?: string;
}

export function ConfigSyncPanel({ className }: ConfigSyncPanelProps) {
  // Use the enhanced version with all the new features
  return <EnhancedConfigSyncPanel className={className} />;
}