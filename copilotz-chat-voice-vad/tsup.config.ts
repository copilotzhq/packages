import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@copilotz/chat-ui', '@ricky0123/vad-web', 'onnxruntime-web']
});
