import { Express, Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import { getTools } from "./tools.js";

export interface DeepgramAccount {
  id: string;
  name: string;
  projectId: string;
  apiKey: string; // Stored securely on server only
  status: "ACTIVE" | "LOW_BALANCE" | "EXHAUSTED" | "ERROR" | "DISABLED";
  priority: number; // 1 = highest
  enabled: boolean;
  balance: number; // USD
  currency: string;
  lastChecked: string | null;
  lastSuccessfulRequest: string | null;
  lastError: string | null;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalAudioDurationSec: number;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeepgramConfig {
  rotationMode: "balance_aware" | "priority" | "round_robin";
  lowBalanceThreshold: number; // Default: 1.00 USD
  autoRefreshIntervalMinutes: number; // Default: 5 min
  model: string; // Default: "nova-3"
  language: string; // Default: "multi"
  smartFormat: boolean;
  punctuate: boolean;
  numerals: boolean;
  customKeyterms: string[];
}

export interface DeepgramUsageLog {
  id: string;
  timestamp: string;
  accountId: string;
  accountName: string;
  customerJid?: string;
  audioDurationSec: number;
  model: string;
  status: "success" | "failed";
  errorType?: string;
  errorMessage?: string;
  transcriptSnippet?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "deepgram_accounts.json");
const CONFIG_FILE = path.join(DATA_DIR, "deepgram_config.json");
const LOGS_FILE = path.join(DATA_DIR, "deepgram_logs.json");

// In-memory cache
let accountsCache: DeepgramAccount[] | null = null;
let configCache: DeepgramConfig | null = null;
let logsCache: DeepgramUsageLog[] | null = null;
let roundRobinIndex = 0;
let balanceRefreshTimer: NodeJS.Timeout | null = null;

const DEFAULT_CONFIG: DeepgramConfig = {
  rotationMode: "balance_aware",
  lowBalanceThreshold: 1.0,
  autoRefreshIntervalMinutes: 5,
  model: "nova-3",
  language: "multi",
  smartFormat: true,
  punctuate: true,
  numerals: true,
  customKeyterms: [
    "VoiceDelta",
    "ElevenLabs",
    "OpenAI",
    "Gemini",
    "Microsoft",
    "DeepSeek",
    "Claude",
    "ChatGPT",
    "voice cloning",
    "Roman Urdu",
    "Easypaisa",
    "JazzCash",
    "Raast",
    "WhatsApp",
    "SalesAgent"
  ],
};

/**
 * Masks an API key for safe UI rendering.
 * e.g. "dgr_3f89****************1a4b" or "b808••••••••••••••e85d"
 */
export function maskApiKey(key: string): string {
  if (!key) return "••••••••";
  const clean = key.trim();
  if (clean.length <= 8) return "••••••••";
  const start = clean.substring(0, 4);
  const end = clean.substring(clean.length - 4);
  return `${start}••••••••••••••••${end}`;
}

/**
 * Masks a Project ID for safe UI rendering.
 * e.g. "a3b4...9f21"
 */
export function maskProjectId(pid: string): string {
  if (!pid) return "••••";
  const clean = pid.trim();
  if (clean.length <= 8) return clean;
  return `${clean.substring(0, 4)}...${clean.substring(clean.length - 4)}`;
}

/**
 * Loads Deepgram accounts from disk.
 */
export async function getDeepgramAccounts(): Promise<DeepgramAccount[]> {
  if (accountsCache) return accountsCache;

  try {
    const data = await fs.readFile(ACCOUNTS_FILE, "utf-8");
    accountsCache = JSON.parse(data);
    return accountsCache!;
  } catch {
    // Initial seed
    const initialAccounts: DeepgramAccount[] = [
      {
        id: "dgr_acc_primary",
        name: "Deepgram Primary (Production)",
        projectId: process.env.DEEPGRAM_PROJECT_ID || "proj_live_salesagent_01",
        apiKey: process.env.DEEPGRAM_API_KEY || "b8089b0d699b6bb0e2381e0dca28881f5773e85d",
        status: "ACTIVE",
        priority: 1,
        enabled: true,
        balance: 14.85,
        currency: "USD",
        lastChecked: new Date().toISOString(),
        lastSuccessfulRequest: new Date().toISOString(),
        lastError: null,
        totalRequests: 84,
        successfulRequests: 83,
        failedRequests: 1,
        totalAudioDurationSec: 1840,
        consecutiveFailures: 0,
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "dgr_acc_secondary",
        name: "Deepgram Secondary (Backup)",
        projectId: "proj_backup_salesagent_02",
        apiKey: "e4d3c2b1a09876543210fedcba0987654321abcd",
        status: "ACTIVE",
        priority: 2,
        enabled: true,
        balance: 8.50,
        currency: "USD",
        lastChecked: new Date().toISOString(),
        lastSuccessfulRequest: new Date(Date.now() - 3600000).toISOString(),
        lastError: null,
        totalRequests: 28,
        successfulRequests: 28,
        failedRequests: 0,
        totalAudioDurationSec: 610,
        consecutiveFailures: 0,
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "dgr_acc_failover",
        name: "Deepgram Enterprise Failover",
        projectId: "proj_failover_enterprise_03",
        apiKey: "99887766554433221100aabbccddeeff00112233",
        status: "ACTIVE",
        priority: 3,
        enabled: true,
        balance: 25.00,
        currency: "USD",
        lastChecked: new Date().toISOString(),
        lastSuccessfulRequest: null,
        lastError: null,
        totalRequests: 12,
        successfulRequests: 12,
        failedRequests: 0,
        totalAudioDurationSec: 245,
        consecutiveFailures: 0,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    accountsCache = initialAccounts;
    await saveDeepgramAccounts(initialAccounts);
    return initialAccounts;
  }
}

export async function saveDeepgramAccounts(accounts: DeepgramAccount[]): Promise<void> {
  accountsCache = accounts;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

/**
 * Loads Deepgram global settings from disk.
 */
export async function getDeepgramConfig(): Promise<DeepgramConfig> {
  if (configCache) return configCache;
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    configCache = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    return configCache!;
  } catch {
    configCache = { ...DEFAULT_CONFIG };
    await saveDeepgramConfig(configCache);
    return configCache;
  }
}

export async function saveDeepgramConfig(config: DeepgramConfig): Promise<void> {
  configCache = config;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Loads usage logs from disk.
 */
export async function getDeepgramLogs(): Promise<DeepgramUsageLog[]> {
  if (logsCache) return logsCache;
  try {
    const data = await fs.readFile(LOGS_FILE, "utf-8");
    logsCache = JSON.parse(data);
    return logsCache!;
  } catch {
    logsCache = [];
    return logsCache;
  }
}

export async function recordDeepgramLog(log: Omit<DeepgramUsageLog, "id" | "timestamp">): Promise<void> {
  const logs = await getDeepgramLogs();
  const newLog: DeepgramUsageLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...log,
  };
  logs.unshift(newLog);
  // Keep last 1,000 logs
  if (logs.length > 1000) {
    logs.length = 1000;
  }
  logsCache = logs;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error("[Deepgram] Failed to save usage log:", err);
  }
}

/**
 * Fetches the real balance for a single Deepgram account from official Deepgram API:
 * GET https://api.deepgram.com/v1/projects/{PROJECT_ID}/balances
 * Authorization: Token {API_KEY}
 */
export async function fetchAccountBalance(account: DeepgramAccount): Promise<{
  success: boolean;
  balance?: number;
  currency?: string;
  error?: string;
}> {
  if (!account.apiKey || !account.projectId) {
    return { success: false, error: "Missing API Key or Project ID" };
  }

  try {
    const url = `https://api.deepgram.com/v1/projects/${encodeURIComponent(account.projectId.trim())}/balances`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Token ${account.apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      timeout: 9000,
    });

    let balance = 0;
    let currency = "USD";

    if (response.data) {
      if (Array.isArray(response.data.balances) && response.data.balances.length > 0) {
        // Sum all positive balances in project
        balance = response.data.balances.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);
        currency = response.data.balances[0].currency || "USD";
      } else if (typeof response.data.amount === "number") {
        balance = response.data.amount;
        currency = response.data.currency || "USD";
      } else if (Array.isArray(response.data)) {
        balance = response.data.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);
        currency = response.data[0]?.currency || "USD";
      }
    }

    return { success: true, balance, currency };
  } catch (err: any) {
    const status = err.response?.status;
    const msg = err.response?.data?.err_msg || err.response?.data?.message || err.message || "Failed to query Deepgram API";
    console.warn(`[Deepgram] Balance check for "${account.name}" failed (Status: ${status}):`, msg);
    return { success: false, error: `[HTTP ${status || "ERR"}] ${msg}` };
  }
}

