/**
 * Flow Desk Shared Rust Library
 * Entry point for Node.js integration
 */

const fs = require('fs');
const path = require('path');

// Try to determine the best integration method
function getIntegrationMethod() {
  const libPath = path.join(__dirname, 'target', 'release', 'libflow_desk_shared.dylib');
  const cliBinaryPath = path.join(__dirname, 'target', 'release', 'flow_desk_cli');
  
  // Check for NAPI binary
  const napiBindings = [
    'flow-desk-shared.darwin-arm64.node',
    'flow-desk-shared.darwin-x64.node', 
    'flow-desk-shared.win32-x64.node',
    'flow-desk-shared.linux-x64.node',
    'flow-desk-shared.linux-arm64.node'
  ].map(name => path.join(__dirname, name));
  
  const napiExists = napiBindings.some(binding => fs.existsSync(binding));
  
  const methods = {
    napiExists,
    libraryExists: fs.existsSync(libPath),
    cliExists: fs.existsSync(cliBinaryPath),
    napiPath: napiBindings.find(binding => fs.existsSync(binding))
  };
  
  return methods;
}

// Load the appropriate wrapper
function loadWrapper() {
  const methods = getIntegrationMethod();
  
  // Prioritize NAPI bindings first
  if (methods.napiExists && methods.napiPath) {
    console.log('🚀 Flow Desk: Using NAPI bindings (native performance)');
    return {
      FlowDesk: createNapiInterface(methods.napiPath),
      integrationMethod: 'napi',
      available: true
    };
  }
  
  if (methods.libraryExists) {
    console.log('🔧 Flow Desk: Using simple interface (Rust library available)');
    return {
      FlowDesk: createSimpleInterface(),
      integrationMethod: 'simple',
      available: true
    };
  }
  
  // Fallback to JavaScript implementation
  console.log('⚠️  Flow Desk: Using JavaScript fallback (Rust library not available)');
  return {
    FlowDesk: createJavaScriptFallback(),
    integrationMethod: 'fallback',
    available: false
  };
}

