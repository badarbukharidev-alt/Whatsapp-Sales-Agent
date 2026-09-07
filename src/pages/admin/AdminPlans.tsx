import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Layers,
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
  ShieldCheck,
  TrendingUp,
  Cpu,
  ArrowRight,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Check,
  RefreshCw,
  MessageSquare,
  Target,
  Bot,
  HelpCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PlanDefinitionUI } from "../../types";
import { useAuth } from "../../context/AuthContext";

export default function AdminPlans() {
  const { token: contextToken } = useAuth();
  const [plans, setPlans] = useState<PlanDefinitionUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<PlanDefinitionUI | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanDefinitionUI | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const token = contextToken || localStorage.getItem("salesagent_token") || localStorage.getItem("token") || "";

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/admin/plans");
      setPlans(res.data?.plans || []);
    } catch (err) {
      console.error("Failed to load plans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [token]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setIsSaving(true);
    try {
      const parsedAiReplies = typeof editingPlan.maxAiReplies === "number" 
        ? editingPlan.maxAiReplies 
        : (typeof editingPlan.conversionCap === "number" ? editingPlan.conversionCap : parseInt(String(editingPlan.maxAiReplies || editingPlan.conversionCap)) || 30);

      const payload = {
        ...editingPlan,
        maxAiReplies: parsedAiReplies,
        conversionCap: parsedAiReplies,
        maxConversations: typeof editingPlan.maxConversations === "number" ? editingPlan.maxConversations : parseInt(String(editingPlan.maxConversations)) || 1000,
        campaignsCap: typeof editingPlan.campaignsCap === "number" ? editingPlan.campaignsCap : (isNaN(Number(editingPlan.campaignsCap)) ? editingPlan.campaignsCap : parseInt(String(editingPlan.campaignsCap))),
        toolsCap: typeof editingPlan.toolsCap === "number" ? editingPlan.toolsCap : (isNaN(Number(editingPlan.toolsCap)) ? editingPlan.toolsCap : parseInt(String(editingPlan.toolsCap))),
        dailyAiQuota: (typeof editingPlan.maxConversations === "number" ? editingPlan.maxConversations * 10 : 50000),
      };

      const res = await axios.put(`/api/admin/plans/${editingPlan.id}`, payload);

      if (res.data?.success) {
        showToast(`Plan "${editingPlan.name}" updated successfully!`, "success");
        setEditingPlan(null);
        await fetchPlans();
      } else {
        showToast(`Failed to save plan: ${res.data?.error || "Server error"}`, "error");
      }
    } catch (err: any) {
      console.error("Failed to save plan:", err);
      showToast(`Error saving plan: ${err?.response?.data?.error || err?.message || "Network error"}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setIsSaving(true);
    try {
      const parsedAiReplies = typeof editingPlan.maxAiReplies === "number" 
        ? editingPlan.maxAiReplies 
        : (typeof editingPlan.conversionCap === "number" ? editingPlan.conversionCap : parseInt(String(editingPlan.maxAiReplies || editingPlan.conversionCap)) || 30);

      const payload = {
        ...editingPlan,
        maxAiReplies: parsedAiReplies,
        conversionCap: parsedAiReplies,
        maxConversations: typeof editingPlan.maxConversations === "number" ? editingPlan.maxConversations : parseInt(String(editingPlan.maxConversations)) || 1000,
        campaignsCap: typeof editingPlan.campaignsCap === "number" ? editingPlan.campaignsCap : parseInt(String(editingPlan.campaignsCap)) || 25,
        toolsCap: typeof editingPlan.toolsCap === "number" ? editingPlan.toolsCap : parseInt(String(editingPlan.toolsCap)) || 50,
        dailyAiQuota: 50000,
      };

      const res = await axios.post("/api/admin/plans", payload);

      if (res.data?.success) {
        showToast(`Created new plan: "${editingPlan.name}"`, "success");
        setShowAddModal(false);
        setEditingPlan(null);
        await fetchPlans();
      } else {
        showToast(`Failed to create plan: ${res.data?.error || "Server error"}`, "error");
      }
    } catch (err: any) {
      console.error("Failed to create plan:", err);
      showToast(`Error creating plan: ${err?.response?.data?.error || err?.message || "Network error"}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!planToDelete) return;
    const targetId = planToDelete.id;
    const targetName = planToDelete.name;
    setIsDeleting(true);

    try {
      setPlans((prev) => prev.filter((p) => p.id !== targetId));
      const res = await axios.delete(`/api/admin/plans/${targetId}`);
      if (res.data?.success) {
        showToast(`Deleted plan: "${targetName}"`, "success");
      } else {
        showToast(`Failed to delete plan: ${res.data?.error || "Unknown error"}`, "error");
      }
      setPlanToDelete(null);
      await fetchPlans();
    } catch (err: any) {
      console.error("Failed to delete plan:", err);
      showToast(`Failed to delete plan: ${err?.response?.data?.error || err?.message}`, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const openAddModal = () => {
    setEditingPlan({
      id: `custom-${Date.now().toString().slice(-4)}`,
      name: "Custom Growth Tier",
      price: "Rs. 20,000",
      period: "/month",
      color: "emerald",
      popular: false,
      description: "Tailored quota allocation for specialized marketing operations.",
      conversionCap: 500,
      maxAiReplies: 500,
      campaignsCap: 50,
      toolsCap: 100,
      dailyAiQuota: 50000,
      maxConversations: 2500,
      models: ["Gemini 2.5 Flash", "DeepSeek V3"],
      antiBan: true,
      branding: false,
      vipSupport: false,
      limits: {
        maxCampaigns: 50,
        maxTools: 100,
        dailyAiQuota: 50000,
        conversionLimit: 500,
        maxAiReplies: 500,
        maxConversations: 2500,
        allowedAiModels: ["gemini", "deepseek-v3"],
        hasAntiBanPriority: true,
        hasCustomBranding: false,
        hasPrioritySupport: false,
      },
    });
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toastMessage.type === "success"
              ? "bg-slate-900 text-white border border-slate-800"
              : "bg-rose-600 text-white shadow-rose-900/20"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-white shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Subscription Plans & Conversation Limits</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
              Conversation-Based SaaS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            All plans are configured based on <strong>Monthly Active WhatsApp Conversations (Chats)</strong> and <strong>Target Lead Conversions</strong>. AI agents process incoming messages smoothly without artificial daily token limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Custom Plan</span>
          </button>

          <Link
            to="/admin/users"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all w-fit"
          >
            <span>Assign to Users</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((p) => {
          const isDefault = ["free", "pro", "agency", "enterprise"].includes(p.id.toLowerCase());
          const displayConversations = p.maxConversations || p.limits?.maxConversations || (p.id.toLowerCase() === "free" ? 100 : p.id.toLowerCase() === "pro" ? 1000 : p.id.toLowerCase() === "agency" ? 5000 : "Unlimited");
          const displayAiReplies = p.maxAiReplies || (p.id.toLowerCase() === "free" ? 30 : p.conversionCap || 30);

          return (
            <div
              key={p.id}
              className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between shadow-xs ${
                p.popular
                  ? "border-emerald-300 ring-2 ring-emerald-500/20 shadow-md"
                  : "border-slate-200"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {p.name}
                  </span>
                  <div className="flex items-center gap-1">
                    {p.popular && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                        Most Popular
                      </span>
                    )}
                    <button
                      onClick={() => setEditingPlan({ ...p })}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                      title="Edit Plan Config"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!isDefault && (
                      <button
                        onClick={() => setPlanToDelete(p)}
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        title="Delete Custom Plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-black text-slate-950">
                    {p.price}
                    <span className="text-xs font-bold text-slate-400 ml-1 font-normal">
                      {p.period}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {p.description}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-2.5">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-purple-600" />
                      Monthly AI Replies:
                    </span>
                    <span className="text-purple-700 font-black">
                      {typeof displayAiReplies === "number" ? `${displayAiReplies.toLocaleString()} replies` : displayAiReplies}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      Monthly Conversations:
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {typeof displayConversations === "number" ? `${displayConversations.toLocaleString()} chats` : displayConversations}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Campaigns:</span>
                    <span className="text-slate-900">{p.campaignsCap}</span>
                  </div>

                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Tool Catalog:</span>
                    <span className="text-slate-900">{p.toolsCap} tools</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Included Features
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    {p.antiBan ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span>Priority Anti-Ban Delay Jitter</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    {p.branding ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span>Custom Whitelabel Branding</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    {p.vipSupport ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span>Dedicated SLA Support</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Authorized Models
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(p.models || []).map((m, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => setEditingPlan({ ...p })}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Configure</span>
                </button>
                <Link
                  to="/admin/users"
                  className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl flex items-center justify-center transition-all"
                  title="Assign to users"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Modal */}
      {(editingPlan !== null || showAddModal) && editingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {showAddModal ? "Create Custom Plan Tier" : `Edit Plan: ${editingPlan.name}`}
                </h3>
                <p className="text-xs text-slate-500">Configure pricing, monthly conversation allowances, and feature access.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPlan(null);
                  setShowAddModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={showAddModal ? handleCreatePlan : handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plan Name</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pricing Display</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.price}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price: e.target.value })}
                    placeholder="Rs. 15,000"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Billing Period</label>
                  <input
                    type="text"
                    value={editingPlan.period || "/month"}
                    onChange={(e) => setEditingPlan({ ...editingPlan, period: e.target.value })}
                    placeholder="/month"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Badge</label>
                  <label className="flex items-center gap-2 h-9 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPlan.popular || false}
                      onChange={(e) => setEditingPlan({ ...editingPlan, popular: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span>Highlight as "Most Popular"</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl"
                  placeholder="Short description of plan purpose"
                />
              </div>

              {/* Conversation Limits */}
              <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    Conversation & Conversion Quotas
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700">Per Billing Cycle</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Monthly Conversations (Chats)
                    </label>
                    <input
                      type="number"
                      value={typeof editingPlan.maxConversations === "number" ? editingPlan.maxConversations : 1000}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          maxConversations: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Total unique chats handled</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Monthly AI Replies Cap
                    </label>
                    <input
                      type="number"
                      value={typeof (editingPlan.maxAiReplies ?? editingPlan.conversionCap) === "number" ? (editingPlan.maxAiReplies ?? editingPlan.conversionCap) : (editingPlan.id?.toLowerCase() === "free" ? 30 : 250)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setEditingPlan({
                          ...editingPlan,
                          maxAiReplies: val,
                          conversionCap: val,
                        });
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Maximum AI replies per month (30 for Free plan)</p>
                  </div>
                </div>
              </div>

              {/* Campaign & Tool Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Active Campaigns Cap</label>
                  <input
                    type="number"
                    value={typeof editingPlan.campaignsCap === "number" ? editingPlan.campaignsCap : 25}
                    onChange={(e) => setEditingPlan({ ...editingPlan, campaignsCap: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tool Catalog Cap</label>
                  <input
                    type="number"
                    value={typeof editingPlan.toolsCap === "number" ? editingPlan.toolsCap : 50}
                    onChange={(e) => setEditingPlan({ ...editingPlan, toolsCap: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Feature Entitlements</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPlan.antiBan}
                      onChange={(e) => setEditingPlan({ ...editingPlan, antiBan: e.target.checked })}
                      className="accent-emerald-600 rounded cursor-pointer"
                    />
                    <span className="text-[11px] font-medium text-slate-700">Anti-Ban</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPlan.branding}
                      onChange={(e) => setEditingPlan({ ...editingPlan, branding: e.target.checked })}
                      className="accent-emerald-600 rounded cursor-pointer"
                    />
                    <span className="text-[11px] font-medium text-slate-700">Whitelabel</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPlan.vipSupport}
                      onChange={(e) => setEditingPlan({ ...editingPlan, vipSupport: e.target.checked })}
                      className="accent-emerald-600 rounded cursor-pointer"
                    />
                    <span className="text-[11px] font-medium text-slate-700">VIP Support</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setEditingPlan(null);
                    setShowAddModal(false);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "Saving..." : "Save Plan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Custom Plan Confirmation Modal */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Custom Plan</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Plan Name:</span>
                <span className="font-bold text-slate-900">{planToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Price:</span>
                <span className="font-bold text-slate-700">{planToDelete.price} {planToDelete.period}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Conversations:</span>
                <span className="font-bold text-emerald-700">{planToDelete.maxConversations || planToDelete.limits?.maxConversations || 1000}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Conversion Cap:</span>
                <span className="font-bold text-blue-700">{planToDelete.conversionCap}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete the plan tier <strong>"{planToDelete.name}"</strong>? Existing users on this plan will retain their assigned tier until manually reassigned.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPlanToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? "Deleting..." : "Delete Plan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
