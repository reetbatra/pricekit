#!/usr/bin/env node
// pricekit CLI entry point. Dispatches to the tsx-run scripts so the published
// package needs no build step — just this shebang + tsx as a real dependency.
//
// tsx's own bin is NOT looked up via a hardcoded node_modules/.bin path:
// under npm's hoisting, a fresh `npx pricekit` install puts tsx in the
// npx cache's TOP-LEVEL node_modules, not nested under pricekit's own
// node_modules/.bin — so we resolve it the way Node actually finds
// dependencies (walking up node_modules, same as `require`), which
// handles both the hoisted (npx) and nested (local dev) cases correctly.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(import.meta.url);

const COMMANDS = {
  plan: "scripts/plan.ts",
  provision: "scripts/provision.ts",
  verify: "scripts/verify.ts",
  "fire-usage": "scripts/fire-usage.ts",
};

const [, , cmd, ...rest] = process.argv;

if (!cmd || !(cmd in COMMANDS)) {
  console.log(`pricekit — pricing copilot for Dodo Payments credit billing

Usage:
  npx pricekit plan --app <name> --profile '<AppProfile JSON>'
  npx pricekit provision
  npx pricekit verify [--json]
  npx pricekit fire-usage [count]

Docs: https://github.com/reetbatra/pricekit`);
  process.exit(cmd ? 1 : 0);
}

let tsxCliPath;
try {
  const tsxPkgPath = require.resolve("tsx/package.json");
  const tsxPkg = require(tsxPkgPath);
  tsxCliPath = join(dirname(tsxPkgPath), tsxPkg.bin.replace(/^\.\//, ""));
} catch (e) {
  console.error(`Could not locate the tsx package (${e.message}). Try reinstalling: npm install tsx`);
  process.exit(1);
}

const child = spawn(process.execPath, [tsxCliPath, join(root, COMMANDS[cmd]), ...rest], {
  stdio: "inherit",
  cwd: process.cwd(), // run against the CALLER's project, not pricekit's own install dir
});
child.on("exit", (code) => process.exit(code ?? 1));
