import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  ArrowUpRight, 
  Play, 
  Check, 
  Plus, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  ArrowRight, 
  ArrowUp,
  Boxes,
  QrCode,
  Rocket,
  ShieldCheck,
  Smartphone,
  Wallet,
  PackageSearch,
  Route,
  Sparkles
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";

interface LandingPageProps {
  onEnterApp?: () => void;
  initialAuthOpen?: boolean;
  initialAuthMode?: "login" | "register";
}

export default function LandingPage({
  onEnterApp,
  initialAuthOpen = false,
  initialAuthMode = "register",
}: LandingPageProps) {
  const { isAuthenticated, user, isAdmin } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(initialAuthOpen);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">(initialAuthMode);
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem("salesagent-theme") === "dark" || 
      document.documentElement.classList.contains("dark");
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync dark mode class with HTML tag
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("salesagent-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("salesagent-theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Interactive Live Simulation State
  const simulationPrompts = [
    {
      id: "price",
      title: "Price question",
      sub: "Private tool + monthly price",
      tag: "Pricing inquiry",
      prompt: "Bhai ElevenLabs voiceover tool private mile ga aur monthly price kitni hai?",
      response: "Ji bilkul! Private profile Rs. 1,499/mo mein available hai with 30-day warranty. Easypaisa ya JazzCash payment details send kar doon?",
    },
    {
      id: "discount",
      title: "Negotiation",
      sub: "Discount without losing margin",
      tag: "Negotiation",
      prompt: "Final rate batao, thora discount ho sakta hai?",
      response: "Aap ke liye best available rate Rs. 1,299/mo hai. Is mein 30-day replacement warranty included hai. Confirm kar dein to payment details bhej deta hoon.",
    },
    {
      id: "screenshot",
      title: "Screenshot request",
      sub: "Catalog-aware product proof",
      tag: "Objection handling",
      prompt: "Interface screenshot bhej sakte ho?",
      response: "Sure. Main product interface screenshot share kar deta hoon. Saath mein main features ka quick overview bhi bhejta hoon taake aap decide kar saken.",
    },
  ];

  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [simPrompt, setSimPrompt] = useState(simulationPrompts[0].prompt);
  const [simResponse, setSimResponse] = useState(simulationPrompts[0].response);
  const [isTyping, setIsTyping] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const typingTimerRef = useRef<any>(null);

  const triggerSimulation = (promptText: string, replyText: string) => {
    clearTimeout(typingTimerRef.current);
    setSimPrompt(promptText);
    setIsTyping(true);

    typingTimerRef.current = setTimeout(() => {
      setSimResponse(replyText);
      setIsTyping(false);
    }, 650);
  };

  const handlePromptSelect = (index: number) => {
    setActivePromptIndex(index);
    setCustomInput("");
    triggerSimulation(simulationPrompts[index].prompt, simulationPrompts[index].response);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    const query = customInput.trim();
    let reply = "Thanks for reaching out! Product details, pricing, and 30-day warranty policy share kar deta hoon. Easypaisa ya JazzCash prefer karein ge?";
    const lower = query.toLowerCase();

    if (lower.includes("price") || lower.includes("kitna") || lower.includes("rate") || lower.includes("cost")) {
      reply = "Ji bhai! Ye tool Rs. 1,499/month mein 100% private profile aur full replacement warranty ke sath available hai. Payment details send karoon?";
    } else if (lower.includes("easypaisa") || lower.includes("jazzcash") || lower.includes("payment") || lower.includes("pay") || lower.includes("account")) {
      reply = "Easypaisa / JazzCash details: 0300-1234567 (Title: SalesAgent AI). Screenshot send karein, instant login access deliver ho jaye ga.";
    } else if (lower.includes("discount") || lower.includes("kam") || lower.includes("final")) {
      reply = "Brother premium quality aur private account hai, but special offer mein Rs. 1,299/mo final ho jaye ga. Order lock karein?";
    } else if (lower.includes("screenshot") || lower.includes("proof") || lower.includes("sample")) {
      reply = "Bilkul! Dashboard aur sample output screenshot bhej raha hoon. User interface bohot smooth aur fast hai.";
    }

    triggerSimulation(query, reply);
    setCustomInput("");
  };

  // FAQ State
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const toggleFaq = (idx: number) => {
    setOpenFaq(prev => prev === idx ? null : idx);
  };

  const openAuth = (mode: "login" | "register") => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="relative min-h-screen text-[var(--ink)] bg-[var(--bg)] selection:bg-[#10b981]/20 selection:text-[#062b16] transition-colors duration-300">
      {/* Top Floating Navbar */}
      <header className="fixed top-0 left-0 right-0 z-40 py-3.5 px-4">
        <div className="containerx">
          <nav className="flex items-center justify-between h-16 px-4 md:px-5 border border-[var(--line)] rounded-2xl bg-[var(--bg)]/80 backdrop-blur-xl shadow-xs">
            {/* Brand Logo */}
            <a 
              href="#top" 
              onClick={(e) => { e.preventDefault(); scrollToSection("top"); }}
              className="flex items-center gap-2.5 font-extrabold tracking-tight text-base sm:text-lg"
            >
              <span className="grid place-items-center w-8 h-8 rounded-xl bg-[var(--ink)] text-[var(--bg)] shadow-sm">
                <MessageSquare className="w-4 h-4 text-[#10b981]" />
              </span>
              <span>
                SalesAgent<span className="text-[#10b981]">AI</span>
              </span>
            </a>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1.5">
              <button 
                onClick={() => scrollToSection("platform")} 
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
              >
                Platform
              </button>
              <button 
                onClick={() => scrollToSection("demo")} 
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
              >
                Live demo
              </button>
              <button 
                onClick={() => scrollToSection("workflow")} 
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
              >
                How it works
              </button>
              <button 
                onClick={() => scrollToSection("proof")} 
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
              >
                Proof
              </button>
              <button 
                onClick={() => scrollToSection("pricing")} 
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
              >
                Pricing
              </button>
              <button 
                onClick={() => scrollToSection("faq")} 
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
              >
                FAQ
              </button>
            </div>

            {/* Actions: Theme Toggle & Get Started */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="w-10 h-10 rounded-xl border border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--line-strong)]/20 flex items-center justify-center text-[var(--ink)] transition-colors cursor-pointer"
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              </button>

              {isAuthenticated ? (
                <button
                  onClick={onEnterApp}
                  className="btn btn-dark !h-10 text-xs shadow-sm cursor-pointer"
                >
                  <span>Go to Workspace</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openAuth("login")}
                    className="hidden sm:inline-flex px-3 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => openAuth("register")}
                    className="btn btn-accent !h-10 text-xs shadow-sm cursor-pointer"
                  >
                    <span>Get started</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Mobile Hamburger Toggle */}
              <button
                onClick={() => setMobileMenuOpen(prev => !prev)}
                aria-label="Toggle mobile menu"
                className="md:hidden w-10 h-10 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--ink)] cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </nav>

          {/* Mobile Drawer Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-2 p-3 rounded-2xl glass border border-[var(--line)] space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
              <button 
                onClick={() => scrollToSection("platform")} 
                className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl hover:bg-[var(--panel)]"
              >
                Platform
              </button>
              <button 
                onClick={() => scrollToSection("demo")} 
                className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl hover:bg-[var(--panel)]"
              >
                Live demo
              </button>
              <button 
                onClick={() => scrollToSection("workflow")} 
                className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl hover:bg-[var(--panel)]"
              >
                How it works
              </button>
              <button 
                onClick={() => scrollToSection("proof")} 
                className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl hover:bg-[var(--panel)]"
              >
                Proof
              </button>
              <button 
                onClick={() => scrollToSection("pricing")} 
                className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl hover:bg-[var(--panel)]"
              >
                Pricing
              </button>
              <button 
                onClick={() => scrollToSection("faq")} 
                className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl hover:bg-[var(--panel)]"
              >
                FAQ
              </button>
              {!isAuthenticated && (
                <div className="pt-2 border-t border-[var(--line)] flex gap-2">
                  <button
                    onClick={() => { setMobileMenuOpen(false); openAuth("login"); }}
                    className="flex-1 py-2 text-xs font-bold text-center rounded-xl border border-[var(--line)]"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { setMobileMenuOpen(false); openAuth("register"); }}
                    className="flex-1 py-2 text-xs font-bold text-center rounded-xl bg-[#10b981] text-white"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main id="top">
        {/* HERO SECTION */}
        <section className="relative min-h-[920px] flex items-center pt-36 pb-20 overflow-hidden grid-bg">
          <div className="hero-sheen"></div>
          <div className="hero-orb orb-a"></div>
          <div className="hero-orb orb-b"></div>
          <div className="hero-orb orb-c"></div>

          <div className="containerx relative z-10">
            <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
              {/* Status Badge */}
              <div className="pill inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full mb-7 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_0_4px_rgba(16,185,129,0.18)] animate-pulse" />
                <span className="mono text-[10px] font-bold tracking-wider uppercase text-[var(--ink)]">
                  SALESAGENT ENGINE <b>V2.5</b>
                </span>
                <span className="text-[10px] text-[var(--muted)] font-semibold">• 24/7 AUTONOMOUS</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--ink)] leading-[0.95] mb-6">
                Your WhatsApp<br />
                <span className="text-[#10b981]">sales closer.</span>
              </h1>

              {/* Subheadline */}
              <p className="max-w-2xl text-base sm:text-lg text-[var(--muted)] leading-relaxed mb-8">
                An autonomous AI agent that replies in natural Roman Urdu &amp; English, handles objections, negotiates within your rules, showcases your catalog, and gets customers to the payment step — around the clock.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                <button
                  onClick={() => openAuth("register")}
                  className="btn btn-accent text-sm !h-12 px-6 shadow-md cursor-pointer"
                >
                  <span>Start 14-day trial</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollToSection("demo")}
                  className="btn btn-ghost text-sm !h-12 px-5 border border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--line)] cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>Test live simulation</span>
                </button>
              </div>

              {/* Social Proof */}
              <div className="flex items-center gap-3.5 text-xs font-bold text-[var(--muted)]">
                <div className="flex -space-x-2">
                  <span className="w-7 h-7 rounded-full bg-[#c6ee56] text-slate-900 border-2 border-[var(--bg)] grid place-items-center font-black text-[10px]">A</span>
                  <span className="w-7 h-7 rounded-full bg-[#c7d9ff] text-slate-900 border-2 border-[var(--bg)] grid place-items-center font-black text-[10px]">M</span>
                  <span className="w-7 h-7 rounded-full bg-[#ffc9a6] text-slate-900 border-2 border-[var(--bg)] grid place-items-center font-black text-[10px]">S</span>
                  <span className="w-7 h-7 rounded-full bg-[#d6c8ff] text-slate-900 border-2 border-[var(--bg)] grid place-items-center font-black text-[10px]">K</span>
                </div>
                <span>Built for digital sellers, agencies &amp; high-volume WhatsApp teams</span>
              </div>
            </div>

            {/* Hero Live Sales Workspace Visual */}
            <div className="mt-14 max-w-5xl mx-auto rounded-3xl border border-[#10b981]/20 bg-[var(--panel-solid)]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Window Header */}
              <div className="h-12 border-b border-[var(--line)] px-4 flex items-center justify-between bg-[var(--panel)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="mono text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Live Sales Workspace
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-[#10b981]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
                  <span>ACTIVE NOW</span>
                </div>
              </div>

              {/* Window 3 Columns Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
                {/* Column 1: Active Leads */}
                <div className="md:col-span-4 border-r border-[var(--line)] p-4 sm:p-5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-3">
                    Active Leads
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/50">
                      <strong className="text-xs font-bold text-[var(--ink)] block">+92 301 9876543</strong>
                      <p className="text-[11px] text-[var(--muted)] mt-1 truncate">“ElevenLabs private milay ga?”</p>
                    </div>
                    <div className="p-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/50">
                      <strong className="text-xs font-bold text-[var(--ink)] block">+92 333 6421901</strong>
                      <p className="text-[11px] text-[var(--muted)] mt-1 truncate">“Canva Pro ka final rate?”</p>
                    </div>
                    <div className="p-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/50">
                      <strong className="text-xs font-bold text-[var(--ink)] block">+971 50 2851901</strong>
                      <p className="text-[11px] text-[var(--muted)] mt-1 truncate">“Need 1 month today.”</p>
                    </div>
                    <div className="p-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/50">
                      <strong className="text-xs font-bold text-[var(--ink)] block">+92 311 9031288</strong>
                      <p className="text-[11px] text-[var(--muted)] mt-1 truncate">“Payment proof sent.”</p>
                    </div>
                  </div>
                </div>

                {/* Column 2: AI Conversation Stream */}
                <div className="md:col-span-5 border-r border-[var(--line)] p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-3">
                      AI Conversation Stream
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="p-3 rounded-2xl bg-[var(--panel)] border border-[var(--line)] max-w-[85%] self-start">
                        Bhai ElevenLabs private mile ga aur monthly price?
                      </div>
                      <div className="p-3 rounded-2xl bg-gradient-to-r from-[#25d366] to-[#10b981] text-[#062b16] font-medium max-w-[90%] ml-auto shadow-sm">
                        Ji bilkul. Private profile Rs. 1,499/mo with 30-day warranty. Easypaisa ya JazzCash — dono available hain.
                      </div>
                      <div className="p-3 rounded-2xl bg-[var(--panel)] border border-[var(--line)] max-w-[85%] self-start">
                        Warranty included hai?
                      </div>
                      <div className="p-3 rounded-2xl bg-gradient-to-r from-[#25d366] to-[#10b981] text-[#062b16] font-medium max-w-[90%] ml-auto shadow-sm">
                        Yes — full 30-day replacement warranty. Payment details bhej doon?
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-[var(--muted)] text-right mt-3 font-semibold">
                    11:15 PM · delivered · natural delay 23s
                  </div>
                </div>

                {/* Column 3: Today's Metrics */}
                <div className="md:col-span-3 p-4 sm:p-5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-3">
                      Today's Closer Stats
                    </div>
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                        <div className="text-2xl font-black text-[var(--ink)]">37</div>
                        <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-bold">Conversations</div>
                      </div>
                      <div className="p-3 rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                        <div className="text-2xl font-black text-[#10b981]">11</div>
                        <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-bold">Payment Intents</div>
                      </div>
                      <div className="p-3 rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                        <div className="text-2xl font-black text-purple-600">8</div>
                        <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-bold">Orders Closed</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MARQUEE BANNER */}
        <div className="border-y border-[var(--line)] bg-[var(--panel)] overflow-hidden py-4">
          <div className="flex gap-12 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-[var(--muted)] animate-marquee">
            <span className="flex items-center gap-4"><b className="text-[var(--ink)]">WhatsApp</b> sales automation</span>
            <span>•</span>
            <span className="flex items-center gap-4"><b className="text-[var(--ink)]">Roman Urdu</b> native flow</span>
            <span>•</span>
            <span className="flex items-center gap-4"><b className="text-[var(--ink)]">Human-paced</b> conversations</span>
            <span>•</span>
            <span className="flex items-center gap-4"><b className="text-[var(--ink)]">EasyPaisa</b> + JazzCash</span>
            <span>•</span>
            <span className="flex items-center gap-4"><b className="text-[var(--ink)]">Multi-device</b> gateway</span>
            <span>•</span>
            <span className="flex items-center gap-4"><b className="text-[var(--ink)]">CRM memory</b> built in</span>
            <span>•</span>
            <span className="flex items-center gap-4"><b className="text-[var(--ink)]">Anti-Ban</b> jitter protection</span>
            <span>•</span>
          </div>
        </div>

        {/* PLATFORM SECTION */}
        <section id="platform" className="py-28">
          <div className="containerx">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
              <div>
                <div className="eyebrow text-xs font-extrabold uppercase tracking-widest text-[#10b981] mb-2">
                  Everything your WhatsApp seller needs
                </div>
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--ink)] leading-tight">
                  Reply faster.<br />Sell without being online.
                </h2>
              </div>
              <p className="max-w-md text-sm text-[var(--muted)] leading-relaxed">
                Keep your products, prices, customer chats, payment instructions, and sales rules in one place. SalesAgent uses that information to answer customers clearly and move each conversation toward an order.
              </p>
            </div>

            {/* Grid Features */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Feature 1 (Wide) */}
              <div className="md:col-span-8 p-8 rounded-3xl border border-[var(--line)] bg-[var(--panel)] relative overflow-hidden flex flex-col justify-between min-h-[320px]">
                <div className="max-w-md">
                  <div className="w-12 h-12 rounded-2xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 grid place-items-center mb-6">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-[var(--ink)] mb-2.5">
                    Customers get a reply in seconds.
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                    Whether someone asks for a price, warranty, screenshot, discount, or feature list, the agent replies using your actual product information instead of generic chatbot answers.
                  </p>
                </div>
                {/* Visual bar graph */}
                <div className="flex items-end gap-1.5 h-16 mt-8">
                  {[20, 28, 22, 46, 42, 54, 48, 66, 60, 73, 70, 78, 68, 86, 76, 92, 88, 100].map((h, i) => (
                    <div 
                      key={i} 
                      className={`flex-1 rounded-t-sm ${i === 17 ? "bg-[#10b981]" : "bg-[var(--ink)]/15"}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Feature 2 */}
              <div className="md:col-span-4 p-8 rounded-3xl border border-[var(--line)] bg-[var(--panel)] relative flex flex-col justify-between min-h-[320px]">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 grid place-items-center mb-6">
                    <PackageSearch className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--ink)] mb-2">
                    Put your products in one catalog.
                  </h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Add the product name, price, features, screenshots, warranty, and the exact information customers should receive.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-baseline gap-2">
                  <span className="text-4xl font-black text-[var(--ink)]">1</span>
                  <span className="text-xs text-[var(--muted)] font-semibold">source of truth</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="md:col-span-4 p-8 rounded-3xl border border-[var(--line)] bg-[var(--panel)] flex flex-col justify-between min-h-[290px]">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 grid place-items-center mb-6">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--ink)] mb-2">
                    Send payment details instantly.
                  </h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    When the customer is ready, the agent can share your configured payment instructions and tell them exactly what proof to send.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#10b981]">1 tap</span>
                  <span className="text-xs text-[var(--muted)] font-semibold">payment handoff</span>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="md:col-span-4 p-8 rounded-3xl border border-[var(--line)] bg-[var(--panel)] flex flex-col justify-between min-h-[290px]">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 grid place-items-center mb-6">
                    <Route className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--ink)] mb-2">
                    Keep follow-ups organized.
                  </h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Create approved outreach lists, set schedules and limits, and keep campaign activity under your control from one place.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-baseline gap-2">
                  <span className="text-2xl font-black text-purple-600">Smart Drip</span>
                  <span className="text-xs text-[var(--muted)] font-semibold">campaign engine</span>
                </div>
              </div>

              {/* Feature 5 (Wide Tall) */}
              <div className="md:col-span-4 p-8 rounded-3xl border border-[var(--line)] bg-[var(--panel)] flex flex-col justify-between min-h-[290px]">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 grid place-items-center mb-6">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--ink)] mb-2">
                    Connect WhatsApp once. Keep working.
                  </h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Pair your WhatsApp account by QR or pairing code. Your session reconnects automatically after restarts.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-baseline gap-2">
                  <span className="text-4xl font-black text-[var(--ink)]">5 sec</span>
                  <span className="text-xs text-[var(--muted)] font-semibold">pairing flow</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LIVE SIMULATION SECTION */}
        <section id="demo" className="py-24 bg-[var(--panel)]/40 border-y border-[var(--line)]">
          <div className="containerx">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
              <div>
                <div className="eyebrow text-xs font-extrabold uppercase tracking-widest text-[#10b981] mb-2">
                  Live simulation
                </div>
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--ink)] leading-tight">
                  Show the agent<br />your toughest lead.
                </h2>
              </div>
              <p className="max-w-md text-sm text-[var(--muted)] leading-relaxed">
                Try real selling situations. Switch prompts, watch the AI reply with context, and see how the flow moves from question → objection → payment intent.
              </p>
            </div>

            {/* Simulation Shell */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 rounded-3xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
              {/* Preset Controls */}
              <div className="lg:col-span-5 space-y-3">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)] mb-2">
                  Test Inquiries
                </div>
                {simulationPrompts.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => handlePromptSelect(idx)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      activePromptIndex === idx
                        ? "bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)] shadow-md"
                        : "bg-[var(--panel-solid)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--line-strong)]"
                    }`}
                  >
                    <div className="text-xs font-bold">{p.title}</div>
                    <div className="text-[11px] opacity-75 mt-1 leading-snug">{p.sub}</div>
                  </button>
                ))}

                <div className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/40 text-xs text-[var(--muted)]">
                  💡 <strong>Tip:</strong> The agent automatically detects intent, selects the product catalog pricing, applies configured limits, and shares Easypaisa/JazzCash instructions.
                </div>
              </div>

              {/* Chat Window */}
              <div className="lg:col-span-7 rounded-2xl border border-[var(--line)] bg-[var(--panel-solid)] flex flex-col justify-between overflow-hidden min-h-[460px]">
                {/* Chat Head */}
                <div className="h-16 px-5 border-b border-[var(--line)] flex items-center justify-between bg-[var(--panel)]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#10b981] text-[#062b16] grid place-items-center font-bold">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="text-xs font-bold block text-[var(--ink)]">SalesAgent AI</strong>
                      <span className="text-[10px] text-[var(--muted)]">Customer Support · autonomous closer</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-[#10b981]">
                    <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                    <span>ONLINE · 24/7</span>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
                  {/* Customer message */}
                  <div className="p-3.5 rounded-2xl rounded-tl-sm bg-[var(--bg)] border border-[var(--line)] max-w-[80%] text-xs leading-relaxed self-start">
                    {simPrompt}
                  </div>
                  <span className="text-[9px] text-[var(--muted)] -mt-2">10:42 AM · customer</span>

                  {/* Typing Indicator */}
                  {isTyping && (
                    <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-[var(--panel)] border border-[var(--line)] w-fit self-start animate-in fade-in">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}

                  {/* AI Agent Response */}
                  {!isTyping && (
                    <>
                      <div className="p-3.5 rounded-2xl rounded-tr-sm bg-gradient-to-r from-[#25d366] to-[#10b981] text-[#062b16] font-medium max-w-[85%] text-xs leading-relaxed self-end shadow-xs animate-in fade-in">
                        {simResponse}
                      </div>
                      <span className="text-[9px] text-[var(--muted)] text-right -mt-2">10:42 AM · SalesAgent AI · delivered</span>
                    </>
                  )}
                </div>

                {/* Custom Test Input Form */}
                <form onSubmit={handleCustomSubmit} className="p-3.5 border-t border-[var(--line)] bg-[var(--panel)] flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Ask in Roman Urdu or English…"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-xs text-[var(--ink)] focus:outline-none focus:border-[#10b981]"
                  />
                  <button
                    type="submit"
                    aria-label="Send query"
                    className="w-10 h-10 rounded-xl bg-[var(--ink)] text-[var(--bg)] grid place-items-center hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* WORKFLOW SECTION */}
        <section id="workflow" className="py-28">
          <div className="containerx">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
              <div>
                <div className="eyebrow text-xs font-extrabold uppercase tracking-widest text-[#10b981] mb-2">
                  How it works
                </div>
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--ink)] leading-tight">
                  Set it up once.<br />Let it sell every day.
                </h2>
              </div>
              <p className="max-w-md text-sm text-[var(--muted)] leading-relaxed">
                There is no complicated sales playbook to learn. Give the agent the right information, connect WhatsApp, and let it handle the repetitive questions and follow-ups.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-8 rounded-3xl border border-[var(--line)] bg-[var(--panel)] relative overflow-hidden flex flex-col justify-between min-h-[300px]">
                <div>
                  <div className="mono text-[10px] font-bold text-[var(--muted)] tracking-widest mb-6">
                    01 / ADD PRODUCTS
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 grid place-items-center mb-6">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-[var(--ink)] mb-2.5">
                    Tell it what you sell.
                  </h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Add your products, prices, screenshots, features, warranties, discounts, and payment instructions so the agent knows exactly what to say.
                  </p>
                </div>
              </div>

              <div className="p-8 rounded-3xl border border-[var(--line)] bg-[var(--panel)] relative overflow-hidden flex flex-col justify-between min-h-[300px]">
                <div>
                  <div className="mono text-[10px] font-bold text-[var(--muted)] tracking-widest mb-6">
                    02 / CONNECT WHATSAPP
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 grid place-items-center mb-6">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-[var(--ink)] mb-2.5">
                    Connect your number.
                  </h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Pair the WhatsApp account with a QR code or pairing code. Your saved session can reconnect after restarts.
                  </p>
                </div>
              </div>

              <div className="p-8 rounded-3xl border border-[var(--line)] bg-[var(--panel)] relative overflow-hidden flex flex-col justify-between min-h-[300px]">
                <div>
                  <div className="mono text-[10px] font-bold text-[var(--muted)] tracking-widest mb-6">
                    03 / START SELLING
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 grid place-items-center mb-6">
                    <Rocket className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-[var(--ink)] mb-2.5">
                    Let the agent handle chats.
                  </h3>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    It answers questions, handles common objections, shares the right product details, gives payment instructions, and keeps the conversation moving.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROOF SECTION */}
        <section id="proof" className="py-24 bg-[var(--panel)]/30 border-y border-[var(--line)]">
          <div className="containerx">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
              <div>
                <div className="eyebrow text-xs font-extrabold uppercase tracking-widest text-[#10b981] mb-2">
                  Built for the messy middle of sales
                </div>
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--ink)] leading-tight">
                  Fast enough for 2 AM.<br />Smart enough for nuance.
                </h2>
              </div>
              <p className="max-w-md text-sm text-[var(--muted)] leading-relaxed">
                The advantage is not another chatbot. It is a persistent sales system that knows what you sell, how you price it, and what to say next.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Quote Block */}
              <div className="lg:col-span-7 p-10 rounded-3xl bg-[var(--ink)] text-[var(--bg)] flex flex-col justify-between min-h-[360px] shadow-xl">
                <blockquote className="text-2xl sm:text-3xl font-extrabold leading-snug tracking-tight">
                  “The difference is the context. Customers ask like real people — so the agent has to answer like one.”
                </blockquote>
                <div className="flex items-end justify-between border-t border-white/10 pt-6 mt-6">
                  <div>
                    <strong className="text-sm font-bold block">Product-led WhatsApp seller</strong>
                    <span className="text-xs text-[var(--bg)]/60">Pakistan · digital tools &amp; subscriptions</span>
                  </div>
                  <div className="mono text-[10px] text-[var(--bg)]/60 text-right leading-tight">
                    NATURAL FLOW<br />CONTEXT AWARE<br />PAYMENT READY
                  </div>
                </div>
              </div>

              {/* Stat Stack */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-7 rounded-3xl border border-[var(--line)] bg-[var(--panel)] flex items-center justify-between">
                  <strong className="text-4xl sm:text-5xl font-black text-[var(--ink)]">24/7</strong>
                  <span className="text-xs text-[var(--muted)] text-right max-w-[170px] leading-relaxed">
                    Always-on first response for inbound customer conversations.
                  </span>
                </div>
                <div className="p-7 rounded-3xl border border-[var(--line)] bg-[var(--panel)] flex items-center justify-between">
                  <strong className="text-4xl sm:text-5xl font-black text-[#10b981]">4×</strong>
                  <span className="text-xs text-[var(--muted)] text-right max-w-[170px] leading-relaxed">
                    Fallback model layer for resilience across supported providers.
                  </span>
                </div>
                <div className="p-7 rounded-3xl border border-[var(--line)] bg-[var(--panel)] flex items-center justify-between">
                  <strong className="text-4xl sm:text-5xl font-black text-purple-600">1 hub</strong>
                  <span className="text-xs text-[var(--muted)] text-right max-w-[170px] leading-relaxed">
                    Products, conversations, campaigns, governance and payment instructions.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section id="pricing" className="py-28">
          <div className="containerx">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="eyebrow text-xs font-extrabold uppercase tracking-widest text-[#10b981] mb-2">
                Pricing that scales with your sales
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--ink)] leading-tight mb-4">
                Start simple.<br />Grow into automation.
              </h2>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                No feature maze. The higher tiers are designed for sellers and teams that need more numbers, governance, automation, and operational headroom.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {/* Card 1: Starter */}
              <div className="p-8 rounded-3xl border border-[var(--line)] bg-[var(--panel)] flex flex-col justify-between shadow-xs">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                    Starter
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-[var(--ink)] my-5">
                    Free
                  </div>
                  <p className="text-xs text-[var(--muted)] leading-relaxed min-h-[44px]">
                    For a single seller testing autonomous WhatsApp responses and building a first product playbook.
                  </p>

                  <ul className="space-y-3 my-7 text-xs">
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span><strong>30 AI replies</strong> per month</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>1 WhatsApp number gateway</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Up to 5 active products</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Roman Urdu &amp; English closer</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Payment presets</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => openAuth("register")}
                  className="btn btn-ghost w-full border border-[var(--line)] hover:bg-[var(--line)] cursor-pointer"
                >
                  <span>Get started free</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Card 2: Pro Growth (Featured) */}
              <div className="p-8 rounded-3xl border-2 border-[#10b981] bg-[var(--ink)] text-[var(--bg)] relative flex flex-col justify-between shadow-xl md:-translate-y-2">
                <span className="absolute -top-3.5 right-6 bg-[#10b981] text-[#062b16] text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                  Recommended
                </span>

                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#10b981]">
                    Pro Growth
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-[var(--bg)] my-5 flex items-baseline gap-2">
                    <span>Rs. 4,999</span>
                    <span className="text-xs font-bold text-[var(--bg)]/60">/ month</span>
                  </div>
                  <p className="text-xs text-[var(--bg)]/70 leading-relaxed min-h-[44px]">
                    For active resellers, agencies, and high-volume sellers running WhatsApp as a serious sales channel.
                  </p>

                  <ul className="space-y-3 my-7 text-xs">
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span><strong>250 AI replies</strong> per month</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Multi-device gateway + reconnect</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Unlimited catalog &amp; images</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Campaign controls &amp; scheduling</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Multi-provider fallback</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>CRM memory + chat history</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => openAuth("register")}
                  className="btn btn-accent w-full cursor-pointer"
                >
                  <span>Start 14-day trial</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>

              {/* Card 3: Enterprise */}
              <div className="p-8 rounded-3xl border border-[var(--line)] bg-[var(--panel)] flex flex-col justify-between shadow-xs">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                    Enterprise
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-[var(--ink)] my-5 flex items-baseline gap-2">
                    <span>Rs. 14,999</span>
                    <span className="text-xs font-bold text-[var(--muted)]">/ month</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] leading-relaxed min-h-[44px]">
                    For organizations that need centralized control, multiple seats, integrations, and dedicated support.
                  </p>

                  <ul className="space-y-3 my-7 text-xs">
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span><strong>Unlimited (99,999) AI replies</strong></span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Root admin governance</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Unlimited team seats &amp; quotas</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Custom API/webhook integrations</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#10b981] text-[#062b16] grid place-items-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                      <span>Priority account support</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => openAuth("register")}
                  className="btn btn-ghost w-full border border-[var(--line)] hover:bg-[var(--line)] cursor-pointer"
                >
                  <span>Talk to sales</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="py-24 bg-[var(--panel)]/40 border-y border-[var(--line)]">
          <div className="containerx max-w-3xl">
            <div className="text-center mb-16">
              <div className="eyebrow text-xs font-extrabold uppercase tracking-widest text-[#10b981] mb-2">
                Questions, answered
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--ink)] leading-tight mb-4">
                No mystery between<br />lead and checkout.
              </h2>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Operational details matter when your sales inbox becomes a system. Here is what the product is designed to handle.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: "How does the agent handle conversation pacing?",
                  a: "Timing, message splitting, queueing, and other pacing controls can be configured to create more natural conversations. Automated outreach should still follow WhatsApp rules and your recipients' consent requirements."
                },
                {
                  q: "Can I control which customers receive campaign messages?",
                  a: "Yes. Campaign controls can segment eligible contacts by approved country or number prefix, apply quotas, schedule queues, and pause or stop outreach."
                },
                {
                  q: "What information can I put into the product knowledge base?",
                  a: "Products, pricing, feature bullets, images, screenshots, warranty terms, payment instructions, upsell rules, common objections, and escalation guidance can form the agent's selling context."
                },
                {
                  q: "Which AI providers can power the closer?",
                  a: "The architecture is designed around provider fallback, so supported accounts can route conversations across multiple model providers (Gemini, Claude, DeepSeek) based on availability."
                },
                {
                  q: "Does my WhatsApp session stay connected after a restart?",
                  a: "Yes! Connected sessions are stored persistently in credentials state and automatically re-established after application restarts."
                }
              ].map((item, idx) => (
                <div key={idx} className="border border-[var(--line)] rounded-2xl bg-[var(--panel-solid)] overflow-hidden transition-all">
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full text-left p-5 flex items-center justify-between gap-4 font-bold text-sm text-[var(--ink)] cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <Plus className={`w-4 h-4 text-[#10b981] transition-transform duration-200 shrink-0 ${openFaq === idx ? "rotate-45" : ""}`} />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-5 text-xs text-[var(--muted)] leading-relaxed animate-in fade-in">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA SECTION */}
        <section className="py-24">
          <div className="containerx">
            <div className="p-8 sm:p-14 rounded-3xl border border-[var(--line)] bg-[var(--panel)] shadow-xl relative overflow-hidden">
              <div className="relative z-10 max-w-2xl">
                <div className="eyebrow text-xs font-extrabold uppercase tracking-widest text-[#10b981] mb-3">
                  Ready when your inbox is
                </div>
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--ink)] leading-tight mb-4">
                  Stop losing the lead<br />between “price?” and “payment”.
                </h2>
                <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed mb-8">
                  Give every WhatsApp inquiry a fast, informed first response — then let your team step in when the conversation actually needs a human.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => openAuth("register")}
                    className="btn btn-accent text-sm !h-12 px-6 shadow-md cursor-pointer"
                  >
                    <span>Start free</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollToSection("demo")}
                    className="btn btn-ghost text-sm !h-12 px-5 border border-[var(--line)] bg-[var(--panel-solid)] hover:bg-[var(--line)] cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-[#10b981]" />
                    <span>Run the simulation</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[var(--line)] py-8 text-[var(--muted)] text-xs">
        <div className="containerx flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            © 2026 SalesAgent AI · WhatsApp Autonomous Closer
          </div>
          <div className="flex items-center gap-6 font-semibold">
            <button onClick={() => scrollToSection("platform")} className="hover:text-[var(--ink)] cursor-pointer">Platform</button>
            <button onClick={() => scrollToSection("pricing")} className="hover:text-[var(--ink)] cursor-pointer">Pricing</button>
            <button onClick={() => scrollToSection("faq")} className="hover:text-[var(--ink)] cursor-pointer">FAQ</button>
            <a href="mailto:sales@salesagent.ai" className="hover:text-[var(--ink)]">Contact</a>
          </div>
        </div>
      </footer>

      {/* Auth Modal Portal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <AuthModal
            initialMode={authModalMode}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setShowAuthModal(false);
              if (onEnterApp) onEnterApp();
            }}
          />
        </div>
      )}
    </div>
  );
}
