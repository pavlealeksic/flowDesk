import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/types/index.ts',
    'src/crypto/index.ts',
    'src/utils/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: false, // Disable DTS generation for now
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: ['node:crypto', 'node:fs', 'node:path'],
  treeshake: true,
})
