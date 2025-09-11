/**
 * Cross-Platform Utilities
 * 
 * Provides platform-specific utilities and feature detection
 * for Windows, macOS, and Linux compatibility
 */

import { app } from 'electron';
import { join } from 'path';
import { promises as fs, constants } from 'fs';
import { platform, arch, homedir, networkInterfaces } from 'os';
import { createLogger } from '../shared/logging/LoggerFactory';

// Create logger for this module
const logger = createLogger('PlatformUtils');

export interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  isDarwin: boolean;
  isWindows: boolean;
  isLinux: boolean;
  pathSeparator: string;
  executableExtension: string;
  supportedFeatures: PlatformFeatures;
}

export interface PlatformFeatures {
  nativeNotifications: boolean;
  keychain: boolean;
  windowsCredentialManager: boolean;
  linuxSecretService: boolean;
  fileSystemWatcher: boolean;
  networkDiscovery: boolean;
  systemTray: boolean;
  globalShortcuts: boolean;
}

export interface NetworkConfig {
  bindAddress: string;
  preferredFamily: 'ipv4' | 'ipv6' | 'dual';
  dnsServers?: string[];
  proxySettings?: ProxySettings;
}

export interface ProxySettings {
  enabled: boolean;
  type: 'http' | 'socks4' | 'socks5';
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

/**
 * Get comprehensive platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const currentPlatform = platform();
  const currentArch = arch();
  
  return {
    platform: currentPlatform,
    arch: currentArch,
    isDarwin: currentPlatform === 'darwin',
    isWindows: currentPlatform === 'win32',
    isLinux: currentPlatform === 'linux',
    pathSeparator: currentPlatform === 'win32' ? '\\' : '/',
    executableExtension: currentPlatform === 'win32' ? '.exe' : '',
    supportedFeatures: detectPlatformFeatures(currentPlatform)
  };
}

/**
 * Detect platform-specific features
 */
function detectPlatformFeatures(currentPlatform: NodeJS.Platform): PlatformFeatures {
  const features: PlatformFeatures = {
    nativeNotifications: true, // Supported on all platforms
    keychain: false,
    windowsCredentialManager: false,
    linuxSecretService: false,
    fileSystemWatcher: true, // Supported on all platforms
    networkDiscovery: true, // Supported on all platforms
    systemTray: true, // Supported on all platforms
    globalShortcuts: true // Supported on all platforms
  };

  switch (currentPlatform) {
    case 'darwin':
      features.keychain = true;
      break;
    case 'win32':
      features.windowsCredentialManager = true;
      break;
    case 'linux':
      features.linuxSecretService = true;
      break;
  }

  return features;
}

/**
 * Get platform-specific app data directory
 */
export function getAppDataDirectory(): string {
  try {
    return app.getPath('userData');
  } catch (error) {
    // Fallback if Electron app is not available
    const platform = process.platform;
    const home = homedir();
    
    switch (platform) {
      case 'win32':
        return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'FlowDesk');
      case 'darwin':
        return join(home, 'Library', 'Application Support', 'FlowDesk');
      case 'linux':
        return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'flowdesk');
      default:
        return join(home, '.flowdesk');
    }
  }
}

/**
 * Get platform-specific cache directory
 */
export function getCacheDirectory(): string {
  try {
    return app.getPath('temp');
  } catch (error) {
    const platform = process.platform;
    const home = homedir();
    
    switch (platform) {
      case 'win32':
        return join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'FlowDesk', 'Cache');
      case 'darwin':
        return join(home, 'Library', 'Caches', 'FlowDesk');
      case 'linux':
        return join(process.env.XDG_CACHE_HOME || join(home, '.cache'), 'flowdesk');
      default:
        return join(home, '.cache', 'flowdesk');
    }
  }
}

/**
 * Get platform-specific logs directory
 */
