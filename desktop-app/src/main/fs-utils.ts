/**
 * Cross-Platform File System Utilities
 * 
 * Handles file system operations with platform-specific considerations
 * for Windows, macOS, and Linux compatibility
 */

import { promises as fs, constants, Stats, existsSync } from 'fs';
import { join, dirname, resolve, relative, sep, posix, win32 } from 'path';
import { homedir, tmpdir } from 'os';
import log from 'electron-log';
import { getPlatformInfo, getFilePermissions, setFilePermissions } from './platform-utils';

export interface FileSystemInfo {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  permissions: string;
  created: Date;
  modified: Date;
  accessed: Date;
}

export interface CopyOptions {
  overwrite?: boolean;
  preserveTimestamps?: boolean;
  followSymlinks?: boolean;
  filter?: (src: string, dest: string) => boolean;
}

export interface CreateDirectoryOptions {
  recursive?: boolean;
  mode?: number;
}

/**
 * Cross-platform file system utilities
 */
export class FileSystemUtils {
  private platformInfo = getPlatformInfo();

  /**
   * Normalize path separators for current platform
   */
  normalizePath(path: string): string {
    if (this.platformInfo.isWindows) {
      return path.split(posix.sep).join(win32.sep);
    } else {
      return path.split(win32.sep).join(posix.sep);
    }
  }

  /**
   * Join paths with correct separator for current platform
   */
  joinPath(...paths: string[]): string {
    return this.normalizePath(join(...paths));
  }

  /**
   * Get relative path with correct separators
   */
  getRelativePath(from: string, to: string): string {
    return this.normalizePath(relative(from, to));
  }

  /**
   * Resolve path to absolute path
   */
  resolvePath(...paths: string[]): string {
    return this.normalizePath(resolve(...paths));
  }

  /**
   * Check if path exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if path exists synchronously
   */
  existsSync(path: string): boolean {
    return existsSync(path);
  }

  /**
   * Get comprehensive file system information
   */
  async getInfo(path: string): Promise<FileSystemInfo | null> {
    try {
      const stats = await fs.lstat(path);
      
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
    } catch (error) {
      return null;
    }
  }

