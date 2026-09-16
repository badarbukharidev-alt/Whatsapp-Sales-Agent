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

/** A money amount carrying an explicit currency marker. */
const REPLY_PRICE_REGEX =
  /(?:rs\.?|pkr|rupees)\s*([0-9][0-9,]{2,8})|([0-9][0-9,]{2,8})\s*(?:rs\b|pkr\b|rupees\b)/gi;

function parseAmount(raw: string): number {
  return parseInt(raw.replace(/[,\s]/g, ""), 10);
}

/**
 * Splits into sentence-ish chunks, keeping line breaks meaningful.
 *
 * The lookbehinds matter: "Rs." ends in a period, so a naive split would tear
 * "Rs. 25,000" into two pieces and the currency marker would no longer sit next
 * to the number — which silently defeats the price and payment guards below.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<!\bRs\.)(?<!\bPKR\.)(?<!\bNo\.)(?<=[.!?])\s+|\n/)
    .filter((s) => s && s.length > 0);
}

export interface PriceEnforcementResult {
  text: string;
  /** Amounts that were not backed by the catalog and got removed. */
  removed: number[];
}

/**
 * Deletes any price the model invented.
 *
 * The catalog is the only place prices exist. An amount is accepted when it is
 * one of the configured figures, or falls inside the configured negotiation band
 * (so a legitimate in-range counter-offer survives). Anything else — a rate that
 * simply is not ours — has its sentence dropped rather than being silently
 * rewritten to a different number, because "correcting" an invented price to a
 * nearby one is just a second guess.
 */
export function enforceCatalogPrices(text: string, allowedAmounts: number[]): PriceEnforcementResult {
  if (!text || !allowedAmounts || allowedAmounts.length === 0) return { text, removed: [] };

  const allowed = new Set(allowedAmounts);
  const min = Math.min(...allowedAmounts);
  const max = Math.max(...allowedAmounts);
  const removed: number[] = [];

  const kept = splitSentences(text).filter((sentence) => {
    REPLY_PRICE_REGEX.lastIndex = 0;
    for (const m of sentence.matchAll(REPLY_PRICE_REGEX)) {
      const amount = parseAmount(m[1] || m[2]);
      if (!Number.isFinite(amount)) continue;
      if (allowed.has(amount)) continue;
      if (amount >= min && amount <= max) continue; // inside the real negotiation band
      removed.push(amount);
      return false;
    }
    return true;
  });

  return { text: kept.join(" ").replace(/\s{2,}/g, " ").trim(), removed };
}

/**
 * Things that look like somewhere to send money: a Pakistani mobile wallet
 * number, an IBAN, or a long bank account number.
 */
const PAYMENT_IDENTIFIER_REGEX =
  /\b(?:PK\d{2}[A-Z0-9]{16,20}|0\d{3}[-\s]?\d{7}|\d{11,20})\b/gi;

function normalizeIdentifier(value: string): string {
  return value.replace(/[\s-]/g, "").toLowerCase();
}

export interface PaymentEnforcementResult {
  text: string;
  /** Identifiers that were not configured and got removed. */
  removed: string[];
}

/**
 * Deletes any account/wallet/IBAN number that is not one of the configured
 * payment accounts.
 *
 * Payment details exist in exactly one place — the settings the admin saved. A
 * model handed no accounts will still cheerfully produce a plausible-looking
 * one, and a customer cannot tell the difference, so anything unrecognised has
 * its sentence dropped outright.
 */
export function enforceKnownPaymentDetails(text: string, allowedIdentifiers: string[]): PaymentEnforcementResult {
  if (!text) return { text, removed: [] };

  const allowed = new Set((allowedIdentifiers || []).filter(Boolean).map(normalizeIdentifier));
  const removed: string[] = [];

  const kept = splitSentences(text).filter((sentence) => {
    PAYMENT_IDENTIFIER_REGEX.lastIndex = 0;
    for (const m of sentence.matchAll(PAYMENT_IDENTIFIER_REGEX)) {
      const found = m[0];
      // Prices were already validated separately; don't treat them as accounts.
      if (/(?:rs\.?|pkr|rupees)\s*$/i.test(sentence.slice(0, m.index))) continue;
      if (allowed.has(normalizeIdentifier(found))) continue;
      removed.push(found);
      return false;
    }
    return true;
  });

  return { text: kept.join(" ").replace(/\s{2,}/g, " ").trim(), removed };
}

/**
 * Stock "AI assistant" filler that makes a WhatsApp seller sound like software.
 * These are removed outright — the surrounding sentence already carries the
 * meaning, and a real seller simply would not say them.
 */
const ROBOTIC_PHRASES: RegExp[] = [
  /\s*ta+ke\s+main\s+aage\s+(?:ka\s+)?process\s+start\s+kar\s*(?:oon|un|u|sakoon|sakun)\b[^.!?]*/gi,
  /\s*ta+ke\s+main\s+aap\s*k[ia]\s+(?:madad|help)\s+kar\s*(?:oon|un|u|sakoon)\b[^.!?]*/gi,
  /\b(?:main\s+)?aap\s*k[ii]\s+kya\s+madad\s+kar\s+sakta\s+h(?:oon|u|un)\b[^.!?]*/gi,
  /\bkis\s+cheez\s+(?:ke\s+bar[ae]y?\s+mein\s+)?poch?na\s+h(?:ai|a)\b[^.!?]*/gi,
  /\bagar\s+aap\s*k[oe]\s+(?:koi\s+)?(?:aur\s+)?sawal\s+h(?:ai|o)[^.!?]*/gi,
  /\bfeel\s+free\s+to\s+ask\b[^.!?]*/gi,
  /\blet\s+me\s+know\s+if\s+you\s+(?:have\s+any|need)\b[^.!?]*/gi,
  /\bhow\s+(?:may|can)\s+i\s+(?:assist|help)\s+you\b[^.!?]*/gi,
];

