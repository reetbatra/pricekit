#!/usr/bin/env node
// paykit CLI entry point. Dispatches to the tsx-run scripts so the published
// package needs no build step — just this shebang + tsx as a real dependency.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const COMMANDS = {
  plan: "scripts/plan.ts",
  provision: "scripts/provision.ts",
  verify: "scripts/verify.ts",
  "fire-usage": "scripts/fire-usage.ts",
};

const [, , cmd, ...rest] = process.argv;

if (!cmd || !(cmd in COMMANDS)) {
  console.log(`paykit — pricing copilot for Dodo Payments credit billing

Usage:
  npx paykit plan --app <name> --profile '<AppProfile JSON>'
  npx paykit provision
  npx paykit verify [--json]
  npx paykit fire-usage [count]

Docs: https://github.com/reetbatra/paykit`);
  process.exit(cmd ? 1 : 0);
}

const tsxBin = join(root, "node_modules", ".bin", "tsx");
const child = spawn(tsxBin, [join(root, COMMANDS[cmd]), ...rest], {
  stdio: "inherit",
  cwd: process.cwd(), // run against the CALLER's project, not paykit's own install dir
});
child.on("exit", (code) => process.exit(code ?? 1));
