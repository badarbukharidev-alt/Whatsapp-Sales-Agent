import path from "path";
import { Customer, CustomerStatus, ChatMessage, CustomerMemorySummary } from "../../types.js";
import { JsonStore } from "../storage/json-store.js";
import { extractStructuredMemory } from "./memory-summarizer.js";

export const VALID_CUSTOMER_STATUSES: CustomerStatus[] = [
  "New Customer",
  "Interested",
  "Payment Pending",
  "Payment Done",
  "Order Complete",
  "Follow Up",
  "Important",
];

export function normalizeCustomerStatus(rawStatus?: string): CustomerStatus {
  if (!rawStatus) return "New Customer";
  const s = rawStatus.trim().toLowerCase();
  if (s === "new customer" || s === "new") return "New Customer";
  if (s === "interested") return "Interested";
  if (s === "payment pending" || s === "buying") return "Payment Pending";
  if (s === "payment done") return "Payment Done";
  if (s === "order complete" || s === "customer" || s === "completed") return "Order Complete";
  if (s === "follow up" || s === "follow-up" || s === "inactive") return "Follow Up";
  if (s === "important" || s === "vip") return "Important";
  return "New Customer";
}

export function normalizeJid(jid: string): string {
  if (!jid) return "";
  // Strip device suffix (e.g., 923001234567:12@s.whatsapp.net -> 923001234567@s.whatsapp.net)
  return jid.replace(/:\d+@/, "@").trim();
}

// Global Customer Store instance
const customersFilePath = path.join(process.cwd(), "data", "customers.json");
const customerStore = new JsonStore<Record<string, Customer>>(customersFilePath, {});

export class CustomerService {
  private store: JsonStore<Record<string, Customer>>;

  constructor(store: JsonStore<Record<string, Customer>>) {
    this.store = store;
  }

  /**
   * Loads existing customer record BEFORE generating a reply.
   * Keyed permanently by normalized phone number/JID.
   */
  async getCustomerByJid(jid: string, userId = "usr_admin_badar", nameHint?: string): Promise<Customer> {
    const cleanJid = normalizeJid(jid);
    const customers = await this.store.get();

    let customer = customers[cleanJid];
    if (!customer) {
      // Initialize permanent record for new customer
      customer = {
        phoneNumber: cleanJid,
        userId,
        name: nameHint && !/^(customer|user|client)$/i.test(nameHint) ? nameHint : undefined,
        status: "New Customer",
        statusManagedBy: "AI managed",
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messages: [],
        factsStated: {},
        memorySummary: {
          customerName: nameHint && !/^(customer|user|client)$/i.test(nameHint) ? nameHint : undefined,
          stage: "greeting",
          interestedTools: [],
          quotedPrices: {},
          objectionsRaised: [],
          keyFacts: [],
          totalTurnsCount: 0,
          summaryText: "New lead. No prior conversation.",
        },
      };

      customers[cleanJid] = customer;
      await this.store.set(customers);
    } else {
      // Ensure memorySummary is populated if legacy
      if (!customer.memorySummary) {
        customer.memorySummary = extractStructuredMemory(undefined, customer.messages || [], customer.name || nameHint);
        customer.summary = customer.memorySummary.summaryText;
        customers[cleanJid] = customer;
        await this.store.set(customers);
      }
      if (nameHint && !customer.name && !/^(customer|user|client)$/i.test(nameHint)) {
        customer.name = nameHint;
        if (customer.memorySummary) customer.memorySummary.customerName = nameHint;
        customers[cleanJid] = customer;
        await this.store.set(customers);
      }
    }

    return customer;
  }

  /**
   * Retrieves conversation history with optional limit.
   * Default: returns last N messages to eliminate prompt bloat.
   */
  async getConversationHistory(jid: string, userId = "usr_admin_badar", limit?: number): Promise<ChatMessage[]> {
    const customer = await this.getCustomerByJid(jid, userId);
    const messages = customer.messages || [];
    if (typeof limit === "number" && limit > 0) {
      return messages.slice(-limit);
    }
    return messages;
  }

  /**
   * Retrieves compact long-term customer summary.
   */
  async getCustomerSummary(jid: string, userId = "usr_admin_badar"): Promise<CustomerMemorySummary> {
    const customer = await this.getCustomerByJid(jid, userId);
    if (!customer.memorySummary) {
      customer.memorySummary = extractStructuredMemory(undefined, customer.messages || [], customer.name);
    }
    return customer.memorySummary;
  }

