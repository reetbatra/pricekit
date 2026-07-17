/** The app profile the integrating agent fills by reading the repo,
 *  plus the four answers only a human can give. */
export type ModelClass = "frontier" | "mid" | "mini" | "stt" | "custom";

export interface CostInputs {
  /** Named model class with a pinned price, or "custom" with custom_usd set. */
  model_class: ModelClass;
  /** Direct $/action override — required when model_class is "custom". */
  custom_usd?: number;
  /** Approximate units of work per action (tokens for LLM classes, minutes for stt). */
  tokens_or_units: number;
  /** Optional second model call in the same action (e.g. STT then summarize). */
  secondary?: { model_class: ModelClass; custom_usd?: number; tokens_or_units: number };
}

export interface AppProfile {
  has_paying_users: boolean;
  output_countable: boolean;
  trigger: "user" | "autonomous" | "mixed";
  api_first: boolean;
  /** e.g. "one transcribed minute of a voice note" */
  action_desc: string;
  /** e.g. "minute", "generation", "message" */
  unit_name: string;
  cost_inputs: CostInputs;
  framework: string;
  /** Does the app replace a measurable human task? Triggers the outcome-based note. */
  replaces_measurable_human_task?: boolean;
  /** Monthly per-user infra beyond model costs. Default 0.50. */
  infra_monthly_usd?: number;
  /** Target gross margin 0–1. Default 0.70. */
  margin?: number;
  /** Monthly price feel. Default 9. */
  tier_price_usd?: number;
  /** Early-bird promo. Default 30% × 3 months. Set null for none. */
  promo?: { percent: number; months: number } | null;
}
