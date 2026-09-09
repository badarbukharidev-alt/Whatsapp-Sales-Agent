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

  // 1. SYSTEM PROMPT (Compact Core Persona & Rules ~80 tokens)
  const systemPrompt = `You are a real Pakistani WhatsApp sales representative for our software store.
TONE: Casual Roman Urdu, warm, helpful, completely human. 1-3 short sentences.
RULES:
1. NEVER act like an automated bot or helpline (NEVER say "helpline me khushamdeed" or "customer support me welcome").
2. CONTINUOUS CONVERSATION: If customer is returning or conversation is ongoing, DO NOT greet again or re-introduce yourself. Pick up the conversation naturally.
3. STRICT SOURCE OF TRUTH: Only discuss products, features, and rates stored in our catalog. NEVER invent external tools (e.g. Canva, ElevenLabs, CapCut) or fabricate capabilities.
4. ANTI-REPETITION: Do not repeat already stated points or identical pricing lines across consecutive replies.`;

  // 2. CUSTOMER MEMORY & CONTEXT BLOCK (~60 tokens)
  const memoryLines: string[] = [];
  memoryLines.push(`[CUSTOMER PROFILE & MEMORY]`);
  if (customer.name || memory?.customerName) {
    memoryLines.push(`Name: ${customer.name || memory?.customerName}`);
  }
  memoryLines.push(`Relationship: ${isReturningCustomer ? "Returning Customer (CONVERSATION IS ONGOING)" : "New Lead"}`);
  if (memory?.stage) {
    memoryLines.push(`Current Stage: ${memory.stage}`);
  }
  if (memory?.summaryText) {
    memoryLines.push(`Previous Memory: ${memory.summaryText}`);
  }
  if (memory?.quotedPrices && Object.keys(memory.quotedPrices).length > 0) {
    const quotes = Object.entries(memory.quotedPrices).map(([t, p]) => `${t}: ${p}`).join(", ");
    memoryLines.push(`Previously Quoted Rates: ${quotes}`);
  }
  if (isReturningCustomer) {
    memoryLines.push(`DIRECTIVE: Do NOT greet with "AOA" or "kya haal hain". Answer their message directly.`);
  }

  // 3. RETRIEVED TOOL KNOWLEDGE (~150 tokens)
  const toolLines: string[] = [];
  let matchedToolName: string | undefined = undefined;

  if (isUnknownProduct && queryProduct) {
    toolLines.push(`[EXTERNAL PRODUCT INQUIRY: "${queryProduct}"]`);
    toolLines.push(`We DO NOT sell or carry "${queryProduct}".`);
    toolLines.push(`INSTRUCTION: Honestly state we don't have "${queryProduct}". Politely ask what workflow or problem they are looking to solve, without bashing the product.`);
  } else if (matchedTools.length > 0) {
    matchedToolName = matchedTools[0].name;
    for (const t of matchedTools) {
      toolLines.push(`=== MATCHED TOOL: ${t.name} ===`);
      toolLines.push(`Description: ${t.description}`);
      const minFloor = t.pricing?.min_negotiable_pkr || t.pricePkr || "N/A";
      toolLines.push(`Regular Price: Rs. ${t.pricePkr || "N/A"}/mo | Min Negotiable Floor: Rs. ${minFloor}`);

      if (t.pricing?.negotiation_notes) {
        toolLines.push(`Negotiation Policy: ${t.pricing.negotiation_notes}`);
      }

      // Filter out already stated features to enforce anti-repetition
      const candidateFacts = [...(t.features || []), ...(t.sales_points || [])];
      const statedFacts = (customer.factsStated && customer.factsStated[t.id]) || [];
      const unstatedFacts = getUnstatedFacts(candidateFacts, statedFacts);

      if (unstatedFacts.length > 0) {
        toolLines.push(`Fresh Features to mention (pick 1 if needed):`);
        unstatedFacts.slice(0, 3).forEach((f) => toolLines.push(`  - ${f}`));
      }

      // Relevant objection scripts
      if (t.objection_responses) {
        if (latestCustomerText.match(/(?:mehnga|expensive|discount|kam)/i) && t.objection_responses.too_expensive) {
          toolLines.push(`Objection Guide (Price): ${t.objection_responses.too_expensive}`);
        } else if (latestCustomerText.match(/(?:soch|time|baad)/i) && t.objection_responses.need_time) {
          toolLines.push(`Objection Guide (Needs Time): ${t.objection_responses.need_time}`);
        }
      }
    }
  } else {
    // No specific tool matched (general chat or catalog inquiry)
    toolLines.push(`[STORE CATALOG OVERVIEW]`);
    toolLines.push(allAccountToolsSummary);
    toolLines.push(`INSTRUCTION: Do NOT pitch or force any specific tool until the customer asks or explains what they need. Ask how you can help.`);
  }

  // 4. PAYMENT METHODS (Only injected when relevant ~30 tokens)
  const isPaymentRelevant =
    latestCustomerText.match(/(?:pay|payment|jazzcash|easypaisa|bank|raast|account|bhejo|transfer|kese\s+loon)/i) ||
    memory?.stage === "payment_pending";

  const paymentLines: string[] = [];
  if (isPaymentRelevant) {
    const activePayments = (settings.paymentMethods || []).filter((p: any) => p.isActive !== false);
    if (activePayments.length > 0) {
      paymentLines.push(`[PAYMENT ACCOUNTS]`);
      activePayments.forEach((p: any) => {
        paymentLines.push(`- ${p.provider}: ${p.accountTitle} | Number: ${p.accountNumber}${p.bankName ? ` (${p.bankName})` : ""}`);
      });
    }
  }

  // 5. RECENT CHAT TURNS (~100 tokens, last 4-6 messages)
  const turns = recentMessages.slice(-6).map((m) => {
    const speaker = m.role === "user" ? customer.name || "Customer" : "You (Agent)";
    return `${speaker}: ${m.content}`;
  });

  // 6. NEGOTIATION CONSISTENCY GUARD
  const negotiationGuard = agentRecentlyClaimedFixed
    ? `CONSISTENCY RULE: You recently stated rate is fixed. Do not immediately drop the price in this turn.`
    : "";

  // ASSEMBLE LEAN PROMPT
  const promptParts = [
    memoryLines.join("\n"),
    toolLines.join("\n"),
    paymentLines.length > 0 ? paymentLines.join("\n") : "",
    negotiationGuard,
    turns.length > 0 ? `[RECENT CONVERSATION TURNS]:\n${turns.join("\n")}` : "",
    `CUSTOMER'S NEW MESSAGE(S): "${latestCustomerText}"`,
    `Reply in natural Roman Urdu (1-3 sentences):`,
  ].filter(Boolean);

  return {
    prompt: promptParts.join("\n\n"),
    systemPrompt,
    matchedToolName,
  };
}
