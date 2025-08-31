/**
 * Plugin Version Validator - Handles semantic versioning and compatibility checks
 * 
 * This utility provides comprehensive version validation and compatibility checking
 * for plugins and their dependencies.
 */

import semver from 'semver';
import { PluginLogger } from '../utils/PluginLogger';

export interface VersionCompatibilityResult {
  /** Whether versions are compatible */
  compatible: boolean;
  /** Reason for incompatibility */
  reason?: 'version_too_low' | 'version_too_high' | 'invalid_version' | 'invalid_range';
  /** Additional details */
  details?: string;
}

export interface DependencyResolutionResult {
  /** Whether dependencies can be resolved */
  resolvable: boolean;
  /** Conflicting dependencies */
  conflicts: Array<{
    pluginId: string;
    requiredVersions: string[];
    conflict: string;
  }>;
  /** Missing dependencies */
  missing: string[];
  /** Resolution order */
  resolutionOrder: string[];
}

/**
 * Plugin Version Validator
 * 
 * Handles all version-related validation and compatibility checking.
 */
export class PluginVersionValidator {
  private readonly logger: PluginLogger;

  constructor() {
    this.logger = new PluginLogger('PluginVersionValidator');
  }

  /**
   * Check if a version string is valid semantic version
   */
  isValidVersion(version: string): boolean {
    return semver.valid(version) !== null;
  }

