import { SalesStage, SentImageRecord, ToolImage } from "../../types.js";
import { ConversationState } from "./conversation-state.js";

/**
 * Visual-proof intelligence.
 *
 * Images are treated as sales evidence, not as keyword triggers. An image
 * carries a description (and optionally richer sales metadata) that says what
 * it is FOR; this module decides whether showing it would genuinely strengthen
 * the conversation happening right now — including when the customer never
 * asked for a picture at all ("scam tu nahi hai?" deserves the customer-feedback
 * screenshot without anyone typing the word "screenshot").
 *
 * It is equally responsible for restraint: cooldowns, per-conversation caps and
 * a hard rule that a customer who is ready to buy gets closed, not advertised at.
 */

const DEFAULT_COOLDOWN_MINUTES = 30;
const DEFAULT_MAX_PER_CONVERSATION = 1;
const DEFAULT_PRIORITY = 1;

/** Below this, a match is too weak to justify interrupting with a picture. */
const PROACTIVE_SCORE_THRESHOLD = 3;
/** When the customer explicitly asked to see something, a weak match still wins. */
const EXPLICIT_SCORE_THRESHOLD = 1;

/**
 * Stages where an unrequested image is noise rather than help — the customer is
 * mid-transaction and wants the thing they asked for, not more marketing.
 */
const CLOSING_STAGES: SalesStage[] = [
  "awaiting_license",
  "hwid_provided",
  "plan_monthly",
  "plan_lifetime",
  "awaiting_payment_details",
  "paid",
  "ready_to_buy",
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "your", "you", "how", "where", "what", "when", "why",
  "see", "get", "got", "can", "will", "its", "it", "is", "are", "was", "not", "any", "all", "into", "out",
  "use", "used", "using", "when", "show", "shows", "showing", "image", "images", "screenshot", "screen",
  "shot", "photo", "pic", "picture", "proof", "example", "examples", "real", "tool", "app", "software",
  "customer", "customers", "user", "users", "product",
  "kaise", "kese", "kahan", "kaha", "kidhar", "kya", "kia", "kyu", "hai", "hain", "ka", "ki", "ke", "ko",
  "mein", "me", "se", "par", "pe", "aap", "bhai", "yeh", "ye", "wo", "woh", "kar", "karo", "karu", "karein",
  "krdo", "do", "de", "den", "dein", "bhej", "bhejo", "bhejein", "dikhao", "dikha", "dikhaen", "please",
  "plz", "mujhe", "mera", "meri", "main", "hun", "hoon", "ho", "na", "to", "ok", "acha", "milega", "milta",
  "chahiye", "batao", "bata", "sakta", "sakte", "hoga", "hota", "koi", "kuch",
]);

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of (text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/)) {
    if (raw.length < 3) continue;
    if (STOPWORDS.has(raw)) continue;
    tokens.add(raw);
  }
  // Domain synonyms so the customer's words and the admin's wording meet.
  if (tokens.has("hwid")) {
    tokens.add("hardware");
    tokens.add("device");
  }
  if (tokens.has("hardware") || tokens.has("device")) tokens.add("hwid");
  return tokens;
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let score = 0;
  for (const t of a) if (b.has(t)) score++;
  return score;
}

/** Signals the customer is emitting right now, as plain labels to match metadata against. */
function activeSignalLabels(state: ConversationState): string[] {
  const s = state.signals;
  const labels: string[] = [state.stage];
  if (s.questionsLegitimacy) labels.push("skeptical", "trust", "scam", "legitimacy", "doubt", "genuine");
  if (s.wantsProof) labels.push("proof", "evidence", "social_proof", "testimonial", "feedback", "stats");
  if (s.asksAboutResults) labels.push("results", "views", "growth", "analytics", "reach", "performance");
  if (s.objectsToPrice) labels.push("price_objection", "expensive", "value", "hesitant");
  if (s.asksAboutNiche) labels.push("niche", "content", "channel", "strategy");
  if (s.asksAboutFeatures) labels.push("feature", "capability", "how_it_works");
  if (s.mentionsHwid || s.providedHwid) labels.push("hwid", "hardware", "device", "activation", "license");
  if (s.asksPrice || s.comparesPlans) labels.push("pricing", "plans");
  if (s.needsSupport) labels.push("support", "troubleshooting");
  if (s.saysInstalled || s.saysDownloaded) labels.push("installed", "setup", "onboarding");
  return labels;
}

/** Everything an image says about itself, legacy `description` included. */
function imageMetaText(img: ToolImage): string {
  return [
    img.title,
    img.description,
    img.purpose,
    img.category,
    img.what_it_proves,
    ...(img.sales_context || []),
    ...(img.use_when || []),
    ...(img.customer_signals || []),
    img.filename,
  ]
    .filter(Boolean)
    .join(" ");
}

function minutesSince(iso: string, now: number): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (now - t) / 60000;
}

export interface ImageSelectionInput {
  images?: ToolImage[] | null;
  state: ConversationState;
  customerText: string;
  /** Everything already sent to THIS customer, for cooldown + cap enforcement. */
  sentHistory?: SentImageRecord[] | null;
  /** The customer explicitly asked to be shown something. */
  explicitRequest?: boolean;
  /** Injectable for tests. */
  now?: number;
}

export interface ImageSelection {
  image: ToolImage;
  score: number;
  /** Why it was chosen — logged, and summarised into the prompt. */
  reason: string;
  /** Guardrail text the agent must respect when talking about this image. */
  doNotClaim?: string;
}

