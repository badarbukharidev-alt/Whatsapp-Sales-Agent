import { Tool, Customer } from "../types.js";
import { askAI } from "./ai.js";

export interface ToolMatchDetail {
  toolId: string;
  toolName: string;
  matchedOn: "exact" | "alias" | "keyword" | "semantic";
  matchedToken: string;
}

export interface ToolMatchResult {
  matched: Tool[];
  confidence: "exact" | "alias" | "keyword" | "semantic" | "none";
  isUnknownProduct: boolean;
  queryProduct?: string;
  matchedDetails: ToolMatchDetail[];
}

// Well-known external tools and software brands often inquired about
const COMMON_EXTERNAL_TOOLS = [
  "capcut", "vrew", "invideo", "canva", "filmora", "synthesia", "midjourney",
  "suno", "runway", "pika", "luma", "adobe", "premiere", "photoshop", "chatgpt",
  "d-id", "descript", "opus clip", "submagic", "fliki", "pictory", "leonardo",
  "murf", "speechify", "resemble", "veed", "cupcut", "kamua", "netflix", "prime"
];

// Common Urdu/English non-product words to ignore when scanning for product nouns
const COMMON_STOP_WORDS = new Set([
  "kya", "hai", "yeh", "woh", "bhai", "bro", "sir", "jee", "han", "nahi", "ko",
  "ka", "ki", "ke", "me", "mein", "par", "se", "aur", "ya", "bhi", "toh", "ab",
  "abhi", "karo", "karna", "de", "do", "dena", "le", "lo", "lena", "chahiye",
  "hoga", "hogi", "kitne", "kitna", "price", "rate", "cost", "details", "info",
  "tool", "app", "software", "account", "link", "demo", "sample", "test",
  "video", "audio", "voice", "generator", "remover", "cloning", "youtube", "tiktok",
  "hello", "hi", "salam", "aoa", "assalam", "walaikum", "theek", "acha", "ok", "okay"
]);

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s\-\–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBaseName(name: string): string {
  return name.split(/[\–\-\:\|]/)[0].trim().toLowerCase();
}

/**
 * Extracts potential unknown product names from text using grammar patterns & keyword dictionary.
 */
function detectUnknownProduct(text: string, tools: Tool[]): string | undefined {
  const norm = normalizeText(text);

  // 1. Direct check against known external tools list
  for (const ext of COMMON_EXTERNAL_TOOLS) {
    const extRegex = new RegExp(`\\b${ext.replace(/\s+/g, "\\s*")}\\b`, "i");
    if (extRegex.test(norm)) {
      // Confirm this external tool isn't actually in our catalog
      const isCatalog = tools.some(t => {
        const base = extractBaseName(t.name);
        return base.includes(ext) || (t.aliases || []).some(a => a.toLowerCase().includes(ext));
      });
      if (!isCatalog) {
        // Capitalize nicely
        return ext.charAt(0).toUpperCase() + ext.slice(1);
      }
    }
  }

  // 2. Pattern matching: "<Token> tool/app/software/account/chahiye/hai"
  const patterns = [
    /(?:kya\s+)?([a-z0-9\-\_]{3,20})\s+(?:tool|app|software|account|subscription|bot|chahiye|available|mil\s*jayega)/i,
    /(?:about|price\s+of|rate\s+for|details\s+of|buy)\s+([a-z0-9\-\_]{3,20})/i,
    /(?:pass|pas)\s+([a-z0-9\-\_]{3,20})\s+(?:hai|available)/i,
  ];

  for (const pat of patterns) {
    const match = norm.match(pat);
    if (match && match[1]) {
      const candidate = match[1].toLowerCase().trim();
      if (!COMMON_STOP_WORDS.has(candidate) && candidate.length >= 3) {
        // Confirm it doesn't match any catalog tool or alias
        const isCatalog = tools.some(t => {
          const base = extractBaseName(t.name);
          return base.includes(candidate) || (t.aliases || []).some(a => a.toLowerCase().includes(candidate));
        });
        if (!isCatalog) {
          return candidate.charAt(0).toUpperCase() + candidate.slice(1);
        }
      }
    }
  }

  return undefined;
}

/**
 * Deterministic Fast-Path: Checks exact name, base name, and direct aliases.
 * Returns match result immediately if found, with zero network latency.
 */
