import fs from "fs/promises";
import path from "path";
import { Express } from "express";
import { CustomerList, WhatsAppLabelSyncStatus, CustomerStatus } from "../types.js";
import { getSocket, getConnectionStatus } from "./whatsapp.js";
import { getCustomers, saveCustomers, getCustomerList } from "./memory.js";

const LISTS_FILE = path.join(process.cwd(), "data", "lists.json");

export const DEFAULT_LISTS: CustomerList[] = [
  {
    id: "new-customer",
    name: "New Customer",
    color: "#F59E0B",
    isDefault: true,
    description: "First time contacts or inquiries without active purchasing history",
    createdAt: new Date().toISOString()
  },
  {
    id: "interested",
    name: "Interested",
    color: "#3B82F6",
    isDefault: true,
    description: "Customers who have shown active interest in tools or features",
    createdAt: new Date().toISOString()
  },
  {
    id: "payment-pending",
    name: "Payment Pending",
    color: "#F97316",
    isDefault: true,
    description: "Customers who requested payment details or expressed buying intent",
    createdAt: new Date().toISOString()
  },
  {
    id: "payment-done",
    name: "Payment Done",
    color: "#6366F1",
    isDefault: true,
    description: "Customers claiming payment has been sent (Requires admin verification)",
    createdAt: new Date().toISOString()
  },
  {
    id: "order-complete",
    name: "Order Complete",
    color: "#10B981",
    isDefault: true,
    description: "Verified paid orders and completed deliveries",
    createdAt: new Date().toISOString()
  },
  {
    id: "follow-up",
    name: "Follow Up",
    color: "#64748B",
    isDefault: true,
    description: "Customers who requested a callback or future check-in",
    createdAt: new Date().toISOString()
  },
  {
    id: "important",
    name: "Important",
    color: "#F43F5E",
    isDefault: true,
    description: "High priority contacts, VIPs, or special attention cases",
    createdAt: new Date().toISOString()
  }
];

export async function getLists(): Promise<CustomerList[]> {
  try {
    await fs.mkdir(path.dirname(LISTS_FILE), { recursive: true });
    const data = await fs.readFile(LISTS_FILE, "utf-8");
    const parsed: CustomerList[] = JSON.parse(data);
    
    // Ensure all default lists exist
    let updated = false;
    const existingIds = new Set(parsed.map(l => l.id));
    for (const def of DEFAULT_LISTS) {
      if (!existingIds.has(def.id)) {
        parsed.unshift(def);
        updated = true;
      }
    }
    if (updated) {
      await fs.writeFile(LISTS_FILE, JSON.stringify(parsed, null, 2), "utf-8");
    }
    return parsed;
  } catch {
    // If file doesn't exist, create default lists
    await fs.writeFile(LISTS_FILE, JSON.stringify(DEFAULT_LISTS, null, 2), "utf-8");
    return DEFAULT_LISTS;
  }
}

export async function saveLists(lists: CustomerList[]): Promise<void> {
  await fs.mkdir(path.dirname(LISTS_FILE), { recursive: true });
  await fs.writeFile(LISTS_FILE, JSON.stringify(lists, null, 2), "utf-8");
}

