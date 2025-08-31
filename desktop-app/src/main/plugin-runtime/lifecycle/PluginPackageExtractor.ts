/**
 * Plugin Package Extractor - Handles extraction of plugin packages
 * 
 * Supports various package formats and provides secure extraction
 * with validation and safety checks.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { Extract } from 'tar';
import { PluginLogger } from '../utils/PluginLogger';

const streamPipeline = promisify(pipeline);

export interface ExtractionOptions {
  /** Maximum extraction size in bytes */
  maxSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Allowed file extensions */
  allowedExtensions?: string[];
  /** Temporary directory for extraction */
  tempDir?: string;
  /** Verify package integrity */
  verifyIntegrity?: boolean;
}

export interface ExtractionResult {
  /** Path to extracted content */
  extractedPath: string;
  /** List of extracted files */
  files: string[];
  /** Package metadata */
  metadata: {
    format: 'zip' | 'tar' | 'tar.gz' | 'directory';
    size: number;
    fileCount: number;
    checksum: string;
  };
}

/**
 * Plugin Package Extractor
 * 
 * Securely extracts plugin packages with validation and safety checks.
 */
export class PluginPackageExtractor {
  private readonly logger: PluginLogger;
  private readonly tempExtractions = new Map<string, string>();
  
  constructor() {
    this.logger = new PluginLogger('PluginPackageExtractor');
  }

  /**
   * Extract plugin package
   */
  async extract(
    packagePath: string, 
    options: ExtractionOptions = {}
  ): Promise<string> {
    const extractionOptions: Required<ExtractionOptions> = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10000,
      allowedExtensions: ['.js', '.ts', '.html', '.css', '.json', '.md', '.txt', '.png', '.jpg', '.svg'],
      tempDir: path.join(process.cwd(), 'plugins', '.temp'),
      verifyIntegrity: true,
      ...options
    };

    this.logger.info(`Extracting package: ${packagePath}`);