  /**
   * Saves incoming customer message or outgoing agent message immediately after processing.
   */
  async saveMessage(
    jid: string,
    role: "user" | "agent" | "system",
    content: string,
    userId = "usr_admin_badar",
    metadata?: { imageUrl?: string; nameHint?: string }
  ): Promise<Customer> {
    const cleanJid = normalizeJid(jid);
    const customers = await this.store.get();

    let customer = customers[cleanJid];
    if (!customer) {
      customer = await this.getCustomerByJid(cleanJid, userId, metadata?.nameHint);
      customers[cleanJid] = customer;
    }

    if (!customer.messages) customer.messages = [];
    const timestamp = new Date().toISOString();

    customer.messages.push({
      role,
      content,
      timestamp,
      imageUrl: metadata?.imageUrl,
    });

    customer.lastActivity = timestamp;
    if (metadata?.nameHint && !customer.name && !/^(customer|user|client)$/i.test(metadata.nameHint)) {
      customer.name = metadata.nameHint;
    }

    // Keep up to last 40 raw messages for audit while long-term memory summarizes older context
    if (customer.messages.length > 40) {
      customer.messages = customer.messages.slice(-40);
    }

    // Update structured memory and compact narrative summary
    customer.memorySummary = extractStructuredMemory(customer.memorySummary, customer.messages, customer.name || metadata?.nameHint);
    customer.summary = customer.memorySummary.summaryText;

    customers[cleanJid] = customer;
    await this.store.set(customers);
    return customer;
  }

  /**
   * Updates customer structured memory fields.
   */
  async updateCustomerMemory(
    jid: string,
    memoryData: Partial<CustomerMemorySummary>,
    userId = "usr_admin_badar"
  ): Promise<Customer> {
    const cleanJid = normalizeJid(jid);
    const customers = await this.store.get();
    const customer = customers[cleanJid] || (await this.getCustomerByJid(cleanJid, userId));

    customer.memorySummary = {
      ...(customer.memorySummary || extractStructuredMemory(undefined, customer.messages || [], customer.name)),
      ...memoryData,
      lastSummarizedAt: new Date().toISOString(),
    };
    customer.summary = customer.memorySummary.summaryText;

    customers[cleanJid] = customer;
    await this.store.set(customers);
    return customer;
  }

  /**
   * Updates customer sales state adhering to business logic:
   * - AI can NEVER mark Order Complete without manual verification.
   * - Preserves manual status overrides.
   * - Tracks audit history.
   */
  async updateCustomerSalesState(
    jid: string,
    newStatus: string,
    reason?: string,
    changedBy: "ai" | "admin" | "system" | "AI managed" | "Manual" = "system",
    userId = "usr_admin_badar",
    paymentEvidence?: { messageSnippet?: string; claimedAt?: string }
  ): Promise<{ success: boolean; status: CustomerStatus; previousStatus: CustomerStatus; customer: Customer }> {
    const cleanJid = normalizeJid(jid);
    const normalized = normalizeCustomerStatus(newStatus);
    const customers = await this.store.get();
    const customer = customers[cleanJid] || (await this.getCustomerByJid(cleanJid, userId));

    const previousStatus: CustomerStatus = normalizeCustomerStatus(customer.status);
    const isAi = changedBy === "ai" || changedBy === "AI managed";
    const managedByLabel: "AI managed" | "Manual" = isAi ? "AI managed" : "Manual";

    // RULE: AI cannot mark Order Complete without admin verification
    if (isAi && normalized === "Order Complete") {
      return { success: false, status: previousStatus, previousStatus, customer };
    }

    // RULE: If already Order Complete, AI cannot downgrade it
    if (isAi && previousStatus === "Order Complete") {
      return { success: false, status: previousStatus, previousStatus, customer };
    }

    // RULE: If marked Important by admin, AI should not downgrade to New Customer
    if (isAi && previousStatus === "Important" && (normalized === "New Customer" || normalized === "Interested")) {
      return { success: false, status: previousStatus, previousStatus, customer };
    }

    const timestamp = new Date().toISOString();

    if (normalized === "Payment Done") {
      customer.paymentClaimEvidence = {
        claimedAt: paymentEvidence?.claimedAt || timestamp,
        messageSnippet: paymentEvidence?.messageSnippet || reason || "Customer stated payment was sent",
        verified: false,
      };
    }

    if (normalized === "Order Complete" && customer.paymentClaimEvidence) {
      customer.paymentClaimEvidence.verified = true;
      customer.paymentClaimEvidence.verifiedAt = timestamp;
      customer.paymentClaimEvidence.verifiedBy = "admin";
      customer.paymentClaimEvidence.note = reason || "Payment manually verified by admin";
    }

    if (previousStatus !== normalized || !customer.statusUpdatedAt) {
      customer.previousStatus = previousStatus;
      customer.status = normalized;
      customer.statusUpdatedAt = timestamp;
      customer.statusReason = reason || `Moved from ${previousStatus} to ${normalized}`;
      customer.statusManagedBy = managedByLabel;

      if (!customer.statusHistory) customer.statusHistory = [];
      customer.statusHistory.push({
        status: normalized,
        fromStatus: previousStatus,
        toStatus: normalized,
        timestamp,
        reason: reason || `Status moved to ${normalized}`,
        changedBy: managedByLabel,
        updatedBy: managedByLabel === "AI managed" ? "AI Agent" : "Admin",
      });

      if (customer.statusHistory.length > 30) {
        customer.statusHistory = customer.statusHistory.slice(-30);
      }

      customers[cleanJid] = customer;
      await this.store.set(customers);

      // Trigger WhatsApp label sync if supported
      import("../lists.js")
        .then(({ syncCustomerToWhatsAppNativeLabel }) => {
          syncCustomerToWhatsAppNativeLabel(cleanJid, normalized).catch(() => {});
        })
        .catch(() => {});

      return { success: true, status: normalized, previousStatus, customer };
    }

    return { success: true, status: previousStatus, previousStatus, customer };
  }

