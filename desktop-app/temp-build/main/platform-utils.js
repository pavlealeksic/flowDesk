"use strict";
/**
 * Cross-Platform Utilities
 *
 * Provides platform-specific utilities and feature detection
 * for Windows, macOS, and Linux compatibility
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformInfo = getPlatformInfo;
exports.getAppDataDirectory = getAppDataDirectory;
exports.getCacheDirectory = getCacheDirectory;
exports.getLogsDirectory = getLogsDirectory;
exports.getFilePermissions = getFilePermissions;
exports.setFilePermissions = setFilePermissions;
exports.isExecutable = isExecutable;
exports.getNetworkConfig = getNetworkConfig;
exports.getRustBinaryName = getRustBinaryName;
exports.getRustBinaryPath = getRustBinaryPath;
exports.normalizePath = normalizePath;
exports.isDevelopment = isDevelopment;
exports.getShellCommand = getShellCommand;
exports.supportsFeature = supportsFeature;
exports.getEnvironmentConfig = getEnvironmentConfig;
const electron_1 = require("electron");
const path_1 = require("path");
const fs_1 = require("fs");
const os_1 = require("os");
const electron_log_1 = __importDefault(require("electron-log"));
/**
 * Get comprehensive platform information
 */
function getPlatformInfo() {
    const currentPlatform = (0, os_1.platform)();
    const currentArch = (0, os_1.arch)();
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
function detectPlatformFeatures(currentPlatform) {
    const features = {
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
function getAppDataDirectory() {
    try {
        return electron_1.app.getPath('userData');
    }
    catch (error) {
        // Fallback if Electron app is not available
        const platform = process.platform;
        const home = (0, os_1.homedir)();
        switch (platform) {
            case 'win32':
                return (0, path_1.join)(process.env.APPDATA || (0, path_1.join)(home, 'AppData', 'Roaming'), 'FlowDesk');
            case 'darwin':
                return (0, path_1.join)(home, 'Library', 'Application Support', 'FlowDesk');
            case 'linux':
                return (0, path_1.join)(process.env.XDG_CONFIG_HOME || (0, path_1.join)(home, '.config'), 'flowdesk');
            default:
                return (0, path_1.join)(home, '.flowdesk');
        }
    }
}
/**
 * Get platform-specific cache directory
 */
function getCacheDirectory() {
    try {
        return electron_1.app.getPath('temp');
    }
    catch (error) {
        const platform = process.platform;
        const home = (0, os_1.homedir)();
        switch (platform) {
            case 'win32':
                return (0, path_1.join)(process.env.LOCALAPPDATA || (0, path_1.join)(home, 'AppData', 'Local'), 'FlowDesk', 'Cache');
            case 'darwin':
                return (0, path_1.join)(home, 'Library', 'Caches', 'FlowDesk');
            case 'linux':
                return (0, path_1.join)(process.env.XDG_CACHE_HOME || (0, path_1.join)(home, '.cache'), 'flowdesk');
            default:
                return (0, path_1.join)(home, '.cache', 'flowdesk');
        }
    }
}
/**
 * Get platform-specific logs directory
 */
function getLogsDirectory() {
    try {
        return electron_1.app.getPath('logs');
    }
    catch (error) {
        const platform = process.platform;
        const home = (0, os_1.homedir)();
        switch (platform) {
            case 'win32':
                return (0, path_1.join)(process.env.LOCALAPPDATA || (0, path_1.join)(home, 'AppData', 'Local'), 'FlowDesk', 'Logs');
            case 'darwin':
                return (0, path_1.join)(home, 'Library', 'Logs', 'FlowDesk');
            case 'linux':
                return (0, path_1.join)(process.env.XDG_STATE_HOME || (0, path_1.join)(home, '.local', 'state'), 'flowdesk', 'logs');
            default:
                return (0, path_1.join)(home, '.local', 'state', 'flowdesk', 'logs');
        }
    }
}
/**
 * Get platform-appropriate file permissions
 */
function getFilePermissions(type) {
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
async function setFilePermissions(filePath, type) {
    if (process.platform === 'win32') {
        // Windows handles permissions differently
        return;
    }
    try {
        const permissions = getFilePermissions(type);
        await fs_1.promises.chmod(filePath, permissions);
    }
    catch (error) {
        electron_log_1.default.warn(`Failed to set permissions for ${filePath}:`, error);
    }
}
/**
 * Check if a file is executable on current platform
 */
async function isExecutable(filePath) {
    try {
        await fs_1.promises.access(filePath, fs_1.constants.F_OK);
        if (process.platform === 'win32') {
            // On Windows, check if it has .exe extension
            return filePath.toLowerCase().endsWith('.exe');
        }
        else {
            // On Unix-like systems, check execute permission
            await fs_1.promises.access(filePath, fs_1.constants.X_OK);
            return true;
        }
    }
    catch {
        return false;
    }
}
/**
 * Get network configuration for current platform
 */
function getNetworkConfig() {
    const interfaces = (0, os_1.networkInterfaces)();
    let bindAddress = '127.0.0.1'; // Default fallback
    // Find the first available non-loopback interface
    for (const [name, addresses] of Object.entries(interfaces)) {
        if (!addresses)
            continue;
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
function getPlatformDnsServers() {
    const platform = process.platform;
    // Default fallback DNS servers
    const fallbackServers = ['8.8.8.8', '8.8.4.4', '1.1.1.1'];
    // TODO: Implement platform-specific DNS detection
    // This would require additional platform-specific modules
    switch (platform) {
        case 'win32':
            // Could use 'ipconfig /all' parsing
            return fallbackServers;
        case 'darwin':
            // Could use 'scutil --dns' parsing
            return fallbackServers;
        case 'linux':
            // Could parse /etc/resolv.conf
            return fallbackServers;
        default:
            return fallbackServers;
    }
}
/**
 * Detect system proxy settings
 */
function detectSystemProxy() {
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
        }
        catch (error) {
            electron_log_1.default.warn('Failed to parse proxy URL:', error);
        }
    }
    return undefined;
}
/**
 * Get platform-specific binary name for Rust CLI
 */
function getRustBinaryName() {
    const platform = getPlatformInfo();
    return `flow_desk_cli${platform.executableExtension}`;
}
/**
 * Get platform-specific binary path for Rust CLI
 */
function getRustBinaryPath() {
    const platform = getPlatformInfo();
    const platformKey = `${platform.platform}-${platform.arch}`;
    const binaryName = getRustBinaryName();
    // Try multiple possible locations
    const possiblePaths = [
        (0, path_1.join)(__dirname, '..', 'lib', 'rust-engine', 'target', 'release', binaryName),
        (0, path_1.join)(__dirname, '..', '..', 'dist', 'binaries', platformKey, binaryName),
        (0, path_1.join)(process.resourcesPath || '', 'binaries', platformKey, binaryName)
    ];
    return possiblePaths[0]; // Return the most likely path
}
/**
 * Normalize path separators for current platform
 */
function normalizePath(path) {
    const platform = getPlatformInfo();
    if (platform.isWindows) {
        return path.replace(/\//g, '\\');
    }
    else {
        return path.replace(/\\/g, '/');
    }
}
/**
 * Check if running in development mode
 */
function isDevelopment() {
    return process.env.NODE_ENV === 'development' ||
        process.defaultApp ||
        /node_modules[\\/]electron[\\/]/.test(process.execPath);
}
/**
 * Get platform-specific shell command
 */
function getShellCommand() {
    const platform = getPlatformInfo();
    if (platform.isWindows) {
        return { shell: 'cmd', args: ['/c'] };
    }
    else {
        return { shell: '/bin/sh', args: ['-c'] };
    }
}
/**
 * Check if current platform supports a specific feature
 */
function supportsFeature(feature) {
    const platformInfo = getPlatformInfo();
    return platformInfo.supportedFeatures[feature];
}
/**
 * Get environment-specific configuration
 */
function getEnvironmentConfig() {
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
