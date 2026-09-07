import fs from "fs/promises";
import path from "path";
import { Express, Request, Response } from "express";
import { getCustomers } from "./memory.js";
import { getUsers, getUserByToken } from "./auth.js";

const USAGE_FILE = path.join(process.cwd(), "data", "usage.json");

export interface PersistentUsage {
  totalAiReplies: number;
  totalUserMessages: number;
  // Map date "YYYY-MM-DD" -> count
  dailyAiReplies: Record<string, number>;
  dailyUserMessages: Record<string, number>;
  // Map month "YYYY-MM" -> count (used for monthly plan quotas)
  monthlyAiReplies: Record<string, number>;
  // Per-user monthly tracking: userId -> { "YYYY-MM": count }
  userMonthlyAiReplies: Record<string, Record<string, number>>;
  lastUpdated: string;
}

let usageCache: PersistentUsage | null = null;

function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function getUsage(): Promise<PersistentUsage> {
  try {
    const raw = await fs.readFile(USAGE_FILE, "utf-8");
    const parsed: PersistentUsage = JSON.parse(raw);
    if (!parsed.userMonthlyAiReplies) parsed.userMonthlyAiReplies = {};
    if (!parsed.dailyAiReplies) parsed.dailyAiReplies = {};
    if (!parsed.dailyUserMessages) parsed.dailyUserMessages = {};
    if (!parsed.monthlyAiReplies) parsed.monthlyAiReplies = {};
    usageCache = parsed;
    return parsed;
  } catch {
    // Initialize usage store. Seed from existing customer records if any exist
    let seedAi = 0;
    let seedUser = 0;
    const dailyAi: Record<string, number> = {};
    const dailyUser: Record<string, number> = {};
    const monthlyAi: Record<string, number> = {};

    try {
      const customers = await getCustomers();
      Object.values(customers).forEach((c: any) => {
        if (c.messages && Array.isArray(c.messages)) {
          c.messages.forEach((m: any) => {
            const timestamp = m.timestamp ? new Date(m.timestamp) : new Date();
            const y = timestamp.getFullYear();
            const mo = String(timestamp.getMonth() + 1).padStart(2, "0");
            const d = String(timestamp.getDate()).padStart(2, "0");
            const dayKey = `${y}-${mo}-${d}`;
            const mKey = `${y}-${mo}`;

            if (m.role === "agent") {
              seedAi++;
              dailyAi[dayKey] = (dailyAi[dayKey] || 0) + 1;
              monthlyAi[mKey] = (monthlyAi[mKey] || 0) + 1;
            } else {
              seedUser++;
              dailyUser[dayKey] = (dailyUser[dayKey] || 0) + 1;
            }
          });
        }
      });
    } catch (e) {
      console.error("[Usage] Could not seed initial usage from customers:", e);
    }

    usageCache = {
      totalAiReplies: seedAi,
      totalUserMessages: seedUser,
      dailyAiReplies: dailyAi,
      dailyUserMessages: dailyUser,
      monthlyAiReplies: monthlyAi,
      userMonthlyAiReplies: {},
      lastUpdated: new Date().toISOString(),
    };

    await saveUsage(usageCache);
    return usageCache;
  }
}

export async function saveUsage(usage: PersistentUsage): Promise<void> {
  usageCache = usage;
  usage.lastUpdated = new Date().toISOString();
  await fs.mkdir(path.dirname(USAGE_FILE), { recursive: true });
  await fs.writeFile(USAGE_FILE, JSON.stringify(usage, null, 2), "utf-8");
}

/**
 * Records an AI reply in persistent storage.
 * This is permanently stored and will NEVER be decremented or lost when
 * contacts or chats are deleted from the customer directory.
 */
export async function recordAiReply(userId?: string): Promise<number> {
  const usage = await getUsage();
  const dayKey = getTodayKey();
  const mKey = getMonthKey();

  usage.totalAiReplies = (usage.totalAiReplies || 0) + 1;
  usage.dailyAiReplies[dayKey] = (usage.dailyAiReplies[dayKey] || 0) + 1;
  usage.monthlyAiReplies[mKey] = (usage.monthlyAiReplies[mKey] || 0) + 1;

  if (userId) {
    if (!usage.userMonthlyAiReplies[userId]) {
      usage.userMonthlyAiReplies[userId] = {};
    }
    usage.userMonthlyAiReplies[userId][mKey] = (usage.userMonthlyAiReplies[userId][mKey] || 0) + 1;
  }

  await saveUsage(usage);
  return usage.monthlyAiReplies[mKey];
}

