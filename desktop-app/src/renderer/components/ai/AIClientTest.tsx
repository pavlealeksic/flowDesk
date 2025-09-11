/**
 * AI Client Test Component
 * Tests the AI Client integration with proper error handling
 */

import React, { useState, useEffect } from 'react';
import { aiClient } from './AIClient';
import type { ProviderHealth, CompletionRequest } from './AIClient';
import { useLogger } from '../../logging/RendererLoggingService';

interface AIClientTestProps {
  className?: string;
}

export const AIClientTest: React.FC<AIClientTestProps> = ({ className }) => {
  const logger = useLogger('AI-Client-Test');
  const [isInitialized, setIsInitialized] = useState(false);
  const [healthData, setHealthData] = useState<ProviderHealth[]>([]);
  const [testResponse, setTestResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    initializeAI();
  }, []);

  const initializeAI = async () => {
    try {
      setLoading(true);
      await aiClient.initialize();
      setIsInitialized(true);
      
      // Get provider health information
      const health = await aiClient.getProviderHealth();
      setHealthData(health);
    } catch (err) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to initialize AI client:', err], method: 'console.error' });
      setError(err instanceof Error ? err.message : 'Initialization failed');
    } finally {
      setLoading(false);
    }
  };

  const testCompletion = async () => {
    try {
      setLoading(true);
      setError('');
      
      const request: CompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          aiClient.createUserMessage('Hello, this is a test message.')
        ],
        temperature: 0.7,
        maxTokens: 100
      };

      const response = await aiClient.createCompletion(request);
      setTestResponse(response.content);
    } catch (err) {
      logger.error('Console error', undefined, { originalArgs: ['Test completion failed:', err], method: 'console.error' });
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className || ''}`}>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        AI Client Test
      </h2>
      
      {/* Initialization Status */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isInitialized ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            AI Client {isInitialized ? 'Initialized' : 'Not Initialized'}
          </span>
        </div>
      </div>

      {/* Provider Health Status */}
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
          Provider Health
        </h3>
        {healthData.length > 0 ? (
          <div className="space-y-2">
            {healthData.map((provider) => (
              <div key={provider.provider} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${provider.isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {provider.provider}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>API Key: {provider.hasApiKey ? '✓' : '✗'}</span>
                  <span>Models: {provider.models.length}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No provider health data available
          </p>
        )}
      </div>

      {/* Test Completion */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
            Test Completion
          </h3>
          <button
            onClick={testCompletion}
            disabled={loading || !isInitialized}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                     disabled:cursor-not-allowed text-white text-sm font-medium rounded-md 
                     transition-colors duration-200"
          >
            {loading ? 'Testing...' : 'Run Test'}
          </button>
        </div>
        
        {testResponse && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 
                        dark:border-green-800 rounded">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Response:</strong> {testResponse}
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 
                      dark:border-red-800 rounded">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Processing...
          </span>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 
                    dark:border-blue-800 rounded">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          <strong>Note:</strong> The AI Client is now using Electron IPC for communication with 
          the main process. Import errors should be resolved, and the client will gracefully 
          fallback to mock responses when AI services are not fully configured.
        </p>
      </div>
    </div>
  );
};

export default AIClientTest;