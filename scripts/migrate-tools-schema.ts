import fs from "fs";
import path from "path";
import { Tool } from "../src/types.js";

interface MigrationReportItem {
  name: string;
  pricePkr?: string;
  minNegotiablePkr: number;
  flag: string;
  aliases: string[];
  keywords: string[];
}

function generateDefaultAliases(name: string): string[] {
  const aliases = new Set<string>();
  const cleanName = name.trim();
  aliases.add(cleanName.toLowerCase());

  // Extract base name if contains punctuation like " – ", " - ", ":", "|"
  const baseNameMatch = cleanName.split(/[\–\-\:\|]/)[0].trim();
  if (baseNameMatch && baseNameMatch !== cleanName) {
    aliases.add(baseNameMatch.toLowerCase());
    aliases.add(baseNameMatch.toLowerCase().replace(/\s+/g, ""));
    aliases.add(baseNameMatch.toLowerCase().replace(/\s+/g, "-"));
  }

  // Remove spaces
  aliases.add(cleanName.toLowerCase().replace(/[\s\–\-\:\_]+/g, ""));
  // Normalized spaces
  aliases.add(cleanName.toLowerCase().replace(/[\–\-\:\_]+/g, " ").replace(/\s+/g, " ").trim());

  // Tool specific additions
  if (cleanName.toLowerCase().includes("voicedelta")) {
    aliases.add("voice delta");
    aliases.add("voicedelta");
    aliases.add("voice-delta");
  }
  if (cleanName.toLowerCase().includes("clipshield")) {
    aliases.add("clipshield");
    aliases.add("clip shield");
    aliases.add("clip-shield");
    aliases.add("copyright claim remover");
  }

  return Array.from(aliases).filter(Boolean);
}

function generateDefaultKeywords(tool: Tool): string[] {
  const kw = new Set<string>();
  const nameLower = tool.name.toLowerCase();

  if (nameLower.includes("voice") || tool.category?.toLowerCase().includes("voice")) {
    [
      "voice", "voices", "voiceover", "voice over", "ai voice",
      "voice cloning", "clone", "tts", "text to speech", "elevenlabs",
      "realistic voice", "audio generation"
    ].forEach(k => kw.add(k));
  }

  if (nameLower.includes("clip") || nameLower.includes("copyright") || nameLower.includes("video")) {
    [
      "copyright", "claim", "copyright claim", "bypass", "video downloader",
      "repurpose", "content id", "viral hooks", "reframing", "youtube videos",
      "claims remover"
    ].forEach(k => kw.add(k));
  }

  // Fallback if none matched
  if (kw.size === 0) {
    if (tool.category) kw.add(tool.category.toLowerCase());
    tool.name.toLowerCase().split(/\s+/).forEach(w => {
      if (w.length > 3) kw.add(w);
    });
  }

  return Array.from(kw);
}

function calculateFloor(priceStr?: string): number {
  const num = parseFloat(String(priceStr || "0").replace(/[^0-9.]/g, ""));
  if (!num || isNaN(num) || num <= 0) return 0;
  const raw85 = num * 0.85;
  // Round to nearest 50
  return Math.round(raw85 / 50) * 50;
}

export function migrateToolsFile(filePath: string): MigrationReportItem[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const tools: Tool[] = JSON.parse(raw);
  const report: MigrationReportItem[] = [];

  const migrated = tools.map((tool, index) => {
    // If tool lacks top-level pricePkr but has it in sales_points (e.g. ClipShield)
    if (!tool.pricePkr && tool.name.toLowerCase().includes("clip")) {
      tool.pricePkr = "1500";
      tool.priceUsd = "6";
    }

    const minFloor = tool.pricing?.min_negotiable_pkr && tool.pricing.min_negotiable_pkr > 0
      ? tool.pricing.min_negotiable_pkr
      : calculateFloor(tool.pricePkr);
    const aliases = tool.aliases && tool.aliases.length > 0
      ? tool.aliases
      : generateDefaultAliases(tool.name);
    const keywords = tool.keywords && tool.keywords.length > 0
      ? tool.keywords
      : generateDefaultKeywords(tool);

    const isVoice = tool.name.toLowerCase().includes("voice");
    const isClip = tool.name.toLowerCase().includes("clip");

    const defaultObjections = isVoice ? {
      too_expensive: "Explain Rs. 1,199/month comes down to just Rs. 40/day for 3,600+ AI voices & cloning vs $22+ on ElevenLabs.",
      need_time: "Offer to answer specific questions or share sample audio demos.",
      comparing_competitor: "Highlight all top models (ElevenLabs, OpenAI, Gemini) in one place with instant local PKR activation."
    } : isClip ? {
      too_expensive: "Highlight avoiding 1 copyright strike or wasted editing hours saves far more than the license price.",
      need_time: "Remind them they can test with 1 trial video first to verify compatibility.",
      comparing_competitor: "Emphasize 9-layer anti-Content ID protection with local offline processing."
    } : {
      too_expensive: "Explain the daily ROI and value compared to alternatives.",
      need_time: "Offer to clarify questions or demonstrate features without pressure.",
      comparing_competitor: "Highlight unique features and reliable local support."
    };

    const related = tool.related_tools && tool.related_tools.length > 0
      ? tool.related_tools
      : tools
          .filter(t => t.id !== tool.id)
          .map(t => t.name.split(/[\–\-\:\|]/)[0].trim());

    const updated: Tool = {
      ...tool,
      aliases,
      keywords,
      pricing: {
        min_negotiable_pkr: minFloor,
        min_negotiable_usd: tool.pricing?.min_negotiable_usd ?? (tool.priceUsd ? Math.round(Number(tool.priceUsd) * 0.85) : undefined),
        negotiation_notes: tool.pricing?.negotiation_notes || "Can offer min_negotiable_pkr only in exchange for immediate payment today or 2+ month plan.",
        ...(tool.pricing || {})
      },
      objection_responses: {
        ...defaultObjections,
        ...(tool.objection_responses || {})
      },
      related_tools: related,
      priority: tool.priority ?? (index + 1)
    };

    report.push({
      name: tool.name,
      pricePkr: tool.pricePkr,
      minNegotiablePkr: minFloor,
      flag: "// TODO: confirm floor",
      aliases,
      keywords
    });

    return updated;
  });

  fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2), "utf-8");
  return report;
}

function run() {
  console.log("==================================================");
  console.log("  MIGRATING data/tools.json TO RICHER SCHEMA");
  console.log("==================================================");

  const mainPath = path.resolve(process.cwd(), "data", "tools.json");
  const defaultsPath = path.resolve(process.cwd(), "data_defaults", "tools.json");

  const report = migrateToolsFile(mainPath);
  if (fs.existsSync(defaultsPath)) {
    migrateToolsFile(defaultsPath);
  }

  console.log("\n--- MIGRATION REPORT (HUMAN REVIEW REQUIRED) ---");
  console.table(report.map(r => ({
    Tool: r.name.substring(0, 30),
    "List Price": `Rs. ${r.pricePkr || 'N/A'}`,
    "Min Floor (PKR)": `Rs. ${r.minNegotiablePkr}`,
    Flag: r.flag,
    "Aliases Count": r.aliases.length,
    "Keywords Count": r.keywords.length
  })));

  console.log("\nDetailed floor notes:");
  report.forEach(r => {
    console.log(`- ${r.name}: List Rs. ${r.pricePkr} -> Floor Rs. ${r.minNegotiablePkr} [${r.flag}]`);
  });
  console.log("\nMigration completed successfully.\n");
}

run();