  /**
   * Format file permissions for display
   */
  private formatPermissions(stats: Stats): string {
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
  async createDirectory(path: string, options: CreateDirectoryOptions = {}): Promise<void> {
    const { recursive = true, mode } = options;
    
    try {
      await fs.mkdir(path, {
        recursive,
        mode: mode || getFilePermissions('directory')
      });

      // Set permissions explicitly on Unix-like systems
      if (!this.platformInfo.isWindows) {
        await setFilePermissions(path, 'directory');
      }
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Remove file or directory recursively
   */
  async remove(path: string): Promise<void> {
    try {
      const stats = await fs.lstat(path);
      
      if (stats.isDirectory()) {
        await fs.rmdir(path, { recursive: true });
      } else {
        await fs.unlink(path);
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Copy file or directory with platform-specific handling
   */
  async copy(src: string, dest: string, options: CopyOptions = {}): Promise<void> {
    const { overwrite = false, preserveTimestamps = true, followSymlinks = false, filter } = options;

    // Check if destination exists and handle overwrite
    if (await this.exists(dest) && !overwrite) {
      throw new Error(`Destination ${dest} already exists`);
    }

    // Apply filter if provided
    if (filter && !filter(src, dest)) {
      return;
    }

    const srcStats = await fs.lstat(src);

    if (srcStats.isDirectory()) {
      await this.copyDirectory(src, dest, options);
    } else if (srcStats.isFile()) {
      await this.copyFile(src, dest, options);
    } else if (srcStats.isSymbolicLink()) {
      if (followSymlinks) {
        const realPath = await fs.readlink(src);
        await this.copy(realPath, dest, options);
      } else {
        await this.copySymlink(src, dest);
      }
    }
  }

  /**
   * Copy file with platform-specific optimizations
   */
  private async copyFile(src: string, dest: string, options: CopyOptions): Promise<void> {
    const { preserveTimestamps = true } = options;

    // Ensure destination directory exists
    await this.createDirectory(dirname(dest));

    // Copy file
    await fs.copyFile(src, dest);

    // Set appropriate permissions
    if (!this.platformInfo.isWindows) {
      await setFilePermissions(dest, 'file');
    }

    // Preserve timestamps if requested
    if (preserveTimestamps) {
      const srcStats = await fs.stat(src);
      await fs.utimes(dest, srcStats.atime, srcStats.mtime);
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(src: string, dest: string, options: CopyOptions): Promise<void> {
    await this.createDirectory(dest);

    const entries = await fs.readdir(src);

    for (const entry of entries) {
      const srcPath = join(src, entry);
      const destPath = join(dest, entry);
      
      await this.copy(srcPath, destPath, options);
    }
  }

  /**
   * Copy symbolic link
   */
  private async copySymlink(src: string, dest: string): Promise<void> {
    const linkTarget = await fs.readlink(src);
    
    try {
      await fs.symlink(linkTarget, dest);
    } catch (error) {
      // If symlink creation fails, copy the target file instead
      log.warn(`Failed to create symlink, copying target instead: ${error}`);
      const resolvedTarget = resolve(dirname(src), linkTarget);
      await this.copyFile(resolvedTarget, dest, {});
    }
  }

  /**
   * Move file or directory
   */
  async move(src: string, dest: string): Promise<void> {
    try {
      await fs.rename(src, dest);
    } catch (error) {
      // If rename fails (cross-device move), copy and delete
      if ((error as any).code === 'EXDEV') {
        await this.copy(src, dest, { overwrite: true });
        await this.remove(src);
      } else {
        throw error;
      }
    }
  }

  /**
   * Read file with encoding detection
   */
  async readFile(path: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return await fs.readFile(path, encoding);
  }

  /**
   * Write file with platform-appropriate permissions
   */
  async writeFile(path: string, data: string | Buffer, encoding: BufferEncoding = 'utf8'): Promise<void> {
    // Ensure directory exists
    await this.createDirectory(dirname(path));

    // Write file
    await fs.writeFile(path, data, encoding);

    // Set appropriate permissions
    if (!this.platformInfo.isWindows) {
      await setFilePermissions(path, 'file');
    }
  }

  /**
   * Create temporary file
   */
  async createTempFile(prefix: string = 'flowdesk', suffix: string = '.tmp'): Promise<string> {
    const tempDir = tmpdir();
    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2)}${suffix}`;
    const tempPath = join(tempDir, filename);

    // Create empty file
    await this.writeFile(tempPath, '');

    return tempPath;
  }

  /**
   * Create temporary directory
   */
  async createTempDirectory(prefix: string = 'flowdesk'): Promise<string> {
    const tempDir = tmpdir();
    const dirname = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2)}`;
    const tempPath = join(tempDir, dirname);

    await this.createDirectory(tempPath);

    return tempPath;
  }

  /**
   * Find files matching pattern
   */
  async findFiles(directory: string, pattern: RegExp | string): Promise<string[]> {
    const results: string[] = [];
    
    const search = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await search(fullPath);
          } else if (entry.isFile()) {
            const matches = pattern instanceof RegExp 
              ? pattern.test(entry.name)
              : entry.name.includes(pattern);
              
            if (matches) {
              results.push(fullPath);
            }
          }
        }
      } catch (error) {
        log.warn(`Failed to search directory ${dir}:`, error);
      }
    };

    await search(directory);
    return results;
  }

  /**
   * Get directory size recursively
   */
  async getDirectorySize(directory: string): Promise<number> {
    let totalSize = 0;

    const calculateSize = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await calculateSize(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          }
        }
      } catch (error) {
        log.warn(`Failed to calculate size for directory ${dir}:`, error);
      }
    };

