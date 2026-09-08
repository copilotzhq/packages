import { defineConfig } from "tsup";
export default defineConfig({
  entry: { index: "src/index.tsx", client: "src/client.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "@copilotz/copilotz/usage/client"],
});
