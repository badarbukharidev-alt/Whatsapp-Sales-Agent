import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Smartphone, 
  MessageSquare, 
  Wrench, 
  Users, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Bot,
  Activity,
  Zap,
  X,
  Send,
  ShieldCheck,
  Globe,
  LogOut,
  Sparkles
} from "lucide-react";
import { WhatsAppStatus, AgentSettings } from "../types";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  whatsappStatus: WhatsAppStatus;
  agentSettings?: AgentSettings | null;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenLanding?: () => void;
}

export default function Sidebar({
  whatsappStatus,
  agentSettings,
  isMobileOpen,
  onCloseMobile,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse: externalOnToggle,
  onOpenLanding,
}: SidebarProps) {
  const { user, isAdmin, logout } = useAuth();
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;
  const toggleCollapse = externalOnToggle || (() => setInternalIsCollapsed(!internalIsCollapsed));

  const isConnected = whatsappStatus.status === "connected";
  const isConnecting = whatsappStatus.status === "connecting";

  const navItems = [
    { to: "/", label: "Overview", icon: LayoutDashboard },
    { to: "/campaigns", label: "Ad Campaigns", icon: Send },
    { to: "/connect", label: "WhatsApp Gateway", icon: Smartphone },
    { to: "/conversations", label: "Live Conversations", icon: MessageSquare },
    { to: "/tools", label: "Tool Knowledge Base", icon: Wrench },
    { to: "/customers", label: "Customer Directory", icon: Users },
    { to: "/analytics", label: "Analytics & ROI", icon: BarChart3 },
    { to: "/settings", label: "Workspace Settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        flex flex-col justify-between
        bg-[var(--panel-solid)] text-[var(--ink)] border-r border-[var(--line)]
        transition-all duration-300 ease-in-out
        ${isCollapsed ? "w-20" : "w-64"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        shrink-0 select-none shadow-xs
      `}>
        {/* Top: Logo & Toggle Button */}
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--line)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                <Bot className="w-5 h-5 text-[#10b981]" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-[var(--ink)] text-base tracking-tight truncate">SalesAgent</span>
                    <span className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                      AI
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--muted)] font-semibold truncate">Autonomous Closer</span>
                </div>
              )}
            </div>

            {/* Mobile close or desktop collapse */}
            <div className="flex items-center">
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)]"
              >
                <X className="w-5 h-5" />
              </button>

              <button
                onClick={toggleCollapse}
                className="hidden lg:flex p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] transition-colors cursor-pointer"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => onCloseMobile()}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all
                    ${isActive 
                      ? "bg-[var(--ink)] text-[var(--bg)] shadow-xs" 
                      : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)]"
                    }
                    ${isCollapsed ? "justify-center px-0" : ""}
                  `}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}

            {/* Admin Portal Link (Admin Only) */}
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => onCloseMobile()}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all mt-2
                  ${isActive 
                    ? "bg-indigo-600 text-white shadow-xs" 
                    : "text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200/80"
                  }
                  ${isCollapsed ? "justify-center px-0" : ""}
                `}
                title={isCollapsed ? "Admin Portal" : undefined}
              >
                <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-500" />
                {!isCollapsed && <span className="truncate">Admin Portal</span>}
              </NavLink>
            )}

            {/* Landing Page Preview Link */}
            <NavLink
              to="/landing"
              onClick={() => onCloseMobile()}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all
                ${isCollapsed ? "justify-center px-0" : ""}
              `}
              title={isCollapsed ? "Landing Page" : undefined}
            >
              <Globe className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">Landing Page</span>}
            </NavLink>
          </nav>
        </div>

        {/* Bottom: Connection Widget & User Profile */}
        <div className="p-3 border-t border-[var(--line)] bg-[var(--panel)] space-y-2">
          {!isCollapsed ? (
            <>
              {/* WhatsApp Status Card */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--panel-solid)] border border-[var(--line)] shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isConnected ? "bg-[#10b981] animate-pulse" : isConnecting ? "bg-amber-500 animate-ping" : "bg-slate-400"
                  }`} />
                  <div className="truncate">
                    <span className="text-[11px] font-bold text-[var(--ink)] block leading-tight">
                      {isConnected ? "WhatsApp Connected" : isConnecting ? "Connecting..." : "WhatsApp Disconnected"}
                    </span>
                    <span className="text-[9px] text-[var(--muted)] block font-medium">
                      {(agentSettings?.preferredApi || agentSettings?.defaultLLM || "AI").toUpperCase()} Multi-LLM
                    </span>
                  </div>
                </div>
              </div>

              {/* User Profile Bar */}
              {user && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--panel-solid)] border border-[var(--line)] shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] text-white shrink-0 ${
                      user.role === "admin" ? "bg-indigo-600" : "bg-[#10b981]"
                    }`}>
                      {user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="text-[11px] font-bold text-[var(--ink)] block leading-tight truncate">
                        {user.name}
                      </span>
                      <span className={`text-[9px] font-bold uppercase ${
                        user.role === "admin" ? "text-indigo-500" : "text-[#10b981]"
                      }`}>
                        {user.role === "admin" ? "Super Admin" : `${user.plan || "Free"} User`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => logout()}
                    className="p-1.5 text-[var(--muted)] hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Log out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <div 
                className={`w-3 h-3 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} 
                title={isConnected ? "WhatsApp Online" : "WhatsApp Offline"}
              />
              {user && (
                <button
                  onClick={() => logout()}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                  title={`Logged in as ${user.name} (${user.role}) - Click to logout`}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
