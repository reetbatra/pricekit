import { strict as assert } from "node:assert";
import { buildPlan, roundClean } from "../src/plan-engine.js";
import { classify } from "../src/classify.js";
import type { AppProfile } from "../src/detect-schema.js";

// The worked example from the runbook (doc 01 §4) — voice-notes app.
// STT ≈ $0.006/min · summarize ≈ $0.0004/min · infra $0.50/300 ≈ $0.0017
// → cost ≈ $0.008/min → credit $0.027 → grant 350 at $9 → 69% effective ✓
const echoscribe: AppProfile = {
  has_paying_users: true,
  output_countable: true,
  trigger: "user",
  api_first: false,
  action_desc: "STT + summarize + infra",
  unit_name: "minute",
  cost_inputs: {
    model_class: "stt",
    tokens_or_units: 1,
    secondary: { model_class: "custom", custom_usd: 0.0004, tokens_or_units: 1 },
  },
  framework: "nextjs",
};

const plan = buildPlan(echoscribe);

assert.equal(plan.classification.blueprint, "saas-hybrid", "voice notes → saas-hybrid (Q1 + Ch.5)");
assert.ok(Math.abs(plan.cost_per_action - 0.008) < 0.0005, `cost ≈ $0.008, got ${plan.cost_per_action}`);
assert.ok(Math.abs(plan.credit_price - 0.027) < 0.001, `credit ≈ $0.027, got ${plan.credit_price}`);
assert.equal(plan.grant, 350, `grant 350, got ${plan.grant}`);
assert.ok(Math.abs(plan.effective_margin - 0.69) < 0.01, `~69% margin, got ${plan.effective_margin}`);
assert.equal(plan.margin_warning, false, "69% is within 5pts of 70% target");
assert.ok(Math.abs(plan.overage_price - 0.034) < 0.001, `overage ≈ $0.034, got ${plan.overage_price}`);
assert.equal(plan.low_balance_threshold, 35, `threshold 35, got ${plan.low_balance_threshold}`);
assert.equal(plan.promo?.promo_price, 6.3, `early bird $6.30, got ${plan.promo?.promo_price}`);

// Classifier rule order
assert.equal(classify({ ...echoscribe, has_paying_users: false }).blueprint, "flat-simple");
assert.equal(classify({ ...echoscribe, api_first: true }).blueprint, "usage-metered");
assert.equal(classify({ ...echoscribe, trigger: "autonomous" }).blueprint, "usage-metered");
assert.ok(
  classify({ ...echoscribe, replaces_measurable_human_task: true }).reasoning.some((r) =>
    r.includes("earn it")
  ),
  "outcome-based note appended, never auto-picked"
);

// round_clean behavior
assert.equal(roundClean(333), 350);
assert.equal(roundClean(112), 100);
assert.equal(roundClean(1240), 1200);

console.log("plan.test: all assertions passed — worked example reproduces ✓");
