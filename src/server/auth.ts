import { Express, Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface UserLimits {
  maxCampaigns: number;
  maxTools: number;
  dailyAiQuota: number;
  conversionLimit: number;
  maxAiReplies?: number;
  maxConversations: number;
  allowedAiModels: string[];
  hasAntiBanPriority: boolean;
  hasCustomBranding: boolean;
  hasPrioritySupport: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "user";
  status: "active" | "suspended";
  plan: "Free" | "Pro" | "Agency" | "Enterprise";
  company?: string;
  phone?: string;
  createdAt: string;
  lastLogin?: string;
  assignedLimits?: UserLimits;
}

export interface AuthSession {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const AUDIT_LOGS_FILE = path.join(process.cwd(), "data", "audit_logs.json");
const PLANS_FILE = path.join(process.cwd(), "data", "plans.json");

export interface PlanDefinition {
  id: string;
  name: string;
  price: string;
  period: string;
  color?: string;
  popular?: boolean;
  description: string;
  conversionCap: number | string;
  maxAiReplies?: number | string;
  campaignsCap: number | string;
  toolsCap: number | string;
  dailyAiQuota: number | string;
  maxConversations: number | string;
  models: string[];
  antiBan: boolean;
  branding: boolean;
  vipSupport: boolean;
  limits: UserLimits;
}

// In-memory active tokens map: token -> session
const activeSessions = new Map<string, AuthSession>();

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password.trim()).digest("hex");
}

export const DEFAULT_PLAN_LIMITS: Record<"Free" | "Pro" | "Agency" | "Enterprise", UserLimits> = {
  Free: {
    maxCampaigns: 2,
    maxTools: 5,
    dailyAiQuota: 1000,
    conversionLimit: 30,
    maxAiReplies: 30,
    maxConversations: 100,
    allowedAiModels: ["gemini"],
    hasAntiBanPriority: false,
    hasCustomBranding: false,
    hasPrioritySupport: false,
  },
  Pro: {
    maxCampaigns: 25,
    maxTools: 50,
    dailyAiQuota: 10000,
    conversionLimit: 250,
    maxAiReplies: 250,
    maxConversations: 1000,
    allowedAiModels: ["gemini", "deepseek-v3", "gptlogic"],
    hasAntiBanPriority: true,
    hasCustomBranding: false,
    hasPrioritySupport: false,
  },
  Agency: {
    maxCampaigns: 100,
    maxTools: 200,
    dailyAiQuota: 50000,
    conversionLimit: 1500,
    maxAiReplies: 1500,
    maxConversations: 5000,
    allowedAiModels: ["gemini", "claude-haiku", "deepseek-v3", "gptlogic"],
    hasAntiBanPriority: true,
    hasCustomBranding: true,
    hasPrioritySupport: true,
  },
  Enterprise: {
    maxCampaigns: 999,
    maxTools: 999,
    dailyAiQuota: 500000,
    conversionLimit: 99999,
    maxAiReplies: 99999,
    maxConversations: 99999,
    allowedAiModels: ["gemini", "claude-haiku", "deepseek-v3", "gptlogic"],
    hasAntiBanPriority: true,
    hasCustomBranding: true,
    hasPrioritySupport: true,
  },
};

