var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server/auth.ts
function hashPassword(password) {
  return import_crypto.default.createHash("sha256").update(password.trim()).digest("hex");
}
async function getPlans() {
  if (plansCache) return plansCache;
  try {
    const data = await import_promises.default.readFile(PLANS_FILE, "utf-8");
    plansCache = JSON.parse(data);
    return plansCache;
  } catch {
    plansCache = DEFAULT_PLANS;
    await import_promises.default.mkdir(import_path.default.dirname(PLANS_FILE), { recursive: true });
    await import_promises.default.writeFile(PLANS_FILE, JSON.stringify(DEFAULT_PLANS, null, 2));
    return plansCache;
  }
}
async function savePlans(plans) {
  plansCache = plans;
  await import_promises.default.mkdir(import_path.default.dirname(PLANS_FILE), { recursive: true });
  await import_promises.default.writeFile(PLANS_FILE, JSON.stringify(plans, null, 2));
}
async function getUsers() {
  try {
    const data = await import_promises.default.readFile(USERS_FILE, "utf-8");
    let users = JSON.parse(data);
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastLogin: (/* @__PURE__ */ new Date()).toISOString(),
        assignedLimits: { ...DEFAULT_PLAN_LIMITS.Enterprise }
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
    users.forEach((u) => {
      if (!u.assignedLimits) {
        u.assignedLimits = { ...DEFAULT_PLAN_LIMITS[u.plan] || DEFAULT_PLAN_LIMITS.Free };
        hasChanged = true;
      } else {
        if (!u.assignedLimits.maxAiReplies) {
          u.assignedLimits.maxAiReplies = u.plan === "Free" ? 30 : u.assignedLimits.conversionLimit || DEFAULT_PLAN_LIMITS[u.plan]?.maxAiReplies || 250;
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
    const defaultUsers = [
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastLogin: (/* @__PURE__ */ new Date()).toISOString(),
        assignedLimits: { ...DEFAULT_PLAN_LIMITS.Enterprise }
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastLogin: (/* @__PURE__ */ new Date()).toISOString(),
        assignedLimits: { ...DEFAULT_PLAN_LIMITS.Pro }
      }
    ];
    await saveUsers(defaultUsers);
    return defaultUsers;
  }
}
async function saveUsers(users) {
  await import_promises.default.mkdir(import_path.default.dirname(USERS_FILE), { recursive: true });
  await import_promises.default.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}
async function recordAuditLog(action, performedBy, details) {
  try {
    let logs = [];
    try {
      const data = await import_promises.default.readFile(AUDIT_LOGS_FILE, "utf-8");
      logs = JSON.parse(data);
    } catch {
      logs = [];
    }
    logs.unshift({
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      action,
      performedBy,
      details
    });
    if (logs.length > 200) {
      logs = logs.slice(0, 200);
    }
    await import_promises.default.mkdir(import_path.default.dirname(AUDIT_LOGS_FILE), { recursive: true });
    await import_promises.default.writeFile(AUDIT_LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.warn("[Auth] Failed to write audit log:", err);
  }
}
async function getAuditLogs() {
  try {
    const data = await import_promises.default.readFile(AUDIT_LOGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}
function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}
function generateToken(userId) {
  const token = "satk_" + import_crypto.default.randomBytes(32).toString("hex");
  const session = {
    token,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1e3
    // 30 days
  };
  activeSessions.set(token, session);
  return token;
}
async function getUserByToken(token) {
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
  const session = activeSessions.get(cleanToken);
  let userId = session?.userId;
  if (!userId) {
    const admin = users.find((u) => u.role === "admin");
    return admin || users[0] || null;
  }
  const found = users.find((u) => u.id === userId && u.status === "active");
  return found || users.find((u) => u.role === "admin") || users[0] || null;
}
function setupAuthRoutes(app) {
  app.post("/api/auth/register", async (req, res) => {
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
      const selectedPlan = "Free";
      const baseLimits = DEFAULT_PLAN_LIMITS.Free;
      const newUser = {
        id: "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        name: name.trim(),
        email: cleanEmail,
        passwordHash: hashPassword(password),
        role: users.length === 0 ? "admin" : "user",
        // First user is admin
        status: "active",
        plan: selectedPlan,
        company: company?.trim() || "",
        phone: phone?.trim() || "",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastLogin: (/* @__PURE__ */ new Date()).toISOString(),
        assignedLimits: { ...baseLimits }
      };
      users.push(newUser);
      await saveUsers(users);
      const token = generateToken(newUser.id);
      await recordAuditLog("User Registered", newUser.email, `Account created for ${newUser.name} (${newUser.role})`);
      res.status(201).json({
        success: true,
        user: sanitizeUser(newUser),
        token
      });
    } catch (err) {
      console.error("[Auth] Registration error:", err);
      res.status(500).json({ error: err?.message || "Registration failed." });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
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
      user.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
      users[userIndex] = user;
      await saveUsers(users);
      const token = generateToken(user.id);
      await recordAuditLog("User Logged In", user.email, `Successful login from web interface`);
      res.json({
        success: true,
        user: sanitizeUser(user),
        token
      });
    } catch (err) {
      console.error("[Auth] Login error:", err);
      res.status(500).json({ error: err?.message || "Login failed." });
    }
  });
  app.get("/api/auth/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await getUserByToken(authHeader);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated or session expired." });
      }
      res.json({
        success: true,
        user: sanitizeUser(user)
      });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to authenticate session." });
    }
  });
  app.post("/api/auth/logout", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const cleanToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      activeSessions.delete(cleanToken);
    }
    res.json({ success: true, message: "Logged out successfully." });
  });
  app.put("/api/auth/profile", async (req, res) => {
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
      if (company !== void 0) users[idx].company = company.trim();
      if (phone !== void 0) users[idx].phone = phone.trim();
      if (password && password.length >= 6) {
        users[idx].passwordHash = hashPassword(password);
      }
      await saveUsers(users);
      await recordAuditLog("Profile Updated", user.email, "User updated their account profile details");
      res.json({ success: true, user: sanitizeUser(users[idx]) });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to update profile." });
    }
  });
  app.get("/api/admin/users", async (req, res) => {
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
        total: users.length
      });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to load users." });
    }
  });
  app.post("/api/admin/users", async (req, res) => {
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
      const selectedPlan = plan || "Pro";
      const baseLimits = DEFAULT_PLAN_LIMITS[selectedPlan] || DEFAULT_PLAN_LIMITS.Pro;
      const createdUser = {
        id: "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        name: name.trim(),
        email: cleanEmail,
        passwordHash: hashPassword(password),
        role: role === "admin" ? "admin" : "user",
        status: status === "suspended" ? "suspended" : "active",
        plan: selectedPlan,
        company: company?.trim() || "",
        phone: phone?.trim() || "",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        assignedLimits: { ...baseLimits }
      };
      users.push(createdUser);
      await saveUsers(users);
      await recordAuditLog("Admin Created User", adminUser.email, `Created user ${createdUser.email} with role ${createdUser.role} on ${createdUser.plan} plan`);
      res.status(201).json({ success: true, user: sanitizeUser(createdUser) });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to create user." });
    }
  });
  app.put("/api/admin/users/:id", async (req, res) => {
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
      if (role !== void 0) users[idx].role = role;
      if (status !== void 0) users[idx].status = status;
      if (plan !== void 0 && ["Free", "Pro", "Agency", "Enterprise"].includes(plan)) {
        users[idx].plan = plan;
        if (!assignedLimits) {
          users[idx].assignedLimits = {
            ...DEFAULT_PLAN_LIMITS[plan]
          };
        }
      }
      if (name !== void 0) users[idx].name = name;
      if (email !== void 0) users[idx].email = email.trim().toLowerCase();
      if (password && password.trim().length >= 4) {
        users[idx].passwordHash = hashPassword(password);
      }
      if (assignedLimits) {
        users[idx].assignedLimits = {
          ...users[idx].assignedLimits || DEFAULT_PLAN_LIMITS[users[idx].plan || "Pro"],
          ...assignedLimits
        };
      }
      await saveUsers(users);
      await recordAuditLog("Admin Updated User", adminUser.email, `Updated user ${users[idx].email} (Plan: ${users[idx].plan}, Role: ${users[idx].role}, Status: ${users[idx].status})`);
      res.json({ success: true, user: sanitizeUser(users[idx]) });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to update user." });
    }
  });
  app.delete("/api/admin/users/:id", async (req, res) => {
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
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to delete user." });
    }
  });
  app.get("/api/admin/system-stats", async (req, res) => {
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
          platform: process.platform
        },
        auditLogs: auditLogs.slice(0, 50)
      });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to load system stats." });
    }
  });
  app.post("/api/admin/system/clear-cache", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const adminUser = await getUserByToken(authHeader);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ error: "Admin role required." });
      }
      const groupsCache = import_path.default.join(process.cwd(), "data", "groups_cache.json");
      await import_promises.default.rm(groupsCache, { force: true }).catch(() => {
      });
      await recordAuditLog("Cache Cleared", adminUser.email, "System cache purged by admin");
      res.json({ success: true, message: "System cache cleared successfully." });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to clear cache." });
    }
  });
  app.get("/api/admin/plans", async (req, res) => {
    try {
      const plans = await getPlans();
      res.json({ success: true, plans });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to load plans." });
    }
  });
  app.put("/api/admin/plans/:id", async (req, res) => {
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
      const maxAiReplies = req.body.maxAiReplies !== void 0 ? req.body.maxAiReplies : req.body.conversionCap !== void 0 ? req.body.conversionCap : existingPlan.maxAiReplies || existingPlan.conversionCap || 30;
      const convCap = maxAiReplies;
      const maxConvs = req.body.maxConversations !== void 0 ? req.body.maxConversations : existingPlan.maxConversations || existingPlan.limits?.maxConversations || 1e3;
      const campCap = req.body.campaignsCap !== void 0 ? req.body.campaignsCap : existingPlan.campaignsCap;
      const tCap = req.body.toolsCap !== void 0 ? req.body.toolsCap : existingPlan.toolsCap;
      const aiQuota = req.body.dailyAiQuota !== void 0 ? req.body.dailyAiQuota : existingPlan.dailyAiQuota || (typeof maxConvs === "number" ? maxConvs * 10 : 5e4);
      const updatedPlan = {
        ...existingPlan,
        ...req.body,
        id: existingPlan.id,
        // Keep ID stable
        maxAiReplies,
        conversionCap: convCap,
        maxConversations: maxConvs,
        campaignsCap: campCap,
        toolsCap: tCap,
        dailyAiQuota: aiQuota,
        models: Array.isArray(req.body.models) ? req.body.models : existingPlan.models,
        antiBan: req.body.antiBan !== void 0 ? Boolean(req.body.antiBan) : existingPlan.antiBan,
        branding: req.body.branding !== void 0 ? Boolean(req.body.branding) : existingPlan.branding,
        vipSupport: req.body.vipSupport !== void 0 ? Boolean(req.body.vipSupport) : existingPlan.vipSupport,
        popular: req.body.popular !== void 0 ? Boolean(req.body.popular) : existingPlan.popular
      };
      const parsedAiReplies = typeof maxAiReplies === "number" ? maxAiReplies : parseInt(String(maxAiReplies)) || 30;
      updatedPlan.limits = {
        ...existingPlan.limits,
        ...req.body.limits || {},
        maxAiReplies: parsedAiReplies,
        conversionLimit: parsedAiReplies,
        maxConversations: typeof maxConvs === "number" ? maxConvs : parseInt(String(maxConvs)) || 1e3,
        maxCampaigns: typeof campCap === "number" ? campCap : parseInt(String(campCap)) || 25,
        maxTools: typeof tCap === "number" ? tCap : parseInt(String(tCap)) || 50,
        dailyAiQuota: typeof aiQuota === "number" ? aiQuota : parseInt(String(aiQuota)) || 5e4,
        hasAntiBanPriority: updatedPlan.antiBan,
        hasCustomBranding: updatedPlan.branding,
        hasPrioritySupport: updatedPlan.vipSupport,
        allowedAiModels: existingPlan.limits?.allowedAiModels || ["gemini", "deepseek-v3"]
      };
      plans[idx] = updatedPlan;
      await savePlans(plans);
      await recordAuditLog("Admin Updated Plan", adminUser.email, `Updated subscription tier: ${updatedPlan.name} (${updatedPlan.id})`);
      console.log(`[Plans Router] Updated plan "${updatedPlan.name}" (${updatedPlan.id})`);
      res.json({ success: true, plan: updatedPlan });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to update plan." });
    }
  });
  app.post("/api/admin/plans", async (req, res) => {
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
      const newPlan = {
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
        dailyAiQuota: dailyAiQuota || 25e3,
        maxConversations: req.body.maxConversations || 2e3,
        models: Array.isArray(models) ? models : ["Gemini 2.5 Flash"],
        antiBan: Boolean(antiBan),
        branding: Boolean(branding),
        vipSupport: Boolean(vipSupport),
        limits: limits || {
          maxCampaigns: Number(campaignsCap) || 50,
          maxTools: Number(toolsCap) || 100,
          dailyAiQuota: Number(dailyAiQuota) || 25e3,
          conversionLimit: Number(conversionCap) || 500,
          maxConversations: 2e3,
          allowedAiModels: ["gemini", "deepseek-v3"],
          hasAntiBanPriority: Boolean(antiBan),
          hasCustomBranding: Boolean(branding),
          hasPrioritySupport: Boolean(vipSupport)
        }
      };
      plans.push(newPlan);
      await savePlans(plans);
      await recordAuditLog("Admin Created Plan", adminUser.email, `Created new plan tier: ${newPlan.name} (${newPlan.id})`);
      res.json({ success: true, plan: newPlan });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to create plan." });
    }
  });
  app.delete("/api/admin/plans/:id", async (req, res) => {
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
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to delete plan." });
    }
  });
}
var import_promises, import_path, import_crypto, USERS_FILE, AUDIT_LOGS_FILE, PLANS_FILE, activeSessions, DEFAULT_PLAN_LIMITS, DEFAULT_PLANS, plansCache;
var init_auth = __esm({
  "src/server/auth.ts"() {
    import_promises = __toESM(require("fs/promises"), 1);
    import_path = __toESM(require("path"), 1);
    import_crypto = __toESM(require("crypto"), 1);
    USERS_FILE = import_path.default.join(process.cwd(), "data", "users.json");
    AUDIT_LOGS_FILE = import_path.default.join(process.cwd(), "data", "audit_logs.json");
    PLANS_FILE = import_path.default.join(process.cwd(), "data", "plans.json");
    activeSessions = /* @__PURE__ */ new Map();
    DEFAULT_PLAN_LIMITS = {
      Free: {
        maxCampaigns: 2,
        maxTools: 5,
        dailyAiQuota: 1e3,
        conversionLimit: 30,
        maxAiReplies: 30,
        maxConversations: 100,
        allowedAiModels: ["gemini"],
        hasAntiBanPriority: false,
        hasCustomBranding: false,
        hasPrioritySupport: false
      },
      Pro: {
        maxCampaigns: 25,
        maxTools: 50,
        dailyAiQuota: 1e4,
        conversionLimit: 250,
        maxAiReplies: 250,
        maxConversations: 1e3,
        allowedAiModels: ["gemini", "deepseek-v3", "gptlogic"],
        hasAntiBanPriority: true,
        hasCustomBranding: false,
        hasPrioritySupport: false
      },
      Agency: {
        maxCampaigns: 100,
        maxTools: 200,
        dailyAiQuota: 5e4,
        conversionLimit: 1500,
        maxAiReplies: 1500,
        maxConversations: 5e3,
        allowedAiModels: ["gemini", "claude-haiku", "deepseek-v3", "gptlogic"],
        hasAntiBanPriority: true,
        hasCustomBranding: true,
        hasPrioritySupport: true
      },
      Enterprise: {
        maxCampaigns: 999,
        maxTools: 999,
        dailyAiQuota: 5e5,
        conversionLimit: 99999,
        maxAiReplies: 99999,
        maxConversations: 99999,
        allowedAiModels: ["gemini", "claude-haiku", "deepseek-v3", "gptlogic"],
        hasAntiBanPriority: true,
        hasCustomBranding: true,
        hasPrioritySupport: true
      }
    };
    DEFAULT_PLANS = [
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
        dailyAiQuota: 1e3,
        maxConversations: 100,
        models: ["Gemini 2.5 Flash"],
        antiBan: false,
        branding: false,
        vipSupport: false,
        description: "Includes 30 AI replies. Test auto-responses & tool recommendations.",
        limits: { ...DEFAULT_PLAN_LIMITS.Free }
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
        dailyAiQuota: 1e4,
        maxConversations: 1e3,
        models: ["Gemini 2.5 Flash", "DeepSeek V3", "Deterministic Rules"],
        antiBan: true,
        branding: false,
        vipSupport: false,
        description: "Ideal for growing e-commerce sellers and digital service agencies.",
        limits: { ...DEFAULT_PLAN_LIMITS.Pro }
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
        dailyAiQuota: 5e4,
        maxConversations: 5e3,
        models: ["Gemini 2.5", "Claude 3.5 Haiku", "DeepSeek V3", "Deterministic Rules"],
        antiBan: true,
        branding: true,
        vipSupport: true,
        description: "High-volume multi-account outreach with custom whitelabel reports.",
        limits: { ...DEFAULT_PLAN_LIMITS.Agency }
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
        dailyAiQuota: 5e5,
        maxConversations: 99999,
        models: ["All AI Engine Gateways & High-Concurrency Fallbacks"],
        antiBan: true,
        branding: true,
        vipSupport: true,
        description: "Dedicated server deployment with custom CRM API synchronization.",
        limits: { ...DEFAULT_PLAN_LIMITS.Enterprise }
      }
    ];
    plansCache = null;
  }
});

// src/server/settings.ts
async function getSettings(userId) {
  try {
    const targetFile = getSettingsFile(userId);
    const data = await import_promises2.default.readFile(targetFile, "utf-8");
    const parsed = JSON.parse(data);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      preferredApi: parsed.preferredApi || (parsed.defaultLLM ? parsed.defaultLLM.toLowerCase() : "gemini")
    };
  } catch (error) {
    if (userId && userId !== "usr_admin_badar" && userId !== "admin") {
      try {
        const globalData = await import_promises2.default.readFile(getSettingsFile(), "utf-8");
        const parsed = JSON.parse(globalData);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed
        };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    }
    return { ...DEFAULT_SETTINGS };
  }
}
async function saveSettings(newSettings, userId) {
  const current = await getSettings(userId);
  const merged = {
    ...current,
    ...newSettings
  };
  if (merged.preferredApi) {
    if (merged.preferredApi.includes("deepseek")) merged.defaultLLM = "DeepSeek";
    else if (merged.preferredApi.includes("claude")) merged.defaultLLM = "Claude";
    else if (merged.preferredApi.includes("gptlogic")) merged.defaultLLM = "GPTLogic";
    else merged.defaultLLM = "Gemini";
  }
  const targetFile = getSettingsFile(userId);
  await import_promises2.default.writeFile(targetFile, JSON.stringify(merged, null, 2));
  return merged;
}
function setupSettingsRoutes(app) {
  app.get("/api/settings", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const settings = await getSettings(user?.id);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to load settings" });
    }
  });
  app.post("/api/settings", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const saved = await saveSettings(req.body, user?.id);
      res.json({ success: true, settings: saved });
    } catch (error) {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });
  app.put("/api/settings", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const saved = await saveSettings(req.body, user?.id);
      res.json({ success: true, settings: saved });
    } catch (error) {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });
  app.post("/api/ai/test", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const prompt = req.body?.prompt || "Test Pakistani Roman Urdu greeting";
      const reply = await askAI(prompt, "You are a helpful Pakistani WhatsApp sales closer. Reply in 1 short Roman Urdu sentence.", user?.id);
      res.json({ success: true, reply });
    } catch (error) {
      res.status(500).json({ error: error.message || "AI test failed" });
    }
  });
  app.post("/api/ai/test-key", async (req, res) => {
    try {
      const { provider, apiKey } = req.body;
      if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
        return res.status(400).json({ success: false, error: "Please enter a valid API key to test." });
      }
      const cleanKey = apiKey.trim();
      const testPrompt = "Test Pakistani Roman Urdu greeting";
      const testSysPrompt = "You are a Pakistani WhatsApp sales agent. Reply with 'All systems operational!' in Roman Urdu.";
      let result = { success: false, text: "", provider };
      if (provider === "gemini") {
        result = await callOfficialGemini(cleanKey, testPrompt, testSysPrompt);
      } else if (provider === "groq") {
        result = await callGroq(cleanKey, testPrompt, testSysPrompt);
      } else if (provider === "openai") {
        result = await callOpenAI(cleanKey, testPrompt, testSysPrompt);
      } else {
        return res.status(400).json({ success: false, error: "Unknown provider" });
      }
      if (result.success && result.text) {
        return res.json({ success: true, reply: result.text, provider: result.provider });
      } else {
        return res.status(400).json({ success: false, error: result.error || "Failed to generate reply with this key." });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message || "API key test failed" });
    }
  });
  app.get("/api/skill", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const settings = await getSettings(user?.id);
      const skillPath = import_path2.default.join(process.cwd(), "SKILL.md");
      let content = "";
      try {
        content = await import_promises2.default.readFile(skillPath, "utf-8");
      } catch {
        content = "# WhatsApp Tool-Selling Closer\nNo SKILL.md found on server.";
      }
      res.json({
        enabled: settings.salesSkillEnabled !== false,
        content
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to load skill configuration" });
    }
  });
  app.post("/api/skill", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const { content, enabled } = req.body;
      if (typeof enabled === "boolean") {
        await saveSettings({ salesSkillEnabled: enabled }, user?.id);
      }
      if (typeof content === "string" && content.trim().length > 0) {
        const skillPath = import_path2.default.join(process.cwd(), "SKILL.md");
        await import_promises2.default.writeFile(skillPath, content, "utf-8");
      }
      res.json({ success: true, message: "Skill settings saved successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to save skill configuration" });
    }
  });
}
var import_promises2, import_path2, getSettingsFile, DEFAULT_SETTINGS;
var init_settings = __esm({
  "src/server/settings.ts"() {
    import_promises2 = __toESM(require("fs/promises"), 1);
    import_path2 = __toESM(require("path"), 1);
    init_ai();
    init_auth();
    getSettingsFile = (userId) => {
      if (!userId || userId === "usr_admin_badar" || userId === "admin") {
        return import_path2.default.join(process.cwd(), "data", "settings.json");
      }
      return import_path2.default.join(process.cwd(), "data", `settings_${userId}.json`);
    };
    DEFAULT_SETTINGS = {
      aiAgentEnabled: true,
      preferredApi: "gemini",
      defaultLLM: "Gemini",
      language: "Roman Urdu",
      autoReply: true,
      humanLikeMode: true,
      chatStyle: "casual_roman_urdu",
      maxTokens: 150,
      systemPrompt: "",
      allowImageReplies: true,
      salesSkillEnabled: true,
      allowGroups: false,
      allowChannels: false,
      paymentInstructions: "Payment send karne ke baad screenshot/receipt share karein, verification ke foran baad access mil jaye ga.",
      responseDelaySeconds: 1.5,
      paymentMethods: [
        {
          id: "pm_easypaisa_1",
          provider: "Easypaisa",
          accountTitle: "Account Title",
          accountNumber: "03001234567",
          bankName: "Easypaisa Wallet",
          instructions: "Send via Easypaisa App",
          isActive: true
        },
        {
          id: "pm_jazzcash_1",
          provider: "JazzCash",
          accountTitle: "Account Title",
          accountNumber: "03001234567",
          bankName: "JazzCash Mobile Account",
          instructions: "Send via JazzCash App",
          isActive: true
        }
      ]
    };
  }
});

// src/server/ai.ts
async function callOfficialGemini(apiKey, prompt, systemPrompt) {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { success: false, text: "", provider: "Gemini", error: "Missing API Key" };
  const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-lite"];
  try {
    const client = new import_genai.GoogleGenAI({ apiKey: cleanKey });
    for (const model of candidateModels) {
      try {
        console.log(`[AI] Requesting Gemini SDK (model: ${model})...`);
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: systemPrompt || void 0,
            temperature: 0.7
          }
        });
        const text = response.text?.trim();
        if (text && text.length > 0) {
          console.log(`[AI] Gemini SDK success via ${model} (${text.length} chars)`);
          return { success: true, text, provider: `Gemini (${model})` };
        }
      } catch (mErr) {
        console.warn(`[AI] Gemini SDK attempt with ${model} failed:`, mErr?.message || mErr);
      }
    }
  } catch (sdkErr) {
    console.warn("[AI] GoogleGenAI SDK init failed:", sdkErr?.message || sdkErr);
  }
  for (const model of candidateModels) {
    try {
      console.log(`[AI] Requesting Gemini REST API (model: ${model})...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7
        }
      };
      if (systemPrompt) {
        payload.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
      }
      const resp = await import_axios.default.post(url, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 2e4
      });
      const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text && text.length > 0) {
        console.log(`[AI] Gemini REST success via ${model} (${text.length} chars)`);
        return { success: true, text, provider: `Gemini REST (${model})` };
      }
    } catch (restErr) {
      const errMsg = restErr.response?.data?.error?.message || restErr.message;
      console.warn(`[AI] Gemini REST attempt with ${model} failed:`, errMsg);
    }
  }
  return { success: false, text: "", provider: "Gemini", error: "All Gemini models failed" };
}
async function callGroq(apiKey, prompt, systemPrompt) {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { success: false, text: "", provider: "Groq", error: "Missing API Key" };
  const candidateModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"];
  for (const model of candidateModels) {
    try {
      console.log(`[AI] Requesting Groq Cloud API (${model})...`);
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });
      const resp = await import_axios.default.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model,
          messages,
          temperature: 0.7
        },
        {
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            "Content-Type": "application/json"
          },
          timeout: 18e3
        }
      );
      const text = resp.data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 0) {
        console.log(`[AI] Groq success via ${model} (${text.length} chars)`);
        return { success: true, text, provider: `Groq (${model})` };
      }
    } catch (err) {
      const errMsg = err?.response?.data?.error?.message || err?.message;
      console.warn(`[AI] Groq attempt with ${model} failed:`, errMsg);
    }
  }
  return { success: false, text: "", provider: "Groq", error: "All Groq models failed" };
}
async function callOpenAI(apiKey, prompt, systemPrompt) {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { success: false, text: "", provider: "OpenAI", error: "Missing API Key" };
  try {
    const isRouter = cleanKey.startsWith("sk-or-");
    const endpoint = isRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
    const candidateModels = isRouter ? ["meta-llama/llama-3.3-70b-instruct", "google/gemini-2.0-flash-001", "deepseek/deepseek-chat"] : ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
    for (const model of candidateModels) {
      try {
        console.log(`[AI] Requesting ${isRouter ? "OpenRouter" : "OpenAI"} API (${model})...`);
        const messages = [];
        if (systemPrompt) {
          messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: prompt });
        const resp = await import_axios.default.post(
          endpoint,
          {
            model,
            messages,
            temperature: 0.7
          },
          {
            headers: {
              Authorization: `Bearer ${cleanKey}`,
              "Content-Type": "application/json"
            },
            timeout: 25e3
          }
        );
        const text = resp.data?.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 0) {
          console.log(`[AI] OpenAI/Router success (${text.length} chars)`);
          return { success: true, text, provider: `${isRouter ? "OpenRouter" : "OpenAI"} (${model})` };
        }
      } catch (err) {
        console.warn(`[AI] ${isRouter ? "OpenRouter" : "OpenAI"} failed with ${model}:`, err?.response?.data?.error?.message || err?.message);
      }
    }
  } catch (err) {
    console.warn("[AI] OpenAI/Router general failure:", err?.message);
  }
  return { success: false, text: "", provider: "OpenAI", error: "OpenAI request failed" };
}
function buildCompactPublicQuery(prompt, systemPrompt) {
  const isClassification = Boolean(systemPrompt && /json|classif|match|categor/i.test(systemPrompt)) || /json|classifier|categor|intent/i.test(prompt);
  if (isClassification) {
    if (prompt.length <= 1e3) return prompt;
    return prompt.slice(0, 1e3);
  }
  let customerMsg = "";
  const matchMsg = prompt.match(
    /(?:CUSTOMER'S LATEST MESSAGE\(S\)|CUSTOMER'S NEW MESSAGE\(S\)):\s*["']?([\s\S]*?)["']?\s*(?:\nReply as|\nProvide your|\n[A-Z_]+:|$)/i
  );
  if (matchMsg && matchMsg[1]) {
    customerMsg = matchMsg[1].trim();
  } else {
    const lastUserMatch = prompt.match(/(?:Customer|User):\s*["']?([^\n"']+)["']?/gi);
    if (lastUserMatch && lastUserMatch.length > 0) {
      customerMsg = lastUserMatch[lastUserMatch.length - 1].replace(/^(?:Customer|User):\s*["']?/i, "").replace(/["']?$/, "").trim();
    }
  }
  let toolSummary = "";
  let extractedLinksBlock = "";
  const toolMatch = prompt.match(
    /(?:===\s*PRODUCT CATALOG:\s*([^\n=]+)\s*===|===\s*MATCHED TOOL:\s*([^\n=]+)\s*===)/i
  );
  if (toolMatch) {
    const toolName = (toolMatch[1] || toolMatch[2]).trim();
    const descMatch = prompt.match(/(?:Description \& Problem Solved|Description):\s*([^\n]+)/i);
    const priceMatch = prompt.match(/(?:Pricing|Regular Price|List Price):\s*([^\n]+)/i);
    const featuresMatch = prompt.match(/Key Features:\s*\n([\s\S]*?)(?=\n[A-Z]|\n===|$)/i);
    const linksMatch = prompt.match(/Official Links \& Downloads:\s*\n([\s\S]*?)(?=\n[A-Z]|\n===|$)/i);
    const sectionsMatch = prompt.match(/(?:Constant Dynamic Section Message|\[SECTION:[^\]]+\])\s*\n([\s\S]*?)(?=\n\[SECTION|\n===|\n[A-Z]|$)/i);
    const desc = descMatch ? descMatch[1].slice(0, 140).trim() : "";
    const price = priceMatch ? priceMatch[1].slice(0, 80).trim() : "";
    const feat = featuresMatch ? featuresMatch[1].split("\n").filter(Boolean).slice(0, 2).map((f) => f.replace(/^[\*\-]\s*/, "")).join("; ").slice(0, 160) : "";
    const allLinkLines = linksMatch ? linksMatch[1].split("\n").filter(Boolean).slice(0, 3) : [];
    const link = allLinkLines.slice(0, 1).join(" ").slice(0, 200);
    extractedLinksBlock = allLinkLines.length > 0 ? `Official Links & Downloads:
${allLinkLines.map((l) => `  ${l.trim()}`).join("\n")}` : "";
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
    toolSummary = catalogMatch && catalogMatch[1].trim() ? `Store Catalog:
${catalogMatch[1].trim().slice(0, 260)}` : "Store Catalog: 1. ClipShield (YouTube copyright removal/claims bypass, Rs 1500/mo). 2. VoiceDelta (AI voice generator and cloning with 3600+ voices, Rs 1199/mo).";
  } else {
    toolSummary = "Store Catalog: 1. ClipShield (YouTube copyright removal/claims bypass, Rs 1500/mo). 2. VoiceDelta (AI voice generator and cloning with 3600+ voices, Rs 1199/mo).";
  }
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
  let salesDirectives = "";
  const ctrlMatch = prompt.match(/\[SALES CONTROL DIRECTIVES\]\s*\n([\s\S]*?)(?=\n\[RECENT|\nCUSTOMER'S|$)/i);
  if (ctrlMatch && ctrlMatch[1]) {
    salesDirectives = `DIRECTIVE: ${ctrlMatch[1].trim().replace(/\n+/g, " | ")}`;
  }
  const roleRules = [
    "Role: Real human Pakistani software consultant chatting on WhatsApp. MUST reply in Roman Urdu only (Urdu words written in English letters, like 'bhai', 'kitna', 'Walaikum Assalam'). NEVER reply in English.",
    "RULES: (1) NEVER invent a persona name like 'Aamir'. (2) NEVER offer SEO or web design. (3) ClipShield and VoiceDelta are ALWAYS available. (4) For VoiceDelta, always call it VoiceDelta (not ElevenLabs). (5) In ongoing chats, do NOT repeat 'AOA' or the customer's name on every message. (6) NEVER use markdown link syntax [text](url) \u2014 always write URLs as plain text. (7) NEVER fabricate account numbers, payment details, or bank info \u2014 only use what is given."
  ].join("\n");
  if (salesDirectives.includes("template message was JUST sent")) {
    extractedLinksBlock = "";
  }
  const bodyParts = [
    roleRules,
    toolSummary,
    salesDirectives,
    recentContext,
    customerMsg ? `Customer message: "${customerMsg}"` : prompt.slice(-250),
    "Reply naturally as a helpful Pakistani WhatsApp seller in Roman Urdu:"
  ].filter(Boolean);
  const fullQuery = [...bodyParts, extractedLinksBlock].filter(Boolean).join("\n\n");
  return fullQuery;
}
async function callPublicFallback(provider, prompt, systemPrompt) {
  const compactQuery = buildCompactPublicQuery(prompt, systemPrompt);
  const safeQuery = compactQuery.length > 3e3 ? compactQuery.substring(0, 3e3) : compactQuery;
  const encodedQuery = encodeURIComponent(safeQuery);
  let url = `https://api-rebix.zone.id/api/gemini?q=${encodedQuery}`;
  if (provider === "DeepSeek") url = `https://api-rebix.zone.id/api/deepseek-v3?q=${encodedQuery}`;
  if (provider === "GPTLogic") {
    const promptParam = encodeURIComponent(systemPrompt || "You are a helpful Pakistani sales closer.");
    url = `https://api-rebix.zone.id/api/gptlogic?q=${encodedQuery}&prompt=${promptParam}`;
  }
  try {
    console.log(`[AI] Attempting public fallback ${provider}...`);
    const response = await import_axios.default.get(url, {
      timeout: 12e3,
      headers: { "User-Agent": "WhatsApp-Sales-Agent/1.0" }
    });
    const data = response.data;
    if (data && typeof data === "object") {
      if (data.status === false || typeof data.status === "number" && data.status >= 400) {
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
    if (text && !text.startsWith('{"error"') && !text.includes("plan quota") && !text.includes("credit pack") && text.length > 3) {
      console.log(`[AI] Public fallback ${provider} succeeded (${text.length} chars)`);
      return { success: true, text, provider: `${provider} (Public)` };
    }
  } catch (err) {
    console.warn(`[AI] Public fallback ${provider} failed:`, err?.message);
  }
  return { success: false, text: "", provider };
}
async function askAI(prompt, systemPrompt, userId) {
  const settings = await getSettings(userId);
  const geminiKey = settings.geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  const groqKey = settings.groqApiKey?.trim() || process.env.GROQ_API_KEY?.trim();
  const openAiKey = settings.openAiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  const preferred = (settings.preferredApi || "gemini").toLowerCase();
  const attempts = [];
  if (preferred.includes("groq")) {
    if (groqKey) attempts.push(() => callGroq(groqKey, prompt, systemPrompt));
    if (geminiKey) attempts.push(() => callOfficialGemini(geminiKey, prompt, systemPrompt));
    if (openAiKey) attempts.push(() => callOpenAI(openAiKey, prompt, systemPrompt));
  } else if (preferred.includes("openai") || preferred.includes("gpt")) {
    if (openAiKey) attempts.push(() => callOpenAI(openAiKey, prompt, systemPrompt));
    if (geminiKey) attempts.push(() => callOfficialGemini(geminiKey, prompt, systemPrompt));
    if (groqKey) attempts.push(() => callGroq(groqKey, prompt, systemPrompt));
  } else {
    if (geminiKey) attempts.push(() => callOfficialGemini(geminiKey, prompt, systemPrompt));
    if (groqKey) attempts.push(() => callGroq(groqKey, prompt, systemPrompt));
    if (openAiKey) attempts.push(() => callOpenAI(openAiKey, prompt, systemPrompt));
  }
  for (const attempt of attempts) {
    const res = await attempt();
    if (res.success && res.text) {
      return res.text;
    }
  }
  console.warn("[AI] Official API keys not available or failed. Trying public proxy fallbacks...");
  const publicProviders = preferred.includes("deepseek") ? ["DeepSeek", "Gemini", "GPTLogic"] : ["Gemini", "DeepSeek", "GPTLogic"];
  for (const prov of publicProviders) {
    const res = await callPublicFallback(prov, prompt, systemPrompt);
    if (res.success && res.text) {
      return res.text;
    }
  }
  console.error("[AI] All AI endpoints failed or timed out. Please configure an API Key (Gemini, Groq, or OpenAI) in Settings.");
  const lang = settings.language || "Roman Urdu";
  if (lang.toLowerCase().includes("urdu")) {
    return "Haan bhai, abhi thoda network issue hai. Thodi der baad msg krna ya try krlo.";
  }
  return "Hey, having a brief network issue. Please try again in a moment.";
}
var import_axios, import_genai;
var init_ai = __esm({
  "src/server/ai.ts"() {
    import_axios = __toESM(require("axios"), 1);
    import_genai = require("@google/genai");
    init_settings();
  }
});

// src/server/storage/json-store.ts
var import_promises3, import_path3, JsonStore;
var init_json_store = __esm({
  "src/server/storage/json-store.ts"() {
    import_promises3 = __toESM(require("fs/promises"), 1);
    import_path3 = __toESM(require("path"), 1);
    JsonStore = class {
      constructor(filePath, defaultValue) {
        this.cachedData = null;
        this.writeQueue = Promise.resolve();
        this.isLoaded = false;
        this.filePath = filePath;
        this.defaultValue = defaultValue;
      }
      /**
       * Reads data from in-memory cache, or loads from disk on first call.
       */
      async get() {
        if (this.isLoaded && this.cachedData !== null) {
          return this.cachedData;
        }
        return this.reload();
      }
      /**
       * Forces a reload from disk.
       */
      async reload() {
        try {
          await import_promises3.default.mkdir(import_path3.default.dirname(this.filePath), { recursive: true });
          const raw = await import_promises3.default.readFile(this.filePath, "utf-8");
          this.cachedData = JSON.parse(raw);
          this.isLoaded = true;
          return this.cachedData;
        } catch (err) {
          if (err.code === "ENOENT") {
            this.cachedData = JSON.parse(JSON.stringify(this.defaultValue));
            this.isLoaded = true;
            await this.writeDirect(this.cachedData);
            return this.cachedData;
          }
          console.warn(`[JsonStore] Failed to read ${this.filePath}, falling back to defaults:`, err.message);
          this.cachedData = JSON.parse(JSON.stringify(this.defaultValue));
          this.isLoaded = true;
          return this.cachedData;
        }
      }
      /**
       * Queues an atomic write to disk and updates in-memory cache immediately.
       */
      async set(data) {
        this.cachedData = data;
        this.isLoaded = true;
        this.writeQueue = this.writeQueue.then(() => this.writeDirect(data)).catch((err) => {
          console.error(`[JsonStore] Error writing to ${this.filePath}:`, err);
        });
        return this.writeQueue;
      }
      /**
       * Atomically mutates current state using an updater function.
       */
      async update(updater) {
        const current = await this.get();
        const updated = await updater(current);
        await this.set(updated);
        return updated;
      }
      /**
       * Performs an atomic write using a temporary file and fs.rename.
       */
      async writeDirect(data) {
        const dir = import_path3.default.dirname(this.filePath);
        await import_promises3.default.mkdir(dir, { recursive: true });
        const serialized = JSON.stringify(data, null, 2);
        const tempPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
        try {
          await import_promises3.default.writeFile(tempPath, serialized, "utf-8");
          await import_promises3.default.rename(tempPath, this.filePath);
        } catch (writeErr) {
          try {
            await import_promises3.default.unlink(tempPath);
          } catch {
          }
          throw writeErr;
        }
      }
    };
  }
});

// src/server/services/memory-summarizer.ts
function extractStructuredMemory(existingSummary, messages, customerNameHint) {
  const summary = {
    customerName: existingSummary?.customerName || customerNameHint || void 0,
    preferredLanguage: existingSummary?.preferredLanguage || "Roman Urdu",
    interestedTools: [...existingSummary?.interestedTools || []],
    quotedPrices: { ...existingSummary?.quotedPrices || {} },
    objectionsRaised: [...existingSummary?.objectionsRaised || []],
    objectionsResolved: [...existingSummary?.objectionsResolved || []],
    keyFacts: [...existingSummary?.keyFacts || []],
    stage: existingSummary?.stage || "greeting",
    lastToolDiscussed: existingSummary?.lastToolDiscussed || void 0,
    totalTurnsCount: messages.length,
    lastSummarizedAt: (/* @__PURE__ */ new Date()).toISOString(),
    // Preserve product-lock & template state managed by the agent (never derived here).
    currentProductId: existingSummary?.currentProductId || void 0,
    currentProductName: existingSummary?.currentProductName || void 0,
    templatesSent: [...existingSummary?.templatesSent || []]
  };
  if (summary.customerName && /^(customer|user|unknown|client)$/i.test(summary.customerName)) {
    summary.customerName = void 0;
  }
  for (const msg of messages) {
    if (msg.role === "user") {
      if (!summary.customerName) {
        for (const pat of NAME_PATTERNS) {
          const match = msg.content.match(pat);
          if (match && match[1]) {
            summary.customerName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            break;
          }
        }
      }
      for (const obj of OBJECTION_PATTERNS) {
        if (obj.pattern.test(msg.content) && !summary.objectionsRaised.includes(obj.tag)) {
          summary.objectionsRaised.push(obj.tag);
        }
      }
    }
    const lower = msg.content.toLowerCase();
    if (lower.includes("clipshield") || lower.includes("clip shield") || lower.includes("clipshied") || lower.includes("copyright")) {
      if (!summary.interestedTools.includes("ClipShield")) summary.interestedTools.push("ClipShield");
      summary.lastToolDiscussed = "ClipShield";
    } else if (lower.includes("voicedelta") || lower.includes("voice delta") || lower.includes("voicedalta") || lower.includes("voiceover") || lower.includes("voice over") || lower.includes("cloning")) {
      if (!summary.interestedTools.includes("VoiceDelta")) summary.interestedTools.push("VoiceDelta");
      summary.lastToolDiscussed = "VoiceDelta";
    }
    if (msg.role === "agent") {
      for (const pat of PRICE_QUOTED_PATTERNS) {
        const priceMatch = msg.content.match(pat);
        if (priceMatch && priceMatch[1] && summary.lastToolDiscussed) {
          const quotedNum = parseInt(priceMatch[1], 10);
          if (quotedNum >= 500 && quotedNum <= 1e4) {
            summary.quotedPrices[summary.lastToolDiscussed] = `Rs. ${quotedNum}`;
            break;
          }
        }
      }
    }
  }
  const allText = messages.map((m) => m.content).join(" ").toLowerCase();
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
  const toolStr = summary.interestedTools.length > 0 ? summary.interestedTools.join(" & ") : "store catalog";
  const priceEntries = Object.entries(summary.quotedPrices);
  const priceStr = priceEntries.length > 0 ? `Quoted: ${priceEntries.map(([t, p]) => `${t} @ ${p}`).join(", ")}.` : "";
  const nameStr = summary.customerName ? `Customer ${summary.customerName}` : "Customer";
  const objectionStr = summary.objectionsRaised.length > 0 ? `Raised: ${summary.objectionsRaised.join(", ")}.` : "";
  let narrative = `${nameStr} inquired about ${toolStr}. ${priceStr} ${objectionStr} Current stage: ${summary.stage}.`.replace(/\s+/g, " ").trim();
  summary.summaryText = narrative;
  return summary;
}
var NAME_PATTERNS, PRICE_QUOTED_PATTERNS, OBJECTION_PATTERNS;
var init_memory_summarizer = __esm({
  "src/server/services/memory-summarizer.ts"() {
    NAME_PATTERNS = [
      /(?:mera\s+naam|my\s+name\s+is|i\s+am|main\s+hoon|naam\s+hai)\s+([A-Za-z]{3,20})/i,
      /^([A-Za-z]{3,15})\s+(?:here|bol\s*raha|speaking)/i
    ];
    PRICE_QUOTED_PATTERNS = [
      /(?:rs\.?|pkr|rate|price)\s*[:=]?\s*(\d{3,5})/i,
      /(\d{3,5})\s*(?:rs|pkr|mein|me)/i
    ];
    OBJECTION_PATTERNS = [
      { pattern: /(?:mehnga|expensive|bohot\s+zyada|kam\s+karo|discount)/i, tag: "price_sensitivity" },
      { pattern: /(?:soch|baad\s+me|kal|thoda\s+time|soch\s+ke)/i, tag: "needs_time" },
      { pattern: /(?:trust|scam|fraud|proof|pehle\s+account)/i, tag: "trust_hesitation" },
      { pattern: /(?:free|trial|demo|check\s+karne)/i, tag: "trial_request" }
    ];
  }
});

// src/server/usage.ts
function getTodayKey() {
  const d = /* @__PURE__ */ new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function getMonthKey() {
  const d = /* @__PURE__ */ new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
async function getUsage() {
  try {
    const raw = await import_promises4.default.readFile(USAGE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.userMonthlyAiReplies) parsed.userMonthlyAiReplies = {};
    if (!parsed.dailyAiReplies) parsed.dailyAiReplies = {};
    if (!parsed.dailyUserMessages) parsed.dailyUserMessages = {};
    if (!parsed.monthlyAiReplies) parsed.monthlyAiReplies = {};
    usageCache = parsed;
    return parsed;
  } catch {
    let seedAi = 0;
    let seedUser = 0;
    const dailyAi = {};
    const dailyUser = {};
    const monthlyAi = {};
    try {
      const customers = await getCustomers();
      Object.values(customers).forEach((c) => {
        if (c.messages && Array.isArray(c.messages)) {
          c.messages.forEach((m) => {
            const timestamp = m.timestamp ? new Date(m.timestamp) : /* @__PURE__ */ new Date();
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
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    await saveUsage(usageCache);
    return usageCache;
  }
}
async function saveUsage(usage) {
  usageCache = usage;
  usage.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  await import_promises4.default.mkdir(import_path4.default.dirname(USAGE_FILE), { recursive: true });
  await import_promises4.default.writeFile(USAGE_FILE, JSON.stringify(usage, null, 2), "utf-8");
}
async function recordAiReply(userId) {
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
async function recordUserMessage() {
  const usage = await getUsage();
  const dayKey = getTodayKey();
  usage.totalUserMessages = (usage.totalUserMessages || 0) + 1;
  usage.dailyUserMessages[dayKey] = (usage.dailyUserMessages[dayKey] || 0) + 1;
  await saveUsage(usage);
}
async function checkAiReplyQuota(userId) {
  const usage = await getUsage();
  const mKey = getMonthKey();
  const users = await getUsers();
  let targetUser = userId ? users.find((u) => u.id === userId) : null;
  if (!targetUser) {
    targetUser = users.find((u) => u.role === "admin") || users[0];
  }
  const plan = targetUser?.plan || "Free";
  const assignedLimit = targetUser?.assignedLimits?.maxAiReplies ?? targetUser?.assignedLimits?.conversionLimit;
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
  const usedThisMonth = userId && usage.userMonthlyAiReplies[userId]?.[mKey] !== void 0 ? usage.userMonthlyAiReplies[userId][mKey] : usage.monthlyAiReplies[mKey] || 0;
  const remaining = Math.max(0, limit - usedThisMonth);
  const allowed = limit >= 99999 || usedThisMonth < limit;
  return {
    allowed,
    plan,
    limit,
    usedThisMonth,
    remaining
  };
}
async function getUsageStats(userId) {
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
    dailyUserMessages: usage.dailyUserMessages
  };
}
function setupUsageRoutes(app) {
  app.get("/api/usage/stats", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const stats = await getUsageStats(user?.id);
      res.json(stats);
    } catch (err) {
      console.error("[Usage] Error getting stats:", err);
      res.status(500).json({ error: "Failed to get usage stats" });
    }
  });
  app.get("/api/usage/quota", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const quota = await checkAiReplyQuota(user?.id);
      res.json(quota);
    } catch (err) {
      console.error("[Usage] Error checking quota:", err);
      res.status(500).json({ error: "Failed to check quota" });
    }
  });
}
var import_promises4, import_path4, USAGE_FILE, usageCache;
var init_usage = __esm({
  "src/server/usage.ts"() {
    import_promises4 = __toESM(require("fs/promises"), 1);
    import_path4 = __toESM(require("path"), 1);
    init_memory();
    init_auth();
    USAGE_FILE = import_path4.default.join(process.cwd(), "data", "usage.json");
    usageCache = null;
  }
});

// src/server/memory.ts
var memory_exports = {};
__export(memory_exports, {
  VALID_CUSTOMER_STATUSES: () => VALID_CUSTOMER_STATUSES,
  getCustomerList: () => getCustomerList,
  getCustomers: () => getCustomers,
  getCustomersFile: () => getCustomersFile,
  normalizeCustomerStatus: () => normalizeCustomerStatus,
  normalizeJid: () => normalizeJid,
  saveCustomer: () => saveCustomer,
  saveCustomers: () => saveCustomers,
  setupMemoryRoutes: () => setupMemoryRoutes,
  updateCustomerMemory: () => updateCustomerMemory,
  updateCustomerStatus: () => updateCustomerStatus
});
async function getCustomers(userId) {
  return customerService.getCustomers(userId);
}
async function getCustomerList(userId) {
  return customerService.getCustomerList(userId);
}
async function saveCustomers(data, userId) {
  return customerService.saveCustomers(data, userId);
}
async function saveCustomer(phoneNumber, data, userId) {
  const cleanJid = normalizeJid(phoneNumber);
  const existing = await customerService.getCustomerByJid(cleanJid, userId);
  const updatedStatus = normalizeCustomerStatus(data.status || existing.status);
  const updated = {
    ...existing,
    ...data,
    phoneNumber: cleanJid,
    status: updatedStatus,
    userId: userId || existing.userId || "usr_admin_badar"
  };
  const customers = await customerService.getCustomers(userId);
  customers[cleanJid] = updated;
  await customerService.saveCustomers(customers, userId);
  return updated;
}
async function updateCustomerStatus(phoneNumber, newStatus, reason, changedBy = "system", paymentEvidence, userId) {
  return customerService.updateCustomerSalesState(phoneNumber, newStatus, reason, changedBy, userId, paymentEvidence);
}
async function updateCustomerMemory(phoneNumber, newMessage, role, userId = "usr_admin_badar") {
  const customer = await customerService.saveMessage(phoneNumber, role, String(newMessage), userId);
  if (role === "agent") {
    recordAiReply().catch((err) => console.error("[Memory] Error recording AI reply usage:", err));
  } else if (role === "user") {
    recordUserMessage().catch((err) => console.error("[Memory] Error recording user message usage:", err));
  }
  return customer;
}
function setupMemoryRoutes(app) {
  app.get("/api/customers", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const customers = await customerService.getCustomerList(user ? user.id : void 0);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to load customers" });
    }
  });
  app.put("/api/customers/:phoneNumber", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const { phoneNumber } = req.params;
      const cleanJid = normalizeJid(phoneNumber);
      const existing = await customerService.getCustomerByJid(cleanJid, user?.id);
      const prevStatus = existing.status || "New Customer";
      const newStatus = req.body.status ? normalizeCustomerStatus(req.body.status) : prevStatus;
      const isStatusChanged = newStatus !== prevStatus;
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const updatedCustomer = {
        ...existing,
        ...req.body,
        status: newStatus,
        phoneNumber: cleanJid,
        lastActivity: timestamp
      };
      if (isStatusChanged) {
        updatedCustomer.previousStatus = prevStatus;
        updatedCustomer.statusUpdatedAt = timestamp;
        updatedCustomer.statusReason = req.body.reason || "Manual update by admin";
        updatedCustomer.statusManagedBy = "Manual";
        if (!updatedCustomer.statusHistory) updatedCustomer.statusHistory = [];
        updatedCustomer.statusHistory.push({
          status: newStatus,
          fromStatus: prevStatus,
          toStatus: newStatus,
          timestamp,
          reason: req.body.reason || "Manual update by admin",
          changedBy: "Manual",
          updatedBy: user?.name || "Admin"
        });
        if (newStatus === "Order Complete" && updatedCustomer.paymentClaimEvidence) {
          updatedCustomer.paymentClaimEvidence.verified = true;
          updatedCustomer.paymentClaimEvidence.verifiedAt = timestamp;
          updatedCustomer.paymentClaimEvidence.verifiedBy = "admin";
        }
      }
      const customers = await customerService.getCustomers(user?.id);
      customers[cleanJid] = updatedCustomer;
      await customerService.saveCustomers(customers, user?.id);
      res.json({ success: true, customer: updatedCustomer });
    } catch (error) {
      console.error("Failed to update customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });
  app.post("/api/customers/:phoneNumber/verify-order", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const result = await customerService.updateCustomerSalesState(
        phoneNumber,
        "Order Complete",
        req.body?.note || "Payment manually verified by admin. Order Complete.",
        "Manual"
      );
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Failed to verify order:", error);
      res.status(500).json({ error: "Failed to verify order" });
    }
  });
  app.delete("/api/customers/:phoneNumber/messages", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const { phoneNumber } = req.params;
      const success = await customerService.deleteCustomerMessages(phoneNumber, user?.id);
      if (success) {
        return res.json({ success: true, message: "Chat history deleted successfully." });
      }
      res.status(404).json({ error: "Customer not found" });
    } catch (error) {
      console.error("Failed to delete chat history:", error);
      res.status(500).json({ error: "Failed to delete chat history" });
    }
  });
  app.delete("/api/customers/:phoneNumber", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const { phoneNumber } = req.params;
      const success = await customerService.deleteCustomer(phoneNumber, user?.id);
      if (success) {
        return res.json({ success: true, message: "Customer deleted successfully." });
      }
      res.status(404).json({ error: "Customer not found" });
    } catch (error) {
      console.error("Failed to delete customer:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });
}
var import_path5, getCustomersFile;
var init_memory = __esm({
  "src/server/memory.ts"() {
    import_path5 = __toESM(require("path"), 1);
    init_customer_service();
    init_auth();
    init_usage();
    getCustomersFile = () => import_path5.default.join(process.cwd(), "data", "customers.json");
  }
});

// src/server/lists.ts
var lists_exports = {};
__export(lists_exports, {
  DEFAULT_LISTS: () => DEFAULT_LISTS,
  createCustomList: () => createCustomList,
  deleteList: () => deleteList,
  getLists: () => getLists,
  getWhatsAppLabelSyncStatus: () => getWhatsAppLabelSyncStatus,
  saveLists: () => saveLists,
  setupListRoutes: () => setupListRoutes,
  syncCustomerToWhatsAppNativeLabel: () => syncCustomerToWhatsAppNativeLabel,
  updateList: () => updateList
});
async function getLists() {
  try {
    await import_promises5.default.mkdir(import_path6.default.dirname(LISTS_FILE), { recursive: true });
    const data = await import_promises5.default.readFile(LISTS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    let updated = false;
    const existingIds = new Set(parsed.map((l) => l.id));
    for (const def of DEFAULT_LISTS) {
      if (!existingIds.has(def.id)) {
        parsed.unshift(def);
        updated = true;
      }
    }
    if (updated) {
      await import_promises5.default.writeFile(LISTS_FILE, JSON.stringify(parsed, null, 2), "utf-8");
    }
    return parsed;
  } catch {
    await import_promises5.default.writeFile(LISTS_FILE, JSON.stringify(DEFAULT_LISTS, null, 2), "utf-8");
    return DEFAULT_LISTS;
  }
}
async function saveLists(lists) {
  await import_promises5.default.mkdir(import_path6.default.dirname(LISTS_FILE), { recursive: true });
  await import_promises5.default.writeFile(LISTS_FILE, JSON.stringify(lists, null, 2), "utf-8");
}
async function createCustomList(name, color, description) {
  const lists = await getLists();
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const id = `custom-${slug}-${Date.now().toString().slice(-4)}`;
  const newList = {
    id,
    name: name.trim(),
    color: color || "#6366F1",
    isDefault: false,
    description: description?.trim() || "",
    customerPhoneNumbers: [],
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  lists.push(newList);
  await saveLists(lists);
  return newList;
}
async function updateList(id, updates) {
  const lists = await getLists();
  const index = lists.findIndex((l) => l.id === id);
  if (index === -1) return null;
  const current = lists[index];
  const updated = {
    ...current,
    ...updates,
    id: current.id,
    // Preserve id
    isDefault: current.isDefault,
    // Preserve isDefault flag
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  lists[index] = updated;
  await saveLists(lists);
  return updated;
}
async function deleteList(id) {
  const lists = await getLists();
  const target = lists.find((l) => l.id === id);
  if (!target || target.isDefault) {
    return false;
  }
  const filtered = lists.filter((l) => l.id !== id);
  await saveLists(filtered);
  try {
    const customers = await getCustomerList();
    let modified = false;
    customers.forEach((c) => {
      if (c.listIds && c.listIds.includes(id)) {
        c.listIds = c.listIds.filter((lid) => lid !== id);
        modified = true;
      }
    });
    if (modified) {
      await saveCustomers(customers);
    }
  } catch (err) {
    console.error("[Lists] Failed to clean customer list references:", err);
  }
  return true;
}
function getWhatsAppLabelSyncStatus() {
  const connection = getConnectionStatus();
  const sock = getSocket();
  if (connection !== "connected" || !sock) {
    return {
      isSupported: false,
      isBusinessAccount: false,
      status: "disconnected",
      reason: "WhatsApp is not connected. Connect your WhatsApp device to check native label support."
    };
  }
  const hasLabelApi = typeof sock.addChatLabel === "function" || typeof sock.getLabels === "function" || typeof sock.chatModify === "function";
  return {
    isSupported: hasLabelApi,
    isBusinessAccount: false,
    // Standard Multi-Device WhatsApp pairing
    status: hasLabelApi ? "synced" : "unsupported",
    reason: hasLabelApi ? "WhatsApp Native Labels API available." : "Standard WhatsApp Multi-Device protocol accounts do not expose native labels. Internal CRM lists remain 100% active, automated, and synchronized across memory.",
    syncedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function syncCustomerToWhatsAppNativeLabel(phoneNumber, status) {
  const sock = getSocket();
  if (!sock) return;
  try {
    if (typeof sock.addChatLabel === "function") {
      const jid = phoneNumber.includes("@s.whatsapp.net") ? phoneNumber : `${phoneNumber.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
      await sock.addChatLabel(jid, status);
    }
  } catch (err) {
    console.debug(`[WhatsApp Labels] Native label sync notice for ${phoneNumber}:`, err);
  }
}
function setupListRoutes(app) {
  app.get("/api/lists", async (req, res) => {
    try {
      const [lists, customers] = await Promise.all([
        getLists(),
        getCustomerList()
      ]);
      const listsWithStats = lists.map((list) => {
        let count = 0;
        if (list.isDefault) {
          count = customers.filter((c) => (c.status || "New Customer").toLowerCase() === list.name.toLowerCase()).length;
        } else {
          count = customers.filter((c) => c.listIds && c.listIds.includes(list.id)).length;
        }
        return {
          ...list,
          customerCount: count
        };
      });
      res.json(listsWithStats);
    } catch (err) {
      console.error("[Lists API] Error fetching lists:", err);
      res.status(500).json({ error: "Failed to fetch lists" });
    }
  });
  app.get("/api/lists/sync-status", (req, res) => {
    res.json(getWhatsAppLabelSyncStatus());
  });
  app.post("/api/lists", async (req, res) => {
    try {
      const { name, color, description } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "List name is required" });
      }
      const list = await createCustomList(name, color || "#6366F1", description);
      res.status(201).json(list);
    } catch (err) {
      console.error("[Lists API] Error creating list:", err);
      res.status(500).json({ error: "Failed to create list" });
    }
  });
  app.put("/api/lists/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, color, description } = req.body;
      const updated = await updateList(id, { name, color, description });
      if (!updated) {
        return res.status(404).json({ error: "List not found" });
      }
      res.json(updated);
    } catch (err) {
      console.error("[Lists API] Error updating list:", err);
      res.status(500).json({ error: "Failed to update list" });
    }
  });
  app.delete("/api/lists/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await deleteList(id);
      if (!success) {
        return res.status(400).json({ error: "Cannot delete default list or list not found" });
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[Lists API] Error deleting list:", err);
      res.status(500).json({ error: "Failed to delete list" });
    }
  });
  app.post("/api/customers/:phoneNumber/lists", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const { listIds } = req.body;
      if (!Array.isArray(listIds)) {
        return res.status(400).json({ error: "listIds must be an array of strings" });
      }
      const customers = await getCustomers();
      const customer = customers[phoneNumber];
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customer.listIds = listIds;
      await saveCustomers(customers);
      res.json({ success: true, customer });
    } catch (err) {
      console.error("[Lists API] Error updating customer lists:", err);
      res.status(500).json({ error: "Failed to update customer lists" });
    }
  });
}
var import_promises5, import_path6, LISTS_FILE, DEFAULT_LISTS;
var init_lists = __esm({
  "src/server/lists.ts"() {
    import_promises5 = __toESM(require("fs/promises"), 1);
    import_path6 = __toESM(require("path"), 1);
    init_whatsapp();
    init_memory();
    LISTS_FILE = import_path6.default.join(process.cwd(), "data", "lists.json");
    DEFAULT_LISTS = [
      {
        id: "new-customer",
        name: "New Customer",
        color: "#F59E0B",
        isDefault: true,
        description: "First time contacts or inquiries without active purchasing history",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "interested",
        name: "Interested",
        color: "#3B82F6",
        isDefault: true,
        description: "Customers who have shown active interest in tools or features",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "payment-pending",
        name: "Payment Pending",
        color: "#F97316",
        isDefault: true,
        description: "Customers who requested payment details or expressed buying intent",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "payment-done",
        name: "Payment Done",
        color: "#6366F1",
        isDefault: true,
        description: "Customers claiming payment has been sent (Requires admin verification)",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "order-complete",
        name: "Order Complete",
        color: "#10B981",
        isDefault: true,
        description: "Verified paid orders and completed deliveries",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "follow-up",
        name: "Follow Up",
        color: "#64748B",
        isDefault: true,
        description: "Customers who requested a callback or future check-in",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "important",
        name: "Important",
        color: "#F43F5E",
        isDefault: true,
        description: "High priority contacts, VIPs, or special attention cases",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
  }
});

// src/server/services/customer-service.ts
function normalizeCustomerStatus(rawStatus) {
  if (!rawStatus) return "New Customer";
  const s = rawStatus.trim().toLowerCase();
  if (s === "new customer" || s === "new") return "New Customer";
  if (s === "interested") return "Interested";
  if (s === "payment pending" || s === "buying") return "Payment Pending";
  if (s === "payment done") return "Payment Done";
  if (s === "order complete" || s === "customer" || s === "completed") return "Order Complete";
  if (s === "follow up" || s === "follow-up" || s === "inactive") return "Follow Up";
  if (s === "important" || s === "vip") return "Important";
  return "New Customer";
}
function normalizeJid(jid) {
  if (!jid) return "";
  return jid.replace(/:\d+@/, "@").trim();
}
var import_path7, VALID_CUSTOMER_STATUSES, customersFilePath, customerStore, CustomerService, customerService;
var init_customer_service = __esm({
  "src/server/services/customer-service.ts"() {
    import_path7 = __toESM(require("path"), 1);
    init_json_store();
    init_memory_summarizer();
    VALID_CUSTOMER_STATUSES = [
      "New Customer",
      "Interested",
      "Payment Pending",
      "Payment Done",
      "Order Complete",
      "Follow Up",
      "Important"
    ];
    customersFilePath = import_path7.default.join(process.cwd(), "data", "customers.json");
    customerStore = new JsonStore(customersFilePath, {});
    CustomerService = class {
      constructor(store) {
        this.store = store;
      }
      /**
       * Loads existing customer record BEFORE generating a reply.
       * Keyed permanently by normalized phone number/JID.
       */
      async getCustomerByJid(jid, userId = "usr_admin_badar", nameHint) {
        const cleanJid = normalizeJid(jid);
        const customers = await this.store.get();
        let customer = customers[cleanJid];
        if (!customer) {
          customer = {
            phoneNumber: cleanJid,
            userId,
            name: nameHint && !/^(customer|user|client)$/i.test(nameHint) ? nameHint : void 0,
            status: "New Customer",
            statusManagedBy: "AI managed",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            lastActivity: (/* @__PURE__ */ new Date()).toISOString(),
            messages: [],
            factsStated: {},
            memorySummary: {
              customerName: nameHint && !/^(customer|user|client)$/i.test(nameHint) ? nameHint : void 0,
              stage: "greeting",
              interestedTools: [],
              quotedPrices: {},
              objectionsRaised: [],
              keyFacts: [],
              totalTurnsCount: 0,
              summaryText: "New lead. No prior conversation."
            }
          };
          customers[cleanJid] = customer;
          await this.store.set(customers);
        } else {
          if (!customer.memorySummary) {
            customer.memorySummary = extractStructuredMemory(void 0, customer.messages || [], customer.name || nameHint);
            customer.summary = customer.memorySummary.summaryText;
            customers[cleanJid] = customer;
            await this.store.set(customers);
          }
          if (nameHint && !customer.name && !/^(customer|user|client)$/i.test(nameHint)) {
            customer.name = nameHint;
            if (customer.memorySummary) customer.memorySummary.customerName = nameHint;
            customers[cleanJid] = customer;
            await this.store.set(customers);
          }
        }
        return customer;
      }
      /**
       * Retrieves conversation history with optional limit.
       * Default: returns last N messages to eliminate prompt bloat.
       */
      async getConversationHistory(jid, userId = "usr_admin_badar", limit) {
        const customer = await this.getCustomerByJid(jid, userId);
        const messages = customer.messages || [];
        if (typeof limit === "number" && limit > 0) {
          return messages.slice(-limit);
        }
        return messages;
      }
      /**
       * Retrieves compact long-term customer summary.
       */
      async getCustomerSummary(jid, userId = "usr_admin_badar") {
        const customer = await this.getCustomerByJid(jid, userId);
        if (!customer.memorySummary) {
          customer.memorySummary = extractStructuredMemory(void 0, customer.messages || [], customer.name);
        }
        return customer.memorySummary;
      }
      /**
       * Saves incoming customer message or outgoing agent message immediately after processing.
       */
      async saveMessage(jid, role, content, userId = "usr_admin_badar", metadata) {
        const cleanJid = normalizeJid(jid);
        const customers = await this.store.get();
        let customer = customers[cleanJid];
        if (!customer) {
          customer = await this.getCustomerByJid(cleanJid, userId, metadata?.nameHint);
          customers[cleanJid] = customer;
        }
        if (!customer.messages) customer.messages = [];
        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
        customer.messages.push({
          role,
          content,
          timestamp,
          imageUrl: metadata?.imageUrl
        });
        customer.lastActivity = timestamp;
        if (metadata?.nameHint && !customer.name && !/^(customer|user|client)$/i.test(metadata.nameHint)) {
          customer.name = metadata.nameHint;
        }
        if (customer.messages.length > 40) {
          customer.messages = customer.messages.slice(-40);
        }
        customer.memorySummary = extractStructuredMemory(customer.memorySummary, customer.messages, customer.name || metadata?.nameHint);
        customer.summary = customer.memorySummary.summaryText;
        customers[cleanJid] = customer;
        await this.store.set(customers);
        return customer;
      }
      /**
       * Updates customer structured memory fields.
       */
      async updateCustomerMemory(jid, memoryData, userId = "usr_admin_badar") {
        const cleanJid = normalizeJid(jid);
        const customers = await this.store.get();
        const customer = customers[cleanJid] || await this.getCustomerByJid(cleanJid, userId);
        customer.memorySummary = {
          ...customer.memorySummary || extractStructuredMemory(void 0, customer.messages || [], customer.name),
          ...memoryData,
          lastSummarizedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        customer.summary = customer.memorySummary.summaryText;
        customers[cleanJid] = customer;
        await this.store.set(customers);
        return customer;
      }
      /**
       * Updates customer sales state adhering to business logic:
       * - AI can NEVER mark Order Complete without manual verification.
       * - Preserves manual status overrides.
       * - Tracks audit history.
       */
      async updateCustomerSalesState(jid, newStatus, reason, changedBy = "system", userId = "usr_admin_badar", paymentEvidence) {
        const cleanJid = normalizeJid(jid);
        const normalized = normalizeCustomerStatus(newStatus);
        const customers = await this.store.get();
        const customer = customers[cleanJid] || await this.getCustomerByJid(cleanJid, userId);
        const previousStatus = normalizeCustomerStatus(customer.status);
        const isAi = changedBy === "ai" || changedBy === "AI managed";
        const managedByLabel = isAi ? "AI managed" : "Manual";
        if (isAi && normalized === "Order Complete") {
          return { success: false, status: previousStatus, previousStatus, customer };
        }
        if (isAi && previousStatus === "Order Complete") {
          return { success: false, status: previousStatus, previousStatus, customer };
        }
        if (isAi && previousStatus === "Important" && (normalized === "New Customer" || normalized === "Interested")) {
          return { success: false, status: previousStatus, previousStatus, customer };
        }
        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
        if (normalized === "Payment Done") {
          customer.paymentClaimEvidence = {
            claimedAt: paymentEvidence?.claimedAt || timestamp,
            messageSnippet: paymentEvidence?.messageSnippet || reason || "Customer stated payment was sent",
            verified: false
          };
        }
        if (normalized === "Order Complete" && customer.paymentClaimEvidence) {
          customer.paymentClaimEvidence.verified = true;
          customer.paymentClaimEvidence.verifiedAt = timestamp;
          customer.paymentClaimEvidence.verifiedBy = "admin";
          customer.paymentClaimEvidence.note = reason || "Payment manually verified by admin";
        }
        if (previousStatus !== normalized || !customer.statusUpdatedAt) {
          customer.previousStatus = previousStatus;
          customer.status = normalized;
          customer.statusUpdatedAt = timestamp;
          customer.statusReason = reason || `Moved from ${previousStatus} to ${normalized}`;
          customer.statusManagedBy = managedByLabel;
          if (!customer.statusHistory) customer.statusHistory = [];
          customer.statusHistory.push({
            status: normalized,
            fromStatus: previousStatus,
            toStatus: normalized,
            timestamp,
            reason: reason || `Status moved to ${normalized}`,
            changedBy: managedByLabel,
            updatedBy: managedByLabel === "AI managed" ? "AI Agent" : "Admin"
          });
          if (customer.statusHistory.length > 30) {
            customer.statusHistory = customer.statusHistory.slice(-30);
          }
          customers[cleanJid] = customer;
          await this.store.set(customers);
          Promise.resolve().then(() => (init_lists(), lists_exports)).then(({ syncCustomerToWhatsAppNativeLabel: syncCustomerToWhatsAppNativeLabel2 }) => {
            syncCustomerToWhatsAppNativeLabel2(cleanJid, normalized).catch(() => {
            });
          }).catch(() => {
          });
          return { success: true, status: normalized, previousStatus, customer };
        }
        return { success: true, status: previousStatus, previousStatus, customer };
      }
      /**
       * Multi-tenant customer query.
       */
      async getCustomers(userId) {
        const all = await this.store.get();
        if (!userId || userId === "usr_admin_badar" || userId === "admin") {
          return all;
        }
        const filtered = {};
        for (const [key, cust] of Object.entries(all)) {
          if (cust.userId === userId || !cust.userId) {
            filtered[key] = cust;
          }
        }
        return filtered;
      }
      async getCustomerList(userId) {
        const map = await this.getCustomers(userId);
        return Object.values(map);
      }
      async saveCustomers(data, userId) {
        const record = {};
        if (Array.isArray(data)) {
          data.forEach((c) => {
            if (c && c.phoneNumber) {
              record[normalizeJid(c.phoneNumber)] = { ...c, phoneNumber: normalizeJid(c.phoneNumber) };
            }
          });
        } else {
          for (const [k, v] of Object.entries(data)) {
            record[normalizeJid(k)] = { ...v, phoneNumber: normalizeJid(k) };
          }
        }
        await this.store.set(record);
      }
      async deleteCustomer(jid, userId) {
        const cleanJid = normalizeJid(jid);
        const customers = await this.store.get();
        if (customers[cleanJid]) {
          delete customers[cleanJid];
          await this.store.set(customers);
          return true;
        }
        return false;
      }
      async deleteCustomerMessages(jid, userId) {
        const cleanJid = normalizeJid(jid);
        const customers = await this.store.get();
        if (customers[cleanJid]) {
          customers[cleanJid].messages = [];
          if (customers[cleanJid].memorySummary) {
            customers[cleanJid].memorySummary.totalTurnsCount = 0;
          }
          customers[cleanJid].lastActivity = (/* @__PURE__ */ new Date()).toISOString();
          await this.store.set(customers);
          return true;
        }
        return false;
      }
      /**
       * Automatic migration for existing customer data.
       */
      async migrateLegacyCustomers() {
        const customers = await this.store.get();
        let migratedCount = 0;
        for (const [key, cust] of Object.entries(customers)) {
          let changed = false;
          if (!cust.userId) {
            cust.userId = "usr_admin_badar";
            changed = true;
          }
          if (!cust.status) {
            cust.status = "New Customer";
            changed = true;
          }
          if (!cust.memorySummary) {
            cust.memorySummary = extractStructuredMemory(void 0, cust.messages || [], cust.name);
            cust.summary = cust.memorySummary.summaryText;
            changed = true;
          }
          if (!cust.factsStated) {
            cust.factsStated = {};
            changed = true;
          }
          if (changed) {
            customers[key] = cust;
            migratedCount++;
          }
        }
        if (migratedCount > 0) {
          await this.store.set(customers);
          console.log(`[CustomerService] Migrated ${migratedCount} legacy customer records with structured memory.`);
        }
        return migratedCount;
      }
    };
    customerService = new CustomerService(customerStore);
  }
});

// src/server/tool-matcher.ts
function normalizeText(str) {
  return str.toLowerCase().replace(/[^\w\s\-\–]/g, " ").replace(/\s+/g, " ").trim();
}
function extractBaseName(name) {
  return name.split(/[\–\-\:\|]/)[0].trim().toLowerCase();
}
function detectUnknownProduct(text, tools) {
  const norm = normalizeText(text);
  for (const ext of COMMON_EXTERNAL_TOOLS) {
    const extRegex = new RegExp(`\\b${ext.replace(/\\s+/g, "\\s*")}\\b`, "i");
    if (extRegex.test(norm)) {
      const isCatalog = tools.some((t) => {
        const base = extractBaseName(t.name);
        return base.includes(ext) || (t.aliases || []).some((a) => a.toLowerCase().includes(ext)) || (t.keywords || []).some((k) => k.toLowerCase().includes(ext));
      });
      if (!isCatalog) {
        return ext.charAt(0).toUpperCase() + ext.slice(1);
      }
    }
  }
  const isCatalogDomain = /\b(?:copyright|claim|claims|bypass|voice|voices|voicedelta|clipshield|cloning|clone|tts|reframing|repurpose|youtube)\b/i.test(norm);
  if (isCatalogDomain) {
    return void 0;
  }
  const patterns = [
    /(?:kya\s+)?([a-z0-9\-\_]{3,20})\s+(?:tool|app|software|account|subscription|bot|chahiye|available|mil\s*jayega)/i,
    /(?:about|price\s+of|rate\s+for|details\s+of|buy)\s+([a-z0-9\-\_]{3,20})/i,
    /(?:pass|pas)\s+([a-z0-9\-\_]{3,20})\s+(?:hai|available)/i
  ];
  for (const pat of patterns) {
    const match = norm.match(pat);
    if (match && match[1]) {
      const candidate = match[1].toLowerCase().trim();
      if (!COMMON_STOP_WORDS.has(candidate) && candidate.length >= 3) {
        const isCatalog = tools.some((t) => {
          const base = extractBaseName(t.name);
          return base.includes(candidate) || (t.aliases || []).some((a) => a.toLowerCase().includes(candidate)) || (t.keywords || []).some((k) => k.toLowerCase().includes(candidate));
        });
        if (!isCatalog) {
          return candidate.charAt(0).toUpperCase() + candidate.slice(1);
        }
      }
    }
  }
  return void 0;
}
function matchToolExactOrAlias(text, tools) {
  const normText = normalizeText(text);
  const matchedDetails = [];
  const matchedToolsSet = /* @__PURE__ */ new Map();
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
        matchedToken: baseNameNorm
      });
    }
  }
  if (matchedToolsSet.size > 0) {
    return {
      matched: Array.from(matchedToolsSet.values()),
      confidence: "exact",
      isUnknownProduct: false,
      matchedDetails
    };
  }
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
          matchedToken: alias
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
      matchedDetails
    };
  }
  return null;
}
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = [];
  for (let i = 0; i <= b.length; i++) {
    row[i] = i;
  }
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}
function matchToolFuzzy(text, tools) {
  const normText = normalizeText(text);
  const words = normText.split(/\s+/).filter((w) => w.length >= 5);
  const matchedDetails = [];
  const matchedToolsSet = /* @__PURE__ */ new Map();
  for (const tool of tools) {
    const targets = [
      extractBaseName(tool.name),
      ...(tool.aliases || []).map((a) => normalizeText(a))
    ].filter((t) => t.length >= 5);
    for (const target of targets) {
      for (const word of words) {
        if (Math.abs(word.length - target.length) > 2) continue;
        const maxDist = target.length >= 8 ? 2 : 1;
        const dist = levenshteinDistance(word, target);
        if (dist <= maxDist) {
          matchedToolsSet.set(tool.id, tool);
          matchedDetails.push({
            toolId: tool.id,
            toolName: tool.name,
            matchedOn: "alias",
            matchedToken: `fuzzy:${word}->${target}`
          });
          break;
        }
      }
      if (target.includes(" ")) {
        const targetParts = target.split(" ");
        const allPartsPresent = targetParts.every((p) => {
          return words.some((w) => levenshteinDistance(w, p) <= (p.length >= 6 ? 1 : 0));
        });
        if (allPartsPresent) {
          matchedToolsSet.set(tool.id, tool);
          matchedDetails.push({
            toolId: tool.id,
            toolName: tool.name,
            matchedOn: "alias",
            matchedToken: `fuzzy-phrase:${target}`
          });
          break;
        }
      }
    }
  }
  if (matchedToolsSet.size > 0) {
    return {
      matched: Array.from(matchedToolsSet.values()),
      confidence: "alias",
      isUnknownProduct: false,
      matchedDetails
    };
  }
  return null;
}
async function classifyToolIntentWithLLM(text, tools, conversationHistory, userId) {
  if (!text || text.trim().length < 3) return null;
  try {
    const toolSummaries = tools.map(
      (t) => `- ID "${t.id}" (${t.name}): ${t.description.slice(0, 140)}`
    ).join("\n");
    const historySnippet = conversationHistory && conversationHistory.length > 0 ? `Recent conversation context: "${conversationHistory.slice(-2).join(" ")}"
` : "";
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
    const matchedTools = [];
    const matchedDetails = [];
    if (Array.isArray(parsed.matchedToolIds) && parsed.matchedToolIds.length > 0) {
      for (const rawId of parsed.matchedToolIds) {
        const idStr = String(rawId).trim().toLowerCase();
        const found = tools.find(
          (t) => t.id.toLowerCase() === idStr || t.name.toLowerCase() === idStr || extractBaseName(t.name) === idStr
        );
        if (found && !matchedTools.some((m) => m.id === found.id)) {
          matchedTools.push(found);
          matchedDetails.push({
            toolId: found.id,
            toolName: found.name,
            matchedOn: "semantic",
            matchedToken: text.slice(0, 40)
          });
        }
      }
    }
    if (matchedTools.length > 0) {
      return {
        matched: matchedTools,
        confidence: "semantic",
        isUnknownProduct: false,
        matchedDetails
      };
    }
    if (parsed.isUnknownProduct && parsed.queryProduct) {
      const rawProd = String(parsed.queryProduct).trim();
      const rawProdLower = rawProd.toLowerCase();
      const isCatalog = tools.some((t) => {
        const base = extractBaseName(t.name);
        return base.includes(rawProdLower) || (t.aliases || []).some((a) => a.toLowerCase().includes(rawProdLower)) || (t.keywords || []).some((k) => k.toLowerCase().includes(rawProdLower));
      });
      if (!isCatalog) {
        const isDomain = /\b(?:copyright|claim|claims|bypass|voice|voices|voicedelta|clipshield|cloning|clone|tts|reframing|repurpose)\b/i.test(rawProdLower) || /\b(?:copyright|claim|claims|bypass|voice|voices|voicedelta|clipshield|cloning|clone|tts|reframing|repurpose)\b/i.test(text);
        if (isDomain) {
          const domainTool = tools.find((t) => {
            const tText = `${t.name} ${(t.keywords || []).join(" ")} ${(t.aliases || []).join(" ")}`.toLowerCase();
            return rawProdLower.includes("copyright") && tText.includes("copyright") || rawProdLower.includes("claim") && tText.includes("claim") || rawProdLower.includes("voice") && tText.includes("voice") || text.toLowerCase().includes("copyright") && tText.includes("copyright") || text.toLowerCase().includes("voice") && tText.includes("voice");
          });
          if (domainTool) {
            return {
              matched: [domainTool],
              confidence: "semantic",
              isUnknownProduct: false,
              matchedDetails: [{
                toolId: domainTool.id,
                toolName: domainTool.name,
                matchedOn: "semantic",
                matchedToken: rawProd
              }]
            };
          }
        }
        return {
          matched: [],
          confidence: "none",
          isUnknownProduct: true,
          queryProduct: rawProd,
          matchedDetails: []
        };
      }
    }
    return {
      matched: [],
      confidence: "none",
      isUnknownProduct: false,
      matchedDetails: []
    };
  } catch (err) {
    console.warn("[ToolMatcher] AI semantic classification failed or timed out:", err?.message || err);
    return null;
  }
}
function matchToolKeywords(text, tools) {
  const normText = normalizeText(text);
  const matchedDetails = [];
  const matchedToolsSet = /* @__PURE__ */ new Map();
  for (const tool of tools) {
    const keywords = (tool.keywords || []).slice().sort((a, b) => b.length - a.length);
    for (const kw of keywords) {
      const normKw = normalizeText(kw);
      if (!normKw || normKw.length < 3) continue;
      const kwRegex = new RegExp(`\\b${normKw.replace(/\\s+/g, "\\s*")}\\b`, "i");
      if (kwRegex.test(normText)) {
        matchedToolsSet.set(tool.id, tool);
        matchedDetails.push({
          toolId: tool.id,
          toolName: tool.name,
          matchedOn: "keyword",
          matchedToken: kw
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
      matchedDetails
    };
  }
  return null;
}
function matchToolFromHistory(conversationHistory, tools, currentText = "") {
  if (!conversationHistory || conversationHistory.length === 0) return null;
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const turnNorm = normalizeText(conversationHistory[i]);
    for (const tool of tools) {
      const baseNameNorm = extractBaseName(tool.name);
      const fullNameNorm = normalizeText(tool.name);
      const baseRegex = new RegExp(`\\b${baseNameNorm.replace(/\\s+/g, "\\s*")}\\b`, "i");
      const fullRegex = new RegExp(`\\b${fullNameNorm.replace(/\\s+/g, "\\s*")}\\b`, "i");
      if (baseRegex.test(turnNorm) || fullRegex.test(turnNorm)) {
        return {
          matched: [tool],
          confidence: "alias",
          isUnknownProduct: false,
          matchedDetails: [{
            toolId: tool.id,
            toolName: tool.name,
            matchedOn: "alias",
            matchedToken: `history:${baseNameNorm}`
          }]
        };
      }
      for (const alias of tool.aliases || []) {
        const normAlias = normalizeText(alias);
        if (normAlias.length >= 4) {
          const aRegex = new RegExp(`\\b${normAlias.replace(/\\s+/g, "\\s*")}\\b`, "i");
          if (aRegex.test(turnNorm)) {
            return {
              matched: [tool],
              confidence: "alias",
              isUnknownProduct: false,
              matchedDetails: [{
                toolId: tool.id,
                toolName: tool.name,
                matchedOn: "alias",
                matchedToken: `history:${normAlias}`
              }]
            };
          }
        }
      }
    }
  }
  return null;
}
function matchToolSync(text, tools, conversationHistory) {
  const fast = matchToolExactOrAlias(text, tools);
  if (fast) return fast;
  const fuzzy = matchToolFuzzy(text, tools);
  if (fuzzy) return fuzzy;
  const kw = matchToolKeywords(text, tools);
  if (kw) return kw;
  const fromHistory = matchToolFromHistory(conversationHistory, tools, text);
  if (fromHistory) return fromHistory;
  const unknownProd = detectUnknownProduct(text, tools);
  if (unknownProd) {
    return {
      matched: [],
      confidence: "none",
      isUnknownProduct: true,
      queryProduct: unknownProd,
      matchedDetails: []
    };
  }
  return {
    matched: [],
    confidence: "none",
    isUnknownProduct: false,
    matchedDetails: []
  };
}
async function matchTool(text, tools, conversationHistory, userId) {
  const fast = matchToolExactOrAlias(text, tools);
  if (fast) return fast;
  const fuzzy = matchToolFuzzy(text, tools);
  if (fuzzy) return fuzzy;
  const kw = matchToolKeywords(text, tools);
  if (kw) return kw;
  const norm = normalizeText(text);
  const isContinuation = /\b(?:details|detail|info|information|kese|kaise|how|use|link|download|demo|trial|sample|price|rate|cost|kitne|kitna|kharidna|buy|payment|account|bhejo|haan|g|ji|theek|ok|okay)\b/i.test(norm) || norm.split(/\s+/).length <= 2;
  if (isContinuation && conversationHistory && conversationHistory.length > 0) {
    const historyMatch = matchToolFromHistory(conversationHistory, tools, text);
    if (historyMatch) return historyMatch;
  }
  for (const ext of COMMON_EXTERNAL_TOOLS) {
    const extRegex = new RegExp(`\\b${ext.replace(/\\s+/g, "\\s*")}\\b`, "i");
    if (extRegex.test(norm)) {
      const isCatalog = tools.some((t) => {
        const base = extractBaseName(t.name);
        return base.includes(ext) || (t.aliases || []).some((a) => a.toLowerCase().includes(ext)) || (t.keywords || []).some((k) => k.toLowerCase().includes(ext));
      });
      if (!isCatalog) {
        return {
          matched: [],
          confidence: "none",
          isUnknownProduct: true,
          queryProduct: ext.charAt(0).toUpperCase() + ext.slice(1),
          matchedDetails: []
        };
      }
    }
  }
  const aiMatch = await classifyToolIntentWithLLM(text, tools, conversationHistory, userId);
  if (aiMatch) {
    if (aiMatch.matched.length > 0 || aiMatch.isUnknownProduct) {
      return aiMatch;
    }
  }
  return matchToolSync(text, tools, conversationHistory);
}
function recordStatedFacts(customer, toolId, newFacts) {
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
      (existing) => normalizeText(existing) === normalizeText(trimmed)
    );
    if (!exists) {
      currentList.push(trimmed);
    }
  }
  return customer;
}
function extractMentionedFacts(replyText, tool) {
  const candidateFacts = [
    ...tool.features || [],
    ...tool.sales_points || [],
    ...tool.use_cases || []
  ];
  const cleanReply = replyText.toLowerCase().replace(/(\d+),(\d+)/g, "$1$2");
  const mentioned = [];
  for (const fact of candidateFacts) {
    const cleanFact = fact.toLowerCase().replace(/(\d+),(\d+)/g, "$1$2");
    const numbers = cleanFact.match(/\b\d+\b/g) || [];
    const significantWords = cleanFact.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !["with", "this", "that", "from", "plan", "user", "more"].includes(w));
    let isHit = false;
    if (numbers.length > 0) {
      const anyNumPresent = numbers.some((n) => cleanReply.includes(n));
      const hasWord = significantWords.some((w) => cleanReply.includes(w));
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
function clampPriceFloors(text, matchedTools) {
  if (!matchedTools || matchedTools.length === 0) return text;
  let clamped = text;
  for (const tool of matchedTools) {
    const floorPkr = tool.pricing?.min_negotiable_pkr;
    if (floorPkr && floorPkr > 0) {
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
var COMMON_EXTERNAL_TOOLS, COMMON_STOP_WORDS;
var init_tool_matcher = __esm({
  "src/server/tool-matcher.ts"() {
    init_ai();
    COMMON_EXTERNAL_TOOLS = [
      "capcut",
      "vrew",
      "invideo",
      "canva",
      "filmora",
      "synthesia",
      "midjourney",
      "suno",
      "runway",
      "pika",
      "luma",
      "adobe",
      "premiere",
      "photoshop",
      "chatgpt",
      "d-id",
      "descript",
      "opus clip",
      "submagic",
      "fliki",
      "pictory",
      "leonardo",
      "murf",
      "speechify",
      "resemble",
      "veed",
      "cupcut",
      "kamua",
      "netflix",
      "prime"
    ];
    COMMON_STOP_WORDS = /* @__PURE__ */ new Set([
      "kya",
      "hai",
      "yeh",
      "woh",
      "bhai",
      "bro",
      "sir",
      "jee",
      "han",
      "nahi",
      "ko",
      "ka",
      "ki",
      "ke",
      "me",
      "mein",
      "par",
      "se",
      "aur",
      "ya",
      "bhi",
      "toh",
      "ab",
      "abhi",
      "karo",
      "karna",
      "de",
      "do",
      "dena",
      "le",
      "lo",
      "lena",
      "chahiye",
      "hoga",
      "hogi",
      "kitne",
      "kitna",
      "price",
      "rate",
      "cost",
      "details",
      "info",
      "tool",
      "app",
      "software",
      "account",
      "link",
      "demo",
      "sample",
      "test",
      "video",
      "audio",
      "voice",
      "generator",
      "remover",
      "cloning",
      "youtube",
      "tiktok",
      "hello",
      "hi",
      "salam",
      "aoa",
      "assalam",
      "walaikum",
      "theek",
      "acha",
      "ok",
      "okay"
    ]);
  }
});

// src/server/services/tool-service.ts
var import_path8, toolsFilePath, toolStore, ToolService, toolService;
var init_tool_service = __esm({
  "src/server/services/tool-service.ts"() {
    import_path8 = __toESM(require("path"), 1);
    init_json_store();
    init_tool_matcher();
    toolsFilePath = import_path8.default.join(process.cwd(), "data", "tools.json");
    toolStore = new JsonStore(toolsFilePath, []);
    ToolService = class {
      constructor(store, isDefaultStore = false) {
        this.store = store;
        this.isDefaultStore = isDefaultStore;
      }
      /**
       * Retrieves tools belonging to the specified account.
       * Admin or unspecified gets all catalog tools.
       */
      async getAccountTools(userId) {
        const allTools = await this.store.get();
        if (!Array.isArray(allTools)) return [];
        if (!userId || userId === "usr_admin_badar" || userId === "admin") {
          return allTools;
        }
        const userTools = allTools.filter((t) => t.userId === userId);
        if (userTools.length > 0) {
          return userTools;
        }
        return allTools.filter((t) => !t.userId || t.userId === "usr_admin_badar");
      }
      /**
       * Fetches specific tool details for the account.
       */
      async getToolDetails(toolId, userId) {
        const tools = await this.getAccountTools(userId);
        return tools.find((t) => t.id === toolId) || null;
      }
      /**
       * ZERO HARDCODING: Dynamically builds a compact, 1-line-per-tool overview from stored catalog.
       */
      async getAccountToolSummary(userId) {
        const tools = await this.getAccountTools(userId);
        const active = tools.filter((t) => t.status !== "inactive");
        if (active.length === 0) {
          return "No tools currently active in catalog.";
        }
        return active.map((t) => {
          const price = t.pricePkr ? `Rs. ${t.pricePkr}/mo` : t.priceUsd ? `$${t.priceUsd}/mo` : "Available";
          const briefDesc = (t.description || "").split(".")[0].trim();
          return `- ${t.name}: ${briefDesc} (${price})`;
        }).join("\n");
      }
      /**
       * Searches and retrieves relevant tool(s) based on customer query.
       * Searches ONLY within the account's active tools.
       */
      async searchRelevantTools(query, userId, history) {
        const accountTools = await this.getAccountTools(userId);
        const activeTools = accountTools.filter((t) => t.status !== "inactive");
        return matchTool(query, activeTools, history, userId);
      }
      /**
       * Saves or updates a tool in the catalog.
       */
      async saveTool(toolData, userId = "usr_admin_badar") {
        const tools = await this.store.get();
        const existingIndex = toolData.id ? tools.findIndex((t) => t.id === toolData.id) : -1;
        let savedTool;
        if (existingIndex >= 0) {
          savedTool = {
            ...tools[existingIndex],
            ...toolData,
            id: tools[existingIndex].id
          };
          tools[existingIndex] = savedTool;
        } else {
          savedTool = {
            id: toolData.id || String(Date.now()),
            name: toolData.name || "Untitled Tool",
            userId,
            status: "active",
            category: toolData.category || "AI Tools",
            description: toolData.description || "",
            aliases: toolData.aliases || [],
            keywords: toolData.keywords || [],
            pricing: toolData.pricing || {},
            pricePkr: toolData.pricePkr,
            priceUsd: toolData.priceUsd,
            objection_responses: toolData.objection_responses || {},
            features: toolData.features || [],
            sales_points: toolData.sales_points || [],
            images: toolData.images || [],
            ...toolData
          };
          tools.push(savedTool);
        }
        await this.store.set(tools);
        if (this.isDefaultStore && process.env.NODE_ENV !== "test") {
          try {
            const defaultsStore = new JsonStore(import_path8.default.join(process.cwd(), "data_defaults", "tools.json"), []);
            await defaultsStore.set(tools);
          } catch {
          }
        }
        return savedTool;
      }
      /**
       * Deletes a tool from the catalog.
       */
      async deleteTool(toolId, userId) {
        const tools = await this.store.get();
        const filtered = tools.filter((t) => t.id !== toolId);
        if (filtered.length !== tools.length) {
          await this.store.set(filtered);
          if (this.isDefaultStore && process.env.NODE_ENV !== "test") {
            try {
              const defaultsStore = new JsonStore(import_path8.default.join(process.cwd(), "data_defaults", "tools.json"), []);
              await defaultsStore.set(filtered);
            } catch {
            }
          }
          return true;
        }
        return false;
      }
    };
    toolService = new ToolService(toolStore, true);
  }
});

// src/server/services/prompt-service.ts
function synthesizeSalesPrompt(params) {
  const {
    customer,
    matchedTools,
    allAccountToolsSummary,
    recentMessages,
    latestCustomerText,
    settings,
    isUnknownProduct,
    queryProduct,
    agentRecentlyClaimedFixed,
    lockedProductName,
    buyingIntent,
    explicitPaymentRequest,
    explicitLinkRequest,
    templateJustSent,
    wantsAlternative
  } = params;
  const memory = customer.memorySummary;
  const isReturningCustomer = Boolean(
    customer.messages && customer.messages.length > 2 || memory && memory.totalTurnsCount && memory.totalTurnsCount > 1 || customer.status !== "New Customer"
  );
  const systemPrompt = `You are an authentic, highly knowledgeable, and friendly Pakistani software sales consultant chatting with customers on WhatsApp.
TONE & PERSONALITY:
- 100% REAL HUMAN WhatsApp seller experience. Speak in natural, conversational Roman Urdu (e.g. "Walaikum Assalam bhai!", "Ji bhai bilkul", "zabardast tool hai", "scene ye hai", "bhai tension na lo").
- Warm, respectful, confident, and persuasive. You are a tech brother advising the customer on the best software for their needs.
- Keep replies natural for WhatsApp: 2 to 3 concise, punchy messages separated by "---MSG---". Never send an overwhelming wall of text, but NEVER be dry or unhelpful.

CRITICAL RULES (ABSOLUTELY NO ROBOTIC BOT BEHAVIOR & ZERO HALLUCINATIONS):
1. BANNED BOT PHRASES & FAKE PERSONAS:
   - NEVER say: "Main aap ki kya madad kar sakta hoon", "Kis cheez ke baaray mein pochna hai", "Bataen kis cheez mein help chahiye", "Helpline me khushamdeed", "Customer support me welcome".
   - NEVER introduce yourself with a persona name like "Aamir", "Ali", "Hamza", or "Agent". You represent the digital tools store directly.
   - NEVER mention, offer, or discuss SEO, web design, social media marketing, or agency services. Our store exclusively sells content creator software tools (ClipShield & VoiceDelta).
2. PRODUCT AVAILABILITY & BRAND INTEGRITY:
   - ClipShield and VoiceDelta are ALWAYS IN STOCK and AVAILABLE for immediate setup. NEVER say "yeh filhal available nahi hai".
   - When discussing VoiceDelta, ALWAYS refer to the product as VoiceDelta. NEVER rename or call the product "ElevenLabs". You can explain that VoiceDelta includes access to official ElevenLabs and OpenAI voice models, but the product is VoiceDelta.
3. GREETING CADENCE & NATURAL DIALOGUE:
   - Only greet (e.g. "AOA" or "Walaikum Assalam") ONCE at the very beginning of a conversation.
   - In an ongoing conversation (turns 2, 3, 4, etc.), DO NOT repeat greetings, and DO NOT repeat the customer's name on every message (e.g. do not say "Badar bhai" on every turn). Reply directly and conversationally to their question.
4. VALUE SELLING & REAL PERSUASION:
   - When a customer shows interest in a tool (e.g., "Clipshied tool lena ha", "voice over tool", "Copyright Removal"), enthusiastically validate their choice! Explain WHY it is the best tool, its standout features (e.g., bypasses YouTube Content ID with 9-layer protection, instant voice cloning, local PC speed), state the price clearly, and ask a relevant question about their use case.
5. RICH DETAILS ON DEMAND:
   - When the customer asks for "Details" or "How to use": Share comprehensive, structured, attractive details from the tool specifications, dynamic sections, and features. Make them realize the immense value of the software.
6. SHARE LINKS FREELY:
   - When the customer asks for "Link" or trial/download: Share the direct download/trial link or documentation link provided in the tool knowledge! Guide them warmly on how to test 1 video or sample audio.
7. CONTEXT CONTINUITY:
   - If the customer gives a short confirmation or reply like "G", "haan", "theek", "ok", "yes", "Details", NEVER reset the conversation or ask generic questions. Seamlessly connect to the tool currently under discussion.
8. STRICT SOURCE OF TRUTH:
   - Only discuss products, features, dynamic sections, and rates stored in our catalog. NEVER invent uncarried tools or fabricate features.
9. MESSAGE LENGTH (CONCISE BY DEFAULT):
   - Default reply length is 1 to 3 SHORT sentences. Do NOT send long marketing paragraphs unless the customer explicitly asks for full "details".
   - Every message must have ONE clear purpose: answer, clarify, recommend, handle an objection, negotiate, close, or give payment info. Never repeat information already shared.
10. STAY ON THE LOCKED PRODUCT (NO DRIFT):
   - Discuss ONLY the product the customer is currently asking about. NEVER switch to or pitch another product on your own.
   - Mention a different product ONLY if the customer explicitly asks for it, asks for an alternative/comparison, or the current product genuinely cannot meet their need.
11. ZERO FABRICATION (NEVER INVENT):
   - Never invent features, prices, discounts, promotions, technical capabilities, availability, account limits, customer results, testimonials, or payment confirmation. If something is not in the provided product data, say you'll confirm \u2014 do not make it up.
   - NEVER tell the customer their payment is received/verified. Only a human admin verifies payments.
12. BUYING INTENT \u2014 KNOW WHEN TO STOP SELLING:
   - If the customer is ready ("le lunga", "link bhejo", "price?", "payment details", "Pro chahiye"), STOP pitching. Reduce discovery, answer directly, and move to the requested action (link / payment / activation steps).
   - If they ask a direct question, answer it directly. If they ask for the link, send the link. If they ask for payment details, send the configured payment details.
13. OBJECTION HANDLING (DON'T DUMP DISCOUNTS):
   - On "mehnga hai / budget kam / soch ke bataunga / X me de do / dusra sasta / pehle test", first diagnose the REAL objection (price, value, trust, risk, timing, feature, competitor, indecision). Then: Acknowledge -> Diagnose -> Reframe (value) -> Resolve -> Next step.
   - Only ever offer a discount or lower price that actually exists in the product's negotiation rules / allowed discounts, and tie any concession to a condition (pay today / longer term). Never fabricate urgency or scarcity.
14. STRICT ROLE SEPARATION:
   - You are ONLY the seller. NEVER write the customer's messages or reply on their behalf (e.g. never output "haan bhej do" or "payment kaise karni hai?" as if the customer said it). Output only your own seller reply.`;
  const memoryLines = [];
  memoryLines.push(`[CUSTOMER CONTEXT & PROFILE]`);
  if (customer.name || memory?.customerName) {
    memoryLines.push(`Customer Name: ${customer.name || memory?.customerName}`);
  }
  memoryLines.push(`Relationship: ${isReturningCustomer ? "Returning Customer (CONVERSATION IS ONGOING)" : "New Lead (First Greeting)"}`);
  if (memory?.stage) {
    memoryLines.push(`Sales Stage: ${memory.stage}`);
  }
  if (memory?.lastToolDiscussed) {
    memoryLines.push(`Active Tool in Discussion: ${memory.lastToolDiscussed}`);
  }
  if (memory?.summaryText) {
    memoryLines.push(`Memory Summary: ${memory.summaryText}`);
  }
  if (memory?.quotedPrices && Object.keys(memory.quotedPrices).length > 0) {
    const quotes = Object.entries(memory.quotedPrices).map(([t, p]) => `${t}: ${p}`).join(", ");
    memoryLines.push(`Previously Quoted Rates: ${quotes}`);
  }
  if (isReturningCustomer) {
    memoryLines.push(`DIRECTIVE: Conversation is active. Do NOT greet with "AOA" or reset context. Do NOT repeatedly say customer's name. Reply directly to customer's message.`);
  }
  const toolLines = [];
  let matchedToolName = void 0;
  if (isUnknownProduct && queryProduct) {
    toolLines.push(`[EXTERNAL PRODUCT INQUIRY: "${queryProduct}"]`);
    toolLines.push(`We DO NOT carry or sell "${queryProduct}".`);
    toolLines.push(`INSTRUCTION: Honestly and politely state we don't have "${queryProduct}". Ask what specific workflow or problem they are trying to solve (e.g. video editing, voice cloning, shorts creation), without talking down on that tool.`);
  } else if (matchedTools.length > 0) {
    matchedToolName = matchedTools[0].name;
    for (const t of matchedTools) {
      toolLines.push(`=== PRODUCT CATALOG: ${t.name} ===`);
      if (t.name.toLowerCase().includes("voice")) {
        toolLines.push(`[NOTE: Product name is VoiceDelta. NEVER call this product 'ElevenLabs'. You can mention that VoiceDelta includes access to ElevenLabs voices.]`);
      }
      if (t.name.toLowerCase().includes("clip")) {
        toolLines.push(`[NOTE: ClipShield is ALWAYS IN STOCK and AVAILABLE for YouTube copyright removal and Content ID bypass.]`);
      }
      toolLines.push(`Description & Problem Solved: ${t.description}`);
      const minFloor = t.pricing?.min_negotiable_pkr || t.pricePkr || "N/A";
      toolLines.push(`Pricing: Rs. ${t.pricePkr || "N/A"}/mo ${t.priceUsd ? `($${t.priceUsd}/mo)` : ""} | Min Floor Rate: Rs. ${minFloor}`);
      if (t.pricing?.negotiation_notes) {
        toolLines.push(`Negotiation Policy: ${t.pricing.negotiation_notes}`);
      }
      if (t.features && t.features.length > 0) {
        toolLines.push(`Key Features:`);
        t.features.forEach((f) => toolLines.push(`  * ${f}`));
      }
      if (t.sales_points && t.sales_points.length > 0) {
        toolLines.push(`Standout Sales Angles & Creator Benefits:`);
        t.sales_points.forEach((s2) => toolLines.push(`  * ${s2}`));
      }
      if (t.how_to_use) {
        toolLines.push(`How To Use & Setup Instructions:
${t.how_to_use}`);
      }
      if (t.requirements && t.requirements.length > 0) {
        toolLines.push(`Requirements: ${t.requirements.join(", ")}`);
      }
      if (t.limitations && t.limitations.length > 0) {
        toolLines.push(`Limitations / Quotas: ${t.limitations.join(", ")}`);
      }
      if (t.links && t.links.length > 0) {
        toolLines.push(`Official Links & Downloads:`);
        t.links.forEach((l) => toolLines.push(`  - ${l.title}: ${l.url} ${l.note ? `(${l.note})` : ""}`));
      }
      if (t.sections && t.sections.length > 0) {
        toolLines.push(`Constant Dynamic Section Message:`);
        for (const sec of t.sections) {
          toolLines.push(sec.content || sec.title);
        }
      }
      if (t.faq && t.faq.length > 0) {
        toolLines.push(`Common Customer Questions:`);
        t.faq.slice(0, 4).forEach((q) => toolLines.push(`  Q: ${q.question} -> A: ${q.answer}`));
      }
      if (t.objection_responses) {
        if (latestCustomerText.match(/(?:mehnga|expensive|discount|kam|budget|high)/i) && t.objection_responses.too_expensive) {
          toolLines.push(`Objection Guide (Price Resistance): ${t.objection_responses.too_expensive}`);
        } else if (latestCustomerText.match(/(?:soch|time|baad)/i) && t.objection_responses.need_time) {
          toolLines.push(`Objection Guide (Needs Time): ${t.objection_responses.need_time}`);
        }
      }
      const s = t.sales;
      if (s) {
        if (s.primary_selling_point) toolLines.push(`Primary Selling Point: ${s.primary_selling_point}`);
        if (s.secondary_selling_points?.length) toolLines.push(`Secondary Selling Points: ${s.secondary_selling_points.join("; ")}`);
        if (s.value_arguments?.length) toolLines.push(`Value Arguments: ${s.value_arguments.join("; ")}`);
        if (s.ideal_customer) toolLines.push(`Ideal Customer: ${s.ideal_customer}`);
        if (s.pain_points?.length) toolLines.push(`Customer Pain Points: ${s.pain_points.join("; ")}`);
        if (s.discovery_questions?.length) toolLines.push(`Discovery Questions (ask ONE at a time when needed): ${s.discovery_questions.join(" | ")}`);
        if (s.common_objections?.length) toolLines.push(`Common Objections: ${s.common_objections.join("; ")}`);
        if (s.objection_strategy) toolLines.push(`Objection Handling Strategy: ${s.objection_strategy}`);
        if (s.negotiation_rules) toolLines.push(`Negotiation Rules: ${s.negotiation_rules}`);
        if (s.allowed_discounts) toolLines.push(`Allowed Discounts (ONLY these are permitted): ${s.allowed_discounts}`);
        if (s.urgency_rules) toolLines.push(`Urgency / Scarcity Rules (use ONLY when real / verified): ${s.urgency_rules}`);
        if (s.buying_signals?.length) toolLines.push(`Buying Signals to watch for: ${s.buying_signals.join("; ")}`);
        if (s.closing_strategy) toolLines.push(`Closing Strategy: ${s.closing_strategy}`);
        if (s.cross_sell_rules) toolLines.push(`Cross-Sell Rules: ${s.cross_sell_rules}`);
        if (s.support_notes) toolLines.push(`Support Notes: ${s.support_notes}`);
      }
    }
  } else {
    toolLines.push(`[AVAILABLE STORE TOOLS]`);
    toolLines.push(allAccountToolsSummary);
    toolLines.push(`INSTRUCTION: Greet naturally and casually as a human tech seller (e.g. "Walaikum Assalam bhai! Kya haal hain? Bataen kon sa software ya tool dekh rahe hain aap?"). NEVER use robotic bot phrases like "main kya madad kar sakta hoon". NEVER invent a persona name like 'Aamir'. NEVER mention SEO or unrelated services.`);
  }
  const isPaymentRelevant = explicitPaymentRequest || latestCustomerText.match(/(?:pay|payment|jazzcash|easypaisa|bank|raast|account|bhejo|transfer|kese\s+loon|kharidna|buy)/i) || memory?.stage === "payment_pending";
  const paymentLines = [];
  if (isPaymentRelevant) {
    const activePayments = (settings.paymentMethods || []).filter((p) => p.isActive !== false);
    if (activePayments.length > 0) {
      paymentLines.push(`[OFFICIAL PAYMENT ACCOUNTS]`);
      activePayments.forEach((p) => {
        paymentLines.push(`- ${p.provider}: ${p.accountTitle} | Number: ${p.accountNumber}${p.bankName ? ` (${p.bankName})` : ""}`);
      });
      paymentLines.push(`Closing Directive: Send payment account details clearly and ask the customer to share payment screenshot + email / Hardware ID once done.`);
    }
  }
  const turns = recentMessages.slice(-8).map((m) => {
    const speaker = m.role === "user" ? customer.name || "Customer" : "You (Agent)";
    return `${speaker}: ${m.content}`;
  });
  const negotiationGuard = agentRecentlyClaimedFixed ? `CONSISTENCY RULE: You recently stated rate is fixed. Do not immediately drop the price in this turn without value justification.` : "";
  const controlLines = [];
  if (lockedProductName && !isUnknownProduct) {
    controlLines.push(`CURRENT PRODUCT LOCK: The conversation is locked to "${lockedProductName}". Use ONLY its data above. Do NOT bring up any other product unless the customer explicitly asks.`);
  }
  if (templateJustSent) {
    controlLines.push(`NOTE: The saved product intro/template message was JUST sent to the customer automatically. Do NOT resend the link or repeat that intro \u2014 continue naturally with a short, relevant next line.`);
  }
  if (explicitPaymentRequest) {
    controlLines.push(`PAYMENT MODE: The customer is explicitly asking for payment. Send ONLY the official payment account details and how to share the screenshot/proof. Do NOT re-pitch the product or add marketing. Never claim payment is received/verified.`);
  } else if (explicitLinkRequest) {
    controlLines.push(`LINK MODE: The customer asked for the link/download. Send the actual configured link directly with a short one-line guide. No long pitch.`);
  } else if (buyingIntent) {
    controlLines.push(`HIGH BUYING INTENT: The customer is ready to move forward. Stop pitching, reduce discovery, answer directly, and guide them to the next action (payment / activation / link). Keep it to 1-2 short lines.`);
  }
  if (wantsAlternative) {
    controlLines.push(`The customer asked for an alternative/comparison \u2014 you MAY briefly compare with another catalog product here, then return focus to what fits their need.`);
  }
  const controlDirectives = controlLines.length > 0 ? `[SALES CONTROL DIRECTIVES]
${controlLines.join("\n")}` : "";
  const promptParts = [
    memoryLines.join("\n"),
    toolLines.join("\n\n"),
    paymentLines.length > 0 ? paymentLines.join("\n") : "",
    negotiationGuard,
    controlDirectives,
    turns.length > 0 ? `[RECENT CONVERSATION TURNS]:
${turns.join("\n")}` : "",
    `CUSTOMER'S LATEST MESSAGE(S): "${latestCustomerText}"`,
    `Reply ONLY as the seller (never as the customer), concise (1-3 short sentences) in natural Roman Urdu (split multiple thoughts with "---MSG---"):`
  ].filter(Boolean);
  return {
    prompt: promptParts.join("\n\n"),
    systemPrompt,
    matchedToolName
  };
}
var init_prompt_service = __esm({
  "src/server/services/prompt-service.ts"() {
  }
});

// src/server/services/reply-guard.ts
function isBareAffirmation(text) {
  if (!text) return false;
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
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
function detectPendingOffer(lastAgentText) {
  if (!lastAgentText) return null;
  const text = lastAgentText.toLowerCase();
  const isOffer = text.includes("?") || OFFER_VERB_REGEX.test(text);
  if (!isOffer) return null;
  const verb = `(?:${OFFER_VERB_SOURCE})`;
  const near = (subject) => {
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
function collectAllowedUrls(tools) {
  const urls = [];
  for (const t of tools || []) {
    for (const l of t.links || []) {
      const url = (l?.url || "").trim();
      if (url && !urls.includes(url)) urls.push(url);
    }
  }
  return urls;
}
function normalizeUrl(url) {
  return url.trim().replace(/[).,;:!?"'\]]+$/, "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
}
function hostOf(url) {
  return normalizeUrl(url).split("/")[0];
}
function flattenMarkdownLinks(text) {
  if (!text) return text;
  return text.replace(/\[([^\]\n]{1,80})\]\(\s*((?:https?:\/\/|www\.)[^\s)]+)\s*\)/gi, (_m, label, url) => {
    const clean = String(label).trim().replace(/[:\-–]\s*$/, "");
    return clean ? `${clean}: ${url}` : String(url);
  }).replace(/<((?:https?:\/\/|www\.)[^\s>]+)>/gi, "$1");
}
function enforceKnownLinks(text, allowedUrls) {
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
      return allowed[exactIndex] + trailing;
    }
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
    out = out.replace(/[ \t]*[:\-–]\s*(?=\n|$)/g, "").replace(/\(\s*\)/g, "").replace(/[ \t]{2,}/g, " ").replace(/[ \t]+(?=[.,!?])/g, "");
  }
  return { text: out.trim(), replaced, removed };
}
function stripLeadingContinuationFragment(text) {
  if (!text) return text;
  const trimmed = text.trimStart();
  const firstChar = trimmed[0];
  if (!firstChar || firstChar !== firstChar.toLowerCase() || !/[a-z]/i.test(firstChar)) {
    return text;
  }
  if (!CONTINUATION_STARTER_REGEX.test(trimmed)) return text;
  const terminator = trimmed.search(/[.!?]\s/);
  if (terminator < 0) return text;
  const rest = trimmed.slice(terminator + 1).trimStart();
  if (rest.length < 20) return text;
  if (terminator > 80) return text;
  return rest;
}
function stripRepeatedOffer(text, lastAgentText) {
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
var URL_REGEX, PLACEHOLDER_HOST_REGEX, AFFIRMATION_WORD_REGEX, AFFIRMATION_FILLER_REGEX, OFFER_VERB_SOURCE, OFFER_VERB_REGEX, CONTINUATION_STARTER_REGEX;
var init_reply_guard = __esm({
  "src/server/services/reply-guard.ts"() {
    URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>()\[\]{}"'`]+/gi;
    PLACEHOLDER_HOST_REGEX = /(?:example\.(?:com|org|net)|yourdomain|your-?site|placeholder|dummy|test\.com|xyz\.com|abc\.com|link\.com|sample\.com|domain\.com)/i;
    AFFIRMATION_WORD_REGEX = /^(?:g|gg|gee|ji|jee|jii|ha|haan|han|hn|hnji|hanji|jihan|ok|oky|okay|okk|k|acha|achaa|achha|theek|thek|thik|sahi|yes|ya|yeah|yep|yup|sure|done|zaroor|bilkul|bhejo|bhej|bhejdo|bhejde|bhejein|bhejen|send|dedo|dedein|krdo|kardo|kar|do|karo|please|plz|pls|bhai|bro|sir)$/i;
    AFFIRMATION_FILLER_REGEX = /^(?:hai|hain|hy|he|na|nah|yr|yaar|jani|jaan|zra|zara|abhi|to|tou)$/i;
    OFFER_VERB_SOURCE = "bhej(?:un|oon|on|u|ou)?|bhejta|bhejdun|bhej\\s*d(?:oon|un|u|ta)|(?:send|share|de|kar|bhej|bata)\\s*(?:kar\\s*)?(?:d(?:oon|un|u|e|ee)|deta|deti)\\s*(?:h(?:oon|u|un|o|ai))?|batau|bata\\s*(?:doon|dun)|chahiye|chahye|karun|karoon";
    OFFER_VERB_REGEX = new RegExp(`(?:${OFFER_VERB_SOURCE})`, "i");
    CONTINUATION_STARTER_REGEX = /^(?:ko|ka|ki|ke|se|me|mein|par|pe|aur|ya|taake|takay|takke|jis|jise|jin|jo|hai|hain|tha|thi|the|kar|karta|karti|karte|karne|karna|kiya|deta|deti|dete|diya|raha|rahi|rahe|wala|wali|wale|bhi|to|ho|hota|hoti|hote|nahi|na|kyunke|kyunki|lekin|magar|phir|is|us|iska|uska|jab|agar)\b/i;
  }
});

// src/server/agent.ts
function renderTemplateMessage(tm, tool) {
  const content = tm.content || "";
  if (!tm.variablesEnabled) return content;
  const link = tool.links && tool.links[0] && tool.links[0].url || "";
  const values = {
    "{tool_name}": tool.name || "",
    "{price_pkr}": tool.pricePkr ? `Rs. ${tool.pricePkr}` : "",
    "{price_usd}": tool.priceUsd ? `$${tool.priceUsd}` : "",
    "{link}": link
  };
  return content.replace(
    /\{tool_name\}|\{price_pkr\}|\{price_usd\}|\{link\}/g,
    (m) => values[m] !== void 0 && values[m] !== "" ? values[m] : m
  );
}
function stripFabricatedCustomerTurns(raw) {
  if (!raw) return raw;
  const lines = raw.split(/\r?\n/);
  const kept = [];
  for (const line of lines) {
    if (/^\s*(?:customer|user|client|grahak|buyer|cust)\s*[:\-]/i.test(line)) continue;
    kept.push(line.replace(/^\s*(?:agent|you|assistant|bot|salesperson|seller|reply)\s*[:\-]\s*/i, ""));
  }
  return kept.join("\n").trim();
}
function cleanAndFixUrls(text, templateJustSent = false) {
  if (!text) return text;
  if (templateJustSent) {
    let noUrls = text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, "").replace(/https?:\/\/[^\s)]+/g, "").replace(/`([^`]+)`/g, "$1").replace(/\s{2,}/g, " ").trim();
    noUrls = noUrls.replace(/(?:Aap\s+)?is\s+link\s+se\s+app\s+download[^\.]*[\.:]?/gi, "").trim();
    return noUrls;
  }
  let result = text.replace(
    /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, _label, url) => url.trim()
  );
  result = result.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_m, _label, target) => {
    if (target.startsWith("http")) return target.trim();
    return _label.trim();
  });
  const clipShieldRealUrl = "https://docs.google.com/document/d/1Y4dAxV-JO_scOKUW_2gXk5Mv4c59nQQvOBETKpCALF0/edit?usp=sharing";
  if (/(?:docs\.google\.com|1Y4dAxV)/i.test(result)) {
    result = result.replace(/(?:https?:\/\/[^\s)]*?)?(?:docs\.google\.com|1Y4dAxV)[^\s)]*/gi, clipShieldRealUrl);
    const escapedUrl = clipShieldRealUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regexDup = new RegExp(`(?:${escapedUrl}\\s*)+`, "g");
    result = result.replace(regexDup, clipShieldRealUrl);
  }
  const voiceDeltaRealUrl = "https://voicedelta.ai";
  if (/voicedelta\.ai/i.test(result)) {
    result = result.replace(/(?:https?:\/\/[^\s)]*?)?voicedelta\.ai[^\s)]*/gi, voiceDeltaRealUrl);
  }
  result = result.replace(/(https?:\/\/[^\s)]+)\)/g, "$1");
  result = result.replace(/`([^`]+)`/g, "$1");
  return result;
}
function isEnglishHallucination(text) {
  if (!text || text.length < 30) return false;
  const urduSignals = /\b(bhai|aap|hai|hain|kar|karo|karein|ke|liye|se|mein|ko|ne|nahi|ho|tha|thi|gy|ga|gi|gea|gya|gyi|hun|hoon|abhi|yeh|woh|toh|tab|kab|phir|aur|ya|lekin|magar|agar|chunke|kyun|kyunke|bilkul|zaroor|theek|sahi|accha|bolta|bolen|bhejo|bhejun|batao|bataen|paise|rupees|pkr|rs|month|mahina|subscription|tool|link|download|setup|payment|jazzcash|easypaisa)\b/i;
  if (urduSignals.test(text)) return false;
  const englishHallucination = /\b(the order is|your account|has been activated|please find|kindly note|dear customer|we are pleased|thank you for|your request|has been processed|attached herewith|your subscription|license key|activation code|credentials|registered under|quick-start|next steps|setup assistance)\b/i;
  return englishHallucination.test(text);
}
function startAgent() {
  console.log("[Agent] Persistent Multi-Tenant WhatsApp Sales Closer Engine initialized.");
}
async function queueMessage(phoneNumber, message, name, userId) {
  if (phoneNumber.includes("@newsletter") || phoneNumber.includes("@broadcast") || phoneNumber.includes("status@broadcast")) {
    return;
  }
  const cleanJid = normalizeJid(phoneNumber);
  const seq = ++globalSequenceCounter;
  const queueKey = `${userId || "default"}:${cleanJid}`;
  let state = customerQueues.get(queueKey);
  if (!state) {
    state = {
      phoneNumber: cleanJid,
      userId,
      name,
      pendingMessages: [],
      debounceTimer: null,
      isProcessing: false
    };
    customerQueues.set(queueKey, state);
  }
  if (name) state.name = name;
  if (userId) state.userId = userId;
  state.pendingMessages.push({
    seq,
    text: message.trim(),
    name,
    timestamp: Date.now()
  });
  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
  }
  state.debounceTimer = setTimeout(() => {
    if (state) {
      state.debounceTimer = null;
      triggerCustomerProcessing(queueKey);
    }
  }, 1350);
}
async function triggerCustomerProcessing(queueKey) {
  const state = customerQueues.get(queueKey);
  if (!state || state.isProcessing || state.pendingMessages.length === 0) {
    return;
  }
  state.isProcessing = true;
  const batch = [...state.pendingMessages];
  state.pendingMessages = [];
  try {
    await handleCustomerMessageBatch(state.phoneNumber, batch, state.name, state.userId);
  } catch (error) {
    console.error(`[Agent] Error processing customer ${state.phoneNumber}:`, error);
  } finally {
    state.isProcessing = false;
    if (state.pendingMessages.length > 0) {
      triggerCustomerProcessing(queueKey);
    }
  }
}
async function handleCustomerMessageBatch(phoneNumber, batch, name, userId = "usr_admin_badar") {
  const cleanJid = normalizeJid(phoneNumber);
  const settings = await getSettings(userId);
  if (!settings.aiAgentEnabled) {
    console.log(`[Agent:${userId}] AI Agent is disabled in settings. Skipping reply to ${cleanJid}.`);
    return;
  }
  const combinedUserText = batch.map((m) => m.text).filter(Boolean).join("\n");
  if (!combinedUserText) return;
  console.log(`[Agent:${userId}] Processing incoming batch (${batch.length} msg(s)) for ${cleanJid}:
"${combinedUserText}"`);
  await customerService.saveMessage(cleanJid, "user", combinedUserText, userId, { nameHint: name });
  await recordUserMessage();
  const quota = await checkAiReplyQuota();
  if (!quota.allowed) {
    console.log(`[Agent:${userId}] Monthly AI reply quota reached (${quota.usedThisMonth}/${quota.limit}). Skipping reply to ${cleanJid}.`);
    return;
  }
  const response = await generateResponse(cleanJid, combinedUserText, name, batch, userId);
  if (!response || response.textMessages.length === 0 && !response.imageToSend && !response.templateMessage) {
    return;
  }
  const delaySec = settings.responseDelaySeconds || 1.4;
  await sendResponse(cleanJid, response.textMessages, response.imageToSend, delaySec, userId, response.templateMessage);
  const replyParts = [];
  if (response.templateMessage) replyParts.push(response.templateMessage);
  replyParts.push(...response.textMessages);
  const replyMemoryText = replyParts.join("\n\n") + (response.imageToSend ? `
[Sent Image: ${response.imageToSend}]` : "");
  await customerService.saveMessage(cleanJid, "agent", replyMemoryText, userId);
  await recordAiReply();
}
async function generateResponse(cleanJid, latestCustomerText, name, batch, userId = "usr_admin_badar") {
  const settings = await getSettings(userId);
  const customer = await customerService.getCustomerByJid(cleanJid, userId, name);
  const recentMessages = await customerService.getConversationHistory(cleanJid, userId, 8);
  const accountTools = await toolService.getAccountTools(userId);
  const catalogSummary = await toolService.getAccountToolSummary(userId);
  const recentDialogue = recentMessages.slice(-6).map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`);
  let match = await toolService.searchRelevantTools(latestCustomerText, userId, recentDialogue);
  const directDetail = (match.matchedDetails || []).find(
    (d) => d.matchedToken !== "active-conversation-context" && !String(d.matchedToken).startsWith("history:")
  );
  const directlyDetectedTool = directDetail && match.matched.find((t) => t.id === directDetail.toolId) || null;
  const memory = customer.memorySummary || {};
  const prevProductId = memory.currentProductId;
  const prevProduct = prevProductId ? accountTools.find((t) => t.id === prevProductId) : void 0;
  const wantsAlternative = ALTERNATIVE_REGEX.test(latestCustomerText);
  let lockedTool = null;
  if (match.isUnknownProduct) {
    lockedTool = null;
  } else if (directlyDetectedTool) {
    lockedTool = directlyDetectedTool;
  } else if (prevProduct) {
    lockedTool = prevProduct;
  } else if (match.matched.length > 0) {
    lockedTool = match.matched[0];
  } else {
    const activeToolName = memory.lastToolDiscussed;
    if (activeToolName) {
      lockedTool = accountTools.find(
        (t) => t.name.toLowerCase().includes(activeToolName.toLowerCase()) || activeToolName.toLowerCase().includes(t.name.toLowerCase())
      ) || null;
    }
  }
  if (lockedTool) {
    match = {
      matched: [lockedTool],
      confidence: match.matched.some((t) => t.id === lockedTool.id) ? match.confidence : "alias",
      isUnknownProduct: false,
      queryProduct: void 0,
      matchedDetails: [
        {
          toolId: lockedTool.id,
          toolName: lockedTool.name,
          matchedOn: directlyDetectedTool ? directDetail.matchedOn : "alias",
          matchedToken: directlyDetectedTool ? directDetail.matchedToken : "current-product-lock"
        }
      ]
    };
  }
  let templateMessage = null;
  const templatesSent = [...memory.templatesSent || []];
  if (lockedTool && directlyDetectedTool && directlyDetectedTool.id === lockedTool.id) {
    const tm = lockedTool.templateMessage;
    const alreadySent = templatesSent.includes(lockedTool.id);
    const sendOnce = tm?.sendOnce !== false;
    if (tm?.enabled && (tm.content || "").trim().length > 0 && !(sendOnce && alreadySent)) {
      templateMessage = renderTemplateMessage(tm, lockedTool);
      if (!templatesSent.includes(lockedTool.id)) templatesSent.push(lockedTool.id);
    }
  }
  if (lockedTool) {
    await customerService.updateCustomerMemory(
      cleanJid,
      {
        currentProductId: lockedTool.id,
        currentProductName: lockedTool.name,
        lastToolDiscussed: lockedTool.name,
        templatesSent
      },
      userId
    );
  }
  const buyingIntent = BUYING_INTENT_REGEX.test(latestCustomerText);
  const explicitPaymentRequest = EXPLICIT_PAYMENT_REGEX.test(latestCustomerText);
  const explicitLinkRequest = EXPLICIT_LINK_REGEX.test(latestCustomerText);
  const agentRecentlyClaimedFixed = recentMessages.filter((m) => m.role === "agent").slice(-2).some((m) => /(?:fixed|kam nahi|rate final|final price|discount nahi)/i.test(m.content));
  if (explicitPaymentRequest) {
    const activePayments = (settings.paymentMethods || []).filter((p) => p.isActive !== false);
    if (activePayments.length > 0) {
      const productLine = lockedTool ? `Rs. ${lockedTool.pricePkr || "1500"}/month ke liye payment karein:` : "Payment karein:";
      const lines = [productLine];
      for (const p of activePayments) {
        lines.push(`
\u{1F4F1} *${p.provider}*
Account: ${p.accountNumber}
Title: ${p.accountTitle}${p.instructions ? `
(${p.instructions})` : ""}`);
      }
      lines.push("\nPayment ke baad screenshot + apna email / Hardware ID yahan share karein. Main activate kar deta hoon. \u2705");
      const paymentReply = lines.join("\n");
      await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, null, userId, buyingIntent);
      return {
        textMessages: [paymentReply],
        imageToSend: null,
        templateMessage
      };
    }
  }
  const lastAgentText = [...recentMessages].reverse().find((m) => m.role === "agent")?.content || null;
  const affirmedPendingLink = isBareAffirmation(latestCustomerText) && detectPendingOffer(lastAgentText) === "link";
  const primaryLink = lockedTool?.links?.find((l) => (l?.url || "").trim())?.url?.trim() || "";
  if ((explicitLinkRequest || affirmedPendingLink) && lockedTool && primaryLink && !templateMessage) {
    const guide = lockedTool.name.toLowerCase().includes("clip") ? "Yahan se app download kar ke setup guide follow karein. Pehla video free test kar sakte hain." : "Yahan se account bana ke ek sample free generate kar ke dekh lein.";
    await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, null, userId, buyingIntent);
    return {
      textMessages: [`Ye raha ${lockedTool.name} ka link:
${primaryLink}`, guide],
      imageToSend: null,
      templateMessage
    };
  }
  const { prompt, systemPrompt } = synthesizeSalesPrompt({
    customer,
    matchedTools: match.matched,
    allAccountToolsSummary: catalogSummary,
    recentMessages,
    latestCustomerText,
    settings,
    isUnknownProduct: match.isUnknownProduct,
    queryProduct: match.queryProduct,
    agentRecentlyClaimedFixed,
    lockedProductName: lockedTool?.name,
    buyingIntent,
    explicitPaymentRequest,
    explicitLinkRequest,
    templateJustSent: Boolean(templateMessage),
    wantsAlternative
  });
  console.log(`[Agent:${userId}] Querying AI for ${cleanJid} (Locked: ${lockedTool?.name || (match.isUnknownProduct ? `Unknown:${match.queryProduct}` : "CatalogOverview")}${buyingIntent ? " | HighIntent" : ""}${templateMessage ? " | TemplateFirst" : ""})...`);
  const rawReply = await askAI(prompt, systemPrompt, userId);
  let extractedAiStatus = null;
  let text = rawReply;
  const statusTagMatch = text.match(/\[(?:SET_STATUS|STATUS):\s*([^\]]+)\]/i);
  if (statusTagMatch) {
    extractedAiStatus = statusTagMatch[1].trim();
    text = text.replace(statusTagMatch[0], "").trim();
  }
  let imageToSend = null;
  const imageTagMatch = text.match(/\[(?:SEND_IMAGE|ATTACH_IMAGE):\s*([^\]]+)\]/i);
  if (imageTagMatch) {
    imageToSend = imageTagMatch[1].trim().replace(/^["']|["']$/g, "");
    text = text.replace(imageTagMatch[0], "").trim();
  }
  await evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, extractedAiStatus, userId, buyingIntent);
  text = stripFabricatedCustomerTurns(text).replace(/^["']|["']$/g, "").trim();
  if (isEnglishHallucination(text)) {
    console.log(`[Agent:${userId}] Intercepted English AI hallucination ("${text.slice(0, 40)}..."). Replacing with Roman Urdu response.`);
    if (templateMessage) {
      text = "Aap pehle test kar lein, jab satisfied hon toh batayega payment details share kar doonga.";
    } else if (lockedTool) {
      text = `ClipShield ka monthly price Rs. ${lockedTool.pricePkr || 1500} hai. Agar 1000 Pkr finalize karna hai toh bataen, main abhi link aur account details bhej deta hoon.`;
    } else {
      text = "Walaikum Assalam bhai! Kaise hain aap? Bataen konsa software ya tool dekh rahe hain aap?";
    }
  }
  text = cleanAndFixUrls(text, Boolean(templateMessage));
  if (!templateMessage) {
    const allowedUrls = collectAllowedUrls(
      lockedTool ? [lockedTool, ...accountTools.filter((t) => t.id !== lockedTool.id)] : accountTools
    );
    text = flattenMarkdownLinks(text);
    text = enforceKnownLinks(text, allowedUrls).text;
  }
  text = stripLeadingContinuationFragment(text);
  text = stripRepeatedOffer(text, lastAgentText);
  if (templateMessage && (!text || text.length < 5)) {
    text = "Aap pehle test kar lein, jab satisfied hon toh batayega payment details share kar doonga.";
  }
  if (match.matched.length > 0) {
    for (const tool of match.matched) {
      const newlyStated = extractMentionedFacts(text, tool);
      if (newlyStated.length > 0) {
        recordStatedFacts(customer, tool.id, newlyStated);
      }
    }
  }
  text = clampPriceFloors(text, match.matched.length > 0 ? match.matched : accountTools);
  let messages = [];
  if (text.includes("---MSG---")) {
    messages = text.split("---MSG---").map((m) => m.trim()).filter((m) => m.length > 0);
  } else {
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
    if (paragraphs.length > 1 && paragraphs.length <= 3) {
      messages = paragraphs;
    } else if (text.length > 0) {
      messages = [text];
    }
  }
  messages = messages.map((m) => m.replace(/^(Message\s*\d+:|\d+\.)\s*/i, "").trim()).filter((m) => m.length > 0);
  if (messages.length > 3) {
    messages = messages.slice(0, 3);
  }
  if (messages.length === 0 && imageToSend) {
    messages = ["Han bhai, ye dekho interface \u{1F447}"];
  }
  return {
    textMessages: messages,
    imageToSend,
    templateMessage
  };
}
async function sendResponse(cleanJid, textMessages, imageToSend, delaySec, userId, templateMessage) {
  if (templateMessage && templateMessage.trim().length > 0) {
    console.log(`[Agent:${userId || "default"}] Sending saved product template FIRST to ${cleanJid}.`);
    await sendMessage(cleanJid, templateMessage, userId);
    if (textMessages.length > 0 || imageToSend) {
      const waitMs = Math.max(900, Math.min(2500, delaySec * 1e3));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  for (let i = 0; i < textMessages.length; i++) {
    const msg = textMessages[i];
    console.log(`[Agent:${userId || "default"}] Sending message [${i + 1}/${textMessages.length}] to ${cleanJid}: "${msg}"`);
    await sendMessage(cleanJid, msg, userId);
    if (i < textMessages.length - 1) {
      const waitMs = Math.max(900, Math.min(2500, delaySec * 1e3));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  if (imageToSend) {
    console.log(`[Agent:${userId || "default"}] Delivering tool screenshot to ${cleanJid}: ${imageToSend}`);
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    await sendToolImage(cleanJid, imageToSend, void 0, userId);
  }
}
async function evaluateAndApplyCustomerStatus(cleanJid, customer, latestCustomerText, aiStatusTag, userId = "usr_admin_badar", buyingIntentDetected = false) {
  try {
    const currentStatus = normalizeCustomerStatus(customer?.status);
    const textLower = latestCustomerText.toLowerCase();
    let targetStatus = null;
    let reason = "";
    const paymentDoneRegex = /(payment|paise|pese|amount|raze|trx|slip|screenshot|receipt|transfer)\s*(kr|kar|bhej|send|done|diya|de diya|kardi|send kardia|ho gai|ho gyi|check|dekh|kro|karo)/i;
    const directPaidRegex = /\b(paid|transferred|bhej diya payment|kar diya payment|payment done|screenshot dekho|slip bhej|screen shot send|payment check)\b/i;
    const paymentPendingRegex = /\b(buy karna|khareedna|account number|account details|easypaisa do|jazzcash do|kahan pay|how to buy|payment method|payment karni|bank details|details bhej do pay|purchase karna|sub leni hai|account send)\b/i;
    const followUpRegex = /\b(kal message|baad me|busy hun|busy hoon|shaam ko|aglay hafte|kal baat|soch k|later|call back|contact later|phir batata|phir bataunga|abhi nahi)\b/i;
    if (paymentDoneRegex.test(textLower) || directPaidRegex.test(textLower)) {
      targetStatus = "Payment Done";
      reason = "Customer stated payment was transferred / sent receipt.";
    } else if (paymentPendingRegex.test(textLower)) {
      targetStatus = "Payment Pending";
      reason = "Customer requested payment accounts / expressed clear purchase intent.";
    } else if (followUpRegex.test(textLower)) {
      targetStatus = "Follow Up";
      reason = "Customer asked to follow up / contact later.";
    } else if (aiStatusTag && VALID_CUSTOMER_STATUSES.includes(aiStatusTag)) {
      targetStatus = normalizeCustomerStatus(aiStatusTag);
      reason = `AI evaluated conversational transition to ${targetStatus}.`;
    } else if (currentStatus === "New Customer") {
      const toolInterestRegex = /\b(tool|price|cost|features|voice|voices|video|audio|clone|cloning|demo|rate|package|plan|kitne|chahiye|available|kese)\b/i;
      if (buyingIntentDetected || toolInterestRegex.test(textLower)) {
        targetStatus = "Interested";
        reason = buyingIntentDetected ? "New customer showed strong buying intent." : "New customer inquired about tool features or pricing.";
      }
    }
    if (targetStatus && targetStatus !== currentStatus) {
      await customerService.updateCustomerSalesState(
        cleanJid,
        targetStatus,
        reason,
        "AI managed",
        userId,
        targetStatus === "Payment Done" ? { messageSnippet: latestCustomerText, claimedAt: (/* @__PURE__ */ new Date()).toISOString() } : void 0
      );
    }
  } catch (err) {
    console.error("[Agent] Error evaluating customer status:", err);
  }
}
var BUYING_INTENT_REGEX, EXPLICIT_PAYMENT_REGEX, EXPLICIT_LINK_REGEX, ALTERNATIVE_REGEX, customerQueues, globalSequenceCounter;
var init_agent = __esm({
  "src/server/agent.ts"() {
    init_ai();
    init_customer_service();
    init_tool_service();
    init_prompt_service();
    init_settings();
    init_whatsapp();
    init_usage();
    init_tool_matcher();
    init_reply_guard();
    BUYING_INTENT_REGEX = /(?:\b(?:le?na|lena|leni|chahiye|chaiye|chahye)\b|\blink\b|\bprice\b|\brate\b|\bkitne?\b|\bkitna\b|final\s*price|\bpayment\b|jazz\s*cash|jazzcash|easy\s*paisa|easypaisa|\braast\b|account\s*(?:number|details|no)|\bpro\b|start\s*kar|shuru\s*kar|kharid|khareed|purchase|\bbuy\b|sub\s*len|order\s*kar|paise?\s*(?:bhej|send|transfer|kaha))/i;
    EXPLICIT_PAYMENT_REGEX = /(?:payment\s*(?:details|method|info|kaise|karni|kar\s*d|number|account)|kaise?\s*pay|kahan?\s*(?:pay|paise|bhej)|account\s*(?:number|details|title|no)\b|jazz\s*cash|jazzcash|easy\s*paisa|easypaisa|\braast\b|bank\s*(?:details|account))/i;
    EXPLICIT_LINK_REGEX = /(?:\blink\b|\blinks\b|download|trial\s*(?:link|de)|website\s*(?:link|do)|\bportal\b)/i;
    ALTERNATIVE_REGEX = /(?:alternative|alternate|doosr|dusr|koi\s*aur|kuch\s*aur|compare|comparison|difference|farq|instead\s*of|behtar\s*option|other\s*tool|second\s*option)/i;
    customerQueues = /* @__PURE__ */ new Map();
    globalSequenceCounter = 100;
  }
});

// src/server/tools.ts
async function getTools(userId) {
  return toolService.getAccountTools(userId);
}
function setupToolsRoutes(app) {
  app.get("/api/tools", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const allTools = await toolService.getAccountTools(user ? user.id : void 0);
      if (!user || user.role === "admin") {
        return res.json(allTools);
      }
      const userTools = allTools.filter((t) => t.userId === user.id || !t.userId);
      res.json(userTools);
    } catch (error) {
      res.status(500).json({ error: "Failed to load tools" });
    }
  });
  app.post("/api/tools/upload-image", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const { filename, data, title, description, toolId } = req.body;
      if (!filename || !data || !description) {
        return res.status(400).json({ error: "Filename, image data, and description are required." });
      }
      const imagesDir = getToolImagesDir();
      await import_promises6.default.mkdir(imagesDir, { recursive: true });
      const ext = import_path9.default.extname(filename) || ".png";
      const baseName = import_path9.default.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      const uniqueFilename = `${Date.now()}_${baseName}${ext}`;
      const targetPath = import_path9.default.join(imagesDir, uniqueFilename);
      const base64Data = data.includes("base64,") ? data.split("base64,")[1] : data;
      const buffer = Buffer.from(base64Data, "base64");
      await import_promises6.default.writeFile(targetPath, buffer);
      const imageObject = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        filename: uniqueFilename,
        filepath: import_path9.default.join("data", "tool-images", uniqueFilename),
        url: `/tool-images/${uniqueFilename}`,
        title: title?.trim() || "",
        description: description.trim(),
        toolId: toolId || void 0,
        userId: user ? user.id : void 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (toolId) {
        const tool = await toolService.getToolDetails(toolId, user?.id);
        if (tool) {
          if (user && user.role !== "admin" && tool.userId && tool.userId !== user.id) {
            return res.status(403).json({ error: "Not authorized to modify this tool" });
          }
          tool.images = tool.images || [];
          tool.images.push(imageObject);
          await toolService.saveTool(tool, tool.userId || user?.id);
        }
      }
      res.json({ success: true, image: imageObject });
    } catch (error) {
      console.error("Failed to upload tool image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });
  app.post("/api/tools", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const { name, rawInfo, category, images } = req.body;
      const prompt = `You are an expert software product catalog architect and AI knowledge engineer.
Convert the following raw tool information into a clean, comprehensive, highly-structured JSON object for our software sales catalog.

CRITICAL EXTRACTION REQUIREMENTS:
1. ZERO DATA LOSS: DO NOT discard, truncate, or summarize away any links, pricing options, download URLs, setup instructions, hardware requirements, credentials, tips, or special notes.
2. DYNAMIC SECTIONS (VAST & FLEXIBLE): Analyze the raw text and automatically extract ALL distinct topics, guides, technical details, links, credentials, rules, or packages into the "sections" array. Create as many dynamic sections as needed according to the content (e.g., "Download & Trial Instructions", "License Tiers & Pricing", "9-Layer Anti-Detection Engine", "Direct Links & Resources", "Account Activation", "Monetization Guidelines", "Important Warnings", etc.). Each section must have:
   - "title": A clear descriptive title
   - "content": Complete, detailed text/markdown preserving all steps, URLs, bullet points, and specifics.
3. EXTRACT ALL LINKS: If any URLs or links are in the text, extract them into the "links" array with title, url, and note.
4. EXTRACT COMPREHENSIVE FEATURES & VALUE: Extract all real features into "features", all key selling arguments into "sales_points", use cases into "use_cases", requirements into "requirements", and step-by-step usage into "how_to_use".
5. EXTRACT PRICING: Extract standard PKR and USD prices, plus the minimum negotiable price floors.
6. RETURN RAW JSON ONLY. No conversational text, no markdown outside json.

Format required:
{
  "name": "${name}",
  "category": "${category || "AI Tools"}",
  "status": "active",
  "description": "Thorough summary of what the tool does, the core problem it solves, and why it is the best solution on the market.",
  "pricePkr": "1500",
  "priceUsd": "6",
  "aliases": ["${name.toLowerCase()}", "${name.toLowerCase().replace(/[^a-z0-9]/g, "")}"],
  "keywords": ["search keyword 1", "problem solved", "feature keyword"],
  "pricing": {
    "min_negotiable_pkr": 1200,
    "min_negotiable_usd": 5,
    "negotiation_notes": "Can offer min_negotiable_pkr only for immediate same-day payment."
  },
  "objection_responses": {
    "too_expensive": "Value reframe explaining daily cost or time saved.",
    "need_time": "Offer a sample or trial test.",
    "comparing_competitor": "Highlight local instant setup or distinct advantages."
  },
  "features": ["Feature 1 with full explanation", "Feature 2 with full explanation"],
  "sales_points": ["Sales point 1", "Sales point 2"],
  "use_cases": ["Use case 1", "Use case 2"],
  "requirements": ["Requirement 1"],
  "limitations": ["Limitation 1"],
  "how_to_use": "Step by step usage instructions",
  "faq": [
    { "question": "Question?", "answer": "Detailed answer." }
  ],
  "links": [
    { "title": "Link Title", "url": "https://...", "note": "Description of link" }
  ],
  "sections": [
    { "title": "Dynamic Section Title", "content": "Full, unabridged content for this section..." }
  ]
}

Raw Information:
${rawInfo}
`;
      const aiResponse = await askAI(prompt, void 0, user?.id);
      let parsedTool;
      try {
        const cleanedResponse = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*?\}/);
        parsedTool = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleanedResponse);
      } catch (e) {
        console.error("Failed to parse LLM structured tool:", aiResponse);
        const urlMatches = rawInfo.match(/https?:\/\/[^\s\)\"\'\<\>]+/g) || [];
        const fallbackLinks = urlMatches.map((u) => ({
          title: "Extracted Link",
          url: u,
          note: "Direct link extracted from tool information"
        }));
        parsedTool = {
          name,
          category: category || "AI Tools",
          status: "active",
          description: rawInfo.split("\n")[0] || rawInfo,
          pricePkr: "1200",
          priceUsd: "5",
          aliases: [name.toLowerCase(), name.toLowerCase().replace(/[^a-z0-9]/g, "")],
          keywords: [name.toLowerCase(), "software", "tool"],
          pricing: {
            min_negotiable_pkr: 1e3,
            min_negotiable_usd: 4,
            negotiation_notes: "Only discount for immediate same-day payment."
          },
          objection_responses: {
            too_expensive: "Explain time saved and value vs expensive alternatives.",
            need_time: "Offer a demo or sample test.",
            comparing_competitor: "Highlight instant local setup and PKR payment."
          },
          features: [],
          sales_points: [],
          use_cases: [],
          requirements: [],
          limitations: [],
          how_to_use: "",
          faq: [],
          links: fallbackLinks,
          sections: [
            {
              title: "Complete Tool Information & Draft",
              content: rawInfo
            }
          ]
        };
      }
      parsedTool.id = Date.now().toString();
      parsedTool.userId = user ? user.id : "usr_admin_badar";
      parsedTool.images = Array.isArray(images) ? images : [];
      parsedTool.category = parsedTool.category || category || "AI Tools";
      parsedTool.status = parsedTool.status || "active";
      parsedTool.rawDraft = rawInfo;
      parsedTool.sections = Array.isArray(parsedTool.sections) ? parsedTool.sections : [];
      parsedTool.links = Array.isArray(parsedTool.links) ? parsedTool.links : [];
      if (parsedTool.sections.length === 0 && rawInfo.trim().length > 0) {
        parsedTool.sections.push({
          title: "Detailed Tool Notes & Guide",
          content: rawInfo.trim()
        });
      }
      if (!Array.isArray(parsedTool.aliases) || parsedTool.aliases.length === 0) {
        parsedTool.aliases = [name.toLowerCase(), name.toLowerCase().replace(/[^a-z0-9]/g, "")];
      }
      if (!Array.isArray(parsedTool.keywords) || parsedTool.keywords.length === 0) {
        parsedTool.keywords = [name.toLowerCase(), "software", "tool"];
      }
      if (!parsedTool.pricing) {
        const pkr = parseInt(parsedTool.pricePkr || "1200", 10);
        parsedTool.pricing = {
          min_negotiable_pkr: Math.round(pkr * 0.8),
          min_negotiable_usd: 4,
          negotiation_notes: "Can offer min_negotiable_pkr only for same-day payment."
        };
      }
      if (!parsedTool.objection_responses) {
        parsedTool.objection_responses = {
          too_expensive: "Highlight time saved and value vs expensive alternatives.",
          need_time: "Offer a demo or sample test.",
          comparing_competitor: "Highlight instant local setup and PKR payment."
        };
      }
      const saved = await toolService.saveTool(parsedTool, parsedTool.userId);
      res.json(saved);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add tool" });
    }
  });
  app.put("/api/tools/:id", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const { id } = req.params;
      const updatedData = req.body;
      const existing = await toolService.getToolDetails(id, user?.id);
      if (!existing) {
        return res.status(404).json({ error: "Tool not found" });
      }
      if (user && user.role !== "admin" && existing.userId && existing.userId !== user.id) {
        return res.status(403).json({ error: "You can only edit your own tools." });
      }
      const saved = await toolService.saveTool({
        ...existing,
        ...updatedData,
        id,
        userId: existing.userId || (user ? user.id : "usr_admin_badar")
      }, existing.userId || user?.id);
      res.json({ success: true, tool: saved });
    } catch (error) {
      console.error("Failed to update tool:", error);
      res.status(500).json({ error: "Failed to update tool" });
    }
  });
  app.delete("/api/tools/:id", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const existing = await toolService.getToolDetails(req.params.id, user?.id);
      if (!existing) {
        return res.status(404).json({ error: "Tool not found" });
      }
      if (user && user.role !== "admin" && existing.userId && existing.userId !== user.id) {
        return res.status(403).json({ error: "You can only delete your own tools." });
      }
      await toolService.deleteTool(req.params.id, user?.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tool" });
    }
  });
}
var import_promises6, import_path9, getToolImagesDir;
var init_tools = __esm({
  "src/server/tools.ts"() {
    import_promises6 = __toESM(require("fs/promises"), 1);
    import_path9 = __toESM(require("path"), 1);
    init_ai();
    init_auth();
    init_tool_service();
    getToolImagesDir = () => import_path9.default.join(process.cwd(), "data", "tool-images");
  }
});

// src/server/deepgram.ts
function maskApiKey(key) {
  if (!key) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  const clean = key.trim();
  if (clean.length <= 8) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  const start = clean.substring(0, 4);
  const end = clean.substring(clean.length - 4);
  return `${start}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${end}`;
}
function maskProjectId(pid) {
  if (!pid) return "\u2022\u2022\u2022\u2022";
  const clean = pid.trim();
  if (clean.length <= 8) return clean;
  return `${clean.substring(0, 4)}...${clean.substring(clean.length - 4)}`;
}
async function getDeepgramAccounts() {
  if (accountsCache) return accountsCache;
  try {
    const data = await import_promises7.default.readFile(ACCOUNTS_FILE, "utf-8");
    accountsCache = JSON.parse(data);
    return accountsCache;
  } catch {
    const initialAccounts = [
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
        lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
        lastSuccessfulRequest: (/* @__PURE__ */ new Date()).toISOString(),
        lastError: null,
        totalRequests: 84,
        successfulRequests: 83,
        failedRequests: 1,
        totalAudioDurationSec: 1840,
        consecutiveFailures: 0,
        createdAt: new Date(Date.now() - 7 * 864e5).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "dgr_acc_secondary",
        name: "Deepgram Secondary (Backup)",
        projectId: "proj_backup_salesagent_02",
        apiKey: "e4d3c2b1a09876543210fedcba0987654321abcd",
        status: "ACTIVE",
        priority: 2,
        enabled: true,
        balance: 8.5,
        currency: "USD",
        lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
        lastSuccessfulRequest: new Date(Date.now() - 36e5).toISOString(),
        lastError: null,
        totalRequests: 28,
        successfulRequests: 28,
        failedRequests: 0,
        totalAudioDurationSec: 610,
        consecutiveFailures: 0,
        createdAt: new Date(Date.now() - 5 * 864e5).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "dgr_acc_failover",
        name: "Deepgram Enterprise Failover",
        projectId: "proj_failover_enterprise_03",
        apiKey: "99887766554433221100aabbccddeeff00112233",
        status: "ACTIVE",
        priority: 3,
        enabled: true,
        balance: 25,
        currency: "USD",
        lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
        lastSuccessfulRequest: null,
        lastError: null,
        totalRequests: 12,
        successfulRequests: 12,
        failedRequests: 0,
        totalAudioDurationSec: 245,
        consecutiveFailures: 0,
        createdAt: new Date(Date.now() - 2 * 864e5).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
    accountsCache = initialAccounts;
    await saveDeepgramAccounts(initialAccounts);
    return initialAccounts;
  }
}
async function saveDeepgramAccounts(accounts) {
  accountsCache = accounts;
  await import_promises7.default.mkdir(DATA_DIR, { recursive: true });
  await import_promises7.default.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}
async function getDeepgramConfig() {
  if (configCache) return configCache;
  try {
    const data = await import_promises7.default.readFile(CONFIG_FILE, "utf-8");
    configCache = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    return configCache;
  } catch {
    configCache = { ...DEFAULT_CONFIG };
    await saveDeepgramConfig(configCache);
    return configCache;
  }
}
async function saveDeepgramConfig(config) {
  configCache = config;
  await import_promises7.default.mkdir(DATA_DIR, { recursive: true });
  await import_promises7.default.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}
async function getDeepgramLogs() {
  if (logsCache) return logsCache;
  try {
    const data = await import_promises7.default.readFile(LOGS_FILE, "utf-8");
    logsCache = JSON.parse(data);
    return logsCache;
  } catch {
    logsCache = [];
    return logsCache;
  }
}
async function recordDeepgramLog(log) {
  const logs = await getDeepgramLogs();
  const newLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...log
  };
  logs.unshift(newLog);
  if (logs.length > 1e3) {
    logs.length = 1e3;
  }
  logsCache = logs;
  try {
    await import_promises7.default.mkdir(DATA_DIR, { recursive: true });
    await import_promises7.default.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error("[Deepgram] Failed to save usage log:", err);
  }
}
async function fetchAccountBalance(account) {
  if (!account.apiKey || !account.projectId) {
    return { success: false, error: "Missing API Key or Project ID" };
  }
  try {
    const url = `https://api.deepgram.com/v1/projects/${encodeURIComponent(account.projectId.trim())}/balances`;
    const response = await import_axios2.default.get(url, {
      headers: {
        Authorization: `Token ${account.apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      timeout: 9e3
    });
    let balance = 0;
    let currency = "USD";
    if (response.data) {
      if (Array.isArray(response.data.balances) && response.data.balances.length > 0) {
        balance = response.data.balances.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
        currency = response.data.balances[0].currency || "USD";
      } else if (typeof response.data.amount === "number") {
        balance = response.data.amount;
        currency = response.data.currency || "USD";
      } else if (Array.isArray(response.data)) {
        balance = response.data.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
        currency = response.data[0]?.currency || "USD";
      }
    }
    return { success: true, balance, currency };
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.err_msg || err.response?.data?.message || err.message || "Failed to query Deepgram API";
    console.warn(`[Deepgram] Balance check for "${account.name}" failed (Status: ${status}):`, msg);
    return { success: false, error: `[HTTP ${status || "ERR"}] ${msg}` };
  }
}
async function refreshAccountBalance(accountId) {
  const accounts = await getDeepgramAccounts();
  const config = await getDeepgramConfig();
  const acc = accounts.find((a) => a.id === accountId);
  if (!acc) return null;
  const result = await fetchAccountBalance(acc);
  acc.lastChecked = (/* @__PURE__ */ new Date()).toISOString();
  if (result.success && typeof result.balance === "number") {
    acc.balance = Math.max(0, parseFloat(result.balance.toFixed(2)));
    acc.currency = result.currency || "USD";
    acc.lastError = null;
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
  acc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await saveDeepgramAccounts(accounts);
  return acc;
}
async function refreshAllBalances() {
  const accounts = await getDeepgramAccounts();
  const config = await getDeepgramConfig();
  for (const acc of accounts) {
    if (!acc.enabled) {
      acc.status = "DISABLED";
      continue;
    }
    const result = await fetchAccountBalance(acc);
    acc.lastChecked = (/* @__PURE__ */ new Date()).toISOString();
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
    acc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  await saveDeepgramAccounts(accounts);
  return accounts;
}
async function startDeepgramBalanceMonitor() {
  const config = await getDeepgramConfig();
  const intervalMs = Math.max(1, config.autoRefreshIntervalMinutes || 5) * 60 * 1e3;
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
async function getDynamicKeyterms() {
  const config = await getDeepgramConfig();
  const keytermsSet = new Set(config.customKeyterms || []);
  try {
    const tools = await getTools();
    for (const tool of tools) {
      if (tool.name) keytermsSet.add(tool.name.trim());
      if (tool.category) keytermsSet.add(tool.category.trim());
      if (tool.sales_points && Array.isArray(tool.sales_points)) {
        for (const sp of tool.sales_points.slice(0, 3)) {
          const words = sp.split(" ").filter((w) => w.length > 4);
          words.slice(0, 2).forEach((w) => keytermsSet.add(w.replace(/[^a-zA-Z0-9]/g, "")));
        }
      }
    }
  } catch {
  }
  return Array.from(keytermsSet).filter(Boolean).slice(0, 80);
}
async function getCandidateAccounts() {
  const accounts = await getDeepgramAccounts();
  const config = await getDeepgramConfig();
  const candidates = accounts.filter(
    (a) => a.enabled && a.status !== "DISABLED" && a.status !== "EXHAUSTED"
  );
  if (candidates.length === 0) {
    return accounts.filter((a) => a.enabled && a.status !== "DISABLED");
  }
  if (config.rotationMode === "priority") {
    return candidates.sort((a, b) => a.priority - b.priority);
  }
  if (config.rotationMode === "round_robin") {
    if (candidates.length > 1) {
      roundRobinIndex = (roundRobinIndex + 1) % candidates.length;
      return [
        ...candidates.slice(roundRobinIndex),
        ...candidates.slice(0, roundRobinIndex)
      ];
    }
    return candidates;
  }
  return candidates.sort((a, b) => {
    const statusScore = (status) => {
      if (status === "ACTIVE") return 3;
      if (status === "LOW_BALANCE") return 2;
      return 1;
    };
    const scoreA = statusScore(a.status);
    const scoreB = statusScore(b.status);
    if (scoreA !== scoreB) return scoreB - scoreA;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (Math.abs(b.balance - a.balance) > 0.5) return b.balance - a.balance;
    return a.consecutiveFailures - b.consecutiveFailures;
  });
}
async function transcribeAudio(audioBuffer, options) {
  if (!audioBuffer || audioBuffer.length < 64) {
    return {
      success: false,
      transcript: "",
      error: "Audio payload is empty or corrupted (under 64 bytes)."
    };
  }
  const config = await getDeepgramConfig();
  const candidateAccounts = await getCandidateAccounts();
  if (candidateAccounts.length === 0) {
    console.error("[Deepgram Router] No enabled Deepgram transcription accounts available.");
    return {
      success: false,
      transcript: "",
      error: "No active Deepgram accounts configured or available for transcription."
    };
  }
  const keyterms = [
    ...await getDynamicKeyterms(),
    ...options?.keyterms || []
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
      const params = new URLSearchParams({
        model,
        language: config.language || "multi",
        smart_format: String(config.smartFormat !== false),
        punctuate: String(config.punctuate !== false),
        numerals: String(config.numerals !== false)
      });
      for (const kt of keyterms.slice(0, 50)) {
        params.append("keyterm", kt);
      }
      const response = await import_axios2.default.post(
        `https://api.deepgram.com/v1/listen?${params.toString()}`,
        audioBuffer,
        {
          headers: {
            Authorization: `Token ${account.apiKey.trim()}`,
            "Content-Type": mimetype.includes("audio/") ? mimetype : "audio/ogg; codecs=opus"
          },
          timeout: 25e3
        }
      );
      const data = response.data;
      const channel = data?.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];
      const transcript = alternative?.transcript?.trim() || "";
      const confidence = alternative?.confidence || 0.95;
      const durationSec = data?.metadata?.duration || Math.max(1, Math.round(audioBuffer.length / 3200));
      account.lastSuccessfulRequest = (/* @__PURE__ */ new Date()).toISOString();
      account.consecutiveFailures = 0;
      account.totalRequests = (account.totalRequests || 0) + 1;
      account.successfulRequests = (account.successfulRequests || 0) + 1;
      account.totalAudioDurationSec = (account.totalAudioDurationSec || 0) + durationSec;
      account.lastError = null;
      await saveDeepgramAccounts(await getDeepgramAccounts());
      await recordDeepgramLog({
        accountId: account.id,
        accountName: account.name,
        customerJid: options?.customerJid,
        audioDurationSec: durationSec,
        model,
        status: "success",
        transcriptSnippet: transcript.substring(0, 100)
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
        confidence
      };
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.err_msg || err.response?.data?.message || err.message || "Deepgram HTTP error";
      console.warn(
        `[Deepgram Router] Request failed on "${account.name}" (Status ${status}): ${errorMsg}`
      );
      if (status === 400 && (errorMsg.toLowerCase().includes("audio") || errorMsg.toLowerCase().includes("media") || errorMsg.toLowerCase().includes("format") || errorMsg.toLowerCase().includes("corrupt") || errorMsg.toLowerCase().includes("cannot decode"))) {
        console.error(`[Deepgram Router] Audio data is unsupported or malformed. Aborting failover loop.`);
        await recordDeepgramLog({
          accountId: account.id,
          accountName: account.name,
          customerJid: options?.customerJid,
          audioDurationSec: 0,
          model,
          status: "failed",
          errorType: "MALFORMED_AUDIO",
          errorMessage: errorMsg
        });
        return {
          success: false,
          transcript: "",
          error: `Audio format error: ${errorMsg}`
        };
      }
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
        errorMessage: errorMsg
      });
      await saveDeepgramAccounts(await getDeepgramAccounts());
      console.log(`[Deepgram Router] Failing over from "${account.name}" to next candidate provider...`);
    }
  }
  return {
    success: false,
    transcript: "",
    error: `All Deepgram providers failed. Last error: ${lastError || "Service unavailable"}`
  };
}
function setupDeepgramRoutes(app) {
  app.get("/api/admin/deepgram/stats", async (req, res) => {
    try {
      const accounts = await getDeepgramAccounts();
      const logs = await getDeepgramLogs();
      const totalBalance = accounts.filter((a) => a.enabled && a.status !== "EXHAUSTED" && a.status !== "ERROR").reduce((sum, a) => sum + (a.balance || 0), 0);
      const activeAccountsCount = accounts.filter(
        (a) => a.enabled && (a.status === "ACTIVE" || a.status === "LOW_BALANCE")
      ).length;
      const now = /* @__PURE__ */ new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const weekAgo = todayMidnight - 7 * 864e5;
      const monthAgo = todayMidnight - 30 * 864e5;
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
            failed: weekLogs.filter((l) => l.status === "failed").length
          },
          month: {
            requests: monthLogs.length,
            audioMinutes: parseFloat((monthLogs.reduce((s, l) => s + (l.audioDurationSec || 0), 0) / 60).toFixed(1)),
            failed: monthLogs.filter((l) => l.status === "failed").length
          },
          allTime: { requests: allTimeRequests, audioMinutes: allTimeMinutes, failed: allTimeFailed }
        }
      });
    } catch (err) {
      console.error("[Deepgram] Error fetching stats:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/admin/deepgram/accounts", async (req, res) => {
    try {
      const accounts = await getDeepgramAccounts();
      const sanitized = accounts.map((a) => ({
        ...a,
        maskedApiKey: maskApiKey(a.apiKey),
        maskedProjectId: maskProjectId(a.projectId),
        apiKey: void 0
        // Never expose raw API key to browser!
      }));
      res.json(sanitized);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/admin/deepgram/accounts", async (req, res) => {
    try {
      const { name, projectId, apiKey, priority, enabled } = req.body;
      if (!name || !projectId || !apiKey) {
        return res.status(400).json({ error: "Account Name, Project ID, and API Key are required." });
      }
      const accounts = await getDeepgramAccounts();
      const config = await getDeepgramConfig();
      const newAccount = {
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const balCheck = await fetchAccountBalance(newAccount);
      newAccount.lastChecked = (/* @__PURE__ */ new Date()).toISOString();
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
          apiKey: void 0
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
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
      existing.name = name !== void 0 ? name.trim() : existing.name;
      existing.projectId = projectId !== void 0 ? projectId.trim() : existing.projectId;
      if (apiKey && !apiKey.includes("\u2022\u2022\u2022\u2022")) {
        existing.apiKey = apiKey.trim();
      }
      if (priority !== void 0) existing.priority = Number(priority);
      if (enabled !== void 0) {
        existing.enabled = Boolean(enabled);
        if (!existing.enabled) {
          existing.status = "DISABLED";
        } else if (existing.status === "DISABLED") {
          existing.status = existing.balance > config.lowBalanceThreshold ? "ACTIVE" : "LOW_BALANCE";
        }
      }
      if (status) existing.status = status;
      existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await saveDeepgramAccounts(accounts);
      res.json({
        success: true,
        account: {
          ...existing,
          maskedApiKey: maskApiKey(existing.apiKey),
          maskedProjectId: maskProjectId(existing.projectId),
          apiKey: void 0
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
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
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/admin/deepgram/accounts/:id/test", async (req, res) => {
    try {
      const { id } = req.params;
      const accounts = await getDeepgramAccounts();
      const acc = accounts.find((a) => a.id === id);
      if (!acc) return res.status(404).json({ error: "Account not found." });
      const check = await fetchAccountBalance(acc);
      acc.lastChecked = (/* @__PURE__ */ new Date()).toISOString();
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
          status: acc.status
        });
      } else {
        acc.lastError = check.error || "Connection failed.";
        acc.status = "ERROR";
        await saveDeepgramAccounts(accounts);
        return res.json({
          success: false,
          message: "Connection failed.",
          error: check.error || "Deepgram returned an error."
        });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
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
          apiKey: void 0
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/admin/deepgram/refresh-all", async (req, res) => {
    try {
      const updated = await refreshAllBalances();
      const sanitized = updated.map((a) => ({
        ...a,
        maskedApiKey: maskApiKey(a.apiKey),
        maskedProjectId: maskProjectId(a.projectId),
        apiKey: void 0
      }));
      res.json({ success: true, accounts: sanitized });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/admin/deepgram/config", async (req, res) => {
    try {
      const config = await getDeepgramConfig();
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put("/api/admin/deepgram/config", async (req, res) => {
    try {
      const config = await getDeepgramConfig();
      const updated = {
        ...config,
        ...req.body
      };
      await saveDeepgramConfig(updated);
      await startDeepgramBalanceMonitor();
      res.json({ success: true, config: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/admin/deepgram/logs", async (req, res) => {
    try {
      const logs = await getDeepgramLogs();
      res.json(logs.slice(0, 150));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/admin/deepgram/test-transcribe", async (req, res) => {
    try {
      const { sampleUrl, base64Audio, mimetype } = req.body;
      let audioBuffer;
      if (base64Audio) {
        const clean = base64Audio.replace(/^data:audio\/[a-z0-9]+;base64,/, "");
        audioBuffer = Buffer.from(clean, "base64");
      } else if (sampleUrl) {
        const audioRes = await import_axios2.default.get(sampleUrl, { responseType: "arraybuffer", timeout: 1e4 });
        audioBuffer = Buffer.from(audioRes.data);
      } else {
        const defaultSample = "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav";
        const audioRes = await import_axios2.default.get(defaultSample, { responseType: "arraybuffer", timeout: 1e4 });
        audioBuffer = Buffer.from(audioRes.data);
      }
      const result = await transcribeAudio(audioBuffer, {
        mimetype: mimetype || "audio/wav",
        customerJid: "admin_test_playground"
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}
var import_promises7, import_path10, import_axios2, DATA_DIR, ACCOUNTS_FILE, CONFIG_FILE, LOGS_FILE, accountsCache, configCache, logsCache, roundRobinIndex, balanceRefreshTimer, DEFAULT_CONFIG;
var init_deepgram = __esm({
  "src/server/deepgram.ts"() {
    import_promises7 = __toESM(require("fs/promises"), 1);
    import_path10 = __toESM(require("path"), 1);
    import_axios2 = __toESM(require("axios"), 1);
    init_tools();
    DATA_DIR = import_path10.default.join(process.cwd(), "data");
    ACCOUNTS_FILE = import_path10.default.join(DATA_DIR, "deepgram_accounts.json");
    CONFIG_FILE = import_path10.default.join(DATA_DIR, "deepgram_config.json");
    LOGS_FILE = import_path10.default.join(DATA_DIR, "deepgram_logs.json");
    accountsCache = null;
    configCache = null;
    logsCache = null;
    roundRobinIndex = 0;
    balanceRefreshTimer = null;
    DEFAULT_CONFIG = {
      rotationMode: "balance_aware",
      lowBalanceThreshold: 1,
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
      ]
    };
  }
});

// src/server/whatsapp.ts
function extractIncomingText(message) {
  if (!message) return null;
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.templateButtonReplyMessage?.selectedId) return message.templateButtonReplyMessage.selectedId;
  if (message.buttonsResponseMessage?.selectedButtonId) return message.buttonsResponseMessage.selectedButtonId;
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) return message.listResponseMessage.singleSelectReply.selectedRowId;
  if (message.ephemeralMessage?.message) return extractIncomingText(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractIncomingText(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return extractIncomingText(message.viewOnceMessageV2.message);
  if (message.documentWithCaptionMessage?.message) return extractIncomingText(message.documentWithCaptionMessage.message);
  return null;
}
function getUserWASession(userId) {
  const effectiveId = userId || "usr_admin_badar";
  let session = userSessions.get(effectiveId);
  if (!session) {
    session = {
      userId: effectiveId,
      sock: null,
      qrCodeDataUrl: null,
      pairingCodeData: null,
      connectionStatus: "disconnected",
      isIntentionallyDisconnected: false,
      isConnecting: false,
      reconnectTimer: null
    };
    userSessions.set(effectiveId, session);
  }
  return session;
}
function getAuthDir(userId) {
  if (!userId || userId === "usr_admin_badar" || userId === "admin") {
    return import_path11.default.join(process.cwd(), "data", "auth", "admin");
  }
  return import_path11.default.join(process.cwd(), "data", "auth", userId);
}
async function ensureAuthDir(userId) {
  const authDir = getAuthDir(userId);
  await import_promises8.default.mkdir(authDir, { recursive: true });
  if (userId === "usr_admin_badar" || userId === "admin") {
    const legacyAuthDir = import_path11.default.join(process.cwd(), "data", "auth");
    try {
      const legacyCreds = import_path11.default.join(legacyAuthDir, "creds.json");
      await import_promises8.default.access(legacyCreds);
      const targetCreds = import_path11.default.join(authDir, "creds.json");
      try {
        await import_promises8.default.access(targetCreds);
      } catch {
        const files = await import_promises8.default.readdir(legacyAuthDir);
        for (const file of files) {
          const srcFile = import_path11.default.join(legacyAuthDir, file);
          const stat = await import_promises8.default.stat(srcFile);
          if (stat.isFile()) {
            await import_promises8.default.copyFile(srcFile, import_path11.default.join(authDir, file));
          }
        }
        console.log("[WhatsApp] Migrated legacy credentials to data/auth/admin");
      }
    } catch {
    }
  }
  return authDir;
}
async function connectToWhatsApp(userId = "usr_admin_badar", usePairingCode = false) {
  const session = getUserWASession(userId);
  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }
  if (session.isConnecting || session.connectionStatus === "connected" && session.sock) {
    return;
  }
  session.isConnecting = true;
  try {
    session.isIntentionallyDisconnected = false;
    const authDir = await ensureAuthDir(userId);
    const { state, saveCreds } = await (0, import_baileys.useMultiFileAuthState)(authDir);
    session.connectionStatus = "connecting";
    session.qrCodeDataUrl = null;
    session.pairingCodeData = null;
    if (session.sock) {
      try {
        session.sock.ev.removeAllListeners("connection.update");
        session.sock.ev.removeAllListeners("creds.update");
        session.sock.ev.removeAllListeners("messages.upsert");
        session.sock.end(void 0);
      } catch {
      }
      session.sock = null;
    }
    const newSock = (0, import_baileys.makeWASocket)({
      auth: state,
      printQRInTerminal: !usePairingCode && (userId === "usr_admin_badar" || userId === "admin"),
      browser: usePairingCode ? ["Ubuntu", "Chrome", "20.0.04"] : import_baileys.Browsers.macOS("Desktop"),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      logger: (0, import_pino.default)({ level: "silent" })
    });
    session.sock = newSock;
    newSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr && !usePairingCode) {
        session.qrCodeDataUrl = await import_qrcode.default.toDataURL(qr);
      }
      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === import_baileys.DisconnectReason.loggedOut;
        const isReplaced = statusCode === import_baileys.DisconnectReason.connectionReplaced || statusCode === 440;
        const shouldReconnect = !isLoggedOut && !isReplaced && !session.isIntentionallyDisconnected;
        session.connectionStatus = "disconnected";
        console.log(`[WhatsApp:${userId}] Connection closed. Reason: ${statusCode || lastDisconnect?.error}. Should reconnect: ${shouldReconnect}`);
        if (shouldReconnect) {
          const delay = statusCode === import_baileys.DisconnectReason.restartRequired ? 1e3 : 5e3;
          if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
          session.reconnectTimer = setTimeout(() => {
            connectToWhatsApp(userId, usePairingCode).catch(console.error);
          }, delay);
        } else if (isLoggedOut && !session.isIntentionallyDisconnected) {
          console.log(`[WhatsApp:${userId}] Session logged out. Cleaning auth directory.`);
          try {
            await import_promises8.default.rm(authDir, { recursive: true, force: true });
          } catch (e) {
            console.error(`[WhatsApp:${userId}] Failed to clean auth dir:`, e);
          }
        }
      } else if (connection === "open") {
        console.log(`[WhatsApp:${userId}] Connection opened successfully and session saved!`);
        session.connectionStatus = "connected";
        session.qrCodeDataUrl = null;
        session.pairingCodeData = null;
      }
    });
    newSock.ev.on("creds.update", async () => {
      await saveCreds();
    });
    newSock.ev.on("messages.upsert", async (m) => {
      if (m.type === "notify" || m.type === "append") {
        for (const msg of m.messages) {
          if (!msg.message) continue;
          if (msg.key.id && sentMessageIds.has(msg.key.id)) {
            sentMessageIds.delete(msg.key.id);
            continue;
          }
          const rawSender = msg.key.remoteJid;
          if (!rawSender) continue;
          const sender = rawSender.replace(/:\d+@/, "@");
          if (sender.includes("@newsletter") || sender.includes("@broadcast") || sender.includes("status@broadcast") || sender.includes("@call")) {
            continue;
          }
          if (sender.includes("@g.us")) {
            const settings = await getSettings(userId);
            if (!settings.allowGroups) {
              continue;
            }
          }
          const isDirectChat = sender.endsWith("@s.whatsapp.net") || sender.endsWith("@lid");
          const isGroupChat = sender.endsWith("@g.us");
          if (!isDirectChat && !isGroupChat) {
            continue;
          }
          const myJid = newSock.user?.id ? newSock.user.id.split(":")[0] + "@s.whatsapp.net" : null;
          const isSelfChat = Boolean(myJid && sender.split(":")[0] === myJid.split(":")[0]);
          if (msg.key.fromMe && !isSelfChat) {
            continue;
          }
          const textMessage = extractIncomingText(msg.message);
          if (textMessage) {
            console.log(`[WhatsApp:${userId}] \u{1F4E9} Received message from ${sender}: "${textMessage}"`);
            await queueMessage(sender, textMessage, msg.pushName || "Customer", userId);
          } else {
            const audioMsg = msg.message.audioMessage || msg.message.ephemeralMessage?.message?.audioMessage || msg.message.viewOnceMessage?.message?.audioMessage;
            if (audioMsg) {
              console.log(`[WhatsApp:${userId}] \u{1F399}\uFE0F Received voice message from ${sender}. Downloading audio...`);
              try {
                const buffer = await (0, import_baileys.downloadMediaMessage)(
                  msg,
                  "buffer",
                  {},
                  {
                    logger: (0, import_pino.default)({ level: "silent" }),
                    reuploadRequest: newSock.updateMediaMessage
                  }
                );
                if (buffer && buffer.length > 0) {
                  const result = await transcribeAudio(buffer, {
                    mimetype: audioMsg.mimetype || "audio/ogg; codecs=opus",
                    customerJid: sender
                  });
                  const text = typeof result === "string" ? result : result?.transcript;
                  if (text && text.trim().length > 0) {
                    console.log(`[WhatsApp:${userId}] \u{1F399}\uFE0F Voice note transcribed: "${text.trim()}"`);
                    await queueMessage(sender, text.trim(), msg.pushName || "Customer", userId);
                  } else {
                    console.warn(`[WhatsApp:${userId}] Audio transcription returned empty or failed:`, result?.error || "No transcript produced");
                  }
                }
              } catch (audioErr) {
                console.error(`[WhatsApp:${userId}] Error downloading/transcribing audio:`, audioErr);
              }
            }
          }
        }
      }
    });
  } catch (error) {
    session.connectionStatus = "disconnected";
    console.error(`[WhatsApp:${userId}] Connect error:`, error);
  } finally {
    session.isConnecting = false;
  }
}
async function sendMessage(jid, text, userId) {
  const session = getUserWASession(userId);
  const targetSock = session.sock || (userId ? getUserWASession("usr_admin_badar").sock : null);
  if (!targetSock) {
    console.warn(`[WhatsApp:${userId || "default"}] Cannot send message: socket is not connected.`);
    return;
  }
  try {
    const rawJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
    const formattedJid = rawJid.replace(/:\d+@/, "@");
    console.log(`[WhatsApp:${userId || "default"}] Sending reply to ${formattedJid}: "${text}"`);
    const sent = await targetSock.sendMessage(formattedJid, { text });
    if (sent?.key?.id) {
      sentMessageIds.add(sent.key.id);
      setTimeout(() => sentMessageIds.delete(sent.key.id), 6e4);
    }
    console.log(`[WhatsApp:${userId || "default"}] Message successfully sent to ${formattedJid}`);
  } catch (error) {
    console.error(`[WhatsApp:${userId || "default"}] Error delivering message to ${jid}:`, error);
  }
}
async function sendToolImage(jid, imagePath, caption, userId) {
  const session = getUserWASession(userId);
  const targetSock = session.sock || (userId ? getUserWASession("usr_admin_badar").sock : null);
  if (!targetSock) {
    console.warn(`[WhatsApp:${userId || "default"}] Cannot send image: socket is not connected.`);
    return false;
  }
  try {
    const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
    const fullPath = import_path11.default.isAbsolute(imagePath) ? imagePath : import_path11.default.join(process.cwd(), imagePath);
    try {
      await import_promises8.default.access(fullPath);
    } catch {
      console.warn(`[WhatsApp:${userId || "default"}] Tool image file not found on disk at: ${fullPath}`);
      return false;
    }
    const imageBuffer = await import_promises8.default.readFile(fullPath);
    console.log(`[WhatsApp:${userId || "default"}] Sending tool image (${import_path11.default.basename(fullPath)}) to ${formattedJid}`);
    await targetSock.sendMessage(formattedJid, {
      image: imageBuffer,
      caption: caption || void 0
    });
    console.log(`[WhatsApp:${userId || "default"}] Tool image successfully sent to ${formattedJid}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp:${userId || "default"}] Error sending tool image to ${jid}:`, error);
    return false;
  }
}
async function sendCampaignMessage(jidOrPhone, text, userId) {
  const session = getUserWASession(userId);
  const targetSock = session.sock;
  if (!targetSock || session.connectionStatus !== "connected") {
    return { success: false, error: "WhatsApp is not connected for this account." };
  }
  try {
    let clean = jidOrPhone.trim();
    if (!clean.includes("@")) {
      clean = clean.replace(/[^0-9]/g, "");
      clean = `${clean}@s.whatsapp.net`;
    }
    await targetSock.sendMessage(clean, { text });
    return { success: true };
  } catch (error) {
    console.error(`[WhatsApp:${userId || "default"}] Failed to send campaign message to ${jidOrPhone}:`, error);
    return {
      success: false,
      error: error?.message || error?.toString() || "Unknown WhatsApp transmission error"
    };
  }
}
function getSocket(userId) {
  return getUserWASession(userId).sock;
}
function getConnectionStatus(userId) {
  return getUserWASession(userId).connectionStatus;
}
function getWhatsAppConnectionStatus(userId) {
  return getConnectionStatus(userId);
}
async function fetchAllGroups(forceRefresh = false, userId) {
  const session = getUserWASession(userId);
  const targetSock = session.sock;
  if (!targetSock || session.connectionStatus !== "connected") {
    return null;
  }
  try {
    const groups = await targetSock.groupFetchAllParticipating();
    const result = [];
    for (const [jid, meta] of Object.entries(groups)) {
      const participants = (meta.participants || []).map((p) => {
        const rawId = p.id || "";
        const cleanNumber = rawId.split("@")[0].split(":")[0];
        return {
          id: rawId,
          phoneNumber: cleanNumber.startsWith("+") ? cleanNumber : `+${cleanNumber}`,
          admin: p.admin || null
        };
      });
      result.push({
        id: jid,
        name: meta.subject || "Unnamed Group",
        totalMembers: participants.length || meta.size || 0,
        participants
      });
    }
    return result;
  } catch (err) {
    console.warn("[WhatsApp] Failed to fetch participating groups:", err);
    return null;
  }
}
function setupWhatsAppRoutes(app) {
  app.get("/api/whatsapp/status", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const session = getUserWASession(user?.id);
      res.json({
        status: session.connectionStatus,
        qr: session.qrCodeDataUrl,
        pairingCode: session.pairingCodeData
      });
    } catch {
      const fallback = getUserWASession();
      res.json({
        status: fallback.connectionStatus,
        qr: fallback.qrCodeDataUrl,
        pairingCode: fallback.pairingCodeData
      });
    }
  });
  app.post("/api/whatsapp/connect", async (req, res) => {
    const user = await getUserByToken(req.headers.authorization);
    const session = getUserWASession(user?.id);
    if (session.connectionStatus === "disconnected") {
      await connectToWhatsApp(user?.id, false);
    }
    res.json({ success: true, status: session.connectionStatus });
  });
  app.post("/api/whatsapp/pair", async (req, res) => {
    const user = await getUserByToken(req.headers.authorization);
    const session = getUserWASession(user?.id);
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: "Phone number required" });
    try {
      if (session.sock && session.connectionStatus !== "disconnected") {
        session.isIntentionallyDisconnected = true;
        session.sock.ws.close();
        session.connectionStatus = "disconnected";
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await connectToWhatsApp(user?.id, true);
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (!session.sock?.authState.creds.registered) {
        const code = await session.sock.requestPairingCode(cleanNumber);
        session.pairingCodeData = code;
        res.json({ success: true, code });
      } else {
        res.status(400).json({ error: "Already registered/connected." });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const session = getUserWASession(user?.id);
      const { phoneNumber, message } = req.body;
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "Phone number and message are required." });
      }
      if (session.connectionStatus !== "connected" || !session.sock) {
        return res.status(400).json({ error: "WhatsApp is not connected for your account." });
      }
      await sendMessage(phoneNumber, message, user?.id);
      const { updateCustomerMemory: updateCustomerMemory2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
      await updateCustomerMemory2(phoneNumber, message, "agent");
      res.json({ success: true });
    } catch (err) {
      console.error("[WhatsApp] Failed to send manual message:", err);
      res.status(500).json({ error: err?.message || "Failed to send message" });
    }
  });
  app.post("/api/whatsapp/disconnect", async (req, res) => {
    const user = await getUserByToken(req.headers.authorization);
    const session = getUserWASession(user?.id);
    if (session.sock) {
      session.isIntentionallyDisconnected = true;
      session.sock.logout().catch(() => session.sock?.ws?.close());
      session.connectionStatus = "disconnected";
      session.pairingCodeData = null;
      session.qrCodeDataUrl = null;
      const authDir = getAuthDir(session.userId);
      await import_promises8.default.rm(authDir, { recursive: true, force: true }).catch(console.error);
    }
    res.json({ success: true });
  });
}
var import_baileys, import_pino, import_qrcode, import_promises8, import_path11, userSessions, sentMessageIds;
var init_whatsapp = __esm({
  "src/server/whatsapp.ts"() {
    import_baileys = require("@whiskeysockets/baileys");
    init_agent();
    init_deepgram();
    init_auth();
    init_settings();
    import_pino = __toESM(require("pino"), 1);
    import_qrcode = __toESM(require("qrcode"), 1);
    import_promises8 = __toESM(require("fs/promises"), 1);
    import_path11 = __toESM(require("path"), 1);
    userSessions = /* @__PURE__ */ new Map();
    sentMessageIds = /* @__PURE__ */ new Set();
    setTimeout(async () => {
      try {
        const authBaseDir = import_path11.default.join(process.cwd(), "data", "auth");
        await import_promises8.default.mkdir(authBaseDir, { recursive: true });
        try {
          const adminAuthDir = await ensureAuthDir("usr_admin_badar");
          const creds = import_path11.default.join(adminAuthDir, "creds.json");
          await import_promises8.default.access(creds);
          console.log("[WhatsApp] Admin session found. Auto-reconnecting admin WhatsApp...");
          await connectToWhatsApp("usr_admin_badar", false);
        } catch {
        }
        const entries = await import_promises8.default.readdir(authBaseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name !== "admin") {
            const userCreds = import_path11.default.join(authBaseDir, entry.name, "creds.json");
            try {
              await import_promises8.default.access(userCreds);
              console.log(`[WhatsApp] Existing session found for user ${entry.name}. Auto-reconnecting...`);
              await connectToWhatsApp(entry.name, false);
            } catch {
            }
          }
        }
      } catch (err) {
        console.warn("[WhatsApp] Session auto-loader notice:", err);
      }
    }, 1200);
  }
});

// server.ts
var import_dotenv = __toESM(require("dotenv"), 1);
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_path14 = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_promises11 = __toESM(require("fs/promises"), 1);
init_whatsapp();
init_memory();
init_tools();
init_settings();

// src/server/campaign.ts
var import_promises9 = __toESM(require("fs/promises"), 1);
var import_path12 = __toESM(require("path"), 1);
init_whatsapp();
init_ai();
init_tools();
var CAMPAIGN_FILE = import_path12.default.join(process.cwd(), "data", "campaign.json");
var campaignState = {
  id: "camp_" + Date.now(),
  name: "Targeted Outreach Campaign",
  status: "idle",
  targetGroups: [],
  allowedCountryCodes: ["+92"],
  rateLimits: {
    messagesPerHour: 10,
    messagesPerCampaign: 30,
    dailyLimit: 50,
    delayBetweenMessagesSeconds: 20
  },
  currentGroupIndex: 0,
  groupMemberPointers: {},
  contactedPhoneNumbers: [],
  messagesSent: 0,
  messagesFailed: 0,
  hourlySentCount: 0,
  hourlyWindowStart: Date.now(),
  dailySentCount: 0,
  dailyWindowStart: Date.now(),
  remainingQuota: 30,
  consecutiveFailures: 0,
  messageVariations: [
    "Assalam o Alaikum! VoiceDelta AI voice generator available hai with 100+ realistic Pakistani & international voices. Interested hain to batayein!",
    "Salam bhai, high quality AI video & audio tools check karein. Fast generation aur instant access available hai. Details chahiye?",
    "Assalam o Alaikum! Latest AI marketing and voice tools ready hain. Affordable plans and instant setup. Reply for info!",
    "Salam! Agar apko Urdu & English content ke liye AI voiceover ya video editing tool chahiye to check karein, free test available hai."
  ],
  logs: [],
  createdAt: (/* @__PURE__ */ new Date()).toISOString(),
  updatedAt: (/* @__PURE__ */ new Date()).toISOString()
};
var runnerTimer = null;
var isExecutingTick = false;
async function loadCampaignState() {
  try {
    const data = await import_promises9.default.readFile(CAMPAIGN_FILE, "utf-8");
    const parsed = JSON.parse(data);
    campaignState = {
      ...campaignState,
      ...parsed
    };
    console.log(`[Campaign] Loaded campaign "${campaignState.name}" (Status: ${campaignState.status}, Sent: ${campaignState.messagesSent}/${campaignState.rateLimits.messagesPerCampaign})`);
  } catch {
    await saveCampaignState();
    console.log("[Campaign] Initialized fresh campaign state.");
  }
  return campaignState;
}
async function saveCampaignState() {
  campaignState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  try {
    await import_promises9.default.mkdir(import_path12.default.dirname(CAMPAIGN_FILE), { recursive: true });
    await import_promises9.default.writeFile(CAMPAIGN_FILE, JSON.stringify(campaignState, null, 2));
  } catch (error) {
    console.error("[Campaign] Failed to save campaign state:", error);
  }
}
function isPhoneEligible(phone, allowedCodes) {
  if (!allowedCodes || allowedCodes.length === 0 || allowedCodes.includes("ALL") || allowedCodes.includes("all")) {
    return true;
  }
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
    cleanPhone = "92" + cleanPhone.substring(1);
  }
  return allowedCodes.some((code) => {
    const cleanCode = code.replace(/[^0-9]/g, "");
    return cleanPhone.startsWith(cleanCode);
  });
}
async function pauseCampaign(reason) {
  campaignState.status = "paused";
  campaignState.pauseReason = reason;
  console.warn(`[Campaign] PAUSED: ${reason}`);
  await saveCampaignState();
}
async function processCampaignTick() {
  if (campaignState.status !== "running" || isExecutingTick) {
    return;
  }
  isExecutingTick = true;
  try {
    const now = Date.now();
    if (now - campaignState.hourlyWindowStart >= 3600 * 1e3) {
      campaignState.hourlySentCount = 0;
      campaignState.hourlyWindowStart = now;
    }
    if (now - campaignState.dailyWindowStart >= 24 * 3600 * 1e3) {
      campaignState.dailySentCount = 0;
      campaignState.dailyWindowStart = now;
    }
    const wsStatus = getWhatsAppConnectionStatus();
    if (wsStatus !== "connected") {
      console.log("[Campaign] WhatsApp disconnected. Waiting for connection before sending next message...");
      return;
    }
    if (campaignState.consecutiveFailures >= 3) {
      await pauseCampaign("Campaign paused \u2014 sending requires attention. 3 consecutive sends failed.");
      return;
    }
    const totalMax = campaignState.rateLimits.messagesPerCampaign || 30;
    if (campaignState.messagesSent >= totalMax) {
      campaignState.status = "completed";
      campaignState.remainingQuota = 0;
      console.log(`[Campaign] Campaign completed. Total limit of ${totalMax} reached.`);
      await saveCampaignState();
      return;
    }
    const hourlyMax = campaignState.rateLimits.messagesPerHour || 10;
    if (campaignState.hourlySentCount >= hourlyMax) {
      const waitMinutes = Math.ceil((3600 * 1e3 - (now - campaignState.hourlyWindowStart)) / 6e4);
      console.log(`[Campaign] Hourly limit (${hourlyMax}/hr) reached. Waiting ~${waitMinutes}m for next window.`);
      return;
    }
    const dailyMax = campaignState.rateLimits.dailyLimit || 50;
    if (campaignState.dailySentCount >= dailyMax) {
      await pauseCampaign("Campaign paused \u2014 sending requires attention. Daily limit reached.");
      return;
    }
    const targetGroups = campaignState.targetGroups || [];
    if (targetGroups.length === 0) {
      await pauseCampaign("Campaign paused \u2014 No target groups configured.");
      return;
    }
    const liveGroups = await fetchAllGroups();
    if (!liveGroups) {
      await pauseCampaign("Campaign paused \u2014 Unable to fetch WhatsApp group data. Please check your connection.");
      return;
    }
    const groupMap = new Map(liveGroups.map((g) => [g.id, g]));
    let candidateFound = false;
    let candidatePhone = "";
    let candidateGroupId = "";
    let candidateGroupName = "";
    let allGroupsExhausted = true;
    const numGroups = targetGroups.length;
    for (let i = 0; i < numGroups; i++) {
      const checkGroupIdx = (campaignState.currentGroupIndex + i) % numGroups;
      const targetGroup = targetGroups[checkGroupIdx];
      const configuredLimit = targetGroup.memberLimit || 10;
      const currentGroupSent = campaignState.groupMemberPointers[targetGroup.id] || 0;
      if (currentGroupSent >= configuredLimit) {
        continue;
      }
      const liveGroup = groupMap.get(targetGroup.id);
      if (!liveGroup || !liveGroup.participants || liveGroup.participants.length === 0) {
        continue;
      }
      allGroupsExhausted = false;
      const participants = liveGroup.participants;
      for (const member of participants) {
        const phone = member.phoneNumber || member.id.split("@")[0];
        const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
        if (!isPhoneEligible(normalizedPhone, campaignState.allowedCountryCodes)) {
          continue;
        }
        if (campaignState.contactedPhoneNumbers.includes(normalizedPhone)) {
          continue;
        }
        candidateFound = true;
        candidatePhone = normalizedPhone;
        candidateGroupId = targetGroup.id;
        candidateGroupName = targetGroup.name || liveGroup.name || "Target Group";
        campaignState.currentGroupIndex = (checkGroupIdx + 1) % numGroups;
        break;
      }
      if (candidateFound) {
        break;
      }
    }
    if (!candidateFound) {
      campaignState.status = "completed";
      if (allGroupsExhausted) {
        campaignState.pauseReason = "Campaign completed: All selected groups have reached their configured per-group member limits. Click 'Reset Progress' to run again or increase limits.";
        console.log("[Campaign] All selected groups have reached their configured member limits.");
      } else {
        const prefixStr = campaignState.allowedCountryCodes?.join(", ") || "+92";
        campaignState.pauseReason = `Campaign completed: No uncontacted members found matching prefix (${prefixStr}). Select "All Countries" or click "Reset Progress" to message contacts again.`;
        console.log(`[Campaign] No remaining eligible contacts found in selected groups matching prefix criteria (${prefixStr}).`);
      }
      await saveCampaignState();
      return;
    }
    const variations = campaignState.messageVariations && campaignState.messageVariations.length > 0 ? campaignState.messageVariations : ["Assalam o Alaikum! Check out our AI tools for voice & video generation. Reply for info!"];
    const messageIndex = campaignState.messagesSent % variations.length;
    const messageToSend = variations[messageIndex];
    console.log(`[Campaign] Round-Robin Sending [Group: ${candidateGroupName}] -> ${candidatePhone}: "${messageToSend}"`);
    const sendResult = await sendCampaignMessage(candidatePhone, messageToSend);
    const logEntry = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      groupName: candidateGroupName,
      groupId: candidateGroupId,
      targetNumber: candidatePhone,
      status: sendResult.success ? "Sent" : "Failed",
      messageSnippet: messageToSend.length > 60 ? messageToSend.substring(0, 60) + "..." : messageToSend,
      error: sendResult.error
    };
    campaignState.logs = [logEntry, ...campaignState.logs || []].slice(0, 150);
    if (sendResult.success) {
      campaignState.messagesSent += 1;
      campaignState.hourlySentCount += 1;
      campaignState.dailySentCount += 1;
      campaignState.remainingQuota = Math.max(0, totalMax - campaignState.messagesSent);
      campaignState.groupMemberPointers[candidateGroupId] = (campaignState.groupMemberPointers[candidateGroupId] || 0) + 1;
      campaignState.contactedPhoneNumbers.push(candidatePhone);
      campaignState.consecutiveFailures = 0;
      campaignState.lastSuccessfulSend = (/* @__PURE__ */ new Date()).toISOString();
      campaignState.lastError = void 0;
      console.log(`[Campaign] Successfully delivered message to ${candidatePhone}. Progress: ${campaignState.messagesSent}/${totalMax}`);
    } else {
      campaignState.messagesFailed += 1;
      campaignState.consecutiveFailures += 1;
      campaignState.lastError = sendResult.error || "Sending failed";
      console.error(`[Campaign] Send failed for ${candidatePhone}: ${sendResult.error}`);
      if (campaignState.consecutiveFailures >= 3 || sendResult.error?.toLowerCase().includes("restricted") || sendResult.error?.toLowerCase().includes("banned") || sendResult.error?.toLowerCase().includes("rate limit")) {
        await pauseCampaign("Campaign paused \u2014 sending requires attention. Error: " + (sendResult.error || "Multiple failures"));
      }
    }
    await saveCampaignState();
  } catch (error) {
    console.error("[Campaign] Unexpected error in campaign loop:", error);
    campaignState.consecutiveFailures += 1;
    if (campaignState.consecutiveFailures >= 3) {
      await pauseCampaign("Campaign paused \u2014 sending requires attention. Unexpected loop error.");
    }
  } finally {
    isExecutingTick = false;
  }
}
function startCampaignEngine() {
  if (runnerTimer) {
    clearInterval(runnerTimer);
  }
  loadCampaignState().then(() => {
    const delaySec = Math.max(15, campaignState.rateLimits?.delayBetweenMessagesSeconds || 20);
    runnerTimer = setInterval(processCampaignTick, delaySec * 1e3);
    console.log(`[Campaign] Engine started with ${delaySec}s safe interval.`);
  });
}
async function generateMessageVariations(toolId, topic) {
  let toolInfo = "";
  if (toolId) {
    const tools = await getTools();
    const tool = tools.find((t) => t.id === toolId || t.name.toLowerCase() === toolId.toLowerCase());
    if (tool) {
      toolInfo = `Tool Name: ${tool.name}
Category: ${tool.category || "AI Tools"}
Features: ${(tool.features || []).join(", ")}
Pricing: ${tool.pricePkr ? `Rs. ${tool.pricePkr}/mo` : ""} ${tool.priceUsd ? `($${tool.priceUsd})` : ""}
Highlights: ${(tool.sales_points || []).join(", ")}`;
    }
  }
  const prompt = `You are a WhatsApp marketing specialist for Pakistani customers.
Generate 4 short, natural, highly conversational promotional message variations for WhatsApp outreach.

CRITICAL GUIDELINES:
- Language: Casual, friendly Roman Urdu naturally mixed with everyday English terms.
- Tone: Relaxed, polite, and helpful. NOT spammy, NO fake urgency (e.g. no "only today", no "hurry up").
- Length: 1 to 2 short sentences per variation.
- Message must include a friendly greeting (Salam/Assalam o Alaikum), a brief description of the tool/service, and an invitation to reply for details.

TARGET PRODUCT / TOPIC:
${toolInfo || topic || "AI tools for realistic voiceovers, video creation, and content generation in Urdu and English"}

Return ONLY the 4 variations separated by "---VAR---". Do not include numbers or intro text.`;
  try {
    const rawResult = await askAI(prompt);
    const variations = rawResult.split("---VAR---").map((v) => v.replace(/^Variation\s*\d+:?/i, "").replace(/^["']|["']$/g, "").trim()).filter((v) => v.length > 10);
    if (variations.length > 0) {
      campaignState.messageVariations = variations.slice(0, 5);
      await saveCampaignState();
      return campaignState.messageVariations;
    }
  } catch (err) {
    console.error("[Campaign] Error generating AI variations:", err);
  }
  return campaignState.messageVariations;
}
function setupCampaignRoutes(app) {
  app.get("/api/campaign/state", async (req, res) => {
    res.json({
      ...campaignState,
      whatsappStatus: getWhatsAppConnectionStatus()
    });
  });
  app.get("/api/campaign/groups", async (req, res) => {
    try {
      const groups = await fetchAllGroups();
      res.json(groups || []);
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to fetch groups" });
    }
  });
  app.post("/api/campaign/update", async (req, res) => {
    try {
      const {
        name,
        targetGroups,
        allowedCountryCodes,
        rateLimits,
        messageVariations,
        toolId,
        topic
      } = req.body;
      if (name !== void 0) campaignState.name = name;
      if (targetGroups !== void 0) campaignState.targetGroups = targetGroups;
      if (allowedCountryCodes !== void 0) campaignState.allowedCountryCodes = allowedCountryCodes;
      if (rateLimits !== void 0) {
        campaignState.rateLimits = {
          ...campaignState.rateLimits,
          ...rateLimits
        };
        campaignState.remainingQuota = Math.max(
          0,
          campaignState.rateLimits.messagesPerCampaign - campaignState.messagesSent
        );
      }
      if (messageVariations !== void 0) campaignState.messageVariations = messageVariations;
      if (toolId !== void 0) campaignState.toolId = toolId;
      if (topic !== void 0) campaignState.topic = topic;
      await saveCampaignState();
      res.json({ success: true, campaign: campaignState });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to update campaign" });
    }
  });
  app.post("/api/campaign/start", async (req, res) => {
    try {
      if (getWhatsAppConnectionStatus() !== "connected") {
        return res.status(400).json({
          error: "Cannot start campaign: WhatsApp is disconnected. Connect WhatsApp first."
        });
      }
      if (!campaignState.targetGroups || campaignState.targetGroups.length === 0) {
        return res.status(400).json({
          error: "Please select at least one target group."
        });
      }
      campaignState.status = "running";
      campaignState.pauseReason = void 0;
      campaignState.consecutiveFailures = 0;
      await saveCampaignState();
      setTimeout(processCampaignTick, 500);
      res.json({ success: true, campaign: campaignState });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to start campaign" });
    }
  });
  app.post("/api/campaign/pause", async (req, res) => {
    await pauseCampaign("Campaign paused by user.");
    res.json({ success: true, campaign: campaignState });
  });
  app.post("/api/campaign/resume", async (req, res) => {
    if (getWhatsAppConnectionStatus() !== "connected") {
      return res.status(400).json({
        error: "Cannot resume campaign: WhatsApp is disconnected. Connect WhatsApp first."
      });
    }
    campaignState.status = "running";
    campaignState.pauseReason = void 0;
    campaignState.consecutiveFailures = 0;
    await saveCampaignState();
    setTimeout(processCampaignTick, 500);
    res.json({ success: true, campaign: campaignState });
  });
  app.post("/api/campaign/stop", async (req, res) => {
    campaignState.status = "stopped";
    campaignState.pauseReason = void 0;
    await saveCampaignState();
    res.json({ success: true, campaign: campaignState });
  });
  app.post("/api/campaign/reset-progress", async (req, res) => {
    campaignState.status = "idle";
    campaignState.pauseReason = void 0;
    campaignState.messagesSent = 0;
    campaignState.messagesFailed = 0;
    campaignState.currentGroupIndex = 0;
    campaignState.groupMemberPointers = {};
    campaignState.contactedPhoneNumbers = [];
    campaignState.remainingQuota = campaignState.rateLimits.messagesPerCampaign;
    campaignState.consecutiveFailures = 0;
    campaignState.lastSuccessfulSend = void 0;
    campaignState.lastError = void 0;
    await saveCampaignState();
    res.json({ success: true, campaign: campaignState });
  });
  app.post("/api/campaign/generate-variations", async (req, res) => {
    try {
      const { toolId, topic } = req.body;
      const variations = await generateMessageVariations(toolId, topic);
      res.json({ success: true, variations });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to generate variations" });
    }
  });
  app.post("/api/campaign/clear-logs", async (req, res) => {
    campaignState.logs = [];
    await saveCampaignState();
    res.json({ success: true });
  });
}

// server.ts
init_auth();
init_deepgram();
init_lists();
init_usage();

// src/server/deployment.ts
var import_promises10 = __toESM(require("fs/promises"), 1);
var import_path13 = __toESM(require("path"), 1);
var import_child_process = require("child_process");
var import_util = require("util");
var import_axios3 = __toESM(require("axios"), 1);
init_auth();
var execAsync = (0, import_util.promisify)(import_child_process.exec);
var CONFIG_FILE2 = import_path13.default.join(process.cwd(), "data", "github_config.json");
var DEFAULT_CONFIG2 = {
  username: "badarbukharidev-alt",
  repo: "Whatsapp-Sales-Agent",
  repositoryUrl: "https://github.com/badarbukharidev-alt/Whatsapp-Sales-Agent.git",
  branch: "main",
  token: process.env.GITHUB_TOKEN || "",
  autoBuildAfterPull: true
};
async function getGitHubConfig() {
  try {
    const data = await import_promises10.default.readFile(CONFIG_FILE2, "utf-8");
    return { ...DEFAULT_CONFIG2, ...JSON.parse(data) };
  } catch {
    await saveGitHubConfig(DEFAULT_CONFIG2);
    return DEFAULT_CONFIG2;
  }
}
async function saveGitHubConfig(config) {
  const current = await getGitHubConfig();
  const updated = { ...current, ...config };
  await import_promises10.default.writeFile(CONFIG_FILE2, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
async function getLocalGitInfo() {
  try {
    const { stdout: headShaOut } = await execAsync("git rev-parse HEAD");
    const headSha = headShaOut.trim();
    const shortSha = headSha.substring(0, 7);
    let branch = "main";
    try {
      const { stdout: branchOut } = await execAsync("git rev-parse --abbrev-ref HEAD");
      branch = branchOut.trim();
    } catch {
      branch = `detached (${shortSha})`;
    }
    const { stdout: logOut } = await execAsync('git log -1 --format="%an|%ad|%s"');
    const [author = "Unknown", date = "", message = ""] = logOut.trim().split("|");
    const { stdout: statusOut } = await execAsync("git status --porcelain");
    const isDirty = statusOut.trim().length > 0;
    return {
      headSha,
      shortSha,
      branch,
      author,
      date,
      message,
      isDirty
    };
  } catch (err) {
    return {
      headSha: "unknown",
      shortSha: "unknown",
      branch: "main",
      author: "Local Git",
      date: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Unable to read local Git info",
      isDirty: false
    };
  }
}
async function fetchRemoteCommits() {
  const config = await getGitHubConfig();
  const local = await getLocalGitInfo();
  const headers = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "SalesAgent-Deployment-Manager"
  };
  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }
  const url = `https://api.github.com/repos/${config.username}/${config.repo}/commits?sha=${config.branch}&per_page=30`;
  const response = await import_axios3.default.get(url, { headers, timeout: 1e4 });
  const rawCommits = response.data;
  if (!Array.isArray(rawCommits) || rawCommits.length === 0) {
    throw new Error("No commits returned from repository.");
  }
  const currentSha = local.headSha;
  const remoteLatestSha = rawCommits[0].sha;
  let foundIndex = -1;
  const commits = rawCommits.map((c, index) => {
    const isCurrent = c.sha === currentSha || c.sha.startsWith(currentSha) || currentSha.startsWith(c.sha);
    if (isCurrent) foundIndex = index;
    return {
      sha: c.sha,
      shortSha: c.sha.substring(0, 7),
      message: c.commit.message.split("\n")[0],
      author: c.commit.author?.name || c.author?.login || "Unknown",
      authorAvatar: c.author?.avatar_url,
      date: c.commit.author?.date || "",
      isCurrent,
      htmlUrl: c.html_url || `https://github.com/${config.username}/${config.repo}/commit/${c.sha}`
    };
  });
  const isUpToDate = currentSha === remoteLatestSha;
  const commitsBehind = foundIndex > 0 ? foundIndex : isUpToDate ? 0 : 1;
  await saveGitHubConfig({ lastChecked: (/* @__PURE__ */ new Date()).toISOString() });
  return {
    commits,
    currentSha,
    remoteLatestSha,
    isUpToDate,
    commitsBehind
  };
}
async function deployLatestCommit() {
  const config = await getGitHubConfig();
  const logs = [];
  try {
    logs.push(`[1/5] Preparing deployment from ${config.username}/${config.repo} (${config.branch})...`);
    const remoteUrl = config.token ? `https://${config.username}:${config.token}@github.com/${config.username}/${config.repo}.git` : `https://github.com/${config.username}/${config.repo}.git`;
    try {
      await execAsync(`git remote set-url origin "${remoteUrl}"`);
    } catch {
      await execAsync(`git remote add origin "${remoteUrl}"`);
    }
    logs.push(`[2/5] Fetching latest commits from origin/${config.branch}...`);
    const { stdout: fetchOut, stderr: fetchErr } = await execAsync(`git fetch origin ${config.branch}`);
    if (fetchOut) logs.push(fetchOut.trim());
    if (fetchErr) logs.push(fetchErr.trim());
    logs.push(`[3/5] Updating workspace to latest origin/${config.branch}...`);
    const { stdout: pullOut } = await execAsync(`git reset --hard origin/${config.branch}`);
    if (pullOut) logs.push(pullOut.trim());
    logs.push(`[4/5] Synchronizing production HTML & assets...`);
    try {
      const rootIndex = import_path13.default.join(process.cwd(), "index.html");
      const distIndex = import_path13.default.join(process.cwd(), "dist", "index.html");
      await import_promises10.default.copyFile(distIndex, rootIndex);
      logs.push("Synchronized root index.html with dist/index.html");
    } catch (e) {
      logs.push(`[Info] Assets sync note: ${e.message}`);
    }
    logs.push(`[5/5] Reloading application server...`);
    try {
      const tmpDir = import_path13.default.join(process.cwd(), "tmp");
      await import_promises10.default.mkdir(tmpDir, { recursive: true });
      await import_promises10.default.writeFile(import_path13.default.join(tmpDir, "restart.txt"), Date.now().toString());
      logs.push("Touched tmp/restart.txt - Phusion Passenger application reloaded.");
    } catch (e) {
      logs.push(`[Info] Restart trigger note: ${e.message}`);
    }
    const { stdout: newHeadOut } = await execAsync("git rev-parse HEAD");
    const deployedSha = newHeadOut.trim();
    logs.push(`
Deployment completed successfully! Current version: ${deployedSha.substring(0, 7)}`);
    await saveGitHubConfig({
      lastDeployment: {
        sha: deployedSha,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "success",
        action: "deploy",
        message: `Deployed latest ${deployedSha.substring(0, 7)}`
      }
    });
    await recordAuditLog(
      "DEPLOY_LATEST_VERSION",
      "Deployment Manager",
      `Successfully pulled and deployed latest version ${deployedSha.substring(0, 7)} from GitHub.`
    );
    return {
      success: true,
      output: logs.join("\n"),
      deployedSha
    };
  } catch (err) {
    logs.push(`[Error] Deployment failed: ${err.message}`);
    await saveGitHubConfig({
      lastDeployment: {
        sha: "unknown",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "failed",
        action: "deploy",
        message: err.message
      }
    });
    await recordAuditLog(
      "DEPLOY_FAILED",
      "Deployment Manager",
      `Failed to deploy latest version: ${err.message}`
    );
    return {
      success: false,
      output: logs.join("\n"),
      deployedSha: ""
    };
  }
}
async function rollbackToCommit(commitSha) {
  const logs = [];
  try {
    logs.push(`[1/4] Preparing rollback to commit ${commitSha.substring(0, 7)}...`);
    logs.push(`[2/4] Checking out commit ${commitSha}...`);
    const { stdout: coOut, stderr: coErr } = await execAsync(`git reset --hard ${commitSha}`);
    if (coOut) logs.push(coOut.trim());
    if (coErr) logs.push(coErr.trim());
    logs.push(`[3/4] Synchronizing production HTML...`);
    try {
      const rootIndex = import_path13.default.join(process.cwd(), "index.html");
      const distIndex = import_path13.default.join(process.cwd(), "dist", "index.html");
      await import_promises10.default.copyFile(distIndex, rootIndex);
    } catch {
    }
    logs.push(`[4/4] Reloading application server...`);
    try {
      const tmpDir = import_path13.default.join(process.cwd(), "tmp");
      await import_promises10.default.mkdir(tmpDir, { recursive: true });
      await import_promises10.default.writeFile(import_path13.default.join(tmpDir, "restart.txt"), Date.now().toString());
    } catch {
    }
    const { stdout: headOut } = await execAsync("git rev-parse HEAD");
    const activeSha = headOut.trim();
    logs.push(`Successfully rolled back. Active commit is now: ${activeSha.substring(0, 7)}`);
    await saveGitHubConfig({
      lastDeployment: {
        sha: activeSha,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "success",
        action: "rollback",
        message: `Rolled back to ${activeSha.substring(0, 7)}`
      }
    });
    await recordAuditLog(
      "ROLLBACK_VERSION",
      "Deployment Manager",
      `Rolled back system version to commit ${activeSha.substring(0, 7)}.`
    );
    return {
      success: true,
      output: logs.join("\n"),
      targetSha: activeSha
    };
  } catch (err) {
    logs.push(`[Error] Rollback failed: ${err.message}`);
    return {
      success: false,
      output: logs.join("\n"),
      targetSha: ""
    };
  }
}
function setupDeploymentRoutes(app) {
  app.get("/api/admin/deploy/status", async (req, res) => {
    try {
      const config = await getGitHubConfig();
      const local = await getLocalGitInfo();
      const maskedConfig = {
        ...config,
        token: config.token ? `${config.token.substring(0, 12)}...${config.token.slice(-4)}` : ""
      };
      res.json({
        config: maskedConfig,
        local
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/admin/deploy/commits", async (req, res) => {
    try {
      const data = await fetchRemoteCommits();
      res.json(data);
    } catch (err) {
      console.error("[Deployment] Failed to fetch remote commits:", err.message);
      res.status(500).json({ error: err.message || "Failed to query GitHub repository." });
    }
  });
  app.post("/api/admin/deploy/latest", async (req, res) => {
    try {
      const result = await deployLatestCommit();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/admin/deploy/rollback", async (req, res) => {
    try {
      const { commitSha } = req.body;
      if (!commitSha || typeof commitSha !== "string") {
        return res.status(400).json({ error: "commitSha is required." });
      }
      const result = await rollbackToCommit(commitSha);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/admin/deploy/test-connection", async (req, res) => {
    try {
      const config = await getGitHubConfig();
      const headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SalesAgent-Deployment-Manager"
      };
      if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
      const repoRes = await import_axios3.default.get(`https://api.github.com/repos/${config.username}/${config.repo}`, {
        headers,
        timeout: 8e3
      });
      res.json({
        success: true,
        repoName: repoRes.data.full_name,
        isPrivate: repoRes.data.private,
        defaultBranch: repoRes.data.default_branch,
        updatedAt: repoRes.data.pushed_at
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err.response?.data?.message || err.message || "Connection failed."
      });
    }
  });
  app.post("/api/admin/deploy/config", async (req, res) => {
    try {
      const updated = await saveGitHubConfig(req.body);
      res.json({ success: true, config: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// server.ts
init_agent();
init_customer_service();
import_dotenv.default.config();
async function initializeDataDirs() {
  const dataDir = import_path14.default.join(process.cwd(), "data");
  const defaultsDir = import_path14.default.join(process.cwd(), "data_defaults");
  const toolImagesDir = import_path14.default.join(dataDir, "tool-images");
  try {
    await import_promises11.default.mkdir(dataDir, { recursive: true });
    await import_promises11.default.mkdir(toolImagesDir, { recursive: true });
    try {
      const defaultFiles = await import_promises11.default.readdir(defaultsDir);
      for (const file of defaultFiles) {
        const src = import_path14.default.join(defaultsDir, file);
        const dest = import_path14.default.join(dataDir, file);
        const stat = await import_promises11.default.stat(src);
        if (stat.isFile()) {
          try {
            await import_promises11.default.access(dest);
          } catch {
            await import_promises11.default.copyFile(src, dest);
            console.log(`[Init] Seeded default file: ${file}`);
          }
        }
      }
    } catch {
    }
    try {
      const defaultToolsPath = import_path14.default.join(defaultsDir, "tools.json");
      const activeToolsPath = import_path14.default.join(dataDir, "tools.json");
      const defaultToolsRaw = await import_promises11.default.readFile(defaultToolsPath, "utf-8").catch(() => null);
      if (defaultToolsRaw) {
        const defaultTools = JSON.parse(defaultToolsRaw);
        let activeTools = [];
        try {
          const activeToolsRaw = await import_promises11.default.readFile(activeToolsPath, "utf-8");
          activeTools = JSON.parse(activeToolsRaw);
        } catch {
          activeTools = [];
        }
        if (!Array.isArray(activeTools) || activeTools.length === 0) {
          await import_promises11.default.writeFile(activeToolsPath, JSON.stringify(defaultTools, null, 2), "utf-8");
          console.log("[Init] Initialized active tools from defaults.");
        } else {
          let modified = false;
          for (const defTool of defaultTools) {
            const defName = (defTool.name || "").toLowerCase().trim();
            const existingIdx = activeTools.findIndex(
              (t) => t.id && t.id === defTool.id || t.name && t.name.toLowerCase().trim() === defName || t.name && defName.includes(t.name.toLowerCase().trim()) || defName.includes(t.name?.toLowerCase().trim() || "___")
            );
            if (existingIdx === -1) {
              activeTools.push(defTool);
              modified = true;
              console.log(`[Init] Merged new default tool into active catalog: ${defTool.name}`);
            } else {
              const existing = activeTools[existingIdx];
              if (Array.isArray(defTool.aliases) && defTool.aliases.length > 0) {
                const existingAliases = new Set((existing.aliases || []).map((a) => a.toLowerCase().trim()));
                for (const alias of defTool.aliases) {
                  if (!existingAliases.has(alias.toLowerCase().trim())) {
                    existing.aliases = [...existing.aliases || [], alias];
                    modified = true;
                  }
                }
              }
              if (Array.isArray(defTool.keywords) && defTool.keywords.length > 0) {
                const existingKw = new Set((existing.keywords || []).map((k) => k.toLowerCase().trim()));
                for (const kw of defTool.keywords) {
                  if (!existingKw.has(kw.toLowerCase().trim())) {
                    existing.keywords = [...existing.keywords || [], kw];
                    modified = true;
                  }
                }
              }
              if (defTool.pricing && (!existing.pricing || !existing.pricing.min_negotiable_pkr)) {
                existing.pricing = { ...existing.pricing || {}, ...defTool.pricing };
                modified = true;
              }
              if (defTool.objection_responses && !existing.objection_responses) {
                existing.objection_responses = defTool.objection_responses;
                modified = true;
              }
            }
          }
          if (modified) {
            await import_promises11.default.writeFile(activeToolsPath, JSON.stringify(activeTools, null, 2), "utf-8");
            console.log("[Init] Synced active tools catalog with latest default definitions.");
          }
        }
      }
    } catch (toolSyncErr) {
      console.error("[Init] Error syncing tools catalog:", toolSyncErr);
    }
    await getUsers();
    await getLists();
    try {
      await customerService.migrateLegacyCustomers();
    } catch (migErr) {
      console.warn("[Init] Legacy customer migration note:", migErr);
    }
    const files = ["customers.json", "tools.json", "settings.json"];
    for (const file of files) {
      const filePath = import_path14.default.join(dataDir, file);
      try {
        await import_promises11.default.access(filePath);
      } catch {
        const defaultContent = file === "settings.json" ? JSON.stringify({ aiAgentEnabled: true, preferredApi: "gemini", defaultLLM: "Gemini", language: "Roman Urdu", autoReply: true, allowImageReplies: true, salesSkillEnabled: true, allowGroups: false, allowChannels: false }, null, 2) : JSON.stringify(file === "tools.json" ? [] : {}, null, 2);
        await import_promises11.default.writeFile(filePath, defaultContent);
      }
    }
  } catch (error) {
    console.error("Error initializing data directory:", error);
  }
}
async function startServer() {
  await initializeDataDirs();
  const app = (0, import_express.default)();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  app.use((0, import_cors.default)());
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use("/tool-images", import_express.default.static(import_path14.default.join(process.cwd(), "data", "tool-images")));
  setupAuthRoutes(app);
  setupWhatsAppRoutes(app);
  setupMemoryRoutes(app);
  setupToolsRoutes(app);
  setupSettingsRoutes(app);
  setupCampaignRoutes(app);
  setupDeepgramRoutes(app);
  setupListRoutes(app);
  setupUsageRoutes(app);
  setupDeploymentRoutes(app);
  startAgent();
  startCampaignEngine();
  startDeepgramBalanceMonitor();
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ["**/data/**", "**/auth/**", "**/.git/**"]
        }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== "GET") return next();
      const url = req.originalUrl;
      try {
        let template = await import_promises11.default.readFile(import_path14.default.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = import_path14.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path14.default.join(distPath, "index.html"));
    });
  }
  const rawPort = process.env.PORT;
  if (typeof globalThis.PhusionPassenger !== "undefined" || rawPort === "passenger") {
    app.listen("passenger", () => {
      console.log("Server running via Phusion Passenger socket");
    });
  } else if (rawPort) {
    if (isNaN(Number(rawPort))) {
      app.listen(rawPort, () => {
        console.log(`Server running on socket: ${rawPort}`);
      });
    } else {
      app.listen(parseInt(rawPort, 10), "0.0.0.0", () => {
        console.log(`Server running on port ${rawPort}`);
      });
    }
  } else {
    if (process.env.PASSENGER_APP_ENV) {
      app.listen("passenger", () => {
        console.log("Server running via Passenger fallback");
      });
    } else {
      app.listen(3001, "0.0.0.0", () => {
        console.log("Server running on http://localhost:3001");
      });
    }
  }
}
startServer().catch(console.error);
//# sourceMappingURL=server.cjs.map
