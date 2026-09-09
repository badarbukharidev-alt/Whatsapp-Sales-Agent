import { Express } from "express";
import fs from "fs/promises";
import path from "path";
import { askAI } from "./ai.js";
import { getUserByToken } from "./auth.js";
import { toolService } from "./services/tool-service.js";
import { Tool } from "../types.js";

export const getToolsFile = () => path.join(process.cwd(), "data", "tools.json");
export const getToolImagesDir = () => path.join(process.cwd(), "data", "tool-images");

export interface ToolImage {
  id: string;
  filename: string;
  filepath: string;
  url: string;
  title?: string;
  description: string;
  toolId?: string;
  userId?: string;
  createdAt: string;
}

export async function getTools(userId?: string): Promise<Tool[]> {
  return toolService.getAccountTools(userId);
}

export async function saveTools(tools: Tool[]) {
  for (const t of tools) {
    await toolService.saveTool(t, t.userId || "usr_admin_badar");
  }
}

export function setupToolsRoutes(app: Express) {
  app.get("/api/tools", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const allTools = await toolService.getAccountTools(user ? user.id : undefined);
      
      // Admin sees all tools; regular user only sees their own tools
      if (!user || user.role === "admin") {
        return res.json(allTools);
      }
      
      const userTools = allTools.filter((t: any) => t.userId === user.id || !t.userId);
      res.json(userTools);
    } catch (error) {
      res.status(500).json({ error: "Failed to load tools" });
    }
  });

  // Upload an image for a tool
  app.post("/api/tools/upload-image", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const { filename, data, title, description, toolId } = req.body;
      if (!filename || !data || !description) {
        return res.status(400).json({ error: "Filename, image data, and description are required." });
      }

      const imagesDir = getToolImagesDir();
      await fs.mkdir(imagesDir, { recursive: true });

      // Clean file name
      const ext = path.extname(filename) || ".png";
      const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      const uniqueFilename = `${Date.now()}_${baseName}${ext}`;
      const targetPath = path.join(imagesDir, uniqueFilename);

      // Extract base64 buffer
      const base64Data = data.includes("base64,") ? data.split("base64,")[1] : data;
      const buffer = Buffer.from(base64Data, "base64");

      await fs.writeFile(targetPath, buffer);

      const imageObject: ToolImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        filename: uniqueFilename,
        filepath: path.join("data", "tool-images", uniqueFilename),
        url: `/tool-images/${uniqueFilename}`,
        title: title?.trim() || "",
        description: description.trim(),
        toolId: toolId || undefined,
        userId: user ? user.id : undefined,
        createdAt: new Date().toISOString(),
      };

      // If toolId provided, associate image directly to the tool
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
      
      const prompt = `Convert the following raw tool information into a clean structured JSON format for our software sales catalog. 
DO NOT OUTPUT ANY TEXT EXCEPT THE RAW JSON.
Format required:
{
  "name": "${name}",
  "category": "${category || 'AI Tools'}",
  "status": "active",
  "description": "2-sentence summary of what the tool does and what problem it solves.",
  "pricePkr": "1500",
  "priceUsd": "6",
  "aliases": ["${name.toLowerCase()}", "${name.toLowerCase().replace(/[^a-z0-9]/g, '')}"],
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
  "features": ["Feature 1", "Feature 2"],
  "sales_points": ["Sales point 1", "Sales point 2"],
  "use_cases": ["Use case 1", "Use case 2"],
  "requirements": ["Requirement 1"],
  "limitations": ["Limitation 1"],
  "how_to_use": "Step by step usage instructions",
  "faq": []
}

Raw Information:
${rawInfo}
`;
      
      const aiResponse = await askAI(prompt, undefined, user?.id);
      
      let parsedTool: any;
      try {
        const cleanedResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*?\}/);
        parsedTool = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleanedResponse);
      } catch (e) {
        console.error("Failed to parse LLM structured tool:", aiResponse);
        parsedTool = {
          name,
          category: category || "AI Tools",
          status: "active",
          description: rawInfo,
          pricePkr: "1200",
          priceUsd: "5",
          aliases: [name.toLowerCase(), name.toLowerCase().replace(/[^a-z0-9]/g, "")],
          keywords: [name.toLowerCase(), "software", "tool"],
          pricing: {
            min_negotiable_pkr: 1000,
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
          faq: []
        };
      }
      
      parsedTool.id = Date.now().toString();
      parsedTool.userId = user ? user.id : "usr_admin_badar";
      parsedTool.images = Array.isArray(images) ? images : [];
      parsedTool.category = parsedTool.category || category || "AI Tools";
      parsedTool.status = parsedTool.status || "active";
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

      // Check ownership
      if (user && user.role !== "admin" && existing.userId && existing.userId !== user.id) {
        return res.status(403).json({ error: "You can only edit your own tools." });
      }

      const saved = await toolService.saveTool({
        ...existing,
        ...updatedData,
        id,
        userId: existing.userId || (user ? user.id : "usr_admin_badar"),
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

      // Check ownership
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
