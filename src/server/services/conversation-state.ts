import { ChatMessage, CustomerMemorySummary, SalesStage } from "../../types.js";

/**
 * Conversation-state layer.
 *
 * Everything here is INTERNAL. It answers, before a single word is generated:
 * what does this customer already have, what are they actually asking for, and
 * therefore what must the reply NOT repeat. The agent used to re-send the full
 * product advertisement to someone who had already installed the app and was
 * asking for a license — because nothing in the pipeline ever asked "where is
 * this person in the journey?". This module is that question.
 *
 * It is deliberately product-agnostic: it reasons about buying-journey signals
 * (downloaded / installed / has a device id / chose a plan / paid), not about
 * any one tool in the catalog.
 */

// ---------------------------------------------------------------------------
// Signal detection
// ---------------------------------------------------------------------------

/** Customer says they already have/downloaded the software. */
const DOWNLOADED_REGEX =
  /(?:download\s*(?:kar|kr|ho|hogya|ho\s*gaya|kiya|kr\s*li|kar\s*li|kr\s*lia|kar\s*liya|done)|downloaded|\bdownload\s*complete\b|file\s*mil\s*gay)/i;

/** Customer says they already installed / opened / are running the app. */
const INSTALLED_REGEX =
  /(?:install\s*(?:kar|kr|ho|hogya|ho\s*gaya|kiya|kr\s*li|kar\s*li|kr\s*lia|kar\s*liya|done|kr\s*chuka|kar\s*chuka)|installed|\bsetup\s*(?:ho\s*gaya|hogya|complete|done|kar\s*li)|app\s*(?:chal|open|khul)\s*(?:rah|gay|gy)|software\s*(?:chal|open|khul))/i;

/** Customer supplied — or is asking about — a device/hardware id. */
const HWID_MENTION_REGEX = /(?:\bhwid\b|hardware\s*id|device\s*id|machine\s*id|\bhw\s*id\b)/i;

/**
 * A device-id VALUE in the message. Deliberately conservative: an explicitly
 * labelled id, or a long vendor-style token. Never matches a bare price/phone.
 */
const HWID_VALUE_REGEX =
  /(?:(?:hwid|hardware\s*id|device\s*id|machine\s*id)\s*(?:is|hai|=|:|-)?\s*)([A-Za-z0-9][A-Za-z0-9\-_]{5,63})|\b([A-Z]{2,5}-[A-Z0-9]{4,}(?:-[A-Z0-9]{4,})*)\b/;

/** Customer wants a licence / key / activation. */
const LICENSE_REQUEST_REGEX =
  /(?:\blicen[cs]e\b|licence|\bkey\b|\bkeys\b|activat|\bactive\s*kar|chalu\s*kar|unlock)/i;

/** Customer is asking the price. */
const PRICE_INQUIRY_REGEX =
  /(?:\bprice\b|\brate\b|\bkitna\b|\bkitne\b|\bkitni\b|how\s*much|\bcost\b|charges|\bfees\b|\bfee\b)/i;

/** Customer thinks it is too expensive. */
const PRICE_OBJECTION_REGEX =
  /(?:mehnga|menga|mehanga|expensive|zyada\s*(?:hai|he|h)|bohat\s*zyada|buhat\s*zyada|too\s*much|budget\s*(?:nahi|ni|nhi|kam)|kam\s*kar|kam\s*karo|discount|sasta|km\s*kro|rate\s*kam)/i;

/** Customer is worried about being scammed / doubts legitimacy. */
const TRUST_OBJECTION_REGEX =
  /(?:scam|fraud|fake|dhoka|dhoka\s*to|genuine|asli|real\s*hai|trust|bharosa|bharosay|legit|sach\s*much|paisay\s*le\s*kar|reliable|safe\s*hai)/i;

/** Customer wants proof / stats / evidence. */
const PROOF_REQUEST_REGEX =
  /(?:\bproof\b|\bstats\b|statistics|analytics|\bresults?\b|screenshot|\bsubut\b|saboot|feedback|review|testimonial|kisi\s*ne\s*liya|kitne\s*log)/i;

/** Customer is asking whether they will get views / results. */
const RESULTS_INQUIRY_REGEX =
  /(?:views?\s*(?:aye|ayen|ayenge|aayen|ata|aate|milen|milenge|ate)|\bviral\b|\bgrowth\b|\breach\b|monetiz|earning|paisa\s*ban|kamai|subscriber)/i;

