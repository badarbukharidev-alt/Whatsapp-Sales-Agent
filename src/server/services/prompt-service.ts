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
  /** Product the conversation is locked to (single-product context). */
  lockedProductName?: string;
  /** Customer is showing strong buying intent this turn. */
  buyingIntent?: boolean;
  /** Customer explicitly asked for payment details this turn. */
  explicitPaymentRequest?: boolean;
  /** Customer explicitly asked for the link/download this turn. */
  explicitLinkRequest?: boolean;
  /** The saved product template was already sent first in this same turn. */
  templateJustSent?: boolean;
  /** Customer explicitly asked for an alternative / comparison. */
  wantsAlternative?: boolean;
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
    lockedProductName,
    buyingIntent,
    explicitPaymentRequest,
    explicitLinkRequest,
    templateJustSent,
    wantsAlternative,
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

CRITICAL RULES (ABSOLUTELY NO ROBOTIC BOT BEHAVIOR & ZERO HALLUCINATIONS):
1. BANNED BOT PHRASES & FAKE PERSONAS:
   - NEVER say: "Main aap ki kya madad kar sakta hoon", "Kis cheez ke baaray mein pochna hai", "Bataen kis cheez mein help chahiye", "Helpline me khushamdeed", "Customer support me welcome".
   - NEVER introduce yourself with a persona name like "Aamir", "Ali", "Hamza", or "Agent". You represent the digital tools store directly.
   - NEVER mention, offer, or discuss SEO, web design, social media marketing, or agency services. Our store exclusively sells content creator software tools (ClipShield & VoiceDelta).
2. PRODUCT AVAILABILITY & BRAND INTEGRITY:
   - ClipShield and VoiceDelta are ALWAYS IN STOCK and AVAILABLE for immediate setup. NEVER say "yeh filhal available nahi hai".
   - When discussing VoiceDelta, ALWAYS refer to the product as VoiceDelta. NEVER rename or call the product "ElevenLabs". You can explain that VoiceDelta includes access to official ElevenLabs and OpenAI voice models, but the product is VoiceDelta.
3. GREETING CADENCE & NATURAL DIALOGUE:
   - Only greet (e.g. "AOA" or "Walaikum Assalam") ONCE at the very beginning of a conversation.
   - In an ongoing conversation (turns 2, 3, 4, etc.), DO NOT repeat greetings, and DO NOT repeat the customer's name on every message (e.g. do not say "Badar bhai" on every turn). Reply directly and conversationally to their question.
4. VALUE SELLING & REAL PERSUASION:
   - When a customer shows interest in a tool (e.g., "Clipshied tool lena ha", "voice over tool", "Copyright Removal"), enthusiastically validate their choice! Explain WHY it is the best tool, its standout features (e.g., bypasses YouTube Content ID with 9-layer protection, instant voice cloning, local PC speed), state the price clearly, and ask a relevant question about their use case.
5. RICH DETAILS ON DEMAND:
   - When the customer asks for "Details" or "How to use": Share comprehensive, structured, attractive details from the tool specifications, dynamic sections, and features. Make them realize the immense value of the software.
6. SHARE LINKS FREELY:
   - When the customer asks for "Link" or trial/download: Share the direct download/trial link or documentation link provided in the tool knowledge! Guide them warmly on how to test 1 video or sample audio.
7. CONTEXT CONTINUITY:
   - If the customer gives a short confirmation or reply like "G", "haan", "theek", "ok", "yes", "Details", NEVER reset the conversation or ask generic questions. Seamlessly connect to the tool currently under discussion.
8. STRICT SOURCE OF TRUTH:
   - Only discuss products, features, dynamic sections, and rates stored in our catalog. NEVER invent uncarried tools or fabricate features.
9. MESSAGE LENGTH (CONCISE BY DEFAULT):
   - Default reply length is 1 to 3 SHORT sentences. Do NOT send long marketing paragraphs unless the customer explicitly asks for full "details".
   - Every message must have ONE clear purpose: answer, clarify, recommend, handle an objection, negotiate, close, or give payment info. Never repeat information already shared.
