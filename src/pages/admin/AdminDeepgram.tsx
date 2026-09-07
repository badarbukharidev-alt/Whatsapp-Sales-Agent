import React, { useState, useEffect } from "react";
import {
  Mic,
  Plus,
  RefreshCw,
  Sliders,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Layers,
  Clock,
  Key,
  Shield,
  Trash2,
  Edit2,
  Volume2,
  Sparkles,
  ArrowUpDown,
  DollarSign,
  Zap,
  Check,
  X,
  FileAudio,
  Radio,
  ExternalLink,
} from "lucide-react";
import { DeepgramAccountUI, DeepgramStats, DeepgramConfigUI, DeepgramUsageLogUI } from "../../types";

export default function AdminDeepgram() {
  const [stats, setStats] = useState<DeepgramStats | null>(null);
  const [accounts, setAccounts] = useState<DeepgramAccountUI[]>([]);
  const [config, setConfig] = useState<DeepgramConfigUI | null>(null);
  const [logs, setLogs] = useState<DeepgramUsageLogUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"accounts" | "tester" | "logs" | "settings">("accounts");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<DeepgramAccountUI | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<DeepgramAccountUI | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: "",
    projectId: "",
    apiKey: "",
    priority: 1,
    enabled: true,
  });

  // Action / Test state
  const [testingAccId, setTestingAccId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string; balance?: number } | null>(null);

  // Playground tester state
  const [sampleUrl, setSampleUrl] = useState("https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav");
  const [testTranscribeLoading, setTestTranscribeLoading] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<any | null>(null);

  const token = localStorage.getItem("salesagent_token") || localStorage.getItem("token") || "";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, accsRes, cfgRes, logsRes] = await Promise.all([
        fetch("/api/admin/deepgram/stats", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/deepgram/accounts", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/deepgram/config", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/deepgram/logs", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (accsRes.ok) setAccounts(await accsRes.json());
      if (cfgRes.ok) setConfig(await cfgRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (err) {
      console.error("Failed to load Deepgram data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/deepgram/refresh-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("Refreshed all Deepgram project balances.");
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to refresh balances:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTestConnection = async (accId: string) => {
    setTestingAccId(accId);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/deepgram/accounts/${accId}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTestResult({
        id: accId,
        success: data.success,
        message: data.message || (data.success ? "Deepgram connection successful." : "Connection failed."),
        balance: data.balance,
      });
      showToast(data.success ? "Deepgram connection test successful!" : "Deepgram connection test failed.");
      await fetchData();
    } catch (err: any) {
      setTestResult({
        id: accId,
        success: false,
        message: err.message || "Network error testing connection.",
      });
    } finally {
      setTestingAccId(null);
    }
  };

  const handleRefreshSingle = async (accId: string) => {
    setTestingAccId(accId);
    try {
      const res = await fetch(`/api/admin/deepgram/accounts/${accId}/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("Account balance refreshed.");
      }
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setTestingAccId(null);
    }
  };

  const handleToggleEnabled = async (acc: DeepgramAccountUI) => {
    try {
      const nextStatus = !acc.enabled;
      // Optimistic update
      setAccounts((prev) =>
        prev.map((a) => (a.id === acc.id ? { ...a, enabled: nextStatus } : a))
      );

      await fetch(`/api/admin/deepgram/accounts/${acc.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: nextStatus }),
      });
      showToast(`${acc.name} is now ${nextStatus ? "enabled" : "disabled"}.`);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;
    const targetId = accountToDelete.id;
    const targetName = accountToDelete.name;
    setIsDeleting(true);

    try {
      // Optimistic update
      setAccounts((prev) => prev.filter((a) => a.id !== targetId));

      const res = await fetch(`/api/admin/deepgram/accounts/${targetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        showToast(`Account "${targetName}" deleted successfully.`);
      } else {
        const data = await res.json();
        showToast(`Failed to delete account: ${data.error || "Unknown error"}`);
      }

      setAccountToDelete(null);
      await fetchData();
    } catch (err: any) {
      console.error("Error deleting account:", err);
      showToast(`Error deleting account: ${err?.message || "Network failure"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenAddModal = () => {
    setFormData({
      name: "",
      projectId: "",
      apiKey: "",
      priority: accounts.length + 1,
      enabled: true,
    });
    setEditingAccount(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (acc: DeepgramAccountUI) => {
    setEditingAccount(acc);
    setFormData({
      name: acc.name,
      projectId: acc.projectId,
      apiKey: "", // leave empty to keep existing secure key
      priority: acc.priority,
      enabled: acc.enabled,
    });
    setShowAddModal(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await fetch(`/api/admin/deepgram/accounts/${editingAccount.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch("/api/admin/deepgram/accounts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });
      }
      setShowAddModal(false);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    try {
      await fetch("/api/admin/deepgram/config", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      setShowConfigModal(false);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestTranscribe = async () => {
    setTestTranscribeLoading(true);
    setPlaygroundResult(null);
    try {
      const res = await fetch("/api/admin/deepgram/test-transcribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sampleUrl }),
      });
      const data = await res.json();
      setPlaygroundResult(data);
    } catch (err: any) {
      setPlaygroundResult({ success: false, error: err.message });
    } finally {
      setTestTranscribeLoading(false);
    }
  };

  const getStatusBadge = (status: DeepgramAccountUI["status"]) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ACTIVE
          </span>
        );
      case "LOW_BALANCE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            LOW BALANCE
          </span>
        );
      case "EXHAUSTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-500" />
            EXHAUSTED
          </span>
        );
      case "ERROR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            <X className="w-3 h-3 text-red-500" />
            ERROR
          </span>
        );
      case "DISABLED":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            DISABLED
          </span>
        );
    }
  };

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return "Never";
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 45) return "Just now";
    if (diffSec < 90) return "1 min ago";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Deepgram Multi-Account Transcription</h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 tracking-wider">
                NOVA-3 ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Centralized speech-to-text cluster for WhatsApp voice messages with balance-aware multi-project failover, live balance telemetry, and dynamic tool knowledge keyterms.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Query official Deepgram balance API for all accounts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh Balances"}</span>
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Routing Engine</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Deepgram Project</span>
          </button>
        </div>
      </div>

      {/* Aggregate Balance & Cluster Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Available Balance */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-3xl shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-10 pointer-events-none">
            <DollarSign className="w-32 h-32" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider block">
              Total Available Balance
            </span>
            <div className="text-2xl lg:text-3xl font-black mt-1">
              ${stats ? stats.totalBalance.toFixed(2) : "0.00"} <span className="text-sm font-bold text-emerald-200">USD</span>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-emerald-100 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Calculated from live API responses</span>
          </div>
        </div>

        {/* Active Accounts */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Configured Accounts
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {stats?.activeAccountsCount || 0}{" "}
              <span className="text-xs font-bold text-slate-500">Active / {accounts.length} Total</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-bold block mt-0.5">
              Multi-project pool ready
            </span>
          </div>
        </div>

        {/* Today's Requests */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Today's Requests
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {stats?.todayRequests || 0}
            </div>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              {stats?.todaySuccessful || 0} successful transcripts
            </span>
          </div>
        </div>

        {/* Today's Audio Minutes */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Today's Audio
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {stats?.todayAudioMinutes || "0.0"}{" "}
              <span className="text-xs font-bold text-slate-500">min</span>
            </div>
            <span className="text-[11px] text-purple-600 font-bold block mt-0.5">
              WhatsApp voice stream
            </span>
          </div>
        </div>

        {/* Failed Requests */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Failed Requests
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {stats?.todayFailed || 0}
            </div>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              Auto-failover recovered
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "accounts"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Configured Projects ({accounts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("tester")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "tester"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Router Playground & Test</span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "logs"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Transcription Audit Trail ({logs.length})</span>
        </button>
      </div>

      {/* Active Tab: Accounts Grid */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          {/* Active Strategy Ribbon */}
          <div className="bg-slate-900 text-white px-5 py-3.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
              <div className="space-x-1">
                <span className="text-slate-400">Router Strategy:</span>
                <span className="font-black text-emerald-400 uppercase">
                  {config?.rotationMode === "balance_aware"
                    ? "Balance Aware + Priority"
                    : config?.rotationMode === "priority"
                    ? "Priority Order"
                    : "Round Robin"}
                </span>
                <span className="text-slate-400 ml-2">| Low Balance Threshold:</span>
                <span className="font-bold text-amber-300">${config?.lowBalanceThreshold.toFixed(2)} USD</span>
              </div>
            </div>
            <div className="text-slate-400 flex items-center gap-2">
              <span className="text-[11px]">Dynamic Tool Knowledge Keyterms: <strong>Enabled</strong></span>
            </div>
          </div>

          {/* Accounts List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {accounts.map((acc) => {
              const isTestingThis = testingAccId === acc.id;
              const hasTestFeedback = testResult && testResult.id === acc.id;

              return (
                <div
                  key={acc.id}
                  className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between shadow-xs ${
                    acc.enabled
                      ? acc.status === "ACTIVE"
                        ? "border-emerald-200 hover:border-emerald-300"
                        : acc.status === "LOW_BALANCE"
                        ? "border-amber-200"
                        : "border-slate-200"
                      : "border-slate-200 opacity-75 bg-slate-50/50"
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header with Name & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900">{acc.name}</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                            Priority #{acc.priority}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            PID: {acc.maskedProjectId}
                          </span>
                        </div>
                      </div>

                      <div>{getStatusBadge(acc.status)}</div>
                    </div>

                    {/* Balance Banner */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Current Balance
                        </span>
                        <div className="text-lg font-black text-slate-900 mt-0.5">
                          ${acc.balance.toFixed(2)}{" "}
                          <span className="text-xs font-bold text-slate-500">{acc.currency || "USD"}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-medium text-slate-400 block">Last Checked</span>
                        <span className="text-xs font-bold text-slate-700">
                          {formatRelativeTime(acc.lastChecked)}
                        </span>
                      </div>
                    </div>

                    {/* API Key info */}
                    <div className="text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Key className="w-3 h-3 text-slate-400" />
                          API Key
                        </span>
                        <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          {acc.maskedApiKey}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Total Processed</span>
                        <span className="font-bold text-slate-800">
                          {acc.totalRequests || 0} req ({(acc.totalAudioDurationSec / 60).toFixed(1)} min)
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Success / Failed</span>
                        <span className="font-medium text-slate-800">
                          <span className="text-emerald-600 font-bold">{acc.successfulRequests || 0}</span> /{" "}
                          <span className="text-rose-600 font-bold">{acc.failedRequests || 0}</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Last Successful</span>
                        <span className="text-slate-700 font-medium text-[11px]">
                          {formatRelativeTime(acc.lastSuccessfulRequest)}
                        </span>
                      </div>
                    </div>

                    {/* Last Error Notice if any */}
                    {acc.lastError && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{acc.lastError}</span>
                      </div>
                    )}

                    {/* Test result feedback banner */}
                    {hasTestFeedback && (
                      <div
                        className={`p-2.5 rounded-xl text-[11px] flex items-center justify-between ${
                          testResult.success
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                            : "bg-rose-50 border border-rose-200 text-rose-800"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {testResult.success ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          )}
                          <span>{testResult.message}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTestConnection(acc.id)}
                        disabled={isTestingThis}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Test Deepgram Project API connection & balance"
                      >
                        <Zap className="w-3 h-3" />
                        <span>{isTestingThis ? "Testing..." : "Test Connection"}</span>
                      </button>

                      <button
                        onClick={() => handleRefreshSingle(acc.id)}
                        disabled={isTestingThis}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                        title="Refresh balance"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTestingThis ? "animate-spin" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleEnabled(acc)}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          acc.enabled
                            ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {acc.enabled ? "Disable" : "Enable"}
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(acc)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                        title="Edit Project"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setAccountToDelete(acc)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Tab: Router Playground & Live Transcription Test */}
      {activeTab === "tester" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Live Router & Speech-to-Text Playground</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify that the centralized <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">transcribeAudio()</code> router automatically routes, authenticates, and transcribes voice audio with active Deepgram project credentials.
            </p>
          </div>

          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Audio Sample Source URL (WAV / OGG / MP3)
              </label>
              <input
                type="text"
                value={sampleUrl}
                onChange={(e) => setSampleUrl(e.target.value)}
                placeholder="https://static.deepgram.com/examples/..."
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <button
              onClick={handleTestTranscribe}
              disabled={testTranscribeLoading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{testTranscribeLoading ? "Transcribing via Router..." : "Test Router Transcription"}</span>
            </button>
          </div>

          {/* Playground Result Display */}
          {playgroundResult && (
            <div
              className={`p-5 rounded-2xl border space-y-3 ${
                playgroundResult.success
                  ? "bg-emerald-50/50 border-emerald-200 text-slate-800"
                  : "bg-rose-50/50 border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  {playgroundResult.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-900 font-extrabold">Transcription Success</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span className="text-rose-900 font-extrabold">Transcription Failed</span>
                    </>
                  )}
                </span>

                {playgroundResult.providerUsed && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    Routed to: <strong>{playgroundResult.providerUsed}</strong>
                  </span>
                )}
              </div>

              {playgroundResult.success ? (
                <div className="space-y-2 bg-white p-4 rounded-xl border border-emerald-100">
                  <div className="text-xs text-slate-500 font-medium">Transcript:</div>
                  <p className="text-sm font-bold text-slate-900 italic">
                    "{playgroundResult.transcript}"
                  </p>
                  <div className="flex items-center gap-4 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
                    <span>Duration: <strong>{playgroundResult.audioDurationSec}s</strong></span>
                    <span>Confidence: <strong>{((playgroundResult.confidence || 0.95) * 100).toFixed(1)}%</strong></span>
                    <span>Model: <strong>nova-3</strong></span>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-medium text-rose-700">
                  {playgroundResult.error || "Unknown transcription error"}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Tab: Usage & Telemetry Logs */}
      {activeTab === "logs" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Live Transcription Audit Trail</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time log of WhatsApp voice note conversions with provider failover telemetry.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Customer / JID</th>
                  <th className="py-2.5 px-3">Provider Node</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Transcript / Error Snippet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No voice transcription logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        {log.customerJid ? log.customerJid.split("@")[0] : "Admin Test"}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {log.accountName}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-600">
                        {log.audioDurationSec ? `${log.audioDurationSec}s` : "-"}
                      </td>
                      <td className="py-2.5 px-3">
                        {log.status === "success" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            SUCCESS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {log.errorType || "FAILED"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 max-w-md truncate text-slate-600">
                        {log.transcriptSnippet || log.errorMessage || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingAccount ? "Edit Deepgram Project" : "Add Deepgram Account"}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Account / Project Friendly Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Deepgram Primary (Nova-3)"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deepgram Project ID
                </label>
                <input
                  type="text"
                  required
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  placeholder="e.g. a3b4c5d6-e7f8-9012-3456-789abcdef012"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Used for real-time balance queries via <code className="text-slate-600">/v1/projects/{"{id}"}/balances</code>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deepgram API Key {editingAccount && <span className="text-slate-400 font-normal">(Leave blank to keep existing)</span>}
                </label>
                <input
                  type="password"
                  required={!editingAccount}
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder={editingAccount ? "••••••••••••••••••••••••" : "b8089b0d699b6bb0e238..."}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Stored securely on the server. Never transmitted unmasked to the frontend.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Failover Priority
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">1 = Highest Priority</span>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="block text-xs font-bold text-slate-700 mb-2">Enabled Status</label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span>Active in Router</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {editingAccount ? "Save Changes" : "Create Account & Check Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Routing & Strategy Config Modal */}
      {showConfigModal && config && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Deepgram Routing & Fallback Config</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rotation Strategy
                </label>
                <select
                  value={config.rotationMode}
                  onChange={(e) => setConfig({ ...config, rotationMode: e.target.value as any })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="balance_aware">Balance Aware + Priority (Recommended - Prefers healthy funded nodes)</option>
                  <option value="priority">Priority Mode (Strict #1, #2, #3 failover hierarchy)</option>
                  <option value="round_robin">Round Robin (Even load distribution across active nodes)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Low Balance Threshold ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={config.lowBalanceThreshold}
                    onChange={(e) => setConfig({ ...config, lowBalanceThreshold: parseFloat(e.target.value) || 1.0 })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Accounts below this mark trigger LOW BALANCE status.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Auto-Refresh Interval (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={config.autoRefreshIntervalMinutes}
                    onChange={(e) => setConfig({ ...config, autoRefreshIntervalMinutes: parseInt(e.target.value) || 5 })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Periodic background balance sync daemon.
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800">STT Parameters (Universal Nova-3 Engine)</div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                  <div>Model: <strong>nova-3</strong></div>
                  <div>Language: <strong>multi</strong></div>
                  <div>Smart Format: <strong>true</strong></div>
                  <div>Punctuate: <strong>true</strong></div>
                  <div>Numerals: <strong>true</strong></div>
                  <div>Failover: <strong>Automatic</strong></div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Deepgram Account</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Account Name:</span>
                <span className="font-bold text-slate-900">{accountToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Project ID:</span>
                <span className="font-mono text-slate-700">{accountToDelete.maskedProjectId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Current Priority:</span>
                <span className="font-bold text-slate-700">#{accountToDelete.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Recorded Balance:</span>
                <span className="font-bold text-emerald-700">${accountToDelete.balance.toFixed(2)} USD</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently remove this Deepgram account from the transcription router pool? Voice notes will no longer route to this project key.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setAccountToDelete(null)}
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
                <span>{isDeleting ? "Deleting..." : "Delete Account"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
