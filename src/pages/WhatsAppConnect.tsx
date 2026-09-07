import React, { useState } from "react";
import axios from "axios";
import { 
  Smartphone, 
  QrCode, 
  KeyRound, 
  Loader2, 
  CheckCircle2, 
  RefreshCw, 
  Power, 
  ShieldCheck, 
  Info,
  ArrowRight
} from "lucide-react";
import { WhatsAppStatus } from "../types";

interface WhatsAppConnectProps {
  whatsappStatus: WhatsAppStatus;
  fetchStatus: () => Promise<void>;
}

export default function WhatsAppConnect({ whatsappStatus, fetchStatus }: WhatsAppConnectProps) {
  const [connectMethod, setConnectMethod] = useState<"qr" | "pair">("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConnected = whatsappStatus.status === "connected";
  const isConnecting = whatsappStatus.status === "connecting";

  const handleStartQR = async () => {
    setLoading(true);
    setErrorMessage(null);
    setConnectMethod("qr");
    try {
      await axios.post("/api/whatsapp/connect");
      await fetchStatus();
    } catch (err: any) {
      console.error("QR Connect error:", err);
      setErrorMessage("Failed to initiate QR code connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    setConnectMethod("pair");
    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
      const res = await axios.post("/api/whatsapp/pair", { phoneNumber: cleanPhone });
      if (res.data?.error) {
        setErrorMessage(res.data.error);
      }
      await fetchStatus();
    } catch (err: any) {
      console.error("Pairing code error:", err);
      setErrorMessage("Failed to generate pairing code. Verify country code + phone number.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect WhatsApp?")) return;
    setLoading(true);
    try {
      await axios.post("/api/whatsapp/disconnect");
      await fetchStatus();
    } catch (err) {
      console.error("Disconnect error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 uppercase tracking-wider">
              Baileys Protocol v7
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            WhatsApp Gateway
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Connect your WhatsApp business or personal account to activate AI autonomous sales.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStatus()}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Connection Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Connection Canvas */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isConnected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-700"
                }`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Connection Method</h3>
                  <p className="text-[11px] text-slate-500">Choose QR Code or 8-digit Pairing Code</p>
                </div>
              </div>

              {/* Method Switcher */}
              {!isConnected && (
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setConnectMethod("qr")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      connectMethod === "qr" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QR Scan
                  </button>
                  <button
                    onClick={() => setConnectMethod("pair")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      connectMethod === "pair" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Pairing Code
                  </button>
                </div>
              )}
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200">
                {errorMessage}
              </div>
            )}

            {/* STATE 1: CONNECTED */}
            {isConnected && (
              <div className="p-8 text-center bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-4">
                <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-emerald-900">WhatsApp Session Active</h4>
                  <p className="text-xs text-emerald-700 mt-1 max-w-md mx-auto">
                    Your AI sales agent is online and listening for customer messages. All incoming chats will be processed with memory and smart fallback.
                  </p>
                </div>
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={handleDisconnect}
                    disabled={loading}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-rose-600/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                    Disconnect WhatsApp
                  </button>
                </div>
              </div>
            )}

            {/* STATE 2: NOT CONNECTED -> QR METHOD */}
            {!isConnected && connectMethod === "qr" && (
              <div className="flex flex-col items-center justify-center p-4">
                {whatsappStatus.qr ? (
                  <div className="space-y-4 text-center">
                    <div className="p-3 bg-white border-2 border-emerald-500/30 rounded-2xl shadow-md inline-block">
                      <img src={whatsappStatus.qr} alt="WhatsApp QR Code" className="w-56 h-56 rounded-lg" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Scan QR Code with WhatsApp</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Open WhatsApp &gt; Linked Devices &gt; Link a Device</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center space-y-4 max-w-sm">
                    <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Scan QR Code</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Click below to start a Baileys authentication handshake and generate a login QR code.
                      </p>
                    </div>
                    <button
                      onClick={handleStartQR}
                      disabled={loading}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                      Generate QR Code
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STATE 3: NOT CONNECTED -> PAIRING CODE METHOD */}
            {!isConnected && connectMethod === "pair" && (
              <div className="p-4 space-y-6">
                {whatsappStatus.pairingCode ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
                    <span className="text-[11px] uppercase font-bold text-slate-400">Your WhatsApp Pairing Code</span>
                    <div className="text-3xl sm:text-4xl tracking-[0.25em] font-mono font-extrabold text-slate-900 bg-white py-4 px-6 rounded-xl border border-slate-200 shadow-xs inline-block">
                      {whatsappStatus.pairingCode}
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      Enter this code in WhatsApp on your phone under <strong>Linked Devices &gt; Link with phone number</strong>.
                    </p>
                    <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider animate-pulse flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Listening for WhatsApp device approval...
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleStartPairing} className="space-y-4 max-w-md mx-auto py-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        WhatsApp Phone Number (with Country Code)
                      </label>
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="e.g. 923001234567"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Do not include +, spaces, or hyphens (e.g. 923001234567 for Pakistan)</p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !phoneNumber.trim()}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      Request 8-Digit Pairing Code
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Instructions & Security */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Secure Multi-Device
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">1</div>
                <p>Open WhatsApp on your phone and tap <strong>Menu (⋮)</strong> or <strong>Settings</strong>.</p>
              </div>
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">2</div>
                <p>Select <strong>Linked Devices</strong> and tap <strong>Link a Device</strong>.</p>
              </div>
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">3</div>
                <p>Point your camera at the QR code, or choose <em>Link with phone number instead</em>.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 leading-relaxed">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold mb-1">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                Persistent Auth Session
              </div>
              Credentials are saved in the <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[10px] text-slate-800 font-mono">auth_info_baileys/</code> directory. Reboots will resume automatically without re-scanning.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
