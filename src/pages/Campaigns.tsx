import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Send,
  Play,
  Pause,
  Square,
  RefreshCw,
  Clock,
  Users,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Sliders,
  Sparkles,
  Layers,
  CheckCircle2,
  XCircle,
  Smartphone,
  ChevronRight,
  Plus,
  Trash2,
  Info,
  Check,
  Search,
  Filter,
  ArrowRight
} from "lucide-react";
import { 
  CampaignState, 
  CampaignTargetGroup, 
  CampaignRateLimits, 
  CampaignLogEntry,
  WhatsAppStatus,
  Tool
} from "../types";

interface WhatsAppGroupRaw {
  id: string;
  name: string;
  totalMembers: number;
  participants: Array<{ id: string; phoneNumber: string; admin?: string | null }>;
}

interface CampaignsProps {
  whatsappStatus: WhatsAppStatus;
}

const COMMON_PREFIXES = [
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+966", label: "Saudi (+966)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+1", label: "USA/Canada (+1)" },
];

export default function Campaigns({ whatsappStatus }: CampaignsProps) {
  const [campaign, setCampaign] = useState<CampaignState | null>(null);
  const [availableGroups, setAvailableGroups] = useState<WhatsAppGroupRaw[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [logFilter, setLogFilter] = useState<"ALL" | "Sent" | "Failed">("ALL");
  const [logSearch, setLogSearch] = useState("");
  const [customPrefixInput, setCustomPrefixInput] = useState("");
  const [newVariationText, setNewVariationText] = useState("");
  const [defaultMemberLimit, setDefaultMemberLimit] = useState(10);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch campaign state, groups, and tools
  const fetchCampaignData = async () => {
    try {
      const [campRes, groupsRes, toolsRes] = await Promise.all([
        axios.get("/api/campaign/state"),
        axios.get("/api/campaign/groups").catch(() => ({ data: [] })),
        axios.get("/api/tools").catch(() => ({ data: [] })),
      ]);

      setCampaign(campRes.data);
      setAvailableGroups(groupsRes.data || []);
      setTools(toolsRes.data || []);
    } catch (err) {
      console.error("Failed to load campaign data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignData();
    const interval = setInterval(fetchCampaignData, 3000);
    return () => clearInterval(interval);
  }, []);

  const showFeedback = (type: "success" | "error", text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Update campaign state helper
  const handleSaveConfig = async (partial: Partial<CampaignState>) => {
    if (!campaign) return;
    setSaving(true);
    try {
      const res = await axios.post("/api/campaign/update", partial);
      setCampaign(res.data.campaign);
      showFeedback("success", "Campaign configuration saved.");
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.error || "Failed to update configuration.");
    } finally {
      setSaving(false);
    }
  };

  // Controls: Start, Pause, Resume, Stop, Reset
  const handleStart = async () => {
    try {
      const res = await axios.post("/api/campaign/start");
      setCampaign(res.data.campaign);
      showFeedback("success", "Campaign started in Round-Robin mode!");
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.error || "Failed to start campaign.");
    }
  };

  const handlePause = async () => {
    try {
      const res = await axios.post("/api/campaign/pause");
      setCampaign(res.data.campaign);
      showFeedback("success", "Campaign paused.");
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.error || "Failed to pause campaign.");
    }
  };

  const handleResume = async () => {
    try {
      const res = await axios.post("/api/campaign/resume");
      setCampaign(res.data.campaign);
      showFeedback("success", "Campaign resumed!");
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.error || "Failed to resume campaign.");
    }
  };

  const handleStop = async () => {
    if (!confirm("Are you sure you want to stop this campaign?")) return;
    try {
      const res = await axios.post("/api/campaign/stop");
      setCampaign(res.data.campaign);
      showFeedback("success", "Campaign stopped.");
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.error || "Failed to stop campaign.");
    }
  };

  const handleResetProgress = async () => {
    if (!confirm("Reset all progress counters, sent counts, and pointers for this campaign?")) return;
    try {
      const res = await axios.post("/api/campaign/reset-progress");
      setCampaign(res.data.campaign);
      showFeedback("success", "Campaign progress reset to 0.");
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.error || "Failed to reset progress.");
    }
  };

  const handleClearLogs = async () => {
    try {
      await axios.post("/api/campaign/clear-logs");
      if (campaign) setCampaign({ ...campaign, logs: [] });
      showFeedback("success", "Campaign logs cleared.");
    } catch (err) {
      showFeedback("error", "Failed to clear logs.");
    }
  };

  // Group selection toggling
  const handleToggleGroup = (group: WhatsAppGroupRaw) => {
    if (!campaign) return;
    const current = campaign.targetGroups || [];
    const exists = current.find((g) => g.id === group.id);

    let updated: CampaignTargetGroup[];
    if (exists) {
      updated = current.filter((g) => g.id !== group.id);
    } else {
      updated = [
        ...current,
        {
          id: group.id,
          name: group.name,
          memberLimit: defaultMemberLimit,
          totalMembers: group.totalMembers,
        },
      ];
    }
    handleSaveConfig({ targetGroups: updated });
  };

  const handleUpdateGroupLimit = (groupId: string, newLimit: number) => {
    if (!campaign) return;
    const updated = (campaign.targetGroups || []).map((g) => {
      if (g.id === groupId) {
        return { ...g, memberLimit: Math.max(1, newLimit) };
      }
      return g;
    });
    handleSaveConfig({ targetGroups: updated });
  };

  // Country Prefix Filter Handlers
  const handleTogglePrefix = (code: string) => {
    if (!campaign) return;
    let current = [...(campaign.allowedCountryCodes || [])];

    if (code === "ALL") {
      current = current.includes("ALL") ? ["+92"] : ["ALL"];
    } else {
      current = current.filter((c) => c !== "ALL");
      if (current.includes(code)) {
        current = current.filter((c) => c !== code);
        if (current.length === 0) current = ["+92"];
      } else {
        current.push(code);
      }
    }
    handleSaveConfig({ allowedCountryCodes: current });
  };

  const handleAddCustomPrefix = () => {
    if (!customPrefixInput.trim() || !campaign) return;
    let formatted = customPrefixInput.trim();
    if (!formatted.startsWith("+")) formatted = `+${formatted}`;

    let current = [...(campaign.allowedCountryCodes || [])].filter((c) => c !== "ALL");
    if (!current.includes(formatted)) {
      current.push(formatted);
      handleSaveConfig({ allowedCountryCodes: current });
      setCustomPrefixInput("");
    }
  };

  // Rate Limits Handlers
  const handleRateLimitChange = (key: keyof CampaignRateLimits, val: number) => {
    if (!campaign) return;
    const newLimits = {
      ...campaign.rateLimits,
      [key]: Math.max(1, val),
    };
    handleSaveConfig({ rateLimits: newLimits });
  };

  // AI Variation Generator
  const handleGenerateAIVariations = async () => {
    if (!campaign) return;
    setGeneratingAI(true);
    try {
      const res = await axios.post("/api/campaign/generate-variations", {
        toolId: campaign.toolId,
        topic: campaign.topic,
      });
      if (res.data.variations) {
        setCampaign({
          ...campaign,
          messageVariations: res.data.variations,
        });
        showFeedback("success", "Generated 4 natural message variations using AI!");
      }
    } catch (err: any) {
      showFeedback("error", "Failed to generate AI variations.");
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleAddVariation = () => {
    if (!newVariationText.trim() || !campaign) return;
    const updated = [...(campaign.messageVariations || []), newVariationText.trim()];
    handleSaveConfig({ messageVariations: updated });
    setNewVariationText("");
  };

  const handleDeleteVariation = (index: number) => {
    if (!campaign) return;
    const updated = (campaign.messageVariations || []).filter((_, i) => i !== index);
    handleSaveConfig({ messageVariations: updated });
  };

  if (loading || !campaign) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mr-2" />
        <span>Loading Campaign Manager...</span>
      </div>
    );
  }

  // Calculate Round-Robin Queue Preview
  const selectedGroups = campaign.targetGroups || [];
  const totalMaxLimit = campaign.rateLimits.messagesPerCampaign || 30;
  const isRunning = campaign.status === "running";
  const isPaused = campaign.status === "paused";
  const isCompleted = campaign.status === "completed";
  const isStopped = campaign.status === "stopped";

  // Build Queue preview sequence
  const queueSequence: string[] = [];
  if (selectedGroups.length > 0) {
    for (let i = 0; i < Math.min(6, selectedGroups.length * 2); i++) {
      const g = selectedGroups[i % selectedGroups.length];
      queueSequence.push(g.name);
    }
  }

  // Filter logs
  const filteredLogs = (campaign.logs || []).filter((log) => {
    if (logFilter !== "ALL" && log.status !== logFilter) return false;
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      return (
        log.groupName?.toLowerCase().includes(q) ||
        log.targetNumber?.toLowerCase().includes(q) ||
        log.error?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50/70 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Campaign Targeting & Rate Limiting
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
              isRunning
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse"
                : isPaused
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : isCompleted
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}>
              {campaign.status}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Conservative Round-Robin outreach with country code filtering and automated stop safeguards.
          </p>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {!isRunning && !isPaused && (
            <button
              onClick={handleStart}
              disabled={selectedGroups.length === 0 || whatsappStatus.status !== "connected"}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              Start Campaign
            </button>
          )}

          {isRunning && (
            <button
              onClick={handlePause}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}

          {isPaused && (
            <button
              onClick={handleResume}
              disabled={whatsappStatus.status !== "connected"}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              Resume
            </button>
          )}

          {(isRunning || isPaused) && (
            <button
              onClick={handleStop}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          )}

          <button
            onClick={handleResetProgress}
            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="Reset progress counters"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Progress
          </button>
        </div>
      </div>

      {/* Action Toast / Feedback */}
      {actionMessage && (
        <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
          actionMessage.type === "success"
            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
            : "bg-rose-50 border border-rose-200 text-rose-800"
        }`}>
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* STOP CONDITION / PAUSE ATTENTION BANNER */}
      {isPaused && (
        <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs sm:text-sm font-bold text-amber-900">
              Campaign paused — sending requires attention.
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              {campaign.pauseReason || "The system paused sending automatically due to a rate limit or connection check."}
            </p>
          </div>
        </div>
      )}

      {/* CAMPAIGN COMPLETED / NO CONTACTS NOTICE BANNER */}
      {campaign.status === "completed" && (
        <div className="p-4 bg-indigo-50 border border-indigo-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-indigo-950">
                Campaign Cycle Completed
              </h4>
              <p className="text-xs text-indigo-800 leading-relaxed">
                {campaign.pauseReason || "All eligible group members matching your selected country prefix have been contacted or limit reached."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {!(campaign.allowedCountryCodes || []).includes("ALL") && (
              <button
                onClick={() => handleTogglePrefix("ALL")}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Allow All Countries
              </button>
            )}
            <button
              onClick={handleResetProgress}
              className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset & Run Again
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Disconnected Warning */}
      {whatsappStatus.status !== "connected" && (
        <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-xs sm:text-sm font-bold block">WhatsApp Socket is Disconnected</span>
              <span className="text-xs text-slate-300">
                Connect your WhatsApp account to enable automated campaign messaging.
              </span>
            </div>
          </div>
          <a
            href="/connect"
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold whitespace-nowrap transition-colors"
          >
            Connect Now
          </a>
        </div>
      )}

      {/* REAL-TIME PROGRESS & QUOTA METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Messages Sent Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Sent / Max Total</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{campaign.messagesSent}</span>
            <span className="text-xs text-slate-400 font-bold">/ {totalMaxLimit}</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full transition-all duration-500 rounded-full"
              style={{
                width: `${Math.min(100, (campaign.messagesSent / Math.max(1, totalMaxLimit)) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Hourly Rate Limit Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Hourly Window</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{campaign.hourlySentCount}</span>
            <span className="text-xs text-slate-400 font-bold">/ {campaign.rateLimits.messagesPerHour}/hr</span>
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            Resets automatically each rolling hour
          </span>
        </div>

        {/* Daily Rate Limit Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Daily Limit</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{campaign.dailySentCount}</span>
            <span className="text-xs text-slate-400 font-bold">/ {campaign.rateLimits.dailyLimit}/day</span>
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            Safe threshold for account longevity
          </span>
        </div>

        {/* Selected Groups & Quota Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Active Groups</span>
            <Users className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{selectedGroups.length}</span>
            <span className="text-xs text-slate-400 font-bold">Groups in queue</span>
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            Round-robin rotation active
          </span>
        </div>
      </div>

      {/* CAMPAIGN PREVIEW BOX (REQUIREMENT #10) */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
              Live Campaign Queue & Targeting Preview
            </h3>
          </div>
          <span className="text-xs text-emerald-400 font-mono font-bold">
            Safe Mode: Active
          </span>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Selected Groups</span>
            <p className="text-base font-black text-white">{selectedGroups.length} Groups</p>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Country Prefix</span>
            <p className="text-base font-black text-emerald-400">
              {(campaign.allowedCountryCodes || []).join(", ") || "+92"}
            </p>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Members per Group</span>
            <p className="text-base font-black text-white">{defaultMemberLimit} members avg</p>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Maximum</span>
            <p className="text-base font-black text-white">{totalMaxLimit} messages</p>
          </div>
        </div>

        {/* Round-Robin Queue Sequence Bar */}
        <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-emerald-400" />
            Queue Preview (Round-Robin Execution Order):
          </span>
          {queueSequence.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-200">
              {queueSequence.map((groupName, idx) => (
                <React.Fragment key={idx}>
                  <span className="px-2.5 py-1 bg-slate-800/90 border border-slate-700 rounded-lg text-emerald-300 font-bold truncate max-w-[140px]">
                    {groupName}
                  </span>
                  {idx < queueSequence.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              No target groups selected. Select groups below to activate the round-robin queue.
            </p>
          )}
        </div>
      </div>

      {/* MAIN TWO-COLUMN CONFIGURATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Target Groups Selection (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                1. Target WhatsApp Groups
              </h3>
              <p className="text-xs text-slate-500">
                Select multiple groups and configure maximum members to contact per group.
              </p>
            </div>

            {/* Default Quick Member Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Limit:</span>
              {[5, 10, 15, 25, 50].map((num) => (
                <button
                  key={num}
                  onClick={() => setDefaultMemberLimit(num)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                    defaultMemberLimit === num
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Search Groups Filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search participating groups..."
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Groups List */}
          {availableGroups.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">No Groups Found on Connected WhatsApp</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Make sure your connected WhatsApp account is joined to target groups.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {availableGroups
                .filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                .map((group) => {
                  const targetConfig = selectedGroups.find((tg) => tg.id === group.id);
                  const isChecked = !!targetConfig;
                  const currentSent = campaign.groupMemberPointers?.[group.id] || 0;

                  return (
                    <div
                      key={group.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isChecked
                          ? "bg-emerald-50/40 border-emerald-300/80 shadow-2xs"
                          : "bg-slate-50/70 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* Left: Checkbox + Group info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleGroup(group)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {group.name}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {group.totalMembers || group.participants?.length || 0} group members total
                          </span>
                        </div>
                      </div>

                      {/* Right: Per-group Limit & Sent Progress */}
                      {isChecked ? (
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">
                              Sent: {currentSent} / {targetConfig.memberLimit}
                            </span>
                            <span className="text-[11px] font-extrabold text-emerald-700">
                              {group.name} — {targetConfig.memberLimit} members
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={targetConfig.memberLimit || 10}
                              onChange={(e) =>
                                handleUpdateGroupLimit(group.id, parseInt(e.target.value) || 1)
                              }
                              className="w-14 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 text-center outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400 font-bold">max</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleToggleGroup(group)}
                          className="text-xs font-bold text-slate-500 hover:text-emerald-700 px-2 py-1 bg-white rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors shrink-0 self-end sm:self-auto"
                        >
                          + Select
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Country Prefix & Rate Limits (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 2. Country / Number Prefix Filter */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  2. Country / Prefix Filter
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Only contacts starting with allowed country calling codes will be processed.
              </p>
            </div>

            {/* Prefix Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleTogglePrefix("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  (campaign.allowedCountryCodes || []).includes("ALL")
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                All Countries
              </button>

              {COMMON_PREFIXES.map((prefix) => {
                const isSelected =
                  !(campaign.allowedCountryCodes || []).includes("ALL") &&
                  (campaign.allowedCountryCodes || []).includes(prefix.code);

                return (
                  <button
                    key={prefix.code}
                    onClick={() => handleTogglePrefix(prefix.code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {prefix.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Prefix Input */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                placeholder="Custom code (e.g. +90)"
                value={customPrefixInput}
                onChange={(e) => setCustomPrefixInput(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleAddCustomPrefix}
                className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* 3. Conservative Rate Limits */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  3. Conservative Rate Limits
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Strict server-side enforcement ensures accounts remain safe and within WhatsApp guidelines.
              </p>
            </div>

            <div className="space-y-3">
              {/* Messages Per Hour */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Messages per Hour</span>
                  <span className="text-[10px] text-slate-500">Pacing per sliding 60-min window</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={campaign.rateLimits.messagesPerHour || 10}
                    onChange={(e) =>
                      handleRateLimitChange("messagesPerHour", parseInt(e.target.value) || 1)
                    }
                    className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">/hr</span>
                </div>
              </div>

              {/* Messages Per Campaign (Total Limit) */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Messages per Campaign</span>
                  <span className="text-[10px] text-slate-500">Total maximum outreach ceiling</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={campaign.rateLimits.messagesPerCampaign || 30}
                    onChange={(e) =>
                      handleRateLimitChange("messagesPerCampaign", parseInt(e.target.value) || 1)
                    }
                    className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">total</span>
                </div>
              </div>

              {/* Daily Campaign Limit */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Daily Campaign Limit</span>
                  <span className="text-[10px] text-slate-500">Maximum sends across a 24-hour period</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={campaign.rateLimits.dailyLimit || 50}
                    onChange={(e) =>
                      handleRateLimitChange("dailyLimit", parseInt(e.target.value) || 1)
                    }
                    className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">/day</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI MESSAGE VARIATION GENERATOR (REQUIREMENT #8) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                4. AI Promotional Message Variations
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Rotates varied, natural Roman Urdu + English promotional texts to avoid repetitive messaging.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tool Selection for AI Context */}
            <select
              value={campaign.toolId || ""}
              onChange={(e) => handleSaveConfig({ toolId: e.target.value })}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="">Select Linked Tool (Optional)</option>
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.category || "Tool"})
                </option>
              ))}
            </select>

            <button
              onClick={handleGenerateAIVariations}
              disabled={generatingAI}
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Sparkles className={`w-3.5 h-3.5 ${generatingAI ? "animate-spin" : ""}`} />
              {generatingAI ? "Generating..." : "Generate with AI"}
            </button>
          </div>
        </div>

        {/* Variations List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(campaign.messageVariations || []).map((variation, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs text-slate-800 relative group"
            >
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block font-mono">
                  Variation #{idx + 1}
                </span>
                <p className="text-xs leading-relaxed text-slate-700 font-medium">
                  "{variation}"
                </p>
              </div>

              <button
                onClick={() => handleDeleteVariation(idx)}
                className="text-slate-400 hover:text-rose-600 p-1 transition-colors shrink-0"
                title="Remove variation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Custom Variation Input */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            placeholder="Add custom promotional variation in Roman Urdu..."
            value={newVariationText}
            onChange={(e) => setNewVariationText(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleAddVariation}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* CAMPAIGN LOGS (REQUIREMENT #11) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              5. Real-Time Campaign Transmission Log
            </h3>
            <p className="text-xs text-slate-500">
              Complete chronological audit trail with timestamp, group origin, target number, and status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
              {(["ALL", "Sent", "Failed"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLogFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    logFilter === filter
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <button
              onClick={handleClearLogs}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Logs Table */}
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
            No transmission logs recorded yet. Start the campaign to view live progress.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Group</th>
                  <th className="py-2.5 px-4">Target Number</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Details / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.map((log) => {
                  const date = new Date(log.timestamp);
                  const timeFormatted = date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {timeFormatted}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {log.groupName}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-700 font-semibold whitespace-nowrap">
                        {log.targetNumber}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === "Sent"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 max-w-xs truncate">
                        {log.error ? (
                          <span className="text-rose-600 font-medium">{log.error}</span>
                        ) : (
                          <span>{log.messageSnippet}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
