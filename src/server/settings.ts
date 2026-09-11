import { Express } from "express";
import fs from "fs/promises";
import path from "path";
import { askAI, callOfficialGemini, callGroq, callOpenAI } from "./ai.js";
import { getUserByToken } from "./auth.js";

export const getSettingsFile = (userId?: string) => {
  if (!userId || userId === "usr_admin_badar" || userId === "admin") {
    return path.join(process.cwd(), "data", "settings.json");
  }
  return path.join(process.cwd(), "data", `settings_${userId}.json`);
};

const DEFAULT_SETTINGS = {
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
  // isActive: false — these are UNFILLED PLACEHOLDERS ("Account Title" / a fake
  // number), only used as a schema example for a brand-new/unreachable settings
  // file. They must never be treated as real, live payment accounts: the agent
  // filters on isActive, so a corrupted/missing settings.json now correctly
  // falls through to "no payment info configured" instead of quoting this
  // placeholder number to a real customer as if it were genuine.
  paymentMethods: [
    {
      id: "pm_easypaisa_1",
      provider: "Easypaisa",
      accountTitle: "Account Title",
      accountNumber: "03001234567",
      bankName: "Easypaisa Wallet",
      instructions: "Send via Easypaisa App",
      isActive: false
    },
    {
      id: "pm_jazzcash_1",
      provider: "JazzCash",
      accountTitle: "Account Title",
      accountNumber: "03001234567",
      bankName: "JazzCash Mobile Account",
      instructions: "Send via JazzCash App",
      isActive: false
    }
  ]
};

export async function getSettings(userId?: string) {
  try {
    const targetFile = getSettingsFile(userId);
    const data = await fs.readFile(targetFile, "utf-8");
    const parsed = JSON.parse(data);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      preferredApi: parsed.preferredApi || (parsed.defaultLLM ? parsed.defaultLLM.toLowerCase() : "gemini"),
    };
  } catch (error) {
    // If user-specific settings don't exist yet, fall back to global settings
    if (userId && userId !== "usr_admin_badar" && userId !== "admin") {
      try {
        const globalData = await fs.readFile(getSettingsFile(), "utf-8");
        const parsed = JSON.parse(globalData);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
        };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    }
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(newSettings: any, userId?: string) {
  const current = await getSettings(userId);
  const merged = {
    ...current,
    ...newSettings,
  };
  // Normalize defaultLLM matching preferredApi if present
  if (merged.preferredApi) {
    if (merged.preferredApi.includes("deepseek")) merged.defaultLLM = "DeepSeek";
    else if (merged.preferredApi.includes("claude")) merged.defaultLLM = "Claude";
    else if (merged.preferredApi.includes("gptlogic")) merged.defaultLLM = "GPTLogic";
    else merged.defaultLLM = "Gemini";
  }
  const targetFile = getSettingsFile(userId);
  await fs.writeFile(targetFile, JSON.stringify(merged, null, 2));
  return merged;
}

export function setupSettingsRoutes(app: Express) {
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
    } catch (error: any) {
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

      let result: any = { success: false, text: "", provider };

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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || "API key test failed" });
    }
  });

  app.get("/api/skill", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const settings = await getSettings(user?.id);
      const skillPath = path.join(process.cwd(), "SKILL.md");
      let content = "";
      try {
        content = await fs.readFile(skillPath, "utf-8");
      } catch {
        content = "# WhatsApp Tool-Selling Closer\nNo SKILL.md found on server.";
      }
      res.json({
        enabled: settings.salesSkillEnabled !== false,
        content,
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
        const skillPath = path.join(process.cwd(), "SKILL.md");
        await fs.writeFile(skillPath, content, "utf-8");
      }
      res.json({ success: true, message: "Skill settings saved successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to save skill configuration" });
    }
  });
}

