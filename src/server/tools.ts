import { Express } from "express";
import fs from "fs/promises";
import path from "path";
import { askAI } from "./ai.js";
import { getUserByToken } from "./auth.js";

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

export async function getTools(userId?: string): Promise<any[]> {
  try {
    const data = await fs.readFile(getToolsFile(), "utf-8");
    const tools: any[] = JSON.parse(data);
    if (!userId) {
      return tools;
    }
    // Return tools belonging to this specific user (or global catalog tools if no userId)
    return tools.filter((t: any) => {
      if (t.userId) {
        return t.userId === userId;
      }
      // If tool has no userId (global catalog), allow for all sessions
      return true;
    });
  } catch (error) {
    return [];
  }
}

export async function saveTools(tools: any[]) {
  await fs.writeFile(getToolsFile(), JSON.stringify(tools, null, 2));
}

export function setupToolsRoutes(app: Express) {
  app.get("/api/tools", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const allTools = await getTools();
      
      // Admin sees all tools; regular user only sees their own tools
      if (!user || user.role === "admin") {
        return res.json(allTools);
      }
      
      const userTools = allTools.filter((t: any) => t.userId === user.id);
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
        let tools = await getTools();
        const toolIdx = tools.findIndex((t: any) => t.id === toolId);
        if (toolIdx !== -1) {
          // Verify user permission if not admin
          if (user && user.role !== "admin" && tools[toolIdx].userId && tools[toolIdx].userId !== user.id) {
            return res.status(403).json({ error: "Not authorized to modify this tool" });
          }
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
      const user = await getUserByToken(req.headers.authorization);
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
        const cleanedResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
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
      parsedTool.userId = user ? user.id : "usr_admin_badar";
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
      const user = await getUserByToken(req.headers.authorization);
      const { id } = req.params;
      const updatedData = req.body;
      let tools = await getTools();
      const index = tools.findIndex((t: any) => t.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Tool not found" });
      }

      // Check ownership
      if (user && user.role !== "admin" && tools[index].userId && tools[index].userId !== user.id) {
        return res.status(403).json({ error: "You can only edit your own tools." });
      }

      tools[index] = {
        ...tools[index],
        ...updatedData,
        id, // preserve ID
        userId: tools[index].userId || (user ? user.id : "usr_admin_badar"),
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
      const user = await getUserByToken(req.headers.authorization);
      let tools = await getTools();
      const existing = tools.find((t: any) => t.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Tool not found" });
      }

      // Check ownership
      if (user && user.role !== "admin" && existing.userId && existing.userId !== user.id) {
        return res.status(403).json({ error: "You can only delete your own tools." });
      }

      tools = tools.filter((t: any) => t.id !== req.params.id);
      await saveTools(tools);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tool" });
    }
  });
}
