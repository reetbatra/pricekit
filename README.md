# pricekit

**Know what to charge — then ship it.** pricekit is a pricing copilot for
[Dodo Payments](https://dodopayments.com) credit billing: your coding agent
reads your app, pricekit's deterministic engine recommends a pricing model and
computes the numbers in the open (using the frameworks from Dodo's
[*Pricing in the AI Age*](https://dodopayments.com/ebooks/pricing-in-the-ai-age)
report), provisions the billing objects in **test mode**, hands your agent a
one-line integration task, and then **proves the wiring** with deterministic
checks.

Agents write code. Calculators do arithmetic. Pricing math is exactly the
thing you never let a model improvise.

> Community project — not affiliated with or endorsed by Dodo Payments.

## Quickstart (~15 minutes)

In your own app's directory — no clone needed, `npx` fetches pricekit for you:

```bash
# .env:  DODO_PAYMENTS_API_KEY=<your TEST MODE key>
```

1. **Plan** — your agent builds the app profile (see `skill/SKILL.md` Step 0), then:
   `npx pricekit plan --app myapp --profile '<json>'`
   → THE PLAN prints: cost/action, credit price at your margin, tier, overage,
   rollover, promo. Every number shown. Every number overridable.
2. **Provision** — `npx pricekit provision`
   → meter + credit entitlement + product created in your Dodo **test** account
   (idempotent: re-runs create nothing new). Prints the one manual webhook step.
3. **Integrate** — paste the printed line into your coding agent:
   *"Read skill/SKILL.md and integrate this billing into the app. When
   finished, run `npx pricekit verify --json` and fix anything red."*
4. **Prove** — `npx pricekit verify`
   → 7 checks: env → objects → real checkout → real usage event →
   **forged webhook rejected** → **signed webhook handled** → balance readable.
   Green means wired. Not "probably wired".

Developing pricekit itself (not integrating it into an app)? Clone this repo and
use `npm run plan` / `npm run provision` / `npm run verify` instead — same
scripts, run locally.

## What it provisions (trust defaults)

| Object | Values |
|---|---|
| Meter | count aggregation, 1 event = 1 action |
| Credit entitlement | custom unit, precision 0, 30-day expiry, rollover 50% (1 mo), overage +25% invoiced at billing |
| Product | $tier/mo usage-based price, credits granted per cycle, low-balance alert at 10% |

Everything is tagged `metadata.pricekit` — provisioning is idempotent and
auditable. Test mode is **hardcoded**; pricekit refuses to touch live data
regardless of the key you give it.

## How the recommendation works

Ordered rules compiled from the report — first match wins, citations printed:

```
no paying users        → flat-simple     (Ch.10 Phase 1: "simplicity is a feature")
api-first              → usage-metered   (Q2: devs punish paying for what they don't use)
autonomous trigger     → usage-metered   (Ch.4: autonomy axis)
countable + user-run   → saas-hybrid     (Q1 + Ch.5: credits for countable value)
else                   → saas-hybrid     (Ch.10 default)
replaces human task    → note only: outcome-based "worth exploring — earn it" (Ch.7)
```

## Blueprints

| Blueprint | For | Status |
|---|---|---|
| `saas-hybrid` | chat/job-style apps | shipped |
| `usage-metered` | API-first, agent-driven | shipped |
| `flat-simple` | pre-PMF | shipped |
| `growth-loop` (referrals in credits) | — | **community bounty** |
| `agent-budgets` (spend-capped agents) | — | **community bounty** |

## FAQ

- **Auth?** Better Auth users: prefer `@dodopayments/better-auth`.
- **Live mode?** Not in v1 — deliberately. Flip your keys and re-provision when you're ready.
- **Stripe?** This is Dodo-native by design: the credit ledger, meters, and
  merchant-of-record tax handling are the point.

## Roadmap

`replay` (re-run the math when model prices drop) · `growth-loop` ·
`agent-budgets`.

MIT © contributors
