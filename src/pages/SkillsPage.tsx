import React, { useEffect, useState } from "react";
import axios from "axios";
import { 
  Sparkles, 
  Check, 
  Save, 
  RefreshCw, 
  FileCode, 
  ShieldCheck, 
  Zap, 
  MessageSquare, 
  Target, 
  Sliders, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Award
} from "lucide-react";

export default function SkillsPage() {
  const [skillContent, setSkillContent] = useState<string>("");
  const [initialContent, setInitialContent] = useState<string>("");
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"framework" | "editor" | "playbook">("framework");

  const fetchSkill = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/skill");
      setSkillContent(res.data.content || "");
      setInitialContent(res.data.content || "");
      setIsEnabled(res.data.enabled !== false);
    } catch (err) {
      console.error("Failed to fetch skill:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkill();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post("/api/skill", {
        content: skillContent,
        enabled: isEnabled,
      });
      setInitialContent(skillContent);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert("Failed to save skill configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    setIsEnabled(enabled);
    try {
      await axios.post("/api/skill", {
        enabled,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const hasChanges = skillContent !== initialContent;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Sales Closer Skill</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-500/30 text-purple-200 border border-purple-400/40 uppercase tracking-wider">
                    SKILL.md
                  </span>
                </div>
                <p className="text-purple-200/80 text-sm mt-0.5">
                  Autonomous High-Converting WhatsApp Closer Engine & Psychology Playbook
                </p>
              </div>
            </div>
          </div>

          {/* Master Skill Switch */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
            <div className="text-right">
              <div className="text-xs font-bold text-white uppercase tracking-wider">Skill Engine Status</div>
              <div className="text-xs text-purple-200 font-medium">
                {isEnabled ? "Active & Enforcing Rules" : "Disabled (Generic Replies)"}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => handleToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-[22px] after:w-[22px] after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
            </label>
          </div>
        </div>

        {/* Quick Tabs */}
        <div className="flex items-center gap-2 mt-8 pt-6 border-t border-white/10 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("framework")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "framework"
                ? "bg-white text-slate-900 shadow-md"
                : "text-purple-200 hover:bg-white/10"
            }`}
          >
            <Target className="w-4 h-4" />
            Core Framework
          </button>
          <button
            onClick={() => setActiveTab("playbook")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "playbook"
                ? "bg-white text-slate-900 shadow-md"
                : "text-purple-200 hover:bg-white/10"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Objection Playbook
          </button>
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "editor"
                ? "bg-white text-slate-900 shadow-md"
                : "text-purple-200 hover:bg-white/10"
            }`}
          >
            <FileCode className="w-4 h-4" />
            Full SKILL.md Prompt & Code
          </button>
        </div>
      </div>

      {/* Tab Content 1: Core Framework */}
      {activeTab === "framework" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Progressive Discovery</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Never dump full feature specs blindly. Diagnoses the buyer's pain point and daily usage before suggesting any tier or plan.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold mb-3">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Outcome Value Selling</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Translates dry specs into tangible ROI (e.g. saves 3 hours daily, handles 10x leads without extra staff).
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-3">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Roman Urdu Natural Mirroring</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Speaks native Pakistani business conversational Roman Urdu (friendly, warm, respectful) without robotic artificial phrases.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-3">
                4
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">1-Step Payment Closing</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Seamlessly routes ready buyers to active Easypaisa, JazzCash, or Bank details and triggers automatic verification.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              How the AI Uses This Skill on WhatsApp
            </h2>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                When a customer sends a text message or a voice note on WhatsApp, the background system prompt dynamically injects the complete <strong>SKILL.md</strong> closing instructions into the AI model.
              </p>
              <p>
                This guarantees the AI acts as a seasoned sales representative rather than a simple chatbot, steering conversations toward successful orders, answering pricing questions with ROI justification, and reducing abandoned leads.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Objection Playbook */}
      {activeTab === "playbook" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertCircle className="w-4 h-4" />
              Objection: "Mehnga hai / Too Expensive"
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Action:</strong> AI does NOT immediately offer discounts. First, it diagnoses:
              <br />
              <span className="italic text-slate-500">"Aapka monthly budget kitna hai ya commitment ka issue lag raha hai?"</span>
              <br />
              Then highlights daily cost breakdown (e.g. 50 PKR/day) or suggests a lower starter tier.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <HelpCircle className="w-4 h-4" />
              Objection: "Soch ke bataunga / I'll let you know later"
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Action:</strong> Never be pushy or aggressive. AI politely acknowledges and asks:
              <br />
              <span className="italic text-slate-500">"Bilkul koi masla nahi bhai! Waise koi specific cheez hai jo clear nahi hui ya features compare kar rahe hain?"</span>
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              Objection: "Trust / Fake to nahi?"
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Action:</strong> Provides verified screenshots from Tool Knowledge Base, guarantees transparent onboarding, and invites them to start on a low-risk single month plan.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <TrendingUp className="w-4 h-4" />
              Buying Signal: "Buy karna hai / Account bhejo"
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Action:</strong> Sends clean Easypaisa / JazzCash / Bank transfer instructions with account titles, asks for payment receipt/screenshot, and sets lead status to <span className="font-mono bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded">Payment Pending</span>.
            </p>
          </div>
        </div>
      )}

      {/* Tab Content 3: Editor */}
      {activeTab === "editor" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-700 font-mono">SKILL.md (Root File)</span>
            </div>
            <div className="flex items-center gap-3">
              {savedSuccess && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Saved Successfully!
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  hasChanges
                    ? "bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </div>
          </div>

          <div className="p-4">
            <textarea
              value={skillContent}
              onChange={(e) => setSkillContent(e.target.value)}
              rows={24}
              className="w-full p-4 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y leading-relaxed"
              placeholder="Loading SKILL.md contents..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