export function getLogsDirectory(): string {
  try {
    return app.getPath('logs');
  } catch (error) {
    const platform = process.platform;
    const home = homedir();
    
    switch (platform) {
      case 'win32':
        return join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'FlowDesk', 'Logs');
      case 'darwin':
        return join(home, 'Library', 'Logs', 'FlowDesk');
      case 'linux':
        return join(process.env.XDG_STATE_HOME || join(home, '.local', 'state'), 'flowdesk', 'logs');
      default:
        return join(home, '.local', 'state', 'flowdesk', 'logs');
    }
  }
}

/**
 * Get platform-appropriate file permissions
 */
export function getFilePermissions(type: 'file' | 'directory' | 'executable'): number {
  const platform = process.platform;
  
  if (platform === 'win32') {
    // Windows doesn't use Unix permissions
    return 0o644; // Default readable permissions
  }
  
  switch (type) {
    case 'file':
      return 0o600; // Read/write for owner only
    case 'directory':
      return 0o700; // Read/write/execute for owner only
    case 'executable':
      return 0o755; // Read/write/execute for owner, read/execute for others
    default:
      return 0o644;
  }
}

/**
 * Set file permissions in a cross-platform way
 */
export async function setFilePermissions(filePath: string, type: 'file' | 'directory' | 'executable'): Promise<void> {
  if (process.platform === 'win32') {
    // Windows handles permissions differently
    return;
  }
  
  try {
    const permissions = getFilePermissions(type);
    await fs.chmod(filePath, permissions);
  } catch (error) {
    logger.warn(`Failed to set permissions for ${filePath}`, error, { method: 'electron-log.warn' });
  }
}

/**
 * Check if a file is executable on current platform
 */
export async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, constants.F_OK);
    
    if (process.platform === 'win32') {
      // On Windows, check if it has .exe extension
      return filePath.toLowerCase().endsWith('.exe');
    } else {
      // On Unix-like systems, check execute permission
      await fs.access(filePath, constants.X_OK);
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Get network configuration for current platform
 */
export function getNetworkConfig(): NetworkConfig {
  const interfaces = networkInterfaces();
  let bindAddress = '127.0.0.1'; // Default fallback
  
  // Find the first available non-loopback interface
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses) continue;
    
    for (const addr of addresses) {
      if (!addr.internal && addr.family === 'IPv4') {
        bindAddress = '0.0.0.0'; // Bind to all interfaces if we have external ones
        break;
      }
    }
  }
  
  return {
    bindAddress,
    preferredFamily: 'ipv4', // Default to IPv4 for maximum compatibility
    dnsServers: getPlatformDnsServers(),
    proxySettings: detectSystemProxy()
  };
}

/**
 * Get platform-specific DNS servers
 */
function getPlatformDnsServers(): string[] {
  const platform = process.platform;
  
  // Default fallback DNS servers
  const fallbackServers = ['8.8.8.8', '8.8.4.4', '1.1.1.1'];
  
  try {
    switch (platform) {
      case 'win32':
        return getWindowsDnsServers() || fallbackServers;
      case 'darwin':
        return getMacDnsServers() || fallbackServers;
      case 'linux':
        return getLinuxDnsServers() || fallbackServers;
      default:
        return fallbackServers;
    }
  } catch (error) {
    logger.warn('Failed to detect DNS servers, using fallback', error, { method: 'console.warn' });
    return fallbackServers;
  }
}

/**
 * Windows DNS detection using ipconfig
 */
function getWindowsDnsServers(): string[] | null {
  try {
    const { execSync } = require('child_process');
    const output = execSync('ipconfig /all', { encoding: 'utf8' });
    
    const dnsServers: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/DNS Servers[\.:\s]+(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        dnsServers.push(match[1]);
      }
    }
    
    return dnsServers.length > 0 ? dnsServers : null;
  } catch (error) {
    logger.warn('Failed to get Windows DNS servers', error, { method: 'console.warn' });
    return null;
  }
}

/**
 * macOS DNS detection using scutil
 */
