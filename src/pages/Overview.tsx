import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Users, 
  MessageSquare, 
  Bot, 
  Wrench, 
  Smartphone, 
  ArrowUpRight, 
  Clock, 
  Sparkles, 
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  Award,
  Zap
} from "lucide-react";
import { Customer, Tool, WhatsAppStatus, AgentSettings, UsageStats } from "../types";
import { formatRelativeTime } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

interface OverviewProps {
  whatsappStatus: WhatsAppStatus;
  agentSettings: AgentSettings | null;
}

export default function Overview({ whatsappStatus, agentSettings }: OverviewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartDays, setChartDays] = useState<7 | 30>(7);

  // Time & Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const currentDateStr = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  const loadData = async () => {
    try {
      const [custRes, toolsRes, usageRes] = await Promise.all([
        axios.get("/api/customers"),
        axios.get("/api/tools"),
        axios.get("/api/usage/stats").catch(() => ({ data: null })),
      ]);
      setCustomers(custRes.data || []);
      setTools(toolsRes.data || []);
      if (usageRes?.data) setUsageStats(usageRes.data);
    } catch (err) {
      console.error("Failed to fetch overview data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute Live Statistics from persistent usage and real customer directory data
  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const conversationThreads = customers.filter(c => c.messages && c.messages.length > 0);
    const totalConversations = conversationThreads.length;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let customerMessagesToday = 0;
    let customerAiRepliesToday = 0;
    let customerTotalMessages = 0;
    let customerTotalAiReplies = 0;

    customers.forEach((c) => {
      if (c.messages && Array.isArray(c.messages)) {
        c.messages.forEach((m) => {
          customerTotalMessages++;
          if (m.role === "agent") customerTotalAiReplies++;

          if (m.timestamp) {
            const msgDate = new Date(m.timestamp);
            if (msgDate >= startOfToday) {
              customerMessagesToday++;
              if (m.role === "agent") customerAiRepliesToday++;
            }
          }
        });
      }
    });

    // Ensure metrics are persistent: even if a user deletes customers from directory,
    // total AI replies and message counts will NEVER drop to zero
    const totalAiRepliesAllTime = Math.max(usageStats?.totalAiRepliesAllTime ?? 0, customerTotalAiReplies);
    const aiRepliesToday = Math.max(usageStats?.aiRepliesToday ?? 0, customerAiRepliesToday);
    const totalMessagesAllTime = Math.max(usageStats?.totalMessagesAllTime ?? 0, customerTotalMessages);
    const messagesToday = Math.max(usageStats?.messagesToday ?? 0, customerMessagesToday);

    const activeTools = tools.filter(t => t.status !== "inactive").length;

    return {
      totalCustomers,
      totalConversations,
      messagesToday,
      aiRepliesToday,
      totalMessagesAllTime,
      totalAiRepliesAllTime,
      activeTools,
      totalTools: tools.length,
    };
  }, [customers, tools, usageStats]);

  // Compute Activity Chart (7 vs 30 Days) with persistent daily metrics
  const activityData = useMemo(() => {
    const days = chartDays;
    const points: Array<{ dateLabel: string; messages: number; aiReplies: number; customers: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + 86400000;
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateKey = `${y}-${mo}-${day}`;

      let msgs = 0;
      let ai = 0;
      const activeCustomersSet = new Set<string>();

      customers.forEach((c) => {
        if (c.messages) {
          c.messages.forEach((m) => {
            if (m.timestamp) {
              const t = new Date(m.timestamp).getTime();
              if (t >= startOfDay && t < endOfDay) {
                msgs++;
                if (m.role === "agent") ai++;
                activeCustomersSet.add(c.phoneNumber);
              }
            }
          });
        }
      });

      // Merge with persistent daily logs if available
      const persistentAi = usageStats?.dailyAiReplies?.[dateKey] || 0;
      const persistentUser = usageStats?.dailyUserMessages?.[dateKey] || 0;
      const finalAi = Math.max(ai, persistentAi);
      const finalMsgs = Math.max(msgs, persistentAi + persistentUser);

      points.push({
        dateLabel: label,
        messages: finalMsgs,
        aiReplies: finalAi,
        customers: activeCustomersSet.size,
      });
    }

    return points;
  }, [customers, chartDays, usageStats]);

  const maxChartValue = useMemo(() => {
    const max = Math.max(...activityData.map(d => Math.max(d.messages, d.aiReplies, d.customers)), 5);
    return max;
  }, [activityData]);

  // Compute Top / Most Discussed Tools from conversation memory
  const topTools = useMemo(() => {
    if (tools.length === 0) return [];

    const toolCounts = tools.map((tool) => {
      const toolNameLower = tool.name.toLowerCase();
      const keywords = (tool.features || []).map(f => f.toLowerCase());
      let count = 0;

      customers.forEach((c) => {
        if (c.messages && c.messages.length > 0) {
          const mentioned = c.messages.some(m => {
            const content = (m.content || "").toLowerCase();
            return content.includes(toolNameLower) || keywords.some(k => k.length > 4 && content.includes(k));
          });
          if (mentioned) count++;
        }
      });

      return {
        ...tool,
        discussionCount: count,
      };
    });

    return toolCounts.sort((a, b) => b.discussionCount - a.discussionCount);
  }, [tools, customers]);

  // Recent Conversations List
  const recentConversations = useMemo(() => {
    const threads = customers
      .filter(c => c.messages && c.messages.length > 0)
      .map(c => {
        const lastMsg = c.messages![c.messages!.length - 1];
        return {
          customer: c,
          lastMessage: lastMsg?.content || "No messages",
          timestamp: lastMsg?.timestamp || c.lastActivity || new Date().toISOString(),
          status: c.status || "Interested",
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    return threads;
  }, [customers]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto w-full text-[var(--ink)]">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--panel-solid)] p-6 rounded-3xl border border-[var(--line)] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
              Live AI Sales Agent
            </span>
            <span className="text-xs text-[var(--muted)] font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {currentDateStr}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">
            {greeting}, {user?.name ? user.name.split(" ")[0] : "Sales Leader"}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
            Here's what's happening with your WhatsApp sales agent today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* User Plan Badge */}
          <div className="px-3 py-1.5 rounded-xl border bg-[var(--panel)] border-[var(--line)] text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            <span>{user?.plan || "Free"} Plan</span>
            <span className="text-[10px] text-[#10b981] font-black bg-[#10b981]/15 px-2 py-0.5 rounded border border-[#10b981]/30 flex items-center gap-1">
              <Bot className="w-3 h-3" />
              {user?.assignedLimits?.maxAiReplies ?? user?.assignedLimits?.conversionLimit ?? 30} AI Replies Limit
            </span>
          </div>

          {/* Admin Access Button (Admin Only) */}
          {user?.role === "admin" && (
            <button
              onClick={() => navigate("/admin")}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              title="Open Admin Console"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-200" />
              <span>Admin Console</span>
            </button>
          )}

          <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            whatsappStatus.status === "connected" 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" 
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
          }`}>
            <Smartphone className="w-4 h-4" />
            <span>{whatsappStatus.status === "connected" ? "WhatsApp Connected" : "WhatsApp Disconnected"}</span>
          </div>

          <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            agentSettings?.aiAgentEnabled 
              ? "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30" 
              : "bg-[var(--panel)] text-[var(--muted)] border-[var(--line)]"
          }`}>
            <Bot className="w-4 h-4" />
            <span>{agentSettings?.aiAgentEnabled ? "Agent Active" : "Agent Paused"}</span>
          </div>
        </div>
      </div>

      {/* Monthly AI Replies Quota Widget (Decoupled from Customer Directory) */}
      {(() => {
        const maxReplies = usageStats?.maxAiReplies ?? user?.assignedLimits?.maxAiReplies ?? user?.assignedLimits?.conversionLimit ?? 30;
        const usedReplies = usageStats?.aiRepliesThisMonth ?? 0;
        const isUnlimited = maxReplies >= 99999;
        const pct = isUnlimited ? 0 : Math.min(100, Math.round((usedReplies / maxReplies) * 100));
        const isLimitReached = !isUnlimited && usedReplies >= maxReplies;
        const remaining = Math.max(0, maxReplies - usedReplies);

        return (
          <div className={`p-5 rounded-2xl border transition-all ${
            isLimitReached 
              ? "bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-950 dark:text-rose-200" 
              : "bg-[var(--panel-solid)] border-[var(--line)] text-[var(--ink)]"
          } shadow-xs`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isLimitReached ? "bg-rose-600 text-white" : "bg-[#10b981] text-white shadow-xs"
                }`}>
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black tracking-tight text-[var(--ink)]">
                      Monthly AI Replies Quota:
                    </span>
                    <span className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                      isLimitReached ? "bg-rose-200 text-rose-800" : "bg-[#10b981]/20 text-[#10b981]"
                    }`}>
                      {isUnlimited ? "Unlimited" : `${usedReplies} / ${maxReplies} Used`}
                    </span>
                    {isLimitReached && (
                      <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-md animate-pulse">
                        Limit Reached • AI Replies Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {isLimitReached ? (
                      <span className="text-rose-700 dark:text-rose-400 font-medium">
                        You have exhausted your monthly limit of {maxReplies} AI replies. Customer directory deletions do not reset this quota. Please upgrade plan to continue automated replies.
                      </span>
                    ) : (
                      <span>
                        <strong className="text-[#10b981] font-bold">{remaining} AI replies remaining</strong> this month. Only outgoing AI responses count against this quota. Incoming customer chats are not deducted.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {!isUnlimited && (
                <div className="sm:w-48 w-full flex flex-col gap-1.5 self-center">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-[var(--muted)]">Usage Progress</span>
                    <span className={isLimitReached ? "text-rose-600" : "text-[#10b981]"}>{pct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-[var(--line)] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLimitReached ? "bg-rose-600" : pct > 80 ? "bg-amber-500" : "bg-[#10b981]"
                      }`}
                      style={{ width: `${Math.max(pct, usedReplies > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Total Customers */}
        <div className="bg-[var(--panel-solid)] p-5 rounded-2xl border border-[var(--line)] shadow-xs hover:border-[#10b981]/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Total Customers</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--ink)]">{stats.totalCustomers}</div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Recorded in Memory</p>
          </div>
        </div>

        {/* Card 2: Total Conversations */}
        <div className="bg-[var(--panel-solid)] p-5 rounded-2xl border border-[var(--line)] shadow-xs hover:border-[#10b981]/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Conversations</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--ink)]">{stats.totalConversations}</div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Active Chat Threads</p>
          </div>
        </div>

        {/* Card 3: Messages Today */}
        <div className="bg-[var(--panel-solid)] p-5 rounded-2xl border border-[var(--line)] shadow-xs hover:border-[#10b981]/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Messages Today</span>
            <div className="w-9 h-9 rounded-xl bg-[#10b981]/15 text-[#10b981] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--ink)]">{stats.messagesToday}</div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">{stats.totalMessagesAllTime} all-time</p>
          </div>
        </div>

        {/* Card 4: AI Replies Today */}
        <div className="bg-[var(--panel-solid)] p-5 rounded-2xl border border-[var(--line)] shadow-xs hover:border-[#10b981]/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">AI Replies Today</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--ink)]">{stats.aiRepliesToday}</div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">{stats.totalAiRepliesAllTime} all-time</p>
          </div>
        </div>

        {/* Card 5: Tools Active */}
        <div className="bg-[var(--panel-solid)] p-5 rounded-2xl border border-[var(--line)] shadow-xs hover:border-[#10b981]/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Tools Active</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--ink)]">
              {stats.activeTools} <span className="text-xs text-[var(--muted)] font-normal">/ {stats.totalTools}</span>
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Catalog Database</p>
          </div>
        </div>

        {/* Card 6: AI Agent Mode */}
        <div className="bg-[var(--panel-solid)] p-5 rounded-2xl border border-[var(--line)] shadow-xs hover:border-[#10b981]/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Agent Engine</span>
            <div className="w-9 h-9 rounded-xl bg-[#10b981]/15 text-[#10b981] flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-[#10b981] uppercase tracking-tight">
              {agentSettings?.aiAgentEnabled ? "Autonomous" : "Manual"}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              {agentSettings?.preferredApi ? agentSettings.preferredApi.toUpperCase() : "Gemini 2.5"} Active
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Activity Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Activity Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Conversation Activity</h3>
              <p className="text-xs text-slate-500">Real message throughput and customer engagement</p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                onClick={() => setChartDays(7)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  chartDays === 7 ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setChartDays(30)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  chartDays === 30 ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          {/* Clean Activity Bar Visualization */}
          <div className="flex-1 flex flex-col justify-end pt-4 pb-2">
            <div className="h-52 flex items-end gap-2 sm:gap-3 w-full border-b border-slate-100 pb-2">
              {activityData.map((d, i) => {
                const heightPercent = Math.max((d.messages / maxChartValue) * 100, 4);
                const aiHeightPercent = d.messages > 0 ? (d.aiReplies / d.messages) * 100 : 0;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative h-full justify-end">
                    {/* Tooltip */}
                    <div className="absolute -top-12 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-md">
                      <div>{d.dateLabel}</div>
                      <div>Total: {d.messages} | AI: {d.aiReplies}</div>
                    </div>

                    <div className="w-full max-w-[32px] bg-slate-100 rounded-t-md overflow-hidden flex flex-col justify-end transition-all group-hover:bg-slate-200" style={{ height: `${heightPercent}%` }}>
                      <div 
                        className="w-full bg-emerald-500 rounded-t-md transition-all"
                        style={{ height: `${aiHeightPercent}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-medium truncate w-full text-center">
                      {d.dateLabel.split(" ")[1]}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-3">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  AI Replies
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-200" />
                  User Inquiries
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Total {chartDays}d Volume: {activityData.reduce((acc, curr) => acc + curr.messages, 0)} msgs</span>
            </div>
          </div>
        </div>

        {/* Right Col: Quick Actions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Quick Actions</h3>
            <p className="text-xs text-slate-500 mb-4">Direct shortcuts to control your sales agent</p>

            <div className="space-y-2.5">
              <button
                onClick={() => navigate("/tools")}
                className="w-full p-3 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-200/70 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 block">Add New Tool</span>
                    <span className="text-[10px] text-slate-400">Teach AI your product catalog</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => navigate("/conversations")}
                className="w-full p-3 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-200/70 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 block">View Conversations</span>
                    <span className="text-[10px] text-slate-400">Inspect live customer dialogues</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => navigate("/customers")}
                className="w-full p-3 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-200/70 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 block">Customer Directory</span>
                    <span className="text-[10px] text-slate-400">View customer memory & leads</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => navigate("/settings")}
                className="w-full p-3 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200/70 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-purple-700 block">Agent Settings</span>
                    <span className="text-[10px] text-slate-400">Configure LLM & Roman Urdu</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => navigate("/connect")}
                className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/70 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shadow-xs">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">WhatsApp Gateway</span>
                    <span className="text-[10px] text-slate-400">Manage QR / Pairing codes</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section: Recent Conversations + Most Discussed Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Conversations</h3>
                <p className="text-xs text-slate-500">Live interactions with customer inquiries</p>
              </div>
              <button
                onClick={() => navigate("/conversations")}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline"
              >
                View All
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentConversations.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No conversations yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">When customers message your WhatsApp agent, they will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentConversations.map((thread, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate(`/conversations?phone=${thread.customer.phoneNumber}`)}
                    className="py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50 px-2 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                        {thread.customer.phoneNumber.slice(-2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {thread.customer.name ? `${thread.customer.name} (${thread.customer.phoneNumber})` : thread.customer.phoneNumber}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {thread.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          "{thread.lastMessage}"
                        </p>
                      </div>
                    </div>

                    <div className="text-[10px] font-medium text-slate-400 shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(thread.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Most Discussed Tools */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Most Discussed Tools</h3>
                <p className="text-xs text-slate-500">Calculated tool interest from customer chats</p>
              </div>
              <button
                onClick={() => navigate("/tools")}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline"
              >
                Manage Tools
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {topTools.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                <Wrench className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No tools configured</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Add tools to teach your AI agent about your digital products.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topTools.slice(0, 5).map((tool, idx) => {
                  const maxMentions = Math.max(...topTools.map(t => t.discussionCount), 1);
                  const pct = Math.round((tool.discussionCount / maxMentions) * 100);

                  return (
                    <div key={tool.id || idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{tool.name}</span>
                          {tool.category && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                              {tool.category}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-slate-600 text-xs">
                          {tool.discussionCount} {tool.discussionCount === 1 ? "conversation" : "conversations"}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${Math.max(pct, tool.discussionCount > 0 ? 8 : 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