interface Rejection {
  imageId: string;
  reason: string;
}

/**
 * Chooses the single most useful image for this turn, or null when no image
 * would genuinely help. Never returns more than one: stacking proof images
 * reads as spam.
 */
export function selectImageForTurn(input: ImageSelectionInput): ImageSelection | null {
  const { state, customerText, explicitRequest = false } = input;
  const images = (input.images || []).filter((img) => img && (img.filepath || img.url));
  if (images.length === 0) return null;

  const now = input.now ?? Date.now();
  const history = input.sentHistory || [];

  // A customer who is buying or activating wants the transaction finished. Only
  // an explicit request gets a picture here.
  if (!explicitRequest && CLOSING_STAGES.includes(state.stage)) return null;

  const customerTokens = tokenize(customerText);
  const signalLabels = activeSignalLabels(state);
  const signalTokens = tokenize(signalLabels.join(" "));

  const rejections: Rejection[] = [];
  let best: ImageSelection | null = null;

  for (const img of images) {
    const sends = history.filter((h) => h.imageId === img.id);
    const maxPer = img.max_per_conversation ?? DEFAULT_MAX_PER_CONVERSATION;
    if (sends.length >= maxPer) {
      rejections.push({ imageId: img.id, reason: `already sent ${sends.length}x (max ${maxPer})` });
      continue;
    }

    const cooldown = img.cooldown_minutes ?? DEFAULT_COOLDOWN_MINUTES;
    const lastSend = sends[sends.length - 1];
    if (lastSend && minutesSince(lastSend.at, now) < cooldown) {
      rejections.push({ imageId: img.id, reason: `cooldown (${cooldown}m) not elapsed` });
      continue;
    }

    // Explicit "never in this situation" rules from the admin.
    const avoid = (img.avoid_when || []).map((a) => a.toLowerCase());
    if (avoid.some((a) => signalLabels.some((l) => l.toLowerCase().includes(a) || a.includes(l.toLowerCase())))) {
      rejections.push({ imageId: img.id, reason: "matched an avoid_when rule" });
      continue;
    }

    const metaTokens = tokenize(imageMetaText(img));
    let score = 0;
    const why: string[] = [];

    // 1. The customer's own words matching what the image is about.
    const directHit = overlapScore(customerTokens, metaTokens);
    if (directHit > 0) {
      score += directHit * 2;
      why.push(`matches their wording (${directHit})`);
    }

    // 2. The situation matching what the image is FOR — this is what makes the
    //    system proactive rather than keyword-triggered.
    const signalHit = overlapScore(signalTokens, metaTokens);
    if (signalHit > 0) {
      score += signalHit * 2;
      why.push(`fits the current situation (${signalHit})`);
    }

    // 3. Admin declared this stage explicitly.
    if ((img.sales_stage || []).includes(state.stage)) {
      score += 4;
      why.push(`declared for stage "${state.stage}"`);
    }

    // 4. Admin declared the signal the customer is emitting.
    const declaredSignals = (img.customer_signals || []).map((s) => s.toLowerCase());
    if (declaredSignals.some((d) => signalLabels.some((l) => l.toLowerCase().includes(d) || d.includes(l.toLowerCase())))) {
      score += 4;
      why.push("matches a declared customer signal");
    }

    // 5. use_when phrases matched against the whole situation.
    const useWhen = (img.use_when || []).map((u) => u.toLowerCase());
    if (useWhen.length > 0) {
      const situation = `${customerText} ${signalLabels.join(" ")}`.toLowerCase();
      if (useWhen.some((u) => u && situation.includes(u))) {
        score += 3;
        why.push("matched a use_when rule");
      }
    }

    if (explicitRequest) {
      score += 1;
      why.push("customer asked to be shown something");
    }

    score += (img.priority ?? DEFAULT_PRIORITY) - 1;

    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = {
        image: img,
        score,
        reason: why.join("; ") || "general relevance",
        doNotClaim: img.what_it_does_not_prove,
      };
    }
  }

  if (!best) return null;

  const threshold = explicitRequest ? EXPLICIT_SCORE_THRESHOLD : PROACTIVE_SCORE_THRESHOLD;
  if (best.score < threshold) return null;

  return best;
}

/** Appends a delivery record, keeping the history bounded. */
export function recordImageSent(
  history: SentImageRecord[] | undefined,
  imageId: string,
  toolId?: string,
  now: number = Date.now()
): SentImageRecord[] {
  const next = [...(history || []), { imageId, toolId, at: new Date(now).toISOString() }];
  return next.slice(-40);
}

/**
 * Short briefing about the chosen image for the prompt, so the reply introduces
 * it naturally and stays inside what it actually demonstrates.
 */
export function describeImageForPrompt(selection: ImageSelection): string {
  const img = selection.image;
  const label = (img.title || img.description || "product image").trim().slice(0, 120);
  const lines = [`AUTO-IMAGE ATTACHED: "${label}" is ALREADY being attached to this reply automatically.`];
  if (img.what_it_proves) lines.push(`It demonstrates: ${img.what_it_proves}`);
  if (selection.doNotClaim) lines.push(`It does NOT prove: ${selection.doNotClaim} — never claim that.`);
  lines.push(
    "Introduce it naturally in one short line, say what to look at in it, and then CONTINUE the conversation with a question or next step. Do NOT promise to send it later, do NOT say you cannot send images, and do NOT output a [SEND_IMAGE:] tag."
  );
  return lines.join(" ");
}
