import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/controller.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@copilotz/chat-ui/model', 'react', 'react-dom', '@copilotz/copilotz/client', '@copilotz/copilotz/core/client']
});
