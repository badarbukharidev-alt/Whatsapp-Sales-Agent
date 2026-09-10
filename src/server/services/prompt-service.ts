import { Customer, Tool, ChatMessage, AgentSettings } from "../../types.js";
import { getUnstatedFacts } from "../tool-matcher.js";

export interface PromptSynthesisParams {
  customer: Customer;
  matchedTools: Tool[];
  allAccountToolsSummary: string;
  recentMessages: ChatMessage[];
  latestCustomerText: string;
  settings: AgentSettings;
  isUnknownProduct?: boolean;
  queryProduct?: string;
  agentRecentlyClaimedFixed?: boolean;
}

export interface SynthesizedPrompt {
  prompt: string;
  systemPrompt: string;
  matchedToolName?: string;
}

/**
 * Retrieval-Based Prompt Synthesizer
 *
 * Drastically eliminates prompt bloat by injecting ONLY relevant memory,
 * matching tool details, and recent messages (~450 tokens vs 2,500+).
 */
export function synthesizeSalesPrompt(params: PromptSynthesisParams): SynthesizedPrompt {
  const {
    customer,
    matchedTools,
    allAccountToolsSummary,
    recentMessages,
    latestCustomerText,
    settings,
    isUnknownProduct,
    queryProduct,
    agentRecentlyClaimedFixed,
  } = params;

  const memory = customer.memorySummary;
  const isReturningCustomer = Boolean(
    (customer.messages && customer.messages.length > 2) ||
    (memory && memory.totalTurnsCount && memory.totalTurnsCount > 1) ||
    customer.status !== "New Customer"
  );

  // 1. SYSTEM PROMPT (Authentic Pakistani Human WhatsApp Sales Consultant)
  const systemPrompt = `You are an authentic, highly knowledgeable, and friendly Pakistani software sales consultant chatting with customers on WhatsApp.
TONE & PERSONALITY:
- 100% REAL HUMAN WhatsApp seller experience. Speak in natural, conversational Roman Urdu (e.g. "Walaikum Assalam bhai!", "Ji bhai bilkul", "zabardast tool hai", "scene ye hai", "bhai tension na lo").
- Warm, respectful, confident, and persuasive. You are a tech brother advising the customer on the best software for their needs.
- Keep replies natural for WhatsApp: 2 to 3 concise, punchy messages separated by "---MSG---". Never send an overwhelming wall of text, but NEVER be dry or unhelpful.

CRITICAL RULES (ABSOLUTELY NO ROBOTIC BOT BEHAVIOR):
1. BANNED BOT PHRASES:
   - NEVER say: "Main aap ki kya madad kar sakta hoon", "Kis cheez ke baaray mein pochna hai", "Bataen kis cheez mein help chahiye", "Helpline me khushamdeed", "Customer support me welcome".
   - NEVER sound like a call-center bot or automated helpline.
   - NEVER repeatedly push "Bolo kab tak set kar dein?" or "subscription activate kar doon?" prematurely before building value.
2. VALUE SELLING & REAL PERSUASION:
   - When a customer shows interest in a tool (e.g., "Clipshied tool lena ha", "voice over tool"), do NOT give a cold 1-line reply. Enthusiastically validate their choice! Explain WHY it is the best tool, its standout features (e.g., bypasses YouTube Content ID with 9-layer protection, instant voice cloning, local speed), how it helps them make money or save time, state the price clearly, and ask a relevant question about their use case (e.g., YouTube automation, TikTok shorts, drama recap).
3. RICH DETAILS ON DEMAND:
   - When the customer asks for "Details" or "How to use": Share comprehensive, structured, attractive details from the tool specifications, dynamic sections, and features. Make them realize the immense value of the software.
4. SHARE LINKS FREELY:
   - When the customer asks for "Link" or trial/download: Share the direct download/trial link or documentation link provided in the tool knowledge! Guide them warmly on how to test 1 video or sample audio and share their Hardware ID or details.
5. CONTEXT CONTINUITY:
   - If the customer gives a short confirmation or reply like "G", "haan", "theek", "ok", "yes", NEVER reset the conversation or ask generic questions. Seamlessly connect to what was just discussed (e.g., if you asked if they need it for content creation and they said "G", immediately explain how the tool supercharges their content creation).
6. CONTINUOUS CONVERSATION:
   - If the conversation is already ongoing, do NOT greet again or re-introduce yourself. Pick up the conversation naturally.
7. STRICT SOURCE OF TRUTH:
   - Only discuss products, features, dynamic sections, and rates stored in our catalog. NEVER invent external tools or fabricate features.`;

  // 2. CUSTOMER MEMORY & CONTEXT BLOCK
  const memoryLines: string[] = [];
  memoryLines.push(`[CUSTOMER CONTEXT & PROFILE]`);
  if (customer.name || memory?.customerName) {
    memoryLines.push(`Customer Name: ${customer.name || memory?.customerName}`);
  }
  memoryLines.push(`Relationship: ${isReturningCustomer ? "Returning Customer (CONVERSATION IS ONGOING)" : "New Lead (First Greeting)"}`);
  if (memory?.stage) {
    memoryLines.push(`Sales Stage: ${memory.stage}`);
  }
  if (memory?.lastToolDiscussed) {
    memoryLines.push(`Active Tool in Discussion: ${memory.lastToolDiscussed}`);
  }
  if (memory?.summaryText) {
    memoryLines.push(`Memory Summary: ${memory.summaryText}`);
  }
  if (memory?.quotedPrices && Object.keys(memory.quotedPrices).length > 0) {
    const quotes = Object.entries(memory.quotedPrices).map(([t, p]) => `${t}: ${p}`).join(", ");
    memoryLines.push(`Previously Quoted Rates: ${quotes}`);
  }
  if (isReturningCustomer) {
    memoryLines.push(`DIRECTIVE: Conversation is active. Do NOT greet with "AOA" or reset context. Reply directly to customer's message.`);
  }

  // 3. RETRIEVED TOOL KNOWLEDGE (VAST & DYNAMIC SECTIONS)
  const toolLines: string[] = [];
  let matchedToolName: string | undefined = undefined;

  if (isUnknownProduct && queryProduct) {
    toolLines.push(`[EXTERNAL PRODUCT INQUIRY: "${queryProduct}"]`);
    toolLines.push(`We DO NOT carry or sell "${queryProduct}".`);
    toolLines.push(`INSTRUCTION: Honestly and politely state we don't have "${queryProduct}". Ask what specific workflow or problem they are trying to solve (e.g. video editing, voice cloning, shorts creation), without talking down on that tool.`);
  } else if (matchedTools.length > 0) {
    matchedToolName = matchedTools[0].name;
    for (const t of matchedTools) {
      toolLines.push(`=== PRODUCT CATALOG: ${t.name} ===`);
      toolLines.push(`Description & Problem Solved: ${t.description}`);
      
      const minFloor = t.pricing?.min_negotiable_pkr || t.pricePkr || "N/A";
      toolLines.push(`Pricing: Rs. ${t.pricePkr || "N/A"}/mo ${t.priceUsd ? `($${t.priceUsd}/mo)` : ""} | Min Floor Rate: Rs. ${minFloor}`);

      if (t.pricing?.negotiation_notes) {
        toolLines.push(`Negotiation Policy: ${t.pricing.negotiation_notes}`);
      }

      // Features & Selling Points
      if (t.features && t.features.length > 0) {
        toolLines.push(`Key Features:`);
        t.features.forEach((f) => toolLines.push(`  * ${f}`));
      }

      if (t.sales_points && t.sales_points.length > 0) {
        toolLines.push(`Standout Sales Angles & Creator Benefits:`);
        t.sales_points.forEach((s) => toolLines.push(`  * ${s}`));
      }

      if (t.how_to_use) {
        toolLines.push(`How To Use & Setup Instructions:\n${t.how_to_use}`);
      }

      if (t.requirements && t.requirements.length > 0) {
        toolLines.push(`Requirements: ${t.requirements.join(", ")}`);
      }

      if (t.limitations && t.limitations.length > 0) {
        toolLines.push(`Limitations / Quotas: ${t.limitations.join(", ")}`);
      }

      // Direct Links & URLs
      if (t.links && t.links.length > 0) {
        toolLines.push(`Official Links & Downloads:`);
        t.links.forEach((l) => toolLines.push(`  - ${l.title}: ${l.url} ${l.note ? `(${l.note})` : ""}`));
      }

      // DYNAMIC SECTIONS (Vast & Unabridged)
      if (t.sections && t.sections.length > 0) {
        toolLines.push(`Detailed Dynamic Sections:`);
        for (const sec of t.sections) {
          toolLines.push(`[SECTION: ${sec.title}]\n${sec.content}`);
        }
      }

      // FAQs
      if (t.faq && t.faq.length > 0) {
        toolLines.push(`Common Customer Questions:`);
        t.faq.slice(0, 4).forEach((q) => toolLines.push(`  Q: ${q.question} -> A: ${q.answer}`));
      }

      // Objection responses
      if (t.objection_responses) {
        if (latestCustomerText.match(/(?:mehnga|expensive|discount|kam|budget|high)/i) && t.objection_responses.too_expensive) {
          toolLines.push(`Objection Guide (Price Resistance): ${t.objection_responses.too_expensive}`);
        } else if (latestCustomerText.match(/(?:soch|time|baad)/i) && t.objection_responses.need_time) {
          toolLines.push(`Objection Guide (Needs Time): ${t.objection_responses.need_time}`);
        }
      }
    }
  } else {
    // General chat or inquiry across all tools
    toolLines.push(`[AVAILABLE STORE TOOLS]`);
    toolLines.push(allAccountToolsSummary);
    toolLines.push(`INSTRUCTION: Greet naturally and casually as a human tech seller (e.g. "Walaikum Assalam bhai! Kya haal hain? Bataen kon sa software ya tool dekh rahe hain aap?"). NEVER use robotic bot phrases like "main kya madad kar sakta hoon".`);
  }

  // 4. PAYMENT METHODS (Injected when payment is mentioned)
  const isPaymentRelevant =
    latestCustomerText.match(/(?:pay|payment|jazzcash|easypaisa|bank|raast|account|bhejo|transfer|kese\s+loon|kharidna|buy)/i) ||
    memory?.stage === "payment_pending";

  const paymentLines: string[] = [];
  if (isPaymentRelevant) {
    const activePayments = (settings.paymentMethods || []).filter((p: any) => p.isActive !== false);
    if (activePayments.length > 0) {
      paymentLines.push(`[OFFICIAL PAYMENT ACCOUNTS]`);
      activePayments.forEach((p: any) => {
        paymentLines.push(`- ${p.provider}: ${p.accountTitle} | Number: ${p.accountNumber}${p.bankName ? ` (${p.bankName})` : ""}`);
      });
      paymentLines.push(`Closing Directive: Send payment account details clearly and ask the customer to share payment screenshot + email / Hardware ID once done.`);
    }
  }

  // 5. RECENT CONVERSATION TURNS
  const turns = recentMessages.slice(-8).map((m) => {
    const speaker = m.role === "user" ? customer.name || "Customer" : "You (Agent)";
    return `${speaker}: ${m.content}`;
  });

  // 6. NEGOTIATION CONSISTENCY GUARD
  const negotiationGuard = agentRecentlyClaimedFixed
    ? `CONSISTENCY RULE: You recently stated rate is fixed. Do not immediately drop the price in this turn without value justification.`
    : "";

  // ASSEMBLE PROMPT
  const promptParts = [
    memoryLines.join("\n"),
    toolLines.join("\n\n"),
    paymentLines.length > 0 ? paymentLines.join("\n") : "",
    negotiationGuard,
    turns.length > 0 ? `[RECENT CONVERSATION TURNS]:\n${turns.join("\n")}` : "",
    `CUSTOMER'S LATEST MESSAGE(S): "${latestCustomerText}"`,
    `Reply as a real Pakistani sales consultant in natural Roman Urdu (split multiple thoughts with "---MSG---"):`,
  ].filter(Boolean);

  return {
    prompt: promptParts.join("\n\n"),
    systemPrompt,
    matchedToolName,
  };
}
