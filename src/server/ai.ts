import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import { getSettings } from "./settings.js";

export interface NormalizedAIResponse {
  success: boolean;
  text: string;
  provider?: string;
}

const ALL_PROVIDERS = ["Gemini", "DeepSeek", "Claude", "GPTLogic"] as const;
type ProviderName = typeof ALL_PROVIDERS[number];

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn("[AI] Failed to init GoogleGenAI SDK:", e);
    }
  }
  return geminiClient;
}

async function callOfficialGemini(prompt: string, systemPrompt?: string): Promise<NormalizedAIResponse> {
  const client = getGeminiClient();
  if (!client) return { success: false, text: "", provider: "Gemini (Official)" };

  try {
    console.log("[AI] Requesting Official Gemini API...");
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt || undefined,
        temperature: 0.7,
      }
    });

    const text = response.text?.trim();
    if (text) {
      return { success: true, text, provider: "Gemini (Official)" };
    }
  } catch (err: any) {
    console.warn("[AI] Official Gemini API failed:", err?.message || err);
  }
  return { success: false, text: "", provider: "Gemini (Official)" };
}

/**
 * Builds the URL for each of the 4 supported GET APIs
 */
function buildProviderUrl(provider: ProviderName, query: string, systemPrompt?: string): string {
  const encodedQuery = encodeURIComponent(query);
  switch (provider) {
    case "Gemini":
      return `https://api-rebix.zone.id/api/gemini?q=${encodedQuery}`;
    case "DeepSeek":
      return `https://api-rebix.zone.id/api/deepseek-v3?q=${encodedQuery}`;
    case "Claude":
      return `https://api-rebix.zone.id/api/claude-haiku?q=${encodedQuery}`;
    case "GPTLogic": {
      const prompt = encodeURIComponent(systemPrompt || "You are a helpful WhatsApp sales agent.");
      return `https://api-rebix.zone.id/api/gptlogic?q=${encodedQuery}&prompt=${prompt}`;
    }
    default:
      return `https://api-rebix.zone.id/api/gemini?q=${encodedQuery}`;
  }
}

/**
 * Calls a single AI endpoint with a strict 15-second timeout and normalizes the JSON response.
 */
async function callSingleProvider(
  provider: ProviderName,
  query: string,
  systemPrompt?: string
): Promise<NormalizedAIResponse> {
  // If Gemini provider and official API key is present, try official SDK first
  if (provider === "Gemini" && process.env.GEMINI_API_KEY) {
    const officialRes = await callOfficialGemini(query, systemPrompt);
    if (officialRes.success && officialRes.text) {
      return officialRes;
    }
  }

  const url = buildProviderUrl(provider, query, systemPrompt);
  try {
    console.log(`[AI] Requesting ${provider} API...`);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "WhatsApp-Sales-Agent/1.0",
        "Accept": "application/json, text/plain, */*",
      }
    });

    const data = response.data;
    if (!data) {
      console.warn(`[AI] ${provider} returned empty response body.`);
      return { success: false, text: "", provider };
    }

    let extractedText = "";

    if (typeof data === "string") {
      extractedText = data.trim();
    } else if (typeof data === "object") {
      // Normalize different possible JSON keys: message, response, result, reply, text, content
      const candidate =
        data.message ??
        data.response ??
        data.result ??
        data.reply ??
        data.text ??
        data.content ??
        data.data;

      if (typeof candidate === "string") {
        extractedText = candidate.trim();
      } else if (candidate && typeof candidate === "object") {
        extractedText = JSON.stringify(candidate);
      }
    }

    if (extractedText && extractedText.length > 0) {
      console.log(`[AI] Successfully received response from ${provider} (${extractedText.length} chars)`);
      return {
        success: true,
        text: extractedText,
        provider
      };
    } else {
      console.warn(`[AI] ${provider} returned JSON but no usable text field found:`, JSON.stringify(data));
      return { success: false, text: "", provider };
    }
  } catch (error: any) {
    const errorMsg = error?.response?.status ? `HTTP ${error.response.status}` : error?.message || error;
    console.warn(`[AI] ${provider} failed (reason: ${errorMsg}).`);
    return { success: false, text: "", provider };
  }
}

/**
 * Central askAI function:
 * 1. Checks user preferred LLM from settings (Gemini / DeepSeek / Claude / GPTLogic).
 * 2. Attempts preferred API first.
 * 3. On failure / timeout / invalid response, automatically falls back to remaining APIs in order.
 * 4. Normalizes all responses.
 * 5. Returns safe fallback string if all 4 endpoints fail, without crashing WhatsApp connection.
 */
export async function askAI(prompt: string, systemPrompt?: string): Promise<string> {
  const settings = await getSettings();
  const preferred = (settings.defaultLLM as ProviderName) || "Gemini";

  // Build fallback order starting with preferred provider
  const fallbackOrder: ProviderName[] = [
    preferred,
    ...ALL_PROVIDERS.filter((p) => p !== preferred),
  ];

  console.log(`[AI] Starting request. Provider sequence: ${fallbackOrder.join(" -> ")}`);

  for (const provider of fallbackOrder) {
    const res = await callSingleProvider(provider, prompt, systemPrompt);
    if (res.success && res.text) {
      return res.text;
    }
    console.log(`[AI] Trying next available fallback provider in chain...`);
  }

  console.error("[AI] All AI endpoints failed or timed out.");
  
  // Safe conversational fallback in case of total external API outage
  const lang = settings.language || "Roman Urdu";
  if (lang.toLowerCase().includes("urdu")) {
    return "Haan bhai, abhi thoda network issue hai. Thodi der baad msg krna ya try krlo.";
  }
  return "Hey, having a brief network issue. Please try again in a moment.";
}


