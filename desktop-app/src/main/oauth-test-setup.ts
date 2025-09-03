/**
 * OAuth2 Test Setup and Validation
 * 
 * Comprehensive testing and validation tool for OAuth2 integration.
 * Helps developers verify that OAuth2 is properly configured and working.
 */

import log from 'electron-log';
import { oAuth2IntegrationManager } from './oauth-integration-manager';
import { oAuth2TokenManager } from './oauth-token-manager';
import { oAuth2ProviderConfig } from './providers/oauth-provider-config';
import { rustEngineIntegration } from '../lib/rust-integration/rust-engine-integration';

export interface OAuth2TestResult {
  provider: string;
  configured: boolean;
  tested: boolean;
  success: boolean;
  error?: string;
  details?: any;
}

export interface OAuth2SystemStatus {
  overall: 'healthy' | 'warning' | 'error';
  configuredProviders: number;
  totalProviders: number;
  providerResults: OAuth2TestResult[];
  recommendations: string[];
}

/**
 * OAuth2 Test and Setup Manager
 */
export class OAuth2TestSetup {
  
  /**
   * Run comprehensive OAuth2 system test
   */
  async runSystemTest(): Promise<OAuth2SystemStatus> {
    log.info('Running OAuth2 system test...');

    const allProviders = oAuth2ProviderConfig.getAllProviders();
    const providerResults: OAuth2TestResult[] = [];
    let configuredCount = 0;
    const recommendations: string[] = [];

    // Test each provider
    for (const provider of allProviders) {
      const result = await this.testProvider(provider.providerId);
      providerResults.push(result);
      
      if (result.configured) configuredCount++;
    }

    // Generate recommendations
    if (configuredCount === 0) {
      recommendations.push('No OAuth2 providers are configured. Set up at least Gmail or Outlook for basic functionality.');
    }

    if (!oAuth2ProviderConfig.isProviderConfigured('gmail')) {
      recommendations.push('Configure Gmail OAuth2 for the most common email provider support.');
    }

    if (!oAuth2ProviderConfig.isProviderConfigured('outlook')) {
      recommendations.push('Configure Outlook OAuth2 for Microsoft 365 and Outlook.com support.');
    }

    // Check environment variables
    const missingVars = this.checkEnvironmentVariables();
    if (missingVars.length > 0) {
      recommendations.push(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    // Determine overall status
    let overall: 'healthy' | 'warning' | 'error' = 'healthy';
    if (configuredCount === 0) {
      overall = 'error';
    } else if (recommendations.length > 0) {
      overall = 'warning';
    }

    const status: OAuth2SystemStatus = {
      overall,
      configuredProviders: configuredCount,
      totalProviders: allProviders.length,
      providerResults,
      recommendations
    };

    log.info('OAuth2 system test completed', {
      overall: status.overall,
      configured: configuredCount,
      total: allProviders.length
    });

    return status;
  }

  /**
   * Test individual OAuth2 provider
   */
  async testProvider(providerId: string): Promise<OAuth2TestResult> {
    const result: OAuth2TestResult = {
      provider: providerId,
      configured: false,
      tested: false,
      success: false
    };

    try {
      // Check if provider is configured
      result.configured = oAuth2ProviderConfig.isProviderConfigured(providerId);
      
      if (!result.configured) {
        const setup = oAuth2ProviderConfig.getSetupInstructions(providerId);
        result.error = `Provider not configured. Check setup instructions.`;
        result.details = { setupInstructions: setup?.instructions };
        return result;
      }

      // Validate configuration
      const validation = oAuth2ProviderConfig.validateProviderConfig(providerId);
      if (!validation.valid) {
        result.error = `Configuration invalid: ${validation.errors.join(', ')}`;
        result.details = { validationErrors: validation.errors };
        return result;
      }

      // Test configuration by generating auth URL
      result.tested = true;
      const config = oAuth2ProviderConfig.getProviderConfig(providerId);
      if (config) {
        const testState = `test_${Date.now()}`;
        const authUrl = oAuth2ProviderConfig.generateAuthorizationUrl(providerId, testState);
        
        if (authUrl && authUrl.startsWith('https://')) {
          result.success = true;
          result.details = {
            authUrlGenerated: true,
            authUrl: authUrl.substring(0, 100) + '...',
            clientIdConfigured: !!config.clientId,
            clientSecretConfigured: !!config.clientSecret
          };
        } else {
          result.error = 'Failed to generate valid authorization URL';
        }
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.details = { exception: error };
    }

    return result;
  }

  /**
   * Check required environment variables
   */
  private checkEnvironmentVariables(): string[] {
    const requiredVars = [
      // Gmail
      ['GOOGLE_CLIENT_ID', 'GMAIL_CLIENT_ID'],
      ['GOOGLE_CLIENT_SECRET', 'GMAIL_CLIENT_SECRET'],
      
      // Outlook
      ['MICROSOFT_CLIENT_ID', 'OUTLOOK_CLIENT_ID'],
      ['MICROSOFT_CLIENT_SECRET', 'OUTLOOK_CLIENT_SECRET'],
    ];

    const missing: string[] = [];

    for (const varGroup of requiredVars) {
      const hasAny = varGroup.some(varName => process.env[varName]);
      if (!hasAny) {
        missing.push(varGroup[0]); // Report primary var name
      }
    }

    return missing;
  }

  /**
   * Generate OAuth2 setup report
   */
  async generateSetupReport(): Promise<string> {
    const status = await this.runSystemTest();
    const report = [];

    report.push('# OAuth2 Setup Report\n');
    report.push(`**Overall Status:** ${status.overall.toUpperCase()}\n`);
    report.push(`**Configured Providers:** ${status.configuredProviders}/${status.totalProviders}\n`);

    // Provider details
    report.push('## Provider Status\n');
    for (const result of status.providerResults) {
      report.push(`### ${result.provider}`);
      report.push(`- **Configured:** ${result.configured ? '✅' : '❌'}`);
      report.push(`- **Tested:** ${result.tested ? '✅' : '❌'}`);
      report.push(`- **Working:** ${result.success ? '✅' : '❌'}`);
      
      if (result.error) {
        report.push(`- **Error:** ${result.error}`);
      }
      
      if (result.details?.setupInstructions) {
        report.push('- **Setup Instructions:**');
        result.details.setupInstructions.forEach((instruction: string, index: number) => {
          report.push(`  ${index + 1}. ${instruction}`);
        });
      }
      report.push('');
    }

    // Recommendations
    if (status.recommendations.length > 0) {
      report.push('## Recommendations\n');
      status.recommendations.forEach((rec, index) => {
        report.push(`${index + 1}. ${rec}`);
      });
      report.push('');
    }

    // Environment variables
    report.push('## Required Environment Variables\n');
    report.push('Create a `.env` file in your project root with the following variables:\n');
    report.push('```env');
    report.push('# Gmail OAuth2');
    report.push('GOOGLE_CLIENT_ID=your_google_client_id_here');
    report.push('GOOGLE_CLIENT_SECRET=your_google_client_secret_here');
    report.push('');
    report.push('# Microsoft Outlook OAuth2');
    report.push('MICROSOFT_CLIENT_ID=your_microsoft_client_id_here');
    report.push('MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret_here');
    report.push('```\n');

    // Setup URLs
    report.push('## Setup URLs\n');
    const providers = oAuth2ProviderConfig.getAllProviders();
    for (const provider of providers) {
      const setup = oAuth2ProviderConfig.getSetupInstructions(provider.providerId);
      if (setup?.setupUrl) {
        report.push(`- **${provider.name}:** ${setup.setupUrl}`);
      }
    }

    return report.join('\n');
  }

  /**
   * Test OAuth2 token operations
   */
  async testTokenOperations(): Promise<{
    tokenStorage: boolean;
    tokenRefresh: boolean;
    tokenValidation: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let tokenStorage = false;
    let tokenRefresh = false;
    let tokenValidation = false;

    try {
      // Test token storage
      const testToken = {
        accountId: 'test-account',
        providerId: 'gmail',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        createdAt: new Date(),
        refreshCount: 0
      };

      await oAuth2TokenManager.storeToken(testToken);
      const retrieved = await oAuth2TokenManager.getValidToken('test-account', 'gmail');
      tokenStorage = !!retrieved;

      if (retrieved) {
        // Test token validation
        const validation = oAuth2TokenManager.validateToken(retrieved);
        tokenValidation = validation.valid;
      }

      // Cleanup test token
      await oAuth2TokenManager.revokeToken('test-account', 'gmail');

    } catch (error) {
      errors.push(`Token operations test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      tokenStorage,
      tokenRefresh,
      tokenValidation,
      errors
    };
  }

  /**
   * Test Rust engine integration
   */
  async testRustIntegration(): Promise<{
    initialized: boolean;
    oauthSupport: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let initialized = false;
    let oauthSupport = false;

    try {
      initialized = rustEngineIntegration.isInitialized();
      
      if (!initialized) {
        await rustEngineIntegration.initialize();
        initialized = rustEngineIntegration.isInitialized();
      }

      if (initialized) {
        // Test OAuth support
        try {
          await rustEngineIntegration.registerOAuthProvider('test-provider', 'test-client-id', 'test-client-secret');
          oauthSupport = true;
        } catch (error) {
          // OAuth support may not be fully implemented yet
          oauthSupport = false;
        }
      }
    } catch (error) {
      errors.push(`Rust integration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      initialized,
      oauthSupport,
      errors
    };
  }

  /**
   * Run all tests and generate comprehensive report
   */
  async runFullDiagnostic(): Promise<{
    systemStatus: OAuth2SystemStatus;
    tokenOperations: any;
    rustIntegration: any;
    overallHealth: 'healthy' | 'warning' | 'error';
  }> {
    log.info('Running full OAuth2 diagnostic...');

    const [systemStatus, tokenOperations, rustIntegration] = await Promise.all([
      this.runSystemTest(),
      this.testTokenOperations(),
      this.testRustIntegration()
    ]);

    // Determine overall health
    let overallHealth: 'healthy' | 'warning' | 'error' = 'healthy';
    
    if (systemStatus.overall === 'error' || 
        tokenOperations.errors.length > 0 || 
        rustIntegration.errors.length > 0) {
      overallHealth = 'error';
    } else if (systemStatus.overall === 'warning' || 
               !tokenOperations.tokenStorage || 
               !rustIntegration.initialized) {
      overallHealth = 'warning';
    }

    const result = {
      systemStatus,
      tokenOperations,
      rustIntegration,
      overallHealth
    };

    log.info('Full OAuth2 diagnostic completed', { overallHealth });
    return result;
  }
}

// Export singleton instance
export const oAuth2TestSetup = new OAuth2TestSetup();
export default oAuth2TestSetup;