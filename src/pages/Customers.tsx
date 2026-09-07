import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { 
  Users, 
  Search, 
  MessageSquare, 
  Smartphone, 
  Trash2, 
  Check, 
  CheckCircle2,
  Clock, 
  Sparkles, 
  ArrowUpRight,
  Filter,
  ShieldCheck,
  Star,
  AlertCircle,
  Plus,
  Tag,
  Edit2,
  X,
  Layers,
  ChevronRight,
  Info,
  ExternalLink,
  ShieldAlert,
  FolderPlus
} from "lucide-react";
import { Customer, CustomerStatus, CustomerList, WhatsAppLabelSyncStatus } from "../types";
import { formatRelativeTime } from "../lib/utils";
import ConfirmModal from "../components/ConfirmModal";

const ALL_STATUSES: CustomerStatus[] = [
  "New Customer",
  "Interested",
  "Payment Pending",
  "Payment Done",
  "Order Complete",
  "Follow Up",
  "Important"
];

const PRESET_COLORS = [
  "#F59E0B", // Amber
  "#3B82F6", // Blue
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#10B981", // Emerald
  "#64748B", // Slate
  "#F43F5E", // Rose
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
  "#EC4899", // Pink
];

export default function Customers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lists, setLists] = useState<CustomerList[]>([]);
  const [syncStatus, setSyncStatus] = useState<WhatsAppLabelSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected filter from URL or state (can be status name or list id)
  const [activeFilter, setActiveFilter] = useState<string>(searchParams.get("filter") || "All");

  // Modals & Action States
  const [customerToDeleteChat, setCustomerToDeleteChat] = useState<Customer | null>(null);
  const [customerToDeleteEntirely, setCustomerToDeleteEntirely] = useState<Customer | null>(null);
  const [customerToVerify, setCustomerToVerify] = useState<Customer | null>(null);
  const [customerForCustomLists, setCustomerForCustomLists] = useState<Customer | null>(null);
  const [isListManagerOpen, setIsListManagerOpen] = useState(false);
  const [editingList, setEditingList] = useState<CustomerList | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState("#6366F1");
  const [newListDesc, setNewListDesc] = useState("");
  const [evidenceCustomer, setEvidenceCustomer] = useState<Customer | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadAllData = async () => {
    try {
      const [custRes, listsRes, syncRes] = await Promise.all([
        axios.get("/api/customers"),
        axios.get("/api/lists"),
        axios.get("/api/lists/sync-status")
      ]);
      setCustomers(custRes.data || []);
      setLists(listsRes.data || []);
      setSyncStatus(syncRes.data || null);
    } catch (err) {
      console.error("Failed to fetch customer & list data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update status
  const handleUpdateStatus = async (phone: string, status: CustomerStatus, reason?: string) => {
    try {
      await axios.put(`/api/customers/${phone}`, { 
        status, 
        reason: reason || "Manual status change by admin"
      });
      setCustomers(prev => prev.map(c => c.phoneNumber === phone ? { 
        ...c, 
        previousStatus: c.status,
        status,
        statusManagedBy: "Manual",
        statusReason: reason || "Manual status change by admin",
        statusUpdatedAt: new Date().toISOString()
      } : c));
      showToast(`Status updated to "${status}" (Manual)`);
      loadAllData();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  // Verify payment & mark complete
  const handleVerifyOrder = async () => {
    if (!customerToVerify) return;
    setActionLoading(true);
    try {
      await axios.post(`/api/customers/${customerToVerify.phoneNumber}/verify-order`, {
        note: "Payment manually verified by admin in Customers page."
      });
      setCustomers(prev => prev.map(c => c.phoneNumber === customerToVerify.phoneNumber ? {
        ...c,
        previousStatus: "Payment Done",
        status: "Order Complete",
        statusManagedBy: "Manual",
        statusReason: "Payment manually verified by admin",
        statusUpdatedAt: new Date().toISOString()
      } : c));
      setCustomerToVerify(null);
      showToast("Order verified & marked Complete!");
      loadAllData();
    } catch (err) {
      console.error("Failed to verify order:", err);
      alert("Failed to verify order.");
    } finally {
      setActionLoading(false);
    }
  };

  // Custom List Operations
  const handleSaveCustomList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    setActionLoading(true);
    try {
      if (editingList) {
        await axios.put(`/api/lists/${editingList.id}`, {
          name: newListName.trim(),
          color: newListColor,
          description: newListDesc.trim()
        });
        showToast(`List "${newListName}" updated.`);
      } else {
        await axios.post("/api/lists", {
          name: newListName.trim(),
          color: newListColor,
          description: newListDesc.trim()
        });
        showToast(`Custom list "${newListName}" created.`);
      }
      setEditingList(null);
      setNewListName("");
      setNewListDesc("");
      loadAllData();
    } catch (err) {
      console.error("Failed to save list:", err);
      alert("Failed to save list.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!confirm(`Delete custom list "${listName}"? (Customers will remain intact)`)) return;
    try {
      await axios.delete(`/api/lists/${listId}`);
      showToast(`List "${listName}" deleted.`);
      if (activeFilter === listId) setActiveFilter("All");
      loadAllData();
    } catch (err) {
      console.error("Failed to delete list:", err);
      alert("Failed to delete list.");
    }
  };

  const handleToggleCustomerList = async (customer: Customer, listId: string) => {
    const currentListIds = customer.listIds || [];
    const updatedIds = currentListIds.includes(listId)
      ? currentListIds.filter(id => id !== listId)
      : [...currentListIds, listId];

    try {
      await axios.post(`/api/customers/${customer.phoneNumber}/lists`, { listIds: updatedIds });
      setCustomers(prev => prev.map(c => c.phoneNumber === customer.phoneNumber ? { ...c, listIds: updatedIds } : c));
      if (customerForCustomLists && customerForCustomLists.phoneNumber === customer.phoneNumber) {
        setCustomerForCustomLists(prev => prev ? { ...prev, listIds: updatedIds } : null);
      }
      loadAllData();
    } catch (err) {
      console.error("Failed to update customer lists:", err);
    }
  };

  const handleDeleteChatHistory = async () => {
    if (!customerToDeleteChat) return;
    setActionLoading(true);
    try {
      await axios.delete(`/api/customers/${customerToDeleteChat.phoneNumber}/messages`);
      setCustomers(prev => prev.map(c => c.phoneNumber === customerToDeleteChat.phoneNumber ? { ...c, messages: [] } : c));
      setCustomerToDeleteChat(null);
      showToast("Chat history deleted successfully.");
    } catch (err) {
      console.error("Failed to delete chat history:", err);
      alert("Error deleting chat history.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDeleteEntirely) return;
    setActionLoading(true);
    try {
      await axios.delete(`/api/customers/${customerToDeleteEntirely.phoneNumber}`);
      setCustomers(prev => prev.filter(c => c.phoneNumber !== customerToDeleteEntirely.phoneNumber));
      setCustomerToDeleteEntirely(null);
      showToast("Customer deleted successfully.");
    } catch (err) {
      console.error("Failed to delete customer:", err);
      alert("Error deleting customer.");
    } finally {
      setActionLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        c.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.summary && c.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.statusReason && c.statusReason.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;
      if (activeFilter === "All") return true;

      // Check if filter is a status name
      if (ALL_STATUSES.includes(activeFilter as any)) {
        return (c.status || "New Customer").toLowerCase() === activeFilter.toLowerCase();
      }

      // Check if filter is a custom list ID
      return c.listIds && c.listIds.includes(activeFilter);
    }).sort((a, b) => {
      const timeA = a.lastActivity || a.messages?.[a.messages.length - 1]?.timestamp || 0;
      const timeB = b.lastActivity || b.messages?.[b.messages.length - 1]?.timestamp || 0;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }, [customers, searchQuery, activeFilter]);

  const getStatusBadgeStyle = (status?: string) => {
    switch (status) {
      case "Interested":
        return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" };
      case "Payment Pending":
        return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" };
      case "Payment Done":
        return { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500" };
      case "Order Complete":
        return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" };
      case "Follow Up":
        return { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", dot: "bg-slate-500" };
      case "Important":
        return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500" };
      case "New Customer":
      default:
        return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" };
    }
  };

  const customLists = useMemo(() => lists.filter(l => !l.isDefault), [lists]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Header Banner with Custom Lists Manager */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200 uppercase tracking-wider">
              Customer Lists & CRM
            </span>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {customers.length} Total Contacts
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            WhatsApp Customer Lists & Lifecycle
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Automated status transitions, claim verification, custom segmented lists, and persistent memory history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditingList(null);
              setNewListName("");
              setNewListDesc("");
              setNewListColor("#6366F1");
              setIsListManagerOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shadow-2xs"
          >
            <FolderPlus className="w-4 h-4" />
            Manage Custom Lists
          </button>

          <button
            onClick={() => navigate("/conversations")}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shadow-2xs"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Open Conversations
          </button>
        </div>
      </div>

      {/* WhatsApp Native Sync Status Card */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
            <Smartphone className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">WhatsApp List & Label Synchronization:</span>
              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                syncStatus?.isSupported 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                  : "bg-slate-200 text-slate-700 border-slate-300"
              }`}>
                {syncStatus?.isSupported ? "Native Labels Active" : "Internal CRM Mode"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {syncStatus?.reason || "Internal CRM lists are automatically active and persistent across AI memory."}
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate("/settings")}
          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto hover:underline"
        >
          View Settings
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filter & Search Bar with All Default and Custom Lists */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search phone number, name, reason..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Dynamic Lists Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 lg:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveFilter("All")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === "All"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Contacts ({customers.length})
          </button>

          {/* Default Status Lists */}
          {ALL_STATUSES.map((st) => {
            const count = customers.filter(c => (c.status || "New Customer").toLowerCase() === st.toLowerCase()).length;
            const isSelected = activeFilter === st;

            return (
              <button
                key={st}
                onClick={() => setActiveFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{st}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isSelected ? "bg-white/20 text-white" : "bg-white text-slate-700 border border-slate-200"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Custom Lists Tabs */}
          {customLists.map((cl) => {
            const count = customers.filter(c => c.listIds && c.listIds.includes(cl.id)).length;
            const isSelected = activeFilter === cl.id;

            return (
              <button
                key={cl.id}
                onClick={() => setActiveFilter(cl.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-indigo-50/70 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cl.color }} />
                <span>{cl.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isSelected ? "bg-white/20 text-white" : "bg-white text-indigo-800 border border-indigo-200"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Customers List View */}
      {filteredCustomers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 space-y-3">
          <Users className="w-10 h-10 mx-auto text-slate-300" />
          <h3 className="text-sm font-bold text-slate-700">No Customers Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No contacts match the current list filter or search criteria.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards (< md) */}
          <div className="md:hidden space-y-3">
            {filteredCustomers.map((c) => {
              const msgCount = c.messages?.length || 0;
              const lastMsg = c.messages?.[c.messages.length - 1];
              const isPaymentDone = c.status === "Payment Done";
              const style = getStatusBadgeStyle(c.status);
              const isAi = c.statusManagedBy === "AI managed";

              return (
                <div 
                  key={c.phoneNumber}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {c.phoneNumber.slice(-2)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 block text-xs truncate">
                          {c.name ? `${c.name} (${c.phoneNumber})` : c.phoneNumber}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(c.lastActivity || lastMsg?.timestamp)}</span>
                          <span>•</span>
                          <span>{msgCount} msgs</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        value={c.status || "New Customer"}
                        onChange={(e) => handleUpdateStatus(c.phoneNumber, e.target.value as CustomerStatus)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border outline-none cursor-pointer ${style.bg} ${style.text} ${style.border}`}
                      >
                        {ALL_STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Status Info & Reason */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 truncate">
                      {isAi ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold">
                          <Sparkles className="w-3 h-3" />
                          AI Managed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-700 font-bold">
                          <ShieldCheck className="w-3 h-3 text-slate-500" />
                          Manual
                        </span>
                      )}
                      {c.statusReason && (
                        <span className="truncate text-slate-500">• {c.statusReason}</span>
                      )}
                    </div>
                    {c.previousStatus && (
                      <span className="text-slate-400 shrink-0">Prev: {c.previousStatus}</span>
                    )}
                  </div>

                  {/* Payment Done Verification Banner */}
                  {isPaymentDone && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                          <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>Payment Claimed (Unverified)</span>
                        </div>
                        <button
                          onClick={() => setCustomerToVerify(c)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shrink-0 transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verify Payment
                        </button>
                      </div>

                      {c.paymentClaimEvidence?.messageSnippet && (
                        <p className="text-[11px] text-indigo-700 italic bg-white/70 p-2 rounded-lg border border-indigo-100 leading-snug">
                          "{c.paymentClaimEvidence.messageSnippet}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Custom Lists Membership */}
                  {c.listIds && c.listIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Custom Lists:</span>
                      {c.listIds.map(lid => {
                        const targetList = lists.find(l => l.id === lid);
                        if (!targetList) return null;
                        return (
                          <span
                            key={lid}
                            className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: targetList.color }} />
                            {targetList.name}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Summary / Last Message */}
                  {c.summary ? (
                    <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-snug">
                      "{c.summary}"
                    </p>
                  ) : lastMsg ? (
                    <p className="text-[11px] text-slate-500 truncate">
                      "{lastMsg.content}"
                    </p>
                  ) : null}

                  {/* Mobile Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => navigate(`/conversations?phone=${c.phoneNumber}`)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Open Chat
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCustomerForCustomLists(c)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        title="Assign custom lists"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCustomerToDeleteChat(c)}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                        title="Delete chat history only"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCustomerToDeleteEntirely(c)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete customer entirely"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-3.5 px-6">Customer</th>
                    <th className="py-3.5 px-4">List / Status</th>
                    <th className="py-3.5 px-4">Custom Lists</th>
                    <th className="py-3.5 px-4">Latest Evidence / Reason</th>
                    <th className="py-3.5 px-4">Activity</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredCustomers.map((c) => {
                    const msgCount = c.messages?.length || 0;
                    const lastMsg = c.messages?.[c.messages.length - 1];
                    const isPaymentDone = c.status === "Payment Done";
                    const style = getStatusBadgeStyle(c.status);
                    const isAi = c.statusManagedBy === "AI managed";

                    return (
                      <tr key={c.phoneNumber} className="hover:bg-slate-50/80 transition-colors">
                        {/* Customer Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {c.phoneNumber.slice(-2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 block text-xs">
                                  {c.name ? `${c.name} (${c.phoneNumber})` : c.phoneNumber}
                                </span>
                              </div>
                              {c.summary ? (
                                <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5 italic">
                                  "{c.summary}"
                                </p>
                              ) : lastMsg ? (
                                <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                  "{lastMsg.content}"
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">No messages yet</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status + State */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1.5">
                              <select
                                value={c.status || "New Customer"}
                                onChange={(e) => handleUpdateStatus(c.phoneNumber, e.target.value as CustomerStatus)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer transition-colors ${style.bg} ${style.text} ${style.border}`}
                              >
                                {ALL_STATUSES.map((st) => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                              </select>

                              {isAi ? (
                                <span className="p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200" title="AI Managed automatically based on conversation">
                                  <Sparkles className="w-3 h-3" />
                                </span>
                              ) : (
                                <span className="p-1 rounded bg-slate-100 text-slate-600 border border-slate-200" title="Manual status set by Admin">
                                  <ShieldCheck className="w-3 h-3" />
                                </span>
                              )}
                            </div>

                            {isPaymentDone && (
                              <button
                                onClick={() => setCustomerToVerify(c)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-colors flex items-center gap-1 shadow-2xs mt-0.5"
                                title="Verify manual payment and complete order"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Verify Order
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Custom Lists */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                            {c.listIds && c.listIds.length > 0 ? (
                              c.listIds.map(lid => {
                                const targetList = lists.find(l => l.id === lid);
                                if (!targetList) return null;
                                return (
                                  <span
                                    key={lid}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 flex items-center gap-1"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: targetList.color }} />
                                    {targetList.name}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[11px] text-slate-400">None</span>
                            )}

                            <button
                              onClick={() => setCustomerForCustomLists(c)}
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded border border-transparent hover:border-indigo-200 transition-colors"
                              title="Assign custom lists"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Evidence & Reason */}
                        <td className="py-4 px-4 max-w-xs">
                          {c.statusReason ? (
                            <div className="text-[11px] text-slate-600 leading-snug">
                              <span className="block font-medium text-slate-800">{c.statusReason}</span>
                              {c.previousStatus && (
                                <span className="text-[10px] text-slate-400">Moved from {c.previousStatus}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Standard inquiry</span>
                          )}
                        </td>

                        {/* Activity */}
                        <td className="py-4 px-4 text-slate-500 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatRelativeTime(c.lastActivity || lastMsg?.timestamp)}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{msgCount} messages</span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => navigate(`/conversations?phone=${c.phoneNumber}`)}
                              className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                              title="Open Chat"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Chat
                            </button>

                            <button
                              onClick={() => setCustomerForCustomLists(c)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Manage Custom Lists"
                            >
                              <Tag className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setCustomerToDeleteChat(c)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Delete Chat History only"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setCustomerToDeleteEntirely(c)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Customer profile & history"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL 1: Custom Lists Manager Modal */}
      {isListManagerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingList ? `Edit List: ${editingList.name}` : "Create & Manage Custom Lists"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsListManagerOpen(false);
                  setEditingList(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List Creation Form */}
            <form onSubmit={handleSaveCustomList} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {editingList ? "Update List Information" : "Create New Custom List"}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">List Name</label>
                  <input
                    type="text"
                    required
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g. VIP Resellers, Ramadan Promo"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Badge Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newListColor}
                      onChange={(e) => setNewListColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5"
                    />
                    <div className="flex items-center gap-1 overflow-x-auto py-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewListColor(c)}
                          className="w-5 h-5 rounded-full border border-slate-200 shrink-0"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Description / Purpose (Optional)</label>
                <input
                  type="text"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  placeholder="e.g. High value customers requesting bulk pricing"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {editingList && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingList(null);
                      setNewListName("");
                      setNewListDesc("");
                      setNewListColor("#6366F1");
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={actionLoading || !newListName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                >
                  {editingList ? "Update List" : "Create List"}
                </button>
              </div>
            </form>

            {/* Existing Custom Lists */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700">Existing Custom Lists ({customLists.length})</h4>
              {customLists.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No custom lists created yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                  {customLists.map(list => (
                    <div key={list.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 block truncate">{list.name}</span>
                          {list.description && (
                            <span className="text-[10px] text-slate-400 truncate block">{list.description}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingList(list);
                            setNewListName(list.name);
                            setNewListColor(list.color);
                            setNewListDesc(list.description || "");
                          }}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                          title="Edit List"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteList(list.id, list.name)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete List"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Assign Customer to Custom Lists Modal */}
      {customerForCustomLists && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Assign Custom Lists</h3>
                <p className="text-xs text-slate-500">
                  {customerForCustomLists.name ? `${customerForCustomLists.name} (${customerForCustomLists.phoneNumber})` : customerForCustomLists.phoneNumber}
                </p>
              </div>
              <button
                onClick={() => setCustomerForCustomLists(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {customLists.length === 0 ? (
              <div className="p-6 text-center text-slate-400 space-y-2">
                <p className="text-xs">No custom lists created yet.</p>
                <button
                  onClick={() => {
                    setCustomerForCustomLists(null);
                    setIsListManagerOpen(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl"
                >
                  Create Custom List
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {customLists.map(list => {
                  const isChecked = (customerForCustomLists.listIds || []).includes(list.id);

                  return (
                    <label
                      key={list.id}
                      onClick={() => handleToggleCustomerList(customerForCustomLists, list.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked 
                          ? "bg-indigo-50/80 border-indigo-300 text-indigo-900" 
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: list.color }} />
                        <div>
                          <span className="text-xs font-bold block">{list.name}</span>
                          {list.description && (
                            <span className="text-[10px] text-slate-400 block">{list.description}</span>
                          )}
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                      }`}>
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setCustomerForCustomLists(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Payment & Complete Order Modal */}
      <ConfirmModal
        isOpen={!!customerToVerify}
        onClose={() => setCustomerToVerify(null)}
        onConfirm={handleVerifyOrder}
        title="Verify Payment & Complete Order?"
        message={`Confirm manual payment verification for ${customerToVerify?.phoneNumber}. This will update their status from 'Payment Done' to 'Order Complete' and mark evidence verified.`}
        confirmText="Verify & Complete Order"
        cancelText="Cancel"
        isDestructive={false}
        isLoading={actionLoading}
      />

      {/* Delete Chat History Modal */}
      <ConfirmModal
        isOpen={!!customerToDeleteChat}
        onClose={() => setCustomerToDeleteChat(null)}
        onConfirm={handleDeleteChatHistory}
        title="Delete chat history?"
        message="This will permanently delete the stored conversation history for this customer. Customer profile/memory will remain intact."
        confirmText="Delete History"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={actionLoading}
      />

      {/* Delete Entire Customer Modal */}
      <ConfirmModal
        isOpen={!!customerToDeleteEntirely}
        onClose={() => setCustomerToDeleteEntirely(null)}
        onConfirm={handleDeleteCustomer}
        title="Delete customer profile?"
        message={`Are you sure you want to completely remove ${customerToDeleteEntirely?.phoneNumber}? All memory notes, tool interests, and records will be deleted.`}
        confirmText="Delete Customer"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={actionLoading}
      />
    </div>
  );
}
