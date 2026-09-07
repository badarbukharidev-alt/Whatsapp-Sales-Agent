import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, ChevronRight, Power, Bot, Smartphone, ShieldCheck, User as UserIcon, LogOut, Sparkles, Sun, Moon } from "lucide-react";
import { WhatsAppStatus, AgentSettings } from "../types";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  whatsappStatus: WhatsAppStatus;
  agentSettings: AgentSettings | null;
  onOpenMobile: () => void;
  onDisconnectWhatsapp: () => Promise<void>;
  isDisconnecting?: boolean;
}

export default function Header({
  whatsappStatus,
  agentSettings,
  onOpenMobile,
  onDisconnectWhatsapp,
  isDisconnecting = false,
}: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
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

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === "/" || path === "/overview") return { current: "Workspace Overview", parent: "Dashboard" };
    if (path.startsWith("/campaigns")) return { current: "Ad Campaigns", parent: "Marketing" };
    if (path.startsWith("/connect")) return { current: "WhatsApp Gateway", parent: "System" };
    if (path.startsWith("/conversations")) return { current: "Live Conversations", parent: "Inbox" };
    if (path.startsWith("/tools")) return { current: "Tool Knowledge Base", parent: "Products" };
    if (path.startsWith("/customers")) return { current: "Customer Directory", parent: "CRM" };
    if (path.startsWith("/analytics")) return { current: "Analytics & ROI", parent: "Insights" };
    if (path.startsWith("/settings")) return { current: "Workspace Settings", parent: "Agent Config" };
    if (path.startsWith("/admin")) return { current: "Admin Governance", parent: "Root Console" };
    return { current: "Dashboard", parent: "SalesAgent AI" };
  };

  const { current, parent } = getBreadcrumb();
  const isConnected = whatsappStatus.status === "connected";
  const isConnecting = whatsappStatus.status === "connecting";

  return (
    <header className="h-16 bg-[var(--panel-solid)]/90 backdrop-blur-md border-b border-[var(--line)] px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-xs text-[var(--ink)] transition-colors duration-200">
      {/* Left: Mobile trigger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-xl text-[var(--muted)] hover:bg-[var(--line)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav className="flex items-center gap-2 text-xs">
          <span className="font-medium text-[var(--muted)] hidden sm:inline">{parent}</span>
          <ChevronRight className="w-3.5 h-3.5 text-[var(--line-strong)] hidden sm:inline" />
          <span className="font-bold text-[var(--ink)] text-sm">{current}</span>
        </nav>
      </div>

      {/* Right: Real-time Badges & User Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Admin Portal Direct Launch Button (Admin Only) */}
        {isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-md shadow-indigo-500/20 border border-indigo-400/30 transition-all cursor-pointer animate-pulse"
            title="Open Master Admin Panel (Super Admin Controls)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
            <span className="tracking-tight">Admin Console</span>
          </button>
        )}

        {/* Role & User Badge */}
        {user && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border bg-slate-50 border-slate-200 text-xs">
            <span className={`w-2 h-2 rounded-full ${isAdmin ? "bg-indigo-600" : "bg-emerald-600"}`} />
            <span className="font-bold text-slate-800">{user.name}</span>
            <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded-md ${
              isAdmin 
                ? "bg-indigo-100 text-indigo-700" 
                : "bg-emerald-100 text-emerald-700"
            }`}>
              {user.role}
            </span>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-9 h-9 rounded-xl border border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--line-strong)]/20 flex items-center justify-center text-[var(--ink)] transition-colors cursor-pointer"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>

        {/* WhatsApp Status Pill */}
        <div 
          onClick={() => { if (!isConnected) navigate("/connect"); }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
            isConnected
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
              : isConnecting
              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
              : "bg-[var(--panel)] text-[var(--muted)] border-[var(--line)] hover:bg-[var(--line)]"
          }`}
          title={isConnected ? "WhatsApp is connected" : "Click to connect WhatsApp"}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? "bg-emerald-500 animate-pulse" : isConnecting ? "bg-amber-500 animate-ping" : "bg-slate-400"
          }`} />
          <span className="hidden md:inline">WhatsApp:</span>
          <span>{isConnected ? "Live" : isConnecting ? "Connecting" : "Offline"}</span>
        </div>

        {/* Disconnect button when connected */}
        {isConnected && (
          <button
            onClick={onDisconnectWhatsapp}
            disabled={isDisconnecting}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
            title="Disconnect WhatsApp Session"
          >
            <Power className="w-3 h-3" />
            <span>{isDisconnecting ? "Disconnecting..." : "Disconnect"}</span>
          </button>
        )}
      </div>
    </header>
  );
}