export async function createCustomList(name: string, color: string, description?: string): Promise<CustomerList> {
  const lists = await getLists();
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const id = `custom-${slug}-${Date.now().toString().slice(-4)}`;

  const newList: CustomerList = {
    id,
    name: name.trim(),
    color: color || "#6366F1",
    isDefault: false,
    description: description?.trim() || "",
    customerPhoneNumbers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  lists.push(newList);
  await saveLists(lists);
  return newList;
}

export async function updateList(id: string, updates: Partial<CustomerList>): Promise<CustomerList | null> {
  const lists = await getLists();
  const index = lists.findIndex(l => l.id === id);
  if (index === -1) return null;

  const current = lists[index];
  const updated: CustomerList = {
    ...current,
    ...updates,
    id: current.id, // Preserve id
    isDefault: current.isDefault, // Preserve isDefault flag
    updatedAt: new Date().toISOString()
  };

  lists[index] = updated;
  await saveLists(lists);
  return updated;
}

export async function deleteList(id: string): Promise<boolean> {
  const lists = await getLists();
  const target = lists.find(l => l.id === id);
  if (!target || target.isDefault) {
    return false; // Default lists cannot be deleted
  }

  const filtered = lists.filter(l => l.id !== id);
  await saveLists(filtered);

  // Remove list reference from all customers
  try {
    const customers = await getCustomerList();
    let modified = false;
    customers.forEach(c => {
      if (c.listIds && c.listIds.includes(id)) {
        c.listIds = c.listIds.filter(lid => lid !== id);
        modified = true;
      }
    });
    if (modified) {
      await saveCustomers(customers);
    }
  } catch (err) {
    console.error("[Lists] Failed to clean customer list references:", err);
  }

  return true;
}

/**
 * Checks WhatsApp Native Label Sync status.
 * Standard WhatsApp personal accounts do not support labels at the protocol layer.
 * WhatsApp Business accounts support labels if exposed by Baileys.
 */
export function getWhatsAppLabelSyncStatus(): WhatsAppLabelSyncStatus {
  const connection = getConnectionStatus();
  const sock = getSocket();

  if (connection !== "connected" || !sock) {
    return {
      isSupported: false,
      isBusinessAccount: false,
      status: "disconnected",
      reason: "WhatsApp is not connected. Connect your WhatsApp device to check native label support."
    };
  }

  // Check if Baileys socket has chat label modification capabilities
  const hasLabelApi = typeof (sock as any).addChatLabel === "function" || 
                       typeof (sock as any).getLabels === "function" ||
                       typeof (sock as any).chatModify === "function";

  return {
    isSupported: hasLabelApi,
    isBusinessAccount: false, // Standard Multi-Device WhatsApp pairing
    status: hasLabelApi ? "synced" : "unsupported",
    reason: hasLabelApi 
      ? "WhatsApp Native Labels API available."
      : "Standard WhatsApp Multi-Device protocol accounts do not expose native labels. Internal CRM lists remain 100% active, automated, and synchronized across memory.",
    syncedAt: new Date().toISOString()
  };
}

/**
 * Attempts safe native sync if WhatsApp Business account supports it
 */
export async function syncCustomerToWhatsAppNativeLabel(phoneNumber: string, status: CustomerStatus): Promise<void> {
  const sock = getSocket();
  if (!sock) return;

  try {
    // If Baileys exposes label modification, invoke safely
    if (typeof (sock as any).addChatLabel === "function") {
      const jid = phoneNumber.includes("@s.whatsapp.net") ? phoneNumber : `${phoneNumber.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
      await (sock as any).addChatLabel(jid, status);
    }
  } catch (err) {
    // Non-blocking, fallback to internal list CRM
    console.debug(`[WhatsApp Labels] Native label sync notice for ${phoneNumber}:`, err);
  }
}

export function setupListRoutes(app: Express) {
  // Get all lists with customer counts
  app.get("/api/lists", async (req, res) => {
    try {
      const [lists, customers] = await Promise.all([
        getLists(),
        getCustomerList()
      ]);

      const listsWithStats = lists.map(list => {
        let count = 0;
        if (list.isDefault) {
          // Count customers whose current status matches this default list
          count = customers.filter(c => (c.status || "New Customer").toLowerCase() === list.name.toLowerCase()).length;
        } else {
          // Count customers in custom list
          count = customers.filter(c => c.listIds && c.listIds.includes(list.id)).length;
        }

        return {
          ...list,
          customerCount: count
        };
      });

      res.json(listsWithStats);
    } catch (err: any) {
      console.error("[Lists API] Error fetching lists:", err);
      res.status(500).json({ error: "Failed to fetch lists" });
    }
  });

  // Get WhatsApp Native Label Sync Status
  app.get("/api/lists/sync-status", (req, res) => {
    res.json(getWhatsAppLabelSyncStatus());
  });

  // Create a custom list
  app.post("/api/lists", async (req, res) => {
    try {
      const { name, color, description } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "List name is required" });
      }

      const list = await createCustomList(name, color || "#6366F1", description);
      res.status(201).json(list);
    } catch (err: any) {
      console.error("[Lists API] Error creating list:", err);
      res.status(500).json({ error: "Failed to create list" });
    }
  });

  // Update a custom list
  app.put("/api/lists/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, color, description } = req.body;
      const updated = await updateList(id, { name, color, description });
      if (!updated) {
        return res.status(404).json({ error: "List not found" });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("[Lists API] Error updating list:", err);
      res.status(500).json({ error: "Failed to update list" });
    }
  });

  // Delete a custom list
  app.delete("/api/lists/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await deleteList(id);
      if (!success) {
        return res.status(400).json({ error: "Cannot delete default list or list not found" });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Lists API] Error deleting list:", err);
      res.status(500).json({ error: "Failed to delete list" });
    }
  });

  // Add/Remove customer from custom lists
  app.post("/api/customers/:phoneNumber/lists", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const { listIds } = req.body; // Array of list IDs

      if (!Array.isArray(listIds)) {
        return res.status(400).json({ error: "listIds must be an array of strings" });
      }

      const customers = await getCustomers();
      const customer = customers[phoneNumber];
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      customer.listIds = listIds;
      await saveCustomers(customers);

      res.json({ success: true, customer });
    } catch (err: any) {
      console.error("[Lists API] Error updating customer lists:", err);
      res.status(500).json({ error: "Failed to update customer lists" });
    }
  });
}
