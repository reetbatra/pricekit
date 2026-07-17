import type { AppProfile } from "./detect-schema.js";

export type Blueprint = "flat-simple" | "usage-metered" | "saas-hybrid";

export interface Classification {
  blueprint: Blueprint;
  reasoning: string[];
}

/** The ebook as ordered rules. First match wins; the citations ARE the feature. */
export function classify(p: AppProfile): Classification {
  const reasoning: string[] = [];
  let blueprint: Blueprint;

  if (!p.has_paying_users) {
    blueprint = "flat-simple";
    reasoning.push(
      `No paying users yet → ship a flat price and stop overthinking. ` +
        `"Simplicity is a feature" — Pricing in the AI Age, Ch. 10, Phase 1.`
    );
  } else if (p.api_first) {
    blueprint = "usage-metered";
    reasoning.push(
      `API-first product → pure usage metering. Developers punish paying for ` +
        `what they don't use — Pricing in the AI Age, Q2.`
    );
  } else if (p.trigger === "autonomous") {
    blueprint = "usage-metered";
    reasoning.push(
      `Autonomous trigger → platform-driven consumption prices per unit of work, ` +
        `not per seat — Pricing in the AI Age, Ch. 4 (autonomy axis).`
    );
  } else if (p.output_countable && p.trigger === "user") {
    blueprint = "saas-hybrid";
    reasoning.push(
      `Countable, user-triggered actions with subjective value → subscription base ` +
        `+ prepaid credits — Pricing in the AI Age, Q1 + Ch. 5.`
    );
  } else {
    blueprint = "saas-hybrid";
    reasoning.push(
      `Default for mixed shapes: subscription base + credit variable — ` +
        `Pricing in the AI Age, Ch. 10.`
    );
  }

  if (p.replaces_measurable_human_task) {
    reasoning.push(
      `Note: this app replaces a measurable human task — outcome-based pricing is ` +
        `worth exploring later, but "earn it" first (Ch. 7). Never auto-picked.`
    );
  }

  return { blueprint, reasoning };
}
