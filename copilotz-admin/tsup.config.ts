import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    client: "src/api/client.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: false,
  external: ["react", "react-dom"],
});
