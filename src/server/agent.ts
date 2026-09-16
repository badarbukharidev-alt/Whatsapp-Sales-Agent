import { askAI } from "./ai.js";
import { customerService, normalizeCustomerStatus, normalizeJid, VALID_CUSTOMER_STATUSES } from "./services/customer-service.js";
import { toolService } from "./services/tool-service.js";
import { synthesizeSalesPrompt } from "./services/prompt-service.js";
import { getSettings } from "./settings.js";
import { sendMessage, sendToolImage } from "./whatsapp.js";
import { Customer, CustomerStatus, SentImageRecord, Tool } from "../types.js";
import { checkAiReplyQuota, recordAiReply, recordUserMessage } from "./usage.js";
import { recordStatedFacts, clampPriceFloors, extractMentionedFacts } from "./tool-matcher.js";
import {
  isBareAffirmation,
  detectPendingOffer,
  collectAllowedUrls,
  flattenMarkdownLinks,
  enforceKnownLinks,
  stripLeadingContinuationFragment,
  stripRepeatedOffer,
  isMetaLeak,
  enforceCatalogPrices,
  enforceKnownPaymentDetails,
  stripRoboticPhrasing,
  stripUnsolicitedSalam,
} from "./services/reply-guard.js";
import {
  getToolPlans,
  formatPlanLines,
  formatPlansForPrompt,
  buildPlanOfferMessage,
  collectAllowedPriceAmounts,
  shortToolName,
} from "./services/pricing-service.js";
import { inferConversationState, memoryPatchFromState } from "./services/conversation-state.js";
import { selectImageForTurn, recordImageSent, describeImageForPrompt } from "./services/image-intelligence.js";

// ---------------------------------------------------------------------------
// Controlled-selling helpers: buying intent, explicit requests, role separation
// ---------------------------------------------------------------------------

/** Strong buying-intent signals (Roman Urdu + English). */
const BUYING_INTENT_REGEX =
  /(?:\b(?:le?na|lena|leni|chahiye|chaiye|chahye)\b|\blink\b|\bprice\b|\brate\b|\bkitne?\b|\bkitna\b|final\s*price|\bpayment\b|jazz\s*cash|jazzcash|easy\s*paisa|easypaisa|\braast\b|account\s*(?:number|details|no)|\bpro\b|start\s*kar|shuru\s*kar|kharid|khareed|purchase|\bbuy\b|sub\s*len|order\s*kar|paise?\s*(?:bhej|send|transfer|kaha))/i;

/** Explicit payment-details request (Roman Urdu + English shorthand). */
const EXPLICIT_PAYMENT_REGEX =
  /(?:payment\s*(?:details|method|info|kaise|karni|kar\s*d|number|account|krni|krna|karna|do|de|bhejo|bhjo|bhej|send|share|hy|hai)?|kaise?\s*pay|kahan?\s*(?:pay|paise|paisay|bhej)|account\s*(?:number|details|title|no|bhejo|bhjo|bhej|do|de|send|share)?\b|\bacc(?:t)?\s*(?:details|number|no|title|bhejo|bhjo|bhej|do|de|send|share)?\b|jazz\s*cash|jazzcash|easy\s*paisa|easypaisa|\braast\b|bank\s*(?:details|account)|\bpay\s*(?:karna|karni|krna|krni|karu|karoon|kru|kro|kese|kaise|do|de|bhejo|bhjo|bhej)\b|pais(?:e|ay)?\s*(?:kaise|kese)\s*(?:du|doon|dun|de|karu|karoon)|\bhow\s*to\s*pay\b|\bwhere\s*to\s*pay\b)/i;

/** Explicit link / download request. */
const EXPLICIT_LINK_REGEX =
  /(?:\blink\b|\blinks\b|download|trial\s*(?:link|de)|website\s*(?:link|do)|\bportal\b)/i;

/** Customer explicitly wants an alternative / comparison to the locked product. */
const ALTERNATIVE_REGEX =
  /(?:alternative|alternate|doosr|dusr|koi\s*aur|kuch\s*aur|compare|comparison|difference|farq|instead\s*of|behtar\s*option|other\s*tool|second\s*option)/i;

/** Customer wants visual proof — screenshot / interface / sample photo. */
const SCREENSHOT_REQUEST_REGEX =
  /(?:screenshot|screen\s*shot|\bpic\b|picture|photo|tasveer|tasvir|dikhao|dikha\s*do|dikhaen|dikha\s*den|proof|sample\s*(?:dikhao|dikha)|interface\s*(?:dikhao|bhejo|dikha)|dashboard\s*(?:dikhao|bhejo)|demo\s*dikhao)/i;

/**
 * Renders a saved product template. By default the message is returned EXACTLY
 * as stored. Only when variables are explicitly enabled are the recognized
 * tokens substituted; a missing value leaves its token untouched.
 */
function renderTemplateMessage(
  tm: { content?: string; variablesEnabled?: boolean },
  tool: Tool
): string {
  const content = tm.content || "";
  if (!tm.variablesEnabled) return content;
  const link = (tool.links && tool.links[0] && tool.links[0].url) || "";
  const values: Record<string, string> = {
    "{tool_name}": tool.name || "",
    "{price_pkr}": tool.pricePkr ? `Rs. ${tool.pricePkr}` : "",
    "{price_usd}": tool.priceUsd ? `$${tool.priceUsd}` : "",
    "{link}": link,
  };
  return content.replace(
    /\{tool_name\}|\{price_pkr\}|\{price_usd\}|\{link\}/g,
    (m) => (values[m] !== undefined && values[m] !== "" ? values[m] : m)
  );
}

/**
 * Renders all dynamic knowledge sections of a tool into a clean, formatted text string
 * for initial tool detection.
 */
