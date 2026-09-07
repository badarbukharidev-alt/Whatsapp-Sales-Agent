import React, { useState } from "react";
import axios from "axios";
import {
  Users,
  Search,
  Plus,
  ShieldCheck,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  Sliders,
  Key,
  Trash2,
  X,
  Lock,
  Mail,
  Building2,
  Phone,
  Sparkles,
  Layers,
  Cpu,
  AlertTriangle,
} from "lucide-react";
import { User, UserLimits } from "../../types";

const PLAN_PRESETS: Record<"Free" | "Pro" | "Agency" | "Enterprise", UserLimits> = {
  Free: {
    maxCampaigns: 2,
    maxTools: 5,
    dailyAiQuota: 1000,
    conversionLimit: 30,
    maxAiReplies: 30,
    maxConversations: 100,
    allowedAiModels: ["gemini"],
    hasAntiBanPriority: false,
    hasCustomBranding: false,
    hasPrioritySupport: false,
  },
  Pro: {
    maxCampaigns: 25,
    maxTools: 50,
    dailyAiQuota: 10000,
    conversionLimit: 250,
    maxAiReplies: 250,
    maxConversations: 1000,
    allowedAiModels: ["gemini", "deepseek-v3", "gptlogic"],
    hasAntiBanPriority: true,
    hasCustomBranding: false,
    hasPrioritySupport: false,
  },
  Agency: {
    maxCampaigns: 100,
    maxTools: 200,
    dailyAiQuota: 50000,
    conversionLimit: 1500,
    maxAiReplies: 1500,
    maxConversations: 5000,
    allowedAiModels: ["gemini", "claude-haiku", "deepseek-v3", "gptlogic"],
    hasAntiBanPriority: true,
    hasCustomBranding: true,
    hasPrioritySupport: true,
  },
  Enterprise: {
    maxCampaigns: 999,
    maxTools: 999,
    dailyAiQuota: 500000,
    conversionLimit: 99999,
    maxAiReplies: 99999,
    maxConversations: 99999,
    allowedAiModels: ["gemini", "claude-haiku", "deepseek-v3", "gptlogic"],
    hasAntiBanPriority: true,
    hasCustomBranding: true,
    hasPrioritySupport: true,
  },
};