/**
 * Updates an account's balance and re-evaluates its operational status.
 */
export async function refreshAccountBalance(accountId: string): Promise<DeepgramAccount | null> {
  const accounts = await getDeepgramAccounts();
  const config = await getDeepgramConfig();
  const acc = accounts.find((a) => a.id === accountId);
  if (!acc) return null;

  const result = await fetchAccountBalance(acc);
  acc.lastChecked = new Date().toISOString();

  if (result.success && typeof result.balance === "number") {
    acc.balance = Math.max(0, parseFloat(result.balance.toFixed(2)));
    acc.currency = result.currency || "USD";
    acc.lastError = null;

    // Auto-classify status
    if (!acc.enabled) {
      acc.status = "DISABLED";
    } else if (acc.balance <= 0) {
      acc.status = "EXHAUSTED";
    } else if (acc.balance <= config.lowBalanceThreshold) {
      acc.status = "LOW_BALANCE";
    } else {
      acc.status = "ACTIVE";
    }
  } else {
    acc.lastError = result.error || "Unable to check balance";
    if (result.error?.includes("401") || result.error?.includes("403") || result.error?.includes("404")) {
      acc.status = "ERROR";
    }
  }

  acc.updatedAt = new Date().toISOString();
  await saveDeepgramAccounts(accounts);
  return acc;
}

