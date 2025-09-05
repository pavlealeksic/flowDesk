"use strict";
/**
 * Cross-Platform File System Utilities
 *
 * Handles file system operations with platform-specific considerations
 * for Windows, macOS, and Linux compatibility
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fsUtils = exports.FileSystemUtils = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const electron_log_1 = __importDefault(require("electron-log"));
const platform_utils_1 = require("./platform-utils");
/**
 * Cross-platform file system utilities
 */
class FileSystemUtils {
    constructor() {
        this.platformInfo = (0, platform_utils_1.getPlatformInfo)();
    }
    /**
     * Normalize path separators for current platform
     */
    normalizePath(path) {
        if (this.platformInfo.isWindows) {
            return path.split(path_1.posix.sep).join(path_1.win32.sep);
        }
        else {
            return path.split(path_1.win32.sep).join(path_1.posix.sep);
        }
    }
    /**
     * Join paths with correct separator for current platform
     */
    joinPath(...paths) {
        return this.normalizePath((0, path_1.join)(...paths));
    }
    /**
     * Get relative path with correct separators
     */
    getRelativePath(from, to) {
        return this.normalizePath((0, path_1.relative)(from, to));
    }
    /**
     * Resolve path to absolute path
     */
    resolvePath(...paths) {
        return this.normalizePath((0, path_1.resolve)(...paths));
    }
    /**
     * Check if path exists
     */
    async exists(path) {
        try {
            await fs_1.promises.access(path);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Check if path exists synchronously
     */
    existsSync(path) {
        return (0, fs_1.existsSync)(path);
    }
    /**
     * Get comprehensive file system information
     */
    async getInfo(path) {
        try {
            const stats = await fs_1.promises.lstat(path);
            return {
                exists: true,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                isSymlink: stats.isSymbolicLink(),
                size: stats.size,
                permissions: this.formatPermissions(stats),
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Format file permissions for display
     */
    formatPermissions(stats) {
        if (this.platformInfo.isWindows) {
            // Windows doesn't have traditional Unix permissions
            return 'rw-rw-rw-'; // Simplified representation
        }
        const mode = stats.mode;
        let perms = '';
        // Owner permissions
        perms += (mode & 0o400) ? 'r' : '-';
        perms += (mode & 0o200) ? 'w' : '-';
        perms += (mode & 0o100) ? 'x' : '-';
        // Group permissions
        perms += (mode & 0o040) ? 'r' : '-';
        perms += (mode & 0o020) ? 'w' : '-';
        perms += (mode & 0o010) ? 'x' : '-';
        // Other permissions
        perms += (mode & 0o004) ? 'r' : '-';
        perms += (mode & 0o002) ? 'w' : '-';
        perms += (mode & 0o001) ? 'x' : '-';
        return perms;
    }
    /**
     * Create directory with platform-appropriate permissions
     */
    async createDirectory(path, options = {}) {
        const { recursive = true, mode } = options;
        try {
            await fs_1.promises.mkdir(path, {
                recursive,
                mode: mode || (0, platform_utils_1.getFilePermissions)('directory')
            });
            // Set permissions explicitly on Unix-like systems
            if (!this.platformInfo.isWindows) {
                await (0, platform_utils_1.setFilePermissions)(path, 'directory');
            }
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    /**
     * Remove file or directory recursively
     */
    async remove(path) {
        try {
            const stats = await fs_1.promises.lstat(path);
            if (stats.isDirectory()) {
                await fs_1.promises.rmdir(path, { recursive: true });
            }
            else {
                await fs_1.promises.unlink(path);
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    /**
     * Copy file or directory with platform-specific handling
     */
    async copy(src, dest, options = {}) {
        const { overwrite = false, preserveTimestamps = true, followSymlinks = false, filter } = options;
        // Check if destination exists and handle overwrite
        if (await this.exists(dest) && !overwrite) {
            throw new Error(`Destination ${dest} already exists`);
        }
        // Apply filter if provided
        if (filter && !filter(src, dest)) {
            return;
        }
        const srcStats = await fs_1.promises.lstat(src);
        if (srcStats.isDirectory()) {
            await this.copyDirectory(src, dest, options);
        }
        else if (srcStats.isFile()) {
            await this.copyFile(src, dest, options);
        }
        else if (srcStats.isSymbolicLink()) {
            if (followSymlinks) {
                const realPath = await fs_1.promises.readlink(src);
                await this.copy(realPath, dest, options);
            }
            else {
                await this.copySymlink(src, dest);
            }
        }
    }
    /**
     * Copy file with platform-specific optimizations
     */
    async copyFile(src, dest, options) {
        const { preserveTimestamps = true } = options;
        // Ensure destination directory exists
        await this.createDirectory((0, path_1.dirname)(dest));
        // Copy file
        await fs_1.promises.copyFile(src, dest);
        // Set appropriate permissions
        if (!this.platformInfo.isWindows) {
            await (0, platform_utils_1.setFilePermissions)(dest, 'file');
        }
        // Preserve timestamps if requested
        if (preserveTimestamps) {
            const srcStats = await fs_1.promises.stat(src);
            await fs_1.promises.utimes(dest, srcStats.atime, srcStats.mtime);
        }
    }
    /**
     * Copy directory recursively
     */
    async copyDirectory(src, dest, options) {
        await this.createDirectory(dest);
        const entries = await fs_1.promises.readdir(src);
        for (const entry of entries) {
            const srcPath = (0, path_1.join)(src, entry);
            const destPath = (0, path_1.join)(dest, entry);
            await this.copy(srcPath, destPath, options);
        }
    }
    /**
     * Copy symbolic link
     */
    async copySymlink(src, dest) {
        const linkTarget = await fs_1.promises.readlink(src);
        try {
            await fs_1.promises.symlink(linkTarget, dest);
        }
        catch (error) {
            // If symlink creation fails, copy the target file instead
            electron_log_1.default.warn(`Failed to create symlink, copying target instead: ${error}`);
            const resolvedTarget = (0, path_1.resolve)((0, path_1.dirname)(src), linkTarget);
            await this.copyFile(resolvedTarget, dest, {});
        }
    }
    /**
     * Move file or directory
     */
    async move(src, dest) {
        try {
            await fs_1.promises.rename(src, dest);
        }
        catch (error) {
            // If rename fails (cross-device move), copy and delete
            if (error.code === 'EXDEV') {
                await this.copy(src, dest, { overwrite: true });
                await this.remove(src);
            }
            else {
                throw error;
            }
        }
    }
    /**
     * Read file with encoding detection
     */
    async readFile(path, encoding = 'utf8') {
        return await fs_1.promises.readFile(path, encoding);
    }
    /**
     * Write file with platform-appropriate permissions
     */
    async writeFile(path, data, encoding = 'utf8') {
        // Ensure directory exists
        await this.createDirectory((0, path_1.dirname)(path));
        // Write file
        await fs_1.promises.writeFile(path, data, encoding);
        // Set appropriate permissions
        if (!this.platformInfo.isWindows) {
            await (0, platform_utils_1.setFilePermissions)(path, 'file');
        }
    }
    /**
     * Create temporary file
     */
    async createTempFile(prefix = 'flowdesk', suffix = '.tmp') {
        const tempDir = (0, os_1.tmpdir)();
        const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2)}${suffix}`;
        const tempPath = (0, path_1.join)(tempDir, filename);
        // Create empty file
        await this.writeFile(tempPath, '');
        return tempPath;
    }
    /**
     * Create temporary directory
     */
    async createTempDirectory(prefix = 'flowdesk') {
        const tempDir = (0, os_1.tmpdir)();
        const dirname = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2)}`;
        const tempPath = (0, path_1.join)(tempDir, dirname);
        await this.createDirectory(tempPath);
        return tempPath;
    }
    /**
     * Find files matching pattern
     */
    async findFiles(directory, pattern) {
        const results = [];
        const search = async (dir) => {
            try {
                const entries = await fs_1.promises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = (0, path_1.join)(dir, entry.name);
                    if (entry.isDirectory()) {
                        await search(fullPath);
                    }
                    else if (entry.isFile()) {
                        const matches = pattern instanceof RegExp
                            ? pattern.test(entry.name)
                            : entry.name.includes(pattern);
                        if (matches) {
                            results.push(fullPath);
                        }
                    }
                }
            }
            catch (error) {
                electron_log_1.default.warn(`Failed to search directory ${dir}:`, error);
            }
        };
        await search(directory);
        return results;
    }
    /**
     * Get directory size recursively
     */
    async getDirectorySize(directory) {
        let totalSize = 0;
        const calculateSize = async (dir) => {
            try {
                const entries = await fs_1.promises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = (0, path_1.join)(dir, entry.name);
                    if (entry.isDirectory()) {
                        await calculateSize(fullPath);
                    }
                    else if (entry.isFile()) {
                        const stats = await fs_1.promises.stat(fullPath);
                        totalSize += stats.size;
                    }
                }
            }
            catch (error) {
                electron_log_1.default.warn(`Failed to calculate size for directory ${dir}:`, error);
            }
        };
        await calculateSize(directory);
        return totalSize;
    }
    /**
     * Clean up old temporary files
     */
    async cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000) {
        const tempDir = (0, os_1.tmpdir)();
        let deletedCount = 0;
        try {
            const entries = await fs_1.promises.readdir(tempDir, { withFileTypes: true });
            const now = Date.now();
            for (const entry of entries) {
                if (entry.name.includes('flowdesk')) {
                    const fullPath = (0, path_1.join)(tempDir, entry.name);
                    try {
                        const stats = await fs_1.promises.stat(fullPath);
                        const age = now - stats.mtime.getTime();
                        if (age > maxAge) {
                            await this.remove(fullPath);
                            deletedCount++;
                        }
                    }
                    catch (error) {
                        electron_log_1.default.warn(`Failed to clean up temp file ${fullPath}:`, error);
                    }
                }
            }
        }
        catch (error) {
            electron_log_1.default.warn('Failed to clean up temp files:', error);
        }
        if (deletedCount > 0) {
            electron_log_1.default.info(`Cleaned up ${deletedCount} old temporary files`);
        }
        return deletedCount;
    }
    /**
     * Check disk space availability
     */
    async checkDiskSpace(path) {
        try {
            // Check if directory exists first
            const exists = await this.exists(path);
            if (!exists) {
                electron_log_1.default.warn(`Cannot check disk space: path does not exist: ${path}`);
                return null;
            }
            // Use Node.js fs.promises.statfs for disk space information
            const fsPromises = require('fs').promises;
            // Check if statvfs is available (Linux/Unix)
            if (fsPromises.statfs) {
                try {
                    const stats = await fsPromises.statfs(path);
                    const blockSize = stats.bsize || stats.frsize || 1024; // Block size
                    const totalBlocks = stats.blocks;
                    const freeBlocks = stats.bavail; // Available to non-root users
                    return {
                        total: totalBlocks * blockSize,
                        available: freeBlocks * blockSize
                    };
                }
                catch (statfsError) {
                    electron_log_1.default.debug('statfs not available, trying alternative methods');
                }
            }
            // Fallback for platforms without statfs
            // Use a cross-platform approach
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execPromise = promisify(exec);
            let command;
            let parseOutput;
            if (process.platform === 'win32') {
                // Windows: Use WMIC or PowerShell
                command = `wmic logicaldisk where caption="${path.charAt(0)}:" get size,freespace /value`;
                parseOutput = (output) => {
                    const lines = output.split('\n');
                    let freeSpace = 0;
                    let totalSpace = 0;
                    for (const line of lines) {
                        if (line.startsWith('FreeSpace=')) {
                            freeSpace = parseInt(line.split('=')[1]);
                        }
                        else if (line.startsWith('Size=')) {
                            totalSpace = parseInt(line.split('=')[1]);
                        }
                    }
                    return freeSpace && totalSpace ? { available: freeSpace, total: totalSpace } : null;
                };
            }
            else if (process.platform === 'darwin') {
                // macOS: Use df command
                command = `df -k "${path}" | tail -1`;
                parseOutput = (output) => {
                    const parts = output.trim().split(/\s+/);
                    if (parts.length >= 4) {
                        const total = parseInt(parts[1]) * 1024; // Convert from KB to bytes
                        const available = parseInt(parts[3]) * 1024;
                        return { available, total };
                    }
                    return null;
                };
            }
            else {
                // Linux and other Unix-like systems: Use df command
                command = `df -B1 "${path}" | tail -1`;
                parseOutput = (output) => {
                    const parts = output.trim().split(/\s+/);
                    if (parts.length >= 4) {
                        const total = parseInt(parts[1]);
                        const available = parseInt(parts[3]);
                        return { available, total };
                    }
                    return null;
                };
            }
            try {
                const { stdout } = await execPromise(command);
                const result = parseOutput(stdout);
                if (result) {
                    electron_log_1.default.debug(`Disk space for ${path}: ${(result.available / 1024 / 1024 / 1024).toFixed(2)} GB available of ${(result.total / 1024 / 1024 / 1024).toFixed(2)} GB total`);
                    return result;
                }
                else {
                    electron_log_1.default.warn('Failed to parse disk space information');
                    return null;
                }
            }
            catch (cmdError) {
                electron_log_1.default.error('Command execution failed for disk space check:', cmdError);
                return null;
            }
        }
        catch (error) {
            electron_log_1.default.error('Failed to check disk space:', error);
            return null;
        }
    }
    /**
     * Watch directory for changes
     */
    watchDirectory(directory, callback) {
        const fs = require('fs');
        try {
            const watcher = fs.watch(directory, { recursive: true }, callback);
            return {
                close: () => {
                    try {
                        watcher.close();
                    }
                    catch (error) {
                        electron_log_1.default.warn('Failed to close directory watcher:', error);
                    }
                }
            };
        }
        catch (error) {
            electron_log_1.default.error(`Failed to watch directory ${directory}:`, error);
            // Return dummy watcher
            return {
                close: () => { }
            };
        }
    }
    /**
     * Create hardlink if supported, otherwise copy
     */
    async createHardLink(src, dest) {
        try {
            await fs_1.promises.link(src, dest);
        }
        catch (error) {
            // If hardlink fails, fall back to copy
            electron_log_1.default.warn('Hardlink failed, falling back to copy:', error);
            await this.copyFile(src, dest, {});
        }
    }
    /**
     * Create symlink with fallback for Windows
     */
    async createSymLink(target, path) {
        try {
            await fs_1.promises.symlink(target, path);
        }
        catch (error) {
            if (this.platformInfo.isWindows) {
                // On Windows, if symlink fails, copy the file instead
                electron_log_1.default.warn('Symlink failed on Windows, falling back to copy:', error);
                await this.copyFile(target, path, {});
            }
            else {
                throw error;
            }
        }
    }
}
exports.FileSystemUtils = FileSystemUtils;
// Export singleton instance
exports.fsUtils = new FileSystemUtils();
