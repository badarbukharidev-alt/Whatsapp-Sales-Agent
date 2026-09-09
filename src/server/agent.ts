import { askAI } from "./ai.js";
import { customerService, normalizeCustomerStatus, normalizeJid, VALID_CUSTOMER_STATUSES } from "./services/customer-service.js";
import { toolService } from "./services/tool-service.js";
import { synthesizeSalesPrompt } from "./services/prompt-service.js";
import { getSettings } from "./settings.js";
import { sendMessage, sendToolImage } from "./whatsapp.js";
import { Customer, CustomerStatus, Tool } from "../types.js";
import { checkAiReplyQuota, recordAiReply, recordUserMessage } from "./usage.js";
import { recordStatedFacts, clampPriceFloors, extractMentionedFacts } from "./tool-matcher.js";

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
  if (!response || (response.textMessages.length === 0 && !response.imageToSend)) {
    return;
  }

  // 4. Send response sequentially with natural WhatsApp typing delay
  const delaySec = settings.responseDelaySeconds || 1.4;
  await sendResponse(cleanJid, response.textMessages, response.imageToSend, delaySec, userId);

  // 5. Save agent reply immediately to permanent memory
  const replyMemoryText = response.textMessages.join("\n\n") + (response.imageToSend ? `\n[Sent Image: ${response.imageToSend}]` : "");
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
): Promise<{ textMessages: string[]; imageToSend: string | null }> {
  const settings = await getSettings(userId);

  // 1. Load permanent customer record BEFORE generating reply
  const customer = await customerService.getCustomerByJid(cleanJid, userId, name);
  const recentMessages = await customerService.getConversationHistory(cleanJid, userId, 8);

  // 2. Dynamic Tool Retrieval for this specific account
  const accountTools = await toolService.getAccountTools(userId);
  const catalogSummary = await toolService.getAccountToolSummary(userId);

  const recentUserHistory = recentMessages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content);

  const match = await toolService.searchRelevantTools(latestCustomerText, userId, recentUserHistory);

  // 3. Check if agent recently claimed rate is fixed for negotiation consistency
  const agentRecentlyClaimedFixed = recentMessages
    .filter((m) => m.role === "agent")
    .slice(-2)
    .some((m) => /(?:fixed|kam nahi|rate final|final price|discount nahi)/i.test(m.content));

  // 4. Synthesize lean, anti-bloat sales prompt
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
  });

  console.log(`[Agent:${userId}] Querying AI for ${cleanJid} (Matched: ${match.matched.map(t => t.name).join(", ") || (match.isUnknownProduct ? `Unknown:${match.queryProduct}` : 'CatalogOverview')})...`);
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

  // 7. Evaluate & apply customer status transition
  await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, extractedAiStatus, userId);

  // Clean conversational prefixes
  text = text
    .replace(/^(Agent|You|Assistant|Bot|Salesperson):\s*/gim, "")
    .replace(/^["']|["']$/g, "")
    .trim();

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

    if (paragraphs.length > 1 && paragraphs.length <= 4) {
      messages = paragraphs;
    } else if (text.length > 0) {
      messages = [text];
    }
  }

  messages = messages
    .map((m) => m.replace(/^(Message\s*\d+:|\d+\.)\s*/i, "").trim())
    .filter((m) => m.length > 0);

  if (messages.length > 4) {
    messages = messages.slice(0, 4);
  }

  if (messages.length === 0 && imageToSend) {
    messages = ["Han bhai, ye dekho interface 👇"];
  }

  return {
    textMessages: messages,
    imageToSend,
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
  userId?: string
) {
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
  userId = "usr_admin_badar"
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
      if (toolInterestRegex.test(textLower)) {
        targetStatus = "Interested";
        reason = "New customer inquired about tool features or pricing.";
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