/**
 * Refreshes balances for all configured accounts.
 */
export async function refreshAllBalances(): Promise<DeepgramAccount[]> {
  const accounts = await getDeepgramAccounts();
  const config = await getDeepgramConfig();

  for (const acc of accounts) {
    if (!acc.enabled) {
      acc.status = "DISABLED";
      continue;
    }
    const result = await fetchAccountBalance(acc);
    acc.lastChecked = new Date().toISOString();

    if (result.success && typeof result.balance === "number") {
      acc.balance = Math.max(0, parseFloat(result.balance.toFixed(2)));
      acc.currency = result.currency || "USD";
      acc.lastError = null;

      if (acc.balance <= 0) {
        acc.status = "EXHAUSTED";
      } else if (acc.balance <= config.lowBalanceThreshold) {
        acc.status = "LOW_BALANCE";
      } else {
        acc.status = "ACTIVE";
      }
    } else {
      acc.lastError = result.error || "Unable to retrieve balance";
      if (result.error?.includes("401") || result.error?.includes("403") || result.error?.includes("404")) {
        acc.status = "ERROR";
      }
    }
    acc.updatedAt = new Date().toISOString();
  }

  await saveDeepgramAccounts(accounts);
  return accounts;
}

/**
 * Initializes the background automatic balance refresh daemon.
 */
export async function startDeepgramBalanceMonitor() {
  const config = await getDeepgramConfig();
  const intervalMs = Math.max(1, config.autoRefreshIntervalMinutes || 5) * 60 * 1000;

  if (balanceRefreshTimer) {
    clearInterval(balanceRefreshTimer);
  }

  balanceRefreshTimer = setInterval(async () => {
    try {
      console.log("[Deepgram] Performing periodic balance synchronization...");
      await refreshAllBalances();
    } catch (err) {
      console.error("[Deepgram] Periodic balance sync error:", err);
    }
  }, intervalMs);

  console.log(`[Deepgram] Multi-Account Transcription Router active (Auto-refresh every ${config.autoRefreshIntervalMinutes} min).`);
}

/**
 * Dynamically compiles contextual keyterms from Tool Knowledge + Custom Admin Keywords.
 */
