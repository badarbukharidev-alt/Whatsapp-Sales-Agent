import { askAI } from "./ai.js";
import { getCustomers, updateCustomerMemory, updateCustomerStatus, normalizeCustomerStatus, VALID_CUSTOMER_STATUSES, saveCustomer } from "./memory.js";
import { getTools } from "./tools.js";
import { getSettings } from "./settings.js";
import { sendMessage, sendToolImage } from "./whatsapp.js";
import { Customer, CustomerStatus, Tool } from "../types.js";
import { checkAiReplyQuota, recordAiReply, recordUserMessage } from "./usage.js";
import { matchTool, getUnstatedFacts, recordStatedFacts, clampPriceFloors, extractMentionedFacts } from "./tool-matcher.js";

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
  console.log("[Agent] Ultra-Natural WhatsApp Conversation Engine initialized.");
}

/**
 * Enqueues an incoming customer message with sequence numbering and burst debouncing.
 * Uses a small 1.2–1.5 second debounce window to detect rapid consecutive messages
 * without delaying normal single messages.
 */
export async function queueMessage(phoneNumber: string, message: string, name?: string, userId?: string) {
  if (
    phoneNumber.includes("@newsletter") ||
    phoneNumber.includes("@broadcast") ||
    phoneNumber.includes("status@broadcast")
  ) {
    console.log(`[Agent:${userId || 'default'}] Ignored message from channel/broadcast: ${phoneNumber}`);
    return;
  }

  const seq = ++globalSequenceCounter;
  const queueKey = `${userId || 'default'}:${phoneNumber}`;
  console.log(`[Agent:${userId || 'default'}] [Seq #${seq}] Queued message from ${phoneNumber} (${name || "Customer"}): "${message}"`);

  let state = customerQueues.get(queueKey);
  if (!state) {
    state = {
      phoneNumber,
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

  // Add to pending burst queue in exact arrival order
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
 * Core batch handler: saves memory, builds ultra-natural prompt with progressive disclosure
 * & anti-repetition rules, generates response, and dispatches ordered split messages.
 */
async function handleCustomerMessageBatch(
  phoneNumber: string,
  batch: QueuedIncomingMessage[],
  name?: string,
  userId?: string
) {
  const settings = await getSettings(userId);
  if (!settings.aiAgentEnabled) {
    console.log(`[Agent:${userId || 'default'}] AI Agent is disabled in settings. Skipping reply to ${phoneNumber}.`);
    return;
  }

  // Combine batch messages preserving chronological order
  const combinedUserText = batch.map((m) => m.text).filter(Boolean).join("\n");
  if (!combinedUserText) return;

  console.log(`[Agent:${userId || 'default'}] Processing incoming batch (${batch.length} msg(s)) for ${phoneNumber}:\n"${combinedUserText}"`);

  // Record user incoming message(s) in conversation memory and persistent message counter
  await updateCustomerMemory(phoneNumber, combinedUserText, "user");
  await recordUserMessage();

  // Check persistent AI reply quota for current month (Free plan = 30 AI replies)
  const quota = await checkAiReplyQuota();
  if (!quota.allowed) {
    console.log(
      `[Agent:${userId || 'default'}] Monthly AI reply limit reached (${quota.usedThisMonth}/${quota.limit} replies used on ${quota.plan} plan). ` +
      `Skipping AI reply to ${phoneNumber}. Deleting customers does NOT reset this quota.`
    );
    return;
  }

  // Generate ultra-natural response
  const response = await generateResponse(phoneNumber, combinedUserText, name, batch, userId);
  if (!response || (response.textMessages.length === 0 && !response.imageToSend)) {
    return;
  }

  // Send response sequentially with natural WhatsApp typing delay
  const delaySec = settings.responseDelaySeconds || 1.4;
  await sendResponse(phoneNumber, response.textMessages, response.imageToSend, delaySec, userId);
  // Record the AI reply in persistent usage store
  await recordAiReply();
}

/**
 * Generates AI response using structured tool knowledge, intent selection, and strict anti-repetition.
 */
async function generateResponse(
  phoneNumber: string,
  latestCustomerText: string,
  name?: string,
  batch?: QueuedIncomingMessage[],
  userId?: string
): Promise<{ textMessages: string[]; imageToSend: string | null }> {
  const settings = await getSettings(userId);
  const customers = await getCustomers();
  const customer: Customer = customers[phoneNumber] || { phoneNumber, status: 'New Customer', messages: [], factsStated: {} };
  if (!customer.factsStated) customer.factsStated = {};
  const tools = await getTools(userId);

  // Recent user messages for context-aware matching
  const customerMessages = customer.messages || [];
  const recentUserHistory = customerMessages
    .filter((m: any) => m.role === 'user')
    .slice(-3)
    .map((m: any) => m.content);

  // 1. Tool Matching Protocol
  const match = matchTool(latestCustomerText, tools, recentUserHistory);

  // 2. Format tool context based on match results
  let toolContext = "";
  if (match.confidence === "none" && match.isUnknownProduct) {
    toolContext = `Customer asked about external uncataloged product: "${match.queryProduct}". No catalog tool matched.`;
  } else if (match.matched.length > 0) {
    // Only inject matched tools into context
    toolContext = match.matched.map((t: Tool) => {
      const minFloor = t.pricing?.min_negotiable_pkr || t.pricePkr || "N/A";
      let block = `=== MATCHED TOOL: ${t.name} ===\nCategory: ${t.category || 'AI Tools'}\nStatus: ${t.status || 'active'}\nDescription: ${t.description || ''}`;

      block += `\nPricing & Negotiation Floor:`;
      block += `\n  - List Price: Rs. ${t.pricePkr || 'N/A'}/month ${t.priceUsd ? `($${t.priceUsd}/mo)` : ''}`;
      block += `\n  - Minimum Negotiable Floor (DO NOT QUOTE BELOW THIS): Rs. ${minFloor}`;
      if (t.pricing?.negotiation_notes) {
        block += `\n  - Negotiation Rules: ${t.pricing.negotiation_notes}`;
      }

      const candidateFacts = [
        ...(t.features || []),
        ...(t.sales_points || []),
        ...(t.use_cases || [])
      ];
      const statedFacts = (customer.factsStated && customer.factsStated[t.id]) || [];
      const unstatedFacts = getUnstatedFacts(candidateFacts, statedFacts);

      block += `\n\n[ANTI-REPETITION STATUS FOR THIS CUSTOMER]:`;
      if (statedFacts.length > 0) {
        block += `\nALREADY STATED TO THIS CUSTOMER (DO NOT REPEAT VERBATIM):\n` + statedFacts.map(f => `  - [ALREADY SAID]: ${f}`).join("\n");
      } else {
        block += `\nALREADY STATED: None yet.`;
      }

      if (unstatedFacts.length > 0) {
        block += `\nFRESH FACTS TO REVEAL (DRAW FROM THESE):` + unstatedFacts.map(f => `\n  - [FRESH FACT]: ${f}`).join("");
      } else {
        block += `\nFRESH FACTS: All primary facts have been shared. Focus on answering their specific question or making the next step easy.`;
      }

      if (t.objection_responses && Object.keys(t.objection_responses).length > 0) {
        block += `\n\nObjection Handling Playbook for ${t.name}:`;
        if (t.objection_responses.too_expensive) block += `\n  - If customer says too expensive: ${t.objection_responses.too_expensive}`;
        if (t.objection_responses.need_time) block += `\n  - If customer needs time: ${t.objection_responses.need_time}`;
        if (t.objection_responses.comparing_competitor) block += `\n  - If customer compares with competitors: ${t.objection_responses.comparing_competitor}`;
      }

      if (t.images && Array.isArray(t.images) && t.images.length > 0) {
        block += `\n\nAvailable Screenshots / UI Images:\n` + t.images.map((img: any) => `  - Image File: "${img.filepath || img.filename}" | Title: "${img.title || 'Screenshot'}" | Description: "${img.description}"`).join("\n");
      }

      return block;
    }).join("\n\n");
  } else {
    // General chat / greeting without a specific tool match
    toolContext = `Available Software Catalog in Store:
- VoiceDelta: AI voice generator with 3,600+ AI voices, ElevenLabs/OpenAI models, and voice cloning (Rs. 1,199/mo).
- ClipShield: YouTube video downloader, AI hook finder, and 9-layer anti-copyright claim protection (Rs. 1,500/mo).
Do not dump feature lists. Greet naturally and ask 1 diagnostic question to understand what they are looking for.`;
  }

  // Format active payment methods
  const activePayments = (settings.paymentMethods || []).filter((p: any) => p.isActive !== false);
  const paymentContext = activePayments.length > 0
    ? activePayments.map((p: any) =>
        `• ${p.provider}: ${p.accountTitle} | Number: ${p.accountNumber}${p.bankName ? ` (${p.bankName})` : ''}${p.iban ? ` | IBAN: ${p.iban}` : ''}${p.instructions ? ` - Note: ${p.instructions}` : ''}`
      ).join("\n") + (settings.paymentInstructions ? `\nPayment Policy: ${settings.paymentInstructions}` : "")
    : "No manual bank accounts configured. Ask customer to contact admin.";

  // Recent chat history
  const messageHistory = customerMessages
    .slice(-20)
    .map((m: any) => `${m.role === 'user' ? (name || 'Customer') : 'You (Agent)'}: ${m.content}`)
    .join("\n");

  // Check if agent recently claimed rate is fixed for negotiation consistency
  const agentRecentlyClaimedFixed = customerMessages
    .filter((m: any) => m.role === 'agent')
    .slice(-2)
    .some((m: any) => /(?:fixed|kam nahi|rate final|final price|discount nahi)/i.test(m.content));

  // Sales Closer Skill mode from SKILL.md v2
  const salesSkillInstructions = settings.salesSkillEnabled !== false ? `
==================================================
11. SALES CLOSER SKILL ENGINE — V2 PROTOCOL
==================================================
1. PERSONA:
   - Casual Pakistani WhatsApp sales rep. Warm, direct, human, never robotic.
   - 100% Roman Urdu ONLY. Never write in English, Hindi, or formal Urdu script.
   - Vary sentence openers turn to turn. Do not start every message with the same line.
2. TOOL IDENTIFICATION PROTOCOL:
   - If a specific catalog tool matched: discuss ONLY that tool. Do not pivot to other tools unless asked.
   - If no match found: be honest. Do NOT claim to carry it, do NOT invent details, and NEVER denigrate it.
3. PROGRESSIVE DISCLOSURE & ANTI-REPETITION:
   - Check ALREADY STATED facts. NEVER repeat those same feature lines verbatim.
   - To reinforce value, draw from FRESH FACTS or address the new question directly.
4. NEGOTIATION LADDER & HARD PRICE FLOORS:
   - Step 1 (Anchor): State regular price confidently with value framing.
   - Step 2 (Hold & Reframe): On pushback, reframe value from a fresh angle (daily cost, time saved, multi-engine access).
   - Step 3 (Ask, don't fold): Ask what budget or setup works for them before conceding.
   - Step 4 (Consistency): ${agentRecentlyClaimedFixed ? "You recently stated the rate is fixed. MAINTAIN CONSISTENCY. Do not immediately fold or drop the price in this message." : "Pick one stance and stay consistent within the conversation."}
   - Step 5 (Conditional Concession): You may only concede down to the minimum floor in exchange for something concrete (e.g. 'Agar aap aaj payment confirm karte hain to Rs. X mein kar deta hoon'). Never give a discount for free!
   - Step 6 (Absolute Floor): NEVER quote below the tool's minimum floor.
` : `
==================================================
11. STANDARD DIRECT MODE
==================================================
Answer questions directly and helpfully based on the tool knowledge.
`;

  // Specific unknown product instruction block if detected
  const unknownProductDirective = match.isUnknownProduct ? `
==================================================
CRITICAL DIRECTIVE: UNKNOWN / EXTERNAL PRODUCT INQUIRY
==================================================
The customer is inquiring about: "${match.queryProduct}".
WE DO NOT SELL OR CARRY THIS PRODUCT!
MANDATORY BEHAVIOR:
1. HONEST BOUNDARY: State clearly and politely in casual Roman Urdu that we do not carry or sell ${match.queryProduct}.
2. NO FALSE CLAIMS: Never say we have it, never invent fake prices or access.
3. ZERO DENIGRATION: Do NOT criticize or insult ${match.queryProduct}. Never call it "bekar", "small", "fake", or "inferior".
4. DIAGNOSTIC QUESTION: Ask one friendly diagnostic question about what workflow they are trying to accomplish (e.g. "Aap mainly kis kaam ke liye tool dekh rahe hain? Video editing, voiceover ya automation?").
5. DO NOT FORCE-PIVOT: Only mention catalog tools if genuinely relevant to their workflow after understanding their goal.
` : "";

  const prompt = `You are a real, natural Pakistani WhatsApp salesperson helping a customer on WhatsApp.
You MUST behave like a genuine human Pakistani sales representative, NOT like an AI chatbot, corporate helpdesk, or product brochure.

==================================================
1. LANGUAGE & RESPONSE STYLE (CRITICAL)
==================================================
- Language: Casual, friendly Roman Urdu mixed naturally with everyday English words (e.g. "han bhai", "acha", "jee", "theek", "bilkul", "scene ye hai", "koi issue nahi", "try krlo", "check kar lo", "bhej deta hun", "apko", "chahiye").
- Natural English words: "plan", "tool", "link", "account", "payment", "voice", "voices", "video", "generation", "quality", "clone", "free", "pro", "unlimited", "setup", "screenshot", "interface", "features", "details".
- Avoid formal Urdu (STRICTLY BAN phrases like "ہم آپ کے مشکور ہیں", "آپ کا خیر مقدم کرتے ہیں", "معزز صارف", "تشریف لائیں").
- Avoid robotic AI phrases (STRICTLY BAN "As an AI model", "I am here to assist you with", "Here is a breakdown of our offerings:", "Feel free to ask further questions!").
- Avoid marketing fluff & hype (STRICTLY BAN "revolutionary", "supercharge", "game-changer", "powerhouse", "all-in-one suite", "unbeatable deal").
- Avoid emoji spam: Use at most 0–1 subtle emoji per message (e.g. 👍 or 👇). Never put 4-5 emojis in one line.
- NEVER send huge monolithic paragraphs. Keep each message short, crisp, and conversational.
- Message Count: Normally send 1–3 short messages. For genuine detail requests ("details?", "aur batao"), send maximum 3–4 short messages.
- After providing enough relevant information, STOP and wait for the customer to reply.

==================================================
2. MESSAGE SPLITTING RULES
==================================================
Separate multi-message turns by placing "---MSG---" between them.

==================================================
3. OFFICIAL PAYMENT DETAILS & SCREENSHOTS
==================================================
If the customer asks how to pay or asks for payment accounts ("payment kahan karni hai", "account number do", "easypaisa/jazzcash hai?"):
- Send the official payment details cleanly from OFFICIAL PAYMENT ACCOUNTS below.
- Ask them to send the payment screenshot/receipt after transferring so access can be activated.

==================================================
4. SCREENSHOT / IMAGE INTELLIGENCE
==================================================
- Only attach an image if the customer explicitly asks to see the interface/screenshot/dashboard, OR if an image is directly requested.
- To send an image, append [SEND_IMAGE: <filepath>] to your response.

==================================================
5. CUSTOMER STATUS AUTOMATION (MEMORY UPDATE)
==================================================
Current Customer Status: "${customer.status || 'New Customer'}"
If status should change based on clear evidence, append [SET_STATUS: <StatusName>]. Available statuses: "New Customer", "Interested", "Payment Pending", "Payment Done", "Follow Up", "Important".
(CRITICAL: NEVER output "Order Complete").

${salesSkillInstructions}

${unknownProductDirective}

${settings.systemPrompt ? `Additional Custom Admin Persona/Instructions:\n${settings.systemPrompt}\n` : ""}

STORED TOOL KNOWLEDGE:
${toolContext}

OFFICIAL PAYMENT ACCOUNTS:
${paymentContext}

RECENT CHAT HISTORY:
${messageHistory || "No previous messages with this customer."}

CUSTOMER'S NEW MESSAGE(S):
"${latestCustomerText}"

==================================================
MANDATORY FINAL DIRECTIVES:
==================================================
1. STRICT ROMAN URDU ONLY: Always reply in natural, casual Pakistani Roman Urdu.
2. NO BULLET LISTS / NO BROCHURES: Write like a real person sending 1 to 3 short WhatsApp messages.
3. ANTI-REPETITION: Do NOT repeat previously stated facts verbatim.
4. HONESTY: Never claim to have tools not in the catalog.
5. NEGOTIATION: Concessions must have a condition and never go below the minimum floor.

Separate 1–3 short messages using "---MSG---". Provide your natural Roman Urdu reply below:`;

  let systemInstruction = "You are a real Pakistani WhatsApp sales closer. Reply in 1 to 3 short sentences in natural Roman Urdu.";
  if (match.isUnknownProduct) {
    systemInstruction = `You are a real Pakistani WhatsApp sales representative. The customer asked about "${match.queryProduct}", which we DO NOT sell. Reply honestly in Roman Urdu that you do not carry it, do not criticize it, and ask 1 diagnostic question about what they want to achieve.`;
  } else if (match.matched.length > 0) {
    const names = match.matched.map(t => t.name).join(", ");
    systemInstruction = `You are a real Pakistani WhatsApp sales closer for ${names}. Reply strictly in 1 to 3 short conversational sentences (15 to 40 words total) in natural Roman Urdu. Never repeat already stated features.`;
  }

  console.log(`[Agent] Generating AI response for ${phoneNumber} (Matched: ${match.matched.map(t => t.name).join(", ") || (match.isUnknownProduct ? `Unknown:${match.queryProduct}` : 'None')})...`);
  const rawReply = await askAI(prompt, systemInstruction, userId);
  console.log(`[Agent] AI raw response for ${phoneNumber}:\n${rawReply}`);

  // Extract [SET_STATUS: <StatusName>] if present
  let extractedAiStatus: string | null = null;
  let text = rawReply;
  const statusTagMatch = text.match(/\[(?:SET_STATUS|STATUS):\s*([^\]]+)\]/i);
  if (statusTagMatch) {
    extractedAiStatus = statusTagMatch[1].trim();
    text = text.replace(statusTagMatch[0], "").trim();
  }

  // Extract [SEND_IMAGE: <filepath>] or [ATTACH_IMAGE: <filepath>] if present
  let imageToSend: string | null = null;
  const imageTagMatch = text.match(/\[(?:SEND_IMAGE|ATTACH_IMAGE):\s*([^\]]+)\]/i);
  if (imageTagMatch) {
    imageToSend = imageTagMatch[1].trim().replace(/^["']|["']$/g, "");
    text = text.replace(imageTagMatch[0], "").trim();
  }

  // Evaluate & automatically apply customer status transition if evidence supports it
  await evaluateAndApplyCustomerStatus(phoneNumber, customer, latestCustomerText, extractedAiStatus);

  // Clean conversational prefixes or markdown quotation if generated
  text = text
    .replace(/^(Agent|You|Assistant|Bot|Salesperson):\s*/gim, "")
    .replace(/^["']|["']$/g, "")
    .trim();

  // Task 4: Extract stated facts and persist to customer CRM record
  if (match.matched.length > 0) {
    let factsUpdated = false;
    for (const tool of match.matched) {
      const newlyStated = extractMentionedFacts(text, tool);
      if (newlyStated.length > 0) {
        recordStatedFacts(customer, tool.id, newlyStated);
        factsUpdated = true;
      }
    }
    if (factsUpdated) {
      await saveCustomer(phoneNumber, { factsStated: customer.factsStated });
    }
  }

  // Task 4: Clamp price floors in code to guarantee non-negotiable floor holds
  text = clampPriceFloors(text, match.matched.length > 0 ? match.matched : tools);

  // Split response by "---MSG---" or multiple newlines
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

  // Filter and clean each individual message bubble
  messages = messages
    .map((m) => m.replace(/^(Message\s*\d+:|\d+\.)\s*/i, "").trim())
    .filter((m) => m.length > 0);

  // Cap at maximum 3-4 messages for ultra-natural conversational feel
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
  phoneNumber: string,
  textMessages: string[],
  imageToSend: string | null,
  delaySec: number,
  userId?: string
) {
  const memoryText = textMessages.join("\n\n") + (imageToSend ? `\n[Sent Image: ${imageToSend}]` : "");
  await updateCustomerMemory(phoneNumber, memoryText, "agent");

  // Send split messages sequentially with realistic typing pause
  for (let i = 0; i < textMessages.length; i++) {
    const msg = textMessages[i];
    console.log(`[Agent:${userId || 'default'}] Sending split message [${i + 1}/${textMessages.length}] to ${phoneNumber}: "${msg}"`);
    await sendMessage(phoneNumber, msg, userId);

    // Natural pause between consecutive messages (except after last message)
    if (i < textMessages.length - 1) {
      const waitMs = Math.max(900, Math.min(2500, delaySec * 1000));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  // If screenshot was requested, deliver it after a short pause
  if (imageToSend) {
    console.log(`[Agent:${userId || 'default'}] Delivering tool screenshot to ${phoneNumber}: ${imageToSend}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await sendToolImage(phoneNumber, imageToSend, undefined, userId);
  }
}

/**
 * Automatically evaluates conversation evidence and transitions customer status.
 * Adheres strictly to business rules:
 * - Never mark Payment Done as verified automatically (Order Complete is manual only).
 * - Never mark Order Complete without admin/manual verification.
 * - Do not constantly flip status on casual greetings/acknowledgments.
 * - Keep status persistently in customer memory.
 */
async function evaluateAndApplyCustomerStatus(
  phoneNumber: string,
  customer: any,
  latestCustomerText: string,
  aiStatusTag?: string | null
) {
  try {
    const currentStatus: CustomerStatus = normalizeCustomerStatus(customer?.status);
    const textLower = latestCustomerText.toLowerCase();

    let targetStatus: CustomerStatus | null = null;
    let reason = "";

    // 1. Evidence of payment claimed by customer
    const paymentDoneRegex = /(payment|paise|pese|amount|raze|trx|slip|screenshot|receipt|transfer)\s*(kr|kar|bhej|send|done|diya|de diya|kardi|send kardia|ho gai|ho gyi|check|dekh|kro|karo)/i;
    const directPaidRegex = /\b(paid|transferred|bhej diya payment|kar diya payment|payment done|screenshot dekho|slip bhej|screen shot send|payment check)\b/i;

    // 2. Evidence of immediate buying intent / asking for payment details
    const paymentPendingRegex = /\b(buy karna|khareedna|account number|account details|easypaisa do|jazzcash do|kahan pay|how to buy|payment method|payment karni|bank details|details bhej do pay|purchase karna|sub leni hai|account send)\b/i;

    // 3. Evidence of asking to follow up later
    const followUpRegex = /\b(kal message|baad me|busy hun|busy hoon|shaam ko|aglay hafte|kal baat|soch k|later|call back|contact later|phir batata|phir bataunga|abhi nahi)\b/i;

    if (paymentDoneRegex.test(textLower) || directPaidRegex.test(textLower)) {
      targetStatus = "Payment Done";
      reason = "Customer stated payment was transferred / sent screenshot.";
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
      // If new customer is asking about tool features or prices
      const toolInterestRegex = /\b(tool|price|cost|features|voice|voices|video|audio|clone|cloning|demo|rate|package|plan|kitne|chahiye|available|kese)\b/i;
      if (toolInterestRegex.test(textLower)) {
        targetStatus = "Interested";
        reason = "New customer inquired about tool features, capabilities, or pricing.";
      }
    }

    // Safety checks & business rules
    if (targetStatus) {
      // RULE: AI can NEVER mark Order Complete automatically
      if (targetStatus === "Order Complete") {
        console.log(`[Agent] Rejected automated status transition to 'Order Complete' for ${phoneNumber}. Requires manual admin verification.`);
        return;
      }

      // RULE: If customer is already verified as Order Complete, do not downgrade automatically
      if (currentStatus === "Order Complete") {
        return;
      }

      // RULE: If marked Important, do not casually downgrade to New Customer or Interested
      if (currentStatus === "Important" && (targetStatus === "New Customer" || targetStatus === "Interested")) {
        return;
      }

      // RULE: If customer is in Payment Done, do not downgrade to Interested without admin action
      if (currentStatus === "Payment Done" && targetStatus === "Interested") {
        return;
      }

      // If status has genuinely changed, save it
      if (targetStatus !== currentStatus) {
        await updateCustomerStatus(
          phoneNumber, 
          targetStatus, 
          reason, 
          "AI managed",
          targetStatus === "Payment Done" ? { messageSnippet: latestCustomerText, claimedAt: new Date().toISOString() } : undefined
        );
      }
    }
  } catch (err) {
    console.error("[Agent] Error evaluating customer status:", err);
  }
}