function renderDynamicSections(sections: ToolSection[], tool: Tool): string {
  if (!sections || sections.length === 0) return "";
  const parts: string[] = [];
  const genericTitleRegex = /^(?:Constant Dynamic Knowledge Message|Dynamic Section\s*\d*|Section\s*\d*|Knowledge Section\s*\d*)$/i;

  for (const sec of sections) {
    const title = (sec.title || "").trim();
    const content = (sec.content || "").trim();
    const isGenericTitle = genericTitleRegex.test(title);

    if (title && content && !isGenericTitle) {
      if (content.toLowerCase().startsWith(title.toLowerCase())) {
        parts.push(content);
      } else {
        parts.push(`*${title}*\n${content}`);
      }
    } else if (content) {
      parts.push(content);
    } else if (title && !isGenericTitle) {
      parts.push(`*${title}*`);
    }
  }
  let combined = parts.join("\n\n");
  const link = (tool.links && tool.links[0] && tool.links[0].url) || "";
  const values: Record<string, string> = {
    "{tool_name}": tool.name || "",
    "{price_pkr}": tool.pricePkr ? `Rs. ${tool.pricePkr}` : "",
    "{price_usd}": tool.priceUsd ? `$${tool.priceUsd}` : "",
    "{link}": link,
  };
  return combined.replace(
    /\{tool_name\}|\{price_pkr\}|\{price_usd\}|\{link\}/g,
    (m) => (values[m] !== undefined && values[m] !== "" ? values[m] : m)
  );
}

/** Matches a "Rs. 1200" / "1200 Pkr" / "$6" style price mention with its own label line. */
const PRICE_MENTION_REGEX =
  /(?:^|\n)[^\n]{0,40}?(?:rs\.?\s?[\d,]+|[\d,]+\s?(?:rs|pkr|rupees)|\$\s?[\d,]+)[^\n]{0,20}/gi;

/**
 * Pulls the price line(s) out of a saved template message so they can be recorded
 * as "already quoted" for this customer. A template is admin-authored and sent
 * verbatim, so whatever price it states becomes the price the AI must stay
 * consistent with afterwards — even if it differs from the tool's base `pricePkr`
 * (e.g. a promo/lifetime rate). Without this, the agent can contradict its own
 * template a message later when the customer simply asks "price kya hai".
 */
function extractQuotedPriceSummary(templateContent: string): string {
  const matches = templateContent.match(PRICE_MENTION_REGEX) || [];
  const cleaned = matches
    .map((m) => m.replace(/[^\S\r\n]+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4);
  return cleaned.join(" | ").slice(0, 200);
}

/**
 * Turns a stored image reference (an on-disk path like
 * "data/tool-images/x.png", or an already-public "/tool-images/x.png") into the
 * URL the admin dashboard can actually render. `/tool-images` is served
 * statically by the server, so only the filename matters.
 */
export function toPublicImageUrl(imageRef: string | null | undefined): string | undefined {
  const raw = (imageRef || "").trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  const filename = raw.replace(/\\/g, "/").split("/").filter(Boolean).pop();
  return filename ? `/tool-images/${filename}` : undefined;
}

/**
 * Records that an image was actually delivered, so cooldown and per-conversation
 * caps hold across turns. Kept tolerant: a failure here must never stop a reply.
 */
async function persistImageSend(
  cleanJid: string,
  memory: { imagesSent?: SentImageRecord[] },
  imageId: string,
  toolId: string | undefined,
  userId: string
): Promise<void> {
  try {
    const imagesSent = recordImageSent(memory.imagesSent, imageId, toolId);
    memory.imagesSent = imagesSent;
    await customerService.updateCustomerMemory(cleanJid, { imagesSent }, userId);
  } catch (err) {
    console.error(`[Agent:${userId}] Could not record image send:`, err);
  }
}

/**
 * Strips any fabricated customer/user turns and role prefixes so the model can
 * never speak AS the customer. Keeps only the assistant's own words.
 */
function stripFabricatedCustomerTurns(raw: string): string {
  if (!raw) return raw;
  const lines = raw.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^\s*(?:customer|user|client|grahak|buyer|cust)\s*[:\-]/i.test(line)) continue;
    kept.push(line.replace(/^\s*(?:agent|you|assistant|bot|salesperson|seller|reply)\s*[:\-]\s*/i, ""));
  }
  return kept.join("\n").trim();
}

/**
 * Converts markdown-style links [text](url) to plain URLs, repairs corrupted/mangled
 * URLs (e.g. concatenated or truncated Google Docs links from fallback AI), and strips
 * URLs entirely when templateJustSent is true to avoid redundant link duplication.
 */
