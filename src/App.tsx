/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Bot, Loader2 } from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Overview from "./pages/Overview";
import Campaigns from "./pages/Campaigns";
import WhatsAppConnect from "./pages/WhatsAppConnect";
import Conversations from "./pages/Conversations";
import Customers from "./pages/Customers";
import Tools from "./pages/Tools";
import Analytics from "./pages/Analytics";
import SettingsPage from "./pages/SettingsPage";
import AdminLayout from "./pages/admin/AdminLayout";
import LandingPage from "./pages/LandingPage";
import AuthModal from "./pages/AuthModal";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { WhatsAppStatus, AgentSettings } from "./types";

function MainAppShell() {
  const { isAuthenticated, user, isAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({
    status: "disconnected",
  });
  const [agentSettings, setAgentSettings] = useState<AgentSettings | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const fetchWhatsAppStatus = async () => {
    try {
      const res = await axios.get("/api/whatsapp/status");
      setWhatsappStatus(res.data || { status: "disconnected" });
    } catch (err) {
      console.error("Failed to fetch WhatsApp status:", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get("/api/settings");
      setAgentSettings(res.data || null);
    } catch (err) {
      console.error("Failed to fetch agent settings:", err);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect WhatsApp?")) return;
    setIsDisconnecting(true);
    try {
      await axios.post("/api/whatsapp/disconnect");
      await fetchWhatsAppStatus();
    } catch (err) {
      console.error("Disconnect failed:", err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchWhatsAppStatus();
      fetchSettings();
      const interval = setInterval(() => {
        fetchWhatsAppStatus();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Loading state while verifying stored session token
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-900">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg mb-4 animate-pulse">
          <Bot className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Loading SalesAgent Workspace...</span>
        </div>
      </div>
    );
  }

  // Strict Authentication Guard: Unauthenticated users cannot access dashboard
  if (!isAuthenticated) {
    if (location.pathname === "/login") {
      return (
        <LandingPage 
          initialAuthOpen={true} 
          initialAuthMode="login" 
          onEnterApp={() => navigate("/")} 
        />
      );
    }
    if (location.pathname === "/register") {
      return (
        <LandingPage 
          initialAuthOpen={true} 
          initialAuthMode="register" 
          onEnterApp={() => navigate("/")} 
        />
      );
    }
    // Any dashboard route or landing route renders the landing page
    return (
      <LandingPage 
        onEnterApp={() => navigate("/login")} 
      />
    );
  }

  // Authenticated users explicitly browsing landing page
  if (location.pathname === "/landing") {
    return <LandingPage onEnterApp={() => navigate("/")} />;
  }

  // If user visits /login or /register while already authenticated, redirect to /
  if (location.pathname === "/login" || location.pathname === "/register") {
    return <Navigate to="/" replace />;
  }

  // Dedicated Admin Portal Layout with its own Admin Sidebar & Header
  if (location.pathname.startsWith("/admin")) {
    if (!isAdmin) {
      return <Navigate to="/" replace />;
    }
    return <AdminLayout />;
  }

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--ink)] font-sans overflow-hidden antialiased transition-colors duration-200">
      {/* SaaS Collapsible Sidebar */}
      <Sidebar
        whatsappStatus={whatsappStatus}
        agentSettings={agentSettings}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onOpenLanding={() => navigate("/landing")}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header Bar */}
        <Header
          whatsappStatus={whatsappStatus}
          agentSettings={agentSettings}
          onOpenMobile={() => setMobileSidebarOpen(true)}
          onDisconnectWhatsapp={handleDisconnect}
          isDisconnecting={isDisconnecting}
        />

        {/* Page Routing */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[var(--bg)]/60">
          <Routes>
            <Route
              path="/"
              element={
                <Overview
                  whatsappStatus={whatsappStatus}
                  agentSettings={agentSettings}
                />
              }
            />
            <Route
              path="/overview"
              element={<Navigate to="/" replace />}
            />
            <Route
              path="/campaigns"
              element={<Campaigns whatsappStatus={whatsappStatus} />}
            />
            <Route
              path="/connect"
              element={
                <WhatsAppConnect
                  whatsappStatus={whatsappStatus}
                  fetchStatus={fetchWhatsAppStatus}
                />
              }
            />
            <Route
              path="/conversations"
              element={<Conversations />}
            />
            <Route
              path="/customers"
              element={<Customers />}
            />
            <Route
              path="/tools"
              element={<Tools />}
            />
            <Route
              path="/analytics"
              element={<Analytics />}
            />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  agentSettings={agentSettings}
                  fetchSettings={fetchSettings}
                />
              }
            />
            {/* Fallback to Overview */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Optional Auth Prompt Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <AuthModal
            initialMode="login"
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setShowAuthModal(false)}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <MainAppShell />
      </AuthProvider>
    </Router>
  );
}