export function matchToolExactOrAlias(text: string, tools: Tool[]): ToolMatchResult | null {
  const normText = normalizeText(text);
  const matchedDetails: ToolMatchDetail[] = [];
  const matchedToolsSet = new Map<string, Tool>();

  // 1. Exact / Base Name Match
  for (const tool of tools) {
    const fullNameNorm = normalizeText(tool.name);
    const baseNameNorm = extractBaseName(tool.name);

    const baseRegex = new RegExp(`\\b${baseNameNorm.replace(/\s+/g, "\\s*")}\\b`, "i");
    const fullRegex = new RegExp(`\\b${fullNameNorm.replace(/\s+/g, "\\s*")}\\b`, "i");

    if (baseRegex.test(normText) || fullRegex.test(normText)) {
      matchedToolsSet.set(tool.id, tool);
      matchedDetails.push({
        toolId: tool.id,
        toolName: tool.name,
        matchedOn: "exact",
        matchedToken: baseNameNorm,
      });
    }
  }

  if (matchedToolsSet.size > 0) {
    return {
      matched: Array.from(matchedToolsSet.values()),
      confidence: "exact",
      isUnknownProduct: false,
      matchedDetails,
    };
  }

  // 2. Alias Match
  for (const tool of tools) {
    const aliases = tool.aliases || [];
    for (const alias of aliases) {
      const normAlias = normalizeText(alias);
      if (!normAlias || normAlias.length < 3) continue;

      const aliasRegex = new RegExp(`\\b${normAlias.replace(/\s+/g, "\\s*")}\\b`, "i");
      if (aliasRegex.test(normText)) {
        matchedToolsSet.set(tool.id, tool);
        matchedDetails.push({
          toolId: tool.id,
          toolName: tool.name,
          matchedOn: "alias",
          matchedToken: alias,
        });
        break;
      }
    }
  }

  if (matchedToolsSet.size > 0) {
    return {
      matched: Array.from(matchedToolsSet.values()),
      confidence: "alias",
      isUnknownProduct: false,
      matchedDetails,
    };
  }

  return null;
}

/**
 * AI LLM Semantic Intent Classifier:
 * When exact/alias matching is ambiguous, uses LLM to understand natural phrasing,
 * Roman Urdu slang, indirect problem descriptions, and uncataloged external tools.
 */
export async function classifyToolIntentWithLLM(
  text: string,
  tools: Tool[],
  conversationHistory?: string[],
  userId?: string
): Promise<ToolMatchResult | null> {
  if (!text || text.trim().length < 3) return null;

  try {
    const toolSummaries = tools.map(t =>
      `- ID "${t.id}" (${t.name}): ${t.description.slice(0, 140)}`
    ).join("\n");

    const historySnippet = conversationHistory && conversationHistory.length > 0
      ? `Recent conversation context: "${conversationHistory.slice(-2).join(" ")}"\n`
      : "";

    const prompt = `Classify customer software intent. Return STRICT JSON ONLY.
Catalog:
${toolSummaries}

${historySnippet}Customer: "${text}"

Rules:
- If customer problem/need matches a catalog tool, put its ID in "matchedToolIds".
- If customer asks for uncataloged software (e.g. Canva, CapCut, Netflix, etc.), set "isUnknownProduct": true, "queryProduct": "<name>".
- If greeting/chit-chat, set "matchedToolIds": [].

JSON format:
{"matchedToolIds": string[], "isUnknownProduct": boolean, "queryProduct": string | null}`;

    const reply = await askAI(prompt, "You are a JSON-only tool classifier. Output valid JSON only.", userId);
    const jsonMatch = reply.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || typeof parsed !== "object") return null;

    // Validate matched tools against catalog
    const matchedTools: Tool[] = [];
    const matchedDetails: ToolMatchDetail[] = [];

    if (Array.isArray(parsed.matchedToolIds) && parsed.matchedToolIds.length > 0) {
      for (const rawId of parsed.matchedToolIds) {
        const idStr = String(rawId).trim().toLowerCase();
        const found = tools.find(t =>
          t.id.toLowerCase() === idStr ||
          t.name.toLowerCase() === idStr ||
          extractBaseName(t.name) === idStr
        );
        if (found && !matchedTools.some(m => m.id === found.id)) {
          matchedTools.push(found);
          matchedDetails.push({
            toolId: found.id,
            toolName: found.name,
            matchedOn: "semantic",
            matchedToken: text.slice(0, 40),
          });
        }
      }
    }

    if (matchedTools.length > 0) {
      return {
        matched: matchedTools,
        confidence: "semantic",
        isUnknownProduct: false,
        matchedDetails,
      };
    }

    if (parsed.isUnknownProduct && parsed.queryProduct) {
      const rawProd = String(parsed.queryProduct).trim();
      const isCatalog = tools.some(t => {
        const base = extractBaseName(t.name);
        return base.includes(rawProd.toLowerCase()) || (t.aliases || []).some(a => a.toLowerCase().includes(rawProd.toLowerCase()));
      });
      if (!isCatalog) {
        return {
          matched: [],
          confidence: "none",
          isUnknownProduct: true,
          queryProduct: rawProd,
          matchedDetails: [],
        };
      }
    }

    return {
      matched: [],
      confidence: "none",
      isUnknownProduct: false,
      matchedDetails: [],
    };
  } catch (err) {
    console.warn("[ToolMatcher] AI semantic classification failed or timed out:", (err as any)?.message || err);
    return null;
  }
}

