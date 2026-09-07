import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Cpu,
  Sparkles,
  Zap,
  Sliders,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Clock,
  Layers,
  Save,
} from "lucide-react";
import { AgentSettings } from "../../types";

export default function AdminEngines() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [salesSkillEnabled, setSalesSkillEnabled] = useState(true);
  const [primaryEngine, setPrimaryEngine] = useState("gemini");
  const [enableFallback, setEnableFallback] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(600);
  const [typingDelayMin, setTypingDelayMin] = useState(2);
  const [typingDelayMax, setTypingDelayMax] = useState(6);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    axios.get("/api/settings")
      .then(res => {
        if (res.data) {
          setSettings(res.data);
          setSalesSkillEnabled(res.data.salesSkillEnabled !== false);
          if (res.data.preferredApi) setPrimaryEngine(res.data.preferredApi);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      const updated = {
        ...settings,
        preferredApi: primaryEngine,
        salesSkillEnabled,
      };
      await axios.put("/api/settings", updated);
      setSettings(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (e) {
      console.error("Failed to save engine config:", e);
      alert("Failed to save settings");
    }
  };

  const engineList = [
    {
      id: "gemini",
      name: "Google Gemini 2.5 Flash",
      status: "Operational",
      latency: "280ms",
      cost: "Optimized",
      desc: "Fastest response time for general Roman Urdu & English negotiation, tool inquiries, and objection handling.",
      recommendedFor: "General WhatsApp conversations and fast replies.",
    },
    {
      id: "claude-haiku",
      name: "Anthropic Claude 3.5 Haiku",
      status: "Operational",
      latency: "450ms",
      cost: "Standard",
      desc: "Superior nuanced conversational closing, objection handling, and enterprise tone adherence.",
      recommendedFor: "High-ticket sales and delicate customer negotiations.",
    },
    {
      id: "deepseek-v3",
      name: "DeepSeek V3 High Speed",
      status: "Operational",
      latency: "320ms",
      cost: "Ultra Low Cost",
      desc: "Exceptional cost efficiency for high-volume cold drip outreach campaigns and broadcast followups.",
      recommendedFor: "High-volume WhatsApp group drip campaigns.",
    },
    {
      id: "gptlogic",
      name: "Deterministic Catalog & Regex Rules",
      status: "Standby / Instant Fallback",
      latency: "5ms",
      cost: "Free (Local)",
      desc: "Offline instant lookup engine for tool pricing, payment account details, FAQs, and contact hours.",
      recommendedFor: "Zero-latency instantaneous fallback if cloud APIs experience rate limits.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">AI Model Gateway & Orchestration</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure default multi-LLM routing, failover fallbacks, simulated human typing delays, and anti-ban jitter.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaved ? "Saved Successfully!" : "Save Engine Config"}</span>
        </button>
      </div>

      {/* SALES CLOSER SKILL (SKILL.MD) ENGINE TOGGLE */}
      <div className="bg-white p-6 rounded-3xl border border-purple-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Sales Closer Skill Mode (SKILL.md)</h3>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                salesSkillEnabled
                  ? "bg-purple-100 text-purple-700"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {salesSkillEnabled ? "Active Closer Intelligence" : "Standard Direct Mode"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Activates the high-converting closing intelligence from SKILL.md across all connected WhatsApp chats (Progressive Discovery, Value Selling, Objection Handling, Pakistani Roman Urdu mirroring, and 1-Step Closing).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
          <span className="text-xs font-bold text-slate-600">
            {salesSkillEnabled ? "Skill Enabled" : "Skill Disabled"}
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={salesSkillEnabled}
              onChange={(e) => setSalesSkillEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {engineList.map((eng) => {
          const isSelected = primaryEngine === eng.id;
          return (
            <div
              key={eng.id}
              onClick={() => setPrimaryEngine(eng.id)}
              className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer shadow-xs ${
                isSelected
                  ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                      isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{eng.name}</h3>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> {eng.status} • {eng.latency}
                    </span>
                  </div>
                </div>

                <input
                  type="radio"
                  name="primaryEngine"
                  checked={isSelected}
                  onChange={() => setPrimaryEngine(eng.id)}
                  className="accent-emerald-600 w-4 h-4"
                />
              </div>

              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{eng.desc}</p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Recommended:</span>
                <span className="text-slate-700 font-bold truncate max-w-[200px]">
                  {eng.recommendedFor}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Parameters Configuration Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
          Orchestration Tuning & Anti-Ban Safeguards
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span>Creativity (Temperature)</span>
              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {temperature}
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <span className="text-[10px] text-slate-400 block">
              0.6 - 0.8 is optimal for natural sales negotiation without hallucinations.
            </span>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span>Max Response Length</span>
              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {maxTokens} tokens
              </span>
            </div>
            <input
              type="range"
              min="150"
              max="1200"
              step="50"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <span className="text-[10px] text-slate-400 block">
              Keeps WhatsApp responses crisp and split into human conversational bubbles.
            </span>
          </div>

          {/* Typing Delays */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span>Simulated Typing Delay</span>
              <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {typingDelayMin}s - {typingDelayMax}s
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="1"
                max="10"
                value={typingDelayMin}
                onChange={(e) => setTypingDelayMin(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold"
                placeholder="Min Sec"
              />
              <input
                type="number"
                min="2"
                max="20"
                value={typingDelayMax}
                onChange={(e) => setTypingDelayMax(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold"
                placeholder="Max Sec"
              />
            </div>
            <span className="text-[10px] text-slate-400 block">
              Randomized delay prevents WhatsApp spam heuristics from flagging your number.
            </span>
          </div>
        </div>

        {/* Automatic Failover Switch */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-800 block">
              Automatic Quad-Engine Failover Switch
            </span>
            <span className="text-[11px] text-slate-500">
              If the primary engine responds with error or latency exceeding 4,000ms, seamlessly fallback to secondary models.
            </span>
          </div>
          <input
            type="checkbox"
            checked={enableFallback}
            onChange={(e) => setEnableFallback(e.target.checked)}
            className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
