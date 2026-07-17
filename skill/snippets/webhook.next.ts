// app/api/webhook/route.ts — Next.js App Router webhook route via Dodo's adaptor.
// Signature verification is ON (Standard Webhooks) — the adaptor rejects
// unsigned/forged posts before your code runs. Every handled payload is also
// written to .paykit/last-webhook.json: paykit verify's side-effect check.
import { Webhooks } from "@dodopayments/nextjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { notify } from "@/lib/notify";

function recordForVerify(payload: unknown) {
  mkdirSync(".paykit", { recursive: true });
  writeFileSync(".paykit/last-webhook.json", JSON.stringify(payload, null, 2));
}

export const POST = Webhooks({
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,
  onPayload: async (payload: any) => {
    recordForVerify(payload);
    switch (payload.type) {
      case "credit.balance_low":
        // Print the payload's CURRENT BALANCE — never the threshold.
        await notify(
          `Heads up — ${payload.data?.current_balance} credits left`,
          `Your balance crossed the low-balance mark. Top up to keep going.`
        );
        break;
      case "credit.deducted":
      case "credit.added":
        // Balance UI reads live from Dodo — nothing to mirror here.
        break;
      case "subscription.active":
      case "payment.succeeded":
        // Grant access HERE (webhooks grant; redirects never do).
        break;
    }
  },
});
