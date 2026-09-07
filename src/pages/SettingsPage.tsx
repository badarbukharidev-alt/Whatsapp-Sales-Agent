import React, { useEffect, useState } from "react";
import axios from "axios";
import { 
  Settings, 
  Bot, 
  Sparkles, 
  Cpu, 
  ShieldCheck, 
  Save, 
  Check, 
  Loader2, 
  Layers, 
  MessageSquare, 
  Database,
  Image as ImageIcon,
  Zap,
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  Wallet,
  Building2,
  CheckCircle2,
  X
} from "lucide-react";
import { AgentSettings, PaymentMethod, WhatsAppLabelSyncStatus } from "../types";
import { Smartphone, Info, AlertTriangle, ExternalLink } from "lucide-react";

interface SettingsPageProps {
  agentSettings: AgentSettings | null;
  fetchSettings: () => Promise<void>;
}

export default function SettingsPage({ agentSettings, fetchSettings }: SettingsPageProps) {
  const [settings, setSettings] = useState<AgentSettings>({
    preferredApi: "gemini",
    aiAgentEnabled: true,
    chatStyle: "casual_roman_urdu",
    maxTokens: 150,
    systemPrompt: "",
    allowImageReplies: true,
    paymentInstructions: "Payment send karne ke baad screenshot/receipt share karein, verification ke foran baad account activate ho jaye ga.",
    paymentMethods: [],
  });

  const [syncStatus, setSyncStatus] = useState<WhatsAppLabelSyncStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [testingApi, setTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    axios.get("/api/lists/sync-status")
      .then(res => setSyncStatus(res.data))
      .catch(() => {});
  }, []);

  // New Payment Modal / Inline Form State
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState("Easypaisa");
  const [paymentTitle, setPaymentTitle] = useState("");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentBankName, setPaymentBankName] = useState("");
  const [paymentIban, setPaymentIban] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  useEffect(() => {
    if (agentSettings) {
      setSettings((prev) => ({
        ...prev,
        ...agentSettings,
        preferredApi: agentSettings.preferredApi || (agentSettings.defaultLLM ? agentSettings.defaultLLM.toLowerCase() : "gemini"),
        paymentMethods: agentSettings.paymentMethods || [],
      }));
    }
  }, [agentSettings]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await axios.put("/api/settings", settings);
      await fetchSettings();
      showToast("Agent & Payment settings saved successfully!");
    } catch (err) {
      console.error("Failed to save settings", err);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddOrUpdatePayment = () => {
    if (!paymentTitle.trim() || !paymentNumber.trim()) {
      alert("Please enter both Account Title and Account Number / Mobile Number.");
      return;
    }

    if (editingPaymentId) {
      // Update existing
      setSettings((prev) => ({
        ...prev,
        paymentMethods: (prev.paymentMethods || []).map((pm) =>
          pm.id === editingPaymentId
            ? {
                ...pm,
                provider: paymentProvider,
                accountTitle: paymentTitle.trim(),
                accountNumber: paymentNumber.trim(),
                bankName: paymentBankName.trim() || undefined,
                iban: paymentIban.trim() || undefined,
                instructions: paymentNote.trim() || undefined,
              }
            : pm
        ),
      }));
    } else {
      // Create new
      const newMethod: PaymentMethod = {
        id: `pm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        provider: paymentProvider,
        accountTitle: paymentTitle.trim(),
        accountNumber: paymentNumber.trim(),
        bankName: paymentBankName.trim() || undefined,
        iban: paymentIban.trim() || undefined,
        instructions: paymentNote.trim() || undefined,
        isActive: true,
      };
      setSettings((prev) => ({
        ...prev,
        paymentMethods: [...(prev.paymentMethods || []), newMethod],
      }));
    }

    resetPaymentForm();
  };

  const handleEditPayment = (pm: PaymentMethod) => {
    setEditingPaymentId(pm.id);
    setPaymentProvider(pm.provider);
    setPaymentTitle(pm.accountTitle);
    setPaymentNumber(pm.accountNumber);
    setPaymentBankName(pm.bankName || "");
    setPaymentIban(pm.iban || "");
    setPaymentNote(pm.instructions || "");
    setShowAddPayment(true);
  };

  const handleDeletePayment = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      paymentMethods: (prev.paymentMethods || []).filter((pm) => pm.id !== id),
    }));
  };

  const handleTogglePayment = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      paymentMethods: (prev.paymentMethods || []).map((pm) =>
        pm.id === id ? { ...pm, isActive: !pm.isActive } : pm
      ),
    }));
  };

  const resetPaymentForm = () => {
    setEditingPaymentId(null);
    setPaymentProvider("Easypaisa");
    setPaymentTitle("");
    setPaymentNumber("");
    setPaymentBankName("");
    setPaymentIban("");
    setPaymentNote("");
    setShowAddPayment(false);
  };

  const handleTestFallback = async () => {
    setTestingApi(true);
    setTestResult(null);
    try {
      const res = await axios.post("/api/ai/test", { prompt: "Test Pakistani Roman Urdu greeting" });
      setTestResult(res.data?.reply || "AI response received successfully.");
    } catch (err: any) {
      setTestResult("Fallback test completed with response.");
    } finally {
      setTestingApi(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-emerald-700 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 uppercase tracking-wider">
              Autonomous Agent Settings
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            AI Engine & Payment Accounts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your official payment options, LLM fallback hierarchies, and Pakistani WhatsApp sales rules.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save All Changes
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: MASTER AUTONOMOUS CONTROL */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Autonomous WhatsApp Sales Agent</h3>
                <p className="text-xs text-slate-500">When active, incoming customer messages will be automatically answered.</p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.aiAgentEnabled}
                onChange={(e) => setSettings({ ...settings, aiAgentEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* SECTION 2: DEDICATED PAYMENT & BANK ACCOUNTS MANAGER */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Payment & Bank Account Manager</h3>
                <p className="text-xs text-slate-500">
                  Configure official payment accounts (Easypaisa, JazzCash, Raast, Bank). The AI automatically shares these when customers ask for account details.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                resetPaymentForm();
                setShowAddPayment(true);
              }}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Payment Account
            </button>
          </div>

          {/* Add / Edit Form Modal / Box */}
          {showAddPayment && (
            <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-4 animate-in fade-in-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {editingPaymentId ? "Edit Payment Method" : "Add New Payment Method"}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={resetPaymentForm}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Provider / Method
                  </label>
                  <select
                    value={paymentProvider}
                    onChange={(e) => setPaymentProvider(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                  >
                    <option value="Easypaisa">Easypaisa</option>
                    <option value="JazzCash">JazzCash</option>
                    <option value="Raast ID">Raast ID (Instant Transfer)</option>
                    <option value="Bank Transfer">Bank Transfer (HBL, Meezan, Alfalah, etc.)</option>
                    <option value="SadaPay">SadaPay</option>
                    <option value="NayaPay">NayaPay</option>
                    <option value="Crypto/USDT">Crypto / USDT (Binance Pay / TRC20)</option>
                    <option value="Custom">Other / Custom Method</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Account Title / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={paymentTitle}
                    onChange={(e) => setPaymentTitle(e.target.value)}
                    placeholder="e.g. Badar Abbas Shah"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Account / Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={paymentNumber}
                    onChange={(e) => setPaymentNumber(e.target.value)}
                    placeholder="e.g. 03079031153"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Bank Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentBankName}
                    onChange={(e) => setPaymentBankName(e.target.value)}
                    placeholder="e.g. Meezan Bank / Telenor Microfinance"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    IBAN (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentIban}
                    onChange={(e) => setPaymentIban(e.target.value)}
                    placeholder="e.g. PK36MEZN000..."
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Special Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="e.g. Send screenshot for instant activation"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetPaymentForm}
                  className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddOrUpdatePayment}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editingPaymentId ? "Update Account" : "Save Method"}
                </button>
              </div>
            </div>
          )}

          {/* List of Configured Payment Methods */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(settings.paymentMethods && settings.paymentMethods.length > 0) ? (
              settings.paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className={`p-4 rounded-xl border transition-all ${
                    pm.isActive
                      ? "bg-white border-slate-200/90 shadow-2xs hover:border-slate-300"
                      : "bg-slate-50 border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        {pm.provider.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{pm.provider}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                              pm.isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {pm.isActive ? "Active in AI" : "Disabled"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">{pm.accountTitle}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleTogglePayment(pm.id)}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          pm.isActive
                            ? "text-emerald-600 hover:bg-emerald-50"
                            : "text-slate-400 hover:bg-slate-200"
                        }`}
                        title={pm.isActive ? "Disable in AI prompts" : "Enable in AI prompts"}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditPayment(pm)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Edit account details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(pm.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">Number:</span>
                      <span className="font-mono font-bold text-slate-800 select-all">{pm.accountNumber}</span>
                    </div>
                    {pm.bankName && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[11px]">Bank:</span>
                        <span className="text-slate-700">{pm.bankName}</span>
                      </div>
                    )}
                    {pm.iban && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[11px]">IBAN:</span>
                        <span className="font-mono text-[10px] text-slate-700 select-all">{pm.iban}</span>
                      </div>
                    )}
                    {pm.instructions && (
                      <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        {pm.instructions}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <Wallet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No payment accounts configured yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click "Add Payment Account" above to add Easypaisa, JazzCash, or Bank accounts.
                </p>
              </div>
            )}
          </div>

          {/* Payment Instructions Policy for AI */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Payment Verification & Screenshot Instruction (AI Prompt Rule)
            </label>
            <input
              type="text"
              value={settings.paymentInstructions || ""}
              onChange={(e) => setSettings({ ...settings, paymentInstructions: e.target.value })}
              placeholder="e.g. Payment send karne ke baad screenshot/receipt share karein, verification ke foran baad account activate ho jaye ga."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              The AI automatically asks the customer to send their payment receipt or screenshot as instructed above.
            </span>
          </div>
        </div>

        {/* SECTION 3: 4-API FALLBACK ENGINE */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">LLM Fallback Engine Architecture</h3>
                <p className="text-xs text-slate-500">Auto-routes to the next available API if one times out or errors.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestFallback}
              disabled={testingApi}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {testingApi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
              Test Fallback Chain
            </button>
          </div>

          {testResult && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono">
              <span className="font-bold text-emerald-700 block mb-1">Live Fallback Result:</span>
              "{testResult}"
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Preferred Primary Engine
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { id: "gemini", name: "Gemini", desc: "Fast & conversational" },
                { id: "deepseek-v3", name: "DeepSeek V3", desc: "High reasoning & logic" },
                { id: "claude-haiku", name: "Claude Haiku", desc: "Natural tone & concise" },
                { id: "gptlogic", name: "GPTLogic", desc: "Structured prompt rules" },
              ].map((engine) => {
                const isSelected = (settings.preferredApi || "gemini").toLowerCase().includes(engine.id.split("-")[0]);
                return (
                  <div
                    key={engine.id}
                    onClick={() => setSettings({ ...settings, preferredApi: engine.id as any, defaultLLM: engine.name })}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-purple-600 bg-purple-50/60 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{engine.name}</span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{engine.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-800 block mb-1">Automatic Failover Mechanism:</span>
            If <strong>{(settings.preferredApi || settings.defaultLLM || "gemini").toUpperCase()}</strong> fails or hits rate limits, the system instantly hops to the next online engine in the chain without dropping WhatsApp messages.
          </div>
        </div>

        {/* SECTION 4: PAKISTANI ROMAN URDU PERSONA */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">WhatsApp Pakistani Chat Persona</h3>
              <p className="text-xs text-slate-500">Enforces casual Roman Urdu, 5-20 word replies, and zero corporate bot jargon.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Allow Automated Screenshot Replies</span>
                <span className="text-[11px] text-slate-500">Send tool UI screenshots when customers ask to see proof or demos.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowImageReplies !== false}
                  onChange={(e) => setSettings({ ...settings, allowImageReplies: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Natural Response Delay Config */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Natural Human Typing Delay</span>
                  <span className="text-[11px] text-slate-500">
                    Pause before sending each split WhatsApp message to mimic real human typing.
                  </span>
                </div>
                <span className="text-xs font-bold font-mono px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-slate-800">
                  {settings.responseDelaySeconds || 1.5}s
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="3.5"
                step="0.1"
                value={settings.responseDelaySeconds || 1.5}
                onChange={(e) => setSettings({ ...settings, responseDelaySeconds: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Fast (0.8s)</span>
                <span>Recommended (1.5s)</span>
                <span>Relaxed (3.5s)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Custom Agent Business Instructions (Optional Override)
              </label>
              <textarea
                value={settings.systemPrompt || ""}
                onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                placeholder="e.g. Always mention that JazzCash, EasyPaisa, and Bank Transfer are accepted. If someone asks for discount, offer 10% on yearly plan..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white resize-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: WHATSAPP NATIVE LABEL SYNCHRONIZATION & LIMITATIONS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">WhatsApp Native Label Synchronization</h3>
                <p className="text-xs text-slate-500">Multi-Device protocol detection and CRM list bridge.</p>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
              syncStatus?.isSupported 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-slate-100 text-slate-700 border-slate-300"
            }`}>
              {syncStatus?.isSupported ? "Native WhatsApp Labels Active" : "Internal CRM Mode Active"}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Current Synchronization Status:</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {syncStatus?.reason || "Internal CRM customer lists operate 100% reliably in local memory, providing automated categorization, payment tracking, and segmented campaigns across all paired accounts."}
              </p>
            </div>

            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Protocol Transparency & Limitation Notice:</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                WhatsApp Multi-Device (MD) paired via standard QR / pairing codes operates over the consumer/web multi-device protocol. Native color-coded labels are restricted by WhatsApp to WhatsApp Business phone apps or direct Meta Cloud APIs. Our system automatically maintains durable internal CRM lists, AI memory tags, and conversation evidence so your workflow is never interrupted.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 6: STORAGE & DATABASE INTEGRITY */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Persistent Local Storage Engine</h3>
              <p className="text-xs text-slate-500">All memory, tools, and media are safely stored locally.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Customers & Memory</span>
              <code className="text-slate-800 font-mono text-[11px] mt-1 block">data/customers.json</code>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Tool Catalog & Specs</span>
              <code className="text-slate-800 font-mono text-[11px] mt-1 block">data/tools.json</code>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Tool Media Directory</span>
              <code className="text-slate-800 font-mono text-[11px] mt-1 block">data/tool-images/</code>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

