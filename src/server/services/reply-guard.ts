import { Tool } from "../../types.js";

/**
 * Reply guards: pure post-processing + conversation-state helpers applied to
 * every outgoing agent reply, so correctness never depends on the LLM behaving.
 */

/** Any http(s) / www URL token. */
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>()\[\]{}"'`]+/gi;

/**
 * Phrases that only show up when the model breaks character and starts talking
 * ABOUT the prompt/assistant framework instead of replying as the seller — e.g.
 * "Got it — no reset, no repeated name. Ready for the next message. What did he
 * say?" This happens when a weak fallback model is handed a cut-off or overly
 * meta prompt and echoes the instructions back instead of using them.
 */
const META_LEAK_REGEX =
  /(?:\bgot it\b[^.!?]{0,40}(?:ready for|next message)|what did (?:he|she|they) say|what'?s the message (?:from|the customer)|message (?:from )?(?:the )?customer that i (?:need|have) to respond|your message (?:got|seems) cut off|could you resend|please resend|as an ai\b|i(?:'m| am) an ai\b|i don'?t have (?:access|context)|no reset,? no repeated name|i(?:'ll| will) reply (?:directly|now)\s*$)/i;

/** True when the reply breaks character and talks about the prompt instead of answering it. */
export function isMetaLeak(text: string): boolean {
  if (!text) return false;
  return META_LEAK_REGEX.test(text);
}

/** Obvious placeholder hosts a model invents when it has no real link. */
const PLACEHOLDER_HOST_REGEX =
  /(?:example\.(?:com|org|net)|yourdomain|your-?site|placeholder|dummy|test\.com|xyz\.com|abc\.com|link\.com|sample\.com|domain\.com)/i;

/** Words that can stand alone as a "yes" in Roman Urdu / English WhatsApp chat. */
const AFFIRMATION_WORD_REGEX =
  /^(?:g|gg|gee|ji|jee|jii|ha|haan|han|hn|hnji|hanji|jihan|ok|oky|okay|okk|k|acha|achaa|achha|theek|thek|thik|sahi|yes|ya|yeah|yep|yup|sure|done|zaroor|bilkul|bhejo|bhej|bhejdo|bhejde|bhejein|bhejen|send|dedo|dedein|krdo|kardo|kar|do|karo|please|plz|pls|bhai|bro|sir)$/i;

/** Trailing filler words that don't disqualify an otherwise-bare "yes". */
const AFFIRMATION_FILLER_REGEX = /^(?:hai|hain|hy|he|na|nah|yr|yaar|jani|jaan|zra|zara|abhi|to|tou)$/i;

/** Offer verbs an agent uses when proposing to send something ("bhej doon?", "share kar deta hoon"). */
const OFFER_VERB_SOURCE =
  "bhej(?:un|oon|on|u|ou)?|bhejta|bhejdun|bhej\\s*d(?:oon|un|u|ta)|" +
  "(?:send|share|de|kar|bhej|bata)\\s*(?:kar\\s*)?(?:d(?:oon|un|u|e|ee)|deta|deti)\\s*(?:h(?:oon|u|un|o|ai))?|" +
  "batau|bata\\s*(?:doon|dun)|chahiye|chahye|karun|karoon";
const OFFER_VERB_REGEX = new RegExp(`(?:${OFFER_VERB_SOURCE})`, "i");

/** Roman Urdu particles / clitics that cannot legally start a sentence. */
const CONTINUATION_STARTER_REGEX =
  /^(?:ko|ka|ki|ke|se|me|mein|par|pe|aur|ya|taake|takay|takke|jis|jise|jin|jo|hai|hain|tha|thi|the|kar|karta|karti|karte|karne|karna|kiya|deta|deti|dete|diya|raha|rahi|rahe|wala|wali|wale|bhi|to|ho|hota|hoti|hote|nahi|na|kyunke|kyunki|lekin|magar|phir|is|us|iska|uska|jab|agar)\b/i;

export type PendingOffer = "link" | "payment" | "details";

/**
 * True when the customer's whole message is nothing but a "yes" / "send it".
 * These turns carry no product keywords, so without this they resolve to no
 * intent at all and the agent re-asks the question it already asked.
 */
export function isBareAffirmation(text: string): boolean {
  if (!text) return false;
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  let sawAffirmation = false;
  for (const w of words) {
    if (AFFIRMATION_WORD_REGEX.test(w)) {
      sawAffirmation = true;
      continue;
    }
    if (AFFIRMATION_FILLER_REGEX.test(w)) continue;
    return false;
  }
  return sawAffirmation;
}

/**
 * Detects what the agent itself last offered to send, so a bare "G" can be
 * resolved into the concrete action the customer just accepted.
 */
export function detectPendingOffer(lastAgentText?: string | null): PendingOffer | null {
  if (!lastAgentText) return null;
  const text = lastAgentText.toLowerCase();
  const isOffer = text.includes("?") || OFFER_VERB_REGEX.test(text);
  if (!isOffer) return null;

  const verb = `(?:${OFFER_VERB_SOURCE})`;
  const near = (subject: RegExp) => {
    const s = `(?:${subject.source})`;
    return new RegExp(`${s}[^.?!\\n]{0,60}${verb}|${verb}[^.?!\\n]{0,60}${s}`, "i").test(text);
  };

  if (near(/(?:payment\s*details|account\s*(?:number|details|title)|jazz\s*cash|jazzcash|easy\s*paisa|easypaisa|raast)/)) {
    return "payment";
  }
  if (near(/(?:link|links|download|setup\s*guide|trial|portal)/)) return "link";
  if (near(/(?:details|tafseel|tafsil|features|specs)/)) return "details";
  return null;
}

