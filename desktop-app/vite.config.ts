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
    })
  ],
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    // Bundle optimization
    rollupOptions: {
      output: {
        // Code splitting for better caching
        manualChunks: {
          // Vendor libraries
          vendor: ['react', 'react-dom', 'react-redux'],
          // Redux and state management
          store: ['@reduxjs/toolkit'],
          // UI components
          ui: ['framer-motion', 'lucide-react'],
          // Large utility libraries
          utils: ['dayjs', 'uuid'],
        },
        // Optimize chunk size
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
    },
    // Enable minification and tree-shaking
    minify: 'esbuild',
    target: 'chrome120', // Target recent Chromium for Electron
    // Reduce bundle size
    cssCodeSplit: true,
    reportCompressedSize: false, // Faster builds
    // Source maps for debugging
    sourcemap: process.env.NODE_ENV === 'development',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@flow-desk/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    // Enable HMR for better development experience
    hmr: true,
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-redux',
      '@reduxjs/toolkit',
      'framer-motion',
      'lucide-react'
    ],
    exclude: ['@flow-desk/shared'], // Local packages should not be pre-bundled
  },
})
