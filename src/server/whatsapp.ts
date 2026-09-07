import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, downloadMediaMessage } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { Express } from "express";
import { queueMessage } from "./agent.js";
import { transcribeAudio } from "./deepgram.js";
import { getUserByToken } from "./auth.js";
import { getSettings } from "./settings.js";
import pino from "pino";
import qrcode from "qrcode";
import fs from "fs/promises";
import path from "path";

export interface UserWASession {
  userId: string;
  sock: ReturnType<typeof makeWASocket> | null;
  qrCodeDataUrl: string | null;
  pairingCodeData: string | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
  isIntentionallyDisconnected: boolean;
  isConnecting: boolean;
  reconnectTimer: NodeJS.Timeout | null;
}

const userSessions = new Map<string, UserWASession>();
const sentMessageIds = new Set<string>();

function extractIncomingText(message: any): string | null {
  if (!message) return null;
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.templateButtonReplyMessage?.selectedId) return message.templateButtonReplyMessage.selectedId;
  if (message.buttonsResponseMessage?.selectedButtonId) return message.buttonsResponseMessage.selectedButtonId;
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) return message.listResponseMessage.singleSelectReply.selectedRowId;
  if (message.ephemeralMessage?.message) return extractIncomingText(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractIncomingText(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return extractIncomingText(message.viewOnceMessageV2.message);
  if (message.documentWithCaptionMessage?.message) return extractIncomingText(message.documentWithCaptionMessage.message);
  return null;
}

export function getUserWASession(userId?: string): UserWASession {
  const effectiveId = userId || "usr_admin_badar";
  let session = userSessions.get(effectiveId);
  if (!session) {
    session = {
      userId: effectiveId,
      sock: null,
      qrCodeDataUrl: null,
      pairingCodeData: null,
      connectionStatus: "disconnected",
      isIntentionallyDisconnected: false,
      isConnecting: false,
      reconnectTimer: null,
    };
    userSessions.set(effectiveId, session);
  }
  return session;
}

function getAuthDir(userId: string): string {
  if (!userId || userId === "usr_admin_badar" || userId === "admin") {
    return path.join(process.cwd(), "data", "auth", "admin");
  }
  return path.join(process.cwd(), "data", "auth", userId);
}

async function ensureAuthDir(userId: string): Promise<string> {
  const authDir = getAuthDir(userId);
  await fs.mkdir(authDir, { recursive: true });

  // Migrate legacy data/auth root files to data/auth/admin if applicable
  if (userId === "usr_admin_badar" || userId === "admin") {
    const legacyAuthDir = path.join(process.cwd(), "data", "auth");
    try {
      const legacyCreds = path.join(legacyAuthDir, "creds.json");
      await fs.access(legacyCreds);
      const targetCreds = path.join(authDir, "creds.json");
      try {
        await fs.access(targetCreds);
      } catch {
        const files = await fs.readdir(legacyAuthDir);
        for (const file of files) {
          const srcFile = path.join(legacyAuthDir, file);
          const stat = await fs.stat(srcFile);
          if (stat.isFile()) {
            await fs.copyFile(srcFile, path.join(authDir, file));
          }
        }
        console.log("[WhatsApp] Migrated legacy credentials to data/auth/admin");
      }
    } catch {
      // No legacy credentials
    }
  }

  return authDir;
}

export async function connectToWhatsApp(userId = "usr_admin_badar", usePairingCode = false) {
  const session = getUserWASession(userId);

  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }

  if (session.isConnecting || (session.connectionStatus === "connected" && session.sock)) {
    return;
  }
  session.isConnecting = true;

  try {
    session.isIntentionallyDisconnected = false;
    const authDir = await ensureAuthDir(userId);

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    session.connectionStatus = "connecting";
    session.qrCodeDataUrl = null;
    session.pairingCodeData = null;

    // Clean up previous socket if existing
    if (session.sock) {
      try {
        session.sock.ev.removeAllListeners("connection.update");
        session.sock.ev.removeAllListeners("creds.update");
        session.sock.ev.removeAllListeners("messages.upsert");
        session.sock.end(undefined);
      } catch {
        // ignore
      }
      session.sock = null;
    }

    const newSock = makeWASocket({
      auth: state,
      printQRInTerminal: !usePairingCode && (userId === "usr_admin_badar" || userId === "admin"),
      browser: usePairingCode ? ["Ubuntu", "Chrome", "20.0.04"] : Browsers.macOS("Desktop"),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      logger: pino({ level: "silent" }) as any,
    });
    session.sock = newSock;

    newSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !usePairingCode) {
        session.qrCodeDataUrl = await qrcode.toDataURL(qr);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;
        const shouldReconnect = !isLoggedOut && !isReplaced && !session.isIntentionallyDisconnected;

        session.connectionStatus = "disconnected";
        console.log(`[WhatsApp:${userId}] Connection closed. Reason: ${statusCode || lastDisconnect?.error}. Should reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          const delay = statusCode === DisconnectReason.restartRequired ? 1000 : 5000;
          if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
          session.reconnectTimer = setTimeout(() => {
            connectToWhatsApp(userId, usePairingCode).catch(console.error);
          }, delay);
        } else if (isLoggedOut && !session.isIntentionallyDisconnected) {
          console.log(`[WhatsApp:${userId}] Session logged out. Cleaning auth directory.`);
          try {
            await fs.rm(authDir, { recursive: true, force: true });
          } catch (e) {
            console.error(`[WhatsApp:${userId}] Failed to clean auth dir:`, e);
          }
        }
      } else if (connection === "open") {
        console.log(`[WhatsApp:${userId}] Connection opened successfully and session saved!`);
        session.connectionStatus = "connected";
        session.qrCodeDataUrl = null;
        session.pairingCodeData = null;
      }
    });

    newSock.ev.on("creds.update", async () => {
      await saveCreds();
    });

    newSock.ev.on("messages.upsert", async (m) => {
      if (m.type === "notify" || m.type === "append") {
        for (const msg of m.messages) {
          if (!msg.message) continue;

          // If this message was sent by our bot, skip it to avoid processing our own replies
          if (msg.key.id && sentMessageIds.has(msg.key.id)) {
            sentMessageIds.delete(msg.key.id);
            continue;
          }

          const rawSender = msg.key.remoteJid;
          if (!rawSender) continue;

          // Normalize sender (strip device suffix like :12@s.whatsapp.net)
          const sender = rawSender.replace(/:\d+@/, "@");

          // 1. STRICT CHANNEL & BROADCAST FILTER:
          // WhatsApp Channels/Newsletters (@newsletter) or Status Broadcasts (@broadcast) must NEVER be processed
          if (
            sender.includes("@newsletter") ||
            sender.includes("@broadcast") ||
            sender.includes("status@broadcast") ||
            sender.includes("@call")
          ) {
            continue;
          }

          // 2. GROUP FILTER:
          // Skip groups (@g.us) unless explicitly enabled in user settings
          if (sender.includes("@g.us")) {
            const settings = await getSettings(userId);
            if (!settings.allowGroups) {
              continue;
            }
          }

          // 3. ALLOW DIRECT CHATS (@s.whatsapp.net & @lid) OR ALLOWED GROUPS
          const isDirectChat = sender.endsWith("@s.whatsapp.net") || sender.endsWith("@lid");
          const isGroupChat = sender.endsWith("@g.us");
          if (!isDirectChat && !isGroupChat) {
            continue;
          }

          // 4. FROM ME / SELF-TEST CHECK:
          // Allow self-testing if user messages their own connected number in WhatsApp
          const myJid = newSock.user?.id ? newSock.user.id.split(":")[0] + "@s.whatsapp.net" : null;
          const isSelfChat = Boolean(myJid && sender.split(":")[0] === myJid.split(":")[0]);
          if (msg.key.fromMe && !isSelfChat) {
            // Normal message sent by user to an external contact -> do not auto-reply
            continue;
          }

          const textMessage = extractIncomingText(msg.message);

          if (textMessage) {
            console.log(`[WhatsApp:${userId}] 📩 Received message from ${sender}: "${textMessage}"`);
            await queueMessage(sender, textMessage, msg.pushName || "Customer", userId);
          } else {
            const audioMsg =
              msg.message.audioMessage ||
              msg.message.ephemeralMessage?.message?.audioMessage ||
              msg.message.viewOnceMessage?.message?.audioMessage;

            if (audioMsg) {
              console.log(`[WhatsApp:${userId}] 🎙️ Received voice message from ${sender}. Downloading audio...`);
              try {
                const buffer = await downloadMediaMessage(
                  msg,
                  "buffer",
                  {},
                  {
                    logger: pino({ level: "silent" }) as any,
                    reuploadRequest: newSock.updateMediaMessage,
                  }
                );

                if (buffer && buffer.length > 0) {
                  console.log(`[WhatsApp:${userId}] Transcribing voice note (${buffer.length} bytes) via Deepgram...`);
                  const transcribedText = await transcribeAudio(
                    buffer as Buffer,
                    audioMsg.mimetype || "audio/ogg; codecs=opus"
                  );

                  if (transcribedText && transcribedText.trim().length > 0) {
                    console.log(`[WhatsApp:${userId}] Voice note transcribed: "${transcribedText}"`);
                    await queueMessage(sender, transcribedText, msg.pushName || "Customer", userId);
                  } else {
                    console.warn(`[WhatsApp:${userId}] Audio transcription returned empty.`);
                  }
                }
              } catch (audioErr) {
                console.error(`[WhatsApp:${userId}] Error downloading/transcribing audio:`, audioErr);
              }
            }
          }
        }
      }
    });
  } catch (error) {
    session.connectionStatus = "disconnected";
    console.error(`[WhatsApp:${userId}] Connect error:`, error);
  } finally {
    session.isConnecting = false;
  }
}

export async function sendMessage(jid: string, text: string, userId?: string) {
  const session = getUserWASession(userId);
  const targetSock = session.sock || (userId ? getUserWASession("usr_admin_badar").sock : null);

  if (!targetSock) {
    console.warn(`[WhatsApp:${userId || "default"}] Cannot send message: socket is not connected.`);
    return;
  }
  try {
    const rawJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
    const formattedJid = rawJid.replace(/:\d+@/, "@");
    console.log(`[WhatsApp:${userId || "default"}] Sending reply to ${formattedJid}: "${text}"`);
    const sent = await targetSock.sendMessage(formattedJid, { text });
    if (sent?.key?.id) {
      sentMessageIds.add(sent.key.id);
      setTimeout(() => sentMessageIds.delete(sent.key.id!), 60000);
    }
    console.log(`[WhatsApp:${userId || "default"}] Message successfully sent to ${formattedJid}`);
  } catch (error) {
    console.error(`[WhatsApp:${userId || "default"}] Error delivering message to ${jid}:`, error);
  }
}

export async function sendToolImage(jid: string, imagePath: string, caption?: string, userId?: string): Promise<boolean> {
  const session = getUserWASession(userId);
  const targetSock = session.sock || (userId ? getUserWASession("usr_admin_badar").sock : null);

  if (!targetSock) {
    console.warn(`[WhatsApp:${userId || "default"}] Cannot send image: socket is not connected.`);
    return false;
  }
  try {
    const formattedJid = jid.includes("@") ? jid : `${jid}@s.whatsapp.net`;
    const fullPath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);

    try {
      await fs.access(fullPath);
    } catch {
      console.warn(`[WhatsApp:${userId || "default"}] Tool image file not found on disk at: ${fullPath}`);
      return false;
    }

    const imageBuffer = await fs.readFile(fullPath);
    console.log(`[WhatsApp:${userId || "default"}] Sending tool image (${path.basename(fullPath)}) to ${formattedJid}`);

    await targetSock.sendMessage(formattedJid, {
      image: imageBuffer,
      caption: caption || undefined,
    });

    console.log(`[WhatsApp:${userId || "default"}] Tool image successfully sent to ${formattedJid}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp:${userId || "default"}] Error sending tool image to ${jid}:`, error);
    return false;
  }
}

export async function sendCampaignMessage(jidOrPhone: string, text: string, userId?: string): Promise<{ success: boolean; error?: string }> {
  const session = getUserWASession(userId);
  const targetSock = session.sock;

  if (!targetSock || session.connectionStatus !== "connected") {
    return { success: false, error: "WhatsApp is not connected for this account." };
  }

  try {
    let clean = jidOrPhone.trim();
    if (!clean.includes("@")) {
      clean = clean.replace(/[^0-9]/g, "");
      clean = `${clean}@s.whatsapp.net`;
    }

    await targetSock.sendMessage(clean, { text });
    return { success: true };
  } catch (error: any) {
    console.error(`[WhatsApp:${userId || "default"}] Failed to send campaign message to ${jidOrPhone}:`, error);
    return {
      success: false,
      error: error?.message || error?.toString() || "Unknown WhatsApp transmission error",
    };
  }
}

export function getSocket(userId?: string) {
  return getUserWASession(userId).sock;
}

export function getConnectionStatus(userId?: string) {
  return getUserWASession(userId).connectionStatus;
}

export function getWhatsAppConnectionStatus(userId?: string) {
  return getConnectionStatus(userId);
}

export async function fetchAllGroups(forceRefresh = false, userId?: string) {
  const session = getUserWASession(userId);
  const targetSock = session.sock;
  if (!targetSock || session.connectionStatus !== "connected") {
    return null;
  }
  try {
    const groups = await targetSock.groupFetchAllParticipating();
    const result = [];
    for (const [jid, meta] of Object.entries(groups)) {
      const participants = (meta.participants || []).map((p: any) => {
        const rawId = p.id || "";
        const cleanNumber = rawId.split("@")[0].split(":")[0];
        return {
          id: rawId,
          phoneNumber: cleanNumber.startsWith("+") ? cleanNumber : `+${cleanNumber}`,
          admin: p.admin || null,
        };
      });
      result.push({
        id: jid,
        name: meta.subject || "Unnamed Group",
        totalMembers: participants.length || meta.size || 0,
        participants,
      });
    }
    return result;
  } catch (err) {
    console.warn("[WhatsApp] Failed to fetch participating groups:", err);
    return null;
  }
}

export function setupWhatsAppRoutes(app: Express) {
  app.get("/api/whatsapp/status", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const session = getUserWASession(user?.id);
      res.json({
        status: session.connectionStatus,
        qr: session.qrCodeDataUrl,
        pairingCode: session.pairingCodeData,
      });
    } catch {
      const fallback = getUserWASession();
      res.json({
        status: fallback.connectionStatus,
        qr: fallback.qrCodeDataUrl,
        pairingCode: fallback.pairingCodeData,
      });
    }
  });

  app.post("/api/whatsapp/connect", async (req, res) => {
    const user = await getUserByToken(req.headers.authorization);
    const session = getUserWASession(user?.id);

    if (session.connectionStatus === "disconnected") {
      await connectToWhatsApp(user?.id, false);
    }
    res.json({ success: true, status: session.connectionStatus });
  });

  app.post("/api/whatsapp/pair", async (req, res) => {
    const user = await getUserByToken(req.headers.authorization);
    const session = getUserWASession(user?.id);
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: "Phone number required" });

    try {
      if (session.sock && session.connectionStatus !== "disconnected") {
        session.isIntentionallyDisconnected = true;
        session.sock.ws.close();
        session.connectionStatus = "disconnected";
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      await connectToWhatsApp(user?.id, true);

      const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (!session.sock?.authState.creds.registered) {
        const code = await session.sock!.requestPairingCode(cleanNumber);
        session.pairingCodeData = code;
        res.json({ success: true, code });
      } else {
        res.status(400).json({ error: "Already registered/connected." });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const session = getUserWASession(user?.id);
      const { phoneNumber, message } = req.body;
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "Phone number and message are required." });
      }
      if (session.connectionStatus !== "connected" || !session.sock) {
        return res.status(400).json({ error: "WhatsApp is not connected for your account." });
      }

      await sendMessage(phoneNumber, message, user?.id);

      const { updateCustomerMemory } = await import("./memory.js");
      await updateCustomerMemory(phoneNumber, message, "agent");

      res.json({ success: true });
    } catch (err: any) {
      console.error("[WhatsApp] Failed to send manual message:", err);
      res.status(500).json({ error: err?.message || "Failed to send message" });
    }
  });

  app.post("/api/whatsapp/disconnect", async (req, res) => {
    const user = await getUserByToken(req.headers.authorization);
    const session = getUserWASession(user?.id);

    if (session.sock) {
      session.isIntentionallyDisconnected = true;
      session.sock.logout().catch(() => session.sock?.ws?.close());
      session.connectionStatus = "disconnected";
      session.pairingCodeData = null;
      session.qrCodeDataUrl = null;

      const authDir = getAuthDir(session.userId);
      await fs.rm(authDir, { recursive: true, force: true }).catch(console.error);
    }
    res.json({ success: true });
  });
}

// Auto-start WhatsApp connections on server boot for all registered sessions with valid creds
setTimeout(async () => {
  try {
    const authBaseDir = path.join(process.cwd(), "data", "auth");
    await fs.mkdir(authBaseDir, { recursive: true });

    // 1. Check admin/legacy session
    try {
      const adminAuthDir = await ensureAuthDir("usr_admin_badar");
      const creds = path.join(adminAuthDir, "creds.json");
      await fs.access(creds);
      console.log("[WhatsApp] Admin session found. Auto-reconnecting admin WhatsApp...");
      await connectToWhatsApp("usr_admin_badar", false);
    } catch {
      // No admin creds
    }

    // 2. Check each user directory in data/auth/
    const entries = await fs.readdir(authBaseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== "admin") {
        const userCreds = path.join(authBaseDir, entry.name, "creds.json");
        try {
          await fs.access(userCreds);
          console.log(`[WhatsApp] Existing session found for user ${entry.name}. Auto-reconnecting...`);
          await connectToWhatsApp(entry.name, false);
        } catch {
          // No creds for this user
        }
      }
    }
  } catch (err) {
    console.warn("[WhatsApp] Session auto-loader notice:", err);
  }
}, 1200);
