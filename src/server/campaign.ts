import { Express } from "express";
import fs from "fs/promises";
import path from "path";
import { 
  CampaignState, 
  CampaignTargetGroup, 
  CampaignRateLimits, 
  CampaignLogEntry 
} from "../types.js";
import { 
  fetchAllGroups, 
  sendCampaignMessage, 
  getWhatsAppConnectionStatus 
} from "./whatsapp.js";
import { askAI } from "./ai.js";
import { getTools } from "./tools.js";

const CAMPAIGN_FILE = path.join(process.cwd(), "data", "campaign.json");

let campaignState: CampaignState = {
  id: "camp_" + Date.now(),
  name: "Targeted Outreach Campaign",
  status: "idle",
  targetGroups: [],
  allowedCountryCodes: ["+92"],
  rateLimits: {
    messagesPerHour: 10,
    messagesPerCampaign: 30,
    dailyLimit: 50,
    delayBetweenMessagesSeconds: 20,
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

let runnerTimer: NodeJS.Timeout | null = null;
let isExecutingTick = false;

/**
 * Loads campaign state from disk on startup
 */
export async function loadCampaignState(): Promise<CampaignState> {
  try {
    const data = await fs.readFile(CAMPAIGN_FILE, "utf-8");
    const parsed = JSON.parse(data);
    campaignState = {
      ...campaignState,
      ...parsed,
    };
    console.log(`[Campaign] Loaded campaign "${campaignState.name}" (Status: ${campaignState.status}, Sent: ${campaignState.messagesSent}/${campaignState.rateLimits.messagesPerCampaign})`);
  } catch {
    await saveCampaignState();
    console.log("[Campaign] Initialized fresh campaign state.");
  }
  return campaignState;
}

/**
 * Persists campaign state to disk
 */
export async function saveCampaignState() {
  campaignState.updatedAt = new Date().toISOString();
  try {
    await fs.mkdir(path.dirname(CAMPAIGN_FILE), { recursive: true });
    await fs.writeFile(CAMPAIGN_FILE, JSON.stringify(campaignState, null, 2));
  } catch (error) {
    console.error("[Campaign] Failed to save campaign state:", error);
  }
}

/**
 * Checks if a phone number matches any allowed country calling codes
 */
export function isPhoneEligible(phone: string, allowedCodes: string[]): boolean {
  if (!allowedCodes || allowedCodes.length === 0 || allowedCodes.includes("ALL") || allowedCodes.includes("all")) {
    return true;
  }
  
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  // Normalize local 03xx-xxxxxxx numbers to 923xxxxxxxxx
  if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
    cleanPhone = "92" + cleanPhone.substring(1);
  }

  return allowedCodes.some((code) => {
    const cleanCode = code.replace(/[^0-9]/g, "");
    return cleanPhone.startsWith(cleanCode);
  });
}

/**
 * Pauses campaign with attention message and saves state
 */
export async function pauseCampaign(reason: string) {
  campaignState.status = "paused";
  campaignState.pauseReason = reason;
  console.warn(`[Campaign] PAUSED: ${reason}`);
  await saveCampaignState();
}

/**
 * Core Round-Robin Campaign Tick Processor
 */
async function processCampaignTick() {
  if (campaignState.status !== "running" || isExecutingTick) {
    return;
  }

  isExecutingTick = true;

  try {
    const now = Date.now();

    // 1. Reset sliding rate limit windows
    if (now - campaignState.hourlyWindowStart >= 3600 * 1000) {
      campaignState.hourlySentCount = 0;
      campaignState.hourlyWindowStart = now;
    }
    if (now - campaignState.dailyWindowStart >= 24 * 3600 * 1000) {
      campaignState.dailySentCount = 0;
      campaignState.dailyWindowStart = now;
    }

    // 2. Delay sending if WhatsApp is temporarily disconnected, do not pause entirely
    const wsStatus = getWhatsAppConnectionStatus();
    if (wsStatus !== "connected") {
      console.log("[Campaign] WhatsApp disconnected. Waiting for connection before sending next message...");
      return;
    }

    // 3. Enforce Stop Condition: Multiple consecutive send failures
    if (campaignState.consecutiveFailures >= 3) {
      await pauseCampaign("Campaign paused — sending requires attention. 3 consecutive sends failed.");
      return;
    }

    // 4. Enforce Campaign Max Limit
    const totalMax = campaignState.rateLimits.messagesPerCampaign || 30;
    if (campaignState.messagesSent >= totalMax) {
      campaignState.status = "completed";
      campaignState.remainingQuota = 0;
      console.log(`[Campaign] Campaign completed. Total limit of ${totalMax} reached.`);
      await saveCampaignState();
      return;
    }

    // 5. Enforce Hourly Rate Limit
    const hourlyMax = campaignState.rateLimits.messagesPerHour || 10;
    if (campaignState.hourlySentCount >= hourlyMax) {
      const waitMinutes = Math.ceil((3600 * 1000 - (now - campaignState.hourlyWindowStart)) / 60000);
      console.log(`[Campaign] Hourly limit (${hourlyMax}/hr) reached. Waiting ~${waitMinutes}m for next window.`);
      return;
    }

    // 6. Enforce Daily Rate Limit
    const dailyMax = campaignState.rateLimits.dailyLimit || 50;
    if (campaignState.dailySentCount >= dailyMax) {
      await pauseCampaign("Campaign paused — sending requires attention. Daily limit reached.");
      return;
    }

    // 7. Verify Target Groups
    const targetGroups = campaignState.targetGroups || [];
    if (targetGroups.length === 0) {
      await pauseCampaign("Campaign paused — No target groups configured.");
      return;
    }

    // 8. Fetch active groups & participants
    const liveGroups = await fetchAllGroups();
    if (!liveGroups) {
      await pauseCampaign("Campaign paused — Unable to fetch WhatsApp group data. Please check your connection.");
      return;
    }
    const groupMap = new Map(liveGroups.map((g) => [g.id, g]));

    // 9. Round-Robin Search for the next eligible contact across selected groups
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

      // Skip group if configured member limit has been reached
      if (currentGroupSent >= configuredLimit) {
        continue;
      }

      const liveGroup = groupMap.get(targetGroup.id);
      if (!liveGroup || !liveGroup.participants || liveGroup.participants.length === 0) {
        continue;
      }

      // Group still has capacity
      allGroupsExhausted = false;

      // Find an eligible member in this group matching country prefix and not already contacted
      const participants = liveGroup.participants;
      for (const member of participants) {
        const phone = member.phoneNumber || member.id.split("@")[0];
        const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;

        // Check Prefix Filter
        if (!isPhoneEligible(normalizedPhone, campaignState.allowedCountryCodes)) {
          continue;
        }

        // Check if already contacted
        if (campaignState.contactedPhoneNumbers.includes(normalizedPhone)) {
          continue;
        }

        // Eligible contact found!
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

    // If all groups have reached their limit or no eligible contacts remain
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

    // 10. Select Message Variation (AI generated)
    const variations = campaignState.messageVariations && campaignState.messageVariations.length > 0
      ? campaignState.messageVariations
      : ["Assalam o Alaikum! Check out our AI tools for voice & video generation. Reply for info!"];

    const messageIndex = campaignState.messagesSent % variations.length;
    const messageToSend = variations[messageIndex];

    console.log(`[Campaign] Round-Robin Sending [Group: ${candidateGroupName}] -> ${candidatePhone}: "${messageToSend}"`);

    // 11. Send Message via WhatsApp
    const sendResult = await sendCampaignMessage(candidatePhone, messageToSend);

    const logEntry: CampaignLogEntry = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      groupName: candidateGroupName,
      groupId: candidateGroupId,
      targetNumber: candidatePhone,
      status: sendResult.success ? "Sent" : "Failed",
      messageSnippet: messageToSend.length > 60 ? messageToSend.substring(0, 60) + "..." : messageToSend,
      error: sendResult.error,
    };

    // Keep last 150 logs
    campaignState.logs = [logEntry, ...(campaignState.logs || [])].slice(0, 150);

    if (sendResult.success) {
      campaignState.messagesSent += 1;
      campaignState.hourlySentCount += 1;
      campaignState.dailySentCount += 1;
      campaignState.remainingQuota = Math.max(0, totalMax - campaignState.messagesSent);
      campaignState.groupMemberPointers[candidateGroupId] = (campaignState.groupMemberPointers[candidateGroupId] || 0) + 1;
      campaignState.contactedPhoneNumbers.push(candidatePhone);
      campaignState.consecutiveFailures = 0;
      campaignState.lastSuccessfulSend = new Date().toISOString();
      campaignState.lastError = undefined;

      console.log(`[Campaign] Successfully delivered message to ${candidatePhone}. Progress: ${campaignState.messagesSent}/${totalMax}`);
    } else {
      campaignState.messagesFailed += 1;
      campaignState.consecutiveFailures += 1;
      campaignState.lastError = sendResult.error || "Sending failed";

      console.error(`[Campaign] Send failed for ${candidatePhone}: ${sendResult.error}`);

      // Stop condition check for consecutive errors or restriction
      if (
        campaignState.consecutiveFailures >= 3 ||
        sendResult.error?.toLowerCase().includes("restricted") ||
        sendResult.error?.toLowerCase().includes("banned") ||
        sendResult.error?.toLowerCase().includes("rate limit")
      ) {
        await pauseCampaign("Campaign paused — sending requires attention. Error: " + (sendResult.error || "Multiple failures"));
      }
    }

    await saveCampaignState();
  } catch (error: any) {
    console.error("[Campaign] Unexpected error in campaign loop:", error);
    campaignState.consecutiveFailures += 1;
    if (campaignState.consecutiveFailures >= 3) {
      await pauseCampaign("Campaign paused — sending requires attention. Unexpected loop error.");
    }
  } finally {
    isExecutingTick = false;
  }
}

/**
 * Starts background campaign timer loop
 */
export function startCampaignEngine() {
  if (runnerTimer) {
    clearInterval(runnerTimer);
  }

  // Load state and resume if it was previously running
  loadCampaignState().then(() => {
    const delaySec = Math.max(15, campaignState.rateLimits?.delayBetweenMessagesSeconds || 20);
    runnerTimer = setInterval(processCampaignTick, delaySec * 1000);
    console.log(`[Campaign] Engine started with ${delaySec}s safe interval.`);
  });
}

/**
 * Generates promotional message variations using AI
 */
export async function generateMessageVariations(toolId?: string, topic?: string): Promise<string[]> {
  let toolInfo = "";
  if (toolId) {
    const tools = await getTools();
    const tool = tools.find((t: any) => t.id === toolId || t.name.toLowerCase() === toolId.toLowerCase());
    if (tool) {
      toolInfo = `Tool Name: ${tool.name}\nCategory: ${tool.category || 'AI Tools'}\nFeatures: ${(tool.features || []).join(", ")}\nPricing: ${tool.pricePkr ? `Rs. ${tool.pricePkr}/mo` : ''} ${tool.priceUsd ? `($${tool.priceUsd})` : ''}\nHighlights: ${(tool.sales_points || []).join(", ")}`;
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
    const variations = rawResult
      .split("---VAR---")
      .map((v) => v.replace(/^Variation\s*\d+:?/i, "").replace(/^["']|["']$/g, "").trim())
      .filter((v) => v.length > 10);

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

/**
 * Sets up Campaign REST API routes in Express
 */
export function setupCampaignRoutes(app: Express) {
  // Get campaign state
  app.get("/api/campaign/state", async (req, res) => {
    res.json({
      ...campaignState,
      whatsappStatus: getWhatsAppConnectionStatus(),
    });
  });

  // Get available groups from WhatsApp
  app.get("/api/campaign/groups", async (req, res) => {
    try {
      const groups = await fetchAllGroups();
      res.json(groups || []);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch groups" });
    }
  });

  // Update campaign configuration
  app.post("/api/campaign/update", async (req, res) => {
    try {
      const {
        name,
        targetGroups,
        allowedCountryCodes,
        rateLimits,
        messageVariations,
        toolId,
        topic,
      } = req.body;

      if (name !== undefined) campaignState.name = name;
      if (targetGroups !== undefined) campaignState.targetGroups = targetGroups;
      if (allowedCountryCodes !== undefined) campaignState.allowedCountryCodes = allowedCountryCodes;
      if (rateLimits !== undefined) {
        campaignState.rateLimits = {
          ...campaignState.rateLimits,
          ...rateLimits,
        };
        // Update remaining quota if total max changed
        campaignState.remainingQuota = Math.max(
          0,
          campaignState.rateLimits.messagesPerCampaign - campaignState.messagesSent
        );
      }
      if (messageVariations !== undefined) campaignState.messageVariations = messageVariations;
      if (toolId !== undefined) campaignState.toolId = toolId;
      if (topic !== undefined) campaignState.topic = topic;

      await saveCampaignState();
      res.json({ success: true, campaign: campaignState });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to update campaign" });
    }
  });

  // Start / Launch Campaign
  app.post("/api/campaign/start", async (req, res) => {
    try {
      if (getWhatsAppConnectionStatus() !== "connected") {
        return res.status(400).json({
          error: "Cannot start campaign: WhatsApp is disconnected. Connect WhatsApp first.",
        });
      }

      if (!campaignState.targetGroups || campaignState.targetGroups.length === 0) {
        return res.status(400).json({
          error: "Please select at least one target group.",
        });
      }

      campaignState.status = "running";
      campaignState.pauseReason = undefined;
      campaignState.consecutiveFailures = 0;
      await saveCampaignState();

      // Trigger immediate tick
      setTimeout(processCampaignTick, 500);

      res.json({ success: true, campaign: campaignState });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to start campaign" });
    }
  });

  // Pause Campaign
  app.post("/api/campaign/pause", async (req, res) => {
    await pauseCampaign("Campaign paused by user.");
    res.json({ success: true, campaign: campaignState });
  });

  // Resume Campaign
  app.post("/api/campaign/resume", async (req, res) => {
    if (getWhatsAppConnectionStatus() !== "connected") {
      return res.status(400).json({
        error: "Cannot resume campaign: WhatsApp is disconnected. Connect WhatsApp first.",
      });
    }

    campaignState.status = "running";
    campaignState.pauseReason = undefined;
    campaignState.consecutiveFailures = 0;
    await saveCampaignState();

    setTimeout(processCampaignTick, 500);
    res.json({ success: true, campaign: campaignState });
  });

  // Stop / Reset Campaign
  app.post("/api/campaign/stop", async (req, res) => {
    campaignState.status = "stopped";
    campaignState.pauseReason = undefined;
    await saveCampaignState();
    res.json({ success: true, campaign: campaignState });
  });

  // Reset Progress
  app.post("/api/campaign/reset-progress", async (req, res) => {
    campaignState.status = "idle";
    campaignState.pauseReason = undefined;
    campaignState.messagesSent = 0;
    campaignState.messagesFailed = 0;
    campaignState.currentGroupIndex = 0;
    campaignState.groupMemberPointers = {};
    campaignState.contactedPhoneNumbers = [];
    campaignState.remainingQuota = campaignState.rateLimits.messagesPerCampaign;
    campaignState.consecutiveFailures = 0;
    campaignState.lastSuccessfulSend = undefined;
    campaignState.lastError = undefined;
    await saveCampaignState();
    res.json({ success: true, campaign: campaignState });
  });

  // Generate AI Variations
  app.post("/api/campaign/generate-variations", async (req, res) => {
    try {
      const { toolId, topic } = req.body;
      const variations = await generateMessageVariations(toolId, topic);
      res.json({ success: true, variations });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to generate variations" });
    }
  });

  // Clear Logs
  app.post("/api/campaign/clear-logs", async (req, res) => {
    campaignState.logs = [];
    await saveCampaignState();
    res.json({ success: true });
  });
}