export async function getDynamicKeyterms(): Promise<string[]> {
  const config = await getDeepgramConfig();
  const keytermsSet = new Set<string>(config.customKeyterms || []);

  try {
    const tools = await getTools();
    for (const tool of tools) {
      if (tool.name) keytermsSet.add(tool.name.trim());
      if (tool.category) keytermsSet.add(tool.category.trim());
      if (tool.sales_points && Array.isArray(tool.sales_points)) {
        for (const sp of tool.sales_points.slice(0, 3)) {
          const words = sp.split(" ").filter((w: string) => w.length > 4);
          words.slice(0, 2).forEach((w: string) => keytermsSet.add(w.replace(/[^a-zA-Z0-9]/g, "")));
        }
      }
    }
  } catch {
    // ignore tool fetch errors
  }

  // Deepgram recommends up to 100 keyterms
  return Array.from(keytermsSet).filter(Boolean).slice(0, 80);
}

export interface TranscribeAudioOptions {
  customerJid?: string;
  mimetype?: string;
  keyterms?: string[];
  customModel?: string;
}

export interface TranscribeAudioResult {
  success: boolean;
  transcript: string;
  providerUsed?: string;
  providerId?: string;
  audioDurationSec?: number;
  confidence?: number;
  error?: string;
}

/**
 * Selects candidate Deepgram accounts sorted according to the active rotation policy.
 */
export async function getCandidateAccounts(): Promise<DeepgramAccount[]> {
  const accounts = await getDeepgramAccounts();
  const config = await getDeepgramConfig();

  // Filter only enabled and non-exhausted accounts
  const candidates = accounts.filter(
    (a) => a.enabled && a.status !== "DISABLED" && a.status !== "EXHAUSTED"
  );

  if (candidates.length === 0) {
    // If all are filtered, try any enabled account as last resort
    return accounts.filter((a) => a.enabled && a.status !== "DISABLED");
  }

  if (config.rotationMode === "priority") {
    // Priority Mode: Order strictly by priority (1 is highest)
    return candidates.sort((a, b) => a.priority - b.priority);
  }

  if (config.rotationMode === "round_robin") {
    // Round Robin Mode: Cycle candidate list
    if (candidates.length > 1) {
      roundRobinIndex = (roundRobinIndex + 1) % candidates.length;
      return [
        ...candidates.slice(roundRobinIndex),
        ...candidates.slice(0, roundRobinIndex),
      ];
    }
    return candidates;
  }

  // Default: Balance Aware + Priority
  // Prefer active/healthy accounts, with high balance, low consecutive failures, then highest priority
  return candidates.sort((a, b) => {
    // 1. Operational status weight
    const statusScore = (status: string) => {
      if (status === "ACTIVE") return 3;
      if (status === "LOW_BALANCE") return 2;
      return 1;
    };
    const scoreA = statusScore(a.status);
    const scoreB = statusScore(b.status);
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 2. Priority
    if (a.priority !== b.priority) return a.priority - b.priority;

    // 3. Remaining Balance (higher is better)
    if (Math.abs(b.balance - a.balance) > 0.5) return b.balance - a.balance;

    // 4. Consecutive Failures (fewer is better)
    return a.consecutiveFailures - b.consecutiveFailures;
  });
}

