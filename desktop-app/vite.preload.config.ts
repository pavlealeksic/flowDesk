import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    outDir: 'dist/preload',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/preload/preload.ts'),
      name: 'preload',
      fileName: () => 'preload.js',
      formats: ['cjs']
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs'
      }
    },
    minify: false, // Keep readable for debugging
    sourcemap: process.env.NODE_ENV === 'development',
    target: 'node16' // Electron's Node.js version
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@flow-desk/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
})