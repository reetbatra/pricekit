// app/api/credits/route.ts — thin server route the CreditBalance widget polls.
// Keeps the API key server-side; reads live from Dodo (no local mirror).
import { NextRequest, NextResponse } from "next/server";
import DodoPayments from "dodopayments";

const client = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: "test_mode",
});

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("c");
  if (!customerId) return NextResponse.json({ error: "missing c" }, { status: 400 });
  const entitlements: any = await client.customers.listCreditEntitlements(customerId);
  const first = entitlements.items?.[0] ?? entitlements[0];
  return NextResponse.json({ balance: Number(first?.balance ?? 0) });
}