    await calculateSize(directory);
    return totalSize;
  }

  /**
   * Clean up old temporary files
   */
  async cleanupTempFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> { // 24 hours default
    const tempDir = tmpdir();
    let deletedCount = 0;

    try {
      const entries = await fs.readdir(tempDir, { withFileTypes: true });
      const now = Date.now();

      for (const entry of entries) {
        if (entry.name.includes('flowdesk')) {
          const fullPath = join(tempDir, entry.name);
          
          try {
            const stats = await fs.stat(fullPath);
            const age = now - stats.mtime.getTime();
            
            if (age > maxAge) {
              await this.remove(fullPath);
              deletedCount++;
            }
          } catch (error) {
            log.warn(`Failed to clean up temp file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      log.warn('Failed to clean up temp files:', error);
    }

    if (deletedCount > 0) {
      log.info(`Cleaned up ${deletedCount} old temporary files`);
    }

    return deletedCount;
  }

  /**
   * Check disk space availability
   */
  async checkDiskSpace(path: string): Promise<{ available: number; total: number } | null> {
    try {
      // Check if directory exists first
      const exists = await this.exists(path);
      if (!exists) {
        log.warn(`Cannot check disk space: path does not exist: ${path}`);
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
        } catch (statfsError) {
          log.debug('statfs not available, trying alternative methods');
        }
      }

      // Fallback for platforms without statfs
      // Use a cross-platform approach
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execPromise = promisify(exec);

      let command: string;
      let parseOutput: (output: string) => { available: number; total: number } | null;

      if (process.platform === 'win32') {
        // Windows: Use WMIC or PowerShell
        command = `wmic logicaldisk where caption="${path.charAt(0)}:" get size,freespace /value`;
        parseOutput = (output: string) => {
          const lines = output.split('\n');
          let freeSpace = 0;
          let totalSpace = 0;

          for (const line of lines) {
            if (line.startsWith('FreeSpace=')) {
              freeSpace = parseInt(line.split('=')[1]);
            } else if (line.startsWith('Size=')) {
              totalSpace = parseInt(line.split('=')[1]);
            }
          }

          return freeSpace && totalSpace ? { available: freeSpace, total: totalSpace } : null;
        };
      } else if (process.platform === 'darwin') {
        // macOS: Use df command
        command = `df -k "${path}" | tail -1`;
        parseOutput = (output: string) => {
          const parts = output.trim().split(/\s+/);
          if (parts.length >= 4) {
            const total = parseInt(parts[1]) * 1024; // Convert from KB to bytes
            const available = parseInt(parts[3]) * 1024;
            return { available, total };
          }
          return null;
        };
      } else {
        // Linux and other Unix-like systems: Use df command
        command = `df -B1 "${path}" | tail -1`;
        parseOutput = (output: string) => {
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
          log.debug(`Disk space for ${path}: ${(result.available / 1024 / 1024 / 1024).toFixed(2)} GB available of ${(result.total / 1024 / 1024 / 1024).toFixed(2)} GB total`);
          return result;
        } else {
          log.warn('Failed to parse disk space information');
          return null;
        }
      } catch (cmdError) {
        log.error('Command execution failed for disk space check:', cmdError);
        return null;
      }
    } catch (error) {
      log.error('Failed to check disk space:', error);
      return null;
    }
  }

  /**
   * Watch directory for changes
   */
  watchDirectory(directory: string, callback: (event: string, filename: string) => void): { close: () => void } {
    const fs = require('fs');
    
    try {
      const watcher = fs.watch(directory, { recursive: true }, callback);
      
      return {
        close: () => {
          try {
            watcher.close();
          } catch (error) {
            log.warn('Failed to close directory watcher:', error);
          }
        }
      };
    } catch (error) {
      log.error(`Failed to watch directory ${directory}:`, error);
      
      // Return dummy watcher
      return {
        close: () => {}
      };
    }
  }

  /**
   * Create hardlink if supported, otherwise copy
   */
  async createHardLink(src: string, dest: string): Promise<void> {
    try {
      await fs.link(src, dest);
    } catch (error) {
      // If hardlink fails, fall back to copy
      log.warn('Hardlink failed, falling back to copy:', error);
      await this.copyFile(src, dest, {});
    }
  }

  /**
   * Create symlink with fallback for Windows
   */
  async createSymLink(target: string, path: string): Promise<void> {
    try {
      await fs.symlink(target, path);
    } catch (error) {
      if (this.platformInfo.isWindows) {
        // On Windows, if symlink fails, copy the file instead
        log.warn('Symlink failed on Windows, falling back to copy:', error);
        await this.copyFile(target, path, {});
      } else {
        throw error;
      }
    }
  }
}

// Export singleton instance
export const fsUtils = new FileSystemUtils();