interface AdminUsersProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentAdmin: User | null;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function AdminUsers({
  users,
  setUsers,
  currentAdmin,
  showToast,
}: AdminUsersProps) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "admin" | "user">("ALL");
  const [planFilter, setPlanFilter] = useState<"ALL" | "Free" | "Pro" | "Agency" | "Enterprise">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "suspended">("ALL");

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newPlan, setNewPlan] = useState<"Free" | "Pro" | "Agency" | "Enterprise">("Pro");
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Edit User / Quotas Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editPlan, setEditPlan] = useState<"Free" | "Pro" | "Agency" | "Enterprise">("Pro");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [editStatus, setEditStatus] = useState<"active" | "suspended">("active");
  const [editConversionLimit, setEditConversionLimit] = useState<number>(250);
  const [editMaxCampaigns, setEditMaxCampaigns] = useState<number>(25);
  const [editMaxTools, setEditMaxTools] = useState<number>(50);
  const [editMaxConversations, setEditMaxConversations] = useState<number>(1000);
  const [editDailyAiQuota, setEditDailyAiQuota] = useState<number>(10000);
  const [editAllowedModels, setEditAllowedModels] = useState<string[]>(["gemini", "deepseek-v3"]);
  const [editAntiBan, setEditAntiBan] = useState<boolean>(true);
  const [editBranding, setEditBranding] = useState<boolean>(false);
  const [editSupport, setEditSupport] = useState<boolean>(false);
  const [editResetPassword, setEditResetPassword] = useState<string>("");
  const [isSavingUserEdit, setIsSavingUserEdit] = useState(false);

  // Delete User Confirmation Modal
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.company && u.company.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchesPlan = planFilter === "ALL" || u.plan === planFilter;
    const matchesStatus = statusFilter === "ALL" || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesPlan && matchesStatus;
  });

  // Action: Toggle Status
  const handleToggleStatus = async (user: User) => {
    try {
      const nextStatus = user.status === "active" ? "suspended" : "active";
      const res = await axios.put(`/api/admin/users/${user.id}`, { status: nextStatus });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? res.data.user : u)));
      showToast(`User ${user.name} is now ${nextStatus}`);
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to update status", "error");
    }
  };

  // Action: Toggle Role
  const handleToggleRole = async (user: User) => {
    try {
      const nextRole = user.role === "admin" ? "user" : "admin";
      const res = await axios.put(`/api/admin/users/${user.id}`, { role: nextRole });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? res.data.user : u)));
      showToast(`User ${user.name} role changed to ${nextRole}`);
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to update role", "error");
    }
  };

  // Action: Change Plan Directly in Table
  const handleQuickPlanChange = async (user: User, newPlan: "Free" | "Pro" | "Agency" | "Enterprise") => {
    try {
      const defaultLimits = PLAN_PRESETS[newPlan];
      const res = await axios.put(`/api/admin/users/${user.id}`, {
        plan: newPlan,
        assignedLimits: defaultLimits,
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? res.data.user : u)));
      showToast(`User ${user.name} switched to ${newPlan} plan.`);
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to switch plan", "error");
    }
  };

  // Action: Open Edit User Modal
  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setEditPlan(user.plan || "Pro");
    setEditRole(user.role || "user");
    setEditStatus(user.status || "active");

    const limits = user.assignedLimits || PLAN_PRESETS[user.plan || "Pro"];
    setEditConversionLimit(limits.conversionLimit ?? 250);
    setEditMaxCampaigns(limits.maxCampaigns ?? 25);
    setEditMaxTools(limits.maxTools ?? 50);
    setEditMaxConversations(limits.maxConversations ?? 1000);
    setEditDailyAiQuota(limits.dailyAiQuota ?? 10000);
    setEditAllowedModels(limits.allowedAiModels ?? ["gemini"]);
    setEditAntiBan(limits.hasAntiBanPriority ?? true);
    setEditBranding(limits.hasCustomBranding ?? false);
    setEditSupport(limits.hasPrioritySupport ?? false);
    setEditResetPassword("");
  };

  // Apply Plan Preset to Edit Modal
  const applyPresetLimits = (plan: "Free" | "Pro" | "Agency" | "Enterprise") => {
    setEditPlan(plan);
    const p = PLAN_PRESETS[plan];
    setEditConversionLimit(p.conversionLimit);
    setEditMaxCampaigns(p.maxCampaigns);
    setEditMaxTools(p.maxTools);
    setEditMaxConversations(p.maxConversations);
    setEditDailyAiQuota(p.dailyAiQuota);
    setEditAllowedModels(p.allowedAiModels);
    setEditAntiBan(p.hasAntiBanPriority);
    setEditBranding(p.hasCustomBranding);
    setEditSupport(p.hasPrioritySupport);
  };

  // Action: Save User Edits
  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    setIsSavingUserEdit(true);
    try {
      const payload: any = {
        plan: editPlan,
        role: editRole,
        status: editStatus,
        assignedLimits: {
          conversionLimit: editConversionLimit,
          maxAiReplies: editConversionLimit,
          maxCampaigns: editMaxCampaigns,
          maxTools: editMaxTools,
          maxConversations: editMaxConversations,
          dailyAiQuota: editDailyAiQuota,
          allowedAiModels: editAllowedModels,
          hasAntiBanPriority: editAntiBan,
          hasCustomBranding: editBranding,
          hasPrioritySupport: editSupport,
        },
      };
      if (editResetPassword.trim().length >= 4) {
        payload.password = editResetPassword.trim();
      }

      const res = await axios.put(`/api/admin/users/${editingUser.id}`, payload);
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.data.user : u)));
      setEditingUser(null);
      setEditResetPassword("");
      showToast("Account plan, custom limits, and benefits saved successfully!");
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to save user edit", "error");
    } finally {
      setIsSavingUserEdit(false);
    }
  };

  // Action: Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) {
      showToast("Please fill in name, email and password", "error");
      return;
    }
    setIsCreatingUser(true);
    try {
      const res = await axios.post("/api/admin/users", {
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
        plan: newPlan,
        company: newCompany,
        phone: newPhone,
      });

      setUsers((prev) => [res.data.user, ...prev]);
      setShowCreateModal(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewCompany("");
      setNewPhone("");
      showToast(`User ${newName} created with ${newPlan} plan.`);
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to create user", "error");
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Action: Delete User
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await axios.delete(`/api/admin/users/${userToDelete.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setUserToDelete(null);
      showToast("User permanently deleted from the system.");
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to delete user", "error");
    } finally {
      setIsDeletingUser(false);
    }
  };

  const toggleAllowedModel = (modelKey: string) => {
    setEditAllowedModels((prev) =>
      prev.includes(modelKey) ? prev.filter((m) => m !== modelKey) : [...prev, modelKey]
    );
  };

  return (
    <div className="space-y-6">
      {/* Users Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">User Account Directory & Quotas</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Provision accounts, adjust conversion limits, assign subscription tiers, and configure AI benefits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search user, email, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-52"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e: any) => setRoleFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Roles</option>
              <option value="admin">Super Admin</option>
              <option value="user">Standard User</option>
            </select>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={(e: any) => setPlanFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Plans</option>
              <option value="Free">Free</option>
              <option value="Pro">Pro</option>
              <option value="Agency">Agency</option>
              <option value="Enterprise">Enterprise</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>

            {/* Add User Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">User / Company</th>
                <th className="py-3.5 px-6">Role</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Plan Tier</th>
                <th className="py-3.5 px-6">Conversion & Quota Limits</th>
                <th className="py-3.5 px-6">Enabled Benefits</th>
                <th className="py-3.5 px-6 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No accounts found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const limits = u.assignedLimits || PLAN_PRESETS[u.plan || "Pro"];
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              u.role === "admin"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {u.name}
                              {u.id === currentAdmin?.id && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-extrabold px-1.5 py-0.2 rounded">
                                  You (Admin)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                            {u.company && (
                              <div className="text-[11px] text-slate-400 font-medium">
                                {u.company} {u.phone && `• ${u.phone}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <button
                          onClick={() => handleToggleRole(u)}
                          disabled={u.id === currentAdmin?.id}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 ${
                            u.role === "admin"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                          }`}
                          title="Click to toggle Super Admin / Standard User role"
                        >
                          {u.role === "admin" ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Super Admin</span>
                            </>
                          ) : (
                            <>
                              <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                              <span>User</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-4 px-6">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={u.id === currentAdmin?.id}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 ${
                            u.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          }`}
                          title="Click to toggle active / suspended account state"
                        >
                          {u.status === "active" ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-red-600" />
                              <span>Suspended</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-4 px-6">
                        <select
                          value={u.plan || "Pro"}
                          onChange={(e: any) => handleQuickPlanChange(u, e.target.value)}
                          className={`text-xs font-black rounded-lg px-2.5 py-1 border transition-all cursor-pointer ${
                            u.plan === "Enterprise"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : u.plan === "Agency"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : u.plan === "Pro"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          <option value="Free">Free (Trial)</option>
                          <option value="Pro">Pro (Growth)</option>
                          <option value="Agency">Agency (Scale)</option>
                          <option value="Enterprise">Enterprise (Custom)</option>
                        </select>
                      </td>

                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <span>AI Replies:</span>
                            <span className="text-purple-700 font-extrabold">
                              {(limits.maxAiReplies ?? limits.conversionLimit) >= 99999 ? "Unlimited" : (limits.maxAiReplies ?? limits.conversionLimit)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {limits.maxCampaigns} Campaigns • {limits.maxTools} Tools
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1">
                          {limits.hasAntiBanPriority && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                              Anti-Ban
                            </span>
                          )}
                          {limits.hasCustomBranding && (
                            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                              Whitelabel
                            </span>
                          )}
                          {limits.hasPrioritySupport && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                              VIP Support
                            </span>
                          )}
                          <span className="text-[10px] bg-slate-100 text-slate-700 font-medium px-1.5 py-0.5 rounded">
                            {limits.allowedAiModels?.length || 1} AI Models
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Plan, Conversion Limits & AI Benefits"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>

                          {u.id !== currentAdmin?.id && (
                            <button
                              onClick={() => setUserToDelete(u)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete User Permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD USER */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Account</h3>
                  <p className="text-xs text-slate-500">Provision a sales agent user or administrator</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asad Qureshi"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="user@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company / Store</label>
                  <input
                    type="text"
                    placeholder="Store Name"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / Phone</label>
                  <input
                    type="text"
                    placeholder="+92 300 1234567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">System Role</label>
                  <select
                    value={newRole}
                    onChange={(e: any) => setNewRole(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subscription Plan</label>
                  <select
                    value={newPlan}
                    onChange={(e: any) => setNewPlan(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
                  >
                    <option value="Free">Free (30 AI Replies)</option>
                    <option value="Pro">Pro (250 AI Replies)</option>
                    <option value="Agency">Agency (1,500 AI Replies)</option>
                    <option value="Enterprise">Enterprise (Unlimited)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {isCreatingUser ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER & CUSTOM LIMITS */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Plan, Conversion Limits & Benefits
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modifying quotas for <span className="font-semibold text-slate-800">{editingUser.name}</span> ({editingUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plan Tier Selection Bar */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                1. Select Base Plan Tier
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["Free", "Pro", "Agency", "Enterprise"] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => applyPresetLimits(tier)}
                    className={`py-2.5 px-3 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                      editPlan === tier
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Quota Controls Grid */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                2. Custom Numeric Quotas & Conversion Caps
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1">
                    Monthly Chats
                  </span>
                  <input
                    type="number"
                    value={editMaxConversations}
                    onChange={(e) => setEditMaxConversations(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-700 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">WhatsApp conversations</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1">
                    Monthly AI Replies Cap
                  </span>
                  <input
                    type="number"
                    value={editConversionLimit}
                    onChange={(e) => setEditConversionLimit(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-purple-700 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">30 for Free, 99999 = Unlimited</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1">
                    Max Campaigns
                  </span>
                  <input
                    type="number"
                    value={editMaxCampaigns}
                    onChange={(e) => setEditMaxCampaigns(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Outreach groups</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1">
                    Max Tools
                  </span>
                  <input
                    type="number"
                    value={editMaxTools}
                    onChange={(e) => setEditMaxTools(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Products / Services</span>
                </div>
              </div>
            </div>

            {/* Allowed AI Engines */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                3. Allowed AI Engine Gateways
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: "gemini", label: "Gemini 2.5 Flash" },
                  { key: "claude-haiku", label: "Claude 3.5 Haiku" },
                  { key: "deepseek-v3", label: "DeepSeek V3" },
                  { key: "gptlogic", label: "Deterministic Rules" },
                ].map((eng) => {
                  const isEnabled = editAllowedModels.includes(eng.key);
                  return (
                    <button
                      key={eng.key}
                      type="button"
                      onClick={() => toggleAllowedModel(eng.key)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                        isEnabled
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <span className="truncate">{eng.label}</span>
                      {isEnabled ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority Feature Toggles */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                4. Priority SaaS Entitlements
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editAntiBan}
                    onChange={(e) => setEditAntiBan(e.target.checked)}
                    className="accent-emerald-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Anti-Ban Priority</span>
                    <span className="text-[10px] text-slate-500">Random jitter algorithm</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editBranding}
                    onChange={(e) => setEditBranding(e.target.checked)}
                    className="accent-emerald-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Custom Branding</span>
                    <span className="text-[10px] text-slate-500">Remove powered-by tag</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editSupport}
                    onChange={(e) => setEditSupport(e.target.checked)}
                    className="accent-emerald-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">VIP Support</span>
                    <span className="text-[10px] text-slate-500">Dedicated SLA response</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Password Reset Section */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                5. Reset User Password (Optional)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter new password to override, or leave blank to keep unchanged"
                  value={editResetPassword}
                  onChange={(e) => setEditResetPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUserEdit}
                disabled={isSavingUserEdit}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                {isSavingUserEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE USER CONFIRMATION */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete User Account?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-900">{userToDelete.name}</strong> ({userToDelete.email})?
                This action is irreversible and removes all their session tokens.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                {isDeletingUser ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