/** Customer is asking what niche / content to make. */
const NICHE_INQUIRY_REGEX =
  /(?:\bniche\b|\bnitch\b|kis\s*(?:type|tarah)\s*k[ae]\s*(?:video|content|channel)|kon\s*si\s*(?:niche|category)|konsi\s*(?:niche|category)|what\s*(?:niche|content)|content\s*(?:kya|konsa|kaunsa))/i;

/** Customer is asking about features / capability. */
const FEATURE_INQUIRY_REGEX =
  /(?:feature|kya\s*kya\s*kar|kaam\s*kaise|kaise\s*kaam|how\s*does\s*it\s*work|kya\s*karta|functions?|capab)/i;

/** Customer is comparing the plans. */
const PLAN_COMPARISON_REGEX =
  /(?:monthly\s*(?:ya|or|vs)\s*lifetime|lifetime\s*(?:ya|or|vs)\s*monthly|\bfarq\b|difference\s*(?:kya|between)|konsa\s*(?:better|behtar|acha)|which\s*(?:one|plan)\s*(?:is\s*)?(?:better|good))/i;

/** Customer picked the monthly plan. */
const CHOSE_MONTHLY_REGEX = /(?:\bmonthly\b|\b1\s*month\b|one\s*month|ek\s*mah|mahin[ae]\s*wala|month\s*wala)/i;

/** Customer picked the lifetime plan. */
const CHOSE_LIFETIME_REGEX = /(?:lifetime|life\s*time|permanent|hamesha\s*k[ae]\s*li?[ye])/i;

/** Customer says they have paid. */
const PAID_REGEX =
  /(?:payment\s*(?:kar\s*d|kr\s*d|ho\s*gay|hogy|done|send|bhej)|paid|paisay?\s*(?:bhej|send|transfer)\s*(?:di|diy|dia|diye)|transfer\s*(?:kar\s*d|kr\s*d|ho\s*gay)|slip|receipt|screenshot\s*(?:bhej|send))/i;

/** Customer needs help with something that is already theirs. */
const SUPPORT_REGEX =
  /(?:kaam\s*nahi|kam\s*nahi|not\s*working|error|problem|issue|masla|chal\s*nahi|open\s*nahi|expire|expired|reinstall|dobara|phir\s*se\s*install)/i;

/** Customer is asking what the product even is. */
const WHAT_IS_IT_REGEX =
  /(?:kya\s*h[aei]\b|kia\s*h[aey]\b|what\s*is\b|batao\s*(?:is\s*)?(?:k[ae]\s*bar[ae]|about)|introduce|tafseel|detail)/i;

/** Customer wants the software / download link. */
const WANTS_SOFTWARE_REGEX =
  /(?:\blink\b|download|\bapp\b|software|tool\s*(?:chahiye|do|de|bhej)|kahan\s*se\s*(?:milega|le)|send\s*me|bhej\s*d)/i;

// ---------------------------------------------------------------------------

export interface ConversationSignals {
  saysDownloaded: boolean;
  saysInstalled: boolean;
  mentionsHwid: boolean;
  providedHwid: string | null;
  wantsLicense: boolean;
  asksPrice: boolean;
  objectsToPrice: boolean;
  questionsLegitimacy: boolean;
  wantsProof: boolean;
  asksAboutResults: boolean;
  asksAboutNiche: boolean;
  asksAboutFeatures: boolean;
  comparesPlans: boolean;
  choseMonthly: boolean;
  choseLifetime: boolean;
  claimsPaid: boolean;
  needsSupport: boolean;
  asksWhatItIs: boolean;
  wantsSoftware: boolean;
}

export interface ConversationState {
  stage: SalesStage;
  signals: ConversationSignals;
  /** Facts the customer has already given us or already been told. */
  known: {
    appDownloaded: boolean;
    appInstalled: boolean;
    hwid: string | null;
    selectedPlan: string | null;
    priceDiscussed: boolean;
    paymentDetailsSent: boolean;
    templateAlreadySent: boolean;
    linkAlreadySent: boolean;
    isReturningConversation: boolean;
  };
  /** Human-readable "do not repeat this" list injected into the prompt. */
  doNotRepeat: string[];
  /** The single most useful thing to do next. */
  nextAction: string;
  /** Whether the full product template/advertisement is still appropriate. */
  shouldSendTemplate: boolean;
  /** Why the template was or wasn't allowed (for logs/debugging). */
  templateDecisionReason: string;
}

