import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dodoClient } from "../src/dodo.js";

// Demo choreography: fire N usage events ~60ms apart so the balance widget
// visibly ticks. Default 320 against the 350 grant → lands at 30, crossing
// the low-balance threshold (35) on the way down.
// Dodo aggregates via a background worker (~every minute) — the drop lands
// in one batch; that's the platform's real architecture, shown honestly.

const N = Number(process.argv[2] ?? 320);
const bp = JSON.parse(readFileSync(".paykit/blueprint.json", "utf8"));
if (!bp.demo_customer_id) {
  throw new Error("No demo_customer_id in .paykit/blueprint.json — complete one test checkout first.");
}

const client = dodoClient();
console.log(`  firing ${N} × ${bp.event_name} for ${bp.demo_customer_id} (test mode)…`);

let sent = 0;
for (let i = 0; i < N; i++) {
  await client.usageEvents.ingest({
    events: [
      {
        event_id: randomUUID(), // idempotency: retries never double-bill; never reuse on retry
        customer_id: bp.demo_customer_id,
        event_name: bp.event_name,
        timestamp: new Date().toISOString(),
        metadata: { source: "fire-usage" },
      },
    ],
  } as any);
  sent++;
  if (sent % 40 === 0) console.log(`  …${sent}/${N}`);
  await new Promise((r) => setTimeout(r, 60));
}
console.log(`  done: ${sent} events sent. Dodo's worker aggregates ~every minute; watch the balance land.`);