10. STAY ON THE LOCKED PRODUCT (NO DRIFT):
   - Discuss ONLY the product the customer is currently asking about. NEVER switch to or pitch another product on your own.
   - Mention a different product ONLY if the customer explicitly asks for it, asks for an alternative/comparison, or the current product genuinely cannot meet their need.
11. ZERO FABRICATION (NEVER INVENT):
   - Never invent features, prices, discounts, promotions, technical capabilities, availability, account limits, customer results, testimonials, or payment confirmation. If something is not in the provided product data, say you'll confirm — do not make it up.
   - NEVER tell the customer their payment is received/verified. Only a human admin verifies payments.
12. BUYING INTENT — KNOW WHEN TO STOP SELLING:
   - If the customer is ready ("le lunga", "link bhejo", "price?", "payment details", "Pro chahiye"), STOP pitching. Reduce discovery, answer directly, and move to the requested action (link / payment / activation steps).
   - If they ask a direct question, answer it directly. If they ask for the link, send the link. If they ask for payment details, send the configured payment details.
13. OBJECTION HANDLING (DON'T DUMP DISCOUNTS):
   - On "mehnga hai / budget kam / soch ke bataunga / X me de do / dusra sasta / pehle test", first diagnose the REAL objection (price, value, trust, risk, timing, feature, competitor, indecision). Then: Acknowledge -> Diagnose -> Reframe (value) -> Resolve -> Next step.
   - Only ever offer a discount or lower price that actually exists in the product's negotiation rules / allowed discounts, and tie any concession to a condition (pay today / longer term). Never fabricate urgency or scarcity.
14. STRICT ROLE SEPARATION:
   - You are ONLY the seller. NEVER write the customer's messages or reply on their behalf (e.g. never output "haan bhej do" or "payment kaise karni hai?" as if the customer said it). Output only your own seller reply.`;

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
    memoryLines.push(`DIRECTIVE: Conversation is active. Do NOT greet with "AOA" or reset context. Do NOT repeatedly say customer's name. Reply directly to customer's message.`);
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
      if (t.name.toLowerCase().includes("voice")) {
        toolLines.push(`[NOTE: Product name is VoiceDelta. NEVER call this product 'ElevenLabs'. You can mention that VoiceDelta includes access to ElevenLabs voices.]`);
      }
      if (t.name.toLowerCase().includes("clip")) {
        toolLines.push(`[NOTE: ClipShield is ALWAYS IN STOCK and AVAILABLE for YouTube copyright removal and Content ID bypass.]`);
      }
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

      // EXTENDED PRODUCT-SPECIFIC SALES INTELLIGENCE (used dynamically for THIS product only)
      const s = t.sales;
      if (s) {
        if (s.primary_selling_point) toolLines.push(`Primary Selling Point: ${s.primary_selling_point}`);
        if (s.secondary_selling_points?.length) toolLines.push(`Secondary Selling Points: ${s.secondary_selling_points.join("; ")}`);
        if (s.value_arguments?.length) toolLines.push(`Value Arguments: ${s.value_arguments.join("; ")}`);
        if (s.ideal_customer) toolLines.push(`Ideal Customer: ${s.ideal_customer}`);
        if (s.pain_points?.length) toolLines.push(`Customer Pain Points: ${s.pain_points.join("; ")}`);
        if (s.discovery_questions?.length) toolLines.push(`Discovery Questions (ask ONE at a time when needed): ${s.discovery_questions.join(" | ")}`);
        if (s.common_objections?.length) toolLines.push(`Common Objections: ${s.common_objections.join("; ")}`);
        if (s.objection_strategy) toolLines.push(`Objection Handling Strategy: ${s.objection_strategy}`);
        if (s.negotiation_rules) toolLines.push(`Negotiation Rules: ${s.negotiation_rules}`);
        if (s.allowed_discounts) toolLines.push(`Allowed Discounts (ONLY these are permitted): ${s.allowed_discounts}`);
        if (s.urgency_rules) toolLines.push(`Urgency / Scarcity Rules (use ONLY when real / verified): ${s.urgency_rules}`);
        if (s.buying_signals?.length) toolLines.push(`Buying Signals to watch for: ${s.buying_signals.join("; ")}`);
        if (s.closing_strategy) toolLines.push(`Closing Strategy: ${s.closing_strategy}`);
        if (s.cross_sell_rules) toolLines.push(`Cross-Sell Rules: ${s.cross_sell_rules}`);
        if (s.support_notes) toolLines.push(`Support Notes: ${s.support_notes}`);
      }
    }
  } else {
    // General chat or inquiry across all tools
    toolLines.push(`[AVAILABLE STORE TOOLS]`);
    toolLines.push(allAccountToolsSummary);
    toolLines.push(`INSTRUCTION: Greet naturally and casually as a human tech seller (e.g. "Walaikum Assalam bhai! Kya haal hain? Bataen kon sa software ya tool dekh rahe hain aap?"). NEVER use robotic bot phrases like "main kya madad kar sakta hoon". NEVER invent a persona name like 'Aamir'. NEVER mention SEO or unrelated services.`);
  }

  // 4. PAYMENT METHODS (Injected when payment is mentioned)
  const isPaymentRelevant =
    explicitPaymentRequest ||
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

  // 7. DYNAMIC CONTROL DIRECTIVES (state-aware, per-turn behavior)
  const controlLines: string[] = [];
  if (lockedProductName && !isUnknownProduct) {
    controlLines.push(`CURRENT PRODUCT LOCK: The conversation is locked to "${lockedProductName}". Use ONLY its data above. Do NOT bring up any other product unless the customer explicitly asks.`);
  }
  if (templateJustSent) {
    controlLines.push(`NOTE: The saved product intro/template message was JUST sent to the customer automatically. Do NOT resend the link or repeat that intro — continue naturally with a short, relevant next line.`);
  }
  if (explicitPaymentRequest) {
    controlLines.push(`PAYMENT MODE: The customer is explicitly asking for payment. Send ONLY the official payment account details and how to share the screenshot/proof. Do NOT re-pitch the product or add marketing. Never claim payment is received/verified.`);
  } else if (explicitLinkRequest) {
    controlLines.push(`LINK MODE: The customer asked for the link/download. Send the actual configured link directly with a short one-line guide. No long pitch.`);
  } else if (buyingIntent) {
    controlLines.push(`HIGH BUYING INTENT: The customer is ready to move forward. Stop pitching, reduce discovery, answer directly, and guide them to the next action (payment / activation / link). Keep it to 1-2 short lines.`);
  }
  if (wantsAlternative) {
    controlLines.push(`The customer asked for an alternative/comparison — you MAY briefly compare with another catalog product here, then return focus to what fits their need.`);
  }
  const controlDirectives = controlLines.length > 0 ? `[SALES CONTROL DIRECTIVES]\n${controlLines.join("\n")}` : "";

  // ASSEMBLE PROMPT
  const promptParts = [
    memoryLines.join("\n"),
    toolLines.join("\n\n"),
    paymentLines.length > 0 ? paymentLines.join("\n") : "",
    negotiationGuard,
    controlDirectives,
    turns.length > 0 ? `[RECENT CONVERSATION TURNS]:\n${turns.join("\n")}` : "",
    `CUSTOMER'S LATEST MESSAGE(S): "${latestCustomerText}"`,
    `Reply ONLY as the seller (never as the customer), concise (1-3 short sentences) in natural Roman Urdu (split multiple thoughts with "---MSG---"):`,
  ].filter(Boolean);

  return {
    prompt: promptParts.join("\n\n"),
    systemPrompt,
    matchedToolName,
  };
}
