import { askAI } from "./ai.js";
import { getCustomers, updateCustomerMemory, updateCustomerStatus, normalizeCustomerStatus, VALID_CUSTOMER_STATUSES } from "./memory.js";
import { getTools } from "./tools.js";
import { getSettings } from "./settings.js";
import { sendMessage, sendToolImage } from "./whatsapp.js";
import { Customer, CustomerStatus } from "../types.js";
import { checkAiReplyQuota, recordAiReply, recordUserMessage } from "./usage.js";

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
  const customer: Customer = customers[phoneNumber] || { phoneNumber, status: 'New Customer', messages: [] };
  const tools = await getTools(userId);

  // Format all tools dynamically from Tool Manager
  const toolContext = tools.length > 0
    ? tools.map((t: any) => {
        let block = `=== TOOL: ${t.name} ===\nCategory: ${t.category || 'AI Tools'}\nStatus: ${t.status || 'active'}\nDescription: ${t.description || ''}`;
        if (t.pricePkr || t.priceUsd) {
          block += `\nPricing: ${t.pricePkr ? `Rs. ${t.pricePkr}/month` : ''} ${t.priceUsd ? `($${t.priceUsd}/mo)` : ''}`;
        }
        if (t.features && t.features.length > 0) {
          block += `\nKey Features:\n` + t.features.map((f: string) => `  - ${f}`).join("\n");
        }
        if (t.use_cases && t.use_cases.length > 0) {
          block += `\nUse Cases:\n` + t.use_cases.map((u: string) => `  - ${u}`).join("\n");
        }
        if (t.limitations && t.limitations.length > 0) {
          block += `\nLimits & Limitations:\n` + t.limitations.map((l: string) => `  - ${l}`).join("\n");
        }
        if (t.how_to_use) {
          block += `\nHow to Use / Access: ${t.how_to_use}`;
        }
        if (t.sales_points && t.sales_points.length > 0) {
          block += `\nSales Points / Standout Advantages:\n` + t.sales_points.map((s: string) => `  - ${s}`).join("\n");
        }
        if (t.faq && t.faq.length > 0) {
          block += `\nFAQs:\n` + t.faq.map((q: any) => `  Q: ${q.question} -> A: ${q.answer}`).join("\n");
        }
        if (t.images && Array.isArray(t.images) && t.images.length > 0) {
          block += `\nAvailable Screenshots / UI Images:\n` + t.images.map((img: any) => `  - Image File: "${img.filepath || img.filename}" | Title: "${img.title || 'Screenshot'}" | Description: "${img.description}"`).join("\n");
        }
        return block;
      }).join("\n\n")
    : "No custom tools configured in Tool Manager.";

  // Format active payment methods
  const activePayments = (settings.paymentMethods || []).filter((p: any) => p.isActive !== false);
  const paymentContext = activePayments.length > 0
    ? activePayments.map((p: any) =>
        `• ${p.provider}: ${p.accountTitle} | Number: ${p.accountNumber}${p.bankName ? ` (${p.bankName})` : ''}${p.iban ? ` | IBAN: ${p.iban}` : ''}${p.instructions ? ` - Note: ${p.instructions}` : ''}`
      ).join("\n") + (settings.paymentInstructions ? `\nPayment Policy: ${settings.paymentInstructions}` : "")
    : "No manual bank accounts configured. Ask customer to contact admin.";

  // Recent chat history
  const customerMessages = customer.messages || [];
  const messageHistory = customerMessages
    .slice(-20)
    .map((m: any) => `${m.role === 'user' ? (name || 'Customer') : 'You (Agent)'}: ${m.content}`)
    .join("\n");

  // Extract past points already mentioned by agent in this chat for strict anti-repetition
  const agentPastMessages = customerMessages
    .filter((m: any) => m.role === 'agent')
    .map((m: any) => m.content)
    .join("\n");

  // Sales Closer Skill mode from SKILL.md
  const salesSkillInstructions = settings.salesSkillEnabled !== false ? `
==================================================
11. ADVANCED SALES CLOSER SKILL ENGINE (SKILL.MD)
==================================================
You are operating with the High-Converting WhatsApp Sales Closer Skill active:
1. Core Mission:
   - Understand what the customer wants, identify the best product or plan, communicate the value clearly, remove legitimate buying friction, and make the next step easy.
   - Optimize for: Relevance before persuasion, Trust before pressure, Value before discount, Diagnosis before rebuttal, and One clear next step per message.
2. Discovery Before Pitch:
   - Do not dump product features immediately when customer's need is broad.
   - Level 1 Need: "Aap mainly kis kaam ke liye tool dekh rahe hain?"
   - Level 2 Pain: "Abhi manual karne me kitna time lagta hai?" or "Current setup mein kya missing hai?"
   - Stop asking questions once you have enough information to make a confident recommendation.
3. Value Selling:
   - Translate features into outcomes: Feature -> What it changes -> Why the customer should care.
   - Example: "Isme AI replies + automation hai, isliye aapko har lead manually handle nahi karni padegi aur koi customer wait nahi karega."
4. Objection Handling Playbook:
   - Objection "Mehnga hai / Too expensive": Diagnose first ("Aapka monthly budget kitna hai ya commitment ka issue lag raha hai?"). Highlight daily ROI or recommend starter plan if available.
   - Objection "Soch ke bataunga / Later": Do not be pushy. Ask what specific question or point they are evaluating so you can provide clarity.
   - Objection "Trust / Scam fear": Share genuine screenshots, explain clear step-by-step activation, and offer direct admin reassurance.
5. Clean Closing:
   - When customer shows buying intent ("chahiye", "buy karna hai", "account do", "price theek hai"), immediately provide ONE clear next step:
     "Main exact payment details share kar deta hoon, transfer ke baad screenshot bhej dijiye ga taake foran access mil jaye."
` : `
==================================================
11. STANDARD DIRECT MODE
==================================================
Answer questions directly and helpfully based on the tool knowledge.
`;

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
2. TOOL RECOMMENDATIONS (NATURAL HIGHLIGHTS)
==================================================
When a customer asks for a tool (e.g. "voice over tool chahiye", "video downloader hai?", "script generator chahiye"):
- Do NOT give only a lazy 1-line vague answer (like "Han available hai").
- Provide the 2 to 4 most useful highlights from that tool's knowledge in 2-3 short, natural messages:
  Example:
  Message 1: "Han bhai, VoiceDelta hai iske liye."
  Message 2: "Isme 3,600+ AI voices hain — ElevenLabs, OpenAI, Gemini aur Microsoft ki."
  Message 3: "Voice cloning bhi hai aur Pro me unlimited voice generation milti hai."
