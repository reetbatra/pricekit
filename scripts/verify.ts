import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dodoClient } from "../src/dodo.js";

// The seven checks. Green means wired — not "probably wired".
// --json emits {checks:[{id,status,fix}]} — the agent's fix-loop format.

const APP_URL = process.env.PAYKIT_APP_URL ?? "http://localhost:3000";
const WEBHOOK_PATH = "/api/webhook";
const asJson = process.argv.includes("--json");

interface CheckResult {
  id: string;
  status: "green" | "red" | "warn";
  detail: string;
  fix: string;
}
const results: CheckResult[] = [];
const record = (id: string, status: CheckResult["status"], detail: string, fix = "") => {
  results.push({ id, status, detail, fix });
};

function blueprint() {
  return JSON.parse(readFileSync(".paykit/blueprint.json", "utf8"));
}

// 1 — env sane (test mode is hardcoded in the client; key presence checked here)
try {
  if (!process.env.DODO_PAYMENTS_API_KEY) throw new Error("DODO_PAYMENTS_API_KEY missing");
  if (!process.env.DODO_PAYMENTS_WEBHOOK_KEY?.startsWith("whsec_"))
    throw new Error("DODO_PAYMENTS_WEBHOOK_KEY missing or not a whsec_ secret");
  if (!existsSync(".paykit/blueprint.json")) throw new Error(".paykit/blueprint.json missing");
  record("1-env", "green", "API key + webhook secret + blueprint present; mode locked to test_mode");
} catch (e) {
  record("1-env", "red", (e as Error).message, "Fill .env per README; run `npm run provision`.");
}

const client = process.env.DODO_PAYMENTS_API_KEY ? dodoClient() : null;

// 2 — provisioned objects exist
if (client && existsSync(".paykit/blueprint.json")) {
  const bp = blueprint();
  try {
    await client.meters.retrieve(bp.meter_id);
    await client.creditEntitlements.retrieve(bp.credit_entitlement_id);
    await client.products.retrieve(bp.product_id);
    record("2-objects", "green", `meter ${bp.meter_id} · entitlement ${bp.credit_entitlement_id} · product ${bp.product_id}`);
  } catch (e) {
    record("2-objects", "red", `provisioned object missing: ${(e as Error).message}`, "Re-run `npm run provision`.");
  }

  // 3 — real test checkout session
  try {
    const s = await client.checkoutSessions.create({
      product_cart: [{ product_id: bp.product_id, quantity: 1 }],
      customer: { email: "verify@paykit.dev", name: "paykit verify" },
      return_url: APP_URL,
      metadata: { paykit_verify: "true" },
    } as any);
    const url = (s as any).checkout_url ?? (s as any).url;
    if (!url) throw new Error("no checkout URL in response");
    record("3-checkout", "green", `checkout session created: ${String(url).slice(0, 60)}…`);
  } catch (e) {
    record("3-checkout", "red", (e as Error).message, "Check product_id in .paykit/blueprint.json; see API error body above.");
  }

  // 4 — ingest one usage event
  try {
    await client.usageEvents.ingest({
      events: [
        {
          event_id: randomUUID(),
          customer_id: bp.demo_customer_id ?? "cus_verify_placeholder",
          event_name: bp.event_name,
          timestamp: new Date().toISOString(),
          metadata: { verify: "true" },
        },
      ],
    } as any);
    record("4-ingest", "green", `event accepted for ${bp.event_name}`);
  } catch (e) {
    record(
      "4-ingest",
      bp.demo_customer_id ? "red" : "warn",
      (e as Error).message,
      bp.demo_customer_id
        ? "Check event_name matches the meter and customer_id exists."
        : "No demo customer yet — complete one test checkout, then re-run."
    );
  }
}

// 5 — forgery: unsigned junk must be REJECTED
try {
  const r = await fetch(APP_URL + WEBHOOK_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ forged: true, type: "credit.balance_low" }),
  });
  if (r.status >= 200 && r.status < 300) {
    record("5-forgery", "red", `unsigned webhook was ACCEPTED (${r.status})`, "Signature verification must stay ON in the webhook route.");
  } else {
    record("5-forgery", "green", `unsigned webhook rejected (${r.status})`);
  }
} catch (e) {
  record("5-forgery", "red", `app not reachable at ${APP_URL}: ${(e as Error).message}`, "Start the app (npm run dev) or set PAYKIT_APP_URL.");
}

// 6 — truth: a correctly signed synthetic credit.balance_low must be accepted AND handled
try {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? "";
  const bp = existsSync(".paykit/blueprint.json") ? blueprint() : { low_balance_threshold: 35 };
  const payload = JSON.stringify({
    business_id: "bus_paykit_verify",
    type: "credit.balance_low",
    timestamp: new Date().toISOString(),
    data: {
      customer_id: bp.demo_customer_id ?? "cus_verify_placeholder",
      credit_entitlement_id: bp.credit_entitlement_id ?? "cen_verify",
      current_balance: 30,
      threshold: bp.low_balance_threshold,
    },
  });
  const id = `msg_${randomUUID()}`;
  const ts = Math.floor(Date.now() / 1000).toString();
  const key = Buffer.from(secret.replace("whsec_", ""), "base64");
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${payload}`).digest("base64");
  const r = await fetch(APP_URL + WEBHOOK_PATH, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": ts,
      "webhook-signature": `v1,${sig}`,
    },
    body: payload,
  });
  if (!(r.status >= 200 && r.status < 300)) throw new Error(`signed webhook rejected (${r.status})`);
  const sideEffect = ".paykit/last-webhook.json";
  if (!existsSync(sideEffect)) throw new Error("accepted, but .paykit/last-webhook.json was not written");
  const seen = JSON.parse(readFileSync(sideEffect, "utf8"));
  if (seen.type !== "credit.balance_low") throw new Error(`side-effect file has type ${seen.type}`);
  record("6-signed", "green", "signed balance_low accepted; handler side-effect confirmed");
} catch (e) {
  record("6-signed", "red", (e as Error).message, "Webhook route must verify Standard Webhooks signatures and write .paykit/last-webhook.json.");
}

// 7 — balance readable (soft-warn)
if (client && existsSync(".paykit/blueprint.json")) {
  const bp = blueprint();
  try {
    if (!bp.demo_customer_id) throw new Error("no demo customer yet");
    const entitlements = await client.customers.listCreditEntitlements(bp.demo_customer_id);
    const first = (entitlements as any).items?.[0] ?? (entitlements as any)[0];
    record("7-balance", "green", `balance readable: ${JSON.stringify(first?.balance ?? first).slice(0, 80)}`);
  } catch (e) {
    record("7-balance", "warn", (e as Error).message, "Soft-warn: complete one test checkout so a customer + grant exist.");
  }
}

// ── report ──
if (asJson) {
  console.log(JSON.stringify({ checks: results.map(({ id, status, fix }) => ({ id, status, fix })) }, null, 2));
} else {
  console.log("\n  paykit verify — green means wired, not \"probably wired\"\n");
  for (const r of results) {
    const dot = r.status === "green" ? "🟢" : r.status === "warn" ? "🟡" : "🔴";
    console.log(`  ${dot}  ${r.id.padEnd(11)} ${r.detail}${r.fix && r.status !== "green" ? `\n       fix: ${r.fix}` : ""}`);
  }
  console.log();
}
process.exit(results.some((r) => r.status === "red") ? 1 : 0);
