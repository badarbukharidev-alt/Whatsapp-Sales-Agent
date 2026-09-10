import path from "path";
import { Tool } from "../../types.js";
import { JsonStore } from "../storage/json-store.js";
import { matchTool, ToolMatchResult } from "../tool-matcher.js";

const toolsFilePath = path.join(process.cwd(), "data", "tools.json");
const toolStore = new JsonStore<Tool[]>(toolsFilePath, []);

export class ToolService {
  private store: JsonStore<Tool[]>;
  private isDefaultStore: boolean;

  constructor(store: JsonStore<Tool[]>, isDefaultStore = false) {
    this.store = store;
    this.isDefaultStore = isDefaultStore;
  }

  /**
   * Retrieves tools belonging to the specified account.
   * Admin or unspecified gets all catalog tools.
   */
  async getAccountTools(userId?: string): Promise<Tool[]> {
    const allTools = await this.store.get();
    if (!Array.isArray(allTools)) return [];

    if (!userId || userId === "usr_admin_badar" || userId === "admin") {
      return allTools;
    }

    // Filter tools created by this user
    const userTools = allTools.filter((t: any) => t.userId === userId);
    if (userTools.length > 0) {
      return userTools;
    }

    // Fall back to shared catalog tools (tools without specific userId or active tools)
    return allTools.filter((t: any) => !t.userId || t.userId === "usr_admin_badar");
  }

  /**
   * Fetches specific tool details for the account.
   */
  async getToolDetails(toolId: string, userId?: string): Promise<Tool | null> {
    const tools = await this.getAccountTools(userId);
    return tools.find((t) => t.id === toolId) || null;
  }

  /**
   * ZERO HARDCODING: Dynamically builds a compact, 1-line-per-tool overview from stored catalog.
   */
  async getAccountToolSummary(userId?: string): Promise<string> {
    const tools = await this.getAccountTools(userId);
    const active = tools.filter((t) => t.status !== "inactive");
    if (active.length === 0) {
      return "No tools currently active in catalog.";
    }

    return active
      .map((t) => {
        const price = t.pricePkr ? `Rs. ${t.pricePkr}/mo` : t.priceUsd ? `$${t.priceUsd}/mo` : "Available";
        const briefDesc = (t.description || "").split(".")[0].trim();
        return `- ${t.name}: ${briefDesc} (${price})`;
      })
      .join("\n");
  }

  /**
   * Searches and retrieves relevant tool(s) based on customer query.
   * Searches ONLY within the account's active tools.
   */
  async searchRelevantTools(query: string, userId?: string, history?: string[]): Promise<ToolMatchResult> {
    const accountTools = await this.getAccountTools(userId);
    const activeTools = accountTools.filter((t) => t.status !== "inactive");
    return matchTool(query, activeTools, history, userId);
  }

  /**
   * Saves or updates a tool in the catalog.
   */
  async saveTool(toolData: Partial<Tool>, userId = "usr_admin_badar"): Promise<Tool> {
    const tools = await this.store.get();
    const existingIndex = toolData.id ? tools.findIndex((t) => t.id === toolData.id) : -1;

    let savedTool: Tool;
    if (existingIndex >= 0) {
      savedTool = {
        ...tools[existingIndex],
        ...toolData,
        id: tools[existingIndex].id,
      } as Tool;
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
        ...toolData,
      } as Tool;
      tools.push(savedTool);
    }

    await this.store.set(tools);

    // Sync to data_defaults for Git & deployment integrity only when using the primary store
    if (this.isDefaultStore && process.env.NODE_ENV !== "test") {
      try {
        const defaultsStore = new JsonStore<Tool[]>(path.join(process.cwd(), "data_defaults", "tools.json"), []);
        await defaultsStore.set(tools);
      } catch {}
    }

    return savedTool;
  }

  /**
   * Deletes a tool from the catalog.
   */
  async deleteTool(toolId: string, userId?: string): Promise<boolean> {
    const tools = await this.store.get();
    const filtered = tools.filter((t) => t.id !== toolId);
    if (filtered.length !== tools.length) {
      await this.store.set(filtered);
      if (this.isDefaultStore && process.env.NODE_ENV !== "test") {
        try {
          const defaultsStore = new JsonStore<Tool[]>(path.join(process.cwd(), "data_defaults", "tools.json"), []);
          await defaultsStore.set(filtered);
        } catch {}
      }
      return true;
    }
    return false;
  }
}

export const toolService = new ToolService(toolStore, true);
