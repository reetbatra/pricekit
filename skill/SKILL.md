# paykit — integrate Dodo credit billing into this app

You are integrating prepaid credit billing (Dodo Payments) into the user's
existing app. paykit has already provisioned billing objects in TEST MODE;
their IDs are in `.paykit/blueprint.json`. Your job: wire the app, then prove it.

## Step 0 — Build the app profile (infer before you ask)

Read the repo and fill the `AppProfile` (see `paykit/src/detect-schema.ts`):
- model/provider SDKs + model ids → cost class (`stt`, `mini`, `mid`, `frontier`, or `custom`)
- what ONE user action is (the route/endpoint/job that triggers AI work)
- trigger style: user-initiated routes vs schedulers/queues/agents
- framework + package manager + existing auth
- any existing billing residue (old Stripe code, env vars) — flag it, don't delete it

Ask the user ONLY: paying users yet? · target margin (default 70%) ·
price-point feel ($9/$19/$49) · launch promo (default 30% × 3mo).

Then run: `npx paykit plan --app <name> --profile '<json>'` and present THE PLAN verbatim.
**Never do pricing arithmetic yourself. The engine does math; you do code.**

## Step 1 — Choose the adaptor (do not hand-roll)

Next.js → `@dodopayments/nextjs` · Express → `@dodopayments/express` ·
Hono → `@dodopayments/hono` · Astro → `@dodopayments/astro` ·
Fastify → `@dodopayments/fastify` · Convex → `@dodopayments/convex` ·
Better Auth present → prefer `@dodopayments/better-auth` ·
bare Node → `dodopayments` SDK + `./snippets`.

The Next.js adaptor exports `Checkout`, `CustomerPortal`, and `Webhooks`
(route handlers). `Webhooks({ webhookKey, onPayload })` verifies Standard
Webhooks signatures for you. If the `dodo-knowledge` MCP server is available,
query it for current payload shapes; otherwise use `./snippets` verbatim.

## Step 2 — Wire (the non-negotiables)

1. Checkout route via the adaptor. The SUCCESS REDIRECT NEVER grants
   anything. Access and credits change on WEBHOOKS ONLY.
2. Webhook route at `/api/webhook` via the adaptor's `Webhooks` handler with
   signature verification ON (`webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY`).
   Handle at minimum: payment/subscription success, `credit.balance_low`,
   `credit.deducted`. EVERY handled payload is also written to
   `.paykit/last-webhook.json` (verify depends on this side-effect).
3. Usage: fire ONE event per AI action with `event_id: crypto.randomUUID()`,
   `event_name` from `.paykit/blueprint.json`. Never retry with a new id.
4. Do NOT build a local credit ledger or mirror balances in the DB.
   Read balance from Dodo (`snippets/CreditBalance.tsx` + a thin
   `/api/credits` route calling `customers.listCreditEntitlements`).
5. Balance visible on the main authenticated screen.
   `credit.balance_low` → `lib/notify.ts` (console email-preview; prints the
   payload's CURRENT BALANCE, never the threshold).
6. Append to `.env`, never overwrite. Never print secret values.

## Step 3 — Prove it

Run `npx paykit verify --json`. Fix reds. Re-run.
You are NOT done until zero reds. Then summarize for the user:
what changed, where the balance shows, what happens at the low-balance alert.