function getMacDnsServers(): string[] | null {
  try {
    const { execSync } = require('child_process');
    const output = execSync('scutil --dns', { encoding: 'utf8' });
    
    const dnsServers: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/nameserver\[\d+\]: (\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        dnsServers.push(match[1]);
      }
    }
    
    // Remove duplicates and return unique servers
    const uniqueServers = [...new Set(dnsServers)];
    return uniqueServers.length > 0 ? uniqueServers : null;
  } catch (error) {
    logger.warn('Failed to get macOS DNS servers', error, { method: 'console.warn' });
    return null;
  }
}

/**
 * Linux DNS detection using resolv.conf
 */
function getLinuxDnsServers(): string[] | null {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const resolvConfPath = '/etc/resolv.conf';
    if (!fs.existsSync(resolvConfPath)) {
      return null;
    }
    
    const content = fs.readFileSync(resolvConfPath, 'utf8');
    const dnsServers: string[] = [];
    
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        dnsServers.push(match[1]);
      }
    }
    
    // Remove duplicates and return unique servers
    const uniqueServers = [...new Set(dnsServers)];
    return uniqueServers.length > 0 ? uniqueServers : null;
  } catch (error) {
    logger.warn('Failed to get Linux DNS servers', error, { method: 'console.warn' });
    return null;
  }
}

/**
 * Detect system proxy settings
 */
function detectSystemProxy(): ProxySettings | undefined {
  // Basic proxy detection - could be enhanced with platform-specific APIs
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  
  if (httpProxy || httpsProxy) {
    try {
      const proxyUrl = new URL(httpProxy || httpsProxy || '');
      return {
        enabled: true,
        type: 'http',
        host: proxyUrl.hostname,
        port: parseInt(proxyUrl.port) || 8080,
        auth: proxyUrl.username ? {
          username: proxyUrl.username,
          password: proxyUrl.password
        } : undefined
      };
    } catch (error) {
      logger.warn('Failed to parse proxy URL', error, { method: 'electron-log.warn' });
    }
  }
  
  return undefined;
}

/**
 * Get platform-specific binary name for Rust CLI
 */
export function getRustBinaryName(): string {
  const platform = getPlatformInfo();
  return `flow_desk_cli${platform.executableExtension}`;
}

/**
 * Get platform-specific binary path for Rust CLI
 */
export function getRustBinaryPath(): string {
  const platform = getPlatformInfo();
  const platformKey = `${platform.platform}-${platform.arch}`;
  const binaryName = getRustBinaryName();
  
  // Try multiple possible locations
  const possiblePaths = [
    join(__dirname, '..', 'lib', 'rust-engine', 'target', 'release', binaryName),
    join(__dirname, '..', '..', 'dist', 'binaries', platformKey, binaryName),
    join(process.resourcesPath || '', 'binaries', platformKey, binaryName)
  ];
  
  return possiblePaths[0]; // Return the most likely path
}

/**
 * Normalize path separators for current platform
 */
export function normalizePath(path: string): string {
  const platform = getPlatformInfo();
  
  if (platform.isWindows) {
    return path.replace(/\//g, '\\');
  } else {
    return path.replace(/\\/g, '/');
  }
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || 
         process.defaultApp || 
         /node_modules[\\/]electron[\\/]/.test(process.execPath);
}

/**
 * Get platform-specific shell command
 */
export function getShellCommand(): { shell: string; args: string[] } {
  const platform = getPlatformInfo();
  
  if (platform.isWindows) {
    return { shell: 'cmd', args: ['/c'] };
  } else {
    return { shell: '/bin/sh', args: ['-c'] };
  }
}

/**
 * Check if current platform supports a specific feature
 */
export function supportsFeature(feature: keyof PlatformFeatures): boolean {
  const platformInfo = getPlatformInfo();
  return platformInfo.supportedFeatures[feature];
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  return {
    isDevelopment: isDevelopment(),
    isProduction: process.env.NODE_ENV === 'production',
    platform: getPlatformInfo(),
    network: getNetworkConfig(),
    paths: {
      appData: getAppDataDirectory(),
      cache: getCacheDirectory(),
      logs: getLogsDirectory()
    }
  };
}