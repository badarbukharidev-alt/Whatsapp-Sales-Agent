import { Express } from "express";
import path from "path";
import { Customer, CustomerStatus } from "../types.js";
import {
  customerService,
  normalizeCustomerStatus,
  normalizeJid,
  VALID_CUSTOMER_STATUSES
} from "./services/customer-service.js";
import { getUserByToken } from "./auth.js";
import { recordAiReply, recordUserMessage } from "./usage.js";

export { VALID_CUSTOMER_STATUSES, normalizeCustomerStatus, normalizeJid };

export const getCustomersFile = () => path.join(process.cwd(), "data", "customers.json");

export async function getCustomers(userId?: string): Promise<Record<string, Customer>> {
  return customerService.getCustomers(userId);
}

export async function getCustomerList(userId?: string): Promise<Customer[]> {
  return customerService.getCustomerList(userId);
}

export async function saveCustomers(data: Record<string, Customer> | Customer[], userId?: string): Promise<void> {
  return customerService.saveCustomers(data, userId);
}

export async function saveCustomer(phoneNumber: string, data: Partial<Customer>, userId?: string): Promise<Customer> {
  const cleanJid = normalizeJid(phoneNumber);
  const existing = await customerService.getCustomerByJid(cleanJid, userId);
  const updatedStatus = normalizeCustomerStatus(data.status || existing.status);

  const updated: Customer = {
    ...existing,
    ...data,
    phoneNumber: cleanJid,
    status: updatedStatus,
    userId: userId || existing.userId || "usr_admin_badar",
  };

  const customers = await customerService.getCustomers(userId);
  customers[cleanJid] = updated;
  await customerService.saveCustomers(customers, userId);
  return updated;
}

export async function updateCustomerStatus(
  phoneNumber: string,
  newStatus: string,
  reason?: string,
  changedBy: "ai" | "admin" | "system" | "AI managed" | "Manual" = "system",
  paymentEvidence?: { messageSnippet?: string; claimedAt?: string },
  userId?: string
) {
  return customerService.updateCustomerSalesState(phoneNumber, newStatus, reason, changedBy, userId, paymentEvidence);
}

export async function updateCustomerMemory(
  phoneNumber: string,
  newMessage: any,
  role: "user" | "agent",
  userId = "usr_admin_badar"
) {
  const customer = await customerService.saveMessage(phoneNumber, role, String(newMessage), userId);

  // Permanently record in persistent usage so deleting customers never resets monthly stats
  if (role === "agent") {
    recordAiReply().catch((err) => console.error("[Memory] Error recording AI reply usage:", err));
  } else if (role === "user") {
    recordUserMessage().catch((err) => console.error("[Memory] Error recording user message usage:", err));
  }

  return customer;
}

export function setupMemoryRoutes(app: Express) {
  app.get("/api/customers", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const customers = await customerService.getCustomerList(user ? user.id : undefined);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to load customers" });
    }
  });

  // Update customer details (status, name, notes, interestedTools, listIds)
  app.put("/api/customers/:phoneNumber", async (req, res) => {
    try {
      const user = await getUserByToken(req.headers.authorization);
      const { phoneNumber } = req.params;
      const cleanJid = normalizeJid(phoneNumber);
      const existing = await customerService.getCustomerByJid(cleanJid, user?.id);

      const prevStatus = existing.status || "New Customer";
      const newStatus = req.body.status ? normalizeCustomerStatus(req.body.status) : prevStatus;
      const isStatusChanged = newStatus !== prevStatus;
      const timestamp = new Date().toISOString();

      const updatedCustomer: Customer = {
        ...existing,
        ...req.body,
        status: newStatus,
        phoneNumber: cleanJid,
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
          updatedBy: user?.name || "Admin",
        });

        if (newStatus === "Order Complete" && updatedCustomer.paymentClaimEvidence) {
          updatedCustomer.paymentClaimEvidence.verified = true;
          updatedCustomer.paymentClaimEvidence.verifiedAt = timestamp;
          updatedCustomer.paymentClaimEvidence.verifiedBy = "admin";
        }
      }

      const customers = await customerService.getCustomers(user?.id);
      customers[cleanJid] = updatedCustomer;
      await customerService.saveCustomers(customers, user?.id);

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
      const result = await customerService.updateCustomerSalesState(
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
      const user = await getUserByToken(req.headers.authorization);
      const { phoneNumber } = req.params;
      const success = await customerService.deleteCustomerMessages(phoneNumber, user?.id);
      if (success) {
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
      const user = await getUserByToken(req.headers.authorization);
      const { phoneNumber } = req.params;
      const success = await customerService.deleteCustomer(phoneNumber, user?.id);
      if (success) {
        return res.json({ success: true, message: "Customer deleted successfully." });
      }
      res.status(404).json({ error: "Customer not found" });
    } catch (error) {
      console.error("Failed to delete customer:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });
}