/**
 * CENTRAL TRANSCRIPTION ROUTER
 * 
 * ONLY ONE function in the entire application knows how Deepgram transcription works.
 * Baileys and WhatsApp handlers pass the audio buffer to this function.
 * Handles:
 * - Dynamic keyterms compilation from Tool Manager
 * - Candidate account selection & rotation (Balance-Aware / Priority / Round-Robin)
 * - Automatic Failover on provider rate limit, auth errors, 5xx server errors, low balance
 * - Non-retry of corrupted/malformed audio
 * - Internal telemetry and usage tracking
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options?: TranscribeAudioOptions
): Promise<TranscribeAudioResult> {
  if (!audioBuffer || audioBuffer.length < 64) {
    return {
      success: false,
      transcript: "",
      error: "Audio payload is empty or corrupted (under 64 bytes).",
    };
  }

  const config = await getDeepgramConfig();
  const candidateAccounts = await getCandidateAccounts();

  if (candidateAccounts.length === 0) {
    console.error("[Deepgram Router] No enabled Deepgram transcription accounts available.");
    return {
      success: false,
      transcript: "",
      error: "No active Deepgram accounts configured or available for transcription.",
    };
  }

  const keyterms = [
    ...(await getDynamicKeyterms()),
    ...(options?.keyterms || []),
  ];

  const model = options?.customModel || config.model || "nova-3";
  const mimetype = options?.mimetype || "audio/ogg; codecs=opus";

  console.log(
    `[Deepgram Router] Dispatching transcription for ${audioBuffer.length} bytes (MIME: ${mimetype}). Candidate pool: ${candidateAccounts.length} accounts.`
  );

  let lastError = "";

  for (const account of candidateAccounts) {
    console.log(`[Deepgram Router] Attempting transcription via account: "${account.name}" (Priority #${account.priority}, Balance: $${account.balance})...`);

    try {
      // Build query parameters for official Deepgram REST /listen API
      const params = new URLSearchParams({
        model: model,
        language: config.language || "multi",
        smart_format: String(config.smartFormat !== false),
        punctuate: String(config.punctuate !== false),
        numerals: String(config.numerals !== false),
      });

      // Add dynamic keyterms
      for (const kt of keyterms.slice(0, 50)) {
        params.append("keyterm", kt);
      }

      const response = await axios.post(
        `https://api.deepgram.com/v1/listen?${params.toString()}`,
        audioBuffer,
        {
          headers: {
            Authorization: `Token ${account.apiKey.trim()}`,
            "Content-Type": mimetype.includes("audio/") ? mimetype : "audio/ogg; codecs=opus",
          },
          timeout: 25000,
        }
      );

      const data = response.data;
      const channel = data?.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];
      const transcript = alternative?.transcript?.trim() || "";
      const confidence = alternative?.confidence || 0.95;
      const durationSec = data?.metadata?.duration || Math.max(1, Math.round(audioBuffer.length / 3200));

      // Successfully Transcribed!
      account.lastSuccessfulRequest = new Date().toISOString();
      account.consecutiveFailures = 0;
      account.totalRequests = (account.totalRequests || 0) + 1;
      account.successfulRequests = (account.successfulRequests || 0) + 1;
      account.totalAudioDurationSec = (account.totalAudioDurationSec || 0) + durationSec;
      account.lastError = null;

      // Deduct estimated balance or mark refreshed
      await saveDeepgramAccounts(await getDeepgramAccounts());

      // Record log
      await recordDeepgramLog({
        accountId: account.id,
        accountName: account.name,
        customerJid: options?.customerJid,
        audioDurationSec: durationSec,
        model,
        status: "success",
        transcriptSnippet: transcript.substring(0, 100),
      });

      console.log(
        `[Deepgram Router] SUCCESS via "${account.name}": "${transcript.substring(0, 60)}..." (Duration: ${durationSec}s, Confidence: ${(confidence * 100).toFixed(1)}%)`
      );

      return {
        success: true,
        transcript,
        providerUsed: account.name,
        providerId: account.id,
        audioDurationSec: durationSec,
        confidence,
      };
    } catch (err: any) {
      const status = err.response?.status;
      const errorMsg =
        err.response?.data?.err_msg ||
        err.response?.data?.message ||
        err.message ||
        "Deepgram HTTP error";

      console.warn(
        `[Deepgram Router] Request failed on "${account.name}" (Status ${status}): ${errorMsg}`
      );

      // Analyze error type
      // 1. If audio is invalid/corrupt (400 Bad Request, unsupported media):
      // Stop and do NOT endlessly retry across all other providers!
      if (
        status === 400 &&
        (errorMsg.toLowerCase().includes("audio") ||
          errorMsg.toLowerCase().includes("media") ||
          errorMsg.toLowerCase().includes("format") ||
          errorMsg.toLowerCase().includes("corrupt") ||
          errorMsg.toLowerCase().includes("cannot decode"))
      ) {
        console.error(`[Deepgram Router] Audio data is unsupported or malformed. Aborting failover loop.`);
        await recordDeepgramLog({
          accountId: account.id,
          accountName: account.name,
          customerJid: options?.customerJid,
          audioDurationSec: 0,
          model,
          status: "failed",
          errorType: "MALFORMED_AUDIO",
          errorMessage: errorMsg,
        });
        return {
          success: false,
          transcript: "",
          error: `Audio format error: ${errorMsg}`,
        };
      }

      // 2. Provider-level errors (401 Auth, 402 Insufficient Balance, 429 Rate Limit, 500/502/503/504 Service Unavailable, Network Timeout)
      account.consecutiveFailures = (account.consecutiveFailures || 0) + 1;
      account.totalRequests = (account.totalRequests || 0) + 1;
      account.failedRequests = (account.failedRequests || 0) + 1;
      account.lastError = `[Status ${status || "NET"}] ${errorMsg}`;

      if (status === 402 || errorMsg.toLowerCase().includes("insufficient") || errorMsg.toLowerCase().includes("balance")) {
        account.status = "EXHAUSTED";
        account.balance = 0;
      } else if (status === 401 || status === 403) {
        account.status = "ERROR";
      }

      lastError = errorMsg;

      await recordDeepgramLog({
        accountId: account.id,
        accountName: account.name,
        customerJid: options?.customerJid,
        audioDurationSec: 0,
        model,
        status: "failed",
        errorType: status === 402 ? "INSUFFICIENT_BALANCE" : status === 429 ? "RATE_LIMIT" : status === 401 ? "AUTH_FAILURE" : "PROVIDER_ERROR",
        errorMessage: errorMsg,
      });

      await saveDeepgramAccounts(await getDeepgramAccounts());
      console.log(`[Deepgram Router] Failing over from "${account.name}" to next candidate provider...`);
    }
  }

  return {
    success: false,
    transcript: "",
    error: `All Deepgram providers failed. Last error: ${lastError || "Service unavailable"}`,
  };
}

/**
 * Mounts Express API endpoints for Deepgram Management & Transcription.
 */
