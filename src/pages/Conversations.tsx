import React, { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  MessageSquare, 
  Search, 
  Trash2, 
  CheckCheck, 
  Clock, 
  Bot, 
  User, 
  Send, 
  Sparkles, 
  Wrench, 
  Tag, 
  AlertTriangle,
  Info,
  ChevronRight,
  MoreVertical,
  Check,
  CheckCircle2,
  Smartphone,
  Image as ImageIcon,
  ArrowLeft,
  History,
  ShieldCheck,
  AlertCircle,
  Plus,
  X
} from "lucide-react";
import { Customer, ChatMessage, CustomerStatus, CustomerList } from "../types";
import { formatRelativeTime, formatDateTime } from "../lib/utils";
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

export default function Conversations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lists, setLists] = useState<CustomerList[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(searchParams.get("phone"));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isDeleteChatModalOpen, setIsDeleteChatModalOpen] = useState(false);
  const [isDeleteCustomerModalOpen, setIsDeleteCustomerModalOpen] = useState(false);
  const [isVerifyOrderModalOpen, setIsVerifyOrderModalOpen] = useState(false);
  const [isAssignListsOpen, setIsAssignListsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const fetchData = async () => {
    try {
      const [custRes, listsRes] = await Promise.all([
        axios.get("/api/customers"),
        axios.get("/api/lists")
      ]);
      setCustomers(custRes.data || []);
      setLists(listsRes.data || []);
      
      // Default to first customer if none selected
      if (!selectedPhone && custRes.data && custRes.data.length > 0) {
        setSelectedPhone(custRes.data[0].phoneNumber);
      }
    } catch (err) {
      console.error("Failed to fetch conversation data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Update selected phone from URL query param
  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (phoneParam) {
      setSelectedPhone(phoneParam);
    }
  }, [searchParams]);

  // Selected Customer
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.phoneNumber === selectedPhone) || null;
  }, [customers, selectedPhone]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedCustomer?.messages?.length, selectedPhone]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch = 
        c.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.messages && c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())));

      if (!matchSearch) return false;
      if (statusFilter === "All") return true;

      // Status match
      if (ALL_STATUSES.includes(statusFilter as any)) {
        return (c.status || "New Customer").toLowerCase() === statusFilter.toLowerCase();
      }

      // Custom List match
      return c.listIds && c.listIds.includes(statusFilter);
    }).sort((a, b) => {
      const timeA = a.lastActivity || a.messages?.[a.messages.length - 1]?.timestamp || 0;
      const timeB = b.lastActivity || b.messages?.[b.messages.length - 1]?.timestamp || 0;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }, [customers, searchQuery, statusFilter]);

  const handleSelectCustomer = (phone: string) => {
    setSelectedPhone(phone);
    setSearchParams({ phone });
  };

  const handleUpdateStatus = async (newStatus: CustomerStatus) => {
    if (!selectedCustomer) return;
    try {
      await axios.put(`/api/customers/${selectedCustomer.phoneNumber}`, { 
        status: newStatus,
        reason: "Manual status update by admin from Conversations view"
      });
      setCustomers(prev => prev.map(c => c.phoneNumber === selectedCustomer.phoneNumber ? { 
        ...c, 
        previousStatus: c.status,
        status: newStatus,
        statusManagedBy: "Manual",
        statusReason: "Manual status update by admin",
        statusUpdatedAt: new Date().toISOString()
      } : c));
      showToast(`Status updated to "${newStatus}"`);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleVerifyOrder = async () => {
    if (!selectedCustomer) return;
    setActionLoading(true);
    try {
      await axios.post(`/api/customers/${selectedCustomer.phoneNumber}/verify-order`, {
        note: "Payment manually verified by admin from chat view."
      });
      setCustomers(prev => prev.map(c => c.phoneNumber === selectedCustomer.phoneNumber ? {
        ...c,
        previousStatus: "Payment Done",
        status: "Order Complete",
        statusManagedBy: "Manual",
        statusReason: "Payment manually verified by admin",
        statusUpdatedAt: new Date().toISOString()
      } : c));
      setIsVerifyOrderModalOpen(false);
      showToast("Order verified & marked Complete!");
    } catch (err) {
      console.error("Failed to verify order:", err);
      alert("Error verifying order.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleCustomerList = async (listId: string) => {
    if (!selectedCustomer) return;
    const currentListIds = selectedCustomer.listIds || [];
    const updatedIds = currentListIds.includes(listId)
      ? currentListIds.filter(id => id !== listId)
      : [...currentListIds, listId];

    try {
      await axios.post(`/api/customers/${selectedCustomer.phoneNumber}/lists`, { listIds: updatedIds });
      setCustomers(prev => prev.map(c => c.phoneNumber === selectedCustomer.phoneNumber ? { ...c, listIds: updatedIds } : c));
    } catch (err) {
      console.error("Failed to update customer lists:", err);
    }
  };

  // Delete Chat History Action
  const handleDeleteChatHistory = async () => {
    if (!selectedCustomer) return;
    setActionLoading(true);
    try {
      await axios.delete(`/api/customers/${selectedCustomer.phoneNumber}/messages`);
      setCustomers(prev => prev.map(c => c.phoneNumber === selectedCustomer.phoneNumber ? { ...c, messages: [] } : c));
      setIsDeleteChatModalOpen(false);
      showToast("Chat history deleted successfully.");
    } catch (err) {
      console.error("Failed to delete chat history:", err);
      alert("Error deleting chat history.");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Customer Action
  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    setActionLoading(true);
    try {
      await axios.delete(`/api/customers/${selectedCustomer.phoneNumber}`);
      setCustomers(prev => prev.filter(c => c.phoneNumber !== selectedCustomer.phoneNumber));
      setIsDeleteCustomerModalOpen(false);
      setSelectedPhone(null);
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

  const getStatusBadgeStyle = (status?: string) => {
    switch (status) {
      case "Interested":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Payment Pending":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "Payment Done":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Order Complete":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Follow Up":
        return "bg-slate-100 text-slate-700 border-slate-300";
      case "Important":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "New Customer":
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const customLists = useMemo(() => lists.filter(l => !l.isDefault), [lists]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* LEFT COLUMN: Customer Threads Inbox (Hidden on mobile if a customer is selected) */}
      <div className={`w-full lg:w-80 xl:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 h-full ${
        selectedPhone ? "hidden lg:flex" : "flex"
      }`}>
        {/* Search & Filters Header */}
        <div className="p-4 border-b border-slate-200/80 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900">Conversations</h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredCustomers.length} Threads
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by phone, name, or text..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            {["All", ...ALL_STATUSES].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                  statusFilter === tab
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Customer Threads List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">No conversations found</p>
              <p className="text-[11px] text-slate-400">Incoming WhatsApp messages will populate this inbox automatically.</p>
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const isSelected = c.phoneNumber === selectedPhone;
              const lastMsg = c.messages?.[c.messages.length - 1];
              const msgCount = c.messages?.length || 0;

              return (
                <div
                  key={c.phoneNumber}
                  onClick={() => handleSelectCustomer(c.phoneNumber)}
                  className={`p-3.5 cursor-pointer transition-all flex items-start gap-3 relative ${
                    isSelected 
                      ? "bg-emerald-50/70 border-l-4 border-emerald-500" 
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300">
                    {c.phoneNumber.slice(-2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {c.name ? `${c.name}` : c.phoneNumber}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {formatRelativeTime(lastMsg?.timestamp || c.lastActivity)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 truncate leading-snug">
                      {lastMsg ? (
                        <span>
                          {lastMsg.role === "agent" && <span className="text-emerald-600 font-semibold">AI: </span>}
                          {lastMsg.content}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">No message history</span>
                      )}
                    </p>

                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusBadgeStyle(c.status)}`}>
                        {c.status || "New Customer"}
                      </span>
                      {c.statusManagedBy === "AI managed" && (
                        <span className="text-[9px] text-emerald-600 flex items-center gap-0.5 font-bold">
                          <Sparkles className="w-2.5 h-2.5" />
                          AI
                        </span>
                      )}
                      {msgCount > 0 && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          • {msgCount} msgs
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: WhatsApp Chat & Customer Memory */}
      {selectedCustomer ? (
        <div className={`flex-1 flex flex-col h-full bg-[#E5DDD5]/40 overflow-hidden relative ${
          selectedPhone ? "flex" : "hidden lg:flex"
        }`}>
          {/* Chat Header */}
          <div className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shrink-0 shadow-xs z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile Back Button to inbox list */}
              <button
                onClick={() => {
                  setSelectedPhone(null);
                  setSearchParams({});
                }}
                className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
                title="Back to conversation list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{selectedCustomer.phoneNumber}</h3>
                  {selectedCustomer.name && (
                    <span className="text-[11px] sm:text-xs text-slate-500 truncate hidden xs:inline">({selectedCustomer.name})</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 truncate">
                  <span className="truncate">{formatRelativeTime(selectedCustomer.lastActivity)}</span>
                  <span>•</span>
                  <span className="truncate">{selectedCustomer.messages?.length || 0} msgs</span>
                </div>
              </div>
            </div>

            {/* Actions: Status selector, Verify order & Custom Lists */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* If Payment Done, show Verify Order button */}
              {selectedCustomer.status === "Payment Done" && (
                <button
                  onClick={() => setIsVerifyOrderModalOpen(true)}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                  title="Verify payment and mark Order Complete"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Verify Order</span>
                </button>
              )}

              {/* Status Dropdown */}
              <select
                value={selectedCustomer.status || "New Customer"}
                onChange={(e) => handleUpdateStatus(e.target.value as CustomerStatus)}
                className={`border rounded-lg px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-bold outline-none cursor-pointer max-w-[110px] sm:max-w-none ${getStatusBadgeStyle(selectedCustomer.status)}`}
              >
                {ALL_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              {/* Assign Custom Lists Button */}
              <button
                onClick={() => setIsAssignListsOpen(true)}
                className="p-1.5 sm:px-2.5 sm:py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] sm:text-xs font-bold transition-colors flex items-center gap-1"
                title="Assign custom list labels"
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Lists</span>
              </button>

              {/* Delete Chat History Button */}
              <button
                onClick={() => setIsDeleteChatModalOpen(true)}
                className="px-2 sm:px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] sm:text-xs font-bold transition-colors flex items-center gap-1"
                title="Permanently clear conversation messages for this customer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>

              {/* Delete Customer Button */}
              <button
                onClick={() => setIsDeleteCustomerModalOpen(true)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete customer entirely"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Customer Intelligence / Memory Card */}
            <div className="bg-white/95 backdrop-blur-xs p-4 rounded-xl border border-slate-200/90 shadow-sm max-w-2xl mx-auto space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>AI Memory & Customer Lifecycle</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${getStatusBadgeStyle(selectedCustomer.status)}`}>
                    {selectedCustomer.status || "New Customer"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    ({selectedCustomer.statusManagedBy || "AI managed"})
                  </span>
                </div>
              </div>

              {/* Payment Done Claim Banner */}
              {selectedCustomer.status === "Payment Done" && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                      <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Customer Claims Payment Transferred</span>
                    </div>
                    <button
                      onClick={() => setIsVerifyOrderModalOpen(true)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shrink-0 transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verify Payment
                    </button>
                  </div>

                  {selectedCustomer.paymentClaimEvidence?.messageSnippet && (
                    <p className="text-[11px] text-indigo-700 italic bg-white/80 p-2 rounded-lg border border-indigo-100 leading-snug">
                      "{selectedCustomer.paymentClaimEvidence.messageSnippet}"
                    </p>
                  )}
                </div>
              )}

              {/* Status Reason & Evidence */}
              {selectedCustomer.statusReason && (
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-0.5">Status Evidence:</span>
                  <p>{selectedCustomer.statusReason}</p>
                  {selectedCustomer.previousStatus && (
                    <span className="text-[10px] text-slate-400 block mt-1">Previous Status: {selectedCustomer.previousStatus}</span>
                  )}
                </div>
              )}

              {/* Summary */}
              {selectedCustomer.summary && (
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  "{selectedCustomer.summary}"
                </p>
              )}

              {/* Custom Lists Tags */}
              {selectedCustomer.listIds && selectedCustomer.listIds.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Custom Lists:</span>
                  {selectedCustomer.listIds.map(lid => {
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

              {/* Interested Tools */}
              {selectedCustomer.interestedTools && selectedCustomer.interestedTools.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Interested In:</span>
                  {selectedCustomer.interestedTools.map((t, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Status Audit History */}
              {selectedCustomer.statusHistory && selectedCustomer.statusHistory.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 mb-1">
                    <History className="w-3 h-3 text-slate-400" />
                    <span>Status Transition Audit Trail:</span>
                  </div>
                  <div className="space-y-1">
                    {selectedCustomer.statusHistory.slice(-4).reverse().map((h, hIdx) => (
                      <div key={hIdx} className="text-[10px] text-slate-500 flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-700">
                          {h.fromStatus ? `${h.fromStatus} → ` : ""}{h.toStatus} <span className="font-normal text-slate-400">({h.updatedBy || h.changedBy})</span>
                        </span>
                        <span className="text-slate-400 shrink-0">{formatRelativeTime(h.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Conversation Messages */}
            {!selectedCustomer.messages || selectedCustomer.messages.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">No message history for this customer</h4>
                <p className="text-xs text-slate-400">
                  Chat history was cleared or this customer hasn't messaged yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-w-3xl mx-auto">
                {selectedCustomer.messages.map((msg, idx) => {
                  const isAgent = msg.role === "agent";

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isAgent ? "items-end" : "items-start"}`}
                    >
                      <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-xs text-xs space-y-1.5 ${
                        isAgent 
                          ? "bg-[#DCF8C6] text-slate-900 border border-[#c5e8ab] rounded-tr-none" 
                          : "bg-white text-slate-900 border border-slate-200 rounded-tl-none"
                      }`}>
                        <div className="flex items-center justify-between gap-3 text-[10px] font-bold opacity-75">
                          <span className="flex items-center gap-1">
                            {isAgent ? <Bot className="w-3 h-3 text-emerald-700" /> : <User className="w-3 h-3 text-slate-500" />}
                            {isAgent ? "AgentAI (Autonomous)" : "Customer"}
                          </span>
                          <span className="font-medium text-[9px]">{formatDateTime(msg.timestamp)}</span>
                        </div>

                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                        {msg.imageUrl && (
                          <div className="pt-1.5">
                            <img 
                              src={msg.imageUrl} 
                              alt="Attached Media" 
                              className="max-h-48 rounded-lg border border-slate-200 object-cover" 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>
            )}
          </div>

          {/* Bottom Chat Bar Indicator */}
          <div className="p-3 bg-white border-t border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            <span>Autonomous Sales Agent is actively managing this WhatsApp conversation.</span>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-8 bg-slate-50 text-slate-400">
          <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-700">Select a Conversation</h3>
          <p className="text-xs text-slate-500 max-w-sm text-center mt-1">
            Choose a customer from the left column to view their live WhatsApp dialogue, memory, and product interests.
          </p>
        </div>
      )}

      {/* MODAL: Assign Custom Lists Modal */}
      {isAssignListsOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Assign Custom Lists</h3>
                <p className="text-xs text-slate-500">{selectedCustomer.phoneNumber}</p>
              </div>
              <button
                onClick={() => setIsAssignListsOpen(false)}
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
                    setIsAssignListsOpen(false);
                    navigate("/customers");
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl"
                >
                  Manage Lists in Customer Directory
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {customLists.map(list => {
                  const isChecked = (selectedCustomer.listIds || []).includes(list.id);

                  return (
                    <label
                      key={list.id}
                      onClick={() => handleToggleCustomerList(list.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked 
                          ? "bg-indigo-50/80 border-indigo-300 text-indigo-900" 
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: list.color }} />
                        <span className="text-xs font-bold">{list.name}</span>
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
                onClick={() => setIsAssignListsOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Order Modal */}
      <ConfirmModal
        isOpen={isVerifyOrderModalOpen}
        onClose={() => setIsVerifyOrderModalOpen(false)}
        onConfirm={handleVerifyOrder}
        title="Verify Payment & Complete Order?"
        message={`Confirm manual payment verification for ${selectedCustomer?.phoneNumber}. This will update the status to 'Order Complete'.`}
        confirmText="Verify & Complete Order"
        cancelText="Cancel"
        isDestructive={false}
        isLoading={actionLoading}
      />

      {/* Confirmation Modal 1: Delete Chat History */}
      <ConfirmModal
        isOpen={isDeleteChatModalOpen}
        onClose={() => setIsDeleteChatModalOpen(false)}
        onConfirm={handleDeleteChatHistory}
        title="Delete chat history?"
        message="This will permanently delete the stored conversation history for this customer. Customer profile/memory will remain intact."
        confirmText="Delete History"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={actionLoading}
      />

      {/* Confirmation Modal 2: Delete Entire Customer */}
      <ConfirmModal
        isOpen={isDeleteCustomerModalOpen}
        onClose={() => setIsDeleteCustomerModalOpen(false)}
        onConfirm={handleDeleteCustomer}
        title="Delete customer permanently?"
        message={`Are you sure you want to remove customer ${selectedCustomer?.phoneNumber}? All memory and history will be permanently deleted.`}
        confirmText="Delete Customer"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={actionLoading}
      />
    </div>
  );
}
