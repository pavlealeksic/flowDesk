import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Key, 
  Eye, 
  EyeOff, 
  Save, 
  Trash2, 
  TestTube, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useLogger } from '../../logging/RendererLoggingService';

export interface AIProviderConfig {
  id: string;
  name: string;
  apiKey?: string;
  isHealthy: boolean;
  hasApiKey: boolean;
  models: string[];
  usage?: {
    totalRequests: number;
    successfulRequests: number;
    totalCost: number;
    totalTokensUsed: number;
  };
  rateLimits?: {
    requestsRemaining: number;
    tokensRemaining: number;
    resetTime?: string;
  };
}

interface AISettingsPanelProps {
  providers: AIProviderConfig[];
  onSaveApiKey: (providerId: string, apiKey: string) => Promise<void>;
  onDeleteApiKey: (providerId: string) => Promise<void>;
  onTestProvider: (providerId: string) => Promise<boolean>;
  onRefreshProviders: () => Promise<void>;
  isLoading: boolean;
}

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({
  providers,
  onSaveApiKey,
  onDeleteApiKey,
  onTestProvider,
  onRefreshProviders,
  isLoading,
}) => {
  const logger = useLogger('AI-Settings');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testingProviders, setTestingProviders] = useState<Set<string>>(new Set());
  const [savingProviders, setSavingProviders] = useState<Set<string>>(new Set());

  const handleApiKeyChange = (providerId: string, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [providerId]: value
    }));
  };

  const toggleKeyVisibility = (providerId: string) => {
    setShowKeys(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const handleSaveKey = async (providerId: string) => {
    const apiKey = apiKeys[providerId];
    if (!apiKey?.trim()) return;

    setSavingProviders(prev => new Set(prev.add(providerId)));
    
    try {
      await onSaveApiKey(providerId, apiKey.trim());
      // Clear the input after successful save
      setApiKeys(prev => ({
        ...prev,
        [providerId]: ''
      }));
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to save API key:', error], method: 'console.error' });
    } finally {
      setSavingProviders(prev => {
        const newSet = new Set(prev);
        newSet.delete(providerId);
        return newSet;
      });
    }
  };

  const handleDeleteKey = async (providerId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    try {
      await onDeleteApiKey(providerId);
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to delete API key:', error], method: 'console.error' });
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setTestingProviders(prev => new Set(prev.add(providerId)));
    
    try {
      const isHealthy = await onTestProvider(providerId);
      logger.debug('Console log', undefined, { originalArgs: [`Provider ${providerId} test result:`, isHealthy], method: 'console.log' });
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Failed to test provider:', error], method: 'console.error' });
    } finally {
      setTestingProviders(prev => {
        const newSet = new Set(prev);
        newSet.delete(providerId);
        return newSet;
      });
    }
  };

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(cost);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          <h2 className="text-xl font-semibold">AI Settings</h2>
        </div>
        <Button
          onClick={onRefreshProviders}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Activity className="w-4 h-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Provider configurations */}
      <div className="grid gap-6">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {provider.name}
                  {provider.hasApiKey ? (
                    provider.isHealthy ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Healthy
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Unhealthy
                      </Badge>
                    )
                  ) : (
                    <Badge variant="outline">
                      <Key className="w-3 h-3 mr-1" />
                      No API Key
                    </Badge>
                  )}
                </CardTitle>
                
                <div className="flex items-center gap-2">
                  {provider.hasApiKey && (
                    <Button
                      onClick={() => handleTestProvider(provider.id)}
                      disabled={testingProviders.has(provider.id)}
                      variant="outline"
                      size="sm"
                    >
                      {testingProviders.has(provider.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                      Test
                    </Button>
                  )}
                  
                  {provider.hasApiKey && (
                    <Button
                      onClick={() => handleDeleteKey(provider.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* API Key section */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  API Key
                </label>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys[provider.id] ? 'text' : 'password'}
                      value={apiKeys[provider.id] || ''}
                      onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                      placeholder={provider.hasApiKey ? 'API key configured (enter new to replace)' : 'Enter API key'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleKeyVisibility(provider.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKeys[provider.id] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  <Button
                    onClick={() => handleSaveKey(provider.id)}
                    disabled={!apiKeys[provider.id]?.trim() || savingProviders.has(provider.id)}
                    size="sm"
                  >
                    {savingProviders.has(provider.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save
                  </Button>
                </div>
              </div>

              {/* Models */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Available Models</label>
                <div className="flex flex-wrap gap-1">
                  {provider.models.length > 0 ? (
                    provider.models.map((model) => (
                      <Badge key={model} variant="outline" className="text-xs">
                        {model}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No models available</span>
                  )}
                </div>
              </div>

              {/* Usage Statistics */}
              {provider.usage && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Usage Statistics</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="text-gray-500">Total Requests</div>
                      <div className="font-medium">
                        {formatNumber(provider.usage.totalRequests)}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-gray-500">Success Rate</div>
                      <div className="font-medium">
                        {provider.usage.totalRequests > 0 
                          ? Math.round((provider.usage.successfulRequests / provider.usage.totalRequests) * 100)
                          : 0}%
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-gray-500">Total Tokens</div>
                      <div className="font-medium">
                        {formatNumber(provider.usage.totalTokensUsed)}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-gray-500">Total Cost</div>
                      <div className="font-medium">
                        {formatCost(provider.usage.totalCost)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rate Limits */}
              {provider.rateLimits && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rate Limits</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="text-gray-500">Requests Remaining</div>
                      <div className="font-medium">
                        {formatNumber(provider.rateLimits.requestsRemaining)}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-gray-500">Tokens Remaining</div>
                      <div className="font-medium">
                        {formatNumber(provider.rateLimits.tokensRemaining)}
                      </div>
                    </div>
                    
                    {provider.rateLimits.resetTime && (
                      <div className="space-y-1 md:col-span-2">
                        <div className="text-gray-500">Reset Time</div>
                        <div className="font-medium">
                          {new Date(provider.rateLimits.resetTime).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {providers.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No AI providers available</p>
            <p className="text-sm mt-1">Check your configuration and try refreshing</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AISettingsPanel;