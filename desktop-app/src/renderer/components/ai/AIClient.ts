/**
 * TypeScript API client for Flow Desk AI Engine
 * Provides a clean interface to interact with the Rust AI engine via NAPI bindings
 */

// Use a logging stub for renderer process - actual logging should be done in main process
const log = {
  debug: () => {}, // No-op in production
  info: () => {},  // No-op in production
  warn: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      log.warn(...args);
    }
  },
  error: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      log.error(...args);
    }
  }
};

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool';
  content: string;
  timestamp: Date;
  name?: string;
}

export interface CompletionRequest {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface CompletionResponse {
  id: string;
  model: string;
  content: string;
  finishReason?: string;
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIModel {
  id: string;
  ownedBy: string;
  maxTokens?: number;
  inputCostPerToken?: number;
  outputCostPerToken?: number;
}

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensUsed: number;
  totalCost: number;
  averageResponseTimeMs: number;
}

export interface RateLimitInfo {
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: string;
  retryAfterSeconds?: number;
}

export interface ProviderHealth {
  provider: string;
  isHealthy: boolean;
  hasApiKey: boolean;
  models: string[];
  usage?: UsageStats;
  rateLimits?: RateLimitInfo;
}

export type StreamingCallback = (response: CompletionResponse) => void;

class AIClient {
  private aiEngine: any;
  private isInitialized = false;

  constructor() {
    // AI engine will be initialized lazily
  }

  /**
   * Initialize the AI engine
   */
  async initialize(cacheDir?: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if we're in an Electron renderer process
      if (typeof window !== 'undefined' && (window as any).flowDesk) {
        // Use IPC to communicate with the main process for AI operations
        this.aiEngine = {
          initialize: async () => {
            try {
              return await (window as any).flowDesk.ai?.initialize(cacheDir || this.getDefaultCacheDir());
            } catch (error) {
              log.warn('AI engine initialization via IPC failed, using fallback');
              return Promise.resolve();
            }
          },
          storeApiKey: async (provider: string, apiKey: string) => {
            try {
              return await (window as any).flowDesk.ai?.storeApiKey(provider, apiKey);
            } catch (error) {
              log.warn(`Failed to store API key for ${provider} via IPC:`, error);
              return Promise.resolve();
            }
          },
          hasApiKey: async (provider: string) => {
            try {
              return await (window as any).flowDesk.ai?.hasApiKey(provider) || false;
            } catch (error) {
              log.warn(`Failed to check API key for ${provider} via IPC:`, error);
              return false;
            }
          },
          deleteApiKey: async (provider: string) => {
            try {
              return await (window as any).flowDesk.ai?.deleteApiKey(provider) || true;
            } catch (error) {
              log.warn(`Failed to delete API key for ${provider} via IPC:`, error);
              return true;
            }
          },
          createCompletion: async (request: any) => {
            try {
              return await (window as any).flowDesk.ai?.createCompletion(request);
            } catch (error) {
              log.warn('AI completion via IPC failed, using mock response');
              return {
                id: 'mock_completion_' + Date.now(),
                model: request.model,
                content: 'AI service temporarily unavailable. Please check your configuration.',
                finishReason: 'stop',
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
              };
            }
          },
          createStreamingCompletion: async (request: any, callback: any) => {
            try {
              return await (window as any).flowDesk.ai?.createStreamingCompletion(request, callback);
            } catch (error) {
              log.warn('AI streaming completion via IPC failed, using mock response');
              callback({
                id: 'mock_stream_' + Date.now(),
                model: request.model,
                content: 'AI service temporarily unavailable. Please check your configuration.',
                finishReason: 'stop'
              });
            }
          },
          getAvailableModels: async () => {
            try {
              return await (window as any).flowDesk.ai?.getAvailableModels() || [];
            } catch (error) {
              log.warn('Failed to get available models via IPC:', error);
              return [];
            }
          },
          healthCheck: async () => {
            try {
              return await (window as any).flowDesk.ai?.healthCheck() || false;
            } catch (error) {
              log.warn('AI health check via IPC failed:', error);
              return false;
            }
          },
          getUsageStats: async () => {
            try {
              return await (window as any).flowDesk.ai?.getUsageStats() || {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                totalTokensUsed: 0,
                totalCost: 0,
                averageResponseTimeMs: 0
              };
            } catch (error) {
              log.warn('Failed to get usage stats via IPC:', error);
              return {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                totalTokensUsed: 0,
                totalCost: 0,
                averageResponseTimeMs: 0
              };
            }
          },
          getRateLimitInfo: async (provider: string) => {
            try {
              return await (window as any).flowDesk.ai?.getRateLimitInfo(provider) || null;
            } catch (error) {
              log.warn(`Failed to get rate limit info for ${provider} via IPC:`, error);
              return null;
            }
          },
          clearCache: async (operationType?: string) => {
            try {
              return await (window as any).flowDesk.ai?.clearCache(operationType);
            } catch (error) {
              log.warn('Failed to clear cache via IPC:', error);
              return Promise.resolve();
            }
          },
          getCacheStats: async () => {
            try {
              return await (window as any).flowDesk.ai?.getCacheStats() || {};
            } catch (error) {
              log.warn('Failed to get cache stats via IPC:', error);
              return {};
            }
          },
          testProvider: async (provider: string) => {
            try {
              return await (window as any).flowDesk.ai?.testProvider(provider) || false;
            } catch (error) {
              log.warn(`Provider test failed for ${provider} via IPC:`, error);
              return false;
            }
          }
        };
      } else {
        // Fallback mock implementation for non-Electron environments or testing
        log.warn('FlowDesk API not available, using mock AI implementation');
        this.aiEngine = {
          initialize: async () => Promise.resolve(),
          storeApiKey: async (provider: string, apiKey: string) => Promise.resolve(),
          hasApiKey: async (provider: string) => false,
          deleteApiKey: async (provider: string) => true,
          createCompletion: async (request: any) => ({
            id: 'mock_completion_' + Date.now(),
            model: request.model,
            content: 'Mock AI response - FlowDesk API not available',
            finishReason: 'stop',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
          }),
          createStreamingCompletion: async (request: any, callback: any) => {
            callback({
              id: 'mock_stream_' + Date.now(),
              model: request.model,
              content: 'Mock streaming response - FlowDesk API not available',
              finishReason: 'stop'
            });
          },
          getAvailableModels: async () => [],
          healthCheck: async () => false,
          getUsageStats: async () => ({
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokensUsed: 0,
            totalCost: 0,
            averageResponseTimeMs: 0
          }),
          getRateLimitInfo: async (provider: string) => null,
          clearCache: async (operationType?: string) => Promise.resolve(),
          getCacheStats: async () => ({}),
          testProvider: async (provider: string) => false
        };
      }

      await this.aiEngine.initialize();
      this.isInitialized = true;
    } catch (error) {
      log.error('Failed to initialize AI engine:', error);
      throw new Error(`AI engine initialization failed: ${error}`);
    }
  }

