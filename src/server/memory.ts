import { Express } from "express";
import fs from "fs/promises";
import path from "path";
import { Customer, CustomerStatus } from "../types.js";
import { recordAiReply, recordUserMessage } from "./usage.js";

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

export const getCustomersFile = () => path.join(process.cwd(), "data", "customers.json");

export async function getCustomers(): Promise<Record<string, Customer>> {
  try {
    const data = await fs.readFile(getCustomersFile(), "utf-8");
    const parsed = JSON.parse(data);
    // Normalize statuses on read
    for (const key of Object.keys(parsed)) {
      if (parsed[key]) {
        parsed[key].status = normalizeCustomerStatus(parsed[key].status);
        if (!parsed[key].phoneNumber) parsed[key].phoneNumber = key;
        if (!parsed[key].statusManagedBy) {
          parsed[key].statusManagedBy = parsed[key].status === "Order Complete" ? "Manual" : "AI managed";
        }
        if (!parsed[key].factsStated) {
          parsed[key].factsStated = {};
        }
      }
    }
    return parsed;
  } catch (error) {
    return {};
  }
}

export async function getCustomerList(): Promise<Customer[]> {
  const map = await getCustomers();
  return Object.values(map);
}

export async function saveCustomers(data: Record<string, Customer> | Customer[]): Promise<void> {
  let record: Record<string, Customer> = {};
  if (Array.isArray(data)) {
    data.forEach(c => {
      if (c && c.phoneNumber) {
        record[c.phoneNumber] = c;
      }
    });
  } else {
    record = data;
  }
  await fs.mkdir(path.dirname(getCustomersFile()), { recursive: true });
  await fs.writeFile(getCustomersFile(), JSON.stringify(record, null, 2), "utf-8");
}

export async function saveCustomer(phoneNumber: string, data: Partial<Customer>): Promise<Customer> {
  const customers = await getCustomers();
  const existing = customers[phoneNumber] || {
    phoneNumber,
    messages: [],
    status: "New Customer",
    factsStated: {},
    createdAt: new Date().toISOString()
  };

  const status = normalizeCustomerStatus(data.status || existing.status);
  customers[phoneNumber] = {
    ...existing,
    ...data,
    status,
    phoneNumber
  };

  await saveCustomers(customers);
  return customers[phoneNumber];
}

/**
 * Updates customer status with strict business rules:
 * - AI can NEVER set "Order Complete" (only admin manual verification)
 * - If status is "Order Complete", AI cannot downgrade it
 * - If status is "Important", AI does not casually overwrite it
 * - Automatically tracks previousStatus, statusReason, and statusManagedBy ("AI managed" vs "Manual")
 * - Maintains chronological statusHistory audit trail
 */
export async function updateCustomerStatus(
  phoneNumber: string,
  newStatus: string,
  reason?: string,
  changedBy: "ai" | "admin" | "system" | "AI managed" | "Manual" = "system",
  paymentEvidence?: { messageSnippet?: string; claimedAt?: string }
): Promise<{ success: boolean; status: CustomerStatus; previousStatus: CustomerStatus; customer: Customer }> {
  const normalized = normalizeCustomerStatus(newStatus);
  const customers = await getCustomers();
  const customer: Customer = customers[phoneNumber] || {
    phoneNumber,
    messages: [],
    status: "New Customer",
    statusManagedBy: "AI managed",
    createdAt: new Date().toISOString(),
  };

  const previousStatus: CustomerStatus = normalizeCustomerStatus(customer.status);
  const isAi = changedBy === "ai" || changedBy === "AI managed";
  const managedByLabel: "AI managed" | "Manual" = isAi ? "AI managed" : "Manual";

  // RULE: AI can NEVER mark Order Complete without manual admin verification
  if (isAi && normalized === "Order Complete") {
    console.log(`[Memory] Rejected AI status transition to 'Order Complete' for ${phoneNumber}. Admin verification required.`);
    return { success: false, status: previousStatus, previousStatus, customer };
  }

  // RULE: If already Order Complete, AI cannot overwrite it
  if (isAi && previousStatus === "Order Complete") {
    console.log(`[Memory] Preserved 'Order Complete' status for ${phoneNumber}. AI cannot downgrade verified order.`);
    return { success: false, status: previousStatus, previousStatus, customer };
  }

  // RULE: If marked Important by admin, AI should not downgrade to New Customer on minor chat
  if (isAi && previousStatus === "Important" && (normalized === "New Customer" || normalized === "Interested")) {
    return { success: false, status: previousStatus, previousStatus, customer };
  }

  const timestamp = new Date().toISOString();

  // If status is "Payment Done", record payment claim evidence
  if (normalized === "Payment Done") {
    customer.paymentClaimEvidence = {
      claimedAt: paymentEvidence?.claimedAt || timestamp,
      messageSnippet: paymentEvidence?.messageSnippet || reason || "Customer stated payment was sent",
      verified: false
    };
  }

  // If transitioning to "Order Complete" via manual verification, mark evidence as verified
  if (normalized === "Order Complete" && customer.paymentClaimEvidence) {
    customer.paymentClaimEvidence.verified = true;
    customer.paymentClaimEvidence.verifiedAt = timestamp;
    customer.paymentClaimEvidence.verifiedBy = "admin";
    customer.paymentClaimEvidence.note = reason || "Payment manually verified by admin";
  }

  // If status is changing
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
      updatedBy: managedByLabel === "AI managed" ? "AI Agent" : "Admin"
    });

    // Cap status history at 30 entries
    if (customer.statusHistory.length > 30) {
      customer.statusHistory = customer.statusHistory.slice(-30);
    }

    customers[phoneNumber] = customer;
    await saveCustomers(customers);
    console.log(`[Memory] Customer ${phoneNumber} status updated: [${previousStatus}] -> [${normalized}] (${managedByLabel})`);

    // Asynchronously trigger native WhatsApp label sync if supported
    import("./lists.js").then(({ syncCustomerToWhatsAppNativeLabel }) => {
      syncCustomerToWhatsAppNativeLabel(phoneNumber, normalized).catch(() => {});
    }).catch(() => {});

    return { success: true, status: normalized, previousStatus, customer };
  }

  return { success: true, status: previousStatus, previousStatus, customer };
}

