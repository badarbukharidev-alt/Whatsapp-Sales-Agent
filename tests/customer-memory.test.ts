import assert from "assert";
import path from "path";
import { CustomerService } from "../src/server/services/customer-service.js";
import { ToolService } from "../src/server/services/tool-service.js";
import { synthesizeSalesPrompt } from "../src/server/services/prompt-service.js";
import { JsonStore } from "../src/server/storage/json-store.js";
import { Customer, Tool, AgentSettings } from "../src/types.js";

async function runCustomerMemoryTests() {
  console.log("==================================================");
  console.log("  RUNNING CUSTOMER MEMORY & DYNAMIC TOOL ARCHITECTURE TESTS");
  console.log("==================================================");

  let passed = 0;
  const testQueue: Array<{ name: string; fn: () => void | Promise<void> }> = [];

  function test(name: string, fn: () => void | Promise<void>) {
    testQueue.push({ name, fn });
  }

  // Set up temporary isolated test stores
  const testCustomersPath = path.join(process.cwd(), "scratch", "test_customers.json");
  const testToolsPath = path.join(process.cwd(), "scratch", "test_tools.json");
  const customerTestStore = new JsonStore<Record<string, Customer>>(testCustomersPath, {});
  const toolTestStore = new JsonStore<Tool[]>(testToolsPath, []);

  const testCustomerService = new CustomerService(customerTestStore);
  const testToolService = new ToolService(toolTestStore);

  // Clear test customer store for isolated test run
  await customerTestStore.set({});

  // Seed test tools for multiple users
  await toolTestStore.set([
    {
      id: "tool_user1_voicedelta",
      name: "VoiceDelta",
      userId: "user_tenant_1",
      description: "AI voice generator with 3600+ voices and cloning.",
      pricePkr: "1199",
      aliases: ["voicedelta", "voice delta"],
      keywords: ["voice", "cloning", "tts"],
      pricing: { min_negotiable_pkr: 1000 },
      features: ["Voice cloning in 1 min", "3600+ voices"],
      status: "active",
    },
    {
      id: "tool_user1_clipshield",
      name: "ClipShield",
      userId: "user_tenant_1",
      description: "YouTube copyright bypass and video reframer.",
      pricePkr: "1500",
      aliases: ["clipshield", "clip shield", "clipshied"],
      keywords: ["copyright", "bypass", "video"],
      pricing: { min_negotiable_pkr: 1200 },
      features: ["9-layer anti-content ID", "AI hook finder"],
      status: "active",
    },
    {
      id: "tool_user2_customsaas",
      name: "AutoReel Pro",
      userId: "user_tenant_2",
      description: "Automated Instagram Reels maker for eCommerce.",
      pricePkr: "2500",
      aliases: ["autoreel", "autoreel pro"],
      keywords: ["reels", "instagram", "ecommerce"],
      pricing: { min_negotiable_pkr: 2000 },
      features: ["Auto captions", "Product video render"],
      status: "active",
    },
  ]);

  // TEST 1: Customer lookup & permanent record keyed by JID
  test("1. Customer permanent record keyed by JID with default status", async () => {
    const jid = "923001112233:12@s.whatsapp.net";
    const customer = await testCustomerService.getCustomerByJid(jid, "user_tenant_1", "Usman");

    assert.strictEqual(customer.phoneNumber, "923001112233@s.whatsapp.net");
    assert.strictEqual(customer.name, "Usman");
    assert.strictEqual(customer.status, "New Customer");
    assert.ok(customer.memorySummary);
    assert.strictEqual(customer.memorySummary.stage, "greeting");
  });

  // TEST 2: Message persistence & immediate saving
  test("2. Immediate message saving and conversation history tracking", async () => {
    const jid = "923001112233@s.whatsapp.net";
    await testCustomerService.saveMessage(jid, "user", "Aoa bhai ClipShield tool ka kya rate hai?", "user_tenant_1");
    await testCustomerService.saveMessage(jid, "agent", "Walaikum Assalam bhai! ClipShield ka standard monthly rate Rs. 1500 hai.", "user_tenant_1");

    const history = await testCustomerService.getConversationHistory(jid, "user_tenant_1");
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].role, "user");
    assert.strictEqual(history[1].role, "agent");

    const customer = await testCustomerService.getCustomerByJid(jid, "user_tenant_1");
    assert.ok(customer.lastActivity);
  });

  // TEST 3: Memory summarization & profile extraction
  test("3. Automatic memory summarization captures tools, quoted rates and stage", async () => {
    const jid = "923001112233@s.whatsapp.net";
    await testCustomerService.saveMessage(jid, "user", "Bhai thoda discount mil sakta hai 1200 mein kar do?", "user_tenant_1");
    await testCustomerService.saveMessage(jid, "agent", "Chalo theek hai bhai, agar aap aaj JazzCash se payment confirm karte hain to Rs. 1200 mein deal done.", "user_tenant_1");

    const summary = await testCustomerService.getCustomerSummary(jid, "user_tenant_1");
    assert.ok(summary.interestedTools?.includes("ClipShield"));
    assert.strictEqual(summary.quotedPrices?.["ClipShield"], "Rs. 1200");
    assert.ok(summary.summaryText?.length > 10);
    assert.ok(summary.stage === "payment_pending" || summary.stage === "negotiation");
  });

  // TEST 4: Prompt synthesis removes prompt bloat and suppresses repeated greetings
  test("4. Prompt synthesis generates lean prompt and suppresses greeting for returning customer", async () => {
    const jid = "923001112233@s.whatsapp.net";
    const customer = await testCustomerService.getCustomerByJid(jid, "user_tenant_1");
    const history = await testCustomerService.getConversationHistory(jid, "user_tenant_1", 6);
    const catalogSummary = await testToolService.getAccountToolSummary("user_tenant_1");
    const matchedTool = (await testToolService.getAccountTools("user_tenant_1"))[1]; // ClipShield

    const settings: AgentSettings = {
      aiAgentEnabled: true,
      salesSkillEnabled: true,
      language: "Roman Urdu",
    };

    const { prompt, systemPrompt } = synthesizeSalesPrompt({
      customer,
      matchedTools: [matchedTool],
      allAccountToolsSummary: catalogSummary,
      recentMessages: history,
      latestCustomerText: "Theek hai JazzCash account number send karein",
      settings,
    });

    // Check lean size: prompt should be compact (< 2000 chars vs old 8000+ chars)
    assert.ok(prompt.length < 2500, `Prompt length should be compact, was ${prompt.length}`);

    // Check returning customer directive is present
    assert.ok(prompt.includes("Returning Customer (CONVERSATION IS ONGOING)"));
    assert.ok(prompt.includes("Do NOT greet with \"AOA\""));

    // Check quoted rate is preserved in context
    assert.ok(prompt.includes("ClipShield: Rs. 1200"));
  });

  // TEST 5: Dynamic user-owned tools & multi-tenant isolation
  test("5. Multi-tenant tool isolation (Account 1 cannot see Account 2 tools)", async () => {
    const tenant1Tools = await testToolService.getAccountTools("user_tenant_1");
    const tenant2Tools = await testToolService.getAccountTools("user_tenant_2");

    assert.strictEqual(tenant1Tools.length, 2);
    assert.strictEqual(tenant1Tools[0].name, "VoiceDelta");
    assert.strictEqual(tenant1Tools[1].name, "ClipShield");

    assert.strictEqual(tenant2Tools.length, 1);
    assert.strictEqual(tenant2Tools[0].name, "AutoReel Pro");

    // Dynamic catalog overview has zero hardcoding
    const summaryTenant1 = await testToolService.getAccountToolSummary("user_tenant_1");
    assert.ok(summaryTenant1.includes("VoiceDelta"));
    assert.ok(summaryTenant1.includes("ClipShield"));
    assert.ok(!summaryTenant1.includes("AutoReel Pro"));

    const summaryTenant2 = await testToolService.getAccountToolSummary("user_tenant_2");
    assert.ok(summaryTenant2.includes("AutoReel Pro"));
    assert.ok(!summaryTenant2.includes("VoiceDelta"));
  });

  // TEST 6: Unknown product handling for account
  test("6. Unknown product inquiry correctly flagged without hallucination", async () => {
    const resultTenant2 = await testToolService.searchRelevantTools("Bhai ClipShield mil sakta hai?", "user_tenant_2");
    // Tenant 2 does not carry ClipShield!
    assert.strictEqual(resultTenant2.isUnknownProduct, true);
    assert.strictEqual(resultTenant2.matched.length, 0);

    const resultTenant1 = await testToolService.searchRelevantTools("Bhai Canva pro mil sakta hai?", "user_tenant_1");
    assert.strictEqual(resultTenant1.isUnknownProduct, true);
    assert.strictEqual(resultTenant1.queryProduct?.toLowerCase(), "canva");
  });

  // TEST 7: Multi-tenant customer scoping
  test("7. Multi-tenant customer scoping isolates records per user/tenant", async () => {
    await testCustomerService.getCustomerByJid("923009999999@s.whatsapp.net", "user_tenant_2", "Farhan");

    const tenant1Customers = await testCustomerService.getCustomerList("user_tenant_1");
    const tenant2Customers = await testCustomerService.getCustomerList("user_tenant_2");

    assert.ok(tenant1Customers.some(c => c.phoneNumber.includes("923001112233")));
    assert.ok(!tenant1Customers.some(c => c.phoneNumber.includes("923009999999")));

    assert.ok(tenant2Customers.some(c => c.phoneNumber.includes("923009999999")));
    assert.ok(!tenant2Customers.some(c => c.phoneNumber.includes("923001112233")));
  });

  // TEST 8: Dynamic sections and links are preserved and synthesized into prompt
  test("8. Dynamic sections and direct links are preserved and synthesized into prompt", async () => {
    const toolWithSections: Tool = {
      id: "tool_test_sections",
      name: "ClipShield Pro",
      userId: "user_tenant_1",
      description: "Desktop YouTube Content ID bypass.",
      pricePkr: "1500",
      status: "active",
      links: [
        {
          title: "Download Doc",
          url: "https://docs.google.com/test",
          note: "Free trial doc"
        }
      ],
      sections: [
        {
          title: "9-Layer Protection Details",
          content: "Layer 1 audio shift, Layer 2 color grade, Layer 3 smart crop..."
        },
        {
          title: "Pricing & Licenses",
          content: "Monthly: Rs. 1500, Lifetime: Rs. 3500."
        }
      ]
    };

    await testToolService.saveTool(toolWithSections, "user_tenant_1");
    const retrieved = await testToolService.getToolDetails("tool_test_sections", "user_tenant_1");
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.sections?.length, 2);
    assert.strictEqual(retrieved?.links?.length, 1);

    const customer = await testCustomerService.getCustomerByJid("923001112233@s.whatsapp.net", "user_tenant_1");
    const synth = synthesizeSalesPrompt({
      customer,
      matchedTools: [retrieved!],
      allAccountToolsSummary: "ClipShield Pro: available",
      recentMessages: [],
      latestCustomerText: "Details bhejo",
      settings: { aiAgentEnabled: true } as any
    });

    assert.ok(synth.prompt.includes("[SECTION: 9-Layer Protection Details]"));
    assert.ok(synth.prompt.includes("Layer 1 audio shift"));
    assert.ok(synth.prompt.includes("Download Doc: https://docs.google.com/test"));
  });

  // TEST 9: Persona rules prohibit robotic phrases and mandate authentic human experience
  test("9. System prompt enforces authentic human seller persona and bans robotic bot phrases", () => {
    const customer: Customer = {
      phoneNumber: "923005555555@s.whatsapp.net",
      status: "New Customer",
      messages: []
    };

    const synth = synthesizeSalesPrompt({
      customer,
      matchedTools: [],
      allAccountToolsSummary: "VoiceDelta, ClipShield",
      recentMessages: [],
      latestCustomerText: "Hi",
      settings: { aiAgentEnabled: true } as any
    });

    assert.ok(synth.systemPrompt.includes("100% REAL HUMAN WhatsApp seller experience"));
    assert.ok(synth.systemPrompt.includes("BANNED BOT PHRASES"));
    assert.ok(synth.systemPrompt.includes("Main aap ki kya madad kar sakta hoon"));
    assert.ok(synth.systemPrompt.includes("VALUE SELLING & REAL PERSUASION"));
    assert.ok(synth.systemPrompt.includes("SHARE LINKS FREELY"));
  });

  // Run all tests
  for (const t of testQueue) {
    try {
      await t.fn();
      console.log(`  ✓ PASS: ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${t.name}`);
      console.error(err);
      process.exit(1);
    }
  }

  console.log("--------------------------------------------------");
  console.log(`RESULTS: ${passed}/${testQueue.length} tests passed.`);
  console.log("==================================================");
}

runCustomerMemoryTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
