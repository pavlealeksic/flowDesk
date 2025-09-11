/**
 * Plugin Manifest Loader - Handles loading, validation, and parsing of plugin manifests
 * 
 * This module is responsible for:
 * - Loading plugin.json manifests from plugin packages
 * - Validating manifest structure and content
 * - Parsing and normalizing manifest data
 * - Ensuring compatibility with Flow Desk version requirements
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { 
  PluginManifest, 
  PluginManifestSchema, 
  PluginType, 
  PluginCategory,
  Platform,
  PluginPermission,
  PluginScope 
} from '@flow-desk/shared';
import { PluginLogger } from '../utils/PluginLogger';
import { PluginVersionValidator } from './PluginVersionValidator';

export interface ManifestLoadResult {
  /** Loaded manifest */
  manifest: PluginManifest;
  /** Validation warnings */
  warnings: string[];
  /** Validation errors (if any) */
  errors: string[];
  /** Whether manifest is valid */
  isValid: boolean;
}

export interface ManifestValidationOptions {
  /** Strict validation mode */
  strict: boolean;
  /** Check version compatibility */
  checkCompatibility: boolean;
  /** Current Flow Desk version */
  flowDeskVersion: string;
  /** Allowed plugin types */
  allowedTypes?: PluginType[];
  /** Allowed categories */
  allowedCategories?: PluginCategory[];
}

/**
 * Plugin Manifest Loader
 * 
 * Handles all aspects of plugin manifest loading and validation.
 */
export class PluginManifestLoader {
  private readonly logger: PluginLogger;
  private readonly versionValidator: PluginVersionValidator;
  
  constructor() {
    this.logger = new PluginLogger('PluginManifestLoader');
    this.versionValidator = new PluginVersionValidator();
  }

  /**
   * Load manifest from plugin directory
   */
  async loadFromDirectory(pluginDir: string, options?: Partial<ManifestValidationOptions>): Promise<ManifestLoadResult> {
    const manifestPath = path.join(pluginDir, 'plugin.json');
    return this.loadFromFile(manifestPath, options);
  }

  /**
   * Load manifest from file path
   */
  async loadFromFile(manifestPath: string, options?: Partial<ManifestValidationOptions>): Promise<ManifestLoadResult> {
    this.logger.debug(`Loading manifest from ${manifestPath}`);

    const result: ManifestLoadResult = {
      manifest: {} as PluginManifest,
      warnings: [],
      errors: [],
      isValid: false
    };

    try {
      // Read manifest file
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      
      // Parse JSON
      let manifestData: any;
      try {
        manifestData = JSON.parse(manifestContent);
      } catch (parseError) {
        result.errors.push(`Invalid JSON in manifest file: ${(parseError as Error).message}`);
        return result;
      }

      // Validate and process manifest
      const validationResult = await this.validateManifest(manifestData, options);
      result.warnings = validationResult.warnings;
      result.errors = validationResult.errors;
      result.isValid = validationResult.isValid;

      if (validationResult.isValid) {
        result.manifest = validationResult.manifest;
        this.logger.info(`Successfully loaded manifest for plugin ${result.manifest.id}`);
      } else {
        this.logger.error(`Manifest validation failed for ${manifestPath}`, result.errors);
      }

      return result;
    } catch (error) {
      result.errors.push(`Failed to load manifest file: ${(error as Error).message}`);
      this.logger.error(`Failed to load manifest from ${manifestPath}`, error);
      return result;
    }
  }

  /**
   * Load manifest from plugin package (zip/tar)
   */
  async loadFromPackage(packagePath: string, options?: Partial<ManifestValidationOptions>): Promise<ManifestLoadResult> {
    this.logger.debug(`Loading manifest from package ${packagePath}`);

    // For now, assume the package is extracted to a temporary directory
    // In a full implementation, you would extract the package and read the manifest
    const result: ManifestLoadResult = {
      manifest: {} as PluginManifest,
      warnings: ['Package loading not yet implemented'],
      errors: ['Package loading functionality not implemented'],
      isValid: false
    };

    return result;
  }

