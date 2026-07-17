import "dotenv/config";
import DodoPayments from "dodopayments";

/** TEST MODE is hardcoded. pricekit refuses to touch live data regardless of the
 *  key supplied — there is deliberately no override flag. */
export function dodoClient(): DodoPayments {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  if (!key) {
    throw new Error(
      `DODO_PAYMENTS_API_KEY missing. Get a TEST MODE key from the Dodo dashboard ` +
        `(Settings → API Keys, test mode toggle ON) and put it in .env. ` +
        `Never paste keys into chats or commits.`
    );
  }
  return new DodoPayments({ bearerToken: key, environment: "test_mode" });
}

export const PRICEKIT_META = { pricekit: "usage-credits", pricekit_v: "1" } as const;
