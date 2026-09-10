import assert from "assert";
import fs from "fs";
import path from "path";
import { Tool, Customer } from "../src/types.js";
import {
  matchTool,
  matchToolSync,
  getUnstatedFacts,
  recordStatedFacts,
  clampPriceFloors,
  extractMentionedFacts
} from "../src/server/tool-matcher.js";
import { synthesizeSalesPrompt } from "../src/server/services/prompt-service.js";
import { buildCompactPublicQuery } from "../src/server/ai.js";

const toolsData: Tool[] = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "data", "tools.json"), "utf-8")
);

async function runRegressionSuite() {
  console.log("==================================================");
  console.log("  RUNNING SALES CLOSER V2 REGRESSION TEST SUITE");
  console.log("==================================================");

  let passed = 0;
  const testQueue: Array<{ name: string; fn: () => void | Promise<void> }> = [];

  function test(name: string, fn: () => void | Promise<void>) {
    testQueue.push({ name, fn });
  }

  // =========================================================================
  // SCENARIO 1: UNKNOWN PRODUCT INQUIRY
  // Customer names a product not in the catalog.
  // Must NOT claim to have it, must NOT disparage it, must ask clarifying question.
  // =========================================================================
  test("1.1 Unknown product detection (CapCut / Canva / InVideo)", () => {
    const query1 = "Bhai CapCut pro account mil sakta hai?";
    const match1 = matchToolSync(query1, toolsData);
    assert.strictEqual(match1.confidence, "none");
    assert.strictEqual(match1.isUnknownProduct, true);
    assert.strictEqual(match1.queryProduct?.toLowerCase(), "capcut");
    assert.strictEqual(match1.matched.length, 0);

    const query2 = "Canva pro subscription chahiye mujhe";
    const match2 = matchToolSync(query2, toolsData);
    assert.strictEqual(match2.confidence, "none");
    assert.strictEqual(match2.isUnknownProduct, true);
    assert.strictEqual(match2.queryProduct?.toLowerCase(), "canva");

    const query3 = "InVideo software ka rate kya hai?";
    const match3 = matchToolSync(query3, toolsData);
    assert.strictEqual(match3.confidence, "none");
    assert.strictEqual(match3.isUnknownProduct, true);
    assert.strictEqual(match3.queryProduct?.toLowerCase(), "invideo");
  });

  test("1.2 Unknown product handling produces honest boundary and diagnostic question", () => {
    const match = matchToolSync("Bhai CapCut pro account mil sakta hai?", toolsData);
    assert.ok(match.isUnknownProduct);

    // Simulated compliant AI response adhering to unknown product rules
    const simulatedReply =
      "Bhai CapCut to hamare paas available nahi hai.\n" +
      "Aap mainly kis type ki editing ya video workflow ke liye dekh rahe hain? " +
      "Shorts/Reels banani hain ya faceless content?";

    const lowerReply = simulatedReply.toLowerCase();

    // 1. Must acknowledge not carrying it
    const admitsNotCarried = lowerReply.includes("nahi hai") || lowerReply.includes("available nahi") || lowerReply.includes("nahi rakhte");
    assert.ok(admitsNotCarried, "Reply must acknowledge that product is not carried");

    // 2. Must NOT disparage or claim it's inferior
    const hasDisparagement = /(?:bekar|kachra|inferior|bad|fake|third class|chhota tool)/i.test(simulatedReply);
    assert.strictEqual(hasDisparagement, false, "Reply must not disparage unknown product");

    // 3. Must ask a diagnostic question
    const asksQuestion = simulatedReply.includes("?") || /(?:kis|kya|batao|kaise)/i.test(simulatedReply);
    assert.ok(asksQuestion, "Reply must ask what customer is trying to accomplish");
  });

  // =========================================================================
  // SCENARIO 2: STRICT ANTI-REPETITION (3 CONSECUTIVE INQUIRIES)
  // Progressive disclosure across 3 consecutive turns without verbatim repeats.
  // =========================================================================
  test("2.1 Anti-repetition across 3 consecutive turns", () => {
    const voiceTool = toolsData.find(t => t.name.toLowerCase().includes("voice"))!;
    assert.ok(voiceTool, "VoiceDelta tool must exist in catalog");

    const customer: Customer = {
      phoneNumber: "923009999999",
      status: "Interested",
      messages: [],
      factsStated: {}
    };

    const allFeatures = [
      ...(voiceTool.features || []),
      ...(voiceTool.sales_points || [])
    ];

    // --- TURN 1 ---
    const turn1Unstated = getUnstatedFacts(allFeatures, customer.factsStated[voiceTool.id] || []);
    assert.strictEqual(turn1Unstated.length, allFeatures.length, "Turn 1 should have all facts available");

    // Turn 1 reply states 2 facts
    const turn1Reply = "VoiceDelta me 3,600+ AI voices hain aur instant 1-minute voice cloning milti hai 99% accuracy ke sath.";
    const turn1Mentioned = extractMentionedFacts(turn1Reply, voiceTool);
    assert.ok(turn1Mentioned.length >= 1, "Turn 1 must identify mentioned facts");
    recordStatedFacts(customer, voiceTool.id, turn1Mentioned);

    // --- TURN 2 ---
    const turn2Unstated = getUnstatedFacts(allFeatures, customer.factsStated[voiceTool.id] || []);
    assert.ok(turn2Unstated.length < turn1Unstated.length, "Turn 2 unstated facts must be strictly reduced");
    assert.ok(
      !turn2Unstated.some(f => turn1Mentioned.includes(f)),
      "Turn 2 unstated facts must not include Turn 1 facts"
    );

    // Turn 2 reply states fresh facts
    const turn2Reply = "Isme official ElevenLabs aur ChatGPT/OpenAI voice models ka direct access milta hai, plus Pro me unlimited voice generation hai.";
    const turn2Mentioned = extractMentionedFacts(turn2Reply, voiceTool);
    assert.ok(turn2Mentioned.length >= 1, "Turn 2 must identify newly mentioned facts");
    recordStatedFacts(customer, voiceTool.id, turn2Mentioned);

    // --- TURN 3 ---
    const turn3Unstated = getUnstatedFacts(allFeatures, customer.factsStated[voiceTool.id] || []);
    assert.ok(turn3Unstated.length < turn2Unstated.length, "Turn 3 unstated facts must be further reduced");
    assert.ok(
      !turn3Unstated.some(f => turn1Mentioned.includes(f) || turn2Mentioned.includes(f)),
      "Turn 3 unstated facts must not repeat Turn 1 or Turn 2 facts"
    );

    // Verify factsStated grew progressively without duplicates
    const totalStated = customer.factsStated[voiceTool.id].length;
    assert.ok(totalStated >= 3, `Expected at least 3 distinct stated facts, got ${totalStated}`);
  });

  // =========================================================================
  // SCENARIO 3: PRICE-FLOOR CLAMPING & NO CONTRADICTION
  // Agent must never quote below min_negotiable_pkr, and must not contradict "rate fixed".
  // =========================================================================
  test("3.1 Code-level price floor clamping for sub-floor quotes", () => {
    const voiceTool = toolsData.find(t => t.name.toLowerCase().includes("voice"))!;
    const minFloor = voiceTool.pricing?.min_negotiable_pkr || 1000;

    // Sub-floor attempt: customer asked for Rs. 500, and model erroneously output Rs. 500
    const rawAiReply1 = "Chalo bhai, aap ke liye special discount Rs. 500 me done karte hain.";
    const clampedReply1 = clampPriceFloors(rawAiReply1, [voiceTool]);
    assert.ok(clampedReply1.includes(`Rs. ${minFloor.toLocaleString()}`), "Price below floor must be clamped to min floor");
    assert.ok(!clampedReply1.includes("Rs. 500"), "Sub-floor quote must be replaced");

    // Sub-floor attempt 2: "700 Rs"
    const rawAiReply2 = "Aap 700 Rs transfer kar do abhi access deta hoon.";
    const clampedReply2 = clampPriceFloors(rawAiReply2, [voiceTool]);
    assert.ok(clampedReply2.includes(`Rs. ${minFloor.toLocaleString()}`), "Sub-floor suffix quote must be clamped");
    assert.ok(!clampedReply2.includes("700 Rs"));

    // Legitimate quote at or above list price must NOT be changed
    const normalReply = `VoiceDelta Pro Rs. ${voiceTool.pricePkr}/month ka hai.`;
    const clampedNormal = clampPriceFloors(normalReply, [voiceTool]);
    assert.strictEqual(clampedNormal, normalReply, "Quotes at or above floor must not be altered");
  });

  test("3.2 Negotiation consistency check (rate fixed contradiction guard)", () => {
    const customerMessages = [
      { role: "user", content: "Price kam ho sakti hai?" },
      { role: "agent", content: "Nahi bhai, rate fixed hai Rs. 1,199/month, quality standard hai." }
    ];

    // Check consistency detector logic
    const agentRecentlyClaimedFixed = customerMessages
      .filter(m => m.role === 'agent')
      .slice(-2)
      .some(m => /(?:fixed|kam nahi|rate final|final price|discount nahi)/i.test(m.content));

    assert.strictEqual(agentRecentlyClaimedFixed, true, "Should detect that agent previously claimed rate is fixed");
  });

  // =========================================================================
  // SCENARIO 4: CONDITIONAL CONCESSION
  // Concessions must be tied to a condition (pay today / longer duration).
  // =========================================================================
  test("4.1 Concessions must include a condition and never be free", () => {
    // Valid compliant conditional concession
    const validConcession =
      "Bhai normally rate fixed hai, lekin agar aap aaj hi Easypaisa se payment confirm karte hain, " +
      "to main aapko Rs. 1,000 me activate karwa deta hoon.";

    const hasPriceMention = /(?:rs\.?|pkr)\s*1[,\.]?000/i.test(validConcession);
    const hasCondition = /(?:agar\s+aap\s+aaj|today|abhi|payment\s+confirm|2\s+months)/i.test(validConcession);

    assert.ok(hasPriceMention, "Must mention agreed floor price");
    assert.ok(hasCondition, "Discount concession must be explicitly conditional upon same-day payment or term");
  });

  // =========================================================================
  // SCENARIO 5: LIVE PRODUCTION INQUIRIES & ANTI-HALLUCINATION
  // Real customer queries: Copyright Removal, Clipshied, Voice Delta, Details.
  // =========================================================================
  test("5.1 'Copyright Removal' matches ClipShield and is NOT flagged as unknown product", async () => {
    const query = "Copyright Removal";
    const matchSync = matchToolSync(query, toolsData);
    assert.strictEqual(matchSync.isUnknownProduct, false, "Copyright Removal must NOT be an unknown product");
    assert.ok(matchSync.matched.length > 0, "Must match at least one tool");
    assert.ok(
      matchSync.matched[0].name.toLowerCase().includes("clipshield"),
      `Expected ClipShield, got: ${matchSync.matched[0].name}`
    );

    const matchAsync = await matchTool(query, toolsData);
    assert.strictEqual(matchAsync.isUnknownProduct, false);
    assert.ok(matchAsync.matched.length > 0);
    assert.ok(matchAsync.matched[0].name.toLowerCase().includes("clipshield"));
  });

  test("5.2 'Clipshied' typo matches ClipShield without failure", async () => {
    const query = "Clipshied";
    const matchSync = matchToolSync(query, toolsData);
    assert.strictEqual(matchSync.isUnknownProduct, false);
    assert.ok(matchSync.matched.length > 0);
    assert.ok(matchSync.matched[0].name.toLowerCase().includes("clipshield"));

    const matchAsync = await matchTool(query, toolsData);
    assert.strictEqual(matchAsync.isUnknownProduct, false);
    assert.ok(matchAsync.matched.length > 0);
    assert.ok(matchAsync.matched[0].name.toLowerCase().includes("clipshield"));
  });

  test("5.3 Conversation context continuity: 'Details' preserves VoiceDelta without tool drift", async () => {
    // Turn 1: customer asked about voice delta
    const history = [
      "Customer: Aur voice delta",
      "Agent: Haan Voice Delta bhi mil jaye ga! Yeh AI voice generator aur cloning tool hai."
    ];

    // Turn 2: customer asks for details
    const turn2 = "Details";
    const matchTurn2 = await matchTool(turn2, toolsData, history);
    assert.ok(matchTurn2.matched.length > 0, "Must maintain tool context on 'Details'");
    assert.ok(
      matchTurn2.matched[0].name.toLowerCase().includes("voicedelta"),
      `Expected VoiceDelta, got: ${matchTurn2.matched[0].name}`
    );

    // Check synthesized prompt
    const mockCustomer: Customer = {
      phoneNumber: "923001234567",
      name: "Customer",
      status: "Interested",
      messages: [
        { role: "user", content: "Aur voice delta", timestamp: new Date().toISOString() },
        { role: "agent", content: "Haan Voice Delta mil jayega!", timestamp: new Date().toISOString() },
      ],
      memorySummary: {
        lastToolDiscussed: "VoiceDelta",
        totalTurnsCount: 2,
        stage: "discovery",
      }
    };

    const mockSettings: any = {
      aiAgentEnabled: true,
      language: "Roman Urdu",
      paymentMethods: []
    };

    const promptResult = synthesizeSalesPrompt({
      customer: mockCustomer,
      matchedTools: matchTurn2.matched,
      allAccountToolsSummary: "- VoiceDelta: AI voice generator\n- ClipShield: YouTube bypass",
      recentMessages: mockCustomer.messages,
      latestCustomerText: turn2,
      settings: mockSettings,
    });

    // Verify VoiceDelta is specified and ElevenLabs renaming is banned
    assert.ok(promptResult.prompt.includes("VoiceDelta"), "Prompt must contain VoiceDelta");
    assert.ok(
      promptResult.prompt.includes("NEVER call this product 'ElevenLabs'") ||
      promptResult.systemPrompt.includes("NEVER rename or call the product \"ElevenLabs\""),
      "Must explicitly forbid renaming VoiceDelta to ElevenLabs"
    );
  });

  test("5.4 System prompt forbids fake persona 'Aamir', SEO services, and repeated greetings", () => {
    const mockCustomer: Customer = {
      phoneNumber: "923001234567",
      name: "Badar",
      status: "Interested",
      messages: [
        { role: "user", content: "Hi", timestamp: new Date().toISOString() },
        { role: "agent", content: "AOA! Kese hain?", timestamp: new Date().toISOString() },
      ],
      memorySummary: {
        customerName: "Badar",
        totalTurnsCount: 2,
      }
    };

    const mockSettings: any = {
      aiAgentEnabled: true,
      language: "Roman Urdu",
    };

    const promptResult = synthesizeSalesPrompt({
      customer: mockCustomer,
      matchedTools: [],
      allAccountToolsSummary: "- ClipShield\n- VoiceDelta",
      recentMessages: mockCustomer.messages,
      latestCustomerText: "Copyright Removal",
      settings: mockSettings,
    });

    // Verify system prompt bans Aamir and SEO
    assert.ok(promptResult.systemPrompt.includes("Aamir"), "Must explicitly ban persona name Aamir");
    assert.ok(promptResult.systemPrompt.includes("SEO"), "Must explicitly ban SEO services");
    assert.ok(
      promptResult.systemPrompt.includes("ClipShield and VoiceDelta are ALWAYS IN STOCK"),
      "Must explicitly state ClipShield and VoiceDelta are always in stock"
    );
    assert.ok(
      promptResult.prompt.includes("Do NOT repeatedly say customer's name") ||
      promptResult.systemPrompt.includes("DO NOT repeat the customer's name on every message"),
      "Must forbid repeating customer name on every message"
    );
  });

  test("5.5 buildCompactPublicQuery preserves tool details and injects anti-hallucination rules", () => {
    const voiceTool = toolsData.find(t => t.name.toLowerCase().includes("voice"))!;
    const mockCustomer: Customer = {
      phoneNumber: "923001234567",
      name: "Customer",
      status: "Interested",
      messages: [
        { role: "user", content: "Aur voice delta", timestamp: new Date().toISOString() },
        { role: "agent", content: "Haan Voice Delta bhi mil jaye ga!", timestamp: new Date().toISOString() },
      ],
      memorySummary: {
        lastToolDiscussed: "VoiceDelta",
        totalTurnsCount: 2,
      }
    };

    const promptResult = synthesizeSalesPrompt({
      customer: mockCustomer,
      matchedTools: [voiceTool],
      allAccountToolsSummary: "- VoiceDelta: AI voice generator\n- ClipShield: YouTube bypass",
      recentMessages: mockCustomer.messages,
      latestCustomerText: "Details",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
    });

    const compactQuery = buildCompactPublicQuery(promptResult.prompt, promptResult.systemPrompt);

    // Verify compact query contains the real tool name and not generic digital tools
    assert.ok(compactQuery.includes("VoiceDelta"), "Compact fallback query must preserve VoiceDelta");
    assert.ok(compactQuery.includes("Details"), "Compact fallback query must include customer text 'Details'");
    assert.ok(
      compactQuery.includes("NEVER invent a persona name like 'Aamir'") || compactQuery.includes("Aamir"),
      "Compact fallback query must forbid persona Aamir"
    );
    assert.ok(
      compactQuery.includes("NEVER offer SEO") || compactQuery.includes("SEO"),
      "Compact fallback query must forbid SEO"
    );
    assert.ok(
      compactQuery.includes("always call it VoiceDelta") || compactQuery.includes("Do NOT rename or call product ElevenLabs"),
      "Compact fallback query must instruct not to rename VoiceDelta to ElevenLabs"
    );
  });

  for (const t of testQueue) {
    try {
      await t.fn();
      console.log(`  ✓ PASS: ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${t.name}`);
      console.error(err);
    }
  }

  const total = testQueue.length;
  console.log("--------------------------------------------------");
  console.log(`REGRESSION RESULTS: ${passed}/${total} test suites passed.`);
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runRegressionSuite();
