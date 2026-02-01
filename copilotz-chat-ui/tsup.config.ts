import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  // Don't clean - we handle CSS separately and don't want to delete it
  clean: false,
  external: ['react', 'react-dom']
});
