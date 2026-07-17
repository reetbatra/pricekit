import { classify, type Classification } from "./classify.js";
import type { AppProfile, CostInputs, ModelClass } from "./detect-schema.js";

/** Pinned model costs (prices_as_of 2026-07) — deterministic on purpose.
 *  Agents write code; calculators do arithmetic. Override with model_class
 *  "custom" + custom_usd. Units: $ per token for LLM classes, $ per minute for stt. */
const MODEL_COST_PER_UNIT: Record<Exclude<ModelClass, "custom">, number> = {
  frontier: 0.000015,
  mid: 0.000004,
  mini: 0.0000002,
  stt: 0.006,
};

const ASSUMED_ACTIONS_PER_USER = 300;

export interface Plan {
  classification: Classification;
  cost_per_action: number;
  credit_price: number;
  tier_price: number;
  grant: number;
  effective_margin: number;
  margin_warning: boolean;
  overage_price: number;
  rollover_percent: number;
  low_balance_threshold: number;
  promo: { percent: number; months: number; promo_price: number } | null;
  unit_name: string;
  action_desc: string;
}

function costOf(c: { model_class: ModelClass; custom_usd?: number; tokens_or_units: number }): number {
  if (c.model_class === "custom") {
    if (c.custom_usd === undefined) {
      throw new Error(`model_class "custom" requires custom_usd ($ per action). No guessing.`);
    }
    return c.custom_usd;
  }
  return MODEL_COST_PER_UNIT[c.model_class] * c.tokens_or_units;
}

function modelCost(inputs: CostInputs): number {
  let cost = costOf(inputs);
  if (inputs.secondary) cost += costOf(inputs.secondary);
  return cost;
}

/** Round to a clean, memorable grant: nearest 25 under 200, nearest 50 to 1000, nearest 100 above. */
export function roundClean(n: number): number {
  const step = n < 200 ? 25 : n < 1000 ? 50 : 100;
  return Math.max(step, Math.round(n / step) * step);
}

export function buildPlan(p: AppProfile): Plan {
  const classification = classify(p);
  const infra = p.infra_monthly_usd ?? 0.5;
  const margin = p.margin ?? 0.7;
  const tier_price = p.tier_price_usd ?? 9;
  const promoIn = p.promo === undefined ? { percent: 30, months: 3 } : p.promo;

  const cost_per_action = modelCost(p.cost_inputs) + infra / ASSUMED_ACTIONS_PER_USER;
  const credit_price = cost_per_action / (1 - margin);
  const grant = roundClean(tier_price / credit_price);
  const overage_price = credit_price * 1.25;

  const effective_margin = (tier_price - grant * cost_per_action) / tier_price;
  const margin_warning = effective_margin < margin - 0.05;

  return {
    classification,
    cost_per_action,
    credit_price,
    tier_price,
    grant,
    effective_margin,
    margin_warning,
    overage_price,
    rollover_percent: 50,
    low_balance_threshold: Math.round(grant * 0.1),
    promo: promoIn
      ? { ...promoIn, promo_price: +(tier_price * (1 - promoIn.percent / 100)).toFixed(2) }
      : null,
    unit_name: p.unit_name,
    action_desc: p.action_desc,
  };
}

const usd = (n: number, dp = 3) => `$${n.toFixed(dp).replace(/0+$/, "").replace(/\.$/, ".0")}`;

/** The on-camera PLAN block. Build to this exact shape (doc 01 §4). */
export function renderPlan(appName: string, plan: Plan): string {
  const pct = Math.round(plan.effective_margin * 100);
  const lines = [
    `│  ${appName} — your numbers, TEST MODE`,
    `│`,
    `│   Cost per ${plan.unit_name}        ≈ $${plan.cost_per_action.toFixed(3)}   (${plan.action_desc})`,
    `│   1 credit = 1 ${plan.unit_name}`,
    `│`,
    `│   → Launch tier: $${plan.tier_price}/mo · ${plan.grant} credits · ~${pct}% gross margin${plan.margin_warning ? "  ⚠ below target−5pts" : ""}`,
    `│   → Overage ${usd(plan.overage_price)}/credit (+25%) · billed at cycle end`,
    `│   → Rollover ${plan.rollover_percent}% (1 mo) · low-balance alert at ${plan.low_balance_threshold}`,
  ];
  if (plan.promo) {
    lines.push(
      `│   → Early bird: ${plan.promo.percent}% off × ${plan.promo.months} months ($${plan.promo.promo_price.toFixed(2)})`
    );
  }
  lines.push(`│`, `│   Bands per "Pricing in the AI Age" (Dodo, 2026). Override anything.`);
  return lines.join("\n");
}

/** plan.md = classify reasoning on top, then the PLAN block. Single source of truth downstream. */
export function renderPlanMd(appName: string, plan: Plan): string {
  return [
    `# ${appName} — pricing plan (pricekit)`,
    ``,
    `## Why this model: ${plan.classification.blueprint}`,
    ...plan.classification.reasoning.map((r) => `- ${r}`),
    ``,
    `## The plan`,
    "```",
    renderPlan(appName, plan),
    "```",
    ``,
    `_Generated in TEST MODE. Every number overridable._`,
  ].join("\n");
}
