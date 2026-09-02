import { defineConfig } from "tsdown";

export default defineConfig([
  // 1. Host (Node) entry: lib/index.js
  {
    name: "dsh-plugin-skill-palette-node",
    entry: { index: "src/index.ts" },
    outDir: "lib",
    format: "esm",
    platform: "node",
    fixedExtension: false,
    dts: true,
    clean: false,
    outputOptions: {
      entryFileNames: "index.js",
    },
  },
  // 2. Client (Browser UI) entry: lib/client.js
  {
    name: "dsh-plugin-skill-palette-client",
    entry: { client: "src/client/index.ts" },
    outDir: "lib",
    format: "cjs",
    platform: "browser",
    dts: false,
    clean: false,
    outputOptions: {
      entryFileNames: "client.js",
      banner:
        'window.__ModuleLoader__.load({ id: "dsh-plugin-skill-palette", factory: (require) => {\n',
      footer: "\nreturn module.exports; } });",
      intro: "var module = { exports: {} }; var exports = module.exports;",
    },
    deps: {
      neverBundle: (specifier: string) =>
        specifier === "react" ||
        specifier.startsWith("react/") ||
        specifier === "react-dom" ||
        specifier.startsWith("react-dom/") ||
        specifier.startsWith("@deepseek-ai/"),
    },
  },
]);
