import React, { useState } from "react";
import { 
  Bot, 
  Lock, 
  Mail, 
  User as UserIcon, 
  Building2, 
  Phone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  X,
  Sparkles
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AuthModalProps {
  initialMode?: "login" | "register";
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function AuthModal({ initialMode = "login", onSuccess, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [plan] = useState<"Free" | "Pro" | "Agency" | "Enterprise">("Free");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await login(email, password);
        if (res.success) {
          if (onSuccess) onSuccess();
        } else {
          setErrorMessage(res.error || "Login failed. Check your email or password.");
        }
      } else {
        const res = await register({ name, email, password, company, phone, plan });
        if (res.success) {
          setSuccessMessage("Account created successfully!");
          if (onSuccess) onSuccess();
        } else {
          setErrorMessage(res.error || "Registration failed. Email might already exist.");
        }
      }
    } catch (err: any) {
      setErrorMessage("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl border border-[var(--line-strong)] bg-[var(--panel-solid)] text-[var(--ink)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Brand Header */}
      <div className="p-6 border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--ink)] text-[var(--bg)] grid place-items-center font-bold">
              <Bot className="w-5 h-5 text-[#10b981]" />
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight leading-tight text-[var(--ink)]">
                SalesAgent<span className="text-[#10b981]">AI</span>
              </h2>
              <p className="text-[10px] text-[var(--muted)] font-semibold">Autonomous WhatsApp Closer</p>
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mode Switcher */}
        <div className="flex p-1 rounded-xl border border-[var(--line)] bg-[var(--bg)]">
          <button
            type="button"
            onClick={() => { setMode("login"); setErrorMessage(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === "login"
                ? "bg-[var(--ink)] text-[var(--bg)] shadow-xs"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setErrorMessage(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === "register"
                ? "bg-[var(--ink)] text-[var(--bg)] shadow-xs"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Create Account
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6 sm:p-7">
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" && (
            <div>
              <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">Full Name *</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-3 text-[var(--muted)]" />
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none focus:border-[#10b981]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-[var(--muted)]" />
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none focus:border-[#10b981]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[var(--muted)]" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none focus:border-[#10b981]"
              />
            </div>
          </div>

          {mode === "register" && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">Company / Store</label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 absolute left-3 top-3 text-[var(--muted)]" />
                    <input
                      type="text"
                      placeholder="My Store"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-2 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none focus:border-[#10b981]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">WhatsApp Phone</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-[var(--muted)]" />
                    <input
                      type="text"
                      placeholder="+92 300..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-2 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none focus:border-[#10b981]"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[var(--ink)]">Free Starter Account</p>
                  <p className="text-[10px] text-[var(--muted)]">Includes 30 automated AI sales replies. Tier upgrades assigned by Admin.</p>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[#10b981]/15 text-[#10b981] font-extrabold text-[10px] uppercase">
                  Free
                </span>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-[#10b981] hover:bg-[#0ea875] active:scale-[0.99] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : mode === "login" ? (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Create Sales Agent Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--muted)]">
          <span>Protected with AES-256 Auth</span>
          <span className="font-bold text-[var(--ink)]">Role-Based Access</span>
        </div>
      </div>
    </div>
  );
}
