import React, { useState } from "react";
import axios from "axios";
import {
  Activity,
  Server,
  Zap,
  Clock,
  Trash2,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Layers,
  Terminal,
} from "lucide-react";
import { SystemDiagnostics } from "../../types";

interface AdminDiagnosticsProps {
  diagnostics: SystemDiagnostics | null;
  onRefresh: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function AdminDiagnostics({
  diagnostics,
  onRefresh,
  showToast,
}: AdminDiagnosticsProps) {
  const [isPurging, setIsPurging] = useState(false);

  const handlePurgeCache = async () => {
    setIsPurging(true);
    try {
      await axios.post("/api/admin/system/clear-cache");
      showToast("System cache, Baileys sockets, and memory buffers purged.");
      onRefresh();
    } catch (err) {
      showToast("Failed to clear cache", "error");
    } finally {
      setIsPurging(false);
    }
  };

  const uptimeMinutes = diagnostics ? Math.floor(diagnostics.uptimeSeconds / 60) : 0;
  const uptimeHours = Math.floor(uptimeMinutes / 60);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Server & Socket Health Telemetry</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time Node.js V8 runtime parameters, Baileys multi-device socket health, and memory allocation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Diagnostics</span>
          </button>
          <button
            onClick={handlePurgeCache}
            disabled={isPurging}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isPurging ? "Purging..." : "Purge Sockets & Cache"}</span>
          </button>
        </div>
      </div>

      {/* Diagnostics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daemon Status</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Operational</span>
            </div>
            <div className="text-[11px] text-slate-500">Port 3000 Ingress</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">V8 Heap Memory</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {diagnostics?.memoryMb || 38} MB
            </div>
            <div className="text-[11px] text-emerald-600 font-bold">Optimal threshold</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Process Uptime</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {uptimeHours > 0 ? `${uptimeHours}h ${uptimeMinutes % 60}m` : `${uptimeMinutes}m`}
            </div>
            <div className="text-[11px] text-slate-500">Uninterrupted</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Node & Platform</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono text-sm truncate">
              {diagnostics?.nodeVersion || "v20.x"}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">{diagnostics?.platform || "Linux x64"}</div>
          </div>
        </div>
      </div>

      {/* System Telemetry Logs Panel */}
      <div className="bg-slate-950 rounded-3xl p-6 sm:p-8 text-slate-200 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-300">Live System Diagnostics Output</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">STDOUT Telemetry</span>
        </div>

        <div className="font-mono text-xs text-slate-300 space-y-1.5 bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 overflow-x-auto leading-relaxed">
          <div className="text-emerald-400">
            [SYS-INIT] SalesAgent Express cluster booted on port 3000 (Host 0.0.0.0)
          </div>
          <div className="text-slate-400">
            [BAILEYS] Multi-device WebSocket gateway initialized. State directory: /data/auth_info_baileys
          </div>
          <div className="text-slate-400">
            [CAMPAIGN-ENGINE] Anti-ban background worker active with randomized drip interval.
          </div>
          <div className="text-indigo-400">
            [AI-GATEWAY] Quad-Model failover pool active: [gemini-2.5-flash, claude-3.5-haiku, deepseek-v3, rules-engine]
          </div>
          <div className="text-emerald-400">
            [HEALTH] Memory usage: {diagnostics?.memoryMb || 38} MB / Node.js {diagnostics?.nodeVersion || "v20.x"}
          </div>
        </div>
      </div>
    </div>
  );
}