  /**
   * Check if a version range is valid
   */
  isValidVersionRange(range: string): boolean {
    try {
      return semver.validRange(range) !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a version satisfies a range
   */
  satisfiesRange(version: string, range: string): boolean {
    try {
      return semver.satisfies(version, range);
    } catch (error) {
      this.logger.warn(`Invalid version or range: ${version}, ${range}`, error);
      return false;
    }
  }

  /**
   * Compare two versions
   */
  compareVersions(version1: string, version2: string): -1 | 0 | 1 {
    try {
      return semver.compare(version1, version2);
    } catch (error) {
      this.logger.warn(`Invalid version comparison: ${version1} vs ${version2}`, error);
      return 0;
    }
  }

  /**
   * Check compatibility between plugin version requirements and Flow Desk version
   */
  checkCompatibility(
    minFlowDeskVersion: string,
    maxFlowDeskVersion: string | undefined,
    currentFlowDeskVersion: string
  ): VersionCompatibilityResult {
    // Validate version strings
    if (!this.isValidVersion(currentFlowDeskVersion)) {
      return {
        compatible: false,
        reason: 'invalid_version',
        details: `Invalid Flow Desk version: ${currentFlowDeskVersion}`
      };
    }

    if (!this.isValidVersion(minFlowDeskVersion)) {
      return {
        compatible: false,
        reason: 'invalid_version',
        details: `Invalid minimum Flow Desk version: ${minFlowDeskVersion}`
      };
    }

    if (maxFlowDeskVersion && !this.isValidVersion(maxFlowDeskVersion)) {
      return {
        compatible: false,
        reason: 'invalid_version',
        details: `Invalid maximum Flow Desk version: ${maxFlowDeskVersion}`
      };
    }

    // Check minimum version requirement
    if (semver.lt(currentFlowDeskVersion, minFlowDeskVersion)) {
      return {
        compatible: false,
        reason: 'version_too_low',
        details: `Current version ${currentFlowDeskVersion} is below minimum required ${minFlowDeskVersion}`
      };
    }

    // Check maximum version requirement if specified
    if (maxFlowDeskVersion && semver.gt(currentFlowDeskVersion, maxFlowDeskVersion)) {
      return {
        compatible: false,
        reason: 'version_too_high',
        details: `Current version ${currentFlowDeskVersion} is above maximum supported ${maxFlowDeskVersion}`
      };
    }

    return { compatible: true };
  }

  /**
   * Check if plugin version is newer than installed version
   */
  isNewerVersion(newVersion: string, installedVersion: string): boolean {
    try {
      return semver.gt(newVersion, installedVersion);
    } catch (error) {
      this.logger.warn(`Error comparing versions: ${newVersion} vs ${installedVersion}`, error);
      return false;
    }
  }

  /**
   * Get the highest version from a list of versions
   */
  getHighestVersion(versions: string[]): string | null {
    const validVersions = versions.filter(v => this.isValidVersion(v));
    
    if (validVersions.length === 0) {
      return null;
    }

    return validVersions.reduce((highest, current) => {
      return semver.gt(current, highest) ? current : highest;
    });
  }

  /**
   * Get the lowest version that satisfies a range
   */
  getLowestSatisfyingVersion(versions: string[], range: string): string | null {
    const satisfyingVersions = versions.filter(v => this.satisfiesRange(v, range));
    
    if (satisfyingVersions.length === 0) {
      return null;
    }

    return satisfyingVersions.reduce((lowest, current) => {
      return semver.lt(current, lowest) ? current : lowest;
    });
  }

  /**
   * Get all versions that satisfy a range, sorted by version
   */
  getVersionsSatisfyingRange(versions: string[], range: string): string[] {
    return versions
      .filter(v => this.satisfiesRange(v, range))
      .sort((a, b) => semver.compare(a, b));
  }

  /**
   * Resolve plugin dependencies and check for conflicts
   */
  resolveDependencies(
    pluginDependencies: Array<{
      pluginId: string;
      versionRange: string;
      optional: boolean;
    }>,
    availablePlugins: Array<{
      id: string;
      version: string;
      dependencies: Array<{
        pluginId: string;
        versionRange: string;
        optional: boolean;
      }>;
    }>
  ): DependencyResolutionResult {
    const result: DependencyResolutionResult = {
      resolvable: true,
      conflicts: [],
      missing: [],
      resolutionOrder: []
    };

    const versionRequirements = new Map<string, Set<string>>();
    const resolved = new Set<string>();
    const resolving = new Set<string>();

    // Collect all version requirements
    const collectRequirements = (deps: typeof pluginDependencies, source?: string) => {
      for (const dep of deps) {
        if (!versionRequirements.has(dep.pluginId)) {
          versionRequirements.set(dep.pluginId, new Set());
        }
        versionRequirements.get(dep.pluginId)!.add(dep.versionRange);
        
        this.logger.debug(`Dependency requirement: ${dep.pluginId}@${dep.versionRange}${source ? ` (from ${source})` : ''}`);
      }
    };

    // Start with direct dependencies
    collectRequirements(pluginDependencies);

    // Recursively resolve dependencies
    const resolveDependency = (pluginId: string): boolean => {
      if (resolved.has(pluginId)) {
        return true;
      }

      if (resolving.has(pluginId)) {
        // Circular dependency detected
        this.logger.warn(`Circular dependency detected: ${pluginId}`);
        return false;
      }

      resolving.add(pluginId);

      // Find available plugin
      const availablePlugin = availablePlugins.find(p => p.id === pluginId);
      if (!availablePlugin) {
        result.missing.push(pluginId);
        resolving.delete(pluginId);
        return false;
      }

      // Check if available version satisfies all requirements
      const requirements = Array.from(versionRequirements.get(pluginId) || []);
      const satisfiesAll = requirements.every(range => 
        this.satisfiesRange(availablePlugin.version, range)
      );

      if (!satisfiesAll) {
        result.conflicts.push({
          pluginId,
          requiredVersions: requirements,
          conflict: `Available version ${availablePlugin.version} doesn't satisfy all requirements`
        });
        resolving.delete(pluginId);
        return false;
      }

      // Resolve plugin's dependencies first
      collectRequirements(availablePlugin.dependencies, pluginId);
      
      for (const dep of availablePlugin.dependencies) {
        if (!dep.optional && !resolveDependency(dep.pluginId)) {
          resolving.delete(pluginId);
          return false;
        }
      }

      resolved.add(pluginId);
      resolving.delete(pluginId);
      result.resolutionOrder.push(pluginId);
      
      return true;
    };

    // Resolve all dependencies
    for (const [pluginId] of versionRequirements) {
      const dep = pluginDependencies.find(d => d.pluginId === pluginId);
      if (!dep || !dep.optional) {
        resolveDependency(pluginId);
      }
    }

    // Check if resolution was successful
    result.resolvable = result.conflicts.length === 0 && result.missing.length === 0;

    if (!result.resolvable) {
      this.logger.warn('Dependency resolution failed', {
        conflicts: result.conflicts,
        missing: result.missing
      });
    }

    return result;
  }

  /**
   * Generate version constraint for dependency
   */
  generateVersionConstraint(version: string, constraintType: 'exact' | 'compatible' | 'latest'): string {
    switch (constraintType) {
      case 'exact':
        return version;
      case 'compatible':
        // Use caret range for compatible versions (e.g., ^1.2.3 allows 1.x.x but not 2.x.x)
        return `^${version}`;
      case 'latest':
        // Use tilde range for latest patch versions (e.g., ~1.2.3 allows 1.2.x but not 1.3.x)
        return `~${version}`;
      default:
        return version;
    }
  }

  /**
   * Check if version is pre-release
   */
  isPrerelease(version: string): boolean {
    const parsed = semver.parse(version);
    return parsed ? parsed.prerelease.length > 0 : false;
  }

  /**
   * Get version info
   */
  getVersionInfo(version: string): {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[];
    build: string[];
    isPrerelease: boolean;
    isStable: boolean;
  } | null {
    const parsed = semver.parse(version);
    if (!parsed) return null;

    return {
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
      prerelease: parsed.prerelease.map(p => p.toString()),
      build: parsed.build,
      isPrerelease: parsed.prerelease.length > 0,
      isStable: parsed.prerelease.length === 0 && parsed.major >= 1
    };
  }

  /**
   * Create version range that includes all compatible versions
   */
  createCompatibleRange(baseVersion: string): string {
    const parsed = semver.parse(baseVersion);
    if (!parsed) return baseVersion;

    // For versions >= 1.0.0, use caret range
    if (parsed.major >= 1) {
      return `^${baseVersion}`;
    }

    // For versions < 1.0.0, use tilde range to be more restrictive
    return `~${baseVersion}`;
  }

  /**
   * Check if version update is breaking
   */
  isBreakingChange(fromVersion: string, toVersion: string): boolean {
    try {
      const from = semver.parse(fromVersion);
      const to = semver.parse(toVersion);

      if (!from || !to) return true;

      // Major version change is always breaking
      if (to.major > from.major) return true;

      // For versions < 1.0.0, minor version changes are breaking
      if (from.major === 0 && to.minor > from.minor) return true;

      return false;
    } catch (error) {
      this.logger.warn(`Error checking breaking change: ${fromVersion} -> ${toVersion}`, error);
      return true; // Conservative approach
    }
  }

  /**
   * Get recommended update strategy
   */
  getUpdateStrategy(
    currentVersion: string,
    latestVersion: string
  ): 'patch' | 'minor' | 'major' | 'prerelease' | 'none' {
    if (!this.isValidVersion(currentVersion) || !this.isValidVersion(latestVersion)) {
      return 'none';
    }

    if (semver.eq(currentVersion, latestVersion)) {
      return 'none';
    }

    if (semver.lt(currentVersion, latestVersion)) {
      const current = semver.parse(currentVersion)!;
      const latest = semver.parse(latestVersion)!;

      if (latest.prerelease.length > 0) {
        return 'prerelease';
      } else if (latest.major > current.major) {
        return 'major';
      } else if (latest.minor > current.minor) {
        return 'minor';
      } else {
        return 'patch';
      }
    }

    return 'none';
  }
}