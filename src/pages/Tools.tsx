import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import { 
  Wrench, 
  Plus, 
  Edit2, 
  Trash2, 
  Image as ImageIcon, 
  Upload, 
  Eye, 
  X, 
  Check, 
  Sparkles, 
  Loader2, 
  Layers, 
  Search, 
  Power, 
  MessageSquare,
  BookOpen,
  Settings,
  HelpCircle,
  FileText,
  Link as LinkIcon,
  ExternalLink
} from "lucide-react";
import { Tool, ToolImage, Customer, ToolSection, ToolLink } from "../types";
import ConfirmModal from "../components/ConfirmModal";

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Add Tool Form States
  const [name, setName] = useState("");
  const [category, setCategory] = useState("AI Tools");
  const [rawInfo, setRawInfo] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit Modal State
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "ai" | "sales" | "sections" | "images" | "settings">("general");

  // Edit Form Fields
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [editDescription, setEditDescription] = useState("");
  const [editPricePkr, setEditPricePkr] = useState("");
  const [editPriceUsd, setEditPriceUsd] = useState("");
  const [editFeatures, setEditFeatures] = useState("");
  const [editSalesPoints, setEditSalesPoints] = useState("");
  const [editHowToUse, setEditHowToUse] = useState("");
  const [editLimitations, setEditLimitations] = useState("");
  const [editImages, setEditImages] = useState<ToolImage[]>([]);
  const [editAliases, setEditAliases] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editMinPkr, setEditMinPkr] = useState("");
  const [editMinUsd, setEditMinUsd] = useState("");
  const [editNegotiationNotes, setEditNegotiationNotes] = useState("");
  const [editSlotsRemaining, setEditSlotsRemaining] = useState("");
  const [editSlotsNote, setEditSlotsNote] = useState("");
  const [editObjectionTooExpensive, setEditObjectionTooExpensive] = useState("");
  const [editObjectionNeedTime, setEditObjectionNeedTime] = useState("");
  const [editObjectionCompetitor, setEditObjectionCompetitor] = useState("");
  const [editSections, setEditSections] = useState<ToolSection[]>([]);
  const [editSingleDynamicText, setEditSingleDynamicText] = useState("");
  const [editLinks, setEditLinks] = useState<ToolLink[]>([]);
  const [editRawDraft, setEditRawDraft] = useState("");

  // Saved Product Template Message
  const [editTemplateEnabled, setEditTemplateEnabled] = useState(false);
  const [editTemplateContent, setEditTemplateContent] = useState("");
  const [editTemplateSendOnce, setEditTemplateSendOnce] = useState(true);
  const [editTemplateVariables, setEditTemplateVariables] = useState(false);

  // Extended Product Sales Intelligence
  const [editIdealCustomer, setEditIdealCustomer] = useState("");
  const [editPainPoints, setEditPainPoints] = useState("");
  const [editPrimarySelling, setEditPrimarySelling] = useState("");
  const [editSecondarySelling, setEditSecondarySelling] = useState("");
  const [editValueArguments, setEditValueArguments] = useState("");
  const [editDiscoveryQuestions, setEditDiscoveryQuestions] = useState("");
  const [editCommonObjections, setEditCommonObjections] = useState("");
  const [editObjectionStrategy, setEditObjectionStrategy] = useState("");
  const [editNegotiationRules, setEditNegotiationRules] = useState("");
  const [editAllowedDiscounts, setEditAllowedDiscounts] = useState("");
  const [editUrgencyRules, setEditUrgencyRules] = useState("");
  const [editBuyingSignals, setEditBuyingSignals] = useState("");
  const [editClosingStrategy, setEditClosingStrategy] = useState("");
  const [editCrossSell, setEditCrossSell] = useState("");
  const [editSupportNotes, setEditSupportNotes] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Image Upload in Modal
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageTitle, setImageTitle] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Image Viewer & Delete Modals
  const [viewingImage, setViewingImage] = useState<ToolImage | null>(null);
  const [toolToDelete, setToolToDelete] = useState<Tool | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [toolsRes, custRes] = await Promise.all([
        axios.get("/api/tools"),
        axios.get("/api/customers"),
      ]);
      setTools(toolsRes.data || []);
      setCustomers(custRes.data || []);
    } catch (err) {
      console.error("Failed to fetch tools/customers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute conversation counts for each tool
  const toolsWithMetrics = useMemo(() => {
    return tools.map((tool) => {
      const toolNameLower = tool.name.toLowerCase();
      const keywords = (tool.features || []).map(f => f.toLowerCase());
      let count = 0;

      customers.forEach((c) => {
        if (c.messages && c.messages.length > 0) {
          const mentioned = c.messages.some(m => {
            const content = (m.content || "").toLowerCase();
            return content.includes(toolNameLower) || keywords.some(k => k.length > 4 && content.includes(k));
          });
          if (mentioned) count++;
        }
      });

      return {
        ...tool,
        conversationCount: count,
      };
    });
  }, [tools, customers]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    tools.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return ["All", ...Array.from(set)];
  }, [tools]);

  const filteredTools = useMemo(() => {
    return toolsWithMetrics.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.features && t.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase())));

      if (!matchSearch) return false;
      if (categoryFilter === "All") return true;
      return t.category === categoryFilter;
    });
  }, [toolsWithMetrics, searchQuery, categoryFilter]);

  // Add Tool with AI structuring
  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rawInfo) return;

    setIsAdding(true);
    try {
      const res = await axios.post("/api/tools", { 
        name, 
        rawInfo, 
        category,
        status: "active",
        images: [] 
      });
      setName("");
      setRawInfo("");
      setShowAddForm(false);
      await fetchData();
      showToast("Tool created and structured by AI successfully!");
    } catch (err) {
      console.error("Failed to add tool:", err);
      alert("Failed to create tool. Check server connection.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenEdit = (tool: Tool, initialTab: "general" | "ai" | "sales" | "images" | "settings" = "general") => {
    setEditingTool(tool);
    setActiveTab(initialTab);
    setEditName(tool.name);
    setEditCategory(tool.category || "AI Tools");
    setEditStatus(tool.status || "active");
    setEditDescription(tool.description || "");
    setEditPricePkr(tool.pricePkr || "");
    setEditPriceUsd(tool.priceUsd || "");
    setEditAliases((tool.aliases || []).join(", "));
    setEditKeywords((tool.keywords || []).join(", "));
    setEditMinPkr(tool.pricing?.min_negotiable_pkr ? String(tool.pricing.min_negotiable_pkr) : "");
    setEditMinUsd(tool.pricing?.min_negotiable_usd ? String(tool.pricing.min_negotiable_usd) : "");
    setEditNegotiationNotes(tool.pricing?.negotiation_notes || "");
    setEditSlotsRemaining(
      typeof tool.pricing?.slots_remaining === "number" ? String(tool.pricing.slots_remaining) : ""
    );
    setEditSlotsNote(tool.pricing?.slots_note || "");
    setEditObjectionTooExpensive(tool.objection_responses?.too_expensive || "");
    setEditObjectionNeedTime(tool.objection_responses?.need_time || "");
    setEditObjectionCompetitor(tool.objection_responses?.comparing_competitor || "");
    setEditFeatures((tool.features || []).join("\n"));
    setEditSalesPoints((tool.sales_points || []).join("\n"));
    setEditHowToUse(tool.how_to_use || "");
    setEditLimitations((tool.limitations || []).join("\n"));
    setEditImages(tool.images || []);
    setEditSections(tool.sections ? JSON.parse(JSON.stringify(tool.sections)) : []);
    const singleText = (tool.sections || []).map(s => (s.content || s.title).trim()).filter(Boolean).join("\n\n");
    setEditSingleDynamicText(singleText);
    setEditLinks(tool.links ? JSON.parse(JSON.stringify(tool.links)) : []);
    setEditRawDraft(tool.rawDraft || "");

    // Template message
    const tm = tool.templateMessage || {};
    setEditTemplateEnabled(Boolean(tm.enabled));
    setEditTemplateContent(tm.content || "");
    setEditTemplateSendOnce(tm.sendOnce !== false);
    setEditTemplateVariables(Boolean(tm.variablesEnabled));

    // Extended sales intelligence
    const sd = tool.sales || {};
    setEditIdealCustomer(sd.ideal_customer || "");
    setEditPainPoints((sd.pain_points || []).join("\n"));
    setEditPrimarySelling(sd.primary_selling_point || "");
    setEditSecondarySelling((sd.secondary_selling_points || []).join("\n"));
    setEditValueArguments((sd.value_arguments || []).join("\n"));
    setEditDiscoveryQuestions((sd.discovery_questions || []).join("\n"));
    setEditCommonObjections((sd.common_objections || []).join("\n"));
    setEditObjectionStrategy(sd.objection_strategy || "");
    setEditNegotiationRules(sd.negotiation_rules || "");
    setEditAllowedDiscounts(sd.allowed_discounts || "");
    setEditUrgencyRules(sd.urgency_rules || "");
    setEditBuyingSignals((sd.buying_signals || []).join("\n"));
    setEditClosingStrategy(sd.closing_strategy || "");
    setEditCrossSell(sd.cross_sell_rules || "");
    setEditSupportNotes(sd.support_notes || "");

    setSelectedFile(null);
    setPreviewUrl(null);
    setImageTitle("");
    setImageDescription("");
  };

  const handleAddSection = () => {
    setEditSections(prev => [...prev, { title: "New Dynamic Section", content: "" }]);
  };

  const handleUpdateSection = (index: number, field: "title" | "content", value: string) => {
    setEditSections(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteSection = (index: number) => {
    setEditSections(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLink = () => {
    setEditLinks(prev => [...prev, { title: "Direct Link / Download", url: "https://", note: "" }]);
  };

  const handleUpdateLink = (index: number, field: "title" | "url" | "note", value: string) => {
    setEditLinks(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteLink = (index: number) => {
    setEditLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleToolStatus = async (tool: Tool) => {
    const newStatus = tool.status === "inactive" ? "active" : "inactive";
    try {
      await axios.put(`/api/tools/${tool.id}`, { ...tool, status: newStatus });
      setTools(prev => prev.map(t => t.id === tool.id ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error("Failed to toggle status", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      if (!imageTitle) {
        setImageTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleUploadImage = async () => {
    if (!selectedFile || !imageDescription.trim() || !editingTool) {
      alert("Please select an image and provide a description for AI relevance.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const base64Data = await fileToBase64(selectedFile);
      const res = await axios.post("/api/tools/upload-image", {
        filename: selectedFile.name,
        data: base64Data,
        title: imageTitle.trim(),
        description: imageDescription.trim(),
        toolId: editingTool.id,
      });

      if (res.data.success && res.data.image) {
        setEditImages(prev => [...prev, res.data.image]);
        setSelectedFile(null);
        setPreviewUrl(null);
        setImageTitle("");
        setImageDescription("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        showToast("Image uploaded and linked to tool.");
      }
    } catch (err) {
      console.error("Failed to upload image", err);
      alert("Failed to upload image.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDeleteImage = (imageId: string) => {
    setEditImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTool) return;

    setIsSavingEdit(true);
    try {
      const updatedTool: Partial<Tool> = {
        ...editingTool,
        name: editName.trim(),
        category: editCategory.trim(),
        status: editStatus,
        description: editDescription.trim(),
        pricePkr: editPricePkr.trim() || undefined,
        priceUsd: editPriceUsd.trim() || undefined,
        aliases: editAliases.split(/[\n,]/).map(a => a.trim().toLowerCase()).filter(Boolean),
        keywords: editKeywords.split(/[\n,]/).map(k => k.trim().toLowerCase()).filter(Boolean),
        pricing: {
          ...(editingTool.pricing || {}),
          min_negotiable_pkr: editMinPkr.trim() ? parseInt(editMinPkr.trim(), 10) : undefined,
          min_negotiable_usd: editMinUsd.trim() ? parseInt(editMinUsd.trim(), 10) : undefined,
          negotiation_notes: editNegotiationNotes.trim() || undefined,
          slots_remaining: editSlotsRemaining.trim() !== "" ? parseInt(editSlotsRemaining.trim(), 10) : undefined,
          slots_note: editSlotsNote.trim() || undefined,
        },
        objection_responses: {
          ...(editingTool.objection_responses || {}),
          too_expensive: editObjectionTooExpensive.trim() || undefined,
          need_time: editObjectionNeedTime.trim() || undefined,
          comparing_competitor: editObjectionCompetitor.trim() || undefined,
        },
        features: editFeatures.split("\n").map(f => f.trim()).filter(Boolean),
        sales_points: editSalesPoints.split("\n").map(s => s.trim()).filter(Boolean),
        how_to_use: editHowToUse.trim(),
        limitations: editLimitations.split("\n").map(l => l.trim()).filter(Boolean),
        images: editImages,
        sections: editSingleDynamicText.trim()
          ? [{ id: "sec_1", title: "Constant Dynamic Knowledge Message", content: editSingleDynamicText.trim() }]
          : [],
        links: editLinks,
        rawDraft: editRawDraft,
        templateMessage: {
          enabled: editTemplateEnabled,
          content: editTemplateContent,
          sendOnce: editTemplateSendOnce,
          variablesEnabled: editTemplateVariables,
        },
        sales: {
          ...(editingTool.sales || {}),
          ideal_customer: editIdealCustomer.trim() || undefined,
          pain_points: editPainPoints.split("\n").map(s => s.trim()).filter(Boolean),
          primary_selling_point: editPrimarySelling.trim() || undefined,
          secondary_selling_points: editSecondarySelling.split("\n").map(s => s.trim()).filter(Boolean),
          value_arguments: editValueArguments.split("\n").map(s => s.trim()).filter(Boolean),
          discovery_questions: editDiscoveryQuestions.split("\n").map(s => s.trim()).filter(Boolean),
          common_objections: editCommonObjections.split("\n").map(s => s.trim()).filter(Boolean),
          objection_strategy: editObjectionStrategy.trim() || undefined,
          negotiation_rules: editNegotiationRules.trim() || undefined,
          allowed_discounts: editAllowedDiscounts.trim() || undefined,
          urgency_rules: editUrgencyRules.trim() || undefined,
          buying_signals: editBuyingSignals.split("\n").map(s => s.trim()).filter(Boolean),
          closing_strategy: editClosingStrategy.trim() || undefined,
          cross_sell_rules: editCrossSell.trim() || undefined,
          support_notes: editSupportNotes.trim() || undefined,
        },
      };

      await axios.put(`/api/tools/${editingTool.id}`, updatedTool);
      setEditingTool(null);
      await fetchData();
      showToast("Tool specifications updated successfully.");
    } catch (err) {
      console.error("Failed to update tool", err);
      alert("Failed to update tool.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteToolConfirm = async () => {
    if (!toolToDelete) return;
    try {
      await axios.delete(`/api/tools/${toolToDelete.id}`);
      setTools(prev => prev.filter(t => t.id !== toolToDelete.id));
      setToolToDelete(null);
      if (editingTool?.id === toolToDelete.id) setEditingTool(null);
      showToast("Tool deleted successfully.");
    } catch (err) {
      console.error("Failed to delete tool", err);
      alert("Failed to delete tool.");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-emerald-700 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 uppercase tracking-wider">
              Product Knowledge Base
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Tool Manager & Screenshots
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your AI tools, sales pitch angles, pricing specifications, and WhatsApp demo screenshots.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? "Close Form" : "Add New Tool"}
          </button>
        </div>
      </div>

      {/* ADD TOOL PANEL (SaaS Structured Form) */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-500/30 shadow-md animate-in slide-in-from-top-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Tool with Dynamic AI Extraction</h3>
                <p className="text-[11px] text-slate-500">Paste your complete draft (links, pricing, setup steps, technical notes). The AI will generate vast dynamic sections without losing any information.</p>
              </div>
            </div>

            <button 
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddTool} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tool Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VoiceDelta AI or ClipShield"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Category / Tag
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Voice AI / Video Tools / Automation"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Complete Tool Information, Draft, Links & Instructions
              </label>
              <textarea
                value={rawInfo}
                onChange={(e) => setRawInfo(e.target.value)}
                placeholder="Paste the entire product draft here including:&#10;- Description & what makes it the best tool&#10;- Direct download links or tutorial links (e.g. https://...)&#10;- Step-by-step setup and activation instructions&#10;- Pricing packages (monthly, lifetime, discount policies)&#10;- Key features and creator use cases&#10;&#10;Dynamic sections will be generated automatically for every topic!"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 h-36 resize-y outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding || !name || !rawInfo}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {isAdding ? "AI is Structuring Tool..." : "Extract & Save Tool"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools, features..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                categoryFilter === cat
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tools Cards Grid */}
      {filteredTools.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 space-y-3">
          <Wrench className="w-10 h-10 mx-auto text-slate-300" />
          <h3 className="text-sm font-bold text-slate-700">No tools configured yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click "Add New Tool" to teach the AI sales agent about your SaaS products and attach screenshots.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => {
            const isActive = tool.status !== "inactive";
            const imageCount = tool.images?.length || 0;

            return (
              <div 
                key={tool.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-4">
                  {/* Card Top: Name, Status & Category */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 truncate">{tool.name}</h3>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {tool.category || "AI Tool"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleToolStatus(tool)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        isActive 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                          : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                      }`}
                      title={isActive ? "Deactivate tool" : "Activate tool"}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {tool.description || "No description provided."}
                  </p>

                  {/* Pricing Badge */}
                  {(tool.pricePkr || tool.priceUsd) && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold font-mono">
                        {tool.pricePkr && `Rs. ${tool.pricePkr}`}
                        {tool.pricePkr && tool.priceUsd && ` • `}
                        {tool.priceUsd && `$${tool.priceUsd}`}
                        <span className="text-[10px] font-normal text-emerald-600">/mo</span>
                      </span>
                    </div>
                  )}

                  {/* Dynamic Sections & Links Badges */}
                  {((tool.sections && tool.sections.length > 0) || (tool.links && tool.links.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {tool.sections && tool.sections.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md text-[10px] font-bold">
                          <Layers className="w-3 h-3 text-emerald-600" />
                          {tool.sections.length} dynamic {tool.sections.length === 1 ? "section" : "sections"}
                        </span>
                      )}
                      {tool.links && tool.links.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200/80 rounded-md text-[10px] font-bold">
                          <LinkIcon className="w-3 h-3 text-sky-600" />
                          {tool.links.length} {tool.links.length === 1 ? "link" : "links"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Features Pill tags */}
                  {tool.features && tool.features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tool.features.slice(0, 3).map((f, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-medium truncate max-w-[150px]">
                          {f}
                        </span>
                      ))}
                      {tool.features.length > 3 && (
                        <span className="px-1.5 py-0.5 text-slate-400 text-[10px] font-medium">
                          +{tool.features.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Screenshots Thumbnail Gallery */}
                  {imageCount > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-2">
                        <span className="flex items-center gap-1.5 text-indigo-600">
                          <ImageIcon className="w-3.5 h-3.5" />
                          Attached Screenshots ({imageCount})
                        </span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {tool.images!.map((img) => (
                          <div
                            key={img.id}
                            onClick={() => setViewingImage(img)}
                            className="relative w-12 h-12 rounded-lg border border-slate-200 overflow-hidden shrink-0 cursor-pointer bg-slate-100 group/img"
                            title={`${img.title || "Screenshot"}: ${img.description}`}
                          >
                            <img
                              src={img.url || `/${img.filepath}`}
                              alt={img.title || "Screenshot"}
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats footer: Mentions */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                      {tool.conversationCount || 0} chats discussed
                    </span>
                    <span>{imageCount} media attached</span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="bg-slate-50/80 p-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenEdit(tool, "general")}
                    className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Specs
                  </button>

                  <button
                    onClick={() => handleOpenEdit(tool, "images")}
                    className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    title="Manage Screenshots"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Screenshots
                  </button>

                  <button
                    onClick={() => setToolToDelete(tool)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Delete tool"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4-TAB TOOL EDITOR MODAL */}
      {editingTool && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
          onClick={() => setEditingTool(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col text-slate-800 my-6 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Tool: {editingTool.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Update product features, Pakistani sales angles, and WhatsApp screenshot triggers.
                </p>
              </div>

              <button
                onClick={() => setEditingTool(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex border-b border-slate-200 px-5 gap-4 shrink-0 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "general"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                General
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "ai"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Knowledge & Sales
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("sales")}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "sales"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Sales & Template
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("sections")}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "sections"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Dynamic Sections ({editSections.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("images")}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "images"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Screenshots ({editImages.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === "settings"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* TAB 1: GENERAL */}
              {activeTab === "general" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Tool Name
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Category
                      </label>
                      <input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tool Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium outline-none focus:border-emerald-500 focus:bg-white"
                    >
                      <option value="active">Active (AI sells this tool)</option>
                      <option value="inactive">Inactive (AI ignores this tool)</option>
                    </select>
                  </div>

                  {/* Pricing Configuration */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Standard Price (PKR)
                        </label>
                        <input
                          type="text"
                          value={editPricePkr}
                          onChange={(e) => setEditPricePkr(e.target.value)}
                          placeholder="e.g. 1199 or 2500"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">Initial price AI quotes.</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Min Floor Price (PKR)
                        </label>
                        <input
                          type="text"
                          value={editMinPkr}
                          onChange={(e) => setEditMinPkr(e.target.value)}
                          placeholder="e.g. 999 (hard floor)"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">AI will NEVER drop below this floor.</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Price in USD (Optional)
                        </label>
                        <input
                          type="text"
                          value={editPriceUsd}
                          onChange={(e) => setEditPriceUsd(e.target.value)}
                          placeholder="e.g. 5 or 15"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Min Floor USD (Optional)
                        </label>
                        <input
                          type="text"
                          value={editMinUsd}
                          onChange={(e) => setEditMinUsd(e.target.value)}
                          placeholder="e.g. 4"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Negotiation Rules / Notes
                      </label>
                      <input
                        type="text"
                        value={editNegotiationNotes}
                        onChange={(e) => setEditNegotiationNotes(e.target.value)}
                        placeholder="e.g. Rate is fixed. Only drop to min floor if customer is leaving."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-200">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Slots / IDs Remaining (Optional)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editSlotsRemaining}
                          onChange={(e) => setEditSlotsRemaining(e.target.value)}
                          placeholder="e.g. 3"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 font-mono"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          ONLY set this if it's real. When set, the AI uses this exact number for urgency ("sirf X ID reh gaye"). Leave blank for no scarcity messaging — update it yourself as you sell out.
                        </span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Scarcity Reason (Optional)
                        </label>
                        <input
                          type="text"
                          value={editSlotsNote}
                          onChange={(e) => setEditSlotsNote(e.target.value)}
                          placeholder="e.g. manual HWID activation, batch of 10"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recognition Aliases & Keywords */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Aliases & Common Typos (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editAliases}
                        onChange={(e) => setEditAliases(e.target.value)}
                        placeholder="e.g. clipshied, clipsheild, clip shield"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">AI immediately recognizes customer typos as this tool.</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Detection Keywords (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editKeywords}
                        onChange={(e) => setEditKeywords(e.target.value)}
                        placeholder="e.g. copyright, strike, reuse, video protection"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Trigger words that connect user questions to this tool.</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Product Summary & Description
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white resize-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: AI KNOWLEDGE */}
              {activeTab === "ai" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Key Features (1 per line)
                    </label>
                    <textarea
                      value={editFeatures}
                      onChange={(e) => setEditFeatures(e.target.value)}
                      rows={3}
                      placeholder="Voice cloning in 5 seconds&#10;40+ languages with Urdu support&#10;Unlimited MP3 exports"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Sales Angles & Value Arguments (Pakistani Sales Pitch)
                    </label>
                    <textarea
                      value={editSalesPoints}
                      onChange={(e) => setEditSalesPoints(e.target.value)}
                      rows={3}
                      placeholder="Best for faceless YouTube documentary creators&#10;10x cheaper than ElevenLabs subscription&#10;JazzCash / EasyPaisa supported"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Objection Handling Scripts
                    </span>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        When Customer Says "Mehnga Hai / Too Expensive"
                      </label>
                      <input
                        type="text"
                        value={editObjectionTooExpensive}
                        onChange={(e) => setEditObjectionTooExpensive(e.target.value)}
                        placeholder="e.g. Bhai feature aur lifetime ROI dekhein, market se bohot sasta hai."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        When Customer Says "Soch Ke Batata Hun / Need Time"
                      </label>
                      <input
                        type="text"
                        value={editObjectionNeedTime}
                        onChange={(e) => setEditObjectionNeedTime(e.target.value)}
                        placeholder="e.g. Theek hai bhai! Koi jaldi nahi, jab bhi zaroorat ho rabta karein."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        When Customer Compares with Competitor
                      </label>
                      <input
                        type="text"
                        value={editObjectionCompetitor}
                        onChange={(e) => setEditObjectionCompetitor(e.target.value)}
                        placeholder="e.g. Humara tool local payments aur fast support deta hai jo unke paas nahi."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      How To Use / Workflow Guide
                    </label>
                    <textarea
                      value={editHowToUse}
                      onChange={(e) => setEditHowToUse(e.target.value)}
                      rows={2}
                      placeholder="Just upload 10 seconds of audio sample, type your script, and hit generate."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Limitations / Fair Usage Notes (1 per line)
                    </label>
                    <textarea
                      value={editLimitations}
                      onChange={(e) => setEditLimitations(e.target.value)}
                      rows={2}
                      placeholder="Requires decent microphone audio for best cloning&#10;Max 10,000 characters per single clip"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* TAB: SALES INTELLIGENCE & TEMPLATE MESSAGE */}
              {activeTab === "sales" && (
                <div className="space-y-5">
                  {/* Saved Product Template Message */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                          Template Message
                        </span>
                        <p className="text-[11px] text-emerald-800/80">
                          Message sent automatically (exactly as saved) when a customer first starts discussing this tool — before the AI reply.
                        </p>
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={editTemplateEnabled}
                          onChange={(e) => setEditTemplateEnabled(e.target.checked)}
                          className="accent-emerald-600 w-3.5 h-3.5"
                        />
                        Enable
                      </label>
                    </div>

                    <textarea
                      value={editTemplateContent}
                      onChange={(e) => setEditTemplateContent(e.target.value)}
                      rows={4}
                      placeholder={"VoiceDelta ke complete details yahan hain 👇\n[LINK]"}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-emerald-500 font-mono resize-y"
                    />

                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editTemplateSendOnce}
                          onChange={(e) => setEditTemplateSendOnce(e.target.checked)}
                          className="accent-emerald-600 w-3.5 h-3.5"
                        />
                        Send only once per conversation
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editTemplateVariables}
                          onChange={(e) => setEditTemplateVariables(e.target.checked)}
                          className="accent-emerald-600 w-3.5 h-3.5"
                        />
                        Enable variables
                      </label>
                    </div>

                    {editTemplateVariables && (
                      <p className="text-[10px] text-slate-500">
                        Supported variables: <code className="bg-white px-1 rounded">{"{tool_name}"}</code> <code className="bg-white px-1 rounded">{"{price_pkr}"}</code> <code className="bg-white px-1 rounded">{"{price_usd}"}</code> <code className="bg-white px-1 rounded">{"{link}"}</code>. Everything else is sent exactly as typed.
                      </p>
                    )}

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Exact outbound preview</span>
                      <div className="bg-[#dcf8c6] text-slate-900 rounded-xl rounded-tl-sm p-3 text-xs whitespace-pre-wrap break-words shadow-2xs">
                        {(() => {
                          let preview = editTemplateContent || "(empty — nothing will be sent)";
                          if (editTemplateVariables && editTemplateContent) {
                            const link = editLinks[0]?.url || "";
                            preview = editTemplateContent
                              .replace(/\{tool_name\}/g, editName || "{tool_name}")
                              .replace(/\{price_pkr\}/g, editPricePkr ? `Rs. ${editPricePkr}` : "{price_pkr}")
                              .replace(/\{price_usd\}/g, editPriceUsd ? `$${editPriceUsd}` : "{price_usd}")
                              .replace(/\{link\}/g, link || "{link}");
                          }
                          return preview;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Extended Product Sales Intelligence */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Product Sales Intelligence
                    </span>
                    <p className="text-[11px] text-slate-500 -mt-2">
                      Used dynamically by the AI for this product only. Multi-line fields: 1 item per line.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Ideal Customer</label>
                        <input type="text" value={editIdealCustomer} onChange={(e) => setEditIdealCustomer(e.target.value)}
                          placeholder="e.g. Faceless YouTube automation creators"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Primary Selling Point</label>
                        <input type="text" value={editPrimarySelling} onChange={(e) => setEditPrimarySelling(e.target.value)}
                          placeholder="e.g. Only tool with 9-layer Content ID bypass"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Customer Pain Points (1/line)</label>
                        <textarea value={editPainPoints} onChange={(e) => setEditPainPoints(e.target.value)} rows={3}
                          placeholder={"Copyright strikes on reused videos\nHours wasted editing manually"}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Secondary Selling Points (1/line)</label>
                        <textarea value={editSecondarySelling} onChange={(e) => setEditSecondarySelling(e.target.value)} rows={3}
                          placeholder={"100% local & offline\nLifetime license option"}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Value Arguments (1/line)</label>
                        <textarea value={editValueArguments} onChange={(e) => setEditValueArguments(e.target.value)} rows={3}
                          placeholder={"Cheaper than one copyright strike\nSaves 10+ hours per video"}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Discovery Questions (1/line)</label>
                        <textarea value={editDiscoveryQuestions} onChange={(e) => setEditDiscoveryQuestions(e.target.value)} rows={3}
                          placeholder={"Kis niche ka channel hai?\nRozana kitni videos banate hain?"}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Common Objections (1/line)</label>
                        <textarea value={editCommonObjections} onChange={(e) => setEditCommonObjections(e.target.value)} rows={3}
                          placeholder={"Mehnga hai\nPehle test karna hai"}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Buying Signals (1/line)</label>
                        <textarea value={editBuyingSignals} onChange={(e) => setEditBuyingSignals(e.target.value)} rows={3}
                          placeholder={"link bhejo\nHWID kaha se milega\npayment details"}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Objection Handling Strategy</label>
                      <textarea value={editObjectionStrategy} onChange={(e) => setEditObjectionStrategy(e.target.value)} rows={2}
                        placeholder="Acknowledge → Diagnose real objection → Reframe value → Resolve → Next step. Never dump a discount first."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Negotiation Rules</label>
                        <textarea value={editNegotiationRules} onChange={(e) => setEditNegotiationRules(e.target.value)} rows={2}
                          placeholder="Rate fixed. Floor only for same-day payment."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Allowed Discounts</label>
                        <textarea value={editAllowedDiscounts} onChange={(e) => setEditAllowedDiscounts(e.target.value)} rows={2}
                          placeholder="Monthly Rs. 1,500 → min Rs. 1,200 (instant). Lifetime Rs. 3,500 → min Rs. 2,800."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Urgency / Scarcity Rules</label>
                        <textarea value={editUrgencyRules} onChange={(e) => setEditUrgencyRules(e.target.value)} rows={2}
                          placeholder="Only mention real limited-time offers. Never fabricate scarcity."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Closing Strategy</label>
                        <textarea value={editClosingStrategy} onChange={(e) => setEditClosingStrategy(e.target.value)} rows={2}
                          placeholder="Confirm HWID → send payment accounts → ask for screenshot."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Cross-Sell Rules</label>
                        <textarea value={editCrossSell} onChange={(e) => setEditCrossSell(e.target.value)} rows={2}
                          placeholder="After ClipShield close, if creator needs voiceovers, suggest VoiceDelta."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Support Notes</label>
                        <textarea value={editSupportNotes} onChange={(e) => setEditSupportNotes(e.target.value)} rows={2}
                          placeholder="Activation via WhatsApp after HWID. Windows only."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: DYNAMIC SECTIONS & KNOWLEDGE */}
              {activeTab === "sections" && (
                <div className="space-y-6">
                  {/* Informational Banner */}
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 leading-relaxed">
                    <strong>Dynamic Product Sections:</strong> Flexible knowledge blocks extracted automatically by AI from your complete drafts (e.g. Setup Guides, Protection Details, License Tiers, Download Links). The AI sales agent uses these sections to answer customer inquiries with full authority without losing any information.
                  </div>

                  {/* Direct Links Section */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                          Direct Links & Downloads ({editLinks.length})
                        </span>
                        <p className="text-[11px] text-slate-500">
                          App download links, Google Docs setup guides, or web portals shared with customers on request.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddLink}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        Add Link
                      </button>
                    </div>

                    {editLinks.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2.5 text-center bg-white rounded-lg border border-dashed border-slate-200">
                        No links configured yet. Click "Add Link" to attach a download or documentation URL.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {editLinks.map((link, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 relative group">
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={link.title}
                                onChange={(e) => handleUpdateLink(idx, "title", e.target.value)}
                                placeholder="Link Title (e.g. Official App Download & Free Trial Doc)"
                                className="font-bold text-xs text-slate-800 bg-transparent border-b border-transparent focus:border-emerald-500 outline-none w-full"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteLink(idx)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors shrink-0"
                                title="Delete link"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={link.url}
                                onChange={(e) => handleUpdateLink(idx, "url", e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-mono outline-none focus:border-emerald-500"
                              />
                              <input
                                type="text"
                                value={link.note || ""}
                                onChange={(e) => handleUpdateLink(idx, "note", e.target.value)}
                                placeholder="Note (e.g. Includes 1 free trial video test)"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-600 outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Single Constant Dynamic Message Section */}
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        Constant Dynamic Section Message
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Enter your tool's single constant dynamic message here (as lengthy as needed). This message contains complete tool details, tutorial URLs, pricing, and WhatsApp channel link.
                      </p>
                    </div>

                    <textarea
                      value={editSingleDynamicText}
                      onChange={(e) => setEditSingleDynamicText(e.target.value)}
                      rows={12}
                      placeholder="Paste your tool's constant dynamic message here..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 font-sans outline-none focus:border-emerald-500 focus:bg-white resize-y leading-relaxed shadow-2xs font-mono"
                    />
                  </div>

                  {/* Raw Draft Preservation Accordion */}
                  {editRawDraft && (
                    <details className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
                      <summary className="font-bold text-slate-700 cursor-pointer select-none hover:text-emerald-700">
                        View Original Ingested Draft ({editRawDraft.length} characters)
                      </summary>
                      <pre className="mt-2 p-3 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {editRawDraft}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* TAB 3: SCREENSHOTS & IMAGES */}
              {activeTab === "images" && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs text-indigo-900 leading-relaxed">
                    <strong>AI Screenshot Trigger:</strong> The AI Agent reads the <em>Image Description</em> to decide when a customer asks to see a demo, user interface, or sample on WhatsApp (e.g. <em>"bhai dashboard kesa hai dikhao"</em>).
                  </div>

                  {/* Upload Form */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Upload Screenshot
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">
                          Select Image File
                        </label>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          onChange={handleFileChange}
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300 cursor-pointer"
                        />
                        {previewUrl && (
                          <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-2xs">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Screenshot Title
                          </label>
                          <input
                            type="text"
                            value={imageTitle}
                            onChange={(e) => setImageTitle(e.target.value)}
                            placeholder="e.g. Voice Cloning Dashboard"
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Description for AI <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={imageDescription}
                            onChange={(e) => setImageDescription(e.target.value)}
                            placeholder="e.g. This image shows the VoiceDelta voice cloning interface and sample voices."
                            rows={2}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 outline-none focus:border-indigo-500 resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleUploadImage}
                        disabled={isUploadingImage || !selectedFile || !imageDescription.trim()}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                      >
                        {isUploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Add Image to Tool
                      </button>
                    </div>
                  </div>

                  {/* Attached Images List */}
                  {editImages.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">
                        Current Screenshots ({editImages.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {editImages.map((img) => (
                          <div key={img.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-start gap-3 relative group">
                            <img
                              src={img.url || `/${img.filepath}`}
                              alt={img.title || "Screenshot"}
                              className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                            />
                            <div className="flex-1 min-w-0 pr-6">
                              <p className="text-xs font-bold text-slate-800 truncate">{img.title || img.filename}</p>
                              <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-tight">{img.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteImage(img.id)}
                              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete screenshot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SETTINGS & DANGER ZONE */}
              {activeTab === "settings" && (
                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Tool Internal ID
                    </span>
                    <code className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-800 font-mono inline-block">
                      {editingTool.id}
                    </code>
                    <p className="text-[11px] text-slate-500">Stored in persistent JSON database data/tools.json.</p>
                  </div>

                  <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200 space-y-3">
                    <span className="text-xs font-bold text-rose-900 uppercase tracking-wider block">
                      Danger Zone
                    </span>
                    <p className="text-xs text-rose-700">
                      Permanently remove this tool from the AI knowledge base. It will no longer be pitched to customers.
                    </p>
                    <button
                      type="button"
                      onClick={() => setToolToDelete(editingTool)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete This Tool
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTool(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save All Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Full-view Modal */}
      {viewingImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => setViewingImage(null)}
        >
          <div 
            className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{viewingImage.title || viewingImage.filename}</h4>
                <p className="text-xs text-slate-500">{viewingImage.description}</p>
              </div>
              <button 
                onClick={() => setViewingImage(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-900 p-2 flex items-center justify-center max-h-[70vh]">
              <img 
                src={viewingImage.url || `/${viewingImage.filepath}`} 
                alt={viewingImage.title || "Screenshot preview"} 
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Tool Confirmation Modal */}
      <ConfirmModal
        isOpen={!!toolToDelete}
        onClose={() => setToolToDelete(null)}
        onConfirm={handleDeleteToolConfirm}
        title="Delete tool from AI catalog?"
        message={`Are you sure you want to delete "${toolToDelete?.name}"? The WhatsApp agent will stop pitching this product.`}
        confirmText="Delete Tool"
        cancelText="Cancel"
        isDestructive={true}
      />
    </div>
  );
}