function detectSignals(text: string): ConversationSignals {
  const t = text || "";
  const hwidMatch = t.match(HWID_VALUE_REGEX);
  const providedHwid = hwidMatch ? (hwidMatch[1] || hwidMatch[2] || "").trim() || null : null;

  return {
    saysDownloaded: DOWNLOADED_REGEX.test(t),
    saysInstalled: INSTALLED_REGEX.test(t),
    mentionsHwid: HWID_MENTION_REGEX.test(t),
    // Only treat a token as a device id when the message is actually about one.
    providedHwid: providedHwid && HWID_MENTION_REGEX.test(t) ? providedHwid : providedHwid && /^[A-Z]{2,5}-/.test(providedHwid) ? providedHwid : null,
    wantsLicense: LICENSE_REQUEST_REGEX.test(t),
    asksPrice: PRICE_INQUIRY_REGEX.test(t),
    objectsToPrice: PRICE_OBJECTION_REGEX.test(t),
    questionsLegitimacy: TRUST_OBJECTION_REGEX.test(t),
    wantsProof: PROOF_REQUEST_REGEX.test(t),
    asksAboutResults: RESULTS_INQUIRY_REGEX.test(t),
    asksAboutNiche: NICHE_INQUIRY_REGEX.test(t),
    asksAboutFeatures: FEATURE_INQUIRY_REGEX.test(t),
    comparesPlans: PLAN_COMPARISON_REGEX.test(t),
    choseMonthly: CHOSE_MONTHLY_REGEX.test(t),
    choseLifetime: CHOSE_LIFETIME_REGEX.test(t),
    claimsPaid: PAID_REGEX.test(t),
    needsSupport: SUPPORT_REGEX.test(t),
    asksWhatItIs: WHAT_IS_IT_REGEX.test(t),
    wantsSoftware: WANTS_SOFTWARE_REGEX.test(t),
  };
}

/**
 * Scans the conversation so far for facts the customer established in EARLIER
 * turns — someone who said "install kar li hai" three messages ago is still an
 * installed user now, even if this message is just "price?".
 */
function detectHistoricalFacts(history: ChatMessage[]): {
  downloaded: boolean;
  installed: boolean;
  hwid: string | null;
  paid: boolean;
} {
  let downloaded = false;
  let installed = false;
  let hwid: string | null = null;
  let paid = false;

  for (const msg of history) {
    if (msg.role !== "user") continue;
    const s = detectSignals(msg.content || "");
    if (s.saysDownloaded) downloaded = true;
    if (s.saysInstalled) installed = true;
    if (s.claimsPaid) paid = true;
    if (s.providedHwid) hwid = s.providedHwid;
  }
  return { downloaded, installed, hwid, paid };
}

/**
 * Picks the single stage that best describes where the customer is right now.
 * Ordered by urgency of intent: an explicit buying/activation signal always
 * beats a general browsing signal, because that is what should drive the reply.
 */
function resolveStage(
  signals: ConversationSignals,
  known: ConversationState["known"],
  historicalPaid: boolean
): SalesStage {
  if (signals.claimsPaid || historicalPaid) return "paid";
  if (signals.needsSupport && (known.appInstalled || known.hwid)) return "support";

  // Activation track — the customer already has the product in hand.
  if (signals.providedHwid) return "hwid_provided";
  if (signals.wantsLicense && (known.appInstalled || known.appDownloaded || known.hwid)) return "awaiting_license";
  if (signals.mentionsHwid) return "activation";
  if (signals.saysInstalled) return "installed";
  if (signals.saysDownloaded) return "downloaded";

  // Decision track.
  if (signals.claimsPaid) return "paid";
  if (signals.choseLifetime) return "plan_lifetime";
  if (signals.choseMonthly) return "plan_monthly";
  if (signals.comparesPlans) return "comparing_plans";
  if (signals.wantsLicense) return "awaiting_license";

  // Objection / trust track — handle before generic info questions.
  if (signals.objectsToPrice) return "objection_price";
  if (signals.questionsLegitimacy) return "trust_check";

  // Information track.
  if (signals.wantsProof) return "proof_request";
  if (signals.asksAboutResults) return "results_inquiry";
  if (signals.asksAboutNiche) return "niche_guidance";
  if (signals.asksPrice) return "price_inquiry";
  if (signals.asksAboutFeatures) return "feature_inquiry";

  if (known.appInstalled || known.hwid) return "returning_customer";
  if (signals.asksWhatItIs || signals.wantsSoftware) return "new_lead";
  if (known.isReturningConversation) return "researching";
  return "new_lead";
}