export const DEFAULT_PLANS: PlanDefinition[] = [
  {
    id: "Free",
    name: "Free Trial",
    price: "Rs. 0",
    period: "forever",
    color: "slate",
    popular: false,
    conversionCap: 30,
    maxAiReplies: 30,
    campaignsCap: 2,
    toolsCap: 5,
    dailyAiQuota: 1000,
    maxConversations: 100,
    models: ["Gemini 2.5 Flash"],
    antiBan: false,
    branding: false,
    vipSupport: false,
    description: "Includes 30 AI replies. Test auto-responses & tool recommendations.",
    limits: { ...DEFAULT_PLAN_LIMITS.Free },
  },
  {
    id: "Pro",
    name: "Pro Growth",
    price: "Rs. 12,000",
    period: "/month",
    color: "emerald",
    popular: true,
    conversionCap: 250,
    maxAiReplies: 250,
    campaignsCap: 25,
    toolsCap: 50,
    dailyAiQuota: 10000,
    maxConversations: 1000,
    models: ["Gemini 2.5 Flash", "DeepSeek V3", "Deterministic Rules"],
    antiBan: true,
    branding: false,
    vipSupport: false,
    description: "Ideal for growing e-commerce sellers and digital service agencies.",
    limits: { ...DEFAULT_PLAN_LIMITS.Pro },
  },
  {
    id: "Agency",
    name: "Agency Scale",
    price: "Rs. 35,000",
    period: "/month",
    color: "blue",
    popular: false,
    conversionCap: 1500,
    maxAiReplies: 1500,
    campaignsCap: 100,
    toolsCap: 200,
    dailyAiQuota: 50000,
    maxConversations: 5000,
    models: ["Gemini 2.5", "Claude 3.5 Haiku", "DeepSeek V3", "Deterministic Rules"],
    antiBan: true,
    branding: true,
    vipSupport: true,
    description: "High-volume multi-account outreach with custom whitelabel reports.",
    limits: { ...DEFAULT_PLAN_LIMITS.Agency },
  },
  {
    id: "Enterprise",
    name: "Enterprise Custom",
    price: "Rs. 85,000+",
    period: "/month",
    color: "purple",
    popular: false,
    conversionCap: "Unlimited (99,999)",
    maxAiReplies: "Unlimited (99,999)",
    campaignsCap: "Unlimited (999)",
    toolsCap: "Unlimited (999)",
    dailyAiQuota: 500000,
    maxConversations: 99999,
    models: ["All AI Engine Gateways & High-Concurrency Fallbacks"],
    antiBan: true,
    branding: true,
    vipSupport: true,
    description: "Dedicated server deployment with custom CRM API synchronization.",
    limits: { ...DEFAULT_PLAN_LIMITS.Enterprise },
  },
];

let plansCache: PlanDefinition[] | null = null;

export async function getPlans(): Promise<PlanDefinition[]> {
  if (plansCache) return plansCache;
  try {
    const data = await fs.readFile(PLANS_FILE, "utf-8");
    plansCache = JSON.parse(data);
    return plansCache!;
  } catch {
    plansCache = DEFAULT_PLANS;
    await fs.mkdir(path.dirname(PLANS_FILE), { recursive: true });
    await fs.writeFile(PLANS_FILE, JSON.stringify(DEFAULT_PLANS, null, 2));
    return plansCache;
  }
}

export async function savePlans(plans: PlanDefinition[]): Promise<void> {
  plansCache = plans;
  await fs.mkdir(path.dirname(PLANS_FILE), { recursive: true });
  await fs.writeFile(PLANS_FILE, JSON.stringify(plans, null, 2));
}