/** Collects every URL that is legitimately ours (locked product first). */
export function collectAllowedUrls(tools: Tool[]): string[] {
  const urls: string[] = [];
  for (const t of tools || []) {
    for (const l of t.links || []) {
      const url = (l?.url || "").trim();
      if (url && !urls.includes(url)) urls.push(url);
    }
  }
  return urls;
}

function normalizeUrl(url: string): string {
  return url
    .trim()
    .replace(/[).,;:!?"'\]]+$/, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function hostOf(url: string): string {
  return normalizeUrl(url).split("/")[0];
}

/**
 * WhatsApp renders no markdown, so `[title](url)` reaches the customer as
 * literal brackets. Flatten it to plain text the moment it appears.
 */
export function flattenMarkdownLinks(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[([^\]\n]{1,80})\]\(\s*((?:https?:\/\/|www\.)[^\s)]+)\s*\)/gi, (_m, label, url) => {
      const clean = String(label).trim().replace(/[:\-–]\s*$/, "");
      return clean ? `${clean}: ${url}` : String(url);
    })
    .replace(/<((?:https?:\/\/|www\.)[^\s>]+)>/gi, "$1");
}

/**
 * Hard guarantee that the agent can only ever send URLs we actually own.
 * Any invented / truncated / placeholder URL is rewritten to the real one, or
 * removed outright when the product has no link configured.
 */
export function enforceKnownLinks(
  text: string,
  allowedUrls: string[]
): { text: string; replaced: number; removed: number } {
  if (!text) return { text, replaced: 0, removed: 0 };

  const allowed = (allowedUrls || []).map((u) => u.trim()).filter(Boolean);
  const allowedNormalized = allowed.map(normalizeUrl);
  const allowedHosts = allowed.map(hostOf);

  let replaced = 0;
  let removed = 0;

  let out = text.replace(URL_REGEX, (raw) => {
    const trailing = raw.match(/[).,;:!?"'\]]+$/)?.[0] || "";
    const url = trailing ? raw.slice(0, raw.length - trailing.length) : raw;
    const normalized = normalizeUrl(url);

    const exactIndex = allowedNormalized.indexOf(normalized);
    if (exactIndex >= 0 && !PLACEHOLDER_HOST_REGEX.test(url)) {
      // Already one of ours: emit the canonical stored form.
      return allowed[exactIndex] + trailing;
    }

    // Same host but a mangled / truncated path -> restore the real URL.
    const hostIndex = allowedHosts.indexOf(hostOf(url));
    if (hostIndex >= 0) {
      replaced++;
      return allowed[hostIndex] + trailing;
    }

    if (allowed.length > 0) {
      replaced++;
      return allowed[0] + trailing;
    }

    removed++;
    return "";
  });

  if (removed > 0) {
    // Clean up the dangling "yeh lein:" / "here:" left behind by the removal.
    out = out
      .replace(/[ \t]*[:\-–]\s*(?=\n|$)/g, "")
      .replace(/\(\s*\)/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+(?=[.,!?])/g, "");
  }

  return { text: out.trim(), replaced, removed };
}

/**
 * Drops a leading sentence fragment — the signature of a model that was handed
 * a prompt cut mid-sentence and simply continued it ("ko bypass kar sake. ...").
 */
export function stripLeadingContinuationFragment(text: string): string {
  if (!text) return text;
  const trimmed = text.trimStart();
  const firstChar = trimmed[0];
  if (!firstChar || firstChar !== firstChar.toLowerCase() || !/[a-z]/i.test(firstChar)) {
    return text;
  }

  // Only act on the unambiguous tell: the reply opens with a Roman-Urdu particle
  // / clitic that can never legally start a sentence ("ko bypass kar sake. ...").
  // Anything else — a lowercase word that is a plausible opener — is left alone
  // so we never eat a legitimate short reply.
  if (!CONTINUATION_STARTER_REGEX.test(trimmed)) return text;

  const terminator = trimmed.search(/[.!?]\s/);
  if (terminator < 0) return text;

  const rest = trimmed.slice(terminator + 1).trimStart();
  if (rest.length < 20) return text;

  // The dropped fragment must be short — a real leading sentence that merely
  // happens to be lowercased would be much longer than a truncation stub.
  if (terminator > 80) return text;

  return rest;
}

/**
 * Stops the "shall I send it?" loop: if the customer already accepted the offer,
 * the reply must deliver, not ask the same question again.
 */
export function stripRepeatedOffer(text: string, lastAgentText?: string | null): string {
  const pending = detectPendingOffer(lastAgentText);
  if (!pending || !text) return text;

  const lines = text.split(/\n/);
  const kept = lines.filter((line) => {
    if (!line.includes("?")) return true;
    return detectPendingOffer(line) !== pending;
  });

  const result = kept.join("\n").trim();
  return result.length > 0 ? result : text;
}