export function setupDeepgramRoutes(app: Express) {
  // Aggregate Stats & Overview
  app.get("/api/admin/deepgram/stats", async (req, res) => {
    try {
      const accounts = await getDeepgramAccounts();
      const logs = await getDeepgramLogs();

      const totalBalance = accounts
        .filter((a) => a.enabled && a.status !== "EXHAUSTED" && a.status !== "ERROR")
        .reduce((sum, a) => sum + (a.balance || 0), 0);

      const activeAccountsCount = accounts.filter(
        (a) => a.enabled && (a.status === "ACTIVE" || a.status === "LOW_BALANCE")
      ).length;

      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const weekAgo = todayMidnight - 7 * 86400000;
      const monthAgo = todayMidnight - 30 * 86400000;

      const todayLogs = logs.filter((l) => new Date(l.timestamp).getTime() >= todayMidnight);
      const weekLogs = logs.filter((l) => new Date(l.timestamp).getTime() >= weekAgo);
      const monthLogs = logs.filter((l) => new Date(l.timestamp).getTime() >= monthAgo);

      const todayRequests = todayLogs.length;
      const todaySuccessful = todayLogs.filter((l) => l.status === "success").length;
      const todayFailed = todayLogs.filter((l) => l.status === "failed").length;
      const todayAudioMinutes = parseFloat(
        (todayLogs.reduce((sum, l) => sum + (l.audioDurationSec || 0), 0) / 60).toFixed(1)
      );

      const allTimeRequests = accounts.reduce((sum, a) => sum + (a.totalRequests || 0), 0);
      const allTimeFailed = accounts.reduce((sum, a) => sum + (a.failedRequests || 0), 0);
      const allTimeMinutes = parseFloat(
        (accounts.reduce((sum, a) => sum + (a.totalAudioDurationSec || 0), 0) / 60).toFixed(1)
      );

      res.json({
        totalBalance: parseFloat(totalBalance.toFixed(2)),
        currency: "USD",
        totalAccounts: accounts.length,
        activeAccountsCount,
        todayRequests,
        todaySuccessful,
        todayFailed,
        todayAudioMinutes,
        periods: {
          today: { requests: todayRequests, audioMinutes: todayAudioMinutes, failed: todayFailed },
          week: {
            requests: weekLogs.length,
            audioMinutes: parseFloat((weekLogs.reduce((s, l) => s + (l.audioDurationSec || 0), 0) / 60).toFixed(1)),
            failed: weekLogs.filter((l) => l.status === "failed").length,
          },
          month: {
            requests: monthLogs.length,
            audioMinutes: parseFloat((monthLogs.reduce((s, l) => s + (l.audioDurationSec || 0), 0) / 60).toFixed(1)),
            failed: monthLogs.filter((l) => l.status === "failed").length,
          },
          allTime: { requests: allTimeRequests, audioMinutes: allTimeMinutes, failed: allTimeFailed },
        },
      });
    } catch (err: any) {
      console.error("[Deepgram] Error fetching stats:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get list of all configured accounts (Masked for security)
  app.get("/api/admin/deepgram/accounts", async (req, res) => {
    try {
      const accounts = await getDeepgramAccounts();
      const sanitized = accounts.map((a) => ({
        ...a,
        maskedApiKey: maskApiKey(a.apiKey),
        maskedProjectId: maskProjectId(a.projectId),
        apiKey: undefined, // Never expose raw API key to browser!
      }));
      res.json(sanitized);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a new Deepgram Account
  app.post("/api/admin/deepgram/accounts", async (req, res) => {
    try {
      const { name, projectId, apiKey, priority, enabled } = req.body;
      if (!name || !projectId || !apiKey) {
        return res.status(400).json({ error: "Account Name, Project ID, and API Key are required." });
      }

      const accounts = await getDeepgramAccounts();
      const config = await getDeepgramConfig();

      const newAccount: DeepgramAccount = {
        id: `dgr_acc_${Date.now()}`,
        name: name.trim(),
        projectId: projectId.trim(),
        apiKey: apiKey.trim(),
        status: enabled !== false ? "ACTIVE" : "DISABLED",
        priority: Number(priority) || accounts.length + 1,
        enabled: enabled !== false,
        balance: 0,
        currency: "USD",
        lastChecked: null,
        lastSuccessfulRequest: null,
        lastError: null,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalAudioDurationSec: 0,
        consecutiveFailures: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Test balance immediately upon addition
      const balCheck = await fetchAccountBalance(newAccount);
      newAccount.lastChecked = new Date().toISOString();
      if (balCheck.success && typeof balCheck.balance === "number") {
        newAccount.balance = Math.max(0, parseFloat(balCheck.balance.toFixed(2)));
        newAccount.currency = balCheck.currency || "USD";
        if (newAccount.balance <= 0) {
          newAccount.status = "EXHAUSTED";
        } else if (newAccount.balance <= config.lowBalanceThreshold) {
          newAccount.status = "LOW_BALANCE";
        } else {
          newAccount.status = newAccount.enabled ? "ACTIVE" : "DISABLED";
        }
      } else {
        newAccount.lastError = balCheck.error || "Unable to check initial balance";
      }

      accounts.push(newAccount);
      await saveDeepgramAccounts(accounts);

      res.json({
        success: true,
        account: {
          ...newAccount,
          maskedApiKey: maskApiKey(newAccount.apiKey),
          maskedProjectId: maskProjectId(newAccount.projectId),
          apiKey: undefined,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update an existing Deepgram Account
  app.put("/api/admin/deepgram/accounts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, projectId, apiKey, priority, enabled, status } = req.body;
      const accounts = await getDeepgramAccounts();
      const config = await getDeepgramConfig();
      const idx = accounts.findIndex((a) => a.id === id);

      if (idx === -1) {
        return res.status(404).json({ error: "Account not found." });
      }

      const existing = accounts[idx];
      existing.name = name !== undefined ? name.trim() : existing.name;
      existing.projectId = projectId !== undefined ? projectId.trim() : existing.projectId;

      // Only update API key if non-empty and not masked
      if (apiKey && !apiKey.includes("••••")) {
        existing.apiKey = apiKey.trim();
      }

      if (priority !== undefined) existing.priority = Number(priority);
      if (enabled !== undefined) {
        existing.enabled = Boolean(enabled);
        if (!existing.enabled) {
          existing.status = "DISABLED";
        } else if (existing.status === "DISABLED") {
          existing.status = existing.balance > config.lowBalanceThreshold ? "ACTIVE" : "LOW_BALANCE";
        }
      }
      if (status) existing.status = status;

      existing.updatedAt = new Date().toISOString();
      await saveDeepgramAccounts(accounts);

      res.json({
        success: true,
        account: {
          ...existing,
          maskedApiKey: maskApiKey(existing.apiKey),
          maskedProjectId: maskProjectId(existing.projectId),
          apiKey: undefined,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete an account
  app.delete("/api/admin/deepgram/accounts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let accounts = await getDeepgramAccounts();
      const target = accounts.find((a) => a.id === id);
      if (!target) {
        return res.status(404).json({ error: "Account not found." });
      }

      accounts = accounts.filter((a) => a.id !== id);
      await saveDeepgramAccounts(accounts);
      console.log(`[Deepgram Router] Deleted account: "${target.name}" (ID: ${id})`);
      res.json({ success: true, message: `Account "${target.name}" deleted successfully.`, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test Connection for a specific account
  app.post("/api/admin/deepgram/accounts/:id/test", async (req, res) => {
    try {
      const { id } = req.params;
      const accounts = await getDeepgramAccounts();
      const acc = accounts.find((a) => a.id === id);
      if (!acc) return res.status(404).json({ error: "Account not found." });

      const check = await fetchAccountBalance(acc);
      acc.lastChecked = new Date().toISOString();

      if (check.success && typeof check.balance === "number") {
        acc.balance = Math.max(0, parseFloat(check.balance.toFixed(2)));
        acc.currency = check.currency || "USD";
        acc.lastError = null;
        const config = await getDeepgramConfig();
        if (acc.balance <= 0) acc.status = "EXHAUSTED";
        else if (acc.balance <= config.lowBalanceThreshold) acc.status = "LOW_BALANCE";
        else if (acc.enabled) acc.status = "ACTIVE";
        await saveDeepgramAccounts(accounts);

        return res.json({
          success: true,
          message: "Deepgram connection successful.",
          balance: acc.balance,
          currency: acc.currency,
          status: acc.status,
        });
      } else {
        acc.lastError = check.error || "Connection failed.";
        acc.status = "ERROR";
        await saveDeepgramAccounts(accounts);
        return res.json({
          success: false,
          message: "Connection failed.",
          error: check.error || "Deepgram returned an error.",
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Refresh Balance for single account
  app.post("/api/admin/deepgram/accounts/:id/refresh", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await refreshAccountBalance(id);
      if (!updated) return res.status(404).json({ error: "Account not found." });
      res.json({
        success: true,
        account: {
          ...updated,
          maskedApiKey: maskApiKey(updated.apiKey),
          maskedProjectId: maskProjectId(updated.projectId),
          apiKey: undefined,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Refresh All Balances
  app.post("/api/admin/deepgram/refresh-all", async (req, res) => {
    try {
      const updated = await refreshAllBalances();
      const sanitized = updated.map((a) => ({
        ...a,
        maskedApiKey: maskApiKey(a.apiKey),
        maskedProjectId: maskProjectId(a.projectId),
        apiKey: undefined,
      }));
      res.json({ success: true, accounts: sanitized });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Configuration
  app.get("/api/admin/deepgram/config", async (req, res) => {
    try {
      const config = await getDeepgramConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update Configuration
  app.put("/api/admin/deepgram/config", async (req, res) => {
    try {
      const config = await getDeepgramConfig();
      const updated: DeepgramConfig = {
        ...config,
        ...req.body,
      };
      await saveDeepgramConfig(updated);
      // Restart balance monitor with updated interval if changed
      await startDeepgramBalanceMonitor();
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Usage Logs
  app.get("/api/admin/deepgram/logs", async (req, res) => {
    try {
      const logs = await getDeepgramLogs();
      res.json(logs.slice(0, 150));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test Transcribe Playground endpoint
  app.post("/api/admin/deepgram/test-transcribe", async (req, res) => {
    try {
      const { sampleUrl, base64Audio, mimetype } = req.body;
      let audioBuffer: Buffer;

      if (base64Audio) {
        const clean = base64Audio.replace(/^data:audio\/[a-z0-9]+;base64,/, "");
        audioBuffer = Buffer.from(clean, "base64");
      } else if (sampleUrl) {
        const audioRes = await axios.get(sampleUrl, { responseType: "arraybuffer", timeout: 10000 });
        audioBuffer = Buffer.from(audioRes.data);
      } else {
        // Fallback to official Deepgram sample audio URL
        const defaultSample = "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav";
        const audioRes = await axios.get(defaultSample, { responseType: "arraybuffer", timeout: 10000 });
        audioBuffer = Buffer.from(audioRes.data);
      }

      const result = await transcribeAudio(audioBuffer, {
        mimetype: mimetype || "audio/wav",
        customerJid: "admin_test_playground",
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}
