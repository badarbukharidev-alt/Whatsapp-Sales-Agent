import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Users,
  ShieldCheck,
  TrendingUp,
  Clock,
  Zap,
  Activity,
  ArrowRight,
  Layers,
  Cpu,
  ShieldAlert,
  Server,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { User, SystemDiagnostics, AgentSettings } from "../../types";

interface AdminDashboardProps {
  users: User[];
  diagnostics: SystemDiagnostics | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function AdminDashboard({
  users,
  diagnostics,
  loading,
  onRefresh,
}: AdminDashboardProps) {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [isUpdatingSkill, setIsUpdatingSkill] = useState(false);

  useEffect(() => {
    axios.get("/api/settings")
      .then(res => setSettings(res.data || null))
      .catch(() => {});
  }, []);

  const toggleSalesSkill = async () => {
    if (!settings) return;
    const nextVal = settings.salesSkillEnabled === false;
    setIsUpdatingSkill(true);
    try {
      const updated = { ...settings, salesSkillEnabled: nextVal };
      await axios.put("/api/settings", updated);
      setSettings(updated);
    } catch (e) {
      console.error("Failed to update sales skill:", e);
    } finally {
      setIsUpdatingSkill(false);
    }
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const adminUsers = users.filter((u) => u.role === "admin").length;
  const enterpriseUsers = users.filter((u) => u.plan === "Enterprise").length;
  const agencyUsers = users.filter((u) => u.plan === "Agency").length;
  const proUsers = users.filter((u) => u.plan === "Pro").length;
  const freeUsers = users.filter((u) => u.plan === "Free").length;

  // Monthly Revenue Calculation
  const estimatedRevenue = users.reduce((acc, u) => {
    if (u.status !== "active") return acc;
    if (u.plan === "Pro") return acc + 12000;
    if (u.plan === "Agency") return acc + 35000;
    if (u.plan === "Enterprise") return acc + 85000;
    return acc;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Master Governance Control Active</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            SalesAgent AI Ecosystem Status
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Multi-device WhatsApp Baileys daemons, user quotas, conversion tiers, and multi-LLM gateways are operating normally.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 relative z-10">
          <Link
            to="/admin/users"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Users className="w-4 h-4" /> Manage User Accounts <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/admin/plans"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2"
          >
            <Layers className="w-4 h-4" /> Configure Plan Quotas
          </Link>
          <Link
            to="/admin/engines"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2"
          >
            <Cpu className="w-4 h-4" /> AI Gateway Models
          </Link>
        </div>
      </div>

      {/* SALES CLOSER SKILL (SKILL.MD) MASTER ADMIN SWITCH */}
      <div className="bg-white p-6 rounded-3xl border border-purple-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Sales Closer Skill Mode (SKILL.md)</h3>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                settings?.salesSkillEnabled !== false
                  ? "bg-purple-100 text-purple-700"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {settings?.salesSkillEnabled !== false ? "Active Closer Skill" : "Standard Direct Mode"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              When enabled, the AI strictly follows the comprehensive closing framework from SKILL.md (Progressive Discovery, Value Selling, Objection Handling, Pakistani Roman Urdu mirroring, and 1-Step Closing).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
          <span className="text-xs font-bold text-slate-600">
            {settings?.salesSkillEnabled !== false ? "Skill Enabled" : "Skill Disabled"}
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              disabled={isUpdatingSkill}
              checked={settings?.salesSkillEnabled !== false}
              onChange={toggleSalesSkill}
              className="sr-only peer"
            />
            <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Accounts</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{totalUsers}</div>
            <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{activeUsers} active ({adminUsers} admins)</span>
            </div>
          </div>
        </div>

        {/* Monthly Run-Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated ARR</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              Rs. {estimatedRevenue.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Monthly SaaS subscription value</div>
          </div>
        </div>

        {/* Server Memory */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">V8 Heap Memory</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {diagnostics?.memoryMb || 38} MB
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Safe operating threshold</div>
          </div>
        </div>

        {/* Server Uptime */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Server Uptime</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {diagnostics ? `${Math.floor(diagnostics.uptimeSeconds / 60)}m` : "Active"}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Express cluster daemon</div>
          </div>
        </div>
      </div>

      {/* Subscription Breakdown & Quick Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Subscription Tiers Breakdown</h3>
            <Link to="/admin/plans" className="text-xs font-bold text-emerald-600 hover:text-emerald-800">
              View Matrix
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                  EN
                </div>
                <div>
                  <div className="text-xs font-bold text-purple-950">Enterprise Tiers</div>
                  <div className="text-[10px] text-purple-700">Unlimited conversions & full multi-LLM</div>
                </div>
              </div>
              <span className="text-sm font-black text-purple-950">{enterpriseUsers}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  AG
                </div>
                <div>
                  <div className="text-xs font-bold text-blue-950">Agency Tiers</div>
                  <div className="text-[10px] text-blue-700">1,500 conversions / 100 campaigns</div>
                </div>
              </div>
              <span className="text-sm font-black text-blue-950">{agencyUsers}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  PR
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-950">Pro Tiers</div>
                  <div className="text-[10px] text-emerald-700">250 conversions / 25 campaigns</div>
                </div>
              </div>
              <span className="text-sm font-black text-emerald-950">{proUsers}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-400 text-white flex items-center justify-center font-bold text-xs">
                  FR
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Free Tiers</div>
                  <div className="text-[10px] text-slate-500">20 conversions sandbox</div>
                </div>
              </div>
              <span className="text-sm font-black text-slate-800">{freeUsers}</span>
            </div>
          </div>
        </div>

        {/* AI Gateway Routing & Fallback Health */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">AI Model Gateways</h3>
            <Link to="/admin/engines" className="text-xs font-bold text-emerald-600 hover:text-emerald-800">
              Configure
            </Link>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Gemini 2.5 Flash</div>
                  <div className="text-[10px] text-slate-500">Primary sales conversation engine</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Anthropic Claude 3.5 Haiku</div>
                  <div className="text-[10px] text-slate-500">Complex negotiation & objection closer</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div>
                  <div className="text-xs font-bold text-slate-900">DeepSeek V3 High Speed</div>
                  <div className="text-[10px] text-slate-500">Fast low-latency Roman Urdu generator</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Deterministic Rules Fallback</div>
                  <div className="text-[10px] text-slate-500">Instant price list and catalog matches</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Standby</span>
            </div>
          </div>
        </div>

        {/* Quick Admin Actions */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Quick Governance Actions</h3>

          <div className="space-y-2.5">
            <Link
              to="/admin/users"
              className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/90 border border-emerald-200 text-emerald-950 transition-all text-xs font-bold"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Create New User Account</span>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-600" />
            </Link>

            <Link
              to="/admin/plans"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-all text-xs font-bold"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                <span>Adjust Conversion Caps</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              to="/admin/diagnostics"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-all text-xs font-bold"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-600" />
                <span>Inspect Server Health</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              to="/admin/audit"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-all text-xs font-bold"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-slate-600" />
                <span>Review Audit Log Stream</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
