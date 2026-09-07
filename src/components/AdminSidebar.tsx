import React, { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Layers,
  Cpu,
  Activity,
  ShieldAlert,
  ArrowLeft,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Server,
  Sparkles,
  RefreshCw,
  Mic,
  GitBranch,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AdminSidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function AdminSidebar({ isMobileOpen, onCloseMobile }: AdminSidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const adminNavItems = [
    {
      to: "/admin",
      label: "Master Dashboard",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      to: "/admin/deployments",
      label: "Deploy & Rollback",
      icon: GitBranch,
    },
    {
      to: "/admin/deepgram",
      label: "Deepgram Accounts",
      icon: Mic,
    },
    {
      to: "/admin/users",
      label: "User Accounts & Quotas",
      icon: Users,
    },
    {
      to: "/admin/plans",
      label: "Plans & Entitlements",
      icon: Layers,
    },
    {
      to: "/admin/engines",
      label: "AI Engine Gateway",
      icon: Cpu,
    },
    {
      to: "/admin/diagnostics",
      label: "System & Sockets",
      icon: Activity,
    },
    {
      to: "/admin/audit",
      label: "Security Audit Trail",
      icon: ShieldAlert,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Admin Sidebar Container */}
      <aside
        className={`
          fixed lg:static top-0 bottom-0 left-0 z-40
          flex flex-col justify-between bg-[var(--panel-solid)] text-[var(--ink)] border-r border-[var(--line)]
          transition-all duration-300 ease-in-out shadow-xs
          ${isCollapsed ? "w-20" : "w-64"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div>
          {/* Admin Header / Brand */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel-solid)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center font-black shrink-0 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-[#10b981]" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-[var(--ink)] text-base tracking-tight truncate">
                      Admin
                    </span>
                    <span className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                      Console
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--muted)] font-semibold truncate">
                    System Governance
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] transition-colors cursor-pointer"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Switch to User Workspace Banner */}
          <div className="p-3 border-b border-[var(--line)] bg-[var(--panel)]">
            <button
              onClick={() => {
                onCloseMobile();
                navigate("/");
              }}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold
                bg-[var(--panel-solid)] hover:bg-[var(--line)] text-[var(--ink)] border border-[var(--line)]
                transition-all cursor-pointer shadow-xs group
                ${isCollapsed ? "justify-center px-0" : ""}
              `}
              title="Return to your Sales Agent User Workspace"
            >
              <ArrowLeft className="w-4 h-4 shrink-0 text-[#10b981] group-hover:-translate-x-0.5 transition-transform" />
              {!isCollapsed && <span className="truncate">Return to User App</span>}
            </button>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
              {!isCollapsed ? "System Controls" : "Menu"}
            </div>

            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact 
                ? location.pathname === item.to 
                : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => onCloseMobile()}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all
                    ${isActive 
                      ? "bg-[var(--ink)] text-[var(--bg)] shadow-xs" 
                      : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)]"
                    }
                    ${isCollapsed ? "justify-center px-0" : ""}
                  `}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#10b981]" : "text-[var(--muted)]"}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Bottom Node Diagnostics & Profile */}
        <div className="p-3 border-t border-[var(--line)] bg-[var(--panel)] space-y-2">
          {!isCollapsed ? (
            <>
              {/* Server Daemon Tag */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--panel-solid)] border border-[var(--line)] text-[var(--muted)] text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                  <span className="text-[11px] font-bold text-[var(--ink)]">Cluster Daemon Live</span>
                </div>
                <span className="text-[10px] text-[var(--muted)] mono">Port 3001</span>
              </div>

              {/* Admin Profile */}
              {user && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--panel-solid)] border border-[var(--line)] shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-[11px] text-white shrink-0 shadow-xs">
                      {user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="text-[11px] font-bold text-[var(--ink)] block leading-tight truncate">
                        {user.name}
                      </span>
                      <span className="text-[9px] font-black text-indigo-500 uppercase">
                        Super Administrator
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
                className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" 
                title="Express Server Online" 
              />
              {user && (
                <button
                  onClick={() => logout()}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                  title={`Logged in as Master Admin (${user.email}) - Click to logout`}
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
