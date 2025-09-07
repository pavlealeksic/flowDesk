import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  
  test: {
    // Test environment setup
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup/vitestSetup.ts'],
    
    // Global test configuration
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        'coverage/',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
        'src/examples/',
        'src/assets/',
        '.eslintrc.js',
        'vite.config.ts',
        'vitest.config.ts',
        'jest.config.js',
        'playwright.config.ts'
      ],
      include: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        },
        'src/main/workspace.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'src/main/main.ts': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // File patterns
    include: [
      'src/**/*.{test,spec}.{js,ts,tsx}',
      'src/__tests__/**/*.{test,spec}.{js,ts,tsx}'
    ],
    exclude: [
      'src/__tests__/e2e/**',
      'src/__tests__/integration/**'
    ],
    
    // Concurrent testing
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@main': resolve(__dirname, './src/main'),
      '@renderer': resolve(__dirname, './src/renderer'),
      '@preload': resolve(__dirname, './src/preload'),
      '@types': resolve(__dirname, './src/types'),
      '@tests': resolve(__dirname, './src/__tests__')
    }
  },
  
  // Define test environment globals
  define: {
    'process.env.NODE_ENV': '"test"',
    global: 'globalThis'
  }
});