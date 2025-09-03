import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      // Enable SWC for faster compilation
      jsxRuntime: 'automatic',
      // Enable development optimizations
      fastRefresh: true,
      // Tree-shake unused imports from React
      babel: {
        plugins: [
          process.env.NODE_ENV === 'production' && ['babel-plugin-transform-remove-console']
        ].filter(Boolean)
      }
    })
  ],
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    // Enable code splitting and compression
    rollupOptions: {
      output: {
        // Optimized code splitting strategy
        manualChunks: (id) => {
          // Vendor chunk for core React libraries
          if (id.includes('react') && !id.includes('react-window')) {
            return 'react-vendor'
          }
          // State management chunk
          if (id.includes('@reduxjs/toolkit') || id.includes('react-redux')) {
            return 'state-management'
          }
          // UI library chunks (split by size)
          if (id.includes('framer-motion')) {
            return 'animation'
          }
          if (id.includes('lucide-react')) {
            return 'icons'
          }
          // Utilities chunk
          if (id.includes('dayjs') || id.includes('uuid') || id.includes('crypto-js')) {
            return 'utils'
          }
          // Large virtualization component
          if (id.includes('react-window')) {
            return 'virtualization'
          }
          // Node modules - group by common functionality
          if (id.includes('node_modules')) {
            if (id.includes('tailwind') || id.includes('clsx') || id.includes('class-variance-authority')) {
              return 'styling'
            }
            // Keep everything else in vendor
            return 'vendor'
          }
          // Default: main bundle
          return undefined
        },
        // Optimize chunk and asset naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      },
      // External dependencies for Electron (if any are available globally)
      external: [],
    },
    // Aggressive minification
    minify: 'esbuild',
    target: 'chrome120', // Target Electron's Chromium version
    // CSS optimization
    cssCodeSplit: true,
    cssMinify: 'esbuild',
    // Performance optimizations
    reportCompressedSize: false, // Faster builds in CI
    chunkSizeWarningLimit: 1000, // Warn for chunks > 1MB
    // Source maps only in development
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@flow-desk/shared': path.resolve(__dirname, '../shared/src'),
      // Optimize imports
      'react/jsx-runtime': 'react/jsx-runtime',
      'react/jsx-dev-runtime': 'react/jsx-dev-runtime',
    },
  },
  server: {
    port: 5173,
    // Enable HMR for better development experience
    hmr: {
      overlay: false // Less intrusive error overlay
    },
    // Warm up frequently used files
    warmup: {
      clientFiles: [
        './src/renderer/main.tsx',
        './src/renderer/App.tsx',
        './src/renderer/components/**/*.tsx'
      ]
    }
  },
  // Optimized dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-redux',
      '@reduxjs/toolkit',
      'dayjs',
      'uuid',
      'crypto-js',
      'clsx',
      'tailwind-merge',
    ],
    exclude: [
      '@flow-desk/shared', // Local packages
      'electron', // Electron APIs
    ],
    // Force pre-bundle these deps to avoid runtime discovery
    force: true,
  },
  // Enable experimental features for better performance
  experimental: {
    buildAdvancedBaseOptions: true,
  },
  // Define environment variables at build time
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
})
