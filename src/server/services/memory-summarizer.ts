import { Customer, CustomerMemorySummary, ChatMessage } from "../../types.js";

/**
 * Memory Summarizer & Profile Extractor
 *
 * Compresses older conversation history into high-signal structured memory:
 * - Extracts customer name
 * - Tracks products of interest
 * - Records prices quoted during negotiations
 * - Records objections raised and resolved
 * - Synthesizes a compact 2-3 sentence narrative summary
 */

// Heuristic pattern matchers for fast, zero-token local extraction
const NAME_PATTERNS = [
  /(?:mera\s+naam|my\s+name\s+is|i\s+am|main\s+hoon|naam\s+hai)\s+([A-Za-z]{3,20})/i,
  /^([A-Za-z]{3,15})\s+(?:here|bol\s*raha|speaking)/i,
];

const PRICE_QUOTED_PATTERNS = [
  /(?:rs\.?|pkr|rate|price)\s*[:=]?\s*(\d{3,5})/i,
  /(\d{3,5})\s*(?:rs|pkr|mein|me)/i,
];

const OBJECTION_PATTERNS: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /(?:mehnga|expensive|bohot\s+zyada|kam\s+karo|discount)/i, tag: "price_sensitivity" },
  { pattern: /(?:soch|baad\s+me|kal|thoda\s+time|soch\s+ke)/i, tag: "needs_time" },
  { pattern: /(?:trust|scam|fraud|proof|pehle\s+account)/i, tag: "trust_hesitation" },
  { pattern: /(?:free|trial|demo|check\s+karne)/i, tag: "trial_request" },
];

/**
 * Extracts and updates structured customer memory from conversation messages.
 * Runs instantly in memory without external API dependencies.
 */
export function extractStructuredMemory(
  existingSummary: CustomerMemorySummary | undefined,
  messages: ChatMessage[],
  customerNameHint?: string
): CustomerMemorySummary {
  const summary: CustomerMemorySummary = {
    customerName: existingSummary?.customerName || customerNameHint || undefined,
    preferredLanguage: existingSummary?.preferredLanguage || "Roman Urdu",
    interestedTools: [...(existingSummary?.interestedTools || [])],
    quotedPrices: { ...(existingSummary?.quotedPrices || {}) },
    objectionsRaised: [...(existingSummary?.objectionsRaised || [])],
    objectionsResolved: [...(existingSummary?.objectionsResolved || [])],
    keyFacts: [...(existingSummary?.keyFacts || [])],
    stage: existingSummary?.stage || "greeting",
    lastToolDiscussed: existingSummary?.lastToolDiscussed || undefined,
    totalTurnsCount: messages.length,
    lastSummarizedAt: new Date().toISOString(),
    // Preserve product-lock & template state managed by the agent (never derived here).
    currentProductId: existingSummary?.currentProductId || undefined,
    currentProductName: existingSummary?.currentProductName || undefined,
    templatesSent: [...(existingSummary?.templatesSent || [])],
  };

  // Clean placeholder names like "Customer"
  if (summary.customerName && /^(customer|user|unknown|client)$/i.test(summary.customerName)) {
    summary.customerName = undefined;
  }

  // Scan user messages for name and objections
  for (const msg of messages) {
    if (msg.role === "user") {
      // 1. Try name extraction if not already set
      if (!summary.customerName) {
        for (const pat of NAME_PATTERNS) {
          const match = msg.content.match(pat);
          if (match && match[1]) {
            summary.customerName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            break;
          }
        }
      }

      // 2. Scan objections
      for (const obj of OBJECTION_PATTERNS) {
        if (obj.pattern.test(msg.content) && !summary.objectionsRaised.includes(obj.tag)) {
          summary.objectionsRaised.push(obj.tag);
        }
      }
    }

    // 3. Scan tool interests across both user and agent dialogue
    const lower = msg.content.toLowerCase();
    
    // Check known catalog tools
    if (lower.includes("clipshield") || lower.includes("clip shield") || lower.includes("clipshied") || lower.includes("copyright")) {
      if (!summary.interestedTools.includes("ClipShield")) summary.interestedTools.push("ClipShield");
      summary.lastToolDiscussed = "ClipShield";
    } else if (lower.includes("voicedelta") || lower.includes("voice delta") || lower.includes("voicedalta") || lower.includes("voiceover") || lower.includes("voice over") || lower.includes("cloning")) {
      if (!summary.interestedTools.includes("VoiceDelta")) summary.interestedTools.push("VoiceDelta");
      summary.lastToolDiscussed = "VoiceDelta";
    }

    if (msg.role === "agent") {
      // Check agent quoted prices
      for (const pat of PRICE_QUOTED_PATTERNS) {
        const priceMatch = msg.content.match(pat);
        if (priceMatch && priceMatch[1] && summary.lastToolDiscussed) {
          const quotedNum = parseInt(priceMatch[1], 10);
          if (quotedNum >= 500 && quotedNum <= 10000) {
            summary.quotedPrices[summary.lastToolDiscussed] = `Rs. ${quotedNum}`;
            break;
          }
        }
      }
    }
  }

  // Determine stage based on conversation markers
  const allText = messages.map(m => m.content).join(" ").toLowerCase();
  if (allText.includes("order complete") || allText.includes("license key") || allText.includes("activated")) {
    summary.stage = "paid";
  } else if (allText.includes("jazzcash") || allText.includes("easypaisa") || allText.includes("bank transfer") || allText.includes("account number") || allText.includes("send payment")) {
    summary.stage = "payment_pending";
  } else if (Object.keys(summary.quotedPrices).length > 0 || allText.includes("discount") || allText.includes("final") || allText.includes("rate")) {
    summary.stage = "negotiation";
  } else if (summary.interestedTools.length > 0) {
    summary.stage = "discovery";
  } else {
    summary.stage = "greeting";
  }

  // Generate concise narrative summary
  const toolStr = summary.interestedTools.length > 0 ? summary.interestedTools.join(" & ") : "store catalog";
  const priceEntries = Object.entries(summary.quotedPrices);
  const priceStr = priceEntries.length > 0
    ? `Quoted: ${priceEntries.map(([t, p]) => `${t} @ ${p}`).join(", ")}.`
    : "";
  const nameStr = summary.customerName ? `Customer ${summary.customerName}` : "Customer";
  const objectionStr = summary.objectionsRaised.length > 0 ? `Raised: ${summary.objectionsRaised.join(", ")}.` : "";

  let narrative = `${nameStr} inquired about ${toolStr}. ${priceStr} ${objectionStr} Current stage: ${summary.stage}.`.replace(/\s+/g, " ").trim();
  summary.summaryText = narrative;

  return summary;
}
