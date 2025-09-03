/**
 * Complete AI Page Component
 * Integrates chat interface and settings with the AI engine
 */

import React, { useState } from 'react';
import { Bot, MessageSquare, Settings, X } from 'lucide-react';
import AIChatInterface from './AIChatInterface';
import AISettingsPanel from './AISettingsPanel';
import { useAI } from './useAI';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

const AIPage: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const ai = useAI();

  const handleSendMessage = async (message: string, options?: {
    temperature?: number;
    maxTokens?: number;
  }) => {
    // Use streaming for better UX
    await ai.sendStreamingMessage(message, options);
    
    // Return the last assistant message for the interface
    const lastMessage = ai.messages[ai.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      return lastMessage;
    }
    
    // Fallback - shouldn't happen with streaming
    return ai.aiClient?.createAssistantMessage('No response received');
  };

  const convertProvidersForChat = () => {
    return ai.providers.map(provider => ({
      id: provider.provider,
      name: provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1),
      models: provider.models,
      isHealthy: provider.isHealthy,
      hasApiKey: provider.hasApiKey,
    }));
  };

  const convertProvidersForSettings = () => {
    return ai.providers.map(provider => ({
      id: provider.provider,
      name: provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1),
      isHealthy: provider.isHealthy,
      hasApiKey: provider.hasApiKey,
      models: provider.models,
      usage: provider.usage ? {
        totalRequests: provider.usage.totalRequests,
        successfulRequests: provider.usage.successfulRequests,
        totalCost: provider.usage.totalCost,
        totalTokensUsed: provider.usage.totalTokensUsed,
      } : undefined,
      rateLimits: provider.rateLimits ? {
        requestsRemaining: provider.rateLimits.requestsRemaining,
        tokensRemaining: provider.rateLimits.tokensRemaining,
        resetTime: provider.rateLimits.resetTime,
      } : undefined,
    }));
  };

  if (!ai.isInitialized && ai.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8">
          <div className="text-center space-y-4">
            <Bot className="w-12 h-12 mx-auto animate-pulse text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold">Initializing AI Engine</h3>
              <p className="text-gray-600">Please wait while we set up the AI components...</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (ai.error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 max-w-md">
          <div className="text-center space-y-4">
            <Bot className="w-12 h-12 mx-auto text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-600">AI Engine Error</h3>
              <p className="text-gray-600 text-sm">{ai.error}</p>
            </div>
            <Button onClick={ai.initialize} variant="outline">
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {!showSettings ? (
        // Chat Interface
        <AIChatInterface
          providers={convertProvidersForChat()}
          currentProvider={ai.currentProvider}
          currentModel={ai.currentModel}
          onProviderChange={ai.setCurrentProvider}
          onModelChange={ai.setCurrentModel}
          onSendMessage={handleSendMessage}
          messages={ai.messages}
          isLoading={ai.isLoading}
          onSettingsOpen={() => setShowSettings(true)}
        />
      ) : (
        // Settings Panel
        <div className="h-full flex flex-col">
          <div className="flex-shrink-0 p-4 border-b">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                AI Settings
              </h1>
              <Button
                onClick={() => setShowSettings(false)}
                variant="outline"
                size="sm"
              >
                <X className="w-4 h-4 mr-1" />
                Back to Chat
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <AISettingsPanel
              providers={convertProvidersForSettings()}
              onSaveApiKey={ai.storeApiKey}
              onDeleteApiKey={ai.deleteApiKey}
              onTestProvider={ai.testProvider}
              onRefreshProviders={ai.refreshProviders}
              isLoading={ai.isLoading}
            />
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>
              Status: {ai.isInitialized ? 'Ready' : 'Initializing...'}
            </span>
            <span>
              Messages: {ai.messages.length}
            </span>
            {ai.usageStats && (
              <>
                <span>
                  Requests: {ai.usageStats.totalRequests}
                </span>
                <span>
                  Tokens: {ai.usageStats.totalTokensUsed.toLocaleString()}
                </span>
                <span>
                  Cost: ${ai.usageStats.totalCost.toFixed(4)}
                </span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {ai.providers.map(provider => (
                <div
                  key={provider.provider}
                  className={`w-2 h-2 rounded-full ${
                    provider.isHealthy && provider.hasApiKey
                      ? 'bg-green-500'
                      : provider.hasApiKey
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  title={`${provider.provider}: ${
                    provider.isHealthy && provider.hasApiKey
                      ? 'Healthy'
                      : provider.hasApiKey
                      ? 'Unhealthy'
                      : 'No API Key'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPage;