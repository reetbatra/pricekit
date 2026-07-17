import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dodoClient, PAYKIT_META } from "../src/dodo.js";

// Provisions the billing objects for the plan in .paykit/plan.json.
// Idempotent: lists before creating; re-runs create nothing new.
// Order per runbook: meter → credit entitlement → product.

const client = dodoClient();

interface PlanFile {
  app: string;
  grant: number;
  tier_price: number;
  overage_price: number;
  rollover_percent: number;
  low_balance_threshold: number;
  unit_name: string;
}

function loadPlan(): PlanFile {
  if (!existsSync(".paykit/plan.json")) {
    throw new Error(`.paykit/plan.json not found — run \`npx paykit plan\` first.`);
  }
  return JSON.parse(readFileSync(".paykit/plan.json", "utf8"));
}

const plan = loadPlan();
const METER_NAME = `${plan.app}.${plan.unit_name}s`; // e.g. echoscribe → voice notes app: "echoscribe.minutes"
const EVENT_NAME = METER_NAME;
const ENTITLEMENT_NAME = `${plan.app} ${plan.unit_name}s`;
const PRODUCT_NAME = `${plan.app} Pro`;

async function findOrCreateMeter() {
  for await (const m of client.meters.list()) {
    if (m.name === METER_NAME) {
      console.log(`  ↺ meter reused: ${m.id} (${METER_NAME})`);
      return m;
    }
  }
  const m = await client.meters.create({
    name: METER_NAME,
    event_name: EVENT_NAME,
    measurement_unit: plan.unit_name,
    aggregation: { type: "count" },
    description: `1 event = 1 processed ${plan.unit_name} (paykit)`,
  });
  console.log(`  ✓ meter created: ${m.id} (${METER_NAME})`);
  return m;
}

async function findOrCreateEntitlement() {
  for await (const e of client.creditEntitlements.list()) {
    if (e.name === ENTITLEMENT_NAME) {
      console.log(`  ↺ credit entitlement reused: ${e.id} (${ENTITLEMENT_NAME})`);
      return e;
    }
  }
  const e = await client.creditEntitlements.create({
    name: ENTITLEMENT_NAME,
    unit: capitalize(`${plan.unit_name}s`),
    precision: 0,
    expires_after_days: 30,
    rollover_enabled: true,
    rollover_percentage: plan.rollover_percent,
    rollover_timeframe_count: 1,
    rollover_timeframe_interval: "Month",
    max_rollover_count: 1,
    overage_enabled: true,
    overage_limit: plan.grant,
    overage_behavior: "invoice_at_billing",
    currency: "USD",
    price_per_unit: plan.overage_price.toFixed(3),
  });
  console.log(`  ✓ credit entitlement created: ${e.id} (${ENTITLEMENT_NAME})`);
  return e;
}

async function findOrCreateProduct(meterId: string, entitlementId: string) {
  for await (const p of client.products.list()) {
    const full = await client.products.retrieve(p.product_id).catch(() => null);
    if (full && (full as any).metadata?.paykit === PAYKIT_META.paykit && full.name === PRODUCT_NAME) {
      console.log(`  ↺ product reused: ${p.product_id} (${PRODUCT_NAME})`);
      return full;
    }
  }
  const p = await client.products.create({
    name: PRODUCT_NAME,
    tax_category: "saas",
    metadata: { ...PAYKIT_META },
    price: {
      type: "usage_based_price",
      currency: "USD",
      discount: 0,
      fixed_price: Math.round(plan.tier_price * 100),
      purchasing_power_parity: false,
      payment_frequency_count: 1,
      payment_frequency_interval: "Month",
      subscription_period_count: 1,
      subscription_period_interval: "Month",
      meters: [
        {
          meter_id: meterId,
          credit_entitlement_id: entitlementId,
          meter_units_per_credit: "1",
          free_threshold: 0,
          price_per_unit: plan.overage_price.toFixed(3),
        } as any,
      ],
    } as any,
    credit_entitlements: [
      {
        credit_entitlement_id: entitlementId,
        credits_amount: String(plan.grant),
        currency: "USD",
        low_balance_threshold_percent: 10,
        rollover_enabled: true,
        rollover_percentage: plan.rollover_percent,
        rollover_timeframe_count: 1,
        rollover_timeframe_interval: "Month",
        max_rollover_count: 1,
        overage_enabled: true,
        overage_limit: String(plan.grant),
        overage_behavior: "invoice_at_billing",
        price_per_unit: plan.overage_price.toFixed(3),
      },
    ],
  });
  console.log(`  ✓ product created: ${p.product_id} (${PRODUCT_NAME}, $${plan.tier_price}/mo + ${plan.grant} credits/cycle)`);
  return p;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const meter = await findOrCreateMeter();
const entitlement = await findOrCreateEntitlement();
const product = await findOrCreateProduct(meter.id, entitlement.id);

mkdirSync(".paykit", { recursive: true });
writeFileSync(
  ".paykit/blueprint.json",
  JSON.stringify(
    {
      mode: "test_mode",
      app: plan.app,
      meter_id: meter.id,
      event_name: EVENT_NAME,
      credit_entitlement_id: entitlement.id,
      product_id: (product as any).product_id ?? (product as any).id,
      grant: plan.grant,
      low_balance_threshold: plan.low_balance_threshold,
      provisioned_at: new Date().toISOString(),
    },
    null,
    2
  )
);
if (!existsSync(".gitignore") || !readFileSync(".gitignore", "utf8").includes(".env")) {
  appendFileSync(".gitignore", "\n.env\n");
}

console.log(`\n  Written: .paykit/blueprint.json`);
console.log(`
  ── ONE MANUAL STEP (webhooks need a public URL) ──────────────────
  1. In another terminal:  cloudflared tunnel --url http://localhost:3000
  2. Dodo Dashboard (TEST MODE) → Settings → Webhooks → Add endpoint:
        <your-tunnel-url>/api/webhook
  3. Copy the signing secret (whsec_…) into .env as:
        DODO_PAYMENTS_WEBHOOK_KEY=whsec_…
  ──────────────────────────────────────────────────────────────────

  Then hand your coding agent this line:

    Read skill/SKILL.md and integrate this billing into the app.
    When finished, run \`npx paykit verify --json\` and fix anything red.
`);
