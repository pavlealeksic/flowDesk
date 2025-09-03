/**
 * Environment variable type declarations for Flow Desk Desktop App
 */

declare global {
  const __DEV__: boolean;

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      
      // OAuth2 Configuration
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      GMAIL_CLIENT_ID?: string;
      GMAIL_CLIENT_SECRET?: string;
      
      MICROSOFT_CLIENT_ID?: string;
      MICROSOFT_CLIENT_SECRET?: string;
      OUTLOOK_CLIENT_ID?: string;
      OUTLOOK_CLIENT_SECRET?: string;
      
      YAHOO_CLIENT_ID?: string;
      YAHOO_CLIENT_SECRET?: string;
      
      // Database Configuration
      DATABASE_PATH?: string;
      MAIL_DATABASE_PATH?: string;
      CALENDAR_DATABASE_PATH?: string;
      SEARCH_INDEX_PATH?: string;
      
      // Application Configuration
      APP_DATA_PATH?: string;
      LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug';
      
      // Development Configuration
      VITE_DEV_SERVER_URL?: string;
      ELECTRON_DEV_TOOLS?: string;
      
      // Security Configuration
      ENCRYPTION_KEY?: string;
      SECRET_KEY?: string;
      
      // API Configuration
      API_BASE_URL?: string;
      API_TIMEOUT?: string;
    }
  }

  interface Window {
    flowDesk: import('./preload').FlowDeskAPI;
    searchAPI: import('./preload').FlowDeskAPI['searchAPI'];
    __DEV__: boolean;
  }
}

export {};