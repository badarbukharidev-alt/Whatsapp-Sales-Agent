import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import AdminSidebar from "../../components/AdminSidebar";
import AdminHeader from "../../components/AdminHeader";
import AdminDashboard from "./AdminDashboard";
import AdminUsers from "./AdminUsers";
import AdminPlans from "./AdminPlans";
import AdminEngines from "./AdminEngines";
import AdminDiagnostics from "./AdminDiagnostics";
import AdminAudit from "./AdminAudit";
import AdminDeepgram from "./AdminDeepgram";
import AdminDeployments from "./AdminDeployments";
import { User, AuditLog, SystemDiagnostics } from "../../types";

export default function AdminLayout() {
  const { user: currentAdmin, isAdmin } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch admin ecosystem data
  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        axios.get("/api/admin/users"),
        axios.get("/api/admin/system-stats"),
      ]);

      if (usersRes.data?.users) {
        setUsers(usersRes.data.users);
      }
      if (statsRes.data) {
        setDiagnostics(statsRes.data.diagnostics);
        setAuditLogs(statsRes.data.auditLogs || []);
      }
    } catch (err: any) {
      console.error("Error fetching admin stats:", err);
      showToast(err?.response?.data?.error || "Failed to load admin data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await axios.post("/api/admin/system/clear-cache");
      showToast("System cache, Baileys sockets, and memory buffers purged.");
      fetchAdminData();
    } catch (err) {
      showToast("Failed to clear cache", "error");
    } finally {
      setIsClearingCache(false);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--ink)] font-sans overflow-hidden antialiased transition-colors duration-200">
      {/* Toast notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold transition-all animate-in slide-in-from-bottom-3 ${
            toastMessage.type === "error"
              ? "bg-red-600 text-white"
              : "bg-[#10b981] text-white"
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Admin Sidebar */}
      <AdminSidebar
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Admin Content View */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
        {/* Admin Header */}
        <AdminHeader
          onOpenMobile={() => setMobileSidebarOpen(true)}
          onClearCache={handleClearCache}
          isClearingCache={isClearingCache}
        />

        {/* Admin Subpages */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[var(--bg)]/60">
          <Routes>
            <Route
              index
              element={
                <AdminDashboard
                  users={users}
                  diagnostics={diagnostics}
                  loading={loading}
                  onRefresh={fetchAdminData}
                />
              }
            />
            <Route
              path="/admin"
              element={
                <AdminDashboard
                  users={users}
                  diagnostics={diagnostics}
                  loading={loading}
                  onRefresh={fetchAdminData}
                />
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <AdminDashboard
                  users={users}
                  diagnostics={diagnostics}
                  loading={loading}
                  onRefresh={fetchAdminData}
                />
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminUsers
                  users={users}
                  setUsers={setUsers}
                  currentAdmin={currentAdmin}
                  showToast={showToast}
                />
              }
            />
            <Route path="/admin/deepgram" element={<AdminDeepgram />} />
            <Route path="/admin/deployments" element={<AdminDeployments onToast={showToast} />} />
            <Route path="/admin/plans" element={<AdminPlans />} />
            <Route path="/admin/engines" element={<AdminEngines />} />
            <Route
              path="/admin/diagnostics"
              element={
                <AdminDiagnostics
                  diagnostics={diagnostics}
                  onRefresh={fetchAdminData}
                  showToast={showToast}
                />
              }
            />
            <Route
              path="/admin/audit"
              element={
                <AdminAudit
                  auditLogs={auditLogs}
                  onRefresh={fetchAdminData}
                  showToast={showToast}
                />
              }
            />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
