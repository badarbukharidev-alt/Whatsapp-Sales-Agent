import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  ShieldCheck,
  ArrowLeft,
  Trash2,
  Activity,
  User as UserIcon,
  LogOut,
  RefreshCw,
  Server,
  Zap,
  Sun,
  Moon
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AdminHeaderProps {
  onOpenMobile: () => void;
  onClearCache?: () => void;
  isClearingCache?: boolean;
}

export default function AdminHeader({
  onOpenMobile,
  onClearCache,
  isClearingCache = false,
}: AdminHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem("salesagent-theme") === "dark" || 
      document.documentElement.classList.contains("dark");
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("salesagent-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("salesagent-theme", "light");
    }
  };

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === "/admin" || path === "/admin/dashboard") {
      return {
        title: "Master Governance Dashboard",
        description: "Real-time ecosystem analytics, conversion load, and server health",
      };
    }
    if (path.startsWith("/admin/deployments")) {
      return {
        title: "GitHub Version Deployment & Rollback",
        description: "One-click releases from GitHub repository with commit history and safe rollback",
      };
    }
    if (path.startsWith("/admin/users")) {
      return {
        title: "User Accounts & Quotas",
        description: "Provision accounts, assign subscription tiers, and configure conversion caps",
      };
    }
    if (path.startsWith("/admin/plans")) {
      return {
        title: "Plan Tiers & Entitlements",
        description: "Manage Free, Pro, Agency, and Enterprise feature packages",
      };
    }
    if (path.startsWith("/admin/engines")) {
      return {
        title: "AI Engine & Gateway Configuration",
        description: "Model orchestration for Gemini 2.5 Flash, Claude 3.5, DeepSeek, and Fallbacks",
      };
    }
    if (path.startsWith("/admin/diagnostics")) {
      return {
        title: "Server & Socket Diagnostics",
        description: "Node.js memory telemetry, Baileys socket state, and daemon logs",
      };
    }
    if (path.startsWith("/admin/audit")) {
      return {
        title: "Security & Action Audit Trail",
        description: "Chronological log of administrative actions, credential changes, and system events",
      };
    }
    return {
      title: "Admin Control Center",
      description: "Super Administrator System Panel",
    };
  };

  const { title, description } = getPageInfo();

  return (
    <header className="h-16 bg-[var(--panel-solid)]/90 backdrop-blur-md border-b border-[var(--line)] px-4 sm:px-6 flex items-center justify-between z-10 shrink-0 text-[var(--ink)] transition-colors duration-200">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] rounded-xl transition-colors cursor-pointer"
          title="Open Admin Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#10b981] bg-[#10b981]/15 px-2 py-0.5 rounded-md border border-[#10b981]/30 hidden sm:inline-block">
              Super Admin
            </span>
            <h1 className="text-sm sm:text-base font-black text-[var(--ink)] truncate">
              {title}
            </h1>
          </div>
          <p className="text-[11px] text-[var(--muted)] truncate hidden sm:block">
            {description}
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-9 h-9 rounded-xl border border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--line-strong)]/20 flex items-center justify-center text-[var(--ink)] transition-colors cursor-pointer"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>

        {/* Purge Cache Button */}
        {onClearCache && (
          <button
            onClick={onClearCache}
            disabled={isClearingCache}
            className="px-3 py-1.5 text-xs font-bold bg-[var(--panel)] hover:bg-[var(--line)] active:scale-95 text-[var(--ink)] rounded-xl border border-[var(--line)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Purge system caches & memory buffers"
          >
            <Trash2 className={`w-3.5 h-3.5 ${isClearingCache ? "animate-spin text-[#10b981]" : "text-[var(--muted)]"}`} />
            <span className="hidden md:inline">Purge Cache</span>
          </button>
        )}

        {/* Switch back to User Workspace */}
        <button
          onClick={() => navigate("/")}
          className="px-3.5 py-1.5 text-xs font-bold bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] rounded-xl border border-[#10b981]/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          title="Switch to your standard User Workspace"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>User Workspace</span>
        </button>

        {/* Admin Profile & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-[var(--line)]">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-xs">
            {user?.name ? user.name.substring(0, 2).toUpperCase() : "AD"}
          </div>
          <button
            onClick={() => logout()}
            className="p-2 text-[var(--muted)] hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
