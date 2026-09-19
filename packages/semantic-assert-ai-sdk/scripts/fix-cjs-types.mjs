import { readFile, writeFile } from "node:fs/promises";

// tsup's declaration bundler drops import resolution attributes. Restore the
// type-only ESM import for CommonJS consumers using TypeScript's NodeNext mode.
const path = new URL("../dist/index.d.cts", import.meta.url);
const source = await readFile(path, "utf8");
const fixed = source.replace(
  "import * as ai from 'ai';",
  'import type * as ai from "ai" with { "resolution-mode": "import" };',
);
if (fixed === source) throw new Error("Expected the AI SDK import in the CommonJS declarations");
await writeFile(path, fixed);
