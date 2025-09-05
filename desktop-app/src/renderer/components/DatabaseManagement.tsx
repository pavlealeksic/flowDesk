/**
 * Database Management Component
 * 
 * Provides database health monitoring, repair, and migration management
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface DatabaseStatus {
  initialized: boolean;
  config: {
    userDataPath: string;
    mailDbPath: string;
    calendarDbPath: string;
    searchIndexPath: string;
    schemaVersion: number;
  };
}

interface DatabaseIntegrityResult {
  mail: { valid: boolean; error: string | null };
  calendar: { valid: boolean; error: string | null };
}

interface MigrationStatus {
  currentVersion: number;
  targetVersion: number;
  pendingMigrations: Array<{
    version: number;
    description: string;
  }>;
  appliedMigrations: number[];
}

export const DatabaseManagement: React.FC = () => {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [integrity, setIntegrity] = useState<DatabaseIntegrityResult | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<Record<string, MigrationStatus> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'integrity' | 'migrations'>('status');

  useEffect(() => {
    loadDatabaseStatus();
  }, []);

  const loadDatabaseStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await (window.flowDesk as any)?.invoke('database:get-status');
      if (result?.success) {
        setStatus(result.data);
      } else {
        setError(result?.error || 'Failed to load database status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load database status');
    } finally {
      setLoading(false);
    }
  };

  const checkIntegrity = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await (window.flowDesk as any)?.invoke('database:check-integrity');
      if (result?.success) {
        setIntegrity(result.data);
      } else {
        setError(result?.error || 'Failed to check database integrity');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check database integrity');
    } finally {
      setLoading(false);
    }
  };

  const loadMigrationStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await (window.flowDesk as any)?.invoke('database:get-migration-status');
      if (result?.success) {
        setMigrationStatus(result.data);
      } else {
        setError(result?.error || 'Failed to load migration status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load migration status');
    } finally {
      setLoading(false);
    }
  };

  const repairDatabases = async () => {
    if (!confirm('This will backup and repair all databases. Continue?')) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await (window.flowDesk as any)?.invoke('database:repair');
      if (result?.success) {
        alert('Database repair completed successfully!');
        await loadDatabaseStatus();
        await checkIntegrity();
      } else {
        setError(result?.error || 'Database repair failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Database repair failed');
    } finally {
      setLoading(false);
    }
  };

  const applyMigrations = async () => {
    if (!confirm('Apply pending database migrations?')) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await (window.flowDesk as any)?.invoke('database:apply-migrations');
      if (result?.success) {
        alert('Database migrations applied successfully!');
        await loadMigrationStatus();
      } else {
        setError(result?.error || 'Migration application failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration application failed');
    } finally {
      setLoading(false);
    }
  };

  const formatPath = (path: string) => {
    // Truncate long paths for display
    if (path.length > 60) {
      return '...' + path.slice(-57);
    }
    return path;
  };

  const StatusIcon: React.FC<{ status: boolean }> = ({ status }) => (
    <div className={`w-3 h-3 rounded-full ${status ? 'bg-green-500' : 'bg-red-500'}`} />
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Database Management
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(['status', 'integrity', 'migrations'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'integrity' && !integrity) {
                  checkIntegrity();
                } else if (tab === 'migrations' && !migrationStatus) {
                  loadMigrationStatus();
                }
              }}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Status Tab */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            {status ? (
              <>
                <div className="flex items-center space-x-3">
                  <StatusIcon status={status.initialized} />
                  <span className="text-gray-900 dark:text-white">
                    Database Status: {status.initialized ? 'Initialized' : 'Not Initialized'}
                  </span>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">Database Locations</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">User Data: </span>
                      <code className="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                        {formatPath(status.config.userDataPath)}
                      </code>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Mail DB: </span>
                      <code className="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                        {formatPath(status.config.mailDbPath)}
                      </code>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Calendar DB: </span>
                      <code className="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                        {formatPath(status.config.calendarDbPath)}
                      </code>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Search Index: </span>
                      <code className="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                        {formatPath(status.config.searchIndexPath)}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={loadDatabaseStatus}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Refreshing...' : 'Refresh Status'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300">Loading database status...</p>
              </div>
            )}
          </div>
        )}

        {/* Integrity Tab */}
        {activeTab === 'integrity' && (
          <div className="space-y-4">
            {integrity ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <StatusIcon status={integrity.mail.valid} />
                      <span className="font-medium text-gray-900 dark:text-white">Mail Database</span>
                    </div>
                    {!integrity.mail.valid && integrity.mail.error && (
                      <span className="text-red-600 dark:text-red-400 text-sm">{integrity.mail.error}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <StatusIcon status={integrity.calendar.valid} />
                      <span className="font-medium text-gray-900 dark:text-white">Calendar Database</span>
                    </div>
                    {!integrity.calendar.valid && integrity.calendar.error && (
                      <span className="text-red-600 dark:text-red-400 text-sm">{integrity.calendar.error}</span>
                    )}
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={checkIntegrity}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Checking...' : 'Check Integrity'}
                  </button>
                  
                  <button
                    onClick={repairDatabases}
                    disabled={loading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Repairing...' : 'Repair Databases'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300">Checking database integrity...</p>
              </div>
            )}
          </div>
        )}

        {/* Migrations Tab */}
        {activeTab === 'migrations' && (
          <div className="space-y-4">
            {migrationStatus ? (
              <>
                {Object.entries(migrationStatus).map(([dbName, status]) => (
                  <div key={dbName} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3 capitalize">
                      {dbName} Database
                    </h3>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">Current Version:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{status.currentVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">Latest Version:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{status.targetVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">Pending Migrations:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{status.pendingMigrations.length}</span>
                      </div>
                    </div>

                    {status.pendingMigrations.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Pending:</h4>
                        <div className="space-y-1">
                          {status.pendingMigrations.map((migration) => (
                            <div key={migration.version} className="text-sm text-gray-600 dark:text-gray-300">
                              v{migration.version}: {migration.description}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={loadMigrationStatus}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Refreshing...' : 'Refresh Status'}
                  </button>
                  
                  {Object.values(migrationStatus).some(status => status.pendingMigrations.length > 0) && (
                    <button
                      onClick={applyMigrations}
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Applying...' : 'Apply Migrations'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300">Loading migration status...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseManagement;