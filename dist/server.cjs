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

// src/server/paths.ts
function getAppRootDir() {
  if (process.env.APP_ROOT) {
    return import_path.default.resolve(process.env.APP_ROOT);
  }
  if (typeof __dirname !== "undefined") {
    const isDistFolder = import_path.default.basename(__dirname) === "dist";
    return isDistFolder ? import_path.default.resolve(__dirname, "..") : import_path.default.resolve(__dirname);
  }
  return process.cwd();
}
var import_path, ROOT_DIR, DATA_DIR, DIST_DIR, AUTH_DIR, TOOL_IMAGES_DIR;
var init_paths = __esm({
  "src/server/paths.ts"() {
    import_path = __toESM(require("path"), 1);
    ROOT_DIR = getAppRootDir();
    DATA_DIR = import_path.default.join(ROOT_DIR, "data");
    DIST_DIR = import_path.default.join(ROOT_DIR, "dist");
    AUTH_DIR = import_path.default.join(DATA_DIR, "auth");
    TOOL_IMAGES_DIR = import_path.default.join(DATA_DIR, "tool-images");
    try {
      if (process.cwd() !== ROOT_DIR) {
        process.chdir(ROOT_DIR);
        console.log(`[Paths] Working directory synchronized to app root: ${ROOT_DIR}`);
      }
    } catch (err) {
      console.warn(`[Paths] Could not set working directory to ${ROOT_DIR}:`, err);
    }
  }
});

// src/server/settings.ts
async function getSettings() {
  try {
    const data = await import_promises.default.readFile(getSettingsFile(), "utf-8");
    const parsed = JSON.parse(data);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      preferredApi: parsed.preferredApi || (parsed.defaultLLM ? parsed.defaultLLM.toLowerCase() : "gemini")
    };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}
async function saveSettings(newSettings) {
  const current = await getSettings();
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
  await import_promises.default.writeFile(getSettingsFile(), JSON.stringify(merged, null, 2));
  return merged;
}
function setupSettingsRoutes(app) {
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to load settings" });
    }
  });
  app.post("/api/settings", async (req, res) => {
    try {
      const saved = await saveSettings(req.body);
      res.json({ success: true, settings: saved });
    } catch (error) {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });
  app.put("/api/settings", async (req, res) => {
    try {
      const saved = await saveSettings(req.body);
      res.json({ success: true, settings: saved });
    } catch (error) {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });
  app.post("/api/ai/test", async (req, res) => {
    try {
      const prompt = req.body?.prompt || "Salam bhai, can you help me with tools?";
      const systemPrompt = req.body?.systemPrompt;
      const reply = await askAI(prompt, systemPrompt);
      res.json({ success: true, reply });
    } catch (error) {
      res.status(500).json({ error: error?.message || "AI Test failed" });
    }
  });
}
var import_promises, import_path2, getSettingsFile, DEFAULT_SETTINGS;
var init_settings = __esm({
  "src/server/settings.ts"() {
    import_promises = __toESM(require("fs/promises"), 1);
    import_path2 = __toESM(require("path"), 1);
    init_ai();
    init_paths();
    getSettingsFile = () => import_path2.default.join(DATA_DIR, "settings.json");
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
function getGeminiClient() {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn("[AI] Failed to init GoogleGenAI SDK:", e);
    }
  }
  return geminiClient;
}
async function callOfficialGemini(prompt, systemPrompt) {
  const client = getGeminiClient();
  if (!client) return { success: false, text: "", provider: "Gemini (Official)" };
  try {
    console.log("[AI] Requesting Official Gemini API...");
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt || void 0,
        temperature: 0.7
      }
    });
    const text = response.text?.trim();
    if (text) {
      return { success: true, text, provider: "Gemini (Official)" };
    }
  } catch (err) {
    console.warn("[AI] Official Gemini API failed:", err?.message || err);
  }
  return { success: false, text: "", provider: "Gemini (Official)" };
}
function buildProviderUrl(provider, query, systemPrompt) {
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
async function callSingleProvider(provider, query, systemPrompt) {
  if (provider === "Gemini" && process.env.GEMINI_API_KEY) {
    const officialRes = await callOfficialGemini(query, systemPrompt);
    if (officialRes.success && officialRes.text) {
      return officialRes;
    }
  }
  const url = buildProviderUrl(provider, query, systemPrompt);
  try {
    console.log(`[AI] Requesting ${provider} API...`);
    const response = await import_axios.default.get(url, {
      timeout: 15e3,
      headers: {
        "User-Agent": "WhatsApp-Sales-Agent/1.0",
        "Accept": "application/json, text/plain, */*"
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
      const candidate = data.message ?? data.response ?? data.result ?? data.reply ?? data.text ?? data.content ?? data.data;
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
  } catch (error) {
    const errorMsg = error?.response?.status ? `HTTP ${error.response.status}` : error?.message || error;
    console.warn(`[AI] ${provider} failed (reason: ${errorMsg}).`);
    return { success: false, text: "", provider };
  }
}
async function askAI(prompt, systemPrompt) {
  const settings = await getSettings();
  const preferred = settings.defaultLLM || "Gemini";
  const fallbackOrder = [
    preferred,
    ...ALL_PROVIDERS.filter((p) => p !== preferred)
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
  const lang = settings.language || "Roman Urdu";
  if (lang.toLowerCase().includes("urdu")) {
    return "Haan bhai, abhi thoda network issue hai. Thodi der baad msg krna ya try krlo.";
  }
  return "Hey, having a brief network issue. Please try again in a moment.";
}
var import_axios, import_genai, ALL_PROVIDERS, geminiClient;
var init_ai = __esm({
  "src/server/ai.ts"() {
    import_axios = __toESM(require("axios"), 1);
    import_genai = require("@google/genai");
    init_settings();
    ALL_PROVIDERS = ["Gemini", "DeepSeek", "Claude", "GPTLogic"];
    geminiClient = null;
  }
});

// src/server/auth.ts
function hashPassword(password) {
  return import_crypto.default.createHash("sha256").update(password.trim()).digest("hex");
}
async function getPlans() {
  if (plansCache) return plansCache;
  try {
    const data = await import_promises2.default.readFile(PLANS_FILE, "utf-8");
    plansCache = JSON.parse(data);
    return plansCache;
  } catch {
    plansCache = DEFAULT_PLANS;
    await import_promises2.default.mkdir(import_path3.default.dirname(PLANS_FILE), { recursive: true });
    await import_promises2.default.writeFile(PLANS_FILE, JSON.stringify(DEFAULT_PLANS, null, 2));
    return plansCache;
  }
}
async function savePlans(plans) {
  plansCache = plans;
  await import_promises2.default.mkdir(import_path3.default.dirname(PLANS_FILE), { recursive: true });
  await import_promises2.default.writeFile(PLANS_FILE, JSON.stringify(plans, null, 2));
}
async function getUsers() {
  try {
    const data = await import_promises2.default.readFile(USERS_FILE, "utf-8");
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
  await import_promises2.default.mkdir(import_path3.default.dirname(USERS_FILE), { recursive: true });
  await import_promises2.default.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}
async function recordAuditLog(action, performedBy, details) {
  try {
    let logs = [];
    try {
      const data = await import_promises2.default.readFile(AUDIT_LOGS_FILE, "utf-8");
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
    await import_promises2.default.mkdir(import_path3.default.dirname(AUDIT_LOGS_FILE), { recursive: true });
    await import_promises2.default.writeFile(AUDIT_LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.warn("[Auth] Failed to write audit log:", err);
  }
}
async function getAuditLogs() {
  try {
    const data = await import_promises2.default.readFile(AUDIT_LOGS_FILE, "utf-8");
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
      const selectedPlan = plan || "Pro";
      const baseLimits = DEFAULT_PLAN_LIMITS[selectedPlan] || DEFAULT_PLAN_LIMITS.Pro;
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
      const groupsCache = import_path3.default.join(DATA_DIR, "groups_cache.json");
      await import_promises2.default.rm(groupsCache, { force: true }).catch(() => {
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
var import_promises2, import_path3, import_crypto, USERS_FILE, AUDIT_LOGS_FILE, PLANS_FILE, activeSessions, DEFAULT_PLAN_LIMITS, DEFAULT_PLANS, plansCache;
var init_auth = __esm({
  "src/server/auth.ts"() {
    import_promises2 = __toESM(require("fs/promises"), 1);
    import_path3 = __toESM(require("path"), 1);
    import_crypto = __toESM(require("crypto"), 1);
    init_paths();
    USERS_FILE = import_path3.default.join(DATA_DIR, "users.json");
    AUDIT_LOGS_FILE = import_path3.default.join(DATA_DIR, "audit_logs.json");
    PLANS_FILE = import_path3.default.join(DATA_DIR, "plans.json");
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
    const raw = await import_promises3.default.readFile(USAGE_FILE, "utf-8");
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
  await import_promises3.default.mkdir(import_path4.default.dirname(USAGE_FILE), { recursive: true });
  await import_promises3.default.writeFile(USAGE_FILE, JSON.stringify(usage, null, 2), "utf-8");
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
var import_promises3, import_path4, USAGE_FILE, usageCache;
var init_usage = __esm({
  "src/server/usage.ts"() {
    import_promises3 = __toESM(require("fs/promises"), 1);
    import_path4 = __toESM(require("path"), 1);
    init_memory();
    init_auth();
    init_paths();
    USAGE_FILE = import_path4.default.join(DATA_DIR, "usage.json");
    usageCache = null;
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
    await import_promises4.default.mkdir(import_path5.default.dirname(LISTS_FILE), { recursive: true });
    const data = await import_promises4.default.readFile(LISTS_FILE, "utf-8");
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
      await import_promises4.default.writeFile(LISTS_FILE, JSON.stringify(parsed, null, 2), "utf-8");
    }
    return parsed;
  } catch {
    await import_promises4.default.writeFile(LISTS_FILE, JSON.stringify(DEFAULT_LISTS, null, 2), "utf-8");
    return DEFAULT_LISTS;
  }
}
async function saveLists(lists) {
  await import_promises4.default.mkdir(import_path5.default.dirname(LISTS_FILE), { recursive: true });
  await import_promises4.default.writeFile(LISTS_FILE, JSON.stringify(lists, null, 2), "utf-8");
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
  const sock2 = getSocket();
  if (connection !== "connected" || !sock2) {
    return {
      isSupported: false,
      isBusinessAccount: false,
      status: "disconnected",
      reason: "WhatsApp is not connected. Connect your WhatsApp device to check native label support."
    };
  }
  const hasLabelApi = typeof sock2.addChatLabel === "function" || typeof sock2.getLabels === "function" || typeof sock2.chatModify === "function";
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
  const sock2 = getSocket();
  if (!sock2) return;
  try {
    if (typeof sock2.addChatLabel === "function") {
      const jid = phoneNumber.includes("@s.whatsapp.net") ? phoneNumber : `${phoneNumber.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
      await sock2.addChatLabel(jid, status);
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
var import_promises4, import_path5, LISTS_FILE, DEFAULT_LISTS;
var init_lists = __esm({
  "src/server/lists.ts"() {
    import_promises4 = __toESM(require("fs/promises"), 1);
    import_path5 = __toESM(require("path"), 1);
    init_whatsapp();
    init_memory();
    init_paths();
    LISTS_FILE = import_path5.default.join(DATA_DIR, "lists.json");
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

// src/server/memory.ts
var memory_exports = {};
__export(memory_exports, {
  VALID_CUSTOMER_STATUSES: () => VALID_CUSTOMER_STATUSES,
  getCustomerList: () => getCustomerList,
  getCustomers: () => getCustomers,
  getCustomersFile: () => getCustomersFile,
  normalizeCustomerStatus: () => normalizeCustomerStatus,
  saveCustomer: () => saveCustomer,
  saveCustomers: () => saveCustomers,
  setupMemoryRoutes: () => setupMemoryRoutes,
  updateCustomerMemory: () => updateCustomerMemory,
  updateCustomerStatus: () => updateCustomerStatus
});
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
async function getCustomers() {
  try {
    const data = await import_promises5.default.readFile(getCustomersFile(), "utf-8");
    const parsed = JSON.parse(data);
    for (const key of Object.keys(parsed)) {
      if (parsed[key]) {
        parsed[key].status = normalizeCustomerStatus(parsed[key].status);
        if (!parsed[key].phoneNumber) parsed[key].phoneNumber = key;
        if (!parsed[key].statusManagedBy) {
          parsed[key].statusManagedBy = parsed[key].status === "Order Complete" ? "Manual" : "AI managed";
        }
      }
    }
    return parsed;
  } catch (error) {
    return {};
  }
}
async function getCustomerList() {
  const map = await getCustomers();
  return Object.values(map);
}
async function saveCustomers(data) {
  let record = {};
  if (Array.isArray(data)) {
    data.forEach((c) => {
      if (c && c.phoneNumber) {
        record[c.phoneNumber] = c;
      }
    });
  } else {
    record = data;
  }
  await import_promises5.default.mkdir(import_path6.default.dirname(getCustomersFile()), { recursive: true });
  await import_promises5.default.writeFile(getCustomersFile(), JSON.stringify(record, null, 2), "utf-8");
}
async function saveCustomer(phoneNumber, data) {
  const customers = await getCustomers();
  const existing = customers[phoneNumber] || {
    phoneNumber,
    messages: [],
    status: "New Customer",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const status = normalizeCustomerStatus(data.status || existing.status);
  customers[phoneNumber] = {
    ...existing,
    ...data,
    status,
    phoneNumber
  };
  await saveCustomers(customers);
  return customers[phoneNumber];
}
async function updateCustomerStatus(phoneNumber, newStatus, reason, changedBy = "system", paymentEvidence) {
  const normalized = normalizeCustomerStatus(newStatus);
  const customers = await getCustomers();
  const customer = customers[phoneNumber] || {
    phoneNumber,
    messages: [],
    status: "New Customer",
    statusManagedBy: "AI managed",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const previousStatus = normalizeCustomerStatus(customer.status);
  const isAi = changedBy === "ai" || changedBy === "AI managed";
  const managedByLabel = isAi ? "AI managed" : "Manual";
  if (isAi && normalized === "Order Complete") {
    console.log(`[Memory] Rejected AI status transition to 'Order Complete' for ${phoneNumber}. Admin verification required.`);
    return { success: false, status: previousStatus, previousStatus, customer };
  }
  if (isAi && previousStatus === "Order Complete") {
    console.log(`[Memory] Preserved 'Order Complete' status for ${phoneNumber}. AI cannot downgrade verified order.`);
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
    customers[phoneNumber] = customer;
    await saveCustomers(customers);
    console.log(`[Memory] Customer ${phoneNumber} status updated: [${previousStatus}] -> [${normalized}] (${managedByLabel})`);
    Promise.resolve().then(() => (init_lists(), lists_exports)).then(({ syncCustomerToWhatsAppNativeLabel: syncCustomerToWhatsAppNativeLabel2 }) => {
      syncCustomerToWhatsAppNativeLabel2(phoneNumber, normalized).catch(() => {
      });
    }).catch(() => {
    });
    return { success: true, status: normalized, previousStatus, customer };
  }
  return { success: true, status: previousStatus, previousStatus, customer };
}
async function updateCustomerMemory(phoneNumber, newMessage, role) {
  const customers = await getCustomers();
  const customer = customers[phoneNumber] || {
    phoneNumber,
    messages: [],
    summary: "",
    status: "New Customer",
    statusManagedBy: "AI managed",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!customer.messages) customer.messages = [];
  customer.messages.push({ role, content: newMessage, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  if (customer.messages.length > 30) {
    customer.messages = customer.messages.slice(-30);
  }
  customer.lastActivity = (/* @__PURE__ */ new Date()).toISOString();
  if (!customer.status) {
    customer.status = "New Customer";
    customer.statusManagedBy = "AI managed";
  }
  customers[phoneNumber] = customer;
  await saveCustomers(customers);
  if (role === "agent") {
    recordAiReply().catch((err) => console.error("[Memory] Error recording AI reply usage:", err));
  } else if (role === "user") {
    recordUserMessage().catch((err) => console.error("[Memory] Error recording user message usage:", err));
  }
}
function setupMemoryRoutes(app) {
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await getCustomerList();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to load customers" });
    }
  });
  app.put("/api/customers/:phoneNumber", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const customers = await getCustomers();
      const existing = customers[phoneNumber] || {
        phoneNumber,
        messages: [],
        status: "New Customer",
        statusManagedBy: "Manual",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const prevStatus = existing.status || "New Customer";
      const newStatus = req.body.status ? normalizeCustomerStatus(req.body.status) : prevStatus;
      const isStatusChanged = newStatus !== prevStatus;
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const updatedCustomer = {
        ...existing,
        ...req.body,
        status: newStatus,
        phoneNumber,
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
          updatedBy: "Admin"
        });
        if (newStatus === "Order Complete" && updatedCustomer.paymentClaimEvidence) {
          updatedCustomer.paymentClaimEvidence.verified = true;
          updatedCustomer.paymentClaimEvidence.verifiedAt = timestamp;
          updatedCustomer.paymentClaimEvidence.verifiedBy = "admin";
        }
      }
      customers[phoneNumber] = updatedCustomer;
      await saveCustomers(customers);
      res.json({ success: true, customer: updatedCustomer });
    } catch (error) {
      console.error("Failed to update customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });
  app.post("/api/customers/:phoneNumber/verify-order", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const result = await updateCustomerStatus(
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
      const { phoneNumber } = req.params;
      const customers = await getCustomers();
      if (customers[phoneNumber]) {
        customers[phoneNumber].messages = [];
        customers[phoneNumber].lastActivity = (/* @__PURE__ */ new Date()).toISOString();
        await saveCustomers(customers);
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
      const { phoneNumber } = req.params;
      const customers = await getCustomers();
      if (customers[phoneNumber]) {
        delete customers[phoneNumber];
        await saveCustomers(customers);
        return res.json({ success: true, message: "Customer deleted successfully." });
      }
      res.status(404).json({ error: "Customer not found" });
    } catch (error) {
      console.error("Failed to delete customer:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });
}
var import_promises5, import_path6, VALID_CUSTOMER_STATUSES, getCustomersFile;
var init_memory = __esm({
  "src/server/memory.ts"() {
    import_promises5 = __toESM(require("fs/promises"), 1);
    import_path6 = __toESM(require("path"), 1);
    init_usage();
    init_paths();
    VALID_CUSTOMER_STATUSES = [
      "New Customer",
      "Interested",
      "Payment Pending",
      "Payment Done",
      "Order Complete",
      "Follow Up",
      "Important"
    ];
    getCustomersFile = () => import_path6.default.join(DATA_DIR, "customers.json");
  }
});

// src/server/tools.ts
async function getTools() {
  try {
    const data = await import_promises6.default.readFile(getToolsFile(), "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}
async function saveTools(tools) {
  await import_promises6.default.writeFile(getToolsFile(), JSON.stringify(tools, null, 2));
}
function setupToolsRoutes(app) {
  app.get("/api/tools", async (req, res) => {
    try {
      const tools = await getTools();
      res.json(tools);
    } catch (error) {
      res.status(500).json({ error: "Failed to load tools" });
    }
  });
  app.post("/api/tools/upload-image", async (req, res) => {
    try {
      const { filename, data, title, description, toolId } = req.body;
      if (!filename || !data || !description) {
        return res.status(400).json({ error: "Filename, image data, and description are required." });
      }
      const imagesDir = getToolImagesDir();
      await import_promises6.default.mkdir(imagesDir, { recursive: true });
      const ext = import_path7.default.extname(filename) || ".png";
      const baseName = import_path7.default.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      const uniqueFilename = `${Date.now()}_${baseName}${ext}`;
      const targetPath = import_path7.default.join(imagesDir, uniqueFilename);
      const base64Data = data.includes("base64,") ? data.split("base64,")[1] : data;
      const buffer = Buffer.from(base64Data, "base64");
      await import_promises6.default.writeFile(targetPath, buffer);
      const imageObject = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        filename: uniqueFilename,
        filepath: import_path7.default.join("data", "tool-images", uniqueFilename),
        url: `/tool-images/${uniqueFilename}`,
        title: title?.trim() || "",
        description: description.trim(),
        toolId: toolId || void 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (toolId) {
        let tools = await getTools();
        const toolIdx = tools.findIndex((t) => t.id === toolId);
        if (toolIdx !== -1) {
          tools[toolIdx].images = tools[toolIdx].images || [];
          tools[toolIdx].images.push(imageObject);
          await saveTools(tools);
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
      const { name, rawInfo, images } = req.body;
      const prompt = `Convert the following raw tool information into a clean structured JSON format. 
DO NOT OUTPUT ANY TEXT EXCEPT THE RAW JSON.
Format required:
{
  "name": "${name}",
  "description": "...",
  "features": ["...", "..."],
  "use_cases": ["...", "..."],
  "requirements": ["...", "..."],
  "limitations": ["...", "..."],
  "how_to_use": "...",
  "sales_points": ["...", "..."],
  "faq": []
}

Raw Information:
${rawInfo}
`;
      const aiResponse = await askAI(prompt);
      let parsedTool;
      try {
        const cleanedResponse = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        parsedTool = JSON.parse(cleanedResponse);
      } catch (e) {
        console.error("Failed to parse LLM structured tool:", aiResponse);
        parsedTool = {
          id: Date.now().toString(),
          name,
          description: rawInfo,
          features: [],
          use_cases: [],
          requirements: [],
          limitations: [],
          how_to_use: "",
          sales_points: [],
          faq: []
        };
      }
      parsedTool.id = Date.now().toString();
      parsedTool.images = Array.isArray(images) ? images : [];
      const tools = await getTools();
      tools.push(parsedTool);
      await saveTools(tools);
      res.json(parsedTool);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add tool" });
    }
  });
  app.put("/api/tools/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedData = req.body;
      let tools = await getTools();
      const index = tools.findIndex((t) => t.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Tool not found" });
      }
      tools[index] = {
        ...tools[index],
        ...updatedData,
        id
        // preserve ID
      };
      await saveTools(tools);
      res.json({ success: true, tool: tools[index] });
    } catch (error) {
      console.error("Failed to update tool:", error);
      res.status(500).json({ error: "Failed to update tool" });
    }
  });
  app.delete("/api/tools/:id", async (req, res) => {
    try {
      let tools = await getTools();
      tools = tools.filter((t) => t.id !== req.params.id);
      await saveTools(tools);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tool" });
    }
  });
}
var import_promises6, import_path7, getToolsFile, getToolImagesDir;
var init_tools = __esm({
  "src/server/tools.ts"() {
    import_promises6 = __toESM(require("fs/promises"), 1);
    import_path7 = __toESM(require("path"), 1);
    init_ai();
    init_paths();
    getToolsFile = () => import_path7.default.join(DATA_DIR, "tools.json");
    getToolImagesDir = () => TOOL_IMAGES_DIR;
  }
});

// src/server/agent.ts
function startAgent() {
  console.log("[Agent] Ultra-Natural WhatsApp Conversation Engine initialized.");
}
async function queueMessage(phoneNumber, message, name) {
  const seq = ++globalSequenceCounter;
  console.log(`[Agent] [Seq #${seq}] Queued message from ${phoneNumber} (${name || "Customer"}): "${message}"`);
  let state = customerQueues.get(phoneNumber);
  if (!state) {
    state = {
      phoneNumber,
      name,
      pendingMessages: [],
      debounceTimer: null,
      isProcessing: false
    };
    customerQueues.set(phoneNumber, state);
  }
  if (name) state.name = name;
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
      triggerCustomerProcessing(phoneNumber);
    }
  }, 1350);
}
async function triggerCustomerProcessing(phoneNumber) {
  const state = customerQueues.get(phoneNumber);
  if (!state || state.isProcessing || state.pendingMessages.length === 0) {
    return;
  }
  state.isProcessing = true;
  const batch = [...state.pendingMessages];
  state.pendingMessages = [];
  try {
    await handleCustomerMessageBatch(phoneNumber, batch, state.name);
  } catch (error) {
    console.error(`[Agent] Error processing customer ${phoneNumber}:`, error);
  } finally {
    state.isProcessing = false;
    if (state.pendingMessages.length > 0) {
      triggerCustomerProcessing(phoneNumber);
    }
  }
}
async function handleCustomerMessageBatch(phoneNumber, batch, name) {
  const settings = await getSettings();
  if (!settings.aiAgentEnabled) {
    console.log(`[Agent] AI Agent is disabled in settings. Skipping reply to ${phoneNumber}.`);
    return;
  }
  const combinedUserText = batch.map((m) => m.text).filter(Boolean).join("\n");
  if (!combinedUserText) return;
  console.log(`[Agent] Processing incoming batch (${batch.length} msg(s)) for ${phoneNumber}:
"${combinedUserText}"`);
  await updateCustomerMemory(phoneNumber, combinedUserText, "user");
  await recordUserMessage();
  const quota = await checkAiReplyQuota();
  if (!quota.allowed) {
    console.log(
      `[Agent] Monthly AI reply limit reached (${quota.usedThisMonth}/${quota.limit} replies used on ${quota.plan} plan). Skipping AI reply to ${phoneNumber}. Deleting customers does NOT reset this quota.`
    );
    return;
  }
  const response = await generateResponse(phoneNumber, combinedUserText, name, batch);
  if (!response || response.textMessages.length === 0 && !response.imageToSend) {
    return;
  }
  const delaySec = settings.responseDelaySeconds || 1.4;
  await sendResponse(phoneNumber, response.textMessages, response.imageToSend, delaySec);
  await recordAiReply();
}
async function generateResponse(phoneNumber, latestCustomerText, name, batch) {
  const settings = await getSettings();
  const customers = await getCustomers();
  const customer = customers[phoneNumber] || { phoneNumber, status: "New Customer", messages: [] };
  const tools = await getTools();
  const toolContext = tools.length > 0 ? tools.map((t) => {
    let block = `=== TOOL: ${t.name} ===
Category: ${t.category || "AI Tools"}
Status: ${t.status || "active"}
Description: ${t.description || ""}`;
    if (t.pricePkr || t.priceUsd) {
      block += `
Pricing: ${t.pricePkr ? `Rs. ${t.pricePkr}/month` : ""} ${t.priceUsd ? `($${t.priceUsd}/mo)` : ""}`;
    }
    if (t.features && t.features.length > 0) {
      block += `
Key Features:
` + t.features.map((f) => `  - ${f}`).join("\n");
    }
    if (t.use_cases && t.use_cases.length > 0) {
      block += `
Use Cases:
` + t.use_cases.map((u) => `  - ${u}`).join("\n");
    }
    if (t.limitations && t.limitations.length > 0) {
      block += `
Limits & Limitations:
` + t.limitations.map((l) => `  - ${l}`).join("\n");
    }
    if (t.how_to_use) {
      block += `
How to Use / Access: ${t.how_to_use}`;
    }
    if (t.sales_points && t.sales_points.length > 0) {
      block += `
Sales Points / Standout Advantages:
` + t.sales_points.map((s) => `  - ${s}`).join("\n");
    }
    if (t.faq && t.faq.length > 0) {
      block += `
FAQs:
` + t.faq.map((q) => `  Q: ${q.question} -> A: ${q.answer}`).join("\n");
    }
    if (t.images && Array.isArray(t.images) && t.images.length > 0) {
      block += `
Available Screenshots / UI Images:
` + t.images.map((img) => `  - Image File: "${img.filepath || img.filename}" | Title: "${img.title || "Screenshot"}" | Description: "${img.description}"`).join("\n");
    }
    return block;
  }).join("\n\n") : "No custom tools configured in Tool Manager.";
  const activePayments = (settings.paymentMethods || []).filter((p) => p.isActive !== false);
  const paymentContext = activePayments.length > 0 ? activePayments.map(
    (p) => `\u2022 ${p.provider}: ${p.accountTitle} | Number: ${p.accountNumber}${p.bankName ? ` (${p.bankName})` : ""}${p.iban ? ` | IBAN: ${p.iban}` : ""}${p.instructions ? ` - Note: ${p.instructions}` : ""}`
  ).join("\n") + (settings.paymentInstructions ? `
Payment Policy: ${settings.paymentInstructions}` : "") : "No manual bank accounts configured. Ask customer to contact admin.";
  const customerMessages = customer.messages || [];
  const messageHistory = customerMessages.slice(-20).map((m) => `${m.role === "user" ? name || "Customer" : "You (Agent)"}: ${m.content}`).join("\n");
  const agentPastMessages = customerMessages.filter((m) => m.role === "agent").map((m) => m.content).join("\n");
  const prompt = `You are a real, natural Pakistani WhatsApp salesperson helping a customer on WhatsApp.
You MUST behave like a genuine human Pakistani sales representative, NOT like an AI chatbot, corporate helpdesk, or product brochure.

==================================================
1. LANGUAGE & RESPONSE STYLE (CRITICAL)
==================================================
- Language: Casual, friendly Roman Urdu mixed naturally with everyday English words (e.g. "han bhai", "acha", "jee", "theek", "bilkul", "scene ye hai", "koi issue nahi", "try krlo", "check kar lo", "bhej deta hun", "apko", "chahiye").
- Natural English words: "plan", "tool", "link", "account", "payment", "voice", "voices", "video", "generation", "quality", "clone", "free", "pro", "unlimited", "setup", "screenshot", "interface", "features", "details".
- Avoid formal Urdu (STRICTLY BAN phrases like "\u06C1\u0645 \u0622\u067E \u06A9\u06D2 \u0645\u0634\u06A9\u0648\u0631 \u06C1\u06CC\u06BA", "\u0622\u067E \u06A9\u0627 \u062E\u06CC\u0631 \u0645\u0642\u062F\u0645 \u06A9\u0631\u062A\u06D2 \u06C1\u06CC\u06BA", "\u0645\u0639\u0632\u0632 \u0635\u0627\u0631\u0641", "\u062A\u0634\u0631\u06CC\u0641 \u0644\u0627\u0626\u06CC\u06BA").
- Avoid robotic AI phrases (STRICTLY BAN "As an AI model", "I am here to assist you with", "Here is a breakdown of our offerings:", "Feel free to ask further questions!").
- Avoid marketing fluff & hype (STRICTLY BAN "revolutionary", "supercharge", "game-changer", "powerhouse", "all-in-one suite", "unbeatable deal").
- Avoid emoji spam: Use at most 0\u20131 subtle emoji per message (e.g. \u{1F44D} or \u{1F447}). Never put 4-5 emojis in one line.
- NEVER send huge monolithic paragraphs. Keep each message short, crisp, and conversational.
- Message Count: Normally send 1\u20133 short messages. For genuine detail requests ("details?", "aur batao"), send maximum 3\u20134 short messages.
- After providing enough relevant information, STOP and wait for the customer to reply.

==================================================
2. TOOL RECOMMENDATIONS (NATURAL HIGHLIGHTS)
==================================================
When a customer asks for a tool (e.g. "voice over tool chahiye", "video downloader hai?", "script generator chahiye"):
- Do NOT give only a lazy 1-line vague answer (like "Han available hai").
- Provide the 2 to 4 most useful highlights from that tool's knowledge in 2-3 short, natural messages:
  Example:
  Message 1: "Han bhai, VoiceDelta hai iske liye."
  Message 2: "Isme 3,600+ AI voices hain \u2014 ElevenLabs, OpenAI, Gemini aur Microsoft ki."
  Message 3: "Voice cloning bhi hai aur Pro me unlimited voice generation milti hai."
- Then STOP.
- Do NOT dump every single feature, all limitations, all technical specs, FAQs, or full pricing tiers immediately.

==================================================
3. INTENT-BASED REPLIES (PRECISE ANSWERS)
==================================================
Answer according to EXACTLY what the customer asks:
- "price?" / "kitne ka hai?" \u2192 Give price only in 1 short message (e.g. "VoiceDelta Pro Rs. 1,500/month ka hai.").
- "link?" / "kahan se buy karun?" \u2192 Send link only in 1 short message (e.g. "Ye lo bhai \u{1F447}
https://...").
- "voice cloning hai?" / "urdu voices hain?" \u2192 Answer that specific question directly in 1 short message.
- "features?" \u2192 Give top 2-3 most standout features.
- "details?" / "aur batao" \u2192 Give 2-3 moderate NEW details that have NOT been mentioned yet in this chat.
- DO NOT restart the complete product pitch after every question!

==================================================
4. PROGRESSIVE DISCLOSURE & INFORMATION SELECTION
==================================================
Stored tool knowledge contains many details. Before replying, select ONLY the information relevant to the customer's current intent.
Priority:
1. Direct answer to their immediate question
2. Most useful supporting point
3. Optional next detail
Ignore everything else unless the customer explicitly asks for it.

==================================================
5. STRICT ANTI-REPETITION (NO DUPLICATE FACTS)
==================================================
Check the RECENT CHAT HISTORY below.
If the customer already knows a fact (e.g. voice count, voice cloning, or price):
- DO NOT repeat those same facts again unless the customer specifically asks to confirm them.
- Reveal fresh, relevant points progressively.

==================================================
6. NATURAL SALES BEHAVIOR (BUILD CONFIDENCE)
==================================================
- Goal: Understand \u2192 Recommend \u2192 Explain \u2192 Build confidence \u2192 Help decide.
- NEVER pressure the customer or create fake urgency (NEVER say "only 2 slots left" or "offer ending today").
- NEVER make fake claims or invent features, prices, limits, or links not found in Tool Knowledge.
- DO NOT repeatedly ask pushy closing questions like:
  - "Kya main link bhej doon?"
  - "Kya aap buy karna chahenge?"
  - "Kya trial karna hai?"
  - "Aap kab payment karenge?"
- Only ask a question when it naturally helps the customer make a decision.

==================================================
7. MESSAGE SPLITTING RULES
==================================================
WhatsApp messages must be natural. Don't over-fragment every 2 words into a separate bubble, and don't dump everything into 1 huge block.
Separate multi-message turns by placing "---MSG---" between them.
BAD (Over-fragmented):
"Han bhai."
"VoiceDelta hai."
"Isme voices hain."
"3600+ voices hain."
"Cloning bhi hai."

GOOD (Natural conversation bubbles):
"Han bhai, VoiceDelta hai iske liye. Isme 3,600+ AI voices hain \u2014 ElevenLabs, OpenAI, Gemini aur Microsoft ki."
---MSG---
"Voice cloning bhi hai aur Pro me unlimited generation milti hai."

==================================================
8. OFFICIAL PAYMENT DETAILS & SCREENSHOTS
==================================================
If the customer asks how to pay or asks for payment accounts ("payment kahan karni hai", "account number do", "easypaisa/jazzcash hai?"):
- Send the official payment details cleanly from OFFICIAL PAYMENT ACCOUNTS below.
- Ask them to send the payment screenshot/receipt after transferring so access can be activated.

==================================================
9. SCREENSHOT / IMAGE INTELLIGENCE
==================================================
- Only attach an image if the customer explicitly asks to see the interface/screenshot/dashboard (e.g. "interface dikhao", "screenshot bhej do", "dashboard kesa lagta hai"), OR if an image is directly requested.
- To send an image, append [SEND_IMAGE: <filepath>] to your response.
- Otherwise, do NOT include [SEND_IMAGE: ...].

==================================================
10. CUSTOMER STATUS AUTOMATION (MEMORY UPDATE)
==================================================
Current Customer Status: "${customer.status || "New Customer"}"

Analyze the conversation evidence and determine if the customer's status should change.
Available statuses:
- "New Customer": New contact or first-time inquiry asking about tools.
- "Interested": Customer shows active or repeated product interest, asking about capabilities, features, or prices.
- "Payment Pending": Customer clearly wants to buy, asks for payment account details, or says "buy karna hai", "account bhej do", "payment method", but has not confirmed paying yet.
- "Payment Done": Customer states they have sent/transferred the payment, mentions transaction ID, sends receipt/screenshot, or says "payment kar di hai", "check kar lo payment". (Note: Payment Done is unverified customer claim).
- "Follow Up": Customer explicitly asks to be contacted later ("kal baat karte hain", "busy hun abhi", "baad me batata hun", "shaam ko message karna").
- "Order Complete": (CRITICAL: NEVER output this status. Only human admins can mark Order Complete upon payment verification).
- "Important": Priority customer or VIP lead.

RULES FOR STATUS CHANGE:
- Do NOT change status on casual messages (e.g. "ok", "acha", "han", "theek").
- Only change when there is clear conversation evidence.
- If status should change, append [SET_STATUS: <StatusName>] to your response.
- If current status should remain as is, do NOT include [SET_STATUS: ...].

${settings.systemPrompt ? `Additional Custom Admin Persona/Instructions:
${settings.systemPrompt}
` : ""}

STORED TOOL KNOWLEDGE (SOURCE OF TRUTH):
${toolContext}

OFFICIAL PAYMENT ACCOUNTS:
${paymentContext}

RECENT CHAT HISTORY:
${messageHistory || "No previous messages with this customer."}

CUSTOMER'S NEW MESSAGE(S):
"${latestCustomerText}"

Provide your reply below in casual Roman Urdu. Separate 1\u20133 short messages using "---MSG---". Keep it ultra-natural, conversational, and helpful.`;
  console.log(`[Agent] Generating AI response for ${phoneNumber}...`);
  const rawReply = await askAI(prompt);
  console.log(`[Agent] AI raw response for ${phoneNumber}:
${rawReply}`);
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
  await evaluateAndApplyCustomerStatus(phoneNumber, customer, latestCustomerText, extractedAiStatus);
  text = text.replace(/^(Agent|You|Assistant|Bot|Salesperson):\s*/gim, "").replace(/^["']|["']$/g, "").trim();
  let messages = [];
  if (text.includes("---MSG---")) {
    messages = text.split("---MSG---").map((m) => m.trim()).filter((m) => m.length > 0);
  } else {
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
    if (paragraphs.length > 1 && paragraphs.length <= 4) {
      messages = paragraphs;
    } else if (text.length > 0) {
      messages = [text];
    }
  }
  messages = messages.map((m) => m.replace(/^(Message\s*\d+:|\d+\.)\s*/i, "").trim()).filter((m) => m.length > 0);
  if (messages.length > 4) {
    messages = messages.slice(0, 4);
  }
  if (messages.length === 0 && imageToSend) {
    messages = ["Han bhai, ye dekho interface \u{1F447}"];
  }
  return {
    textMessages: messages,
    imageToSend
  };
}
async function sendResponse(phoneNumber, textMessages, imageToSend, delaySec) {
  const memoryText = textMessages.join("\n\n") + (imageToSend ? `
[Sent Image: ${imageToSend}]` : "");
  await updateCustomerMemory(phoneNumber, memoryText, "agent");
  for (let i = 0; i < textMessages.length; i++) {
    const msg = textMessages[i];
    console.log(`[Agent] Sending split message [${i + 1}/${textMessages.length}] to ${phoneNumber}: "${msg}"`);
    await sendMessage(phoneNumber, msg);
    if (i < textMessages.length - 1) {
      const waitMs = Math.max(900, Math.min(2500, delaySec * 1e3));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  if (imageToSend) {
    console.log(`[Agent] Delivering tool screenshot to ${phoneNumber}: ${imageToSend}`);
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    await sendToolImage(phoneNumber, imageToSend);
  }
}
async function evaluateAndApplyCustomerStatus(phoneNumber, customer, latestCustomerText, aiStatusTag) {
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
      reason = "Customer stated payment was transferred / sent screenshot.";
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
      if (toolInterestRegex.test(textLower)) {
        targetStatus = "Interested";
        reason = "New customer inquired about tool features, capabilities, or pricing.";
      }
    }
    if (targetStatus) {
      if (targetStatus === "Order Complete") {
        console.log(`[Agent] Rejected automated status transition to 'Order Complete' for ${phoneNumber}. Requires manual admin verification.`);
        return;
      }
      if (currentStatus === "Order Complete") {
        return;
      }
      if (currentStatus === "Important" && (targetStatus === "New Customer" || targetStatus === "Interested")) {
        return;
      }
      if (currentStatus === "Payment Done" && targetStatus === "Interested") {
        return;
      }
      if (targetStatus !== currentStatus) {
        await updateCustomerStatus(
          phoneNumber,
          targetStatus,
          reason,
          "AI managed",
          targetStatus === "Payment Done" ? { messageSnippet: latestCustomerText, claimedAt: (/* @__PURE__ */ new Date()).toISOString() } : void 0
        );
      }
    }
  } catch (err) {
    console.error("[Agent] Error evaluating customer status:", err);
  }
}
var customerQueues, globalSequenceCounter;
var init_agent = __esm({
  "src/server/agent.ts"() {
    init_ai();
    init_memory();
    init_tools();
    init_settings();
    init_whatsapp();
    init_usage();
    customerQueues = /* @__PURE__ */ new Map();
    globalSequenceCounter = 100;
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
var import_promises7, import_path8, import_axios2, ACCOUNTS_FILE, CONFIG_FILE, LOGS_FILE, accountsCache, configCache, logsCache, roundRobinIndex, balanceRefreshTimer, DEFAULT_CONFIG;
var init_deepgram = __esm({
  "src/server/deepgram.ts"() {
    import_promises7 = __toESM(require("fs/promises"), 1);
    import_path8 = __toESM(require("path"), 1);
    import_axios2 = __toESM(require("axios"), 1);
    init_tools();
    init_paths();
    ACCOUNTS_FILE = import_path8.default.join(DATA_DIR, "deepgram_accounts.json");
    CONFIG_FILE = import_path8.default.join(DATA_DIR, "deepgram_config.json");
    LOGS_FILE = import_path8.default.join(DATA_DIR, "deepgram_logs.json");
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
function getAuthDir() {
  return AUTH_DIR;
}
async function ensureAuthDir() {
  const authDir = getAuthDir();
  await import_promises8.default.mkdir(authDir, { recursive: true });
  const oldAuthDir = import_path9.default.join(ROOT_DIR, "auth");
  try {
    const oldCreds = import_path9.default.join(oldAuthDir, "creds.json");
    await import_promises8.default.access(oldCreds);
    const newCreds = import_path9.default.join(authDir, "creds.json");
    try {
      await import_promises8.default.access(newCreds);
    } catch {
      const files = await import_promises8.default.readdir(oldAuthDir);
      for (const file of files) {
        await import_promises8.default.copyFile(import_path9.default.join(oldAuthDir, file), import_path9.default.join(authDir, file));
      }
      console.log("[WhatsApp] Migrated legacy auth files to data/auth");
    }
  } catch {
  }
  return authDir;
}
async function connectToWhatsApp(usePairingCode = false) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (isConnecting || connectionStatus === "connected" && sock) {
    return;
  }
  isConnecting = true;
  try {
    isIntentionallyDisconnected = false;
    const authDir = await ensureAuthDir();
    const { state, saveCreds } = await (0, import_baileys.useMultiFileAuthState)(authDir);
    connectionStatus = "connecting";
    qrCodeDataUrl = null;
    pairingCodeData = null;
    if (sock) {
      try {
        sock.ev.removeAllListeners("connection.update");
        sock.ev.removeAllListeners("creds.update");
        sock.ev.removeAllListeners("messages.upsert");
        sock.end(void 0);
      } catch {
      }
      sock = null;
    }
    const newSock = (0, import_baileys.makeWASocket)({
      auth: state,
      printQRInTerminal: !usePairingCode,
      browser: usePairingCode ? ["Ubuntu", "Chrome", "20.0.04"] : import_baileys.Browsers.macOS("Desktop"),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      logger: (0, import_pino.default)({ level: "silent" })
    });
    sock = newSock;
    newSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr && !usePairingCode) {
        qrCodeDataUrl = await import_qrcode.default.toDataURL(qr);
      }
      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === import_baileys.DisconnectReason.loggedOut;
        const isReplaced = statusCode === import_baileys.DisconnectReason.connectionReplaced || statusCode === 440;
        const shouldReconnect = !isLoggedOut && !isReplaced && !isIntentionallyDisconnected;
        connectionStatus = "disconnected";
        console.log(`[WhatsApp] Connection closed. Reason: ${statusCode || lastDisconnect?.error}. Should reconnect: ${shouldReconnect}`);
        if (shouldReconnect) {
          const delay = statusCode === import_baileys.DisconnectReason.restartRequired ? 1e3 : 5e3;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            connectToWhatsApp(usePairingCode).catch(console.error);
          }, delay);
        } else if (isLoggedOut && !isIntentionallyDisconnected) {
          console.log("[WhatsApp] Session logged out. Cleaning auth data to prevent reconnect loop.");
          try {
            await import_promises8.default.rm(authDir, { recursive: true, force: true });
          } catch (e) {
            console.error("[WhatsApp] Failed to clean auth dir:", e);
          }
        }
      } else if (connection === "open") {
        console.log("[WhatsApp] Connection opened successfully and session saved!");
        connectionStatus = "connected";
        qrCodeDataUrl = null;
        pairingCodeData = null;
      }
    });
    newSock.ev.on("creds.update", async () => {
      await saveCreds();
    });
    newSock.ev.on("messages.upsert", async (m) => {
      if (m.type === "notify" || m.type === "append") {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            const sender = msg.key.remoteJid;
            if (sender && !sender.includes("@g.us") && !sender.includes("status@broadcast")) {
              const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.ephemeralMessage?.message?.extendedTextMessage?.text || msg.message.ephemeralMessage?.message?.conversation || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || msg.message.documentMessage?.caption || msg.message.templateButtonReplyMessage?.selectedId || msg.message.buttonsResponseMessage?.selectedButtonId || msg.message.listResponseMessage?.singleSelectReply?.selectedRowId;
              if (textMessage) {
                console.log(`[WhatsApp] Received message from ${sender}: "${textMessage}"`);
                await queueMessage(sender, textMessage, msg.pushName || "Customer");
              } else {
                const audioMsg = msg.message.audioMessage || msg.message.ephemeralMessage?.message?.audioMessage || msg.message.viewOnceMessage?.message?.audioMessage || msg.message.viewOnceMessageV2?.message?.audioMessage;
                if (audioMsg) {
                  console.log(`[WhatsApp] Received voice message from ${sender} (Duration: ${audioMsg.seconds || "?"}s, PTT: ${audioMsg.ptt ? "Yes" : "No"}). Initiating Deepgram transcription...`);
                  try {
                    const audioBuffer = await (0, import_baileys.downloadMediaMessage)(
                      msg,
                      "buffer",
                      {},
                      {
                        logger: (0, import_pino.default)({ level: "silent" }),
                        reuploadRequest: newSock.updateMediaMessage
                      }
                    );
                    if (audioBuffer && audioBuffer.length > 0) {
                      const result = await transcribeAudio(audioBuffer, {
                        customerJid: sender,
                        mimetype: audioMsg.mimetype || "audio/ogg; codecs=opus"
                      });
                      if (result.success && result.transcript) {
                        console.log(`[WhatsApp] Voice message transcribed via ${result.providerUsed}: "${result.transcript}"`);
                        await queueMessage(sender, result.transcript, msg.pushName || "Customer");
                      } else {
                        console.warn(`[WhatsApp] Voice message transcription failed: ${result.error}`);
                      }
                    }
                  } catch (err) {
                    console.error(`[WhatsApp] Error processing voice note from ${sender}:`, err);
                  }
                }
              }
            }
          }
        }
      }
    });
  } finally {
    isConnecting = false;
  }
}
function getWhatsAppConnectionStatus() {
  return connectionStatus;
}
async function fetchAllGroups() {
  const cachePath = import_path9.default.join(DATA_DIR, "groups_cache.json");
  if (cachedGroups && Date.now() - lastGroupFetchTime < GROUP_CACHE_TTL) {
    return cachedGroups;
  }
  if (!sock || connectionStatus !== "connected") {
    try {
      const data = await import_promises8.default.readFile(cachePath, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  try {
    const groupsObj = await sock.groupFetchAllParticipating();
    const result = [];
    for (const [jid, meta] of Object.entries(groupsObj)) {
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
    cachedGroups = result;
    lastGroupFetchTime = Date.now();
    try {
      await import_promises8.default.writeFile(cachePath, JSON.stringify(result, null, 2));
    } catch (err) {
      console.warn("[WhatsApp] Failed to write groups cache:", err);
    }
    return result;
  } catch (error) {
    if (error?.message?.includes("Connection Closed")) {
      console.warn("[WhatsApp] Warning: Connection closed while fetching groups. Using cache.");
    } else {
      console.error("[WhatsApp] Error fetching participating groups:", error);
    }
    try {
      const data = await import_promises8.default.readFile(cachePath, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
async function sendCampaignMessage(jidOrPhone, text) {
  if (!sock || connectionStatus !== "connected") {
    return { success: false, error: "WhatsApp is not connected." };
  }
  try {
    let clean = jidOrPhone.trim();
    if (!clean.includes("@")) {
      clean = clean.replace(/[^0-9]/g, "");
      clean = `${clean}@s.whatsapp.net`;
    }
    await sock.sendMessage(clean, { text });
    return { success: true };
  } catch (error) {
    console.error(`[WhatsApp] Failed to send campaign message to ${jidOrPhone}:`, error);
    return {
      success: false,
      error: error?.message || error?.toString() || "Unknown WhatsApp transmission error"
    };
  }
}
async function sendMessage(jid, text) {
  if (!sock) {
    console.warn("[WhatsApp] Cannot send message: WhatsApp socket is not connected.");
    return;
  }
  try {
    const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
    console.log(`[WhatsApp] Sending reply to ${formattedJid}: "${text}"`);
    await sock.sendMessage(formattedJid, { text });
    console.log(`[WhatsApp] Message successfully sent to ${formattedJid}`);
  } catch (error) {
    console.error(`[WhatsApp] Error delivering message to ${jid}:`, error);
  }
}
async function sendToolImage(jid, imagePath, caption) {
  if (!sock) {
    console.warn("[WhatsApp] Cannot send image: WhatsApp socket is not connected.");
    return false;
  }
  try {
    const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
    const fullPath = import_path9.default.isAbsolute(imagePath) ? imagePath : import_path9.default.join(ROOT_DIR, imagePath);
    try {
      await import_promises8.default.access(fullPath);
    } catch {
      console.warn(`[WhatsApp] Tool image file not found on disk at: ${fullPath}`);
      return false;
    }
    const imageBuffer = await import_promises8.default.readFile(fullPath);
    console.log(`[WhatsApp] Sending tool image (${import_path9.default.basename(fullPath)}) to ${formattedJid}`);
    await sock.sendMessage(formattedJid, {
      image: imageBuffer,
      caption: caption || void 0
    });
    console.log(`[WhatsApp] Tool image successfully sent to ${formattedJid}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp] Error sending tool image to ${jid}:`, error);
    return false;
  }
}
function getSocket() {
  return sock;
}
function getConnectionStatus() {
  return connectionStatus;
}
function setupWhatsAppRoutes(app) {
  app.get("/api/whatsapp/status", (req, res) => {
    res.json({
      status: connectionStatus,
      qr: qrCodeDataUrl,
      pairingCode: pairingCodeData
    });
  });
  app.post("/api/whatsapp/connect", async (req, res) => {
    if (connectionStatus === "disconnected") {
      await connectToWhatsApp(false);
    }
    res.json({ success: true, status: connectionStatus });
  });
  app.post("/api/whatsapp/pair", async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: "Phone number required" });
    try {
      if (sock && connectionStatus !== "disconnected") {
        isIntentionallyDisconnected = true;
        sock.ws.close();
        connectionStatus = "disconnected";
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await connectToWhatsApp(true);
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (!sock?.authState.creds.registered) {
        const code = await sock.requestPairingCode(cleanNumber);
        pairingCodeData = code;
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
      const { phoneNumber, message } = req.body;
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "Phone number and message are required." });
      }
      if (connectionStatus !== "connected" || !sock) {
        return res.status(400).json({ error: "WhatsApp is not connected." });
      }
      await sendMessage(phoneNumber, message);
      const { updateCustomerMemory: updateCustomerMemory2 } = await Promise.resolve().then(() => (init_memory(), memory_exports));
      await updateCustomerMemory2(phoneNumber, message, "agent");
      res.json({ success: true });
    } catch (err) {
      console.error("[WhatsApp] Failed to send manual message:", err);
      res.status(500).json({ error: err?.message || "Failed to send message" });
    }
  });
  app.post("/api/whatsapp/disconnect", async (req, res) => {
    if (sock) {
      isIntentionallyDisconnected = true;
      sock.logout().catch(() => sock?.ws?.close());
      connectionStatus = "disconnected";
      pairingCodeData = null;
      qrCodeDataUrl = null;
      const authDir = getAuthDir();
      await import_promises8.default.rm(authDir, { recursive: true, force: true }).catch(console.error);
    }
    res.json({ success: true });
  });
}
var import_baileys, import_pino, import_qrcode, import_promises8, import_path9, sock, qrCodeDataUrl, pairingCodeData, connectionStatus, isIntentionallyDisconnected, isConnecting, reconnectTimer, cachedGroups, lastGroupFetchTime, GROUP_CACHE_TTL;
var init_whatsapp = __esm({
  "src/server/whatsapp.ts"() {
    import_baileys = require("@whiskeysockets/baileys");
    init_agent();
    init_deepgram();
    import_pino = __toESM(require("pino"), 1);
    import_qrcode = __toESM(require("qrcode"), 1);
    import_promises8 = __toESM(require("fs/promises"), 1);
    import_path9 = __toESM(require("path"), 1);
    init_paths();
    sock = null;
    qrCodeDataUrl = null;
    pairingCodeData = null;
    connectionStatus = "disconnected";
    isIntentionallyDisconnected = false;
    isConnecting = false;
    reconnectTimer = null;
    cachedGroups = null;
    lastGroupFetchTime = 0;
    GROUP_CACHE_TTL = 5 * 60 * 1e3;
    setTimeout(async () => {
      try {
        const authDir = await ensureAuthDir();
        const creds = import_path9.default.join(authDir, "creds.json");
        await import_promises8.default.access(creds);
        console.log("[WhatsApp] Existing session found in data/auth. Auto-reconnecting to WhatsApp...");
        await connectToWhatsApp(false);
      } catch {
        console.log("[WhatsApp] No existing credentials found in data/auth. Ready for QR or Pairing code.");
      }
    }, 1200);
  }
});

// server.ts
var import_dotenv = __toESM(require("dotenv"), 1);
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_path12 = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_promises11 = __toESM(require("fs/promises"), 1);
init_paths();
init_whatsapp();
init_memory();
init_tools();
init_settings();

// src/server/campaign.ts
var import_promises9 = __toESM(require("fs/promises"), 1);
var import_path10 = __toESM(require("path"), 1);
init_whatsapp();
init_ai();
init_tools();
init_paths();
var CAMPAIGN_FILE = import_path10.default.join(DATA_DIR, "campaign.json");
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
    await import_promises9.default.mkdir(import_path10.default.dirname(CAMPAIGN_FILE), { recursive: true });
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
var import_path11 = __toESM(require("path"), 1);
var import_child_process = require("child_process");
var import_util = require("util");
var import_axios3 = __toESM(require("axios"), 1);
init_auth();
init_paths();
var execAsync = (0, import_util.promisify)(import_child_process.exec);
var CONFIG_FILE2 = import_path11.default.join(DATA_DIR, "github_config.json");
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
    logs.push(`[1/4] Preparing Git deployment from ${config.username}/${config.repo} (${config.branch})...`);
    try {
      const { stdout: stashOut } = await execAsync('git stash push -m "Auto-stash before deploy"');
      if (stashOut && !stashOut.includes("No local changes")) {
        logs.push(`[Info] Local changes stashed: ${stashOut.trim()}`);
      }
    } catch {
    }
    if (config.token) {
      const authenticatedUrl = `https://${config.username}:${config.token}@github.com/${config.username}/${config.repo}.git`;
      await execAsync(`git remote set-url origin "${authenticatedUrl}"`);
    }
    logs.push(`[2/4] Fetching latest commits from origin/${config.branch}...`);
    const { stdout: fetchOut, stderr: fetchErr } = await execAsync(`git fetch origin ${config.branch}`);
    if (fetchOut) logs.push(fetchOut.trim());
    if (fetchErr) logs.push(fetchErr.trim());
    logs.push(`[3/4] Checking out and fast-forwarding to origin/${config.branch}...`);
    try {
      await execAsync(`git checkout ${config.branch}`);
    } catch {
      await execAsync(`git checkout -B ${config.branch} origin/${config.branch}`);
    }
    const { stdout: pullOut } = await execAsync(`git merge origin/${config.branch} --ff-only`).catch(async () => {
      return await execAsync(`git reset --hard origin/${config.branch}`);
    });
    logs.push(pullOut.trim());
    try {
      await execAsync("git stash pop");
      logs.push("[Info] Restored local workspace stashed changes.");
    } catch {
    }
    const { stdout: newHeadOut } = await execAsync("git rev-parse HEAD");
    const deployedSha = newHeadOut.trim();
    logs.push(`[4/4] Successfully deployed version: ${deployedSha.substring(0, 7)}`);
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
    logs.push(`[1/3] Preparing rollback to commit ${commitSha.substring(0, 7)}...`);
    try {
      const { stdout: stashOut } = await execAsync(`git stash push -m "Auto-stash before rollback to ${commitSha.substring(0, 7)}"`);
      if (stashOut && !stashOut.includes("No local changes")) {
        logs.push(`[Info] Local changes stashed: ${stashOut.trim()}`);
      }
    } catch {
    }
    logs.push(`[2/3] Checking out commit ${commitSha.substring(0, 7)}...`);
    const { stdout: coOut, stderr: coErr } = await execAsync(`git checkout ${commitSha}`);
    if (coOut) logs.push(coOut.trim());
    if (coErr) logs.push(coErr.trim());
    const { stdout: headOut } = await execAsync("git rev-parse HEAD");
    const activeSha = headOut.trim();
    logs.push(`[3/3] Successfully rolled back. Active commit is now: ${activeSha.substring(0, 7)}`);
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
import_dotenv.default.config();
async function initializeDataDirs() {
  try {
    await import_promises11.default.mkdir(DATA_DIR, { recursive: true });
    await import_promises11.default.mkdir(TOOL_IMAGES_DIR, { recursive: true });
    await getUsers();
    await getLists();
    const files = ["customers.json", "tools.json", "settings.json"];
    for (const file of files) {
      const filePath = import_path12.default.join(DATA_DIR, file);
      try {
        await import_promises11.default.access(filePath);
      } catch {
        const defaultContent = file === "settings.json" ? JSON.stringify({ aiAgentEnabled: true, preferredApi: "gemini", defaultLLM: "Gemini", language: "Roman Urdu", autoReply: true, allowImageReplies: true }, null, 2) : JSON.stringify(file === "tools.json" ? [] : {}, null, 2);
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
  const rawPort = process.env.PORT;
  const portOrSocket = rawPort ? isNaN(Number(rawPort)) ? rawPort : parseInt(rawPort, 10) : 3001;
  app.use((0, import_cors.default)());
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use("/tool-images", import_express.default.static(TOOL_IMAGES_DIR));
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
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    console.log("[Development] Starting Vite dev server middleware...");
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
        let template = await import_promises11.default.readFile(import_path12.default.resolve(ROOT_DIR, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    console.log("[Production] Serving frontend assets from:", DIST_DIR);
    app.use(import_express.default.static(DIST_DIR, {
      index: false,
      maxAge: "1d",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
          res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
        } else if (filePath.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css; charset=UTF-8");
        } else if (filePath.endsWith(".json")) {
          res.setHeader("Content-Type", "application/json; charset=UTF-8");
        }
      }
    }));
    app.use("/api", (req, res) => {
      res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
    });
    app.use("/assets", (req, res) => {
      res.status(404).send("Asset not found");
    });
    app.get("*", (req, res) => {
      const indexPath = import_path12.default.join(DIST_DIR, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error("[Production Error] Failed to send index.html:", err);
          if (!res.headersSent) {
            res.status(500).send("Internal Server Error: SPA index.html missing");
          }
        }
      });
    });
  }
  app.listen(portOrSocket, () => {
    console.log(`Server running on ${typeof portOrSocket === "number" ? `http://localhost:${portOrSocket}` : portOrSocket}`);
  });
}
startServer().catch(console.error);
//# sourceMappingURL=server.cjs.map