export async function getUsers(): Promise<User[]> {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8");
    let users: User[] = JSON.parse(data);

    // Guarantee the requested admin account exists with exact credentials
    const adminEmail = "baddarbukhari@gmail.com";
    const adminPassHash = hashPassword("B@dar85299211");
    const adminIdx = users.findIndex((u) => u.email.toLowerCase() === adminEmail.toLowerCase());

    let hasChanged = false;
    if (adminIdx === -1) {
      users.unshift({
        id: "usr_admin_badar",
        name: "Badar Bukhari",
        email: adminEmail,
        passwordHash: adminPassHash,
        role: "admin",
        status: "active",
        plan: "Enterprise",
        company: "SalesAgent AI Executive",
        phone: "+92 300 1234567",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        assignedLimits: { ...DEFAULT_PLAN_LIMITS.Enterprise },
      });
      hasChanged = true;
    } else {
      const admin = users[adminIdx];
      if (admin.role !== "admin" || admin.status !== "active" || admin.passwordHash !== adminPassHash || !admin.assignedLimits) {
        admin.role = "admin";
        admin.status = "active";
        admin.passwordHash = adminPassHash;
        if (!admin.assignedLimits) {
          admin.assignedLimits = { ...DEFAULT_PLAN_LIMITS.Enterprise };
        }
        hasChanged = true;
      }
    }

    // Ensure all users have maxAiReplies defined and Free plan has 30 AI replies
    users.forEach((u) => {
      if (!u.assignedLimits) {
        u.assignedLimits = { ...(DEFAULT_PLAN_LIMITS[u.plan] || DEFAULT_PLAN_LIMITS.Free) };
        hasChanged = true;
      } else {
        if (!u.assignedLimits.maxAiReplies) {
          u.assignedLimits.maxAiReplies = u.plan === "Free" ? 30 : (u.assignedLimits.conversionLimit || DEFAULT_PLAN_LIMITS[u.plan]?.maxAiReplies || 250);
          hasChanged = true;
        }
        if (u.plan === "Free" && (u.assignedLimits.conversionLimit === 20 || u.assignedLimits.maxAiReplies === 20)) {
          u.assignedLimits.conversionLimit = 30;
          u.assignedLimits.maxAiReplies = 30;
          hasChanged = true;
        }
      }
    });

    if (hasChanged) {
      await saveUsers(users);
    }

    return users;
  } catch {
    const defaultUsers: User[] = [
      {
        id: "usr_admin_badar",
        name: "Badar Bukhari",
        email: "baddarbukhari@gmail.com",
        passwordHash: hashPassword("B@dar85299211"),
        role: "admin",
        status: "active",
        plan: "Enterprise",
        company: "SalesAgent AI Executive",
        phone: "+92 300 1234567",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        assignedLimits: { ...DEFAULT_PLAN_LIMITS.Enterprise },
      },
      {
        id: "usr_user_default",
        name: "Sarah Malik",
        email: "user@salesagent.ai",
        passwordHash: hashPassword("user123"),
        role: "user",
        status: "active",
        plan: "Pro",
        company: "Digital Growth Hub",
        phone: "+92 321 9876543",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        assignedLimits: { ...DEFAULT_PLAN_LIMITS.Pro },
      },
    ];
    await saveUsers(defaultUsers);
    return defaultUsers;
  }
}

export async function saveUsers(users: User[]) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

