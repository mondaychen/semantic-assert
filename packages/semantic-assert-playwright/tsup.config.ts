import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/reporter.ts"],
  format: ["esm", "cjs"],
  target: "es2022",
  platform: "node",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
});