/**
 * Synchronous deterministic rule-based matcher (exact, alias, keywords, history, unknown-brand regex).
 * Guaranteed 0ms offline execution for unit tests or fast fallbacks.
 */
export function matchToolSync(
  text: string,
  tools: Tool[],
  conversationHistory?: string[]
): ToolMatchResult {
  const normText = normalizeText(text);
  const matchedDetails: ToolMatchDetail[] = [];
  const matchedToolsSet = new Map<string, Tool>();

  const historyText = conversationHistory && conversationHistory.length > 0
    ? normalizeText(conversationHistory.slice(-3).join(" "))
    : "";

  // 1. Exact / Alias
  const fast = matchToolExactOrAlias(text, tools);
  if (fast) return fast;

  // 2. Keyword Match
  for (const tool of tools) {
    const keywords = (tool.keywords || []).slice().sort((a, b) => b.length - a.length);
    for (const kw of keywords) {
      const normKw = normalizeText(kw);
      if (!normKw || normKw.length < 3) continue;

      const kwRegex = new RegExp(`\\b${normKw.replace(/\s+/g, "\\s*")}\\b`, "i");
      if (kwRegex.test(normText)) {
        matchedToolsSet.set(tool.id, tool);
        matchedDetails.push({
          toolId: tool.id,
          toolName: tool.name,
          matchedOn: "keyword",
          matchedToken: kw,
        });
        break;
      }
    }
  }

  if (matchedToolsSet.size > 0) {
    return {
      matched: Array.from(matchedToolsSet.values()),
      confidence: "keyword",
      isUnknownProduct: false,
      matchedDetails,
    };
  }

  // 3. Conversation History Match
  if (historyText) {
    for (const tool of tools) {
      const baseNameNorm = extractBaseName(tool.name);
      const baseRegex = new RegExp(`\\b${baseNameNorm.replace(/\s+/g, "\\s*")}\\b`, "i");
      if (baseRegex.test(historyText)) {
        matchedToolsSet.set(tool.id, tool);
        matchedDetails.push({
          toolId: tool.id,
          toolName: tool.name,
          matchedOn: "alias",
          matchedToken: `history:${baseNameNorm}`,
        });
        break;
      }
    }
    if (matchedToolsSet.size > 0) {
      return {
        matched: Array.from(matchedToolsSet.values()),
        confidence: "alias",
        isUnknownProduct: false,
        matchedDetails,
      };
    }
  }

  // 4. Unknown External Product Detection
  const unknownProd = detectUnknownProduct(text, tools);
  if (unknownProd) {
    return {
      matched: [],
      confidence: "none",
      isUnknownProduct: true,
      queryProduct: unknownProd,
      matchedDetails: [],
    };
  }

  return {
    matched: [],
    confidence: "none",
    isUnknownProduct: false,
    matchedDetails: [],
  };
}

/**
 * Hybrid Tool Matcher:
 * 1. Deterministic Fast Path: Exact name & alias hits return instantly (0ms latency, zero API cost).
 * 2. Deterministic Known External Brand Check (Canva, CapCut, Photoshop, etc.).
 * 3. AI LLM Semantic Intent Classification: Understands Roman Urdu phrasing, slang, synonyms, and indirect problem descriptions.
 * 4. Fallback: Robust keyword & history matching if AI call is unavailable or times out.
 */
