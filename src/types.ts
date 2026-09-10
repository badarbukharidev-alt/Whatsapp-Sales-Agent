export interface UserLimits {
  maxCampaigns: number;
  maxTools: number;
  dailyAiQuota: number;
  conversionLimit: number;
  maxConversations?: number;
  maxAiReplies: number;
  allowedAiModels: string[];
  hasAntiBanPriority: boolean;
  hasCustomBranding: boolean;
  hasPrioritySupport: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "suspended";
  plan: "Free" | "Pro" | "Agency" | "Enterprise";
  company?: string;
  phone?: string;
  createdAt: string;
  lastLogin?: string;
  assignedLimits?: UserLimits;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  details?: string;
}

export interface SystemDiagnostics {
  uptimeSeconds: number;
  memoryMb: number;
  totalUsers: number;
  activeUsers: number;
  admins: number;
  nodeVersion: string;
  platform: string;
}

export interface ToolImage {
  id: string;
  filename: string;
  filepath: string;
  url: string;
  title?: string;
  description: string;
  toolId?: string;
  createdAt?: string;
}

export interface ToolPricing {
  min_negotiable_pkr?: number;
  min_negotiable_usd?: number;
  negotiation_notes?: string;
  [key: string]: any;
}

export interface ToolObjectionResponses {
  too_expensive?: string;
  need_time?: string;
  comparing_competitor?: string;
  [key: string]: any;
}

export interface ToolSection {
  id?: string;
  title: string;
  content: string;
}

export interface ToolLink {
  title: string;
  url: string;
  note?: string;
}

export interface Tool {
  id: string;
  name: string;
  userId?: string;
  aliases?: string[];
  keywords?: string[];
  category?: string;
  status?: "active" | "inactive";
  description: string;
  pricePkr?: string;
  priceUsd?: string;
  pricing?: ToolPricing;
  objection_responses?: ToolObjectionResponses;
  related_tools?: string[];
  priority?: number;
  features?: string[];
  use_cases?: string[];
  requirements?: string[];
  limitations?: string[];
  how_to_use?: string;
  sales_points?: string[];
  faq?: Array<{ question: string; answer: string }>;
  images?: ToolImage[];
  conversationCount?: number;
  sections?: ToolSection[];
  links?: ToolLink[];
  rawDraft?: string;
}

export interface ChatMessage {
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
  imageUrl?: string;
}

export interface CustomerMemorySummary {
  lastSummarizedAt?: string;
  summaryText?: string;
  customerName?: string;
  preferredLanguage?: string;
  interestedTools?: string[];
  quotedPrices?: Record<string, string>;
  objectionsRaised?: string[];
  objectionsResolved?: string[];
  keyFacts?: string[];
  stage?: "greeting" | "discovery" | "negotiation" | "payment_pending" | "paid" | "support" | string;
  lastToolDiscussed?: string;
  totalTurnsCount?: number;
}

export interface CustomerList {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
  description?: string;
  customerPhoneNumbers?: string[];
  whatsappLabelId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WhatsAppLabelSyncStatus {
  isSupported: boolean;
  isBusinessAccount: boolean;
  status: "synced" | "unsupported" | "disconnected" | "simulated";
  reason: string;
  syncedAt?: string;
}

export type CustomerStatus =
  | "New Customer"
  | "Interested"
  | "Payment Pending"
  | "Payment Done"
  | "Order Complete"
  | "Follow Up"
  | "Important";

export interface Customer {
  phoneNumber: string;
  userId?: string;
  name?: string;
  status?: CustomerStatus;
  listIds?: string[];
  summary?: string;
  memorySummary?: CustomerMemorySummary;
  notes?: string;
  interestedTools?: string[];
  importantFacts?: string[];
  lastActivity?: string;
  createdAt?: string;
  statusUpdatedAt?: string;
  statusReason?: string;
  previousStatus?: CustomerStatus;
  statusManagedBy?: "AI managed" | "Manual";
  paymentClaimEvidence?: {
    claimedAt: string;
    messageSnippet?: string;
    verified: boolean;
    verifiedAt?: string;
    verifiedBy?: string;
    note?: string;
  };
  statusHistory?: Array<{
    status: CustomerStatus;
    fromStatus?: CustomerStatus;
    toStatus?: CustomerStatus;
    timestamp: string;
    reason?: string;
    changedBy?: "ai" | "admin" | "system" | "AI managed" | "Manual";
    updatedBy?: string;
  }>;
  messages?: ChatMessage[];
  factsStated?: { [toolId: string]: string[] };
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface PaymentMethod {
  id: string;
  provider: "Easypaisa" | "JazzCash" | "Bank Transfer" | "Raast" | "SadaPay" | "NayaPay" | "Crypto/USDT" | string;
  accountTitle: string;
  accountNumber: string;
  bankName?: string;
  iban?: string;
  instructions?: string;
  isActive: boolean;
}

export interface AgentSettings {
  aiAgentEnabled: boolean;
  preferredApi?: "gemini" | "deepseek-v3" | "claude-haiku" | "gptlogic" | string;
  defaultLLM?: "Gemini" | "DeepSeek" | "Claude" | "GPTLogic" | string;
  language?: string;
  autoReply?: boolean;
  humanLikeMode?: boolean;
  chatStyle?: string;
  maxTokens?: number;
  systemPrompt?: string;
  allowImageReplies?: boolean;
  salesSkillEnabled?: boolean;
  allowGroups?: boolean;
  allowChannels?: boolean;
  paymentMethods?: PaymentMethod[];
  paymentInstructions?: string;
  responseDelaySeconds?: number;
  geminiApiKey?: string;
  groqApiKey?: string;
  openAiApiKey?: string;
}

export interface WhatsAppStatus {
  status: "connected" | "disconnected" | "connecting";
  qr: string | null;
  pairingCode: string | null;
}

export interface CampaignTargetGroup {
  id: string; // Group JID e.g. "1203630283921@g.us"
  name: string;
  memberLimit: number; // Configured member limit e.g. 10
  totalMembers?: number;
}

export interface CampaignRateLimits {
  messagesPerHour: number; // e.g. 10
  messagesPerCampaign: number; // Total campaign max e.g. 30
  dailyLimit: number; // e.g. 50
  delayBetweenMessagesSeconds?: number; // Minimum gap e.g. 20-30s
}

export interface CampaignLogEntry {
  id: string;
  timestamp: string;
  groupName: string;
  groupId: string;
  targetNumber: string; // e.g. "+92300..."
  status: "Sent" | "Failed" | "Skipped";
  messageSnippet?: string;
  error?: string;
}

export interface CampaignState {
  id: string;
  name: string;
  status: "idle" | "running" | "paused" | "completed" | "stopped";
  pauseReason?: string; // e.g. "Campaign paused — sending requires attention."
  targetGroups: CampaignTargetGroup[];
  allowedCountryCodes: string[]; // e.g. ["+92"] or ["ALL"]
  rateLimits: CampaignRateLimits;

  // Round-Robin & Progress Tracking
  currentGroupIndex: number;
  groupMemberPointers: Record<string, number>; // groupId -> count of contacts sent/processed
  contactedPhoneNumbers: string[]; // List of contacted phone numbers to avoid duplicates
  messagesSent: number;
  messagesFailed: number;
  hourlySentCount: number;
  hourlyWindowStart: number;
  dailySentCount: number;
  dailyWindowStart: number;
  remainingQuota: number;
  lastSuccessfulSend?: string;
  lastError?: string;
  consecutiveFailures: number;

  // Content & AI Variations
  toolId?: string;
  topic?: string;
  messageVariations: string[];

  // Logs
  logs: CampaignLogEntry[];

  createdAt: string;
  updatedAt: string;
}

export interface DeepgramAccountUI {
  id: string;
  name: string;
  projectId: string;
  maskedProjectId: string;
  maskedApiKey: string;
  status: "ACTIVE" | "LOW_BALANCE" | "EXHAUSTED" | "ERROR" | "DISABLED";
  priority: number;
  enabled: boolean;
  balance: number;
  currency: string;
  lastChecked: string | null;
  lastSuccessfulRequest: string | null;
  lastError: string | null;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalAudioDurationSec: number;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeepgramStats {
  totalBalance: number;
  currency: string;
  totalAccounts: number;
  activeAccountsCount: number;
  todayRequests: number;
  todaySuccessful: number;
  todayFailed: number;
  todayAudioMinutes: number;
  periods: {
    today: { requests: number; audioMinutes: number; failed: number };
    week: { requests: number; audioMinutes: number; failed: number };
    month: { requests: number; audioMinutes: number; failed: number };
    allTime: { requests: number; audioMinutes: number; failed: number };
  };
}

export interface DeepgramConfigUI {
  rotationMode: "balance_aware" | "priority" | "round_robin";
  lowBalanceThreshold: number;
  autoRefreshIntervalMinutes: number;
  model: string;
  language: string;
  smartFormat: boolean;
  punctuate: boolean;
  numerals: boolean;
  customKeyterms: string[];
}

export interface DeepgramUsageLogUI {
  id: string;
  timestamp: string;
  accountId: string;
  accountName: string;
  customerJid?: string;
  audioDurationSec: number;
  model: string;
  status: "success" | "failed";
  errorType?: string;
  errorMessage?: string;
  transcriptSnippet?: string;
}

export interface PlanDefinitionUI {
  id: string;
  name: string;
  price: string;
  period: string;
  color?: string;
  popular?: boolean;
  description: string;
  conversionCap: number | string;
  campaignsCap: number | string;
  toolsCap: number | string;
  dailyAiQuota: number | string;
  maxConversations?: number | string;
  maxAiReplies: number | string;
  models: string[];
  antiBan: boolean;
  branding: boolean;
  vipSupport: boolean;
  limits: UserLimits;
}

export interface UsageStats {
  totalAiRepliesAllTime: number;
  totalMessagesAllTime: number;
  aiRepliesToday: number;
  messagesToday: number;
  aiRepliesThisMonth: number;
  plan: string;
  maxAiReplies: number;
  remainingAiReplies: number;
  isLimitReached: boolean;
  dailyAiReplies: Record<string, number>;
  dailyUserMessages: Record<string, number>;
}