- Then STOP.
- Do NOT dump every single feature, all limitations, all technical specs, FAQs, or full pricing tiers immediately.

==================================================
3. INTENT-BASED REPLIES (PRECISE ANSWERS)
==================================================
Answer according to EXACTLY what the customer asks:
- "price?" / "kitne ka hai?" → Give price only in 1 short message (e.g. "VoiceDelta Pro Rs. 1,500/month ka hai.").
- "link?" / "kahan se buy karun?" → Send link only in 1 short message (e.g. "Ye lo bhai 👇\nhttps://...").
- "voice cloning hai?" / "urdu voices hain?" → Answer that specific question directly in 1 short message.
- "features?" → Give top 2-3 most standout features.
- "details?" / "aur batao" → Give 2-3 moderate NEW details that have NOT been mentioned yet in this chat.
- DO NOT restart the complete product pitch after every question!

==================================================
4. PROGRESSIVE DISCLOSURE & INFORMATION SELECTION
==================================================
Stored tool knowledge contains many details. Before replying, select ONLY the information relevant to the customer's current intent.
Priority:
1. Direct answer to their immediate question
2. Most useful supporting point
3. Optional next detail
Ignore everything else unless the customer explicitly asks for it.

==================================================
5. STRICT ANTI-REPETITION (NO DUPLICATE FACTS)
==================================================
Check the RECENT CHAT HISTORY below.
If the customer already knows a fact (e.g. voice count, voice cloning, or price):
- DO NOT repeat those same facts again unless the customer specifically asks to confirm them.
- Reveal fresh, relevant points progressively.

==================================================
6. NATURAL SALES BEHAVIOR (BUILD CONFIDENCE)
==================================================
- Goal: Understand → Recommend → Explain → Build confidence → Help decide.
- NEVER pressure the customer or create fake urgency (NEVER say "only 2 slots left" or "offer ending today").
- NEVER make fake claims or invent features, prices, limits, or links not found in Tool Knowledge.
- DO NOT repeatedly ask pushy closing questions.
- Only ask a question when it naturally helps the customer make a decision.

==================================================
7. MESSAGE SPLITTING RULES
==================================================
WhatsApp messages must be natural. Don't over-fragment every 2 words into a separate bubble, and don't dump everything into 1 huge block.
Separate multi-message turns by placing "---MSG---" between them.