/**
 * Removes scripted filler and stops "bhai" being stapled onto every sentence.
 * `previousAgentText` is used so the greeting-word doesn't repeat turn after
 * turn, which is the fastest way a bot gives itself away.
 */
export function stripRoboticPhrasing(text: string, previousAgentText?: string | null): string {
  if (!text) return text;
  let out = text;

  for (const re of ROBOTIC_PHRASES) {
    out = out.replace(re, "");
  }

  // "bhai" more than once in a single reply reads as a tic.
  const bhaiMatches = [...out.matchAll(/\bbhai\b/gi)];
  if (bhaiMatches.length > 1) {
    let seen = 0;
    out = out.replace(/\s*\bbhai\b/gi, (m) => (seen++ === 0 ? m : ""));
  }

  // If the previous reply already opened with "bhai", don't open with it again.
  if (previousAgentText && /^\s*\W*bhai\b/i.test(previousAgentText)) {
    out = out.replace(/^\s*\W*bhai\b[,\s]*/i, "");
  }

  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Generic words that must never on their own decide which product image to
 * send — mostly Roman Urdu glue words and the words used to ASK for an image.
 */
const IMAGE_MATCH_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "your", "you", "how", "where", "what", "when",
  "see", "get", "got", "can", "will", "its", "it", "is", "are", "was", "not", "any", "all", "into", "out",
  "tool", "app", "software", "image", "images", "screenshot", "screen", "shot", "photo", "pic", "picture",
  "kaise", "kese", "kahan", "kaha", "kidhar", "kya", "kyu", "hai", "hain", "ka", "ki", "ke", "ko", "mein",
  "me", "se", "par", "pe", "aap", "bhai", "yeh", "ye", "wo", "woh", "kar", "karo", "karu", "karein", "krdo",
  "do", "de", "den", "dein", "bhej", "bhejo", "bhejein", "dikhao", "dikha", "dikhaen", "please", "plz",
  "mujhe", "mera", "meri", "main", "hun", "hoon", "ho", "na", "to", "ok", "acha", "milega", "milta",
  "chahiye", "batao", "bata", "sakta", "sakte", "hoga", "hota",
]);

/**
 * Splits text into the distinctive tokens used for image relevance matching,
 * then expands a couple of domain synonyms so the customer's phrasing and the
 * admin's image description find each other: "HWID" and "hardware id" are the
 * same thing to a customer, but plain token overlap would miss it.
 */
function tokenizeForImageMatch(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of (text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/)) {
    if (raw.length < 2) continue;
    if (IMAGE_MATCH_STOPWORDS.has(raw)) continue;
    tokens.add(raw);
  }
  if (tokens.has("hwid")) {
    tokens.add("hardware");
    tokens.add("id");
  }
  if (tokens.has("hardware") && tokens.has("id")) tokens.add("hwid");
  return tokens;
}

/** Minimum overlapping distinctive tokens before an image is considered a real match. */
const IMAGE_MATCH_MIN_SCORE = 2;

export interface MatchableImage {
  id?: string;
  title?: string;
  description?: string;
  filename?: string;
}

/**
 * Picks the uploaded product image that actually answers what the customer just
 * asked, by matching their words against the image's own admin-written title and
 * description (the upload form requires a description precisely so the agent can
 * do this). Returns null when nothing is a convincing match, so a vague question
 * never triggers a random image.
 *
 * This is what makes "HWID kahan se milega?" send the image the admin uploaded
 * and described as "where to find the Hardware ID" — matching on the image's
 * meaning rather than on the customer happening to say the word "screenshot".
 */
export function pickRelevantImage<T extends MatchableImage>(
  customerText: string,
  images?: T[] | null
): { image: T; score: number } | null {
  if (!images || images.length === 0 || !customerText) return null;

  const customerTokens = tokenizeForImageMatch(customerText);
  if (customerTokens.size === 0) return null;

  let best: { image: T; score: number } | null = null;
  for (const img of images) {
    const meta = [img.title, img.description, img.filename].filter(Boolean).join(" ");
    if (!meta.trim()) continue;
    let score = 0;
    for (const token of tokenizeForImageMatch(meta)) {
      if (customerTokens.has(token)) score++;
    }
    if (!best || score > best.score) best = { image: img, score };
  }

  return best && best.score >= IMAGE_MATCH_MIN_SCORE ? best : null;
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

const SALAM_GREETING_REGEX = /(?:salam|slm|aoa|assalam|walikum|walaikum)/i;

/**
 * Strips "Walaikum Assalam" or "Walaikumassalam" from the agent reply if the customer
 * did NOT explicitly greet with a Salam in their message.
 */
export function stripUnsolicitedSalam(replyText: string, latestCustomerText: string): string {
  if (!replyText) return replyText;
  const customerSaidSalam = SALAM_GREETING_REGEX.test(latestCustomerText || "");
  if (customerSaidSalam) return replyText;

  // Customer did NOT say Salam -> strip any "Walaikum Assalam [Name]!" opening
  const regex = /^\s*(?:Walaikum\s*Assalam|Walaikumassalam|Walaikum-assalam|Walikum\s*Assalam)\s*(?:[A-Za-z0-9_\u0600-\u06FF]+\s*(?:bhai|jan|jee|ji)?)?\s*[\!\.\,\?\:]*\s*/i;
  if (regex.test(replyText)) {
    const cleaned = replyText.replace(regex, "").trim();
    if (cleaned.length > 0) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }
  return replyText;
}
