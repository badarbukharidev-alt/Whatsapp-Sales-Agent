import { Tool, ToolPlan } from "../../types.js";

/**
 * Pricing authority.
 *
 * Every price the agent is allowed to say comes from here, and only from here.
 * The LLM is never asked to recall, compute or infer a price — it is handed the
 * exact plan table and, separately, its reply is checked against the same table
 * before it goes out.
 *
 * Catalogs written before the structured `plans` field still work: the plans are
 * derived deterministically from the admin's own catalog text (pricePkr, the
 * negotiation notes, sales points and FAQ), so this is still reading the
 * database rather than guessing.
 */

const MONEY = "(?:rs\\.?|pkr|rupees)?\\s*([0-9][0-9,]{1,8})";

/**
 * A money amount that is unambiguously money — it carries a currency marker.
 * Used both for harvesting approved prices out of catalog prose and for
 * spotting a price in an outgoing reply.
 */
export const CURRENCY_ANCHORED =
  /(?:rs\.?|pkr|rupees)\s*([0-9][0-9,]{2,8})|([0-9][0-9,]{2,8})\s*(?:rs\b|pkr\b|rupees\b)/gi;

/** Text fields an admin might have written a secondary price into. */
function catalogText(tool: Tool): string {
  return [
    tool.pricing?.negotiation_notes,
    ...(tool.sales_points || []),
    ...(tool.faq || []).flatMap((f) => [f.question, f.answer]),
    ...(tool.sections || []).map((s) => s.content),
    tool.description,
  ]
    .filter(Boolean)
    .join("\n");
}

