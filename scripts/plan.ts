import { mkdirSync, writeFileSync } from "node:fs";
import { buildPlan, renderPlan, renderPlanMd } from "../src/plan-engine.js";
import type { AppProfile } from "../src/detect-schema.js";

// Usage: npx paykit plan --app <name> --profile '<json>'
// The integrating agent fills the profile by reading the repo (skill Step 0)
// and passes it here. The engine does the math; agents never do arithmetic.

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const appName = arg("app") ?? "your-app";
const profileJson = arg("profile");

if (!profileJson) {
  console.error(
    `Usage: npx paykit plan --app <name> --profile '<AppProfile JSON>'\n` +
      `See src/detect-schema.ts for the profile shape. Example:\n` +
      `npx paykit plan --app echoscribe --profile '{"has_paying_users":true,` +
      `"output_countable":true,"trigger":"user","api_first":false,` +
      `"action_desc":"STT + summarize + infra","unit_name":"minute",` +
      `"cost_inputs":{"model_class":"stt","tokens_or_units":1,` +
      `"secondary":{"model_class":"custom","custom_usd":0.0004,"tokens_or_units":1}},` +
      `"framework":"nextjs"}'`
  );
  process.exit(2);
}

let profile: AppProfile;
try {
  profile = JSON.parse(profileJson);
} catch (e) {
  console.error(`--profile is not valid JSON: ${(e as Error).message}`);
  process.exit(2);
}

const plan = buildPlan(profile);

for (const r of plan.classification.reasoning) console.log(`  ${r}`);
console.log();
console.log(renderPlan(appName, plan));

mkdirSync(".paykit", { recursive: true });
writeFileSync(".paykit/plan.md", renderPlanMd(appName, plan));
writeFileSync(
  ".paykit/plan.json",
  JSON.stringify({ app: appName, blueprint: plan.classification.blueprint, ...plan }, null, 2)
);
console.log(`\n  Written: .paykit/plan.md · .paykit/plan.json`);
console.log(`  Next: npx paykit provision`);