/**
 * Records an incoming customer user message in persistent storage.
 * Note: Customer messages do NOT count against the user's AI reply quota.
 */
export async function recordUserMessage(): Promise<void> {
  const usage = await getUsage();
  const dayKey = getTodayKey();

  usage.totalUserMessages = (usage.totalUserMessages || 0) + 1;
  usage.dailyUserMessages[dayKey] = (usage.dailyUserMessages[dayKey] || 0) + 1;

  await saveUsage(usage);
}

/**
 * Checks whether the user has remaining AI reply quota for the current month.
 * Customer messages do NOT count against this quota. ONLY AI replies count.
 * Free plan limit = 30 AI replies.
 */
export async function checkAiReplyQuota(userId?: string): Promise<{
  allowed: boolean;
  plan: string;
  limit: number;
  usedThisMonth: number;
  remaining: number;
}> {
  const usage = await getUsage();
  const mKey = getMonthKey();
  const users = await getUsers();

  let targetUser = userId ? users.find((u) => u.id === userId) : null;
  if (!targetUser) {
    // Default to the primary user or admin
    targetUser = users.find((u) => u.role === "admin") || users[0];
  }

  const plan = targetUser?.plan || "Free";
  const assignedLimit = targetUser?.assignedLimits?.maxAiReplies ?? targetUser?.assignedLimits?.conversionLimit;

  // Free plan default = 30 AI replies
  let limit = 30;
  if (typeof assignedLimit === "number") {
    limit = assignedLimit;
  } else if (plan.toLowerCase() === "free") {
    limit = 30;
  } else if (plan.toLowerCase() === "pro") {
    limit = 250;
  } else if (plan.toLowerCase() === "agency") {
    limit = 1500;
  } else if (plan.toLowerCase() === "enterprise") {
    limit = 99999;
  }

  const usedThisMonth = userId && usage.userMonthlyAiReplies[userId]?.[mKey] !== undefined
    ? usage.userMonthlyAiReplies[userId][mKey]
    : (usage.monthlyAiReplies[mKey] || 0);

  const remaining = Math.max(0, limit - usedThisMonth);
  const allowed = limit >= 99999 || usedThisMonth < limit;

  return {
    allowed,
    plan,
    limit,
    usedThisMonth,
    remaining,
  };
}

/**
 * Returns comprehensive persistent stats for the Overview & Analytics dashboards.
 */
export async function getUsageStats(userId?: string) {
  const usage = await getUsage();
  const dayKey = getTodayKey();
  const mKey = getMonthKey();
  const quota = await checkAiReplyQuota(userId);

  return {
    totalAiRepliesAllTime: usage.totalAiReplies || 0,
    totalMessagesAllTime: (usage.totalAiReplies || 0) + (usage.totalUserMessages || 0),
    aiRepliesToday: usage.dailyAiReplies[dayKey] || 0,
    messagesToday: (usage.dailyAiReplies[dayKey] || 0) + (usage.dailyUserMessages[dayKey] || 0),
    aiRepliesThisMonth: usage.monthlyAiReplies[mKey] || 0,
    plan: quota.plan,
    maxAiReplies: quota.limit,
    remainingAiReplies: quota.remaining,
    isLimitReached: !quota.allowed,
    dailyAiReplies: usage.dailyAiReplies,
    dailyUserMessages: usage.dailyUserMessages,
  };
}

export function setupUsageRoutes(app: Express) {
  app.get("/api/usage/stats", async (req: Request, res: Response) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const stats = await getUsageStats(user?.id);
      res.json(stats);
    } catch (err: any) {
      console.error("[Usage] Error getting stats:", err);
      res.status(500).json({ error: "Failed to get usage stats" });
    }
  });

  app.get("/api/usage/quota", async (req: Request, res: Response) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const quota = await checkAiReplyQuota(user?.id);
      res.json(quota);
    } catch (err: any) {
      console.error("[Usage] Error checking quota:", err);
      res.status(500).json({ error: "Failed to check quota" });
    }
  });
}