function cleanAndFixUrls(text: string, templateJustSent = false): string {
  if (!text) return text;

  // Step 1: If template was JUST sent in this turn, strip ALL URLs from the AI follow-up
  // to avoid redundant/broken link duplication right after the template.
  if (templateJustSent) {
    let noUrls = text
      .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '')
      .replace(/https?:\/\/[^\s)]+/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // Clean up empty lead-in phrases like "Aap is link se app download karke setup guide check kar sakte hain:"
    noUrls = noUrls.replace(/(?:Aap\s+)?is\s+link\s+se\s+app\s+download[^\.]*[\.:]?/gi, '').trim();
    return noUrls;
  }

  // Step 2: Extract/repair markdown links [label](url)
  // If label itself starts with http, replace the whole [label](url) with just url
  let result = text.replace(
    /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, _label, url) => url.trim()
  );

  // Catch remaining markdown links
  result = result.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_m, _label, target) => {
    if (target.startsWith("http")) return target.trim();
    return _label.trim();
  });

  // Step 3: FIX CORRUPTED GOOGLE DOCS URLS FOR CLIPSHIELD
  // Replaces any mangled, partial, or duplicated Google Docs / 1Y4dAxV URL fragments
  // with the exact clean official link.
  const clipShieldRealUrl = "https://docs.google.com/document/d/1Y4dAxV-JO_scOKUW_2gXk5Mv4c59nQQvOBETKpCALF0/edit?usp=sharing";
  if (/(?:docs\.google\.com|1Y4dAxV)/i.test(result)) {
    result = result.replace(/(?:https?:\/\/[^\s)]*?)?(?:docs\.google\.com|1Y4dAxV)[^\s)]*/gi, clipShieldRealUrl);
    // Deduplicate if replaced multiple times back to back
    const escapedUrl = clipShieldRealUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexDup = new RegExp(`(?:${escapedUrl}\\s*)+`, 'g');
    result = result.replace(regexDup, clipShieldRealUrl);
  }

  // Step 4: FIX VOICE DELTA URLS IF MANGLED
  const voiceDeltaRealUrl = "https://voicedelta.ai";
  if (/voicedelta\.ai/i.test(result)) {
    result = result.replace(/(?:https?:\/\/[^\s)]*?)?voicedelta\.ai[^\s)]*/gi, voiceDeltaRealUrl);
  }

  // Step 5: Clean trailing stray parentheses after URLs (e.g. "https://...sharing)")
  result = result.replace(/(https?:\/\/[^\s)]+)\)/g, '$1');
  // Remove backtick wrapping
  result = result.replace(/`([^`]+)`/g, '$1');

  return result;
}

/**
 * Detects if an AI reply is predominantly English (hallucination from fallback AI).
 */
function isEnglishHallucination(text: string): boolean {
  if (!text || text.length < 30) return false;
  // Common Roman Urdu words that signal authentic reply
  const urduSignals = /\b(bhai|aap|hai|hain|kar|karo|karein|ke|liye|se|mein|ko|ne|nahi|ho|tha|thi|gy|ga|gi|gea|gya|gyi|hun|hoon|abhi|yeh|woh|toh|tab|kab|phir|aur|ya|lekin|magar|agar|chunke|kyun|kyunke|bilkul|zaroor|theek|sahi|accha|bolta|bolen|bhejo|bhejun|batao|bataen|paise|rupees|pkr|rs|month|mahina|subscription|tool|link|download|setup|payment|jazzcash|easypaisa)\b/i;
  if (urduSignals.test(text)) return false; // Has Urdu signals — keep it

  // English-only business phrases that indicate full English reply
  const englishHallucination = /\b(the order is|your account|has been activated|please find|kindly note|dear customer|we are pleased|thank you for|your request|has been processed|attached herewith|your subscription|license key|activation code|credentials|registered under|quick-start|next steps|setup assistance)\b/i;
  return englishHallucination.test(text);
}

interface QueuedIncomingMessage {
  seq: number;
  text: string;
  name?: string;
  timestamp: number;
}

interface CustomerQueueState {
  phoneNumber: string;
  userId?: string;
  name?: string;
  pendingMessages: QueuedIncomingMessage[];
  debounceTimer: NodeJS.Timeout | null;
  isProcessing: boolean;
}

// Per-customer message queues to preserve strict order & handle rapid bursts
const customerQueues = new Map<string, CustomerQueueState>();
let globalSequenceCounter = 100;

export function startAgent() {
  console.log("[Agent] Persistent Multi-Tenant WhatsApp Sales Closer Engine initialized.");
}

/**
 * Enqueues an incoming customer message with sequence numbering and burst debouncing.
 */
export async function queueMessage(phoneNumber: string, message: string, name?: string, userId?: string) {
  if (
    phoneNumber.includes("@newsletter") ||
    phoneNumber.includes("@broadcast") ||
    phoneNumber.includes("status@broadcast")
  ) {
    return;
  }

  const cleanJid = normalizeJid(phoneNumber);
  const seq = ++globalSequenceCounter;
  const queueKey = `${userId || 'default'}:${cleanJid}`;

  let state = customerQueues.get(queueKey);
  if (!state) {
    state = {
      phoneNumber: cleanJid,
      userId,
      name,
      pendingMessages: [],
      debounceTimer: null,
      isProcessing: false,
    };
    customerQueues.set(queueKey, state);
  }
  if (name) state.name = name;
  if (userId) state.userId = userId;

  state.pendingMessages.push({
    seq,
    text: message.trim(),
    name,
    timestamp: Date.now(),
  });

  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
  }

  state.debounceTimer = setTimeout(() => {
    if (state) {
      state.debounceTimer = null;
      triggerCustomerProcessing(queueKey);
    }
  }, 1350);
}

/**
 * Processes incoming message batches in strict sequence order.
 */
async function triggerCustomerProcessing(queueKey: string) {
  const state = customerQueues.get(queueKey);
  if (!state || state.isProcessing || state.pendingMessages.length === 0) {
    return;
  }

  state.isProcessing = true;
  const batch = [...state.pendingMessages];
  state.pendingMessages = [];

  try {
    await handleCustomerMessageBatch(state.phoneNumber, batch, state.name, state.userId);
  } catch (error) {
    console.error(`[Agent] Error processing customer ${state.phoneNumber}:`, error);
  } finally {
    state.isProcessing = false;
    if (state.pendingMessages.length > 0) {
      triggerCustomerProcessing(queueKey);
    }
  }
}

/**
 * Core batch handler: saves memory, builds retrieval-based prompt,
 * generates response, and dispatches split messages.
 */
async function handleCustomerMessageBatch(
  phoneNumber: string,
  batch: QueuedIncomingMessage[],
  name?: string,
  userId = "usr_admin_badar"
) {
  const cleanJid = normalizeJid(phoneNumber);
  const settings = await getSettings(userId);
  if (!settings.aiAgentEnabled) {
    console.log(`[Agent:${userId}] AI Agent is disabled in settings. Skipping reply to ${cleanJid}.`);
    return;
  }

  // Combine batch messages preserving chronological order
  const combinedUserText = batch.map((m) => m.text).filter(Boolean).join("\n");
  if (!combinedUserText) return;

  console.log(`[Agent:${userId}] Processing incoming batch (${batch.length} msg(s)) for ${cleanJid}:\n"${combinedUserText}"`);

  // 1. Save customer message immediately to permanent memory
  await customerService.saveMessage(cleanJid, "user", combinedUserText, userId, { nameHint: name });
  await recordUserMessage();

  // 2. Check persistent monthly AI reply quota
  const quota = await checkAiReplyQuota();
  if (!quota.allowed) {
    console.log(`[Agent:${userId}] Monthly AI reply quota reached (${quota.usedThisMonth}/${quota.limit}). Skipping reply to ${cleanJid}.`);
    return;
  }

  // 3. Generate retrieval-based AI response
  const response = await generateResponse(cleanJid, combinedUserText, name, batch, userId);
  if (!response || (response.textMessages.length === 0 && !response.imageToSend && !response.templateMessage)) {
    return;
  }

  // 4. Send response: saved product template FIRST (exactly as stored), then AI messages.
  const delaySec = settings.responseDelaySeconds || 1.4;
  await sendResponse(cleanJid, response.textMessages, response.imageToSend, delaySec, userId, response.templateMessage, response.imageCaption);

  // 5. Save agent reply immediately to permanent memory (template included for history).
  // A delivered image is stored as a real imageUrl so the admin chat view renders
  // the actual picture instead of a literal "[Sent Image: data/...]" line.
  const replyParts: string[] = [];
  if (response.templateMessage) replyParts.push(response.templateMessage);
  replyParts.push(...response.textMessages);
  await customerService.saveMessage(cleanJid, "agent", replyParts.join("\n\n"), userId, {
    imageUrl: toPublicImageUrl(response.imageToSend),
  });
  await recordAiReply();
}

/**
 * Generates AI response using structured customer memory, dynamic tool retrieval, and compact prompt synthesis.
 */
async function generateResponse(
  cleanJid: string,
  latestCustomerText: string,
  name?: string,
  batch?: QueuedIncomingMessage[],
  userId = "usr_admin_badar"
): Promise<{ textMessages: string[]; imageToSend: string | null; imageCaption?: string; templateMessage: string | null }> {
  const settings = await getSettings(userId);

  // 1. Load permanent customer record BEFORE generating reply
  const customer = await customerService.getCustomerByJid(cleanJid, userId, name);
  const recentMessages = await customerService.getConversationHistory(cleanJid, userId, 8);

  // 2. Dynamic Tool Retrieval for this specific account with dialogue context
  const accountTools = await toolService.getAccountTools(userId);
  const catalogSummary = await toolService.getAccountToolSummary(userId);

  // Pass recent dialogue history (both customer and agent turns) so context is preserved
  const recentDialogue = recentMessages
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`);

  let match = await toolService.searchRelevantTools(latestCustomerText, userId, recentDialogue);

  // Did THIS message explicitly identify a product (direct name / alias / keyword /
  // semantic), as opposed to a short follow-up resolved purely from history?
  const directDetail = (match.matchedDetails || []).find(
    (d) =>
      d.matchedToken !== "active-conversation-context" &&
      !String(d.matchedToken).startsWith("history:")
  );
  const directlyDetectedTool: Tool | null =
    (directDetail && match.matched.find((t) => t.id === directDetail.toolId)) || null;

  const memory = customer.memorySummary || {};
  const prevProductId = memory.currentProductId;
  const prevProduct = prevProductId ? accountTools.find((t) => t.id === prevProductId) : undefined;
  const wantsAlternative = ALTERNATIVE_REGEX.test(latestCustomerText);

  // 3. PRODUCT CONTEXT LOCK — the conversation stays on ONE product.
  //    Another product is only surfaced when the customer explicitly names it,
  //    asks for an alternative/comparison, or the current one cannot satisfy.
  let lockedTool: Tool | null = null;
  if (match.isUnknownProduct) {
    // Customer explicitly asked for an uncataloged product: keep unknown flow, don't lock.
    lockedTool = null;
  } else if (directlyDetectedTool) {
    // Customer explicitly named a catalog product this turn -> (re)lock to it.
    lockedTool = directlyDetectedTool;
  } else if (prevProduct) {
    // No new explicit product; stay locked to the current product (follow-up continuity).
    lockedTool = prevProduct;
  } else if (match.matched.length > 0) {
    // First contextual match with no prior lock.
    lockedTool = match.matched[0];
  } else {
    // Fallback: continuity from last-discussed tool for short follow-ups.
    const activeToolName = memory.lastToolDiscussed;
    if (activeToolName) {
      lockedTool =
        accountTools.find(
          (t) =>
            t.name.toLowerCase().includes(activeToolName.toLowerCase()) ||
            activeToolName.toLowerCase().includes(t.name.toLowerCase())
        ) || null;
    }
  }

  // Enforce single-product context: never mix product data across products.
  if (lockedTool) {
    match = {
      matched: [lockedTool],
      confidence: match.matched.some((t) => t.id === lockedTool!.id) ? match.confidence : "alias",
      isUnknownProduct: false,
      queryProduct: undefined,
      matchedDetails: [
        {
          toolId: lockedTool.id,
          toolName: lockedTool.name,
          matchedOn: directlyDetectedTool ? (directDetail!.matchedOn as any) : "alias",
          matchedToken: directlyDetectedTool ? directDetail!.matchedToken : "current-product-lock",
        },
      ],
    };
  }

  // 3b. DECISION LAYER — work out where this customer actually is before a
  // single word is generated: what they already have, what they're asking for,
  // and therefore what must NOT be repeated to them.
  const convoState = inferConversationState({
    latestCustomerText,
    recentMessages,
    memory,
    lockedToolId: lockedTool?.id,
  });
  console.log(
    `[Agent:${userId}] State for ${cleanJid}: stage="${convoState.stage}" ` +
      `installed=${convoState.known.appInstalled} hwid=${convoState.known.hwid || "none"} ` +
      `plan=${convoState.known.selectedPlan || "none"} | template: ${convoState.templateDecisionReason}`
  );

  // 4. SAVED PRODUCT TEMPLATE & DYNAMIC SECTIONS MESSAGE — sent FIRST, exactly once,
  // when a tool is detected for the first time for a customer.
  let templateMessage: string | null = null;
  const templatesSent = [...(memory.templatesSent || [])];
  const quotedPrices: Record<string, string> = { ...(memory.quotedPrices || {}) };
  if (lockedTool && directlyDetectedTool && directlyDetectedTool.id === lockedTool.id && convoState.shouldSendTemplate) {
    const alreadySent = templatesSent.includes(lockedTool.id);
    if (!alreadySent) {
      const tm = lockedTool.templateMessage;
      let primaryMessage = "";
      if (tm?.enabled && (tm.content || "").trim().length > 0) {
        primaryMessage = renderTemplateMessage(tm, lockedTool);
      }

      // Automatically include all dynamic knowledge sections when tool is detected for the first time
      const hasSections = lockedTool.sections && lockedTool.sections.length > 0;
      if (hasSections) {
        const sectionsText = renderDynamicSections(lockedTool.sections!, lockedTool);
        if (sectionsText.trim().length > 0) {
          if (primaryMessage.trim().length > 0) {
            const normPrimary = primaryMessage.replace(/[\s\W]+/g, "").toLowerCase();
            const normSections = sectionsText.replace(/[\s\W]+/g, "").toLowerCase();
            if (!normPrimary.includes(normSections.slice(0, 40)) && !normSections.includes(normPrimary.slice(0, 40))) {
              primaryMessage = primaryMessage + "\n\n" + sectionsText;
            }
          } else {
            primaryMessage = sectionsText;
          }
        }
      }

      if (primaryMessage.trim().length > 0) {
        templateMessage = primaryMessage;
        if (!templatesSent.includes(lockedTool.id)) templatesSent.push(lockedTool.id);
        const quoted = extractQuotedPriceSummary(templateMessage);
        if (quoted) quotedPrices[lockedTool.name] = quoted;
      }
    }
  }

  // 5. Persist product-lock, template state and everything we learned about the
  // customer this turn, so later turns never re-ask or re-explain it.
  const journeyPatch = memoryPatchFromState(convoState);
  if (lockedTool) {
    await customerService.updateCustomerMemory(
      cleanJid,
      {
        currentProductId: lockedTool.id,
        currentProductName: lockedTool.name,
        lastToolDiscussed: lockedTool.name,
        templatesSent,
        quotedPrices,
        ...journeyPatch,
      },
      userId
    );
  } else if (Object.keys(journeyPatch).length > 0) {
    await customerService.updateCustomerMemory(cleanJid, journeyPatch, userId);
  }

  // 6. Buying-intent & explicit-request detection.
  const buyingIntent = BUYING_INTENT_REGEX.test(latestCustomerText);
  const explicitPaymentRequest = EXPLICIT_PAYMENT_REGEX.test(latestCustomerText);
  const explicitLinkRequest = EXPLICIT_LINK_REGEX.test(latestCustomerText);

  // 7. Negotiation consistency guard.
  const agentRecentlyClaimedFixed = recentMessages
    .filter((m) => m.role === "agent")
    .slice(-2)
    .some((m) => /(?:fixed|kam nahi|rate final|final price|discount nahi)/i.test(m.content));

  // ── HARDCODED PAYMENT BYPASS ─────────────────────────────────────────────
  // When the customer explicitly asks for payment/account details, skip the AI
  // entirely and send ONLY the real configured payment accounts. This guarantees
  // the agent NEVER fabricates account numbers (XXXX-XXXXXX, etc.).
  if (explicitPaymentRequest) {
    const activePayments = (settings.paymentMethods || []).filter((p: any) => p.isActive !== false);
    if (activePayments.length > 0) {
      const productLine = lockedTool ? `Rs. ${lockedTool.pricePkr || "1500"}/month ke liye payment karein:` : "Payment karein:";
      const lines = [productLine];
      for (const p of activePayments) {
        lines.push(`\n📱 *${p.provider}*\nAccount: ${p.accountNumber}\nTitle: ${p.accountTitle}${p.instructions ? `\n(${p.instructions})` : ""}`);
      }
      // Only ask for the Device ID if we don't already have it.
      lines.push(
        convoState.known.hwid
          ? "\nPayment ke baad bas screenshot bhej dein — Device ID mere paas already hai, main activate kar deta hoon. ✅"
          : "\nPayment ke baad screenshot + apna email / Hardware ID yahan share karein. Main activate kar deta hoon. ✅"
      );
      const paymentReply = lines.join("\n");
      await customerService.updateCustomerMemory(cleanJid, { paymentDetailsSent: true }, userId);
      await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, null, userId, buyingIntent);
      return {
        textMessages: [paymentReply],
        imageToSend: null,
        templateMessage,
      };
    }
    // No payment method is configured/active at all: answer honestly instead of
    // falling through to the AI, which — given no real numbers to work with —
    // is exactly what produces a fabricated "example" account.
    await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, null, userId, buyingIntent);
    return {
      textMessages: ["Payment details abhi finalize kar raha hoon, thodi hi dair mein bhejta hoon aapko. 🙏"],
      imageToSend: null,
      templateMessage,
    };
  }
  // ── END HARDCODED PAYMENT BYPASS ─────────────────────────────────────────

  // ── DETERMINISTIC PLAN LISTING ──────────────────────────────────────────
  // The moment someone wants to buy or activate, they get the ACTUAL plan table
  // from the catalog — all of it, in one message. The AI is never asked to
  // recall a price, and the agent never asks "which plan?" before the customer
  // has been shown what the plans even are.
  const toolPlans = lockedTool ? getToolPlans(lockedTool) : [];
  const lastAgentMessage = [...recentMessages].reverse().find((m) => m.role === "agent")?.content || "";
  const plansJustListed = toolPlans.length > 0 && toolPlans.every((p) => lastAgentMessage.includes(String(p.pricePkr ?? "")));

  const wantsToBuyOrActivate =
    convoState.signals.providedHwid !== null ||
    convoState.signals.wantsLicense ||
    convoState.signals.asksPrice ||
    convoState.signals.comparesPlans ||
    ["hwid_provided", "awaiting_license", "activation", "price_inquiry", "comparing_plans", "ready_to_buy"].includes(
      convoState.stage
    );

  if (
    lockedTool &&
    wantsToBuyOrActivate &&
    !convoState.known.selectedPlan &&
    !plansJustListed &&
    !templateMessage
  ) {
    if (toolPlans.length > 0) {
      const offer = buildPlanOfferMessage({
        tool: lockedTool,
        plans: toolPlans,
        gotHwid: Boolean(convoState.signals.providedHwid),
        variantSeed: customer.messages?.length || 0,
      });

      await customerService.updateCustomerMemory(
        cleanJid,
        { quotedPrices: { ...quotedPrices, [lockedTool.name]: formatPlanLines(toolPlans).replace(/\n/g, " | ") } },
        userId
      );
      await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, null, userId, buyingIntent);
      return { textMessages: [offer], imageToSend: null, templateMessage };
    }

    // No price configured at all — say so plainly instead of inventing one.
    console.warn(`[Agent:${userId}] No pricing configured for "${lockedTool.name}" — cannot quote.`);
    await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, null, userId, buyingIntent);
    return {
      textMessages: [
        `${shortToolName(lockedTool)} ka updated rate abhi confirm kar ke bhejta hoon — thori dair dein.`,
      ],
      imageToSend: null,
      templateMessage,
    };
  }
  // ── END DETERMINISTIC PLAN LISTING ──────────────────────────────────────

  // ── DETERMINISTIC LINK DELIVERY ─────────────────────────────────────────
  // The customer explicitly asked for the link, OR they just said "G / haan /
  // bhejo" right after WE offered to send it. Either way there is nothing left
  // to decide: send the real configured link once, with a one-line guide, and
  // skip the AI. This is what stops the "aap kahen toh main bhej doon?" loop
  // and guarantees the URL is never a hallucinated placeholder.
  const lastAgentText = [...recentMessages].reverse().find((m) => m.role === "agent")?.content || null;
  const affirmedPendingLink =
    isBareAffirmation(latestCustomerText) && detectPendingOffer(lastAgentText) === "link";
  const primaryLink = lockedTool?.links?.find((l) => (l?.url || "").trim())?.url?.trim() || "";

  if (
    (explicitLinkRequest || affirmedPendingLink) &&
    lockedTool &&
    primaryLink &&
    !templateMessage // a template was NOT sent this turn (it already carries the link)
  ) {
    const guide = lockedTool.name.toLowerCase().includes("clip")
      ? "Yahan se app download kar ke setup guide follow karein. Pehla video free test kar sakte hain."
      : "Yahan se account bana ke ek sample free generate kar ke dekh lein.";
    await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, null, userId, buyingIntent);
    return {
      textMessages: [`Ye raha ${lockedTool.name} ka link:\n${primaryLink}`, guide],
      imageToSend: null,
      templateMessage,
    };
  }
  // ── END DETERMINISTIC LINK DELIVERY ─────────────────────────────────────

  // ── VISUAL PROOF INTELLIGENCE ───────────────────────────────────────────
  // Images are sales evidence, not keyword triggers. The selector weighs what
  // the customer said, what situation they're in (skeptical / asking about
  // results / hunting for the Device ID), and what each image says it is FOR —
  // then enforces cooldowns and per-conversation caps so proof never turns
  // into spam. It returns nothing at all when a picture wouldn't genuinely help.
  const toolImages = (lockedTool?.images || []).filter((img) => img?.filepath || img?.url);
  const wantsScreenshot = SCREENSHOT_REQUEST_REGEX.test(latestCustomerText);
  const imageSelection = selectImageForTurn({
    images: toolImages,
    state: convoState,
    customerText: latestCustomerText,
    sentHistory: memory.imagesSent,
    explicitRequest: wantsScreenshot,
  });

  if (lockedTool && toolImages.length > 0) {
    console.log(
      `[Agent:${userId}] Visual proof for ${cleanJid}: uploaded=${toolImages.length} explicitRequest=${wantsScreenshot} ` +
        `chosen=${imageSelection ? `"${imageSelection.image.id}" (score ${imageSelection.score}: ${imageSelection.reason})` : "none"}`
    );
  }

  // (a) Plain "show me" request — nothing to reason about, send the picture.
  if (wantsScreenshot && lockedTool && imageSelection) {
    const chosen = imageSelection.image;
    const label = (chosen.title || "").trim();
    await persistImageSend(cleanJid, memory, chosen.id, lockedTool.id, userId);
    await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, null, userId, buyingIntent);
    return {
      textMessages: [label ? `Han bhai, ye dekho 👇\n${label}` : `Han bhai, ye dekho ${lockedTool.name} ka interface 👇`],
      imageToSend: chosen.filepath || chosen.url,
      templateMessage,
    };
  }

  // (b) The image would strengthen an answer the customer actually wants in
  // words — trust doubts, results questions, "where is my Device ID". Let the
  // AI explain, and attach the proof to that same reply.
  const autoAttachSelection = !wantsScreenshot ? imageSelection : null;
  const autoAttachImage = autoAttachSelection
    ? autoAttachSelection.image.filepath || autoAttachSelection.image.url
    : null;
  const autoAttachImageBriefing = autoAttachSelection ? describeImageForPrompt(autoAttachSelection) : "";
  // ── END DETERMINISTIC IMAGE DELIVERY ────────────────────────────────────

  // 8. Synthesize lean, controlled sales prompt (ONLY the locked product's data).
  const { prompt, systemPrompt } = synthesizeSalesPrompt({
    customer,
    matchedTools: match.matched,
    allAccountToolsSummary: catalogSummary,
    recentMessages,
    latestCustomerText,
    settings,
    isUnknownProduct: match.isUnknownProduct,
    queryProduct: match.queryProduct,
    agentRecentlyClaimedFixed,
    lockedProductName: lockedTool?.name,
    buyingIntent,
    explicitPaymentRequest,
    explicitLinkRequest,
    templateJustSent: Boolean(templateMessage),
    wantsAlternative,
    autoImageAttached: autoAttachImage ? autoAttachImageBriefing : undefined,
    journeyStage: convoState.stage,
    nextAction: convoState.nextAction,
    doNotRepeat: convoState.doNotRepeat,
    pricingBlock: lockedTool ? formatPlansForPrompt(lockedTool, toolPlans) : undefined,
    recentAgentLines: recentMessages
      .filter((m) => m.role === "agent")
      .slice(-3)
      .map((m) => m.content),
  });

  console.log(`[Agent:${userId}] Querying AI for ${cleanJid} (Locked: ${lockedTool?.name || (match.isUnknownProduct ? `Unknown:${match.queryProduct}` : 'CatalogOverview')}${buyingIntent ? ' | HighIntent' : ''}${templateMessage ? ' | TemplateFirst' : ''})...`);
  const rawReply = await askAI(prompt, systemPrompt, userId);

  // 5. Extract status tags e.g. [SET_STATUS: <StatusName>]
  let extractedAiStatus: string | null = null;
  let text = rawReply;
  const statusTagMatch = text.match(/\[(?:SET_STATUS|STATUS):\s*([^\]]+)\]/i);
  if (statusTagMatch) {
    extractedAiStatus = statusTagMatch[1].trim();
    text = text.replace(statusTagMatch[0], "").trim();
  }

  // 6. Extract image tags e.g. [SEND_IMAGE: <id>] — resolved against the
  // locked tool's real uploaded images so the model can only ever reference
  // an image that actually exists (an id it invents simply resolves to
  // nothing and no image is sent, rather than trying to read an arbitrary
  // fabricated file path off disk).
  // 6. Extract image tags e.g. [SEND_IMAGE: <id_or_url>] — resolved against the
  // locked tool's real uploaded images OR dynamic section images with captions.
  let imageToSend: string | null = null;
  let imageCaption: string | undefined = undefined;
  const imageTagMatch = text.match(/\[(?:SEND_IMAGE|ATTACH_IMAGE):\s*([^\]]+)\]/i);
  if (imageTagMatch) {
    const ref = imageTagMatch[1].trim().replace(/^["']|["']$/g, "");
    const matchedImage = lockedTool?.images?.find((img) => img.id === ref || img.filename === ref || img.filepath === ref || img.url === ref);
    const matchedSection = lockedTool?.sections?.find((sec) => sec.imageUrl && (sec.imageUrl === ref || sec.imageUrl.includes(ref)));

    if (matchedImage) {
      imageToSend = matchedImage.filepath || matchedImage.url;
      imageCaption = matchedImage.description || matchedImage.title;
    } else if (matchedSection && matchedSection.imageUrl) {
      imageToSend = matchedSection.imageUrl;
      imageCaption = matchedSection.imageCaption || matchedSection.title;
    } else if (ref.startsWith("data/tool-images/") || ref.startsWith("/tool-images/") || ref.includes(".")) {
      imageToSend = ref;
    }
    text = text.replace(imageTagMatch[0], "").trim();
  }

  // The situation warranted visual proof: attach it even though the model
  // didn't ask for it (it usually won't, especially on the fallback model).
  if (!imageToSend && autoAttachImage) {
    imageToSend = autoAttachImage;
  }

  // If a first-time template with dynamic sections was sent and no image was chosen yet,
  // automatically attach the image from the first section that has one.
  if (!imageToSend && templateMessage && lockedTool?.sections) {
    const secWithImg = lockedTool.sections.find((s) => s.imageUrl && s.imageUrl.trim().length > 0);
    if (secWithImg) {
      imageToSend = secWithImg.imageUrl!;
      imageCaption = secWithImg.imageCaption || secWithImg.title || undefined;
    }
  }

  if (imageToSend && !imageCaption && lockedTool?.sections) {
    const matchedSec = lockedTool.sections.find((sec) => sec.imageUrl && (sec.imageUrl === imageToSend || imageToSend.includes(sec.imageUrl)));
    if (matchedSec?.imageCaption) {
      imageCaption = matchedSec.imageCaption;
    }
  }

  // Record whatever actually goes out, so cooldown/anti-repeat works next turn.
  if (imageToSend) {
    const sentImage =
      autoAttachSelection?.image || lockedTool?.images?.find((img) => (img.filepath || img.url) === imageToSend);
    if (sentImage) await persistImageSend(cleanJid, memory, sentImage.id, lockedTool?.id, userId);
  }

  // 7. Evaluate & apply customer status transition (buying intent nudges Interested)
  await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, extractedAiStatus, userId, buyingIntent);

  // STRICT ROLE SEPARATION: remove any fabricated customer turns / role prefixes,
  // so the model can never output messages as if it were the customer.
  text = stripFabricatedCustomerTurns(text)
    .replace(/^["']|["']$/g, "")
    .trim();

  // Shared, in-character fallback used whenever the AI reply must be discarded
  // (English hallucination, or the model breaking character / leaking meta-text).
  // Prefers whatever price was ALREADY quoted to this customer (template or prior
  // turn) so the safe fallback never re-introduces the very contradiction bug
  // this guard exists to prevent.
  const buildSafeFallbackReply = (): string => {
    if (templateMessage) {
      return "Aap pehle test kar lein, jab satisfied hon toh batayega payment details share kar doonga.";
    }
    if (lockedTool) {
      const alreadyQuoted = quotedPrices[lockedTool.name];
      const priceLine = alreadyQuoted
        ? `${lockedTool.name} ka price ${alreadyQuoted} hai`
        : `${lockedTool.name} ka monthly price Rs. ${lockedTool.pricePkr || 1500} hai`;
      return `${priceLine}. Bataen aage kaise proceed karna hai, main abhi link aur details bhej deta hoon.`;
    }
    return "Walaikum Assalam bhai! Kaise hain aap? Bataen konsa software ya tool dekh rahe hain aap?";
  };

  // ENGLISH HALLUCINATION INTERCEPTOR:
  if (isEnglishHallucination(text)) {
    console.log(`[Agent:${userId}] Intercepted English AI hallucination ("${text.slice(0, 40)}..."). Replacing with Roman Urdu response.`);
    text = buildSafeFallbackReply();
  }

  // META-LEAK INTERCEPTOR: the model broke character and talked about the prompt
  // itself ("Got it — no reset, no repeated name. Ready for the next message.
  // What did he say?") instead of answering as the seller.
  if (isMetaLeak(text)) {
    console.log(`[Agent:${userId}] Intercepted meta-leak AI reply ("${text.slice(0, 60)}..."). Replacing with in-character response.`);
    text = buildSafeFallbackReply();
  }

  // CLEAN & FIX URLS: Repair mangled links, convert markdown links to plain URLs, and strip URLs if template was sent
  text = cleanAndFixUrls(text, Boolean(templateMessage));

  // REPLY GUARDS (product-agnostic, applied to every reply):
  //  - flatten any [text](url) markdown WhatsApp cannot render
  //  - rewrite any invented / placeholder / truncated URL to a real configured one
  //  - drop a leading half-sentence (the tell-tale sign of a prompt cut mid-line)
  //  - if the customer already accepted our offer, don't ask the same question again
  if (!templateMessage) {
    const allowedUrls = collectAllowedUrls(
      lockedTool ? [lockedTool, ...accountTools.filter((t) => t.id !== lockedTool!.id)] : accountTools
    );
    text = flattenMarkdownLinks(text);
    text = enforceKnownLinks(text, allowedUrls).text;
  }
  text = stripLeadingContinuationFragment(text);
  text = stripRepeatedOffer(text, lastAgentText);
  text = stripUnsolicitedSalam(text, latestCustomerText);

  // If template was sent and AI reply became empty or trivial after URL stripping, provide clean short follow-up
  if (templateMessage && (!text || text.length < 5)) {
    text = "Aap pehle test kar lein, jab satisfied hon toh batayega payment details share kar doonga.";
  }

  // 8. Track stated facts for anti-repetition
  if (match.matched.length > 0) {
    for (const tool of match.matched) {
      const newlyStated = extractMentionedFacts(text, tool);
      if (newlyStated.length > 0) {
        recordStatedFacts(customer, tool.id, newlyStated);
      }
    }
  }

  // 9. Clamp price floors in code to guarantee non-negotiable floor holds
  text = clampPriceFloors(text, match.matched.length > 0 ? match.matched : accountTools);

  // 9b. PRICE INTEGRITY — delete any figure the model produced that the catalog
  // does not actually contain, so a hallucinated rate can never reach a customer.
  if (lockedTool) {
    const allowedAmounts = collectAllowedPriceAmounts(lockedTool, toolPlans);
    const priceCheck = enforceCatalogPrices(text, allowedAmounts);
    if (priceCheck.removed.length > 0) {
      console.warn(
        `[Agent:${userId}] Removed price(s) not in the catalog: ${priceCheck.removed.join(", ")} (allowed: ${allowedAmounts.join(", ")})`
      );
      text = priceCheck.text;
      // If stripping the invented price emptied the reply, fall back to the real
      // plan table rather than sending nothing.
      if (text.trim().length < 5 && toolPlans.length > 0) {
        text = `${shortToolName(lockedTool)} ke rates ye hain:\n${formatPlanLines(toolPlans)}`;
      }
    }
  }

  // 9b-ii. PAYMENT INTEGRITY — an account number the admin never configured is
  // a fabrication the customer would send real money to. Remove it.
  {
    const configuredAccounts = (settings.paymentMethods || [])
      .filter((p: any) => p.isActive !== false)
      .map((p: any) => String(p.accountNumber || ""));
    const paymentCheck = enforceKnownPaymentDetails(text, configuredAccounts);
    if (paymentCheck.removed.length > 0) {
      console.warn(
        `[Agent:${userId}] Removed unconfigured payment identifier(s): ${paymentCheck.removed.join(", ")}`
      );
      text = paymentCheck.text;
      if (text.trim().length < 5) {
        text = "Payment details abhi confirm kar ke bhejta hoon.";
      }
    }
  }

  // 9c. Strip scripted "AI assistant" filler and the repeated-"bhai" tic.
  text = stripRoboticPhrasing(text, lastAgentMessage);

  // 10. Split response into natural WhatsApp bubbles
  let messages: string[] = [];
  if (text.includes("---MSG---")) {
    messages = text
      .split("---MSG---")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
  } else {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length > 1 && paragraphs.length <= 3) {
      messages = paragraphs;
    } else if (text.length > 0) {
      messages = [text];
    }
  }

  messages = messages
    .map((m) => m.replace(/^(Message\s*\d+:|\d+\.)\s*/i, "").trim())
    .filter((m) => m.length > 0);

  // Concise WhatsApp default: never more than 3 short bubbles.
  if (messages.length > 3) {
    messages = messages.slice(0, 3);
  }

  if (messages.length === 0 && imageToSend) {
    messages = ["Han bhai, ye dekho interface 👇"];
  }

  return {
    textMessages: messages,
    imageToSend,
    imageCaption,
    templateMessage,
  };
}

/**
 * Dispatches split messages sequentially with realistic human pauses.
 */
async function sendResponse(
  cleanJid: string,
  textMessages: string[],
  imageToSend: string | null,
  delaySec: number,
  userId?: string,
  templateMessage?: string | null,
  imageCaption?: string | null
) {
  // TEMPLATE ORDER GUARANTEE: the saved product template is ALWAYS sent first,
  // exactly as stored, before any AI-generated message.
  if (templateMessage && templateMessage.trim().length > 0) {
    console.log(`[Agent:${userId || 'default'}] Sending saved product template FIRST to ${cleanJid}.`);
    await sendMessage(cleanJid, templateMessage, userId);
    if (textMessages.length > 0 || imageToSend) {
      const waitMs = Math.max(900, Math.min(2500, delaySec * 1000));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  for (let i = 0; i < textMessages.length; i++) {
    const msg = textMessages[i];
    console.log(`[Agent:${userId || 'default'}] Sending message [${i + 1}/${textMessages.length}] to ${cleanJid}: "${msg}"`);
    await sendMessage(cleanJid, msg, userId);

    if (i < textMessages.length - 1) {
      const waitMs = Math.max(900, Math.min(2500, delaySec * 1000));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  if (imageToSend) {
    console.log(`[Agent:${userId || 'default'}] Delivering tool image/screenshot to ${cleanJid}: ${imageToSend}${imageCaption ? ` (caption: "${imageCaption}")` : ""}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await sendToolImage(cleanJid, imageToSend, imageCaption || undefined, userId);
  }
}

/**
 * Automatically evaluates conversation evidence and transitions customer status.
 */
async function evaluateAndApplyCustomerStatus(
  cleanJid: string,
  customer: Customer,
  latestCustomerText: string,
  aiStatusTag?: string | null,
  userId = "usr_admin_badar",
  buyingIntentDetected = false
) {
  try {
    const currentStatus: CustomerStatus = normalizeCustomerStatus(customer?.status);
    const textLower = latestCustomerText.toLowerCase();

    let targetStatus: CustomerStatus | null = null;
    let reason = "";

    const paymentDoneRegex = /(payment|paise|pese|amount|raze|trx|slip|screenshot|receipt|transfer)\s*(kr|kar|bhej|send|done|diya|de diya|kardi|send kardia|ho gai|ho gyi|check|dekh|kro|karo)/i;
    const directPaidRegex = /\b(paid|transferred|bhej diya payment|kar diya payment|payment done|screenshot dekho|slip bhej|screen shot send|payment check)\b/i;
    const paymentPendingRegex = /\b(buy karna|khareedna|account number|account details|easypaisa do|jazzcash do|kahan pay|how to buy|payment method|payment karni|bank details|details bhej do pay|purchase karna|sub leni hai|account send)\b/i;
    const followUpRegex = /\b(kal message|baad me|busy hun|busy hoon|shaam ko|aglay hafte|kal baat|soch k|later|call back|contact later|phir batata|phir bataunga|abhi nahi)\b/i;

    if (paymentDoneRegex.test(textLower) || directPaidRegex.test(textLower)) {
      targetStatus = "Payment Done";
      reason = "Customer stated payment was transferred / sent receipt.";
    } else if (paymentPendingRegex.test(textLower)) {
      targetStatus = "Payment Pending";
      reason = "Customer requested payment accounts / expressed clear purchase intent.";
    } else if (followUpRegex.test(textLower)) {
      targetStatus = "Follow Up";
      reason = "Customer asked to follow up / contact later.";
    } else if (aiStatusTag && VALID_CUSTOMER_STATUSES.includes(aiStatusTag as any)) {
      targetStatus = normalizeCustomerStatus(aiStatusTag);
      reason = `AI evaluated conversational transition to ${targetStatus}.`;
    } else if (currentStatus === "New Customer") {
      const toolInterestRegex = /\b(tool|price|cost|features|voice|voices|video|audio|clone|cloning|demo|rate|package|plan|kitne|chahiye|available|kese)\b/i;
      if (buyingIntentDetected || toolInterestRegex.test(textLower)) {
        targetStatus = "Interested";
        reason = buyingIntentDetected
          ? "New customer showed strong buying intent."
          : "New customer inquired about tool features or pricing.";
      }
    }

    if (targetStatus && targetStatus !== currentStatus) {
      await customerService.updateCustomerSalesState(
        cleanJid,
        targetStatus,
        reason,
        "AI managed",
        userId,
        targetStatus === "Payment Done" ? { messageSnippet: latestCustomerText, claimedAt: new Date().toISOString() } : undefined
      );
    }
  } catch (err) {
    console.error("[Agent] Error evaluating customer status:", err);
  }
}