export async function matchTool(
  text: string,
  tools: Tool[],
  conversationHistory?: string[],
  userId?: string
): Promise<ToolMatchResult> {
  // 1. Fast-Path: Exact Name or Alias
  const fast = matchToolExactOrAlias(text, tools);
  if (fast) return fast;

  // 2. Fast-Path: Known external tools
  const norm = normalizeText(text);
  for (const ext of COMMON_EXTERNAL_TOOLS) {
    const extRegex = new RegExp(`\\b${ext.replace(/\s+/g, "\\s*")}\\b`, "i");
    if (extRegex.test(norm)) {
      const isCatalog = tools.some(t => {
        const base = extractBaseName(t.name);
        return base.includes(ext) || (t.aliases || []).some(a => a.toLowerCase().includes(ext));
      });
      if (!isCatalog) {
        return {
          matched: [],
          confidence: "none",
          isUnknownProduct: true,
          queryProduct: ext.charAt(0).toUpperCase() + ext.slice(1),
          matchedDetails: [],
        };
      }
    }
  }

  // 3. AI Semantic Classifier
  const aiMatch = await classifyToolIntentWithLLM(text, tools, conversationHistory, userId);
  if (aiMatch) {
    if (aiMatch.matched.length > 0 || aiMatch.isUnknownProduct) {
      return aiMatch;
    }
  }

  // 4. Fallback to keyword / rule-based matching
  return matchToolSync(text, tools, conversationHistory);
}

/**
 * Extracts salient tokens from a fact to check for overlap.
 * Keeps numbers (e.g. "3600", "99", "1") and salient words.
 */
function extractFactKeyTokens(fact: string): string[] {
  // Normalize numbers: remove commas inside digits (3,600 -> 3600)
  const clean = fact
    .replace(/(\d+),(\d+)/g, "$1$2")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clean
    .split(/\s+/)
    .filter(t => {
      if (!t) return false;
      // Keep all numeric tokens
      if (/^\d+$/.test(t)) return true;
      // Filter out pure stop words if token length <= 3 unless alphanumeric
      if (COMMON_STOP_WORDS.has(t)) return false;
      return t.length >= 3;
    });
}

/**
 * Compares all candidate facts for a tool against facts already stated to this customer.
 * Returns only those candidate facts that have NOT yet been stated or covered.
 */
export function getUnstatedFacts(allFacts: string[], statedFacts: string[] = []): string[] {
  if (!statedFacts || statedFacts.length === 0) {
    return [...allFacts];
  }

  const normalizedStated = statedFacts.map(s => {
    const clean = s.replace(/(\d+),(\d+)/g, "$1$2").toLowerCase();
    return {
      raw: normalizeText(s),
      clean,
      tokens: new Set(extractFactKeyTokens(s)),
    };
  });

  return allFacts.filter(candidate => {
    const candidateNorm = normalizeText(candidate);
    const candidateClean = candidate.replace(/(\d+),(\d+)/g, "$1$2").toLowerCase();
    if (!candidateNorm) return false;

    // 1. Direct or substring match
    const directHit = normalizedStated.some(stated =>
      stated.raw.includes(candidateNorm) ||
      stated.clean.includes(candidateClean) ||
      candidateNorm.includes(stated.raw)
    );
    if (directHit) return false;

    // 2. Token overlap similarity check
    const candidateTokens = extractFactKeyTokens(candidate);
    if (candidateTokens.length === 0) return true;

    const isCovered = normalizedStated.some(stated => {
      let matchedCount = 0;
      for (const tok of candidateTokens) {
        if (stated.tokens.has(tok) || stated.clean.includes(tok)) {
          matchedCount++;
        }
      }
      // If at least 50% of the candidate's salient tokens (or at least 2 key tokens) are present
      const ratio = matchedCount / candidateTokens.length;
      return ratio >= 0.5 || (candidateTokens.length >= 3 && matchedCount >= 2 && ratio >= 0.4);
    });

    return !isCovered;
  });
}

/**
 * Appends newly stated facts to the customer's CRM record under the given toolId.
 * Guarantees no duplicate entries.
 */
