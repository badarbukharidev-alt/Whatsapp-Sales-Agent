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
 * Builds a compact query for public GET fallbacks that preserves customer message and intent.
 */
function buildCompactPublicQuery(prompt: string, systemPrompt?: string): string {
  const isClassification =
    Boolean(systemPrompt && /json|classif|match|categor/i.test(systemPrompt)) ||
    /json|classifier|categor|intent/i.test(prompt);

  // For classification tasks, preserve the prompt and schema intact
  if (isClassification) {
    if (prompt.length <= 1000) return prompt;
    return prompt.slice(0, 1000);
  }

  // If conversational prompt is short, use as is
  if (prompt.length <= 600) return prompt;

  // Extract customer message section if present
  let customerMsg = "";
  const matchMsg = prompt.match(/CUSTOMER'S NEW MESSAGE\(S\):\s*["']?([\s\S]*?)["']?\s*(?:Provide your|$)/i);
  if (matchMsg && matchMsg[1]) {
    customerMsg = matchMsg[1].trim();
  }

  // Determine active tool summary based on matched catalog tool in prompt
  let toolSummary = "";
  const hasClipShield = /clipshield/i.test(prompt);
  const hasVoiceDelta = /voicedelta/i.test(prompt);

  if (hasClipShield && !hasVoiceDelta) {
    toolSummary = "Tool: ClipShield (YouTube copyright claim removal & video repurposing, Rs. 1,500/month).";
  } else if (hasVoiceDelta && !hasClipShield) {
    toolSummary = "Tool: VoiceDelta (Rs. 1,199/month, 3,600+ AI voices, voice cloning).";
  } else if (hasClipShield && hasVoiceDelta) {
    // Check which one is the active matched tool in the prompt
    if (/MATCHED CATALOG TOOL:[^\n]*ClipShield/i.test(prompt)) {
      toolSummary = "Tool: ClipShield (YouTube copyright claim removal & video repurposing, Rs. 1,500/month).";
    } else {
      toolSummary = "Tool: VoiceDelta (Rs. 1,199/month, 3,600+ AI voices, voice cloning).";
    }
  }

  const roleRule = "Pakistani WhatsApp sales representative. Casual Roman Urdu only. Short conversational reply.";
  const parts = [
    roleRule,
    toolSummary,
    customerMsg ? `Customer said: "${customerMsg}"` : prompt.slice(-300),
    "Reply in Roman Urdu:"
  ].filter(Boolean);

  return parts.join("\n");
}

/**
 * Calls public backup proxy endpoint with sanitized prompt length and strict validation.
 */
async function callPublicFallback(provider: string, prompt: string, systemPrompt?: string): Promise<NormalizedAIResponse> {
  const compactQuery = buildCompactPublicQuery(prompt, systemPrompt);
  const safeQuery = compactQuery.length > 1000 ? compactQuery.substring(0, 1000) : compactQuery;
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
export async function askAI(prompt: string, systemPrompt?: string, userId?: string): Promise<string> {
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
    const res = await callPublicFallback(prov, prompt, systemPrompt);
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