    try {
      // Verify package exists and get stats
      const packageStats = await fs.stat(packagePath);
      
      if (packageStats.size > extractionOptions.maxSize) {
        throw new Error(`Package size ${packageStats.size} exceeds maximum ${extractionOptions.maxSize}`);
      }

      // Determine package format
      const format = this.detectPackageFormat(packagePath);
      this.logger.debug(`Detected package format: ${format}`);

      // Create extraction directory
      const extractionId = this.generateExtractionId(packagePath);
      const extractionPath = path.join(extractionOptions.tempDir, extractionId);
      
      await fs.mkdir(extractionPath, { recursive: true });

      // Extract based on format
      let extractedFiles: string[] = [];
      
      switch (format) {
        case 'directory':
          extractedFiles = await this.extractDirectory(packagePath, extractionPath, extractionOptions);
          break;
        case 'zip':
          extractedFiles = await this.extractZip(packagePath, extractionPath, extractionOptions);
          break;
        case 'tar':
        case 'tar.gz':
          extractedFiles = await this.extractTar(packagePath, extractionPath, extractionOptions);
          break;
        default:
          throw new Error(`Unsupported package format: ${format}`);
      }

      // Validate extracted content
      await this.validateExtractedContent(extractionPath, extractedFiles, extractionOptions);

      // Register extraction for cleanup
      this.tempExtractions.set(extractionId, extractionPath);

      this.logger.info(`Package extracted successfully to ${extractionPath} (${extractedFiles.length} files)`);
      
      return extractionPath;
    } catch (error) {
      this.logger.error(`Failed to extract package ${packagePath}`, error);
      throw error;
    }
  }

  /**
   * Cleanup extracted package
   */
  async cleanup(extractionPath: string): Promise<void> {
    try {
      await fs.rm(extractionPath, { recursive: true, force: true });
      
      // Remove from tracking
      for (const [id, path] of this.tempExtractions.entries()) {
        if (path === extractionPath) {
          this.tempExtractions.delete(id);
          break;
        }
      }
      
      this.logger.debug(`Cleaned up extraction: ${extractionPath}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup extraction ${extractionPath}`, error);
    }
  }

  /**
   * Cleanup all temporary extractions
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.tempExtractions.values()).map(
      path => this.cleanup(path)
    );
    
    await Promise.allSettled(cleanupPromises);
    this.tempExtractions.clear();
  }

  /**
   * Private: Detect package format
   */
  private detectPackageFormat(packagePath: string): 'zip' | 'tar' | 'tar.gz' | 'directory' {
    const stats = require('fs').statSync(packagePath);
    
    if (stats.isDirectory()) {
      return 'directory';
    }
    
    const ext = path.extname(packagePath).toLowerCase();
    const fullName = path.basename(packagePath).toLowerCase();
    
    if (fullName.endsWith('.tar.gz') || fullName.endsWith('.tgz')) {
      return 'tar.gz';
    } else if (ext === '.tar') {
      return 'tar';
    } else if (ext === '.zip') {
      return 'zip';
    }
    
    // Try to detect by file signature
    const buffer = require('fs').readFileSync(packagePath, { start: 0, end: 10 });
    
    // ZIP signature: PK
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
      return 'zip';
    }
    
    // TAR signature: ustar (at offset 257)
    const tarBuffer = require('fs').readFileSync(packagePath, { start: 257, end: 262 });
    if (tarBuffer.toString() === 'ustar') {
      return 'tar';
    }
    
    // GZIP signature: 1f 8b
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      return 'tar.gz';
    }
    
    throw new Error(`Unable to determine package format for ${packagePath}`);
  }

  /**
   * Private: Generate unique extraction ID
   */
  private generateExtractionId(packagePath: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(packagePath);
    hash.update(Date.now().toString());
    return `extract-${hash.digest('hex').substring(0, 16)}`;
  }

  /**
   * Private: Extract directory (copy files)
   */
  private async extractDirectory(
    sourcePath: string,
    extractionPath: string,
    options: Required<ExtractionOptions>
  ): Promise<string[]> {
    const files: string[] = [];
    
    const copyRecursive = async (src: string, dest: string, relativePath: string = '') => {
      const entries = await fs.readdir(src, { withFileTypes: true });
      
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (files.length >= options.maxFiles) {
          throw new Error(`Too many files (max: ${options.maxFiles})`);
        }
        
        if (entry.isDirectory()) {
          await fs.mkdir(destPath, { recursive: true });
          await copyRecursive(srcPath, destPath, relPath);
        } else if (entry.isFile()) {
          // Check file extension
          if (!this.isAllowedFile(entry.name, options.allowedExtensions)) {
            this.logger.warn(`Skipping disallowed file: ${relPath}`);
            continue;
          }
          
          // Check file size
          const stats = await fs.stat(srcPath);
          if (stats.size > options.maxSize / 10) { // Individual file size limit
            throw new Error(`File ${relPath} too large: ${stats.size}`);
          }
          
          await fs.copyFile(srcPath, destPath);
          files.push(relPath);
        }
      }
    };
    
    await copyRecursive(sourcePath, extractionPath);
    return files;
  }

  /**
   * Private: Extract ZIP archive
   */
  private async extractZip(
    packagePath: string,
    extractionPath: string,
    options: Required<ExtractionOptions>
  ): Promise<string[]> {
    // For production use, you'd want to use a proper ZIP library like yauzl
    // This is a simplified implementation using system unzip command
    
    return new Promise((resolve, reject) => {
      const files: string[] = [];
      
      const unzipProcess = spawn('unzip', ['-j', packagePath, '-d', extractionPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      unzipProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      unzipProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      unzipProcess.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Unzip failed with code ${code}: ${errorOutput}`));
          return;
        }
        
        try {
          // List extracted files
          const extractedFiles = await fs.readdir(extractionPath);
          resolve(extractedFiles);
        } catch (error) {
          reject(error);
        }
      });
      
      unzipProcess.on('error', (error) => {
        reject(new Error(`Failed to start unzip process: ${error.message}`));
      });
    });
  }

  /**
   * Private: Extract TAR archive
   */
  private async extractTar(
    packagePath: string,
    extractionPath: string,
    options: Required<ExtractionOptions>
  ): Promise<string[]> {
    const files: string[] = [];
    
    return new Promise((resolve, reject) => {
      const extract = new Extract({
        path: extractionPath,
        filter: (path: string) => {
          // Security check for path traversal
          if (path.includes('..') || path.startsWith('/')) {
            this.logger.warn(`Blocked unsafe path: ${path}`);
            return false;
          }
          
          // File extension check
          if (!this.isAllowedFile(path, options.allowedExtensions)) {
            this.logger.warn(`Skipping disallowed file: ${path}`);
            return false;
          }
          
          files.push(path);
          return true;
        }
      });
      
      extract.on('error', reject);
      extract.on('end', () => resolve(files));
      
      const stream = createReadStream(packagePath);
      
      if (packagePath.endsWith('.gz') || packagePath.endsWith('.tgz')) {
        const zlib = require('zlib');
        stream.pipe(zlib.createGunzip()).pipe(extract);
      } else {
        stream.pipe(extract);
      }
    });
  }

  /**
   * Private: Validate extracted content
   */
  private async validateExtractedContent(
    extractionPath: string,
    files: string[],
    options: Required<ExtractionOptions>
  ): Promise<void> {
    // Check file count
    if (files.length > options.maxFiles) {
      throw new Error(`Too many files extracted: ${files.length} > ${options.maxFiles}`);
    }
    
    // Check for required files
    const requiredFiles = ['plugin.json'];
    for (const requiredFile of requiredFiles) {
      const filePath = path.join(extractionPath, requiredFile);
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`Required file missing: ${requiredFile}`);
      }
    }
    
    // Validate total extracted size
    let totalSize = 0;
    for (const file of files) {
      const filePath = path.join(extractionPath, file);
      try {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        
        if (totalSize > options.maxSize) {
          throw new Error(`Total extracted size ${totalSize} exceeds limit ${options.maxSize}`);
        }
      } catch (error) {
        // File might not exist (directory entry), skip
        continue;
      }
    }
    
    // Security validation
    await this.validateSecurity(extractionPath, files);
    
    this.logger.debug(`Validation passed: ${files.length} files, ${totalSize} bytes`);
  }

  /**
   * Private: Validate security of extracted content
   */
  private async validateSecurity(extractionPath: string, files: string[]): Promise<void> {
    for (const file of files) {
      const filePath = path.join(extractionPath, file);
      
      try {
        const stats = await fs.stat(filePath);
        
        // Skip directories
        if (stats.isDirectory()) continue;
        
        // Check for executable files
        if (stats.mode & 0o111) {
          this.logger.warn(`Found executable file: ${file}`);
          // Remove execute permissions
          await fs.chmod(filePath, stats.mode & ~0o111);
        }
        
        // Check for suspicious file names
        const fileName = path.basename(file);
        const suspiciousPatterns = [
          /\.exe$/i,
          /\.bat$/i,
          /\.cmd$/i,
          /\.sh$/i,
          /\.scr$/i,
          /\.dll$/i,
          /\.so$/i,
          /\.dylib$/i
        ];
        
        if (suspiciousPatterns.some(pattern => pattern.test(fileName))) {
          throw new Error(`Suspicious file detected: ${file}`);
        }
        
        // Basic content validation for script files
        if (fileName.endsWith('.js') || fileName.endsWith('.ts')) {
          await this.validateScriptFile(filePath);
        }
      } catch (error) {
        if (error.code === 'ENOENT') continue; // File doesn't exist
        throw error;
      }
    }
  }

  /**
   * Private: Validate script file content
   */
  private async validateScriptFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check for dangerous patterns
      const dangerousPatterns = [
        /require\s*\(\s*['"]child_process['"]\s*\)/, // Child process
        /require\s*\(\s*['"]fs['"]\s*\)/, // File system access
        /require\s*\(\s*['"]os['"]\s*\)/, // OS access
        /eval\s*\(/, // Eval
        /Function\s*\(/, // Function constructor
        /process\.exit/, // Process manipulation
        /process\.kill/, // Process manipulation
        /__dirname/, // Directory access
        /__filename/, // File access
        /global\./, // Global object access
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          this.logger.warn(`Potentially dangerous pattern found in ${filePath}: ${pattern.source}`);
          // In production, you might want to reject the file or sanitize it
        }
      }
      
      // Check file size
      if (content.length > 1024 * 1024) { // 1MB limit for script files
        throw new Error(`Script file too large: ${filePath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') return; // File doesn't exist
      throw error;
    }
  }

  /**
   * Private: Check if file is allowed based on extension
   */
  private isAllowedFile(fileName: string, allowedExtensions: string[]): boolean {
    const ext = path.extname(fileName).toLowerCase();
    
    // Allow files without extension (like README)
    if (!ext) {
      const baseName = path.basename(fileName).toLowerCase();
      const allowedNames = ['readme', 'license', 'changelog', 'manifest'];
      return allowedNames.some(name => baseName.includes(name));
    }
    
    return allowedExtensions.includes(ext);
  }
}