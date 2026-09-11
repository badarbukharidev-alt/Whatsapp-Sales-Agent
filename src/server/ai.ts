import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import { getSettings } from "./settings.js";

export interface NormalizedAIResponse {
  success: boolean;
  text: string;
  provider?: string;
  error?: string;
}

/**
 * Calls official Google Gemini API via official SDK with fallback to direct REST POST.
 */
export async function callOfficialGemini(apiKey: string, prompt: string, systemPrompt?: string): Promise<NormalizedAIResponse> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { success: false, text: "", provider: "Gemini", error: "Missing API Key" };

  const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-lite"];

  // 1. Try GoogleGenAI SDK
  try {
    const client = new GoogleGenAI({ apiKey: cleanKey });
    for (const model of candidateModels) {
      try {
        console.log(`[AI] Requesting Gemini SDK (model: ${model})...`);
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: systemPrompt || undefined,
            temperature: 0.7,
          }
        });

        const text = response.text?.trim();
        if (text && text.length > 0) {
          console.log(`[AI] Gemini SDK success via ${model} (${text.length} chars)`);
          return { success: true, text, provider: `Gemini (${model})` };
        }
      } catch (mErr: any) {
        console.warn(`[AI] Gemini SDK attempt with ${model} failed:`, mErr?.message || mErr);
      }
    }
  } catch (sdkErr: any) {
    console.warn("[AI] GoogleGenAI SDK init failed:", sdkErr?.message || sdkErr);
  }

  // 2. Direct REST POST fallback
  for (const model of candidateModels) {
    try {
      console.log(`[AI] Requesting Gemini REST API (model: ${model})...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      
      const payload: any = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
        }
      };

      if (systemPrompt) {
        payload.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
      }

      const resp = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 20000
      });

      const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text && text.length > 0) {
        console.log(`[AI] Gemini REST success via ${model} (${text.length} chars)`);
        return { success: true, text, provider: `Gemini REST (${model})` };
      }
    } catch (restErr: any) {
      const errMsg = restErr.response?.data?.error?.message || restErr.message;
      console.warn(`[AI] Gemini REST attempt with ${model} failed:`, errMsg);
    }
  }

  return { success: false, text: "", provider: "Gemini", error: "All Gemini models failed" };
}

/**
 * Calls Groq Cloud API (Ultra-fast Llama-3.3-70b-versatile).
 */
export async function callGroq(apiKey: string, prompt: string, systemPrompt?: string): Promise<NormalizedAIResponse> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { success: false, text: "", provider: "Groq", error: "Missing API Key" };

  const candidateModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"];

  for (const model of candidateModels) {
    try {
      console.log(`[AI] Requesting Groq Cloud API (${model})...`);
      const messages: any[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const resp = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model,
          messages,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            "Content-Type": "application/json",
          },
          timeout: 18000,
        }
      );

      const text = resp.data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 0) {
        console.log(`[AI] Groq success via ${model} (${text.length} chars)`);
        return { success: true, text, provider: `Groq (${model})` };
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error?.message || err?.message;
      console.warn(`[AI] Groq attempt with ${model} failed:`, errMsg);
    }
  }
  return { success: false, text: "", provider: "Groq", error: "All Groq models failed" };
}

/**
 * Calls OpenAI or OpenRouter API.
 */
export async function callOpenAI(apiKey: string, prompt: string, systemPrompt?: string): Promise<NormalizedAIResponse> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { success: false, text: "", provider: "OpenAI", error: "Missing API Key" };

  try {
    const isRouter = cleanKey.startsWith("sk-or-");
    const endpoint = isRouter 
      ? "https://openrouter.ai/api/v1/chat/completions" 
      : "https://api.openai.com/v1/chat/completions";
    
    const candidateModels = isRouter
      ? ["meta-llama/llama-3.3-70b-instruct", "google/gemini-2.0-flash-001", "deepseek/deepseek-chat"]
      : ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];

    for (const model of candidateModels) {
      try {
        console.log(`[AI] Requesting ${isRouter ? "OpenRouter" : "OpenAI"} API (${model})...`);
        const messages: any[] = [];
        if (systemPrompt) {
          messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: prompt });

        const resp = await axios.post(
          endpoint,
          {
            model,
            messages,
            temperature: 0.7,
          },
          {
            headers: {
              Authorization: `Bearer ${cleanKey}`,
              "Content-Type": "application/json",
            },
            timeout: 25000,
          }
        );

        const text = resp.data?.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 0) {
          console.log(`[AI] OpenAI/Router success (${text.length} chars)`);
          return { success: true, text, provider: `${isRouter ? "OpenRouter" : "OpenAI"} (${model})` };
        }
      } catch (err: any) {
        console.warn(`[AI] ${isRouter ? "OpenRouter" : "OpenAI"} failed with ${model}:`, err?.response?.data?.error?.message || err?.message);
      }
    }
  } catch (err: any) {
    console.warn("[AI] OpenAI/Router general failure:", err?.message);
  }
  return { success: false, text: "", provider: "OpenAI", error: "OpenAI request failed" };
}

/**
 * Builds a compact query for public GET fallbacks that preserves customer message,
 * matched tool details, conversation context, and strict anti-hallucination guardrails.
 *
 * `jsonMode` MUST be passed explicitly by callers that actually want raw JSON /
 * schema output preserved untouched (e.g. the LLM tool classifier). It used to be
 * guessed from keywords found anywhere in the prompt text ("json", "match",
 * "categor", "intent") — but ordinary sales-reply prompts legitimately contain
 * those same words (e.g. the "[SALES CONTROL DIRECTIVES] HIGH BUYING INTENT:"
 * line), which silently flipped normal customer replies into this raw-slice path
 * and truncated them BEFORE the customer's actual message, causing the AI to
 * respond with confused meta-commentary about its own missing prompt instead of
 * a sales reply. Keyword sniffing on `prompt` is intentionally not used anymore.
 */
export function buildCompactPublicQuery(prompt: string, systemPrompt?: string, jsonMode?: boolean): string {
  const isClassification =
    Boolean(jsonMode) ||
    // Narrow legacy fallback for callers that don't pass jsonMode explicitly:
    // only an UNAMBIGUOUS "this persona outputs JSON" system prompt counts.
    Boolean(systemPrompt && /\bjson[\s-]*only\b|\bstrict\s*json\b|\boutput\s+valid\s+json\b/i.test(systemPrompt));

  // For classification tasks, preserve the prompt and schema intact
  if (isClassification) {
    if (prompt.length <= 1000) return prompt;
    return prompt.slice(0, 1000);
  }

  // 1. Extract customer message section across all prompt variations
  let customerMsg = "";
  const matchMsg = prompt.match(
    /(?:CUSTOMER'S LATEST MESSAGE\(S\)|CUSTOMER'S NEW MESSAGE\(S\)):\s*["']?([\s\S]*?)["']?\s*(?:\nReply as|\nProvide your|\n[A-Z_]+:|$)/i
  );
  if (matchMsg && matchMsg[1]) {
    customerMsg = matchMsg[1].trim();
  } else {
    const lastUserMatch = prompt.match(/(?:Customer|User):\s*["']?([^\n"']+)["']?/gi);
    if (lastUserMatch && lastUserMatch.length > 0) {
      customerMsg = lastUserMatch[lastUserMatch.length - 1]
        .replace(/^(?:Customer|User):\s*["']?/i, "")
        .replace(/["']?$/, "")
        .trim();
    }
  }

  // 2. Extract matched tool(s) and structured knowledge
  let toolSummary = "";
  // Also extract links separately so they survive any truncation
  let extractedLinksBlock = "";

  const toolMatch = prompt.match(
    /(?:===\s*PRODUCT CATALOG:\s*([^\n=]+)\s*===|===\s*MATCHED TOOL:\s*([^\n=]+)\s*===)/i
  );

  if (toolMatch) {
    const toolName = (toolMatch[1] || toolMatch[2]).trim();
    const descMatch = prompt.match(/(?:Description \& Problem Solved|Description):\s*([^\n]+)/i);
    const priceMatch = prompt.match(/(?:Pricing|Regular Price|List Price):\s*([^\n]+)/i);
    // FIXED: match the actual header used by prompt-service.ts: "Key Features:"
    const featuresMatch = prompt.match(/Key Features:\s*\n([\s\S]*?)(?=\n[A-Z]|\n===|$)/i);
    // FIXED: match the actual header used by prompt-service.ts: "Official Links & Downloads:"
    const linksMatch = prompt.match(/Official Links \& Downloads:\s*\n([\s\S]*?)(?=\n[A-Z]|\n===|$)/i);
    const sectionsMatch = prompt.match(/(?:Constant Dynamic Section Message|\[SECTION:[^\]]+\])\s*\n([\s\S]*?)(?=\n\[SECTION|\n===|\n[A-Z]|$)/i);

    const desc = descMatch ? descMatch[1].slice(0, 140).trim() : "";
    const price = priceMatch ? priceMatch[1].slice(0, 80).trim() : "";
    const feat = featuresMatch
      ? featuresMatch[1].split("\n").filter(Boolean).slice(0, 2).map(f => f.replace(/^[\*\-]\s*/, "")).join("; ").slice(0, 160)
      : "";
    // Extract all link lines so we can guarantee they appear even if prompt is long
    const allLinkLines = linksMatch
      ? linksMatch[1].split("\n").filter(Boolean).slice(0, 3)
      : [];
    const link = allLinkLines.slice(0, 1).join(" ").slice(0, 200);
    extractedLinksBlock = allLinkLines.length > 0
      ? `Official Links & Downloads:\n${allLinkLines.map(l => `  ${l.trim()}`).join("\n")}`
      : "";

    const sec = sectionsMatch ? sectionsMatch[1].slice(0, 120).trim() : "";

    toolSummary = `ACTIVE TOOL: ${toolName}. ${desc ? `Desc: ${desc}. ` : ""}${price ? `Price: ${price}. ` : ""}${feat ? `Features: ${feat}. ` : ""}${link ? `Link: ${link}. ` : ""}${sec ? `Details: ${sec}. ` : ""}`;

    if (/voice\s*delta|voicedelta/i.test(toolName)) {
      toolSummary += " [Product is VoiceDelta. Includes ElevenLabs & OpenAI voice models. Do NOT rename or call product ElevenLabs.]";
    }
    if (/clip\s*shield|clipshield/i.test(toolName)) {
      toolSummary += " [ClipShield is a Windows desktop tool for YouTube copyright bypass/removal. It is IN STOCK and AVAILABLE.]";
    }
  } else if (prompt.includes("EXTERNAL PRODUCT INQUIRY:") || prompt.includes("[EXTERNAL PRODUCT INQUIRY")) {
    const unkMatch = prompt.match(
      /(?:\[EXTERNAL PRODUCT INQUIRY:\s*["']?([^\]"']+)["']?\]|EXTERNAL PRODUCT INQUIRY:\s*["']?([^\n"']+)["']?)/i
    );
    const unkName = unkMatch ? (unkMatch[1] || unkMatch[2]).trim() : "requested software";
    toolSummary = `EXTERNAL INQUIRY: Customer asked for uncataloged item "${unkName}". Honestly state we do not sell "${unkName}", and ask what content creation or editing task they want to solve.`;
  } else if (prompt.includes("[AVAILABLE STORE TOOLS]") || prompt.includes("[STORE CATALOG OVERVIEW]")) {
    const catalogMatch = prompt.match(
      /(?:\[AVAILABLE STORE TOOLS\]|\[STORE CATALOG OVERVIEW\])\s*\n([\s\S]*?)(?=\n\[|INSTRUCTION:|$)/i
    );
    toolSummary = catalogMatch && catalogMatch[1].trim()
      ? `Store Catalog:\n${catalogMatch[1].trim().slice(0, 260)}`
      : "Store Catalog: 1. ClipShield (YouTube copyright removal/claims bypass, Rs 1500/mo). 2. VoiceDelta (AI voice generator and cloning with 3600+ voices, Rs 1199/mo).";
  } else {
    toolSummary = "Store Catalog: 1. ClipShield (YouTube copyright removal/claims bypass, Rs 1500/mo). 2. VoiceDelta (AI voice generator and cloning with 3600+ voices, Rs 1199/mo).";
  }

  // 3. Extract recent dialogue turns for conversational context
  let recentContext = "";
  const turnsMatch = prompt.match(
    /\[RECENT CONVERSATION TURNS\]:\s*\n([\s\S]*?)(?=\nCUSTOMER'S LATEST MESSAGE|\nCUSTOMER'S NEW MESSAGE|$)/i
  );
  if (turnsMatch && turnsMatch[1]) {
    const turns = turnsMatch[1].split("\n").filter(Boolean).slice(-3).join(" | ");
    if (turns) {
      recentContext = `Recent Chat: ${turns.slice(0, 200)}`;
    }
  }

  // 3b. Extract sales control directives (templateJustSent, PAYMENT MODE, LINK MODE, etc.)
  let salesDirectives = "";
  const ctrlMatch = prompt.match(/\[SALES CONTROL DIRECTIVES\]\s*\n([\s\S]*?)(?=\n\[RECENT|\nCUSTOMER'S|$)/i);
  if (ctrlMatch && ctrlMatch[1]) {
    salesDirectives = `DIRECTIVE: ${ctrlMatch[1].trim().replace(/\n+/g, " | ")}`;
  }

  // 3c. Extract previously-quoted-rates consistency line so the fallback model
  // never states a different price than what was already sent to this customer.
  let quotedRatesLine = "";
  const quotedMatch = prompt.match(/Previously Quoted Rates[^:]*:\s*([^\n]+)/i);
  if (quotedMatch && quotedMatch[1]) {
    quotedRatesLine = `ALREADY QUOTED (repeat these exact numbers, never contradict): ${quotedMatch[1].trim()}`;
  }

  // 4. Strict guardrails against fake personas, SEO hallucinations, and repeated greetings
  const roleRules = [
    "Role: Real human Pakistani software consultant chatting on WhatsApp. MUST reply in Roman Urdu only (Urdu words written in English letters, like 'bhai', 'kitna', 'Walaikum Assalam'). NEVER reply in English.",
    "RULES: (1) NEVER invent a persona name like 'Aamir'. (2) NEVER offer SEO or web design. (3) ClipShield and VoiceDelta are ALWAYS available. (4) For VoiceDelta, always call it VoiceDelta (not ElevenLabs). (5) In ongoing chats, do NOT repeat 'AOA' or the customer's name on every message. (6) NEVER use markdown link syntax [text](url) — always write URLs as plain text. (7) NEVER fabricate account numbers, payment details, or bank info — only use what is given.",
  ].join("\n");

  // If template was JUST sent, do not append extractedLinksBlock to prevent duplicate links
  if (salesDirectives.includes("template message was JUST sent")) {
    extractedLinksBlock = "";
  }

  // Build body parts (excluding the guaranteed links block)
  const bodyParts = [
    roleRules,
    toolSummary,
    quotedRatesLine,
    salesDirectives,
    recentContext,
    customerMsg ? `Customer message: "${customerMsg}"` : prompt.slice(-250),
    "Reply naturally as a helpful Pakistani WhatsApp seller in Roman Urdu:",
  ].filter(Boolean);

  // Append extractedLinksBlock at end so it always appears — even if body is truncated
  const fullQuery = [...bodyParts, extractedLinksBlock].filter(Boolean).join("\n\n");
  return fullQuery;
}

/**
 * Calls public backup proxy endpoint with sanitized prompt length and strict validation.
 */
async function callPublicFallback(provider: string, prompt: string, systemPrompt?: string, jsonMode?: boolean): Promise<NormalizedAIResponse> {
  const compactQuery = buildCompactPublicQuery(prompt, systemPrompt, jsonMode);
  // Raised from 1000 to 3000 chars so tool details + links are NOT truncated away
  const safeQuery = compactQuery.length > 3000 ? compactQuery.substring(0, 3000) : compactQuery;
  const encodedQuery = encodeURIComponent(safeQuery);

  let url = `https://api-rebix.zone.id/api/gemini?q=${encodedQuery}`;
  if (provider === "DeepSeek") url = `https://api-rebix.zone.id/api/deepseek-v3?q=${encodedQuery}`;
  if (provider === "GPTLogic") {
    const promptParam = encodeURIComponent(systemPrompt || "You are a helpful Pakistani sales closer.");
    url = `https://api-rebix.zone.id/api/gptlogic?q=${encodedQuery}&prompt=${promptParam}`;
  }

  try {
    console.log(`[AI] Attempting public fallback ${provider}...`);
    const response = await axios.get(url, {
      timeout: 12000,
      headers: { "User-Agent": "WhatsApp-Sales-Agent/1.0" }
    });
    const data = response.data;

    // Check if API returned an error status in response body
    if (data && typeof data === "object") {
      if (data.status === false || (typeof data.status === "number" && data.status >= 400)) {
        console.warn(`[AI] Public fallback ${provider} returned error status:`, data);
        return { success: false, text: "", provider };
      }
    }

    let text = "";
    if (typeof data === "string") {
      text = data.trim();
    } else if (typeof data === "object" && data !== null) {
      const candidate = data.message ?? data.response ?? data.result ?? data.reply ?? data.text ?? data.content ?? data.data;
      if (typeof candidate === "string") text = candidate.trim();
    }

    // Reject error strings that pretend to be replies
    if (
      text &&
      !text.startsWith('{"error"') &&
      !text.includes("plan quota") &&
      !text.includes("credit pack") &&
      text.length > 3
    ) {
      console.log(`[AI] Public fallback ${provider} succeeded (${text.length} chars)`);
      return { success: true, text, provider: `${provider} (Public)` };
    }
  } catch (err: any) {
    console.warn(`[AI] Public fallback ${provider} failed:`, err?.message);
  }
  return { success: false, text: "", provider };
}

/**
 * Central askAI function:
 * 1. Checks configured API keys (Gemini / Groq / OpenAI) from user settings or process.env.
 * 2. Attempts configured official/cloud APIs in order of preference.
 * 3. Falls back to public proxies if official keys are absent or failed.
 * 4. Returns safe fallback string if all fail, without crashing WhatsApp connection.
 */
export async function askAI(prompt: string, systemPrompt?: string, userId?: string, jsonMode?: boolean): Promise<string> {
  const settings = await getSettings(userId);
  const geminiKey = (settings as any).geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  const groqKey = (settings as any).groqApiKey?.trim() || process.env.GROQ_API_KEY?.trim();
  const openAiKey = (settings as any).openAiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  const preferred = (settings.preferredApi || "gemini").toLowerCase();

  // Helper list of official caller attempts based on priority
  const attempts: Array<() => Promise<NormalizedAIResponse>> = [];

  if (preferred.includes("groq")) {
    if (groqKey) attempts.push(() => callGroq(groqKey, prompt, systemPrompt));
    if (geminiKey) attempts.push(() => callOfficialGemini(geminiKey, prompt, systemPrompt));
    if (openAiKey) attempts.push(() => callOpenAI(openAiKey, prompt, systemPrompt));
  } else if (preferred.includes("openai") || preferred.includes("gpt")) {
    if (openAiKey) attempts.push(() => callOpenAI(openAiKey, prompt, systemPrompt));
    if (geminiKey) attempts.push(() => callOfficialGemini(geminiKey, prompt, systemPrompt));
    if (groqKey) attempts.push(() => callGroq(groqKey, prompt, systemPrompt));
  } else {
    // Default: Gemini first
    if (geminiKey) attempts.push(() => callOfficialGemini(geminiKey, prompt, systemPrompt));
    if (groqKey) attempts.push(() => callGroq(groqKey, prompt, systemPrompt));
    if (openAiKey) attempts.push(() => callOpenAI(openAiKey, prompt, systemPrompt));
  }

  // Execute configured official API keys first
  for (const attempt of attempts) {
    const res = await attempt();
    if (res.success && res.text) {
      return res.text;
    }
  }

  // Fallback to public endpoints if official keys failed or not configured
  console.warn("[AI] Official API keys not available or failed. Trying public proxy fallbacks...");
  const publicProviders = preferred.includes("deepseek")
    ? ["DeepSeek", "Gemini", "GPTLogic"]
    : ["Gemini", "DeepSeek", "GPTLogic"];

  for (const prov of publicProviders) {
    const res = await callPublicFallback(prov, prompt, systemPrompt, jsonMode);
    if (res.success && res.text) {
      return res.text;
    }
  }

  console.error("[AI] All AI endpoints failed or timed out. Please configure an API Key (Gemini, Groq, or OpenAI) in Settings.");

  // Safe conversational fallback in case of total external API outage
  const lang = settings.language || "Roman Urdu";
  if (lang.toLowerCase().includes("urdu")) {
    return "Haan bhai, abhi thoda network issue hai. Thodi der baad msg krna ya try krlo.";
  }
  return "Hey, having a brief network issue. Please try again in a moment.";
}
