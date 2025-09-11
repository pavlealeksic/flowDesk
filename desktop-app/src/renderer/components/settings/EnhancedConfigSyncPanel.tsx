/**
 * Enhanced Config Sync Settings Panel
 * 
 * Comprehensive UI for managing configuration synchronization settings,
 * including real-time sync status monitoring, transport configuration,
 * sync controls, device management, and QR code pairing.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ConfigBackup } from '@flow-desk/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useConfigSync } from '../../hooks/useConfigSync';
import { cn } from '../ui/utils';
import { useLogger } from '../../logging/RendererLoggingService';

const logger = useLogger('EnhancedConfigSyncPanel');

interface ConfigSyncPanelProps {
  className?: string;
}

interface RealTimeSyncStatus {
  status: 'idle' | 'syncing' | 'error' | 'connecting' | 'conflict';
  lastActivity: string;
  syncProgress?: number;
  conflictCount?: number;
  queuedChanges?: number;
}

interface TransportStatus {
  name: string;
  status: 'active' | 'connected' | 'discovering' | 'available' | 'error' | 'disabled';
  description: string;
  lastSync?: Date;
  errorMessage?: string;
}

export function EnhancedConfigSyncPanel({ className }: ConfigSyncPanelProps) {
  const { state, actions } = useConfigSync();
  const [qrCodeImage, setQrCodeImage] = useState<string>('');
  const [showQrCode, setShowQrCode] = useState(false);
  const [backups, setBackups] = useState<ConfigBackup[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [realTimeStatus, setRealTimeStatus] = useState<RealTimeSyncStatus>({
    status: 'idle',
    lastActivity: 'No recent activity',
  });
  const [transportStatuses, setTransportStatuses] = useState<TransportStatus[]>([]);
  const [qrExpiryTime, setQrExpiryTime] = useState<Date | null>(null);
  
  const statusCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const qrExpiryTimer = useRef<NodeJS.Timeout | null>(null);

  // Real-time status monitoring
  useEffect(() => {
    const updateRealTimeStatus = async () => {
      try {
        const status = await (window.flowDesk as any)?.invoke('config-sync:get-detailed-status');
        if (status) {
          setRealTimeStatus({
            status: status.currentStatus || 'idle',
            lastActivity: status.lastActivity || 'No recent activity',
            syncProgress: status.syncProgress,
            conflictCount: status.conflicts?.length || 0,
            queuedChanges: status.queuedChanges || 0,
          });

          // Update transport statuses
          setTransportStatuses(status.transports || [
            {
              name: 'Local Storage',
              status: 'active',
              description: 'Configuration stored locally',
              lastSync: status.lastLocalSync ? new Date(status.lastLocalSync) : undefined,
            },
            {
              name: 'iCloud Drive',
              status: status.iCloudAvailable ? 'connected' : 'disabled',
              description: status.iCloudAvailable ? 'Syncing via iCloud Drive' : 'iCloud Drive not available',
              lastSync: status.lastCloudSync ? new Date(status.lastCloudSync) : undefined,
            },
            {
              name: 'LAN Sync',
              status: status.lanDiscovering ? 'discovering' : 'available',
              description: status.lanDiscovering ? 'Discovering devices on local network' : 'LAN sync ready',
            },
            {
              name: 'Import/Export',
              status: 'available',
              description: 'Manual import/export available',
            },
          ]);
        }
      } catch (error) {
        logger.error('Console error', undefined, { originalArgs: ['Failed to get real-time sync status:', error], method: 'console.error' });
        setRealTimeStatus(prev => ({ ...prev, status: 'error' }));
      }
    };

    // Update status immediately and then every 2 seconds
    updateRealTimeStatus();
    statusCheckInterval.current = setInterval(updateRealTimeStatus, 2000);

    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, []);

  // Load backups when panel is opened
  useEffect(() => {
    if (showBackups) {
      loadBackups();
    }
  }, [showBackups]);

  // QR code expiry management
  useEffect(() => {
    if (qrExpiryTime) {
      const timeUntilExpiry = qrExpiryTime.getTime() - Date.now();
      
      if (timeUntilExpiry > 0) {
        qrExpiryTimer.current = setTimeout(() => {
          setShowQrCode(false);
          setQrExpiryTime(null);
          setQrCodeImage('');
        }, timeUntilExpiry);
      }
    }

    return () => {
      if (qrExpiryTimer.current) {
        clearTimeout(qrExpiryTimer.current);
      }
    };
  }, [qrExpiryTime]);

  const loadBackups = async () => {
    try {
      const backupList = await actions.listBackups();
      setBackups(backupList as any);
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to load backups:', error], method: 'console.error' });
    }
  };

  const generateQRCodeDataURL = useCallback(async (data: string): Promise<string> => {
    // Placeholder QR code generation - in real implementation, use qrcode library
    // For now, create a simple placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Create a simple pattern as placeholder
      ctx.fillStyle = 'hsl(var(--foreground))';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(8, 8, 240, 240);
      ctx.fillStyle = 'hsl(var(--foreground))';
      
      // Simple grid pattern
      for (let x = 16; x < 240; x += 16) {
        for (let y = 16; y < 240; y += 16) {
          if ((x + y) % 32 === 0) {
            ctx.fillRect(x, y, 8, 8);
          }
        }
      }
      
      ctx.font = '12px monospace';
      ctx.fillText('QR Code', 96, 128);
      ctx.fillText(`Data: ${data.substring(0, 20)}...`, 64, 144);
    }
    
    return canvas.toDataURL();
  }, []);

  const handleGenerateQR = async () => {
    try {
      const qrData = await actions.generatePairingQR();
      const qrCodeDataURL = await generateQRCodeDataURL(qrData);
      
      setQrCodeImage(qrCodeDataURL);
      setShowQrCode(true);
      setQrExpiryTime(new Date(Date.now() + 5 * 60 * 1000)); // 5 minutes from now
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to generate QR code:', error], method: 'console.error' });
    }
  };

  const handleCreateBackup = async () => {
    try {
      const description = `Manual backup ${new Date().toLocaleString()}`;
      await actions.createBackup(description);
      if (showBackups) {
        await loadBackups();
      }
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to create backup:', error], method: 'console.error' });
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (confirm('Are you sure you want to restore this backup? Current configuration will be replaced.')) {
      try {
        await actions.restoreBackup(backupId);
        await loadBackups();
      } catch (error) {
        logger.error('Console error', undefined, { originalArgs: ['Failed to restore backup:', error], method: 'console.error' });
      }
    }
  };

  const handleForceSync = async () => {
    try {
      await (window.flowDesk as any)?.invoke('config-sync:force-sync');
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Force sync failed:', error], method: 'console.error' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'syncing':
      case 'connecting':
        return <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>;
      case 'error':
        return <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></div>;
      case 'conflict':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>;
      default:
        return <div className="w-2 h-2 bg-green-500 rounded-full"></div>;
    }
  };

  const getTimeUntilExpiry = () => {
    if (!qrExpiryTime) return '';
    const timeLeft = Math.max(0, qrExpiryTime.getTime() - Date.now());
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Enhanced Sync Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Real-Time Sync Status</h3>
          <div className="flex items-center gap-2">
            <div className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              state.initialized
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-muted text-muted-foreground'
            )}>
              {state.initialized ? 'Connected' : 'Not Initialized'}
            </div>
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
              realTimeStatus.status === 'syncing' && 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
              realTimeStatus.status === 'error' && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
              realTimeStatus.status === 'conflict' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
              realTimeStatus.status === 'idle' && 'bg-muted text-muted-foreground'
            )}>
              {getStatusIcon(realTimeStatus.status)}
              {realTimeStatus.status.charAt(0).toUpperCase() + realTimeStatus.status.slice(1)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Last Sync</p>
            <p className="font-medium">
              {state.lastSync ? state.lastSync.toLocaleString() : 'Never'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Auto Sync</p>
            <p className="font-medium">
              {state.autoSync ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>

        {/* Real-time activity and metrics */}
        <div className="mb-4 space-y-2">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Activity</p>
            <p className="text-sm font-mono bg-muted p-2 rounded">
              {realTimeStatus.lastActivity}
            </p>
          </div>
          
          {realTimeStatus.syncProgress && realTimeStatus.syncProgress > 0 && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sync Progress</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${realTimeStatus.syncProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{realTimeStatus.syncProgress}% complete</p>
            </div>
          )}

          {((realTimeStatus.conflictCount || 0) > 0 || (realTimeStatus.queuedChanges || 0) > 0) && (
            <div className="flex gap-4 text-sm">
              {(realTimeStatus.conflictCount || 0) > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  {realTimeStatus.conflictCount} conflicts
                </span>
              )}
              {(realTimeStatus.queuedChanges || 0) > 0 && (
                <span className="text-blue-600 dark:text-blue-400">
                  {realTimeStatus.queuedChanges} queued changes
                </span>
              )}
            </div>
          )}
        </div>

        {state.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
            <p className="text-sm text-red-800 dark:text-red-200">{state.error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={actions.performSync}
            disabled={state.syncing || !state.initialized}
            className="flex-1"
          >
            {state.syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
          <Button
            variant="outline"
            onClick={handleForceSync}
            disabled={!state.initialized}
          >
            Force Sync
          </Button>
          <Button
            variant="outline"
            onClick={() => actions.refreshDiscoveredDevices()}
            disabled={!state.initialized}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Enhanced Sync Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Sync Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto Sync</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically sync configuration changes across devices
              </p>
            </div>
            <Button
              variant={state.autoSync ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => actions.setAutoSync(!state.autoSync)}
            >
              {state.autoSync ? 'On' : 'Off'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Sync Interval (minutes)
              </label>
              <Input
                type="number"
                min="1"
                max="1440"
                value={state.syncInterval.toString()}
                onChange={(e) => actions.setSyncInterval(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Conflict Resolution
              </label>
              <select className="w-full p-2 border rounded-md">
                <option value="manual">Manual Review</option>
                <option value="newest">Newest Wins</option>
                <option value="oldest">Oldest Wins</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Enhanced Device Pairing */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Device Pairing</h3>
        
        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={handleGenerateQR}
            className="w-full"
            disabled={showQrCode}
          >
            {showQrCode ? 'QR Code Generated' : 'Generate Pairing QR Code'}
          </Button>

          {showQrCode && (
            <div className="border rounded-md p-4 text-center bg-card">
              <div className="w-64 h-64 mx-auto mb-4 flex items-center justify-center border rounded-lg">
                {qrCodeImage ? (
                  <img src={qrCodeImage} alt="Pairing QR Code" className="w-full h-full rounded-lg" />
                ) : (
                  <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <p className="text-sm text-gray-500">Generating QR Code...</p>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Scan this code from another Flow Desk device to pair
              </p>
              
              {qrExpiryTime && (
                <p className="text-xs text-red-500 mb-4">
                  Expires in: {getTimeUntilExpiry()}
                </p>
              )}
              
              <div className="flex gap-2 justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateQR}
                >
                  Refresh QR
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowQrCode(false);
                    setQrExpiryTime(null);
                    setQrCodeImage('');
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          )}

          {state.discoveredDevices.length > 0 && (
            <div>
              <p className="font-medium mb-2">Discovered Devices</p>
              <div className="space-y-2">
                {state.discoveredDevices.map((device, index) => (
                  <div
                    key={device.id || index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {device.type === 'mobile' ? '📱' : '💻'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{device.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {device.type} • {device.platform}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        Pair
                      </Button>
                      <Button size="sm" variant="ghost">
                        Info
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Enhanced Transport Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Transport Status</h3>
        
        <div className="space-y-3">
          {transportStatuses.map((transport, index) => (
            <TransportStatusRow key={index} {...transport} />
          ))}
        </div>
      </Card>

      {/* Import/Export */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Import/Export</h3>
        
        <div className="flex gap-2 mb-4">
          <Button
            variant="outline"
            onClick={actions.exportConfig}
            className="flex-1"
          >
            Export Configuration
          </Button>
          <Button
            variant="outline"
            onClick={actions.importConfig}
            className="flex-1"
          >
            Import Configuration
          </Button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Export your configuration as an encrypted .workosync file or import from another device.
          All sensitive data is encrypted before export.
        </p>
      </Card>

      {/* Enhanced Backups */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Configuration Backups</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateBackup}
            >
              Create Backup
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowBackups(!showBackups);
                if (!showBackups) {
                  loadBackups();
                }
              }}
            >
              {showBackups ? 'Hide' : 'Show'} Backups
            </Button>
          </div>
        </div>

        {showBackups && (
          <div className="space-y-2">
            {backups.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  No backups available
                </p>
                <p className="text-xs text-gray-500">
                  Create a backup to preserve your current configuration
                </p>
              </div>
            ) : (
              backups.map((backup, index) => (
                <div
                  key={backup.id || index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium">💾</span>
                    </div>
                    <div>
                      <p className="font-medium">{backup.description || `Backup ${index + 1}`}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(backup.timestamp).toLocaleString()}
                        {backup.size && ` • ${(backup.size / 1024).toFixed(1)}KB`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestoreBackup(backup.id)}
                    >
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Delete backup functionality would go here
                        if (confirm('Are you sure you want to delete this backup?')) {
                          // Implementation for delete backup
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// Enhanced Transport Status Row Component
interface TransportStatusRowProps {
  name: string;
  status: 'active' | 'connected' | 'discovering' | 'available' | 'error' | 'disabled';
  description: string;
  lastSync?: Date;
  errorMessage?: string;
}

function TransportStatusRow({ name, status, description, lastSync, errorMessage }: TransportStatusRowProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'connected':
        return 'bg-green-500';
      case 'discovering':
        return 'bg-yellow-500 animate-pulse';
      case 'available':
        return 'bg-gray-400';
      case 'error':
        return 'bg-red-500';
      case 'disabled':
        return 'bg-gray-300';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 border">
      <div className="flex items-center gap-3">
        <div className={cn('w-3 h-3 rounded-full', getStatusColor(status))}></div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{name}</span>
            {status === 'error' && errorMessage && (
              <span className="text-xs bg-red-100 text-red-800 px-1 rounded">⚠️</span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
          {lastSync && (
            <p className="text-xs text-gray-500">
              Last sync: {lastSync.toLocaleTimeString()}
            </p>
          )}
          {errorMessage && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
          {status}
        </span>
      </div>
    </div>
  );
}