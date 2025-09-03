/**
 * OAuth Callback Server
 * 
 * Simple HTTP server to handle OAuth callbacks from Gmail
 * Runs locally on port 8080 during authentication flow
 */

import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import log from 'electron-log';

interface OAuthCallbackData {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

type CallbackHandler = (data: OAuthCallbackData) => void;

export class OAuthCallbackServer {
  private server: Server | null = null;
  private port = 8080;
  private callbackHandler: CallbackHandler | null = null;

  constructor(port = 8080) {
    this.port = port;
  }

  /**
   * Start the OAuth callback server
   */
  start(callbackHandler: CallbackHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        reject(new Error('OAuth server is already running'));
        return;
      }

      this.callbackHandler = callbackHandler;

      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, 'localhost', () => {
        log.info(`OAuth callback server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        log.error('OAuth callback server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the OAuth callback server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        log.info('OAuth callback server stopped');
        this.server = null;
        this.callbackHandler = null;
        resolve();
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || '', `http://localhost:${this.port}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === '/oauth/callback') {
      this.handleOAuthCallback(url, res);
    } else if (url.pathname === '/health') {
      this.handleHealthCheck(res);
    } else {
      this.handle404(res);
    }
  }

  /**
   * Handle OAuth callback
   */
  private handleOAuthCallback(url: URL, res: ServerResponse): void {
    try {
      const callbackData: OAuthCallbackData = {
        code: url.searchParams.get('code') || undefined,
        state: url.searchParams.get('state') || undefined,
        error: url.searchParams.get('error') || undefined,
        error_description: url.searchParams.get('error_description') || undefined,
      };

      // Enhanced validation
      if (callbackData.error) {
        log.error('OAuth error received:', {
          error: callbackData.error,
          description: callbackData.error_description
        });
        this.sendErrorPage(res, callbackData.error, callbackData.error_description);
      } else if (callbackData.code && callbackData.state) {
        // Validate that we have both required parameters
        log.info('OAuth authorization code received:', {
          codeLength: callbackData.code.length,
          state: callbackData.state,
          hasState: !!callbackData.state
        });
        this.sendSuccessPage(res);
      } else {
        const missingParams = [];
        if (!callbackData.code) missingParams.push('code');
        if (!callbackData.state) missingParams.push('state');
        
        log.warn('OAuth callback missing required parameters:', missingParams);
        this.sendErrorPage(res, 'invalid_request', `Missing required parameters: ${missingParams.join(', ')}`);
      }

      // Notify the callback handler with enhanced data
      if (this.callbackHandler) {
        // Use setTimeout to ensure response is sent first
        setTimeout(() => {
          this.callbackHandler!(callbackData);
        }, 100);
      }

      log.info('OAuth callback processed:', { 
        hasCode: !!callbackData.code, 
        hasState: !!callbackData.state,
        error: callbackData.error 
      });
    } catch (error) {
      log.error('Error handling OAuth callback:', error);
      this.sendErrorPage(res, 'server_error', 'Internal server error processing callback');
    }
  }

  /**
   * Handle health check
   */
  private handleHealthCheck(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }

  /**
   * Handle 404
   */
  private handle404(res: ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Flow Desk - Page Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .container { max-width: 600px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Page Not Found</h1>
            <p>The requested page was not found on this server.</p>
            <p>This is the Flow Desk OAuth callback server.</p>
          </div>
        </body>
      </html>
    `);
  }

  /**
   * Send success page after successful OAuth
   */
  private sendSuccessPage(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Flow Desk - Authorization Successful</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background-color: #f0f8ff;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: white; 
              padding: 40px; 
              border-radius: 10px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .success { color: #28a745; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1 class="success">Authorization Successful!</h1>
            <p>Your Gmail account has been successfully connected to Flow Desk.</p>
            <p>You can now close this window and return to Flow Desk.</p>
            <script>
              // Auto-close window after 3 seconds
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </div>
        </body>
      </html>
    `);
  }

  /**
   * Send error page when OAuth fails
   */
  private sendErrorPage(res: ServerResponse, error: string, description?: string): void {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Flow Desk - Authorization Failed</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background-color: #fff5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: white; 
              padding: 40px; 
              border-radius: 10px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .error { color: #dc3545; }
            .icon { font-size: 48px; margin-bottom: 20px; }
            .details { 
              background: #f8f9fa; 
              padding: 15px; 
              border-radius: 5px; 
              margin-top: 20px; 
              text-align: left; 
              font-family: monospace; 
              font-size: 14px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1 class="error">Authorization Failed</h1>
            <p>There was an error connecting your Gmail account to Flow Desk.</p>
            ${description ? `<p><strong>Error:</strong> ${description}</p>` : ''}
            <div class="details">
              <strong>Error Code:</strong> ${error}<br>
              ${description ? `<strong>Description:</strong> ${description}<br>` : ''}
              <strong>Time:</strong> ${new Date().toISOString()}
            </div>
            <p>Please try again or contact support if the problem persists.</p>
            <script>
              // Auto-close window after 10 seconds
              setTimeout(() => {
                window.close();
              }, 10000);
            </script>
          </div>
        </body>
      </html>
    `);
  }

  /**
   * Get the callback URL for OAuth providers
   */
  getCallbackUrl(): string {
    return `http://localhost:${this.port}/oauth/callback`;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }
}