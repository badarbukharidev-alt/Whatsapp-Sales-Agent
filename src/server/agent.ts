import { askAI } from "./ai.js";
import { customerService, normalizeCustomerStatus, normalizeJid, VALID_CUSTOMER_STATUSES } from "./services/customer-service.js";
import { toolService } from "./services/tool-service.js";
import { synthesizeSalesPrompt } from "./services/prompt-service.js";
import { getSettings } from "./settings.js";
import { sendMessage, sendToolImage } from "./whatsapp.js";
import { Customer, CustomerStatus, Tool } from "../types.js";
import { checkAiReplyQuota, recordAiReply, recordUserMessage } from "./usage.js";
import { recordStatedFacts, clampPriceFloors, extractMentionedFacts } from "./tool-matcher.js";

// ---------------------------------------------------------------------------
// Controlled-selling helpers: buying intent, explicit requests, role separation
// ---------------------------------------------------------------------------

/** Strong buying-intent signals (Roman Urdu + English). */
const BUYING_INTENT_REGEX =
  /(?:\b(?:le?na|lena|leni|chahiye|chaiye|chahye)\b|\blink\b|\bprice\b|\brate\b|\bkitne?\b|\bkitna\b|final\s*price|\bpayment\b|jazz\s*cash|jazzcash|easy\s*paisa|easypaisa|\braast\b|account\s*(?:number|details|no)|\bpro\b|start\s*kar|shuru\s*kar|kharid|khareed|purchase|\bbuy\b|sub\s*len|order\s*kar|paise?\s*(?:bhej|send|transfer|kaha))/i;

/** Explicit payment-details request. */
const EXPLICIT_PAYMENT_REGEX =
  /(?:payment\s*(?:details|method|info|kaise|karni|kar\s*d|number|account)|kaise?\s*pay|kahan?\s*(?:pay|paise|bhej)|account\s*(?:number|details|title|no)\b|jazz\s*cash|jazzcash|easy\s*paisa|easypaisa|\braast\b|bank\s*(?:details|account))/i;

/** Explicit link / download request. */
const EXPLICIT_LINK_REGEX =
  /(?:\blink\b|\blinks\b|download|trial\s*(?:link|de)|website\s*(?:link|do)|\bportal\b)/i;

/** Customer explicitly wants an alternative / comparison to the locked product. */
const ALTERNATIVE_REGEX =
  /(?:alternative|alternate|doosr|dusr|koi\s*aur|kuch\s*aur|compare|comparison|difference|farq|instead\s*of|behtar\s*option|other\s*tool|second\s*option)/i;

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
  await sendResponse(cleanJid, response.textMessages, response.imageToSend, delaySec, userId, response.templateMessage);

  // 5. Save agent reply immediately to permanent memory (template included for history)
  const replyParts: string[] = [];
  if (response.templateMessage) replyParts.push(response.templateMessage);
  replyParts.push(...response.textMessages);
  const replyMemoryText = replyParts.join("\n\n") + (response.imageToSend ? `\n[Sent Image: ${response.imageToSend}]` : "");
  await customerService.saveMessage(cleanJid, "agent", replyMemoryText, userId);
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
): Promise<{ textMessages: string[]; imageToSend: string | null; templateMessage: string | null }> {
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

  // 4. SAVED PRODUCT TEMPLATE MESSAGE — sent FIRST, exactly once, on first detection.
  let templateMessage: string | null = null;
  const templatesSent = [...(memory.templatesSent || [])];
  if (lockedTool && directlyDetectedTool && directlyDetectedTool.id === lockedTool.id) {
    const tm = lockedTool.templateMessage;
    const alreadySent = templatesSent.includes(lockedTool.id);
    const sendOnce = tm?.sendOnce !== false; // default: send once
    if (tm?.enabled && (tm.content || "").trim().length > 0 && !(sendOnce && alreadySent)) {
      templateMessage = renderTemplateMessage(tm, lockedTool);
      if (!templatesSent.includes(lockedTool.id)) templatesSent.push(lockedTool.id);
    }
  }

  // 5. Persist product-lock + template state to permanent memory.
  if (lockedTool) {
    await customerService.updateCustomerMemory(
      cleanJid,
      {
        currentProductId: lockedTool.id,
        currentProductName: lockedTool.name,
        lastToolDiscussed: lockedTool.name,
        templatesSent,
      },
      userId
    );
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
      lines.push("\nPayment ke baad screenshot + apna email / Hardware ID yahan share karein. Main activate kar deta hoon. ✅");
      const paymentReply = lines.join("\n");
      await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, null, userId, buyingIntent);
      return {
        textMessages: [paymentReply],
        imageToSend: null,
        templateMessage,
      };
    }
  }
  // ── END HARDCODED PAYMENT BYPASS ─────────────────────────────────────────

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

  // 6. Extract image tags e.g. [SEND_IMAGE: <filepath>]
  let imageToSend: string | null = null;
  const imageTagMatch = text.match(/\[(?:SEND_IMAGE|ATTACH_IMAGE):\s*([^\]]+)\]/i);
  if (imageTagMatch) {
    imageToSend = imageTagMatch[1].trim().replace(/^["']|["']$/g, "");
    text = text.replace(imageTagMatch[0], "").trim();
  }

  // 7. Evaluate & apply customer status transition (buying intent nudges Interested)
  await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, extractedAiStatus, userId, buyingIntent);

  // STRICT ROLE SEPARATION: remove any fabricated customer turns / role prefixes,
  // so the model can never output messages as if it were the customer.
  text = stripFabricatedCustomerTurns(text)
    .replace(/^["']|["']$/g, "")
    .trim();

  // ENGLISH HALLUCINATION INTERCEPTOR:
  if (isEnglishHallucination(text)) {
    console.log(`[Agent:${userId}] Intercepted English AI hallucination ("${text.slice(0, 40)}..."). Replacing with Roman Urdu response.`);
    if (templateMessage) {
      text = "Aap pehle test kar lein, jab satisfied hon toh batayega payment details share kar doonga.";
    } else if (lockedTool) {
      text = `ClipShield ka monthly price Rs. ${lockedTool.pricePkr || 1500} hai. Agar 1000 Pkr finalize karna hai toh bataen, main abhi link aur account details bhej deta hoon.`;
    } else {
      text = "Walaikum Assalam bhai! Kaise hain aap? Bataen konsa software ya tool dekh rahe hain aap?";
    }
  }

  // CLEAN & FIX URLS: Repair mangled links, convert markdown links to plain URLs, and strip URLs if template was sent
  text = cleanAndFixUrls(text, Boolean(templateMessage));

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
  templateMessage?: string | null
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
    console.log(`[Agent:${userId || 'default'}] Delivering tool screenshot to ${cleanJid}: ${imageToSend}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await sendToolImage(cleanJid, imageToSend, undefined, userId);
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
