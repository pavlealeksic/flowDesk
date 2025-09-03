/**
 * React hook for managing AI engine state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import aiClient, { 
  AIMessage, 
  CompletionRequest, 
  ProviderHealth,
  UsageStats 
} from './AIClient';

export interface UseAIState {
  isInitialized: boolean;
  isLoading: boolean;
  messages: AIMessage[];
  providers: ProviderHealth[];
  currentProvider: string;
  currentModel: string;
  usageStats?: UsageStats;
  error?: string;
}

export interface UseAIActions {
  initialize: () => Promise<void>;
  sendMessage: (content: string, options?: {
    temperature?: number;
    maxTokens?: number;
  }) => Promise<void>;
  sendStreamingMessage: (content: string, options?: {
    temperature?: number;
    maxTokens?: number;
  }) => Promise<void>;
  clearMessages: () => void;
  setCurrentProvider: (providerId: string) => void;
  setCurrentModel: (model: string) => void;
  storeApiKey: (provider: string, apiKey: string) => Promise<void>;
  deleteApiKey: (provider: string) => Promise<void>;
  testProvider: (provider: string) => Promise<boolean>;
  refreshProviders: () => Promise<void>;
  getUsageStats: () => Promise<void>;
}

export const useAI = (): UseAIState & UseAIActions => {
  const [state, setState] = useState<UseAIState>({
    isInitialized: false,
    isLoading: false,
    messages: [],
    providers: [],
    currentProvider: 'openai',
    currentModel: 'gpt-4',
  });

  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: undefined }));
      
      await aiClient.initialize();
      await refreshProviders();
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: true, 
        isLoading: false 
      }));
    } catch (error) {
      console.error('Failed to initialize AI:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: `Failed to initialize AI: ${error}` 
      }));
    }
  }, []);

  const refreshProviders = useCallback(async () => {
    try {
      const providers = await aiClient.getProviderHealth();
      
      setState(prev => ({ 
        ...prev, 
        providers,
        // Auto-select first healthy provider with API key
        currentProvider: providers.find(p => p.isHealthy && p.hasApiKey)?.provider || prev.currentProvider,
      }));

      // Auto-select first available model for current provider
      const currentProviderData = providers.find(p => p.provider === state.currentProvider);
      if (currentProviderData && currentProviderData.models.length > 0) {
        setState(prev => ({
          ...prev,
          currentModel: currentProviderData.models[0],
        }));
      }
    } catch (error) {
      console.error('Failed to refresh providers:', error);
    }
  }, [state.currentProvider]);

  const sendMessage = useCallback(async (
    content: string, 
    options?: { temperature?: number; maxTokens?: number }
  ) => {
    if (!state.isInitialized || state.isLoading) return;

    const userMessage = aiClient.createUserMessage(content);
    
    setState(prev => ({ 
      ...prev, 
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: undefined,
    }));

    try {
      const request: CompletionRequest = {
        model: state.currentModel,
        messages: [...state.messages, userMessage],
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      };

      const response = await aiClient.createCompletion(request);
      const assistantMessage = aiClient.createAssistantMessage(response.content);

      setState(prev => ({ 
        ...prev, 
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: `Failed to send message: ${error}`,
      }));
    }
  }, [state.isInitialized, state.isLoading, state.currentModel, state.messages]);

  const sendStreamingMessage = useCallback(async (
    content: string,
    options?: { temperature?: number; maxTokens?: number }
  ) => {
    if (!state.isInitialized || state.isLoading) return;

    const userMessage = aiClient.createUserMessage(content);
    let assistantMessage = aiClient.createAssistantMessage('');
    
    setState(prev => ({ 
      ...prev, 
      messages: [...prev.messages, userMessage, assistantMessage],
      isLoading: true,
      error: undefined,
    }));

    try {
      const request: CompletionRequest = {
        model: state.currentModel,
        messages: [...state.messages, userMessage],
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stream: true,
      };

      await aiClient.createStreamingCompletion(request, (chunk) => {
        setState(prev => {
          const newMessages = [...prev.messages];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content += chunk.content;
          }
          return { ...prev, messages: newMessages };
        });
      });

      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('Failed to send streaming message:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: `Failed to send streaming message: ${error}`,
      }));
    }
  }, [state.isInitialized, state.isLoading, state.currentModel, state.messages]);

  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, messages: [] }));
  }, []);

  const setCurrentProvider = useCallback((providerId: string) => {
    setState(prev => ({ 
      ...prev, 
      currentProvider: providerId,
      // Auto-select first model for new provider
      currentModel: prev.providers.find(p => p.provider === providerId)?.models[0] || prev.currentModel,
    }));
  }, []);

  const setCurrentModel = useCallback((model: string) => {
    setState(prev => ({ ...prev, currentModel: model }));
  }, []);

  const storeApiKey = useCallback(async (provider: string, apiKey: string) => {
    try {
      await aiClient.storeApiKey(provider, apiKey);
      await refreshProviders(); // Refresh to update hasApiKey status
    } catch (error) {
      throw error;
    }
  }, [refreshProviders]);

  const deleteApiKey = useCallback(async (provider: string) => {
    try {
      await aiClient.deleteApiKey(provider);
      await refreshProviders(); // Refresh to update hasApiKey status
    } catch (error) {
      throw error;
    }
  }, [refreshProviders]);

  const testProvider = useCallback(async (provider: string) => {
    try {
      const result = await aiClient.testProvider(provider);
      await refreshProviders(); // Refresh to update health status
      return result;
    } catch (error) {
      console.error(`Failed to test provider ${provider}:`, error);
      return false;
    }
  }, [refreshProviders]);

  const getUsageStats = useCallback(async () => {
    try {
      const usageStats = await aiClient.getUsageStats();
      setState(prev => ({ ...prev, usageStats }));
    } catch (error) {
      console.error('Failed to get usage stats:', error);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Refresh providers periodically
  useEffect(() => {
    if (!state.isInitialized) return;

    const interval = setInterval(() => {
      refreshProviders();
      getUsageStats();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [state.isInitialized, refreshProviders, getUsageStats]);

  return {
    ...state,
    initialize,
    sendMessage,
    sendStreamingMessage,
    clearMessages,
    setCurrentProvider,
    setCurrentModel,
    storeApiKey,
    deleteApiKey,
    testProvider,
    refreshProviders,
    getUsageStats,
  };
};

export default useAI;