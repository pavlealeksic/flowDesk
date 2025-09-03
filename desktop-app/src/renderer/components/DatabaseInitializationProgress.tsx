/**
 * Database Initialization Progress Component
 * 
 * Shows initialization progress and handles first-run database setup
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InitializationProgress {
  stage: 'setup' | 'directories' | 'mail' | 'calendar' | 'search' | 'migrations' | 'validation' | 'complete';
  progress: number;
  message: string;
  details?: string;
}

interface DatabaseInitializationProgressProps {
  show: boolean;
  onComplete: () => void;
}

const STAGE_LABELS: Record<InitializationProgress['stage'], string> = {
  setup: 'Setting up database system...',
  directories: 'Creating data directories...',
  mail: 'Initializing mail database...',
  calendar: 'Initializing calendar database...',
  search: 'Setting up search index...',
  migrations: 'Running database migrations...',
  validation: 'Validating database integrity...',
  complete: 'Database initialization complete!'
};

const STAGE_ICONS: Record<InitializationProgress['stage'], string> = {
  setup: '⚙️',
  directories: '📁',
  mail: '📧',
  calendar: '📅',
  search: '🔍',
  migrations: '🔄',
  validation: '✅',
  complete: '🎉'
};

export const DatabaseInitializationProgress: React.FC<DatabaseInitializationProgressProps> = ({
  show,
  onComplete
}) => {
  const [progress, setProgress] = useState<InitializationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!show) return;

    // Listen for progress updates from main process
    const handleProgress = (event: any, progressData: InitializationProgress) => {
      setProgress(progressData);
      
      if (progressData.stage === 'complete') {
        setIsComplete(true);
        
        // Auto-hide after 2 seconds
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    };

    // Listen for completion events
    const handleComplete = (event: any, result: { success: boolean; error?: string; config?: any }) => {
      if (result.success) {
        setProgress({
          stage: 'complete',
          progress: 100,
          message: 'All databases initialized successfully!'
        });
        setIsComplete(true);
        
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        setError(result.error || 'Database initialization failed');
        setProgress(null);
      }
    };

    // Register event listeners
    window.electronAPI?.on('database-initialization-progress', handleProgress);
    window.electronAPI?.on('database-initialization-complete', handleComplete);

    return () => {
      // Clean up listeners
      window.electronAPI?.off('database-initialization-progress', handleProgress);
      window.electronAPI?.off('database-initialization-complete', handleComplete);
    };
  }, [show, onComplete]);

  const retryInitialization = async () => {
    setError(null);
    setProgress({ stage: 'setup', progress: 0, message: 'Retrying database initialization...' });
    
    try {
      const result = await window.electronAPI?.invoke('database:initialize');
      if (!result?.success) {
        setError(result?.error || 'Retry failed');
        setProgress(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
      setProgress(null);
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl"
        >
          {error ? (
            // Error state
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Database Initialization Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {error}
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={retryInitialization}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={onComplete}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          ) : (
            // Progress state
            <div className="text-center">
              <div className="text-6xl mb-4">
                {progress ? STAGE_ICONS[progress.stage] : '⚙️'}
              </div>
              
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {isComplete ? 'Setup Complete!' : 'Setting up Flow Desk'}
              </h2>
              
              {progress && (
                <>
                  <div className="mb-4">
                    <p className="text-gray-700 dark:text-gray-300 mb-2">
                      {STAGE_LABELS[progress.stage]}
                    </p>
                    {progress.details && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {progress.details}
                      </p>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <motion.div
                        className="bg-blue-600 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.progress}%` }}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {progress.progress}%
                    </p>
                  </div>
                </>
              )}
              
              {!isComplete && (
                <div className="flex justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"
                  />
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DatabaseInitializationProgress;