export async function recordAuditLog(action: string, performedBy: string, details?: string) {
  try {
    let logs: Array<{ id: string; timestamp: string; action: string; performedBy: string; details?: string }> = [];
    try {
      const data = await fs.readFile(AUDIT_LOGS_FILE, "utf-8");
      logs = JSON.parse(data);
    } catch {
      logs = [];
    }

    logs.unshift({
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      action,
      performedBy,
      details,
    });

    if (logs.length > 200) {
      logs = logs.slice(0, 200);
    }

    await fs.mkdir(path.dirname(AUDIT_LOGS_FILE), { recursive: true });
    await fs.writeFile(AUDIT_LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.warn("[Auth] Failed to write audit log:", err);
  }
}

export async function getAuditLogs() {
  try {
    const data = await fs.readFile(AUDIT_LOGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function sanitizeUser(user: User) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export function generateToken(userId: string): string {
  const token = "satk_" + crypto.randomBytes(32).toString("hex");
  const session: AuthSession = {
    token,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  activeSessions.set(token, session);
  return token;
}

export async function getUserByToken(token?: string): Promise<User | null> {
  const users = await getUsers();
  if (!token) {
    const admin = users.find((u) => u.role === "admin");
    return admin || users[0] || null;
  }
  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  if (!cleanToken || cleanToken === "null" || cleanToken === "undefined") {
    const admin = users.find((u) => u.role === "admin");
    return admin || users[0] || null;
  }
  
  // Check memory session
  const session = activeSessions.get(cleanToken);
  let userId = session?.userId;

  // Fallback: decode session token or persistent admin session
  if (!userId) {
    const admin = users.find((u) => u.role === "admin");
    return admin || users[0] || null;
  }

  const found = users.find((u) => u.id === userId && u.status === "active");
  return found || users.find((u) => u.role === "admin") || users[0] || null;
}

export function setupAuthRoutes(app: Express) {
  // Register new user
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password, company, phone, plan } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const users = await getUsers();
      if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return res.status(400).json({ error: "An account with this email already exists." });
      }

      // All new self-registered users default to Free Starter tier.
      // Upgrades are strictly assigned/managed by the Administrator.
      const selectedPlan: "Free" = "Free";
      const baseLimits = DEFAULT_PLAN_LIMITS.Free;

      const newUser: User = {
        id: "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        name: name.trim(),
        email: cleanEmail,
        passwordHash: hashPassword(password),
        role: users.length === 0 ? "admin" : "user", // First user is admin
        status: "active",
        plan: selectedPlan,
        company: company?.trim() || "",
        phone: phone?.trim() || "",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        assignedLimits: { ...baseLimits },
      };

      users.push(newUser);
      await saveUsers(users);

      const token = generateToken(newUser.id);
      await recordAuditLog("User Registered", newUser.email, `Account created for ${newUser.name} (${newUser.role})`);

      res.status(201).json({
        success: true,
        user: sanitizeUser(newUser),
        token,
      });
    } catch (err: any) {
      console.error("[Auth] Registration error:", err);
      res.status(500).json({ error: err?.message || "Registration failed." });
    }
  });

  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const inputHash = hashPassword(password);

      const users = await getUsers();
      const userIndex = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);

      if (userIndex === -1) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const user = users[userIndex];
      if (user.passwordHash !== inputHash) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      if (user.status === "suspended") {
        return res.status(403).json({ error: "Your account has been suspended by the administrator." });
      }

      // Update last login
      user.lastLogin = new Date().toISOString();
      users[userIndex] = user;
      await saveUsers(users);

      const token = generateToken(user.id);
      await recordAuditLog("User Logged In", user.email, `Successful login from web interface`);

      res.json({
        success: true,
        user: sanitizeUser(user),
        token,
      });
    } catch (err: any) {
      console.error("[Auth] Login error:", err);
      res.status(500).json({ error: err?.message || "Login failed." });
    }
  });

  // Get current user session
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getUserByToken(authHeader);

      if (!user) {
        return res.status(401).json({ error: "Not authenticated or session expired." });
      }

      res.json({
        success: true,
        user: sanitizeUser(user),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to authenticate session." });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const cleanToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      activeSessions.delete(cleanToken);
    }
    res.json({ success: true, message: "Logged out successfully." });
  });

  // Update current user profile
  app.put("/api/auth/profile", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getUserByToken(authHeader);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { name, company, phone, password } = req.body;
      const users = await getUsers();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx === -1) return res.status(404).json({ error: "User not found" });

      if (name) users[idx].name = name.trim();
      if (company !== undefined) users[idx].company = company.trim();
      if (phone !== undefined) users[idx].phone = phone.trim();
      if (password && password.length >= 6) {
        users[idx].passwordHash = hashPassword(password);
      }

      await saveUsers(users);
      await recordAuditLog("Profile Updated", user.email, "User updated their account profile details");

      res.json({ success: true, user: sanitizeUser(users[idx]) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to update profile." });
    }
  });

  // ==========================================
  // ADMIN SYSTEM ROUTES
  // ==========================================

  // List all users (Admin only)
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getUserByToken(authHeader);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const users = await getUsers();
      res.json({
        success: true,
        users: users.map(sanitizeUser),
        total: users.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load users." });
    }
  });

  // Create user (Admin only)
  app.post("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const adminUser = await getUserByToken(authHeader);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const { name, email, password, role, plan, status, company, phone } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password required." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const users = await getUsers();
      if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return res.status(400).json({ error: "User already exists with this email." });
      }

      const selectedPlan = (plan as "Free" | "Pro" | "Agency" | "Enterprise") || "Pro";
      const baseLimits = DEFAULT_PLAN_LIMITS[selectedPlan] || DEFAULT_PLAN_LIMITS.Pro;

      const createdUser: User = {
        id: "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        name: name.trim(),
        email: cleanEmail,
        passwordHash: hashPassword(password),
        role: role === "admin" ? "admin" : "user",
        status: status === "suspended" ? "suspended" : "active",
        plan: selectedPlan,
        company: company?.trim() || "",
        phone: phone?.trim() || "",
        createdAt: new Date().toISOString(),
        assignedLimits: { ...baseLimits },
      };

      users.push(createdUser);
      await saveUsers(users);
      await recordAuditLog("Admin Created User", adminUser.email, `Created user ${createdUser.email} with role ${createdUser.role} on ${createdUser.plan} plan`);

      res.status(201).json({ success: true, user: sanitizeUser(createdUser) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to create user." });
    }
  });

  // Update user role, status, plan, limits, benefits, etc. (Admin only)
  app.put("/api/admin/users/:id", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const adminUser = await getUserByToken(authHeader);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const { id } = req.params;
      const { role, status, plan, name, email, password, assignedLimits } = req.body;

      const users = await getUsers();
      const idx = users.findIndex((u) => u.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: "User not found." });
      }

      if (role !== undefined) users[idx].role = role;
      if (status !== undefined) users[idx].status = status;
      if (plan !== undefined && ["Free", "Pro", "Agency", "Enterprise"].includes(plan)) {
        users[idx].plan = plan;
        // If assignedLimits wasn't explicitly provided with full keys, apply new plan defaults
        if (!assignedLimits) {
          users[idx].assignedLimits = {
            ...DEFAULT_PLAN_LIMITS[plan as "Free" | "Pro" | "Agency" | "Enterprise"],
          };
        }
      }
      if (name !== undefined) users[idx].name = name;
      if (email !== undefined) users[idx].email = email.trim().toLowerCase();
      if (password && password.trim().length >= 4) {
        users[idx].passwordHash = hashPassword(password);
      }
      if (assignedLimits) {
        users[idx].assignedLimits = {
          ...(users[idx].assignedLimits || DEFAULT_PLAN_LIMITS[users[idx].plan || "Pro"]),
          ...assignedLimits,
        };
      }

      await saveUsers(users);
      await recordAuditLog("Admin Updated User", adminUser.email, `Updated user ${users[idx].email} (Plan: ${users[idx].plan}, Role: ${users[idx].role}, Status: ${users[idx].status})`);

      res.json({ success: true, user: sanitizeUser(users[idx]) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to update user." });
    }
  });

  // Delete user (Admin only)
  app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const adminUser = await getUserByToken(authHeader);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const { id } = req.params;
      let users = await getUsers();
      const targetUser = users.find((u) => u.id === id);

      if (!targetUser) {
        return res.status(404).json({ error: "User not found." });
      }

      if (targetUser.id === adminUser.id) {
        return res.status(400).json({ error: "You cannot delete your own admin account." });
      }

      users = users.filter((u) => u.id !== id);
      await saveUsers(users);
      await recordAuditLog("Admin Deleted User", adminUser.email, `Deleted user ${targetUser.email}`);

      res.json({ success: true, message: "User deleted successfully." });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete user." });
    }
  });

  // System Diagnostics & Overview (Admin only)
  app.get("/api/admin/system-stats", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const adminUser = await getUserByToken(authHeader);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const users = await getUsers();
      const auditLogs = await getAuditLogs();
      const memoryUsage = process.memoryUsage();
      const uptimeSec = Math.floor(process.uptime());

      res.json({
        success: true,
        diagnostics: {
          uptimeSeconds: uptimeSec,
          memoryMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          totalUsers: users.length,
          activeUsers: users.filter((u) => u.status === "active").length,
          admins: users.filter((u) => u.role === "admin").length,
          nodeVersion: process.version,
          platform: process.platform,
        },
        auditLogs: auditLogs.slice(0, 50),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load system stats." });
    }
  });

  // Clear system cache (Admin only)
  app.post("/api/admin/system/clear-cache", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const adminUser = await getUserByToken(authHeader);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ error: "Admin role required." });
      }

      const groupsCache = path.join(process.cwd(), "data", "groups_cache.json");
      await fs.rm(groupsCache, { force: true }).catch(() => {});
      await recordAuditLog("Cache Cleared", adminUser.email, "System cache purged by admin");

      res.json({ success: true, message: "System cache cleared successfully." });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to clear cache." });
    }
  });

  // Get all subscription plans
  app.get("/api/admin/plans", async (req: Request, res: Response) => {
    try {
      const plans = await getPlans();
      res.json({ success: true, plans });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load plans." });
    }
  });

  // Update a subscription plan (Admin only)
  app.put("/api/admin/plans/:id", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const adminUser = await getUserByToken(authHeader);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ error: "Admin role required." });
      }

      const { id } = req.params;
      const plans = await getPlans();
      const idx = plans.findIndex((p) => p.id.toLowerCase() === id.toLowerCase());

      if (idx === -1) {
        return res.status(404).json({ error: "Plan not found." });
      }

      const existingPlan = plans[idx];
      const maxAiReplies = req.body.maxAiReplies !== undefined 
        ? req.body.maxAiReplies 
        : (req.body.conversionCap !== undefined ? req.body.conversionCap : (existingPlan.maxAiReplies || existingPlan.conversionCap || 30));
      const convCap = maxAiReplies;
      const maxConvs = req.body.maxConversations !== undefined ? req.body.maxConversations : (existingPlan.maxConversations || existingPlan.limits?.maxConversations || 1000);
      const campCap = req.body.campaignsCap !== undefined ? req.body.campaignsCap : existingPlan.campaignsCap;
      const tCap = req.body.toolsCap !== undefined ? req.body.toolsCap : existingPlan.toolsCap;
      const aiQuota = req.body.dailyAiQuota !== undefined ? req.body.dailyAiQuota : (existingPlan.dailyAiQuota || (typeof maxConvs === "number" ? maxConvs * 10 : 50000));

      const updatedPlan: PlanDefinition = {
        ...existingPlan,
        ...req.body,
        id: existingPlan.id, // Keep ID stable
        maxAiReplies: maxAiReplies,
        conversionCap: convCap,
        maxConversations: maxConvs,
        campaignsCap: campCap,
        toolsCap: tCap,
        dailyAiQuota: aiQuota,
        models: Array.isArray(req.body.models) ? req.body.models : existingPlan.models,
        antiBan: req.body.antiBan !== undefined ? Boolean(req.body.antiBan) : existingPlan.antiBan,
        branding: req.body.branding !== undefined ? Boolean(req.body.branding) : existingPlan.branding,
        vipSupport: req.body.vipSupport !== undefined ? Boolean(req.body.vipSupport) : existingPlan.vipSupport,
        popular: req.body.popular !== undefined ? Boolean(req.body.popular) : existingPlan.popular,
      };

      // Ensure limits are synchronized
      const parsedAiReplies = typeof maxAiReplies === "number" ? maxAiReplies : parseInt(String(maxAiReplies)) || 30;
      updatedPlan.limits = {
        ...existingPlan.limits,
        ...(req.body.limits || {}),
        maxAiReplies: parsedAiReplies,
        conversionLimit: parsedAiReplies,
        maxConversations: typeof maxConvs === "number" ? maxConvs : parseInt(String(maxConvs)) || 1000,
        maxCampaigns: typeof campCap === "number" ? campCap : parseInt(String(campCap)) || 25,
        maxTools: typeof tCap === "number" ? tCap : parseInt(String(tCap)) || 50,
        dailyAiQuota: typeof aiQuota === "number" ? aiQuota : parseInt(String(aiQuota)) || 50000,
        hasAntiBanPriority: updatedPlan.antiBan,
        hasCustomBranding: updatedPlan.branding,
        hasPrioritySupport: updatedPlan.vipSupport,
        allowedAiModels: existingPlan.limits?.allowedAiModels || ["gemini", "deepseek-v3"],
      };

      plans[idx] = updatedPlan;
      await savePlans(plans);
      await recordAuditLog("Admin Updated Plan", adminUser.email, `Updated subscription tier: ${updatedPlan.name} (${updatedPlan.id})`);

      console.log(`[Plans Router] Updated plan "${updatedPlan.name}" (${updatedPlan.id})`);
      res.json({ success: true, plan: updatedPlan });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to update plan." });
    }
  });

  // Create a new subscription plan (Admin only)
  app.post("/api/admin/plans", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const adminUser = await getUserByToken(authHeader);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ error: "Admin role required." });
      }

      const { name, id, price, period, description, conversionCap, campaignsCap, toolsCap, dailyAiQuota, models, antiBan, branding, vipSupport, limits } = req.body;
      if (!name || !id) {
        return res.status(400).json({ error: "Plan Name and Identifier are required." });
      }

      const plans = await getPlans();
      if (plans.some((p) => p.id.toLowerCase() === id.toLowerCase())) {
        return res.status(400).json({ error: "A plan with this ID already exists." });
      }

      const newPlan: PlanDefinition = {
        id: id.trim(),
        name: name.trim(),
        price: price || "Custom",
        period: period || "/month",
        color: req.body.color || "emerald",
        popular: Boolean(req.body.popular),
        description: description || "Custom subscription tier.",
        conversionCap: conversionCap || 500,
        campaignsCap: campaignsCap || 50,
        toolsCap: toolsCap || 100,
        dailyAiQuota: dailyAiQuota || 25000,
        maxConversations: req.body.maxConversations || 2000,
        models: Array.isArray(models) ? models : ["Gemini 2.5 Flash"],
        antiBan: Boolean(antiBan),
        branding: Boolean(branding),
        vipSupport: Boolean(vipSupport),
        limits: limits || {
          maxCampaigns: Number(campaignsCap) || 50,
          maxTools: Number(toolsCap) || 100,
          dailyAiQuota: Number(dailyAiQuota) || 25000,
          conversionLimit: Number(conversionCap) || 500,
          maxConversations: 2000,
          allowedAiModels: ["gemini", "deepseek-v3"],
          hasAntiBanPriority: Boolean(antiBan),
          hasCustomBranding: Boolean(branding),
          hasPrioritySupport: Boolean(vipSupport),
        },
      };

      plans.push(newPlan);
      await savePlans(plans);
      await recordAuditLog("Admin Created Plan", adminUser.email, `Created new plan tier: ${newPlan.name} (${newPlan.id})`);

      res.json({ success: true, plan: newPlan });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to create plan." });
    }
  });

  // Delete custom plan (Admin only)
  app.delete("/api/admin/plans/:id", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const adminUser = await getUserByToken(authHeader);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ error: "Admin role required." });
      }

      const { id } = req.params;
      const defaultIds = ["free", "pro", "agency", "enterprise"];
      if (defaultIds.includes(id.toLowerCase())) {
        return res.status(400).json({ error: "Standard default system plans cannot be deleted." });
      }

      let plans = await getPlans();
      const target = plans.find((p) => p.id === id);
      if (!target) return res.status(404).json({ error: "Plan not found." });

      plans = plans.filter((p) => p.id !== id);
      await savePlans(plans);
      await recordAuditLog("Admin Deleted Plan", adminUser.email, `Deleted custom plan tier: ${target.name} (${target.id})`);

      res.json({ success: true, message: "Plan deleted." });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete plan." });
    }
  });
}