function toAmount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(String(raw).replace(/[,\s]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Finds a named plan's price in the admin's own catalog prose, e.g.
 * "Lifetime License at Rs. 3,500" or "Rs. 3,500 lifetime".
 */
function findLabelledPrice(text: string, label: string): number | undefined {
  const patterns = [
    new RegExp(`${label}[^.\\n]{0,60}?${MONEY}`, "i"),
    new RegExp(`${MONEY}[^.\\n]{0,40}?${label}`, "i"),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const amount = toAmount(m?.[1]);
    if (amount) return amount;
  }
  return undefined;
}

/** Finds the floor an admin wrote next to a plan ("down to Rs. 2,800 - 3,000"). */
function findLabelledFloor(text: string, label: string): number | undefined {
  const direct = text.match(new RegExp(`${MONEY}\\s*(?:for|ke\\s*li?ye)\\s*${label}`, "i"));
  const fromDirect = toAmount(direct?.[1]);
  if (fromDirect) return fromDirect;

  const range = text.match(
    new RegExp(`${label}[^.\\n]{0,80}?(?:down\\s*to|negotiable\\s*(?:down\\s*)?to|discount\\s*to)\\s*${MONEY}`, "i")
  );
  return toAmount(range?.[1]);
}

/**
 * Returns every plan the customer may be offered, newest schema first and
 * falling back to derivation. Always at least one entry when the tool has any
 * price at all; an empty array means "we genuinely have no price configured",
 * which the caller must surface honestly rather than paper over.
 */
export function getToolPlans(tool: Tool): ToolPlan[] {
  if (!tool) return [];

  // 1. Structured plans win outright.
  const configured = (tool.plans || []).filter((p) => p && p.isActive !== false && (p.pricePkr || p.priceUsd));
  if (configured.length > 0) {
    return configured.map((p) => ({ ...p, name: (p.name || "Plan").trim() }));
  }

  // 2. Derive from the rest of the catalog record.
  const plans: ToolPlan[] = [];
  const basePkr = toAmount(tool.pricePkr);
  const baseUsd = toAmount(tool.priceUsd);

  if (basePkr || baseUsd) {
    plans.push({
      id: "derived_base",
      name: "1 Month",
      pricePkr: basePkr,
      priceUsd: baseUsd,
      minNegotiablePkr: tool.pricing?.min_negotiable_pkr,
      billingCycle: "monthly",
    });
  }

  const text = catalogText(tool);
  const lifetimePkr = findLabelledPrice(text, "lifetime");
  if (lifetimePkr && lifetimePkr !== basePkr) {
    plans.push({
      id: "derived_lifetime",
      name: "Lifetime",
      pricePkr: lifetimePkr,
      minNegotiablePkr: findLabelledFloor(text, "lifetime"),
      billingCycle: "lifetime",
    });
  }

  return plans;
}

/** "ClipShield – YouTube Copyright Claim Remover" -> "ClipShield". */
export function shortToolName(tool: Tool): string {
  const name = (tool?.name || "").trim();
  return name.split(/\s+[–—-]\s+/)[0].trim() || name;
}

export function formatPrice(plan: ToolPlan): string {
  if (plan.pricePkr) return `Rs. ${plan.pricePkr.toLocaleString("en-US")}`;
  if (plan.priceUsd) return `$${plan.priceUsd}`;
  return "price on request";
}

/** Customer-facing plan lines, exactly as they should appear on WhatsApp. */
export function formatPlanLines(plans: ToolPlan[]): string {
  return plans.map((p) => `${p.name} — ${formatPrice(p)}`).join("\n");
}

/**
 * The plan table handed to the LLM, with the explicit instruction that these are
 * the only numbers it may ever state.
 */
export function formatPlansForPrompt(tool: Tool, plans: ToolPlan[]): string {
  if (plans.length === 0) {
    return `[PRICING] No price is configured for ${shortToolName(tool)}. You must NOT state, guess or estimate any price. Say you'll confirm the rate and move on.`;
  }
  const lines = plans.map((p) => {
    const floor = p.minNegotiablePkr ? ` | absolute floor Rs. ${p.minNegotiablePkr.toLocaleString("en-US")}` : "";
    return `  - ${p.name}: ${formatPrice(p)}${floor}${p.note ? ` (${p.note})` : ""}`;
  });
  return [
    `[PRICING — THE ONLY PRICES THAT EXIST. Never state any number not listed here.]`,
    ...lines,
    `When the customer asks about price or is ready to buy, list ALL of these plans together — never ask which plan they want before showing them what the plans are.`,
  ].join("\n");
}

/**
 * Builds the message that shows the customer every plan at once.
 *
 * This is deterministic on purpose: the moment someone wants to buy or activate,
 * the prices they see are read straight out of the catalog, not produced by the
 * model. `variantSeed` just rotates the opening line so a returning customer
 * doesn't get a word-for-word repeat.
 */
export function buildPlanOfferMessage(params: {
  tool: Tool;
  plans: ToolPlan[];
  gotHwid?: boolean;
  variantSeed?: number;
}): string {
  const { tool, plans, gotHwid = false, variantSeed = 0 } = params;
  const name = shortToolName(tool);

  const openers = gotHwid
    ? ["Perfect bhai 👍 Device ID mil gaya.", "Shukriya, Device ID note kar liya 👍", "Mil gaya Device ID 👍"]
    : ["Ye rahe available plans:", "Do options hain:", "Rates ye hain:"];
  const opener = openers[Math.abs(variantSeed) % openers.length];

  const intro =
    plans.length > 1
      ? `${opener} ${name} ke ${plans.length} plans available hain:`
      : `${opener} ${name} ka rate ye hai:`;
  const closer = plans.length > 1 ? "Aap kis wali key lena chahte ho?" : "Confirm kar dein to aage barhate hain.";

  return `${intro}\n${formatPlanLines(plans)}\n\n${closer}`;
}

/**
 * Every rupee amount the agent is permitted to say for this tool: each plan
 * price, each plan floor, and the legacy tool-level floor. Used to catch a reply
 * that invented a number.
 */
export function collectAllowedPriceAmounts(tool: Tool, plans: ToolPlan[]): number[] {
  const amounts = new Set<number>();
  for (const p of plans) {
    if (p.pricePkr) amounts.add(p.pricePkr);
    if (p.minNegotiablePkr) amounts.add(p.minNegotiablePkr);
  }
  const base = toAmount(tool?.pricePkr);
  if (base) amounts.add(base);
  if (tool?.pricing?.min_negotiable_pkr) amounts.add(tool.pricing.min_negotiable_pkr);

  // Any figure the admin themselves wrote into the catalog is fair game too —
  // promo rates inside a saved template, discount tiers in the FAQ, etc. This
  // scan requires an explicit currency marker, otherwise unrelated numbers
  // ("9 layers", "99.8% success", "3,600+ voices") would quietly become
  // "approved prices" and defeat the whole guard.
  const scannable = `${catalogText(tool)}\n${tool?.templateMessage?.content || ""}`;
  for (const m of scannable.matchAll(CURRENCY_ANCHORED)) {
    const amount = toAmount(m[1] || m[2]);
    if (amount) amounts.add(amount);
  }

  return [...amounts];
}