export function recordStatedFacts(
  customer: Customer,
  toolId: string,
  newFacts: string[]
): Customer {
  if (!customer.factsStated) {
    customer.factsStated = {};
  }
  if (!customer.factsStated[toolId]) {
    customer.factsStated[toolId] = [];
  }

  const currentList = customer.factsStated[toolId];
  for (const fact of newFacts) {
    const trimmed = fact.trim();
    if (!trimmed) continue;
    const exists = currentList.some(
      existing => normalizeText(existing) === normalizeText(trimmed)
    );
    if (!exists) {
      currentList.push(trimmed);
    }
  }

  return customer;
}

/**
 * Detects which candidate facts/features from the matched tool were mentioned in the AI reply.
 */
export function extractMentionedFacts(replyText: string, tool: Tool): string[] {
  const candidateFacts = [
    ...(tool.features || []),
    ...(tool.sales_points || []),
    ...(tool.use_cases || [])
  ];

  const cleanReply = replyText.toLowerCase().replace(/(\d+),(\d+)/g, "$1$2");
  const mentioned: string[] = [];

  for (const fact of candidateFacts) {
    const cleanFact = fact.toLowerCase().replace(/(\d+),(\d+)/g, "$1$2");

    // Check specific distinct numbers (e.g. 3600, 99, 9)
    const numbers = cleanFact.match(/\b\d+\b/g) || [];
    const significantWords = cleanFact
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !["with", "this", "that", "from", "plan", "user", "more"].includes(w));

    let isHit = false;

    // If fact has distinctive numbers
    if (numbers.length > 0) {
      const anyNumPresent = numbers.some(n => cleanReply.includes(n));
      const hasWord = significantWords.some(w => cleanReply.includes(w));
      if (anyNumPresent && hasWord) isHit = true;
    } else if (significantWords.length >= 2) {
      let matchCount = 0;
      for (const w of significantWords) {
        if (cleanReply.includes(w)) matchCount++;
      }
      if (matchCount / significantWords.length >= 0.5) isHit = true;
    }

    if (isHit && !mentioned.includes(fact)) {
      mentioned.push(fact);
    }
  }

  return mentioned;
}

/**
 * Scans text for any quoted price amounts tied to the matched tools.
 * If the quoted amount is below the tool's min_negotiable_pkr, clamps it to the floor.
 * Guarantees that the floor holds in code even if the AI model attempts an illegal discount.
 */
export function clampPriceFloors(text: string, matchedTools: Tool[]): string {
  if (!matchedTools || matchedTools.length === 0) return text;
  let clamped = text;

  for (const tool of matchedTools) {
    const floorPkr = tool.pricing?.min_negotiable_pkr;
    if (floorPkr && floorPkr > 0) {
      // 1. Matches: "Rs. 500", "Rs 800", "PKR 600", "Rupees 750"
      clamped = clamped.replace(
        /(?:rs\.?|pkr|rupees)\s*([0-9]{2,6})(?!\s*(?:voices|characters|words|hours|mins|sec|users|slot))/gi,
        (match, priceStr) => {
          const num = parseInt(priceStr.replace(/,/g, ""), 10);
          if (num > 0 && num < floorPkr) {
            console.log(`[Agent] Price floor clamped in code: Rs. ${num} -> Rs. ${floorPkr} for ${tool.name}`);
            return `Rs. ${floorPkr.toLocaleString()}`;
          }
          return match;
        }
      );

      // 2. Matches: "500 Rs", "800 PKR", "750 rupees"
      clamped = clamped.replace(
        /\b([0-9]{2,6})\s*(?:rs|pkr|rupees)\b/gi,
        (match, priceStr) => {
          const num = parseInt(priceStr.replace(/,/g, ""), 10);
          if (num > 0 && num < floorPkr) {
            console.log(`[Agent] Price floor clamped in code: ${num} Rs -> Rs. ${floorPkr} for ${tool.name}`);
            return `Rs. ${floorPkr.toLocaleString()}`;
          }
          return match;
        }
      );
    }

    const floorUsd = tool.pricing?.min_negotiable_usd;
    if (floorUsd && floorUsd > 0) {
      clamped = clamped.replace(/\$\s*([0-9]{1,4})\b/g, (match, priceStr) => {
        const num = parseInt(priceStr, 10);
        if (num > 0 && num < floorUsd) {
          console.log(`[Agent] USD price floor clamped in code: $${num} -> $${floorUsd} for ${tool.name}`);
          return `$${floorUsd}`;
        }
        return match;
      });
    }
  }

  return clamped;
}