export async function updateCustomerMemory(phoneNumber: string, newMessage: any, role: "user" | "agent") {
  const customers = await getCustomers();
  const customer: Customer = customers[phoneNumber] || { 
    phoneNumber, 
    messages: [], 
    summary: "", 
    status: "New Customer",
    statusManagedBy: "AI managed",
    createdAt: new Date().toISOString() 
  };
  
  if (!customer.messages) customer.messages = [];
  customer.messages.push({ role, content: newMessage, timestamp: new Date().toISOString() });
  
  // Keep up to last 30 messages for accurate anti-repetition and contextual continuity
  if (customer.messages.length > 30) {
    customer.messages = customer.messages.slice(-30);
  }

  customer.lastActivity = new Date().toISOString();
  if (!customer.status) {
    customer.status = "New Customer";
    customer.statusManagedBy = "AI managed";
  }
  
  customers[phoneNumber] = customer;
  await saveCustomers(customers);

  // Permanently record in persistent usage so deleting customers never decreases AI reply stats or resets quotas
  if (role === "agent") {
    recordAiReply().catch((err) => console.error("[Memory] Error recording AI reply usage:", err));
  } else if (role === "user") {
    recordUserMessage().catch((err) => console.error("[Memory] Error recording user message usage:", err));
  }
}

export function setupMemoryRoutes(app: Express) {
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await getCustomerList();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to load customers" });
    }
  });

  // Update customer details (status, name, notes, interestedTools, listIds)
  app.put("/api/customers/:phoneNumber", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const customers = await getCustomers();
      const existing = customers[phoneNumber] || { 
        phoneNumber, 
        messages: [], 
        status: "New Customer", 
        statusManagedBy: "Manual",
        createdAt: new Date().toISOString() 
      };

      const prevStatus = existing.status || "New Customer";
      const newStatus = req.body.status ? normalizeCustomerStatus(req.body.status) : prevStatus;
      const isStatusChanged = newStatus !== prevStatus;
      const timestamp = new Date().toISOString();

      const updatedCustomer: Customer = {
        ...existing,
        ...req.body,
        status: newStatus,
        phoneNumber,
        lastActivity: timestamp,
      };

      if (isStatusChanged) {
        updatedCustomer.previousStatus = prevStatus;
        updatedCustomer.statusUpdatedAt = timestamp;
        updatedCustomer.statusReason = req.body.reason || "Manual update by admin";
        updatedCustomer.statusManagedBy = "Manual";

        if (!updatedCustomer.statusHistory) updatedCustomer.statusHistory = [];
        updatedCustomer.statusHistory.push({
          status: newStatus,
          fromStatus: prevStatus,
          toStatus: newStatus,
          timestamp,
          reason: req.body.reason || "Manual update by admin",
          changedBy: "Manual",
          updatedBy: "Admin"
        });

        if (newStatus === "Order Complete" && updatedCustomer.paymentClaimEvidence) {
          updatedCustomer.paymentClaimEvidence.verified = true;
          updatedCustomer.paymentClaimEvidence.verifiedAt = timestamp;
          updatedCustomer.paymentClaimEvidence.verifiedBy = "admin";
        }
      }

      customers[phoneNumber] = updatedCustomer;
      await saveCustomers(customers);

      res.json({ success: true, customer: updatedCustomer });
    } catch (error) {
      console.error("Failed to update customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Verify payment & complete order manually by admin
  app.post("/api/customers/:phoneNumber/verify-order", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const result = await updateCustomerStatus(
        phoneNumber,
        "Order Complete",
        req.body?.note || "Payment manually verified by admin. Order Complete.",
        "Manual"
      );
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Failed to verify order:", error);
      res.status(500).json({ error: "Failed to verify order" });
    }
  });

  // Delete chat history only for a customer
  app.delete("/api/customers/:phoneNumber/messages", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const customers = await getCustomers();
      if (customers[phoneNumber]) {
        customers[phoneNumber].messages = [];
        customers[phoneNumber].lastActivity = new Date().toISOString();
        await saveCustomers(customers);
        return res.json({ success: true, message: "Chat history deleted successfully." });
      }
      res.status(404).json({ error: "Customer not found" });
    } catch (error) {
      console.error("Failed to delete chat history:", error);
      res.status(500).json({ error: "Failed to delete chat history" });
    }
  });

  // Delete entire customer
  app.delete("/api/customers/:phoneNumber", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const customers = await getCustomers();
      if (customers[phoneNumber]) {
        delete customers[phoneNumber];
        await saveCustomers(customers);
        return res.json({ success: true, message: "Customer deleted successfully." });
      }
      res.status(404).json({ error: "Customer not found" });
    } catch (error) {
      console.error("Failed to delete customer:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });
}

