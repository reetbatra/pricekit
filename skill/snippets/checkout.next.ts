// app/api/checkout/route.ts — hosted checkout via Dodo's Next.js adaptor.
// The return_url page must NEVER grant anything — webhooks grant.
import { Checkout } from "@dodopayments/nextjs";

export const GET = Checkout({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: "test_mode",
  returnUrl: process.env.PRICEKIT_APP_URL ?? "http://localhost:3000",
  type: "session",
});