/** The most useful next move for each stage — steers the model without scripting it. */
const NEXT_ACTION_BY_STAGE: Record<SalesStage, string> = {
  new_lead:
    "Introduce the product briefly in terms of the problem it solves, then ask one question about what they want to build.",
  researching: "Answer what they asked, then move them one concrete step forward.",
  downloaded: "Acknowledge they have it, and guide them to install/open it and test the free trial.",
  installed:
    "Acknowledge the install — do NOT re-explain download steps. Guide them to the Device ID/HWID step and ask which plan they want.",
  awaiting_license:
    "They want a licence. Skip all marketing. Confirm the plan (monthly or lifetime) and move to payment.",
  hwid_provided:
    "Their Device ID is received — confirm that, never ask for it again, and ask which plan they want so you can proceed.",
  price_inquiry: "Give the price directly and plainly, then ask one question that moves toward a decision.",
  comparing_plans: "Compare the plans honestly in one or two lines and give a recommendation for their use case.",
  trust_check:
    "Address the trust concern first and concretely (free trial, how activation works). Social proof helps here.",
  objection_price:
    "Acknowledge the concern, understand what they're comparing against, reframe value against their goal, mention the trial. Only offer a configured discount after that.",
  objection_other: "Diagnose the real objection and address it before selling anything further.",
  feature_inquiry: "Explain only the features relevant to their stated goal, not the whole list.",
  niche_guidance:
    "Give genuinely useful niche advice, ask what kind of channel they want, then connect the workflow to the product.",
  results_inquiry:
    "Never guarantee views or income. Explain what the tool actually helps with, then ask about their content plan.",
  proof_request: "Show the strongest relevant proof, explain what it does and does not demonstrate, then continue.",
  ready_to_buy: "Stop selling. Confirm the plan and move straight to payment details.",
  plan_monthly: "They chose monthly — confirm the price and send payment details.",
  plan_lifetime: "They chose lifetime — confirm the price and send payment details.",
  awaiting_payment_details: "Send the configured payment accounts and what to share after paying.",
  paid: "Never confirm payment yourself. Acknowledge, tell them it's being verified, and collect the Device ID if missing.",
  activation: "Give the exact steps to find the Device ID, then activate. No marketing.",
  support: "Solve the problem directly. This is an existing customer, not a lead — no pitching.",
  returning_customer: "Treat them as an existing user. Answer directly, skip all onboarding material.",
};

/** Stages where the full product advertisement/template is still welcome. */
const TEMPLATE_ALLOWED_STAGES: SalesStage[] = ["new_lead", "researching"];

/**
 * The fix for the reported bug: decide whether the saved product template (the
 * long ad with download link, tutorial and pricing) is still appropriate.
 * Someone who has installed the app, given a device id, asked about payment, or
 * is an existing customer must never be advertised to again.
 */
function decideTemplate(
  stage: SalesStage,
  signals: ConversationSignals,
  known: ConversationState["known"]
): { shouldSend: boolean; reason: string } {
  if (known.templateAlreadySent) return { shouldSend: false, reason: "template already sent in this conversation" };
  if (known.appInstalled || signals.saysInstalled) return { shouldSend: false, reason: "customer already installed the app" };
  if (known.appDownloaded || signals.saysDownloaded) return { shouldSend: false, reason: "customer already downloaded the app" };
  if (known.hwid || signals.providedHwid || signals.mentionsHwid)
    return { shouldSend: false, reason: "customer is in the device-id/activation flow" };
  if (signals.wantsLicense) return { shouldSend: false, reason: "customer is asking for a licence, not for information" };
  if (signals.claimsPaid) return { shouldSend: false, reason: "customer has already paid" };
  if (known.paymentDetailsSent) return { shouldSend: false, reason: "payment details already shared" };
  if (known.selectedPlan) return { shouldSend: false, reason: "customer already chose a plan" };
  if (signals.needsSupport) return { shouldSend: false, reason: "support request, not a new lead" };
  if (!TEMPLATE_ALLOWED_STAGES.includes(stage))
    return { shouldSend: false, reason: `stage "${stage}" is past the introduction` };

  return { shouldSend: true, reason: `genuine new lead at stage "${stage}"` };
}