  /**
   * Validate manifest data
   */
  async validateManifest(
    manifestData: any, 
    options?: Partial<ManifestValidationOptions>
  ): Promise<ManifestLoadResult> {
    const validationOptions: ManifestValidationOptions = {
      strict: true,
      checkCompatibility: true,
      flowDeskVersion: process.env.npm_package_version || '0.1.0',
      ...options
    };

    const result: ManifestLoadResult = {
      manifest: {} as PluginManifest,
      warnings: [],
      errors: [],
      isValid: false
    };

    try {
      // Schema validation
      const schemaResult = PluginManifestSchema.safeParse(manifestData);
      
      if (!schemaResult.success) {
        result.errors.push(...schemaResult.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ));
        return result;
      }

      const manifest = schemaResult.data as PluginManifest;

      // Additional validation checks
      await this.performAdditionalValidation(manifest, validationOptions, result);

      // If no errors, manifest is valid
      if (result.errors.length === 0) {
        result.manifest = manifest;
        result.isValid = true;
      }

      return result;
    } catch (error) {
      result.errors.push(`Validation error: ${(error as Error).message}`);
      this.logger.error('Manifest validation error', error);
      return result;
    }
  }

  /**
   * Create minimal valid manifest for development
   */
  createMinimalManifest(pluginId: string, name: string, version: string): PluginManifest {
    return {
      id: pluginId,
      name,
      version,
      description: 'Development plugin',
      author: 'Developer',
      license: 'MIT',
      type: 'connector',
      category: 'utilities',
      tags: ['development'],
      minFlowDeskVersion: '0.1.0',
      platforms: ['desktop'],
      permissions: [],
      scopes: [],
      entrypoints: [{
        type: 'main',
        file: 'index.js'
      }],
      capabilities: {},
      build: {
        buildTime: new Date().toISOString(),
        environment: 'development'
      }
    };
  }

  /**
   * Normalize manifest data (fill in defaults, etc.)
   */
  normalizeManifest(manifest: PluginManifest): PluginManifest {
    const normalized = { ...manifest };

    // Fill in optional fields with defaults
    normalized.authorEmail = normalized.authorEmail || '';
    normalized.homepage = normalized.homepage || '';
    normalized.repository = normalized.repository || '';
    normalized.documentation = normalized.documentation || '';
    normalized.icon = normalized.icon || '';
    normalized.screenshots = normalized.screenshots || [];
    normalized.maxFlowDeskVersion = normalized.maxFlowDeskVersion || undefined;
    normalized.dependencies = normalized.dependencies || [];
    
    // Normalize capabilities
    normalized.capabilities = {
      search: false,
      notifications: false,
      automations: false,
      oauth: false,
      webhooks: false,
      filePreviews: false,
      quickActions: false,
      contextualData: false,
      realTime: false,
      offline: false,
      ...normalized.capabilities
    };

    // Normalize build info
    if (!normalized.build.commit) {
      normalized.build.commit = '';
    }
    if (!normalized.build.bundleSize) {
      normalized.build.bundleSize = 0;
    }
    if (!normalized.build.buildTools) {
      normalized.build.buildTools = [];
    }
    if (!normalized.build.csp) {
      normalized.build.csp = '';
    }

    return normalized;
  }

  /**
   * Private: Perform additional validation beyond schema
   */
  private async performAdditionalValidation(
    manifest: PluginManifest,
    options: ManifestValidationOptions,
    result: ManifestLoadResult
  ): Promise<void> {
    // Version compatibility check
    if (options.checkCompatibility) {
      const compatibilityCheck = this.versionValidator.checkCompatibility(
        manifest.minFlowDeskVersion,
        manifest.maxFlowDeskVersion,
        options.flowDeskVersion
      );

      if (!compatibilityCheck.compatible) {
        if (compatibilityCheck.reason === 'version_too_low') {
          result.errors.push(`Plugin requires Flow Desk version ${manifest.minFlowDeskVersion} or higher, current: ${options.flowDeskVersion}`);
        } else if (compatibilityCheck.reason === 'version_too_high') {
          result.errors.push(`Plugin supports Flow Desk version up to ${manifest.maxFlowDeskVersion}, current: ${options.flowDeskVersion}`);
        }
      }
    }

    // Plugin type validation
    if (options.allowedTypes && !options.allowedTypes.includes(manifest.type)) {
      result.errors.push(`Plugin type '${manifest.type}' is not allowed`);
    }

    // Category validation
    if (options.allowedCategories && !options.allowedCategories.includes(manifest.category)) {
      result.errors.push(`Plugin category '${manifest.category}' is not allowed`);
    }

    // Entrypoint validation
    const entrypointValidation = this.validateEntrypoints(manifest);
    result.warnings.push(...entrypointValidation.warnings);
    result.errors.push(...entrypointValidation.errors);

    // Permission validation
    const permissionValidation = this.validatePermissions(manifest);
    result.warnings.push(...permissionValidation.warnings);
    result.errors.push(...permissionValidation.errors);

    // Platform validation
    const platformValidation = this.validatePlatforms(manifest);
    result.warnings.push(...platformValidation.warnings);
    result.errors.push(...platformValidation.errors);

    // Dependency validation
    const dependencyValidation = this.validateDependencies(manifest);
    result.warnings.push(...dependencyValidation.warnings);
    result.errors.push(...dependencyValidation.errors);

    // Security validation
    const securityValidation = this.validateSecurity(manifest);
    result.warnings.push(...securityValidation.warnings);
    result.errors.push(...securityValidation.errors);
  }

  /**
   * Private: Validate entrypoints
   */
  private validateEntrypoints(manifest: PluginManifest): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (manifest.entrypoints.length === 0) {
      errors.push('Plugin must have at least one entrypoint');
      return { warnings, errors };
    }

    // Must have main entrypoint
    const hasMain = manifest.entrypoints.some(ep => ep.type === 'main');
    if (!hasMain) {
      errors.push('Plugin must have a main entrypoint');
    }

    // Validate file paths
    for (const entrypoint of manifest.entrypoints) {
      if (!entrypoint.file || entrypoint.file.trim() === '') {
        errors.push(`Entrypoint ${entrypoint.type} has empty file path`);
        continue;
      }

      // Check for potentially dangerous file paths
      if (entrypoint.file.includes('..') || entrypoint.file.startsWith('/')) {
        errors.push(`Entrypoint ${entrypoint.type} has unsafe file path: ${entrypoint.file}`);
      }

      // Warn about non-standard file extensions
      const fileExt = path.extname(entrypoint.file).toLowerCase();
      if (!['.js', '.ts', '.html', '.css'].includes(fileExt)) {
        warnings.push(`Entrypoint ${entrypoint.type} has non-standard file extension: ${fileExt}`);
      }
    }

    return { warnings, errors };
  }

  /**
   * Private: Validate permissions
   */
  private validatePermissions(manifest: PluginManifest): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for dangerous permission combinations
    const dangerousPermissions = ['system:shell', 'system:process', 'system:registry'];
    const hasDangerousPermissions = manifest.permissions.some(p => dangerousPermissions.includes(p));
    
    if (hasDangerousPermissions) {
      warnings.push('Plugin requests potentially dangerous system permissions');
    }

    // Network + filesystem combination warning
    if (manifest.permissions.includes('network') && manifest.permissions.includes('filesystem')) {
      warnings.push('Plugin requests both network and filesystem access - ensure this is necessary');
    }

    // Validate permission-capability consistency
    if (manifest.capabilities.oauth && !manifest.permissions.includes('network')) {
      warnings.push('Plugin declares OAuth capability but does not request network permission');
    }

    if (manifest.capabilities.webhooks && !manifest.permissions.includes('network')) {
      errors.push('Plugin declares webhook capability but does not request network permission');
    }

    return { warnings, errors };
  }

  /**
   * Private: Validate platforms
   */
  private validatePlatforms(manifest: PluginManifest): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (manifest.platforms.length === 0) {
      errors.push('Plugin must support at least one platform');
    }

    // Check for platform-specific entrypoints
    for (const entrypoint of manifest.entrypoints) {
      if (entrypoint.platforms) {
        const platformKeys = Object.keys(entrypoint.platforms);
        const unsupportedPlatforms = platformKeys.filter(p => !manifest.platforms.includes(p as Platform));
        
        if (unsupportedPlatforms.length > 0) {
          warnings.push(`Entrypoint ${entrypoint.type} specifies files for unsupported platforms: ${unsupportedPlatforms.join(', ')}`);
        }
      }
    }

    return { warnings, errors };
  }

  /**
   * Private: Validate dependencies
   */
  private validateDependencies(manifest: PluginManifest): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!manifest.dependencies) return { warnings, errors };

    for (const dep of manifest.dependencies) {
      // Validate semver version range
      if (!this.versionValidator.isValidVersionRange(dep.version)) {
        errors.push(`Invalid version range for dependency ${dep.pluginId}: ${dep.version}`);
      }

      // Check for circular dependencies (basic check)
      if (dep.pluginId === manifest.id) {
        errors.push('Plugin cannot depend on itself');
      }

      // Warn about non-optional system dependencies
      if (dep.pluginId.startsWith('system:') && !dep.optional) {
        warnings.push(`System dependency ${dep.pluginId} should probably be optional`);
      }
    }

    return { warnings, errors };
  }

  /**
   * Private: Validate security aspects
   */
  private validateSecurity(manifest: PluginManifest): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for missing security-related fields
    if (manifest.capabilities.oauth && !manifest.homepage) {
      warnings.push('OAuth-enabled plugin should have a homepage for trust verification');
    }

    if (manifest.permissions.length > 0 && !manifest.documentation) {
      warnings.push('Plugin with permissions should have documentation explaining their use');
    }

    // Validate CSP if provided
    if (manifest.build.csp) {
      try {
        // Basic CSP validation
        if (!manifest.build.csp.includes("default-src") && !manifest.build.csp.includes("script-src")) {
          warnings.push('CSP should include default-src or script-src directive');
        }
      } catch (error) {
        warnings.push('Invalid CSP format');
      }
    }

    // Check marketplace info for published plugins
    if (manifest.marketplace?.published) {
      if (!manifest.marketplace.privacyPolicy && manifest.permissions.length > 0) {
        warnings.push('Published plugin with permissions should have a privacy policy');
      }

      if (!manifest.marketplace.support?.email && !manifest.marketplace.support?.url) {
        warnings.push('Published plugin should have support contact information');
      }
    }

    return { warnings, errors };
  }
}