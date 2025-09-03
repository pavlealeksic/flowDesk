import React, { useState } from 'react';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/utils';

interface TestPanelProps {
  recipe: any;
  onTest: () => Promise<void>;
}

export function TestPanel({ recipe, onTest }: TestPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!recipe) {
      setTestError('No automation to test');
      return;
    }

    try {
      setIsRunning(true);
      setTestError(null);
      setTestResults([]);
      
      await onTest();
      
      // Mock test results for now
      setTestResults([
        {
          id: '1',
          step: 'Trigger',
          status: 'success',
          message: 'Trigger activated successfully',
          timestamp: new Date()
        },
        {
          id: '2',
          step: 'Action 1',
          status: 'success',
          message: 'Email sent successfully',
          timestamp: new Date()
        }
      ]);
      
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'running': return '🔄';
      default: return '⏸️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'running': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="test-panel p-4 space-y-4">
      <div className="panel-header">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Test Automation</h3>
        <p className="text-xs text-gray-500 mb-4">
          Run a test to validate your automation workflow
        </p>
      </div>

      <div className="test-controls">
        <Button 
          onClick={handleTest} 
          disabled={isRunning || !recipe}
          loading={isRunning}
          className="w-full"
        >
          {isRunning ? 'Running Test...' : 'Run Test'}
        </Button>
        
        {!recipe && (
          <p className="text-xs text-yellow-600 mt-2">
            Save your automation before testing
          </p>
        )}
      </div>

      {testError && (
        <div className={cn(
          "test-error p-3 rounded-lg border",
          "text-red-600 bg-red-50 border-red-200"
        )}>
          <div className="flex items-start gap-2">
            <span className="text-sm">❌</span>
            <div className="flex-1">
              <div className="font-medium text-sm">Test Failed</div>
              <div className="text-xs mt-1">{testError}</div>
            </div>
          </div>
        </div>
      )}

      {testResults.length > 0 && (
        <div className="test-results space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Test Results</h4>
          
          <div className="results-list space-y-2">
            {testResults.map((result) => (
              <div
                key={result.id}
                className={cn(
                  "result-item p-3 rounded-lg border",
                  getStatusColor(result.status)
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm" aria-hidden="true">
                    {getStatusIcon(result.status)}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{result.step}</div>
                      <div className="text-xs opacity-75">
                        {result.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-xs mt-1">{result.message}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="test-summary p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-900">Summary</div>
            <div className="text-xs text-gray-600 mt-1">
              {testResults.filter(r => r.status === 'success').length} successful, {' '}
              {testResults.filter(r => r.status === 'error').length} failed, {' '}
              {testResults.filter(r => r.status === 'warning').length} warnings
            </div>
          </div>
        </div>
      )}

      {!isRunning && testResults.length === 0 && !testError && (
        <div className="test-placeholder text-center py-8">
          <div className="text-4xl mb-2">🧪</div>
          <p className="text-sm text-gray-500">No test results yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Run Test" to validate your automation
          </p>
        </div>
      )}
    </div>
  );
}