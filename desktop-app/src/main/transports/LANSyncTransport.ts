/**
 * LAN Sync Transport
 * 
 * Handles synchronization between devices on the local area network
 * using mDNS discovery and WebRTC data channels.
 */

import { BaseSyncTransport, DeviceInfo } from '@flow-desk/shared/types';
import { WorkspaceSyncConfig } from '@flow-desk/shared/sync/WorkspaceSyncEngine';
import { EventEmitter } from 'events';
import * as dgram from 'dgram';
import * as crypto from 'crypto';

interface LANDevice {
  deviceInfo: DeviceInfo;
  address: string;
  port: number;
  lastSeen: Date;
  publicKey: string;
  isOnline: boolean;
}

interface SyncMessage {
  type: 'discovery' | 'discovery_response' | 'sync_request' | 'sync_response' | 'config_data';
  deviceId: string;
  deviceInfo?: DeviceInfo;
  timestamp: number;
  data?: any;
  signature?: string;
}

export class LANSyncTransport extends EventEmitter implements BaseSyncTransport {
  public readonly name = 'lan_sync';
  
  private discoverySocket: dgram.Socket | null = null;
  private syncSocket: dgram.Socket | null = null;
  private discoveredDevices: Map<string, LANDevice> = new Map();
  private keyPair: crypto.KeyPairSyncResult<string, string> | null = null;
  private isListening = false;
  private discoveryPort = 45678;
  private syncPort = 45679;
  private discoveryInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    this.generateKeyPair();
  }

  /**
   * Check if the transport is available
   */
  isAvailable(): boolean {
    try {
      // Check if we can bind to the discovery port
      return this.isNetworkAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Download configuration from a LAN device
   */
  async downloadConfiguration(): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('LAN sync not available');
    }

    try {
      await this.startDiscovery();
      
      // Wait for device discovery
      await this.sleep(5000);
      
      // Find the most recently seen device with configuration
      const availableDevices = Array.from(this.discoveredDevices.values())
        .filter(device => device.isOnline)
        .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());

      if (availableDevices.length === 0) {
        throw new Error('No devices found on LAN');
      }

      // Request configuration from the first available device
      const targetDevice = availableDevices[0];
      return await this.requestConfigurationFromDevice(targetDevice);
    } catch (error) {
      console.error('Failed to download configuration via LAN:', error);
      throw error;
    } finally {
      this.stopDiscovery();
    }
  }

  /**
   * Upload configuration to LAN devices
   */
  async uploadConfiguration(config: any): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('LAN sync not available');
    }

    try {
      await this.startDiscovery();
      
      // Wait for device discovery
      await this.sleep(3000);
      
      const availableDevices = Array.from(this.discoveredDevices.values())
        .filter(device => device.isOnline);

      if (availableDevices.length === 0) {
        throw new Error('No devices found on LAN');
      }

      // Send configuration to all available devices
      const promises = availableDevices.map(device => 
        this.sendConfigurationToDevice(device, config)
      );

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Failed to upload configuration via LAN:', error);
      throw error;
    } finally {
      this.stopDiscovery();
    }
  }

  /**
   * Start device discovery on LAN
   */
  async startDiscovery(): Promise<void> {
    if (this.isListening) return;

    try {
      // Create discovery socket
      this.discoverySocket = dgram.createSocket('udp4');
      this.syncSocket = dgram.createSocket('udp4');

      // Bind sockets
      await new Promise<void>((resolve, reject) => {
        this.discoverySocket!.bind(this.discoveryPort, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      await new Promise<void>((resolve, reject) => {
        this.syncSocket!.bind(this.syncPort, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Set up message handlers
      this.discoverySocket.on('message', (buffer, rinfo) => {
        this.handleDiscoveryMessage(buffer, rinfo);
      });

      this.syncSocket.on('message', (buffer, rinfo) => {
        this.handleSyncMessage(buffer, rinfo);
      });

      this.isListening = true;

      // Start periodic discovery broadcasts
      this.startDiscoveryBroadcast();

      this.emit('discoveryStarted');
    } catch (error) {
      console.error('Failed to start LAN discovery:', error);
      throw error;
    }
  }

  /**
   * Stop device discovery
   */
  stopDiscovery(): void {
    if (!this.isListening) return;

    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    if (this.discoverySocket) {
      this.discoverySocket.close();
      this.discoverySocket = null;
    }

    if (this.syncSocket) {
      this.syncSocket.close();
      this.syncSocket = null;
    }

    this.isListening = false;
    this.emit('discoveryStopped');
  }

  /**
   * Get discovered devices
   */
  getDiscoveredDevices(): LANDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Check if the transport supports real-time updates
   */
  supportsRealTimeUpdates(): boolean {
    return true;
  }

  /**
   * Get the last modification time
   */
  async getLastModified(): Promise<Date> {
    // Return the most recent seen device timestamp
    const devices = Array.from(this.discoveredDevices.values());
    if (devices.length === 0) return new Date(0);
    
    return devices.reduce((latest, device) => 
      device.lastSeen > latest ? device.lastSeen : latest, 
      new Date(0)
    );
  }

  // Private methods

  private generateKeyPair(): void {
    this.keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  }

  private isNetworkAvailable(): boolean {
    try {
      // Simple check - try to create a UDP socket
      const testSocket = dgram.createSocket('udp4');
      testSocket.close();
      return true;
    } catch {
      return false;
    }
  }

  private startDiscoveryBroadcast(): void {
    if (this.discoveryInterval) return;

    this.discoveryInterval = setInterval(() => {
      this.broadcastDiscoveryMessage();
    }, 10000); // Broadcast every 10 seconds

    // Initial broadcast
    this.broadcastDiscoveryMessage();
  }

  private broadcastDiscoveryMessage(): void {
    if (!this.discoverySocket || !this.keyPair) return;

    const deviceInfo: DeviceInfo = {
      deviceId: 'desktop_' + crypto.randomBytes(8).toString('hex'),
      deviceName: require('os').hostname(),
      deviceType: 'desktop',
      platform: {
        os: process.platform,
        version: require('os').release(),
        arch: process.arch,
      },
      lastSeen: new Date(),
    };

    const message: SyncMessage = {
      type: 'discovery',
      deviceId: deviceInfo.deviceId,
      deviceInfo,
      timestamp: Date.now(),
      data: {
        publicKey: this.keyPair.publicKey,
        capabilities: ['full_sync', 'real_time', 'plugin_management'],
      },
    };

    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    // Broadcast to local network
    this.discoverySocket.setBroadcast(true);
    this.discoverySocket.send(
      messageBuffer,
      0,
      messageBuffer.length,
      this.discoveryPort,
      '255.255.255.255',
      (error) => {
        if (error) {
          console.error('Discovery broadcast failed:', error);
        }
      }
    );
  }

  private handleDiscoveryMessage(buffer: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      const message: SyncMessage = JSON.parse(buffer.toString());
      
      if (message.type === 'discovery' && message.deviceInfo) {
        // Add or update discovered device
        const device: LANDevice = {
          deviceInfo: message.deviceInfo,
          address: rinfo.address,
          port: rinfo.port,
          lastSeen: new Date(),
          publicKey: message.data?.publicKey || '',
          isOnline: true,
        };

        this.discoveredDevices.set(message.deviceId, device);
        this.emit('deviceDiscovered', device);

        // Send discovery response
        this.sendDiscoveryResponse(rinfo.address, rinfo.port);
      } else if (message.type === 'discovery_response' && message.deviceInfo) {
        // Update device info
        const existingDevice = this.discoveredDevices.get(message.deviceId);
        if (existingDevice) {
          existingDevice.lastSeen = new Date();
          existingDevice.isOnline = true;
        }
      }
    } catch (error) {
      console.error('Failed to handle discovery message:', error);
    }
  }

  private sendDiscoveryResponse(address: string, port: number): void {
    if (!this.discoverySocket || !this.keyPair) return;

    const deviceInfo: DeviceInfo = {
      deviceId: 'desktop_' + crypto.randomBytes(8).toString('hex'),
      deviceName: require('os').hostname(),
      deviceType: 'desktop',
      platform: {
        os: process.platform,
        version: require('os').release(),
        arch: process.arch,
      },
      lastSeen: new Date(),
    };

    const message: SyncMessage = {
      type: 'discovery_response',
      deviceId: deviceInfo.deviceId,
      deviceInfo,
      timestamp: Date.now(),
      data: {
        publicKey: this.keyPair.publicKey,
      },
    };

    const messageBuffer = Buffer.from(JSON.stringify(message));
    this.discoverySocket.send(messageBuffer, 0, messageBuffer.length, port, address);
  }

  private handleSyncMessage(buffer: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      const message: SyncMessage = JSON.parse(buffer.toString());
      
      switch (message.type) {
        case 'sync_request':
          this.handleSyncRequest(message, rinfo);
          break;
        case 'sync_response':
          this.handleSyncResponse(message, rinfo);
          break;
        case 'config_data':
          this.handleConfigData(message, rinfo);
          break;
      }
    } catch (error) {
      console.error('Failed to handle sync message:', error);
    }
  }

  private handleSyncRequest(message: SyncMessage, rinfo: dgram.RemoteInfo): void {
    // Respond with current configuration
    // This would integrate with the actual configuration store
    const response: SyncMessage = {
      type: 'sync_response',
      deviceId: 'current_device',
      timestamp: Date.now(),
      data: {
        hasConfiguration: true,
        lastModified: Date.now(),
      },
    };

    this.sendSyncMessage(response, rinfo.address, rinfo.port);
  }

  private handleSyncResponse(message: SyncMessage, rinfo: dgram.RemoteInfo): void {
    this.emit('syncResponse', { message, address: rinfo.address, port: rinfo.port });
  }

  private handleConfigData(message: SyncMessage, rinfo: dgram.RemoteInfo): void {
    this.emit('configurationReceived', { 
      configuration: message.data, 
      device: message.deviceId,
      address: rinfo.address 
    });
  }

  private async requestConfigurationFromDevice(device: LANDevice): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Configuration request timeout'));
      }, 30000);

      const handleConfigReceived = (event: any) => {
        if (event.device === device.deviceInfo.deviceId) {
          clearTimeout(timeout);
          this.off('configurationReceived', handleConfigReceived);
          resolve(event.configuration);
        }
      };

      this.on('configurationReceived', handleConfigReceived);

      // Send sync request
      const request: SyncMessage = {
        type: 'sync_request',
        deviceId: 'current_device',
        timestamp: Date.now(),
        data: {
          requestType: 'full_configuration',
        },
      };

      this.sendSyncMessage(request, device.address, this.syncPort);
    });
  }

  private async sendConfigurationToDevice(device: LANDevice, config: any): Promise<void> {
    const message: SyncMessage = {
      type: 'config_data',
      deviceId: 'current_device',
      timestamp: Date.now(),
      data: config,
    };

    return new Promise((resolve, reject) => {
      this.sendSyncMessage(message, device.address, this.syncPort);
      
      // For simplicity, resolve immediately
      // In a real implementation, you'd wait for acknowledgment
      setTimeout(resolve, 1000);
    });
  }

  private sendSyncMessage(message: SyncMessage, address: string, port: number): void {
    if (!this.syncSocket) return;

    const messageBuffer = Buffer.from(JSON.stringify(message));
    this.syncSocket.send(messageBuffer, 0, messageBuffer.length, port, address, (error) => {
      if (error) {
        console.error('Failed to send sync message:', error);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopDiscovery();
    this.removeAllListeners();
    this.discoveredDevices.clear();
  }
}