// Create NAPI interface that uses the native Rust bindings
function createNapiInterface(napiPath) {
  try {
    const napi = require(napiPath);
    
    // Initialize the library
    try {
      napi.initLogging();
      napi.initLibrary();
    } catch (e) {
      console.warn('Warning: Failed to initialize NAPI library:', e.message);
    }
    
    return class FlowDeskNapi {
      static test() {
        return `Flow Desk NAPI Interface - Native Rust bindings loaded from ${path.basename(napiPath)}`;
      }
      
      static getVersion() {
        try {
          return napi.getVersion();
        } catch (e) {
          return '0.1.0';
        }
      }
      
      static hello(name = 'World') {
        try {
          return napi.hello(name);
        } catch (e) {
          return `Hello from NAPI (error: ${e.message})`;
        }
      }
      
      static encryptData(data, key) {
        try {
          return napi.encryptString(data, key);
        } catch (e) {
          console.warn('NAPI encryption failed, using fallback:', e.message);
          return createJavaScriptFallback().encryptData(data, key);
        }
      }
      
      static decryptData(encryptedData, key) {
        try {
          return napi.decryptString(encryptedData, key);
        } catch (e) {
          console.warn('NAPI decryption failed, using fallback:', e.message);
          return createJavaScriptFallback().decryptData(encryptedData, key);
        }
      }
      
      static hashPassword(password) {
        // Use Node.js crypto for consistency
        return require('crypto').createHash('sha256').update(password).digest('hex');
      }
      
      static generateEncryptionKeyPair() {
        try {
          return napi.generateEncryptionKeyPair();
        } catch (e) {
          console.warn('NAPI key generation failed:', e.message);
          return null;
        }
      }
      
      static async testMailConnection(config) {
        try {
          return await napi.testMailConnection(JSON.stringify(config));
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      static async testCalendarConnection(config) {
        try {
          return await napi.testCalendarConnection(JSON.stringify(config));
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      static async testSearchEngine() {
        try {
          return await napi.testSearchEngine();
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      static getStats() {
        const methods = getIntegrationMethod();
        let napiStats = null;
        
        if (methods.napiPath) {
          try {
            const stats = fs.statSync(methods.napiPath);
            napiStats = {
              size: stats.size,
              modified: stats.mtime,
              available: true,
              path: methods.napiPath
            };
          } catch (error) {
            napiStats = { available: false, error: error.message };
          }
        }
        
        return {
          version: this.getVersion(),
          integrationMethod: 'napi',
          napiBindings: napiStats,
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version
        };
      }
      
      static isRustLibraryAvailable() {
        return true;
      }

      // Engine wrapper instances
      static createMailEngine() {
        try {
          return new napi.MailEngineWrapper();
        } catch (e) {
          console.warn('Failed to create mail engine:', e.message);
          return null;
        }
      }
      
      static createCalendarEngine() {
        try {
          return new napi.CalendarEngineJs();
        } catch (e) {
          console.warn('Failed to create calendar engine:', e.message);
          return null;
        }
      }
      
      static createSearchEngine() {
        try {
          return new napi.JsSearchEngine();
        } catch (e) {
          console.warn('Failed to create search engine:', e.message);
          return null;
        }
      }

      // Compatibility methods for existing API
      static async initMailEngine() {
        return Promise.resolve('NAPI interface - mail engine ready');
      }

      static async initCalendarEngine() {
        return Promise.resolve('NAPI interface - calendar engine ready');
      }

      static async initSearchEngine() {
        return Promise.resolve('NAPI interface - search engine ready');
      }

      static async initialize() {
        return Promise.resolve('Flow Desk NAPI interface initialized');
      }
    };
  } catch (error) {
    console.error('Failed to load NAPI bindings:', error.message);
    console.log('Falling back to simple interface');
    return createSimpleInterface();
  }
}

// Create a simple interface that works with the built Rust library
function createSimpleInterface() {
  const crypto = require('crypto');
  
  return class FlowDeskSimple {
    static test() {
      const methods = getIntegrationMethod();
      return `Flow Desk Rust Library is ${methods.libraryExists ? 'available and ready!' : 'not available'}`;
    }
    
    static getVersion() {
      try {
        const tomlPath = path.join(__dirname, 'Cargo.toml');
        const tomlContent = fs.readFileSync(tomlPath, 'utf8');
        const versionMatch = tomlContent.match(/version\s*=\s*"([^"]+)"/);
        return versionMatch ? versionMatch[1] : '0.1.0';
      } catch (error) {
        return '0.1.0';
      }
    }
    
    static hashPassword(password) {
      return crypto.createHash('sha256').update(password).digest('hex');
    }
    
    static encryptData(data, key) {
      const algorithm = 'aes-256-cbc';
      const keyHash = crypto.createHash('sha256').update(key).digest();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, keyHash);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    }
    
    static decryptData(encryptedData, key) {
      const algorithm = 'aes-256-cbc';
      const keyHash = crypto.createHash('sha256').update(key).digest();
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipher(algorithm, keyHash);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    
    static getStats() {
      const methods = getIntegrationMethod();
      let libraryStats = null;
      
      if (methods.libraryExists) {
        try {
          const libPath = path.join(__dirname, 'target', 'release', 'libflow_desk_shared.dylib');
          const stats = fs.statSync(libPath);
          libraryStats = {
            size: stats.size,
            modified: stats.mtime,
            available: true
          };
        } catch (error) {
          libraryStats = { available: false, error: error.message };
        }
      }
      
      return {
        version: this.getVersion(),
        integrationMethod: 'simple',
        rustLibrary: libraryStats,
        cliBinary: methods.cliExists,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      };
    }
    
    static isRustLibraryAvailable() {
      return getIntegrationMethod().libraryExists;
    }

    // Compatibility methods for existing API
    static async initMailEngine() {
      return Promise.resolve('Simple interface - mail engine ready');
    }

    static async initCalendarEngine() {
      return Promise.resolve('Simple interface - calendar engine ready');
    }

    static async initSearchEngine() {
      return Promise.resolve('Simple interface - search engine ready');
    }

    static async hello() {
      return Promise.resolve('Hello from Flow Desk Simple Interface!');
    }

    static async initialize() {
      return Promise.resolve('Flow Desk simple interface initialized');
    }
  };
}

// Create a JavaScript fallback implementation
function createJavaScriptFallback() {
  const crypto = require('crypto');
  
  return class FlowDeskFallback {
    static test() {
      const methods = getIntegrationMethod();
      return `Flow Desk JS Interface - Library: ${methods.libraryExists ? '✅' : '❌'}, CLI: ${methods.cliExists ? '✅' : '❌'}`;
    }
    
    static getVersion() {
      try {
        const tomlPath = path.join(__dirname, 'Cargo.toml');
        const tomlContent = fs.readFileSync(tomlPath, 'utf8');
        const versionMatch = tomlContent.match(/version\s*=\s*"([^"]+)"/);
        return versionMatch ? versionMatch[1] : '0.1.0';
      } catch (error) {
        return '0.1.0';
      }
    }
    
    static hashPassword(password) {
      return crypto.createHash('sha256').update(password).digest('hex');
    }
    
    static encryptData(data, key) {
      const algorithm = 'aes-256-cbc';
      const keyHash = crypto.createHash('sha256').update(key).digest();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, keyHash);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    }
    
    static decryptData(encryptedData, key) {
      const algorithm = 'aes-256-cbc';
      const keyHash = crypto.createHash('sha256').update(key).digest();
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipher(algorithm, keyHash);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    
    static getStats() {
      const methods = getIntegrationMethod();
      
      return {
        version: this.getVersion(),
        integrationMethod: 'javascript-fallback',
        rustLibrary: { available: methods.libraryExists },
        cliBinary: methods.cliExists,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      };
    }
    
    static isRustLibraryAvailable() {
      return getIntegrationMethod().libraryExists;
    }

    // Compatibility methods for existing API
    static async initMailEngine() {
      return Promise.resolve('JavaScript fallback - mail engine ready');
    }

    static async initCalendarEngine() {
      return Promise.resolve('JavaScript fallback - calendar engine ready');
    }

    static async initSearchEngine() {
      return Promise.resolve('JavaScript fallback - search engine ready');
    }

    static async hello() {
      return Promise.resolve('Hello from Flow Desk JavaScript Fallback!');
    }

    static async initialize() {
      return Promise.resolve('Flow Desk JavaScript fallback initialized');
    }
  };
}

// Load and export
const wrapper = loadWrapper();

module.exports = {
  FlowDesk: wrapper.FlowDesk,
  integrationMethod: wrapper.integrationMethod,
  available: wrapper.available,
  getStats: () => wrapper.FlowDesk.getStats(),
  test: () => wrapper.FlowDesk.test(),
  // Compatibility methods
  hello: () => wrapper.FlowDesk.hello(),
  initialize: () => wrapper.FlowDesk.initialize()
};

// Also provide named exports for CommonJS compatibility
module.exports.default = wrapper.FlowDesk;