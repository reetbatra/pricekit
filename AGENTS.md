# pricekit

Pricing copilot for Dodo Payments credit billing. Deterministic engine
(`src/`), thin scripts (`scripts/`), and an integration skill (`skill/`).

## For agents integrating an app with pricekit

Read `skill/SKILL.md` and follow it exactly.
Definition of done: `npm run verify -- --json` → zero reds.

Invariants (non-negotiable):
- Webhooks grant access/credits; success redirects never do.
- `event_id = crypto.randomUUID()`; never reused on retry.
- No local balance mirror — read from Dodo.
- Signature verification stays ON.
- TEST MODE only; the client hardcodes `environment: "test_mode"`.
- Never do pricing arithmetic; call `npm run plan`.

## For agents working on pricekit itself

- `npm test` must stay green (the worked example is the spec).
- Every provisioned object carries `metadata.pricekit`; re-runs create nothing new.
