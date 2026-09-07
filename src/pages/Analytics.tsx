import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Bot, 
  Clock, 
  Wrench, 
  PieChart, 
  Calendar,
  Layers,
  ArrowUpRight
} from "lucide-react";
import { Customer, Tool } from "../types";

export default function Analytics() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d");

  const fetchData = async () => {
    try {
      const [custRes, toolsRes] = await Promise.all([
        axios.get("/api/customers"),
        axios.get("/api/tools"),
      ]);
      setCustomers(custRes.data || []);
      setTools(toolsRes.data || []);
    } catch (err) {
      console.error("Failed to load analytics data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Customer Status Breakdown
  const statusCounts = useMemo(() => {
    const counts = {
      "New Customer": 0,
      "Interested": 0,
      "Payment Pending": 0,
      "Payment Done": 0,
      "Order Complete": 0,
      "Follow Up": 0,
      "Important": 0,
    };

    customers.forEach((c) => {
      let s = (c.status || "New Customer") as keyof typeof counts;
      if (s === ("New" as any)) s = "New Customer";
      if (s === ("Buying" as any)) s = "Payment Pending";
      if (s === ("Customer" as any)) s = "Order Complete";
      if (s === ("Inactive" as any)) s = "Follow Up";

      if (counts[s] !== undefined) {
        counts[s]++;
      } else {
        counts["New Customer"]++;
      }
    });

    const total = customers.length || 1;
    return {
      counts,
      percentages: {
        "New Customer": Math.round((counts["New Customer"] / total) * 100),
        "Interested": Math.round((counts["Interested"] / total) * 100),
        "Payment Pending": Math.round((counts["Payment Pending"] / total) * 100),
        "Payment Done": Math.round((counts["Payment Done"] / total) * 100),
        "Order Complete": Math.round((counts["Order Complete"] / total) * 100),
        "Follow Up": Math.round((counts["Follow Up"] / total) * 100),
        "Important": Math.round((counts["Important"] / total) * 100),
      },
      total: customers.length,
    };
  }, [customers]);

  // Daily Message Volumes
  const dailyMetrics = useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 14;
    const points: Array<{ label: string; userMsgs: number; agentMsgs: number; total: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + 86400000;
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      let userMsgs = 0;
      let agentMsgs = 0;

      customers.forEach((c) => {
        if (c.messages) {
          c.messages.forEach((m) => {
            if (m.timestamp) {
              const t = new Date(m.timestamp).getTime();
              if (t >= startOfDay && t < endOfDay) {
                if (m.role === "agent") agentMsgs++;
                else userMsgs++;
              }
            }
          });
        }
      });

      points.push({
        label,
        userMsgs,
        agentMsgs,
        total: userMsgs + agentMsgs,
      });
    }

    return points;
  }, [customers, timeRange]);

  const maxDaily = useMemo(() => {
    return Math.max(...dailyMetrics.map(p => p.total), 5);
  }, [dailyMetrics]);

  // Tool Demand / Mentions
  const toolDemand = useMemo(() => {
    return tools.map((tool) => {
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
        name: tool.name,
        category: tool.category || "AI Tool",
        count,
      };
    }).sort((a, b) => b.count - a.count);
  }, [tools, customers]);

  // Aggregate stats
  const totals = useMemo(() => {
    let totalMessages = 0;
    let agentReplies = 0;

    customers.forEach((c) => {
      if (c.messages) {
        c.messages.forEach((m) => {
          totalMessages++;
          if (m.role === "agent") agentReplies++;
        });
      }
    });

    const aiRatio = totalMessages > 0 ? Math.round((agentReplies / totalMessages) * 100) : 0;

    return {
      totalCustomers: customers.length,
      totalMessages,
      agentReplies,
      aiRatio,
    };
  }, [customers]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 uppercase tracking-wider">
              Performance Insights
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Sales & Conversation Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Analyze customer conversion funnels, message volumes, and high-demand tools.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setTimeRange("7d")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              timeRange === "7d" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange("30d")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              timeRange === "30d" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange("all")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              timeRange === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* 4 Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Leads</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{totals.totalCustomers}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Tracked in memory</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Message Throughput</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{totals.totalMessages}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Sent & received</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Automated Replies</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{totals.agentReplies}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">By Fallback LLMs</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Automation Ratio</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{totals.aiRatio}%</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Autonomous resolution</p>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Message Volume Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Message Volume Trend</h3>
            <p className="text-xs text-slate-500 mb-6">Daily distribution of user messages vs agent responses</p>

            <div className="h-64 flex items-end gap-2 sm:gap-3 w-full border-b border-slate-100 pb-2">
              {dailyMetrics.map((p, idx) => {
                const heightPercent = Math.max((p.total / maxDaily) * 100, 4);
                const agentPercent = p.total > 0 ? (p.agentMsgs / p.total) * 100 : 0;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative h-full justify-end">
                    {/* Tooltip */}
                    <div className="absolute -top-12 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-md">
                      <div>{p.label}</div>
                      <div>Total: {p.total} (AI: {p.agentMsgs})</div>
                    </div>

                    <div className="w-full max-w-[28px] bg-slate-100 rounded-t-md overflow-hidden flex flex-col justify-end transition-all group-hover:bg-slate-200" style={{ height: `${heightPercent}%` }}>
                      <div 
                        className="w-full bg-emerald-500 rounded-t-md transition-all"
                        style={{ height: `${agentPercent}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-medium truncate w-full text-center">
                      {p.label.split(" ")[1]}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-3">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Agent Replies
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-200" />
                  Customer Inquiries
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Total period: {dailyMetrics.reduce((acc, curr) => acc + curr.total, 0)} msgs</span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Customer Pipeline Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Customer Pipeline</h3>
            <p className="text-xs text-slate-500 mb-4">Stage distribution across all leads</p>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    New Customer
                  </span>
                  <span>{statusCounts.counts["New Customer"]} ({statusCounts.percentages["New Customer"]}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${statusCounts.percentages["New Customer"]}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Interested
                  </span>
                  <span>{statusCounts.counts.Interested} ({statusCounts.percentages.Interested}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${statusCounts.percentages.Interested}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    Payment Pending
                  </span>
                  <span>{statusCounts.counts["Payment Pending"]} ({statusCounts.percentages["Payment Pending"]}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${statusCounts.percentages["Payment Pending"]}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    Payment Done
                  </span>
                  <span>{statusCounts.counts["Payment Done"]} ({statusCounts.percentages["Payment Done"]}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${statusCounts.percentages["Payment Done"]}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Order Complete
                  </span>
                  <span>{statusCounts.counts["Order Complete"]} ({statusCounts.percentages["Order Complete"]}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${statusCounts.percentages["Order Complete"]}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Follow Up
                  </span>
                  <span>{statusCounts.counts["Follow Up"]} ({statusCounts.percentages["Follow Up"]}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 rounded-full" style={{ width: `${statusCounts.percentages["Follow Up"]}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Important
                  </span>
                  <span>{statusCounts.counts.Important} ({statusCounts.percentages.Important}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${statusCounts.percentages.Important}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tool Demand Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-1">Tool Inquiries Ranking</h3>
        <p className="text-xs text-slate-500 mb-4">Calculated from AI conversation memory and product matches</p>

        {toolDemand.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No tools configured.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {toolDemand.map((tool, idx) => {
              const maxC = Math.max(...toolDemand.map(t => t.count), 1);
              const pct = Math.round((tool.count / maxC) * 100);

              return (
                <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 sm:w-1/3">
                    <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{tool.name}</span>
                      <span className="text-[10px] text-slate-500">{tool.category}</span>
                    </div>
                  </div>

                  <div className="flex-1 max-w-md">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(pct, tool.count > 0 ? 10 : 2)}%` }} />
                    </div>
                  </div>

                  <div className="text-xs font-bold text-slate-700 text-right sm:w-32">
                    {tool.count} conversations
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
