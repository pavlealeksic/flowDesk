/**
 * Mobile Config Sync Settings Screen
 * 
 * Comprehensive mobile UI for configuration synchronization,
 * including device pairing with QR codes, sync status monitoring,
 * and transport management.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
  Switch,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Camera } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { configSyncService, ConfigSyncState, PairedDevice, TransportStatus } from '../../services/configSyncService';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface ConfigSyncScreenProps {
  theme: 'light' | 'dark';
}

export default function ConfigSyncScreen({ theme }: ConfigSyncScreenProps) {
  const [syncState, setSyncState] = useState<ConfigSyncState>();
  const [showQRCode, setShowQRCode] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrData, setQrData] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [realTimeStatus, setRealTimeStatus] = useState<any>(null);
  const [selectedDevice, setSelectedDevice] = useState<PairedDevice | null>(null);
  const refreshInterval = useRef<NodeJS.Timeout>();

  const styles = createStyles(theme);

  useEffect(() => {
    initializeConfigSync();
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    // Real-time status updates
    refreshInterval.current = setInterval(async () => {
      try {
        const status = await configSyncService.getDetailedSyncStatus();
        setRealTimeStatus(status);
      } catch (error) {
        console.error('Failed to get real-time status:', error);
      }
    }, 2000);

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, []);

  const initializeConfigSync = async () => {
    try {
      if (!configSyncService.getSyncState().initialized) {
        await configSyncService.initialize();
      }
      
      const state = configSyncService.getSyncState();
      setSyncState(state);
      
      // Set up event listeners
      configSyncService.on('syncStarted', () => {
        setSyncState(prev => prev ? { ...prev, syncing: true } : prev);
      });

      configSyncService.on('syncCompleted', () => {
        setSyncState(prev => prev ? { ...prev, syncing: false, lastSync: new Date() } : prev);
      });

      configSyncService.on('syncFailed', (error) => {
        setSyncState(prev => prev ? { ...prev, syncing: false, error: error.error } : prev);
      });

      configSyncService.on('devicePaired', (device) => {
        setSyncState(prev => prev ? {
          ...prev,
          pairedDevices: [...prev.pairedDevices, device]
        } : prev);
      });
    } catch (error) {
      console.error('Failed to initialize config sync:', error);
      Alert.alert('Error', 'Failed to initialize configuration sync');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const state = configSyncService.getSyncState();
      setSyncState(state);
      
      const detailedStatus = await configSyncService.getDetailedSyncStatus();
      setRealTimeStatus(detailedStatus);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSync = async () => {
    try {
      await configSyncService.performSync();
    } catch (error) {
      Alert.alert('Sync Failed', error.message);
    }
  };

  const handleGenerateQR = async () => {
    try {
      const qrCodeData = await configSyncService.generatePairingQR();
      setQrData(qrCodeData);
      setShowQRCode(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate QR code');
    }
  };

  const handleQRScan = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    
    if (status === 'granted') {
      setShowQRScanner(true);
    } else {
      Alert.alert('Permission Denied', 'Camera permission is required to scan QR codes');
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setShowQRScanner(false);
    
    try {
      const device = await configSyncService.processPairingQR(data);
      Alert.alert(
        'Device Paired',
        `Successfully paired with ${device.deviceName}. Do you want to trust this device?`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Trust',
            onPress: () => configSyncService.trustDevice(device.deviceId),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Pairing Failed', error.message);
    }
  };

  const handleTrustDevice = (deviceId: string) => {
    Alert.alert(
      'Trust Device',
      'Are you sure you want to trust this device? Trusted devices can automatically sync configurations.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trust',
          style: 'default',
          onPress: () => configSyncService.trustDevice(deviceId),
        },
      ]
    );
  };

  const handleRemoveDevice = (deviceId: string, deviceName: string) => {
    Alert.alert(
      'Remove Device',
      `Are you sure you want to remove "${deviceName}" from paired devices?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => configSyncService.removePairedDevice(deviceId),
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'connected':
        return '#10B981'; // green
      case 'discovering':
        return '#F59E0B'; // yellow
      case 'error':
        return '#EF4444'; // red
      default:
        return '#6B7280'; // gray
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'connected':
        return 'checkmark-circle';
      case 'discovering':
        return 'radio-button-on';
      case 'error':
        return 'alert-circle';
      default:
        return 'ellipse';
    }
  };

  if (!syncState) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing Config Sync...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Sync Status Card */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Sync Status</Text>
          <View style={styles.statusBadges}>
            <View style={[styles.statusBadge, { backgroundColor: syncState.initialized ? '#10B981' : '#6B7280' }]}>
              <Text style={styles.statusBadgeText}>
                {syncState.initialized ? 'Connected' : 'Not Initialized'}
              </Text>
            </View>
            {realTimeStatus && (
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(realTimeStatus.syncing ? 'active' : 'idle') }]}>
                <Text style={styles.statusBadgeText}>
                  {realTimeStatus.syncing ? 'Syncing' : 'Idle'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Last Sync</Text>
            <Text style={styles.statusValue}>
              {syncState.lastSync ? syncState.lastSync.toLocaleString() : 'Never'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Auto Sync</Text>
            <Text style={styles.statusValue}>
              {syncState.autoSync ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>

        {syncState.error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{syncState.error}</Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          <Button
            title={syncState.syncing ? 'Syncing...' : 'Sync Now'}
            onPress={handleSync}
            disabled={syncState.syncing}
            style={styles.primaryButton}
          />
        </View>
      </Card>

      {/* Sync Settings Card */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Sync Settings</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto Sync</Text>
            <Text style={styles.settingDescription}>
              Automatically sync configuration changes
            </Text>
          </View>
          <Switch
            value={syncState.autoSync}
            onValueChange={(value) => configSyncService.setAutoSync(value)}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Sync Interval</Text>
            <Text style={styles.settingDescription}>
              Minutes between automatic syncs
            </Text>
          </View>
          <TextInput
            style={styles.intervalInput}
            value={syncState.syncInterval.toString()}
            onChangeText={(text) => {
              const interval = parseInt(text) || 5;
              configSyncService.setSyncInterval(interval);
            }}
            keyboardType="numeric"
            maxLength={3}
          />
        </View>
      </Card>

      {/* Device Pairing Card */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Device Pairing</Text>
        
        <View style={styles.pairingButtons}>
          <Button
            title="Generate QR Code"
            onPress={handleGenerateQR}
            style={[styles.pairingButton, styles.primaryButton]}
            icon="qr-code"
          />
          <Button
            title="Scan QR Code"
            onPress={handleQRScan}
            style={[styles.pairingButton, styles.secondaryButton]}
            icon="camera"
          />
        </View>

        {/* Paired Devices */}
        {syncState.pairedDevices.length > 0 && (
          <View style={styles.pairedDevicesSection}>
            <Text style={styles.sectionTitle}>Paired Devices</Text>
            {syncState.pairedDevices.map((device) => (
              <View key={device.deviceId} style={styles.deviceRow}>
                <View style={styles.deviceIcon}>
                  <Ionicons
                    name={device.deviceType === 'desktop' ? 'desktop' : 'phone-portrait'}
                    size={24}
                    color="#007AFF"
                  />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.deviceName}</Text>
                  <Text style={styles.deviceDetails}>
                    {device.platform} • {device.trusted ? 'Trusted' : 'Not Trusted'}
                  </Text>
                  {device.lastSeen && (
                    <Text style={styles.deviceLastSeen}>
                      Last seen: {device.lastSeen.toLocaleString()}
                    </Text>
                  )}
                </View>
                <View style={styles.deviceActions}>
                  {!device.trusted && (
                    <TouchableOpacity
                      style={styles.trustButton}
                      onPress={() => handleTrustDevice(device.deviceId)}
                    >
                      <Text style={styles.trustButtonText}>Trust</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveDevice(device.deviceId, device.deviceName)}
                  >
                    <Ionicons name="trash" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Transport Status Card */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Transport Status</Text>
        
        {syncState.transportStatus.map((transport, index) => (
          <View key={index} style={styles.transportRow}>
            <View style={styles.transportStatus}>
              <Ionicons
                name={getStatusIcon(transport.status)}
                size={16}
                color={getStatusColor(transport.status)}
              />
            </View>
            <View style={styles.transportInfo}>
              <Text style={styles.transportName}>{transport.name}</Text>
              <Text style={styles.transportDescription}>{transport.description}</Text>
              {transport.lastSync && (
                <Text style={styles.transportLastSync}>
                  Last sync: {transport.lastSync.toLocaleTimeString()}
                </Text>
              )}
            </View>
            <Text style={[styles.transportStatusText, { color: getStatusColor(transport.status) }]}>
              {transport.status}
            </Text>
          </View>
        ))}
      </Card>

      {/* QR Code Modal */}
      <Modal visible={showQRCode} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.qrModal}>
            <View style={styles.qrHeader}>
              <Text style={styles.qrTitle}>Pairing QR Code</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowQRCode(false)}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.qrContainer}>
              {qrData ? (
                <QRCode
                  value={qrData}
                  size={250}
                  backgroundColor="white"
                  color="black"
                />
              ) : (
                <ActivityIndicator size="large" color="#007AFF" />
              )}
            </View>
            
            <Text style={styles.qrInstructions}>
              Scan this QR code from another Flow Desk device to pair
            </Text>
            <Text style={styles.qrExpiry}>
              QR code expires in 5 minutes for security
            </Text>
          </View>
        </View>
      </Modal>

      {/* QR Scanner Modal */}
      <Modal visible={showQRScanner} animationType="slide">
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity
              style={styles.scannerClose}
              onPress={() => setShowQRScanner(false)}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
          </View>
          
          {hasPermission && (
            <BarCodeScanner
              onBarCodeScanned={handleBarCodeScanned}
              style={styles.scanner}
            />
          )}
          
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
          </View>
          
          <Text style={styles.scannerInstructions}>
            Point your camera at a Flow Desk pairing QR code
          </Text>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (theme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme === 'dark' ? '#000' : '#F5F5F5',
    padding: 16,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme === 'dark' ? '#FFF' : '#000',
  },
  card: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: theme === 'dark' ? '#1C1C1E' : '#FFF',
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme === 'dark' ? '#FFF' : '#000',
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFF',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statusItem: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    color: theme === 'dark' ? '#8E8E93' : '#6B7280',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '500',
    color: theme === 'dark' ? '#FFF' : '#000',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#EF4444',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme === 'dark' ? '#2C2C2E' : '#E5E5E7',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme === 'dark' ? '#FFF' : '#000',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: theme === 'dark' ? '#8E8E93' : '#6B7280',
  },
  intervalInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: theme === 'dark' ? '#2C2C2E' : '#E5E5E7',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    color: theme === 'dark' ? '#FFF' : '#000',
  },
  pairingButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  pairingButton: {
    flex: 1,
  },
  pairedDevicesSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme === 'dark' ? '#FFF' : '#000',
    marginBottom: 12,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme === 'dark' ? '#2C2C2E' : '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme === 'dark' ? '#1C1C1E' : '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme === 'dark' ? '#FFF' : '#000',
    marginBottom: 4,
  },
  deviceDetails: {
    fontSize: 14,
    color: theme === 'dark' ? '#8E8E93' : '#6B7280',
  },
  deviceLastSeen: {
    fontSize: 12,
    color: theme === 'dark' ? '#8E8E93' : '#9CA3AF',
    marginTop: 2,
  },
  deviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#10B981',
    borderRadius: 6,
  },
  trustButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
  },
  removeButton: {
    padding: 6,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme === 'dark' ? '#2C2C2E' : '#E5E5E7',
  },
  transportStatus: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transportInfo: {
    flex: 1,
  },
  transportName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme === 'dark' ? '#FFF' : '#000',
    marginBottom: 4,
  },
  transportDescription: {
    fontSize: 14,
    color: theme === 'dark' ? '#8E8E93' : '#6B7280',
  },
  transportLastSync: {
    fontSize: 12,
    color: theme === 'dark' ? '#8E8E93' : '#9CA3AF',
    marginTop: 2,
  },
  transportStatusText: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModal: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  qrContainer: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 16,
  },
  qrInstructions: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 8,
  },
  qrExpiry: {
    fontSize: 12,
    textAlign: 'center',
    color: '#EF4444',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  scannerClose: {
    padding: 8,
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 16,
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scannerInstructions: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontSize: 16,
    color: '#FFF',
  },
});