  /**
   * Multi-tenant customer query.
   */
  async getCustomers(userId?: string): Promise<Record<string, Customer>> {
    const all = await this.store.get();
    if (!userId || userId === "usr_admin_badar" || userId === "admin") {
      return all;
    }
    const filtered: Record<string, Customer> = {};
    for (const [key, cust] of Object.entries(all)) {
      if (cust.userId === userId || !cust.userId) {
        filtered[key] = cust;
      }
    }
    return filtered;
  }

  async getCustomerList(userId?: string): Promise<Customer[]> {
    const map = await this.getCustomers(userId);
    return Object.values(map);
  }

  async saveCustomers(data: Record<string, Customer> | Customer[], userId?: string): Promise<void> {
    const record: Record<string, Customer> = {};
    if (Array.isArray(data)) {
      data.forEach((c) => {
        if (c && c.phoneNumber) {
          record[normalizeJid(c.phoneNumber)] = { ...c, phoneNumber: normalizeJid(c.phoneNumber) };
        }
      });
    } else {
      for (const [k, v] of Object.entries(data)) {
        record[normalizeJid(k)] = { ...v, phoneNumber: normalizeJid(k) };
      }
    }
    await this.store.set(record);
  }

  async deleteCustomer(jid: string, userId?: string): Promise<boolean> {
    const cleanJid = normalizeJid(jid);
    const customers = await this.store.get();
    if (customers[cleanJid]) {
      delete customers[cleanJid];
      await this.store.set(customers);
      return true;
    }
    return false;
  }

  async deleteCustomerMessages(jid: string, userId?: string): Promise<boolean> {
    const cleanJid = normalizeJid(jid);
    const customers = await this.store.get();
    if (customers[cleanJid]) {
      customers[cleanJid].messages = [];
      if (customers[cleanJid].memorySummary) {
        customers[cleanJid].memorySummary!.totalTurnsCount = 0;
      }
      customers[cleanJid].lastActivity = new Date().toISOString();
      await this.store.set(customers);
      return true;
    }
    return false;
  }

  /**
   * Automatic migration for existing customer data.
   */
  async migrateLegacyCustomers(): Promise<number> {
    const customers = await this.store.get();
    let migratedCount = 0;

    for (const [key, cust] of Object.entries(customers)) {
      let changed = false;
      if (!cust.userId) {
        cust.userId = "usr_admin_badar";
        changed = true;
      }
      if (!cust.status) {
        cust.status = "New Customer";
        changed = true;
      }
      if (!cust.memorySummary) {
        cust.memorySummary = extractStructuredMemory(undefined, cust.messages || [], cust.name);
        cust.summary = cust.memorySummary.summaryText;
        changed = true;
      }
      if (!cust.factsStated) {
        cust.factsStated = {};
        changed = true;
      }
      if (changed) {
        customers[key] = cust;
        migratedCount++;
      }
    }

    if (migratedCount > 0) {
      await this.store.set(customers);
      console.log(`[CustomerService] Migrated ${migratedCount} legacy customer records with structured memory.`);
    }

    return migratedCount;
  }
}

export const customerService = new CustomerService(customerStore);