==================================================
8. OFFICIAL PAYMENT DETAILS & SCREENSHOTS
==================================================
If the customer asks how to pay or asks for payment accounts ("payment kahan karni hai", "account number do", "easypaisa/jazzcash hai?"):
- Send the official payment details cleanly from OFFICIAL PAYMENT ACCOUNTS below.
- Ask them to send the payment screenshot/receipt after transferring so access can be activated.

==================================================
9. SCREENSHOT / IMAGE INTELLIGENCE
==================================================
- Only attach an image if the customer explicitly asks to see the interface/screenshot/dashboard, OR if an image is directly requested.
- To send an image, append [SEND_IMAGE: <filepath>] to your response.

==================================================
10. CUSTOMER STATUS AUTOMATION (MEMORY UPDATE)
==================================================
Current Customer Status: "${customer.status || 'New Customer'}"

Analyze the conversation evidence and determine if the customer's status should change.
Available statuses:
- "New Customer": New contact or first-time inquiry asking about tools.
- "Interested": Customer shows active or repeated product interest, asking about capabilities, features, or prices.
- "Payment Pending": Customer clearly wants to buy, asks for payment account details, or says "buy karna hai", "account bhej do", "payment method", but has not confirmed paying yet.
- "Payment Done": Customer states they have sent/transferred the payment, mentions transaction ID, sends receipt/screenshot, or says "payment kar di hai", "check kar lo payment".
- "Follow Up": Customer explicitly asks to be contacted later ("kal baat karte hain", "busy hun abhi", "baad me batata hun").
- "Order Complete": (CRITICAL: NEVER output this status. Only human admins can mark Order Complete upon payment verification).
- "Important": Priority customer or VIP lead.

RULES FOR STATUS CHANGE:
- Do NOT change status on casual messages (e.g. "ok", "acha", "han", "theek").
- Only change when there is clear conversation evidence.
- If status should change, append [SET_STATUS: <StatusName>] to your response.
- If current status should remain as is, do NOT include [SET_STATUS: ...].

${salesSkillInstructions}

${settings.systemPrompt ? `Additional Custom Admin Persona/Instructions:\n${settings.systemPrompt}\n` : ""}

STORED TOOL KNOWLEDGE (SOURCE OF TRUTH):
${toolContext}

OFFICIAL PAYMENT ACCOUNTS:
${paymentContext}

RECENT CHAT HISTORY:
${messageHistory || "No previous messages with this customer."}

CUSTOMER'S NEW MESSAGE(S):
"${latestCustomerText}"

==================================================
MANDATORY FINAL LANGUAGE & BEHAVIOR DIRECTIVE:
==================================================
1. STRICT ROMAN URDU ONLY:
   - Your reply MUST be 100% in natural Pakistani Roman Urdu (e.g. "Han bhai", "jee bilkul", "VoiceDelta Pro Rs. 1,199/month ka hai").
   - NEVER write in English! Even if the customer writes in English or Hindi, YOU MUST REPLY IN ROMAN URDU!
2. NO BROCHURE / NO BULLET LISTS:
   - NEVER use markdown bold headers (e.g. **Elevate AI**), asterisks (* item), or numbered lists!
   - Write like a real person sending 1 to 3 short WhatsApp bubbles.
3. STRICT PRODUCT LOCK:
   - Voiceover inquiry -> VoiceDelta ONLY (Rs. 1,199/mo).
   - Video copyright inquiry -> ClipShield ONLY.
   - NEVER mention any external tools.

Separate 1–3 short messages using "---MSG---". Provide your natural Roman Urdu reply below:`;

  const systemInstruction = `You are a real Pakistani WhatsApp sales closer for VoiceDelta and ClipShield.
CRITICAL LANGUAGE & STYLE MANDATE:
- You MUST ALWAYS reply in 100% natural, casual Pakistani Roman Urdu using Latin alphabet (e.g. "han bhai", "jee bilkul", "VoiceDelta Pro Rs. 1,199/month ka hai", "scene ye hai", "batao kis type ke videos hain?").
- NEVER reply in English!
- NEVER reply in Hindi / Devanagari script!
- NEVER output markdown bold headers, bullet lists, or corporate brochures!
- Write strictly 1 to 3 short conversational sentences (15 to 40 words total).`;

  console.log(`[Agent] Generating AI response for ${phoneNumber}...`);
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

  // Split response by "---MSG---" or multiple newlines
  let messages: string[] = [];
  if (text.includes("---MSG---")) {
    messages = text
      .split("---MSG---")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
  } else {
    // If not separated by delimiter, split by double newlines if 2-3 clean paragraphs exist
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

