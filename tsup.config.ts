import { defineConfig } from 'tsup';

export default defineConfig([
  // Core + React — CJS + ESM with type declarations
  {
    entry: {
      index: 'src/index.ts',
      'react/index': 'src/react/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
    outDir: 'dist',
  },
  // Vanilla widget — IIFE bundle (script tag drop-in)
  {
    entry: { 'widget/index': 'src/widget/index.ts' },
    format: ['iife'],
    globalName: 'EngageAIWidget',
    minify: true,
    outDir: 'dist',
    sourcemap: false,
  },
]);