/** Builds the explicit "the customer already knows this" list for the prompt. */
function buildDoNotRepeat(known: ConversationState["known"], signals: ConversationSignals): string[] {
  const items: string[] = [];
  if (known.appDownloaded || known.appInstalled) {
    items.push("They already have the app — do NOT send download links or install instructions again unless they ask.");
  }
  if (known.appInstalled) {
    items.push("They already installed it — do NOT explain how to install.");
  }
  if (known.hwid) {
    items.push(`Their Device ID (${known.hwid}) is already received — NEVER ask for it again.`);
  }
  if (known.priceDiscussed) {
    items.push("The price has already been quoted — do NOT re-explain pricing unless they ask again or are negotiating.");
  }
  if (known.templateAlreadySent) {
    items.push("The product intro/advertisement was already sent — do NOT repeat it.");
  }
  if (known.linkAlreadySent) {
    items.push("The download/setup link was already sent — do NOT paste it again unless asked.");
  }
  if (known.selectedPlan) {
    items.push(`They already chose the ${known.selectedPlan} plan — do NOT re-pitch the other plan.`);
  }
  if (known.paymentDetailsSent) {
    items.push("Payment account details were already sent — do NOT resend them unless asked.");
  }
  if (signals.claimsPaid) {
    items.push("They say they paid — do NOT ask them to pay again, and never confirm a payment yourself.");
  }
  return items;
}

export interface InferStateParams {
  latestCustomerText: string;
  recentMessages: ChatMessage[];
  memory?: CustomerMemorySummary;
  /** Tool id being discussed, to check whether its template was already sent. */
  lockedToolId?: string;
}

/**
 * The decision layer. Runs before any text is generated and answers: what do
 * they want, where are they, what do they already know, what comes next, and is
 * the product advertisement still appropriate.
 */
export function inferConversationState(params: InferStateParams): ConversationState {
  const { latestCustomerText, recentMessages, memory, lockedToolId } = params;

  const signals = detectSignals(latestCustomerText);
  const history = recentMessages || [];
  const historical = detectHistoricalFacts(history);

  const agentTurns = history.filter((m) => m.role === "agent");
  const linkAlreadySent = agentTurns.some((m) => /https?:\/\//i.test(m.content || ""));
  const priceDiscussed =
    Boolean(memory?.quotedPrices && Object.keys(memory.quotedPrices).length > 0) ||
    agentTurns.some((m) => /(?:rs\.?\s*\d|pkr\s*\d|\d+\s*(?:rs|pkr))/i.test(m.content || ""));

  const known: ConversationState["known"] = {
    appDownloaded: Boolean(memory?.appDownloaded) || historical.downloaded || signals.saysDownloaded,
    appInstalled: Boolean(memory?.appInstalled) || historical.installed || signals.saysInstalled,
    hwid: memory?.hwid || historical.hwid || signals.providedHwid || null,
    selectedPlan:
      memory?.selectedPlan ||
      (signals.choseLifetime ? "lifetime" : signals.choseMonthly ? "monthly" : null),
    priceDiscussed,
    paymentDetailsSent: Boolean(memory?.paymentDetailsSent),
    templateAlreadySent: Boolean(lockedToolId && (memory?.templatesSent || []).includes(lockedToolId)),
    linkAlreadySent,
    isReturningConversation: history.length > 2 || Boolean(memory?.totalTurnsCount && memory.totalTurnsCount > 1),
  };

  const stage = resolveStage(signals, known, historical.paid);
  const template = decideTemplate(stage, signals, known);

  return {
    stage,
    signals,
    known,
    doNotRepeat: buildDoNotRepeat(known, signals),
    nextAction: NEXT_ACTION_BY_STAGE[stage],
    shouldSendTemplate: template.shouldSend,
    templateDecisionReason: template.reason,
  };
}

/**
 * The memory patch implied by this turn, so facts established in conversation
 * survive into later turns instead of being re-derived (or re-asked).
 */
export function memoryPatchFromState(state: ConversationState): Partial<CustomerMemorySummary> {
  const patch: Partial<CustomerMemorySummary> = { journeyStage: state.stage };
  if (state.known.appDownloaded) patch.appDownloaded = true;
  if (state.known.appInstalled) patch.appInstalled = true;
  if (state.known.hwid) patch.hwid = state.known.hwid;
  if (state.known.selectedPlan) patch.selectedPlan = state.known.selectedPlan;
  return patch;
}
