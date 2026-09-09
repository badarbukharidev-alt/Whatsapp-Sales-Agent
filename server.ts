import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
// Server components
import { setupWhatsAppRoutes } from "./src/server/whatsapp.js";
import { setupMemoryRoutes } from "./src/server/memory.js";
import { setupToolsRoutes } from "./src/server/tools.js";
import { setupSettingsRoutes } from "./src/server/settings.js";
import { setupCampaignRoutes, startCampaignEngine } from "./src/server/campaign.js";
import { setupAuthRoutes, getUsers } from "./src/server/auth.js";
import { setupDeepgramRoutes, startDeepgramBalanceMonitor } from "./src/server/deepgram.js";
import { setupListRoutes, getLists } from "./src/server/lists.js";
import { setupUsageRoutes } from "./src/server/usage.js";
import { setupDeploymentRoutes } from "./src/server/deployment.js";
import { startAgent } from "./src/server/agent.js";

async function initializeDataDirs() {
  const dataDir = path.join(process.cwd(), "data");
  const defaultsDir = path.join(process.cwd(), "data_defaults");
  const toolImagesDir = path.join(dataDir, "tool-images");
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(toolImagesDir, { recursive: true });
    
    // Seed missing files from data_defaults without ever overwriting existing user data
    try {
      const defaultFiles = await fs.readdir(defaultsDir);
      for (const file of defaultFiles) {
        const src = path.join(defaultsDir, file);
        const dest = path.join(dataDir, file);
        const stat = await fs.stat(src);
        if (stat.isFile()) {
          try {
            await fs.access(dest);
          } catch {
            await fs.copyFile(src, dest);
            console.log(`[Init] Seeded default file: ${file}`);
          }
        }
      }
    } catch {
      // defaults directory may be absent
    }

    // Smart sync for tools.json: ensure new tools and updated aliases/keywords are merged
    try {
      const defaultToolsPath = path.join(defaultsDir, "tools.json");
      const activeToolsPath = path.join(dataDir, "tools.json");
      
      const defaultToolsRaw = await fs.readFile(defaultToolsPath, "utf-8").catch(() => null);
      if (defaultToolsRaw) {
        const defaultTools = JSON.parse(defaultToolsRaw);
        let activeTools: any[] = [];
        try {
          const activeToolsRaw = await fs.readFile(activeToolsPath, "utf-8");
          activeTools = JSON.parse(activeToolsRaw);
        } catch {
          activeTools = [];
        }

        if (!Array.isArray(activeTools) || activeTools.length === 0) {
          await fs.writeFile(activeToolsPath, JSON.stringify(defaultTools, null, 2), "utf-8");
          console.log("[Init] Initialized active tools from defaults.");
        } else {
          let modified = false;
          for (const defTool of defaultTools) {
            const defName = (defTool.name || "").toLowerCase().trim();
            const existingIdx = activeTools.findIndex((t: any) => 
              (t.id && t.id === defTool.id) || 
              (t.name && t.name.toLowerCase().trim() === defName) ||
              (t.name && defName.includes(t.name.toLowerCase().trim())) ||
              (defName.includes(t.name?.toLowerCase().trim() || "___"))
            );

            if (existingIdx === -1) {
              activeTools.push(defTool);
              modified = true;
              console.log(`[Init] Merged new default tool into active catalog: ${defTool.name}`);
            } else {
              const existing = activeTools[existingIdx];
              // Merge aliases
              if (Array.isArray(defTool.aliases) && defTool.aliases.length > 0) {
                const existingAliases = new Set((existing.aliases || []).map((a: string) => a.toLowerCase().trim()));
                for (const alias of defTool.aliases) {
                  if (!existingAliases.has(alias.toLowerCase().trim())) {
                    existing.aliases = [...(existing.aliases || []), alias];
                    modified = true;
                  }
                }
              }
              // Merge keywords
              if (Array.isArray(defTool.keywords) && defTool.keywords.length > 0) {
                const existingKw = new Set((existing.keywords || []).map((k: string) => k.toLowerCase().trim()));
                for (const kw of defTool.keywords) {
                  if (!existingKw.has(kw.toLowerCase().trim())) {
                    existing.keywords = [...(existing.keywords || []), kw];
                    modified = true;
                  }
                }
              }
              // Merge pricing floors if missing
              if (defTool.pricing && (!existing.pricing || !existing.pricing.min_negotiable_pkr)) {
                existing.pricing = { ...(existing.pricing || {}), ...defTool.pricing };
                modified = true;
              }
              // Merge objection responses if missing
              if (defTool.objection_responses && !existing.objection_responses) {
                existing.objection_responses = defTool.objection_responses;
                modified = true;
              }
            }
          }

          if (modified) {
            await fs.writeFile(activeToolsPath, JSON.stringify(activeTools, null, 2), "utf-8");
            console.log("[Init] Synced active tools catalog with latest default definitions.");
          }
        }
      }
    } catch (toolSyncErr) {
      console.error("[Init] Error syncing tools catalog:", toolSyncErr);
    }

    // Initialize users & default lists
    await getUsers();
    await getLists();

    // Create initial JSON files if they don't exist
    const files = ["customers.json", "tools.json", "settings.json"];
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      try {
        await fs.access(filePath);
      } catch {
        const defaultContent = file === "settings.json" ? 
          JSON.stringify({ aiAgentEnabled: true, preferredApi: "gemini", defaultLLM: "Gemini", language: "Roman Urdu", autoReply: true, allowImageReplies: true, salesSkillEnabled: true, allowGroups: false, allowChannels: false }, null, 2) : 
          JSON.stringify(file === "tools.json" ? [] : {}, null, 2);
        await fs.writeFile(filePath, defaultContent);
      }
    }
  } catch (error) {
    console.error("Error initializing data directory:", error);
  }
}

async function startServer() {
  await initializeDataDirs();

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Static serving for tool images
  app.use('/tool-images', express.static(path.join(process.cwd(), 'data', 'tool-images')));

  // Setup API Routes
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
  
  // Start background agent loop & campaign engine & deepgram monitor
  startAgent();
  startCampaignEngine();
  startDeepgramBalanceMonitor();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/auth/**', '**/.git/**'],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      // Don't intercept API routes or assets that might fall through
      if (req.method !== 'GET') return next();
      const url = req.originalUrl;
      try {
        let template = await fs.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const rawPort = process.env.PORT;
  if (typeof (globalThis as any).PhusionPassenger !== "undefined" || rawPort === "passenger") {
    app.listen("passenger", () => {
      console.log("Server running via Phusion Passenger socket");
    });
  } else if (rawPort) {
    if (isNaN(Number(rawPort))) {
      // Unix domain socket or named pipe provided by Passenger / hosting
      app.listen(rawPort, () => {
        console.log(`Server running on socket: ${rawPort}`);
      });
    } else {
      app.listen(parseInt(rawPort, 10), "0.0.0.0", () => {
        console.log(`Server running on port ${rawPort}`);
      });
    }
  } else {
    // Default fallback: check if we are in Passenger environment
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