  /**
   * Ensure the AI engine is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Store an API key for a provider
   */
  async storeApiKey(provider: string, apiKey: string): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await this.aiEngine.storeApiKey(provider, apiKey);
    } catch (error) {
      throw new Error(`Failed to store API key for ${provider}: ${error}`);
    }
  }

  /**
   * Check if an API key exists for a provider
   */
  async hasApiKey(provider: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      return await this.aiEngine.hasApiKey(provider);
    } catch (error) {
      log.error(`Failed to check API key for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Delete an API key for a provider
   */
  async deleteApiKey(provider: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      return await this.aiEngine.deleteApiKey(provider);
    } catch (error) {
      throw new Error(`Failed to delete API key for ${provider}: ${error}`);
    }
  }

  /**
   * Create a completion
   */
  async createCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    await this.ensureInitialized();
    
    try {
      const napiRequest = {
        model: request.model,
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          name: msg.name,
          timestamp: msg.timestamp.toISOString(),
        })),
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        topP: request.topP,
        stream: false, // Non-streaming for this method
      };

      const response = await this.aiEngine.createCompletion(napiRequest);
      
      return {
        id: response.id,
        model: response.model,
        content: response.content,
        finishReason: response.finishReason,
        usage: response.usage ? {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
        } : undefined,
      };
    } catch (error) {
      throw new Error(`Completion request failed: ${error}`);
    }
  }

  /**
   * Create a streaming completion
   */
  async createStreamingCompletion(
    request: CompletionRequest,
    onChunk: StreamingCallback,
  ): Promise<void> {
    await this.ensureInitialized();
    
    try {
      const napiRequest = {
        model: request.model,
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          name: msg.name,
          timestamp: msg.timestamp.toISOString(),
        })),
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        topP: request.topP,
        stream: true,
      };

      await this.aiEngine.createStreamingCompletion(napiRequest, (response: any) => {
        onChunk({
          id: response.id,
          model: response.model,
          content: response.content,
          finishReason: response.finishReason,
          usage: response.usage ? {
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
            totalTokens: response.usage.totalTokens,
          } : undefined,
        });
      });
    } catch (error) {
      throw new Error(`Streaming completion request failed: ${error}`);
    }
  }

  /**
   * Get available models from all providers
   */
  async getAvailableModels(): Promise<AIModel[]> {
    await this.ensureInitialized();
    
    try {
      const models = await this.aiEngine.getAvailableModels();
      return models.map((model: any) => ({
        id: model.id,
        ownedBy: model.ownedBy,
        maxTokens: model.maxTokens,
        inputCostPerToken: model.inputCostPerToken,
        outputCostPerToken: model.outputCostPerToken,
      }));
    } catch (error) {
      log.error('Failed to get available models:', error);
      return [];
    }
  }

  /**
   * Perform health check on all providers
   */
  async healthCheck(): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      return await this.aiEngine.healthCheck();
    } catch (error) {
      log.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<UsageStats> {
    await this.ensureInitialized();
    
    try {
      const stats = await this.aiEngine.getUsageStats();
      return {
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        totalTokensUsed: stats.totalTokensUsed,
        totalCost: stats.totalCost,
        averageResponseTimeMs: stats.averageResponseTimeMs,
      };
    } catch (error) {
      log.error('Failed to get usage stats:', error);
      throw new Error(`Failed to get usage stats: ${error}`);
    }
  }

  /**
   * Get rate limit information for a provider
   */
  async getRateLimitInfo(provider: string): Promise<RateLimitInfo | null> {
    await this.ensureInitialized();
    
    try {
      const info = await this.aiEngine.getRateLimitInfo(provider);
      if (!info) return null;
      
      return {
        requestsRemaining: info.requestsRemaining,
        tokensRemaining: info.tokensRemaining,
        resetTime: info.resetTime,
        retryAfterSeconds: info.retryAfterSeconds,
      };
    } catch (error) {
      log.error(`Failed to get rate limit info for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  async clearCache(operationType?: string): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await this.aiEngine.clearCache(operationType);
    } catch (error) {
      throw new Error(`Failed to clear cache: ${error}`);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<Record<string, any>> {
    await this.ensureInitialized();
    
    try {
      const stats = await this.aiEngine.getCacheStats();
      // Parse JSON strings back to objects if needed
      const parsedStats: Record<string, any> = {};
      for (const [key, value] of Object.entries(stats)) {
        try {
          parsedStats[key] = typeof value === 'string' ? JSON.parse(value as string) : value;
        } catch {
          parsedStats[key] = value;
        }
      }
      return parsedStats;
    } catch (error) {
      log.error('Failed to get cache stats:', error);
      return {};
    }
  }

  /**
   * Test a specific provider
   */
  async testProvider(provider: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      return await this.aiEngine.testProvider(provider);
    } catch (error) {
      log.error(`Provider test failed for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get comprehensive provider health information
   */
  async getProviderHealth(): Promise<ProviderHealth[]> {
    await this.ensureInitialized();
    
    const providers = ['openai', 'deepseek'];
    const healthData: ProviderHealth[] = [];

    for (const provider of providers) {
      try {
        const [isHealthy, hasApiKey, models, rateLimits] = await Promise.all([
          this.testProvider(provider).catch(() => false),
          this.hasApiKey(provider).catch(() => false),
          this.getAvailableModels().catch(() => []),
          this.getRateLimitInfo(provider).catch(() => null),
        ]);

        let usage: UsageStats | undefined;
        try {
          usage = await this.getUsageStats();
        } catch {
          // Usage stats might not be available for individual providers
        }

        healthData.push({
          provider,
          isHealthy,
          hasApiKey,
          models: models.map(m => m.id),
          usage,
          rateLimits: rateLimits || undefined,
        });
      } catch (error) {
        log.error(`Failed to get health info for ${provider}:`, error);
        healthData.push({
          provider,
          isHealthy: false,
          hasApiKey: false,
          models: [],
        });
      }
    }

    return healthData;
  }

  /**
   * Generate a unique message ID
   */
  generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a user message
   */
  createUserMessage(content: string, name?: string): AIMessage {
    return {
      id: this.generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date(),
      name,
    };
  }

  /**
   * Create an assistant message
   */
  createAssistantMessage(content: string): AIMessage {
    return {
      id: this.generateMessageId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
    };
  }

  /**
   * Get default cache directory
   */
  private getDefaultCacheDir(): string {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return (window as any).electronAPI.path.join((window as any).electronAPI.getPath('userData'), 'ai_cache');
    }
    return './ai_cache';
  }
}

// Export a singleton instance
export const aiClient = new AIClient();
export default aiClient;