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

/**
 * Sales-journey stages the agent infers from the conversation. Internal only —
 * never shown to the customer. Used to decide what to say next, what NOT to
 * repeat, and whether visual proof would help.
 */
export type SalesStage =
  | "new_lead"
  | "researching"
  | "downloaded"
  | "installed"
  | "awaiting_license"
  | "hwid_provided"
  | "price_inquiry"
  | "comparing_plans"
  | "trust_check"
  | "objection_price"
  | "objection_other"
  | "feature_inquiry"
  | "niche_guidance"
  | "results_inquiry"
  | "proof_request"
  | "ready_to_buy"
  | "plan_monthly"
  | "plan_lifetime"
  | "awaiting_payment_details"
  | "paid"
  | "activation"
  | "support"
  | "returning_customer";

/**
 * Optional sales metadata an admin can attach to an uploaded image so the agent
 * can decide — semantically, not by keyword — whether showing it would
 * strengthen the current conversation. Every field is optional: images that
 * only have the legacy `description` still work, the description is simply
 * interpreted as the sales context itself.
 */
export interface ToolImageSalesMeta {
  /** What this image is FOR, in plain words, e.g. "social proof from real buyers". */
  purpose?: string;
  /** Loose grouping, e.g. "social_proof" | "analytics" | "tutorial" | "feature" | "pricing". */
  category?: string;
  /** Free-text situations where showing it helps. */
  sales_context?: string[];
  /** Conditions/topics that should trigger it. */
  use_when?: string[];
  /** Conditions where it must NOT be sent. */
  avoid_when?: string[];
  /** Customer signals it answers, e.g. "skeptical", "asking for proof". */
  customer_signals?: string[];
  /** Stages where it is appropriate. */
  sales_stage?: SalesStage[];
  /** Higher wins when several images match. Default 1. */
  priority?: number;
  /** Minimum minutes before this same image may be sent again. Default 30. */
  cooldown_minutes?: number;
  /** Hard cap on sends per conversation. Default 1. */
  max_per_conversation?: number;
  /** What the image legitimately demonstrates. */
  what_it_proves?: string;
  /** Claims the agent must NOT derive from it (guardrail against overselling). */
  what_it_does_not_prove?: string;
}

export interface ToolImage extends ToolImageSalesMeta {
  id: string;
  filename: string;
  filepath: string;
  url: string;
  title?: string;
  description: string;
  toolId?: string;
  createdAt?: string;
}

/** One record of an image actually delivered to a customer, for cooldown/repeat protection. */
export interface SentImageRecord {
  imageId: string;
  toolId?: string;
  /** ISO timestamp of the send. */
  at: string;
}

export interface ToolPricing {
  min_negotiable_pkr?: number;
  min_negotiable_usd?: number;
  negotiation_notes?: string;
  /**
   * TRUE remaining-availability count you maintain by hand (e.g. limited
   * license IDs / onboarding slots for this batch). When set, the agent is
   * allowed to use it for real urgency/scarcity messaging. Leave unset/undefined
   * to disable scarcity messaging entirely — the agent is never allowed to
   * invent a number that isn't configured here.
   */
  slots_remaining?: number;
  /** Optional short note on WHY slots are limited (shown to the agent only), e.g. "manual HWID activation, batch of 10". */
  slots_note?: string;
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

/**
 * Admin-authored onboarding message that is sent EXACTLY as stored the first time
 * a customer starts discussing this specific product (before the AI reply).
 */
export interface ToolTemplateMessage {
  enabled?: boolean;
  content?: string;
  /** Default true: send only once per conversation for this product. */
  sendOnce?: boolean;
  /** Default false: when true, only {tool_name} {price_pkr} {price_usd} {link} are substituted. */
  variablesEnabled?: boolean;
}

/**
 * Structured, product-specific sales intelligence used to drive controlled,
 * state-aware selling. Every field is optional and injected dynamically only
 * for the currently locked product.
 */
export interface ToolSalesData {
  ideal_customer?: string;
  pain_points?: string[];
  primary_selling_point?: string;
  secondary_selling_points?: string[];
  value_arguments?: string[];
  discovery_questions?: string[];
  common_objections?: string[];
  objection_strategy?: string;
  negotiation_rules?: string;
  allowed_discounts?: string;
  urgency_rules?: string;
  buying_signals?: string[];
  closing_strategy?: string;
  cross_sell_rules?: string;
  support_notes?: string;
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
  /** Saved product onboarding template sent first when a customer starts discussing this tool. */
  templateMessage?: ToolTemplateMessage;
  /** Extended product-specific sales intelligence. */
  sales?: ToolSalesData;
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
  /** Product the conversation is currently locked to (id + name). */
  currentProductId?: string;
  currentProductName?: string;
  /** Tool ids whose onboarding template message has already been sent in this conversation. */
  templatesSent?: string[];

  // --- Sales-journey awareness (inferred, internal only) -------------------
  /** Where this customer currently is in the buying journey. */
  journeyStage?: SalesStage;
  /** Customer confirmed they downloaded the app — never re-send download info blindly. */
  appDownloaded?: boolean;
  /** Customer confirmed they installed the app. */
  appInstalled?: boolean;
  /** Customer used the free trial. */
  trialUsed?: boolean;
  /** Device ID / Hardware ID the customer supplied — never ask for it twice. */
  hwid?: string;
  /** Plan the customer settled on. */
  selectedPlan?: "monthly" | "lifetime" | string;
  /** True once real payment account details have been delivered. */
  paymentDetailsSent?: boolean;
  /** What the customer is trying to achieve (e.g. "faceless shorts channel"). */
  customerGoal?: string;
  /** Niche / content type they mentioned. */
  nicheType?: string;
  /** Where the lead came from, when it can actually be determined. */
  leadSource?: "meta_ad" | "instagram" | "whatsapp" | "organic" | "direct" | "existing_user" | string;
  /** Every image already delivered, for cooldown + anti-repeat enforcement. */
  imagesSent?: SentImageRecord[];
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


