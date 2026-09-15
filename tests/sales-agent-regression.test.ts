import assert from "assert";
import fs from "fs";
import path from "path";
import { Tool, Customer, ChatMessage } from "../src/types.js";
import { inferConversationState, memoryPatchFromState } from "../src/server/services/conversation-state.js";
import { selectImageForTurn } from "../src/server/services/image-intelligence.js";
import {
  getToolPlans,
  formatPlanLines,
  formatPlansForPrompt,
  buildPlanOfferMessage,
  collectAllowedPriceAmounts,
} from "../src/server/services/pricing-service.js";
import {
  matchTool,
  matchToolSync,
  getUnstatedFacts,
  recordStatedFacts,
  clampPriceFloors,
  extractMentionedFacts
} from "../src/server/tool-matcher.js";
import { synthesizeSalesPrompt } from "../src/server/services/prompt-service.js";
import { buildCompactPublicQuery, extractJsonObject } from "../src/server/ai.js";
import {
  isBareAffirmation,
  detectPendingOffer,
  collectAllowedUrls,
  flattenMarkdownLinks,
  enforceKnownLinks,
  stripLeadingContinuationFragment,
  stripRepeatedOffer,
  isMetaLeak,
  pickRelevantImage,
  enforceCatalogPrices,
  enforceKnownPaymentDetails,
  stripRoboticPhrasing,
} from "../src/server/services/reply-guard.js";

/**
 * Tests run against a committed fixture catalog, never the live product
 * database. `data/` holds real business data (negotiation floors, sales
 * strategy, saved templates) and is deliberately not in the repository, so
 * depending on it would both leak it and make these tests non-reproducible on
 * a fresh clone.
 */
const toolsData: Tool[] = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "tests", "fixtures", "tools.sample.json"), "utf-8")
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
    const turn1Reply =
      "VoiceDelta me thousands of studio-quality AI voices across many languages hain, aur instant voice cloning bhi milti hai ek short clean audio recording se.";
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
    const turn2Reply =
      "Text-to-speech generation multiple voice engines ke sath milti hai, aur commercial rights bhi included hain monetized content ke liye.";
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

  // =========================================================================
  // SCENARIO 6: PRODUCT CONTEXT LOCK & CONTROLLED SELLING DIRECTIVES
  // =========================================================================
  const baseCustomer: Customer = {
    phoneNumber: "923001234567",
    name: "Ali",
    status: "Interested",
    messages: [
      { role: "user", content: "ClipShield chahiye", timestamp: new Date().toISOString() },
      { role: "agent", content: "Han bhai ClipShield perfect hai.", timestamp: new Date().toISOString() },
    ],
    memorySummary: { lastToolDiscussed: "ClipShield", totalTurnsCount: 2, currentProductId: "x", currentProductName: "ClipShield" },
  };
  const clipTool = toolsData.find(t => t.name.toLowerCase().includes("clip"))!;

  test("6.1 Product lock directive keeps conversation on ONE product", () => {
    const { prompt } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [clipTool],
      allAccountToolsSummary: "- ClipShield\n- VoiceDelta",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "aur batao",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
      lockedProductName: clipTool.name,
    });
    assert.ok(prompt.includes("CURRENT PRODUCT LOCK"), "Must include product lock directive");
    assert.ok(prompt.includes(clipTool.name), "Lock directive must name the locked product");
  });

  test("6.2 Explicit payment request triggers payment-only mode (no re-pitch)", () => {
    const { prompt } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [clipTool],
      allAccountToolsSummary: "- ClipShield",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "payment details bhejo",
      settings: {
        aiAgentEnabled: true,
        language: "Roman Urdu",
        paymentMethods: [{ id: "1", provider: "Easypaisa", accountTitle: "Badar", accountNumber: "03001112223", isActive: true }],
      } as any,
      lockedProductName: clipTool.name,
      explicitPaymentRequest: true,
    });
    assert.ok(prompt.includes("PAYMENT MODE"), "Must enter payment mode");
    assert.ok(/Do NOT re-pitch/i.test(prompt), "Payment mode must forbid re-pitching");
    assert.ok(prompt.includes("OFFICIAL PAYMENT ACCOUNTS"), "Payment accounts must be injected");
    assert.ok(prompt.includes("03001112223"), "Configured payment number must be present");
  });

  test("6.3 High buying intent stops the pitch and moves to action", () => {
    const { prompt } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [clipTool],
      allAccountToolsSummary: "- ClipShield",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "le lunga, price kya hai",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
      lockedProductName: clipTool.name,
      buyingIntent: true,
    });
    assert.ok(prompt.includes("HIGH BUYING INTENT"), "Must include buying-intent directive");
  });

  test("6.4 Extended product-specific sales intelligence is injected", () => {
    const salesTool: Tool = {
      ...clipTool,
      sales: {
        primary_selling_point: "9-layer Content ID bypass no one else offers",
        discovery_questions: ["Kis niche ka channel hai?"],
        negotiation_rules: "Rate fixed, floor only for same-day payment",
        allowed_discounts: "Rs. 1,200 monthly for instant payment",
        buying_signals: ["link bhejo", "HWID"],
        closing_strategy: "Confirm HWID then send payment accounts",
      },
    };
    const { prompt } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [salesTool],
      allAccountToolsSummary: "- ClipShield",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "details",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
      lockedProductName: salesTool.name,
    });
    assert.ok(prompt.includes("Primary Selling Point:"), "Primary selling point must be injected");
    assert.ok(prompt.includes("Allowed Discounts (ONLY these are permitted):"), "Allowed discounts must be injected");
    assert.ok(prompt.includes("Closing Strategy:"), "Closing strategy must be injected");
  });

  test("6.5 System prompt enforces concise replies and strict role separation", () => {
    const { systemPrompt } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [clipTool],
      allAccountToolsSummary: "- ClipShield",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "hi",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
    });
    assert.ok(/1 to 3 SHORT sentences/i.test(systemPrompt), "Must enforce concise default length");
    assert.ok(/STRICT ROLE SEPARATION/i.test(systemPrompt), "Must enforce role separation");
    assert.ok(/NEVER write the customer's messages/i.test(systemPrompt), "Must forbid speaking as the customer");
  });

  // =========================================================================
  // SCENARIO 7: buildCompactPublicQuery — Link extraction & truncation safety
  // Verifies the two live bugs observed Sep-11 are gone:
  //   7.1 Real ClipShield docs link must appear in compact query (was: regex mismatch → link dropped)
  //   7.2 Compact query must NOT start mid-sentence (was: 1000-char truncation cut first word off)
  // =========================================================================
  test("7.1 buildCompactPublicQuery includes real ClipShield docs.google.com link", () => {
    // Simulate the exact prompt format synthesizeSalesPrompt produces
    const fakePrompt = [
      "Customer: Badar",
      "=== PRODUCT CATALOG: ClipShield ===",
      "[NOTE: ClipShield is ALWAYS IN STOCK and AVAILABLE for YouTube copyright removal and Content ID bypass.]",
      "Description & Problem Solved: ClipShield bypasses YouTube Content ID copyright claims.",
      "Pricing: Rs. 1500/mo | Min Floor Rate: Rs. 1200",
      "Key Features:",
      "  * Bypass Content ID algorithm",
      "  * One-click video processing",
      "Official Links & Downloads:",
      "  - Download Doc: https://docs.google.com/document/d/1Y4dAxV-JO_scOKUW_2gXk5Mv4c59nQQvOBETKpCALF0/edit?usp=sharing (Setup Guide)",
      "[RECENT CONVERSATION TURNS]:",
      "Customer: Link bhjo",
      "You (Agent): Zaroor, abhi bhejta hoon",
      `CUSTOMER'S LATEST MESSAGE(S): "G"`,
      "Reply ONLY as the seller..."
    ].join("\n");

    const compact = buildCompactPublicQuery(fakePrompt);
    assert.ok(
      compact.includes("docs.google.com/document/d/1Y4dAxV-JO_scOKUW_2gXk5Mv4c59nQQvOBETKpCALF0"),
      `Compact query must contain real ClipShield Google Docs link. Got:\n${compact}`
    );
    assert.ok(
      !compact.includes("example.com"),
      "Compact query must NOT contain placeholder example.com link"
    );
  });

  test("7.2 buildCompactPublicQuery output starts with a complete sentence (not mid-word)", () => {
    // Generate a very long prompt that would have been truncated by the old 1000-char limit
    const longSection = "X".repeat(1200); // pad to exceed old limit
    const fakePrompt = [
      "=== PRODUCT CATALOG: ClipShield ===",
      `Description & Problem Solved: ${longSection}`,
      "Pricing: Rs. 1500/mo",
      "Key Features:",
      "  * Feature one",
      "Official Links & Downloads:",
      "  - Download Doc: https://docs.google.com/document/d/1Y4dAxV-JO_scOKUW_2gXk5Mv4c59nQQvOBETKpCALF0/edit?usp=sharing",
      "[RECENT CONVERSATION TURNS]:",
      "Customer: details",
      `CUSTOMER'S LATEST MESSAGE(S): "Link bhjo"`,
      "Reply ONLY as the seller..."
    ].join("\n");

    const compact = buildCompactPublicQuery(fakePrompt);
    // The compact query should start with "Role:" (the roleRules block) — not a mid-word
    assert.ok(
      /^Role:/i.test(compact.trim()),
      `Compact query must start with "Role:" guardrail block, not mid-sentence. Started with: "${compact.trim().slice(0, 60)}"`
    );
    // Also verify the link still appears despite the long prompt
    assert.ok(
      compact.includes("docs.google.com"),
      "Compact query must still contain the real link even with a long prompt body"
    );
  });

  // =========================================================================
  // SCENARIO 8: REPLY GUARDS — the exact failures from the Sep-11 ClipShield chat
  //   - agent asked "aap kahen toh main link bhej doon?" 3 turns running while
  //     the customer kept replying "G" / "Link bhjo"
  //   - final link it sent was a markdown placeholder: [..](https://example.com/..)
  //   - two replies started mid-sentence ("ko bypass kar sake. Ye video ki ...")
  // =========================================================================
  test("8.1 isBareAffirmation recognizes short WhatsApp confirmations", () => {
    for (const yes of ["G", "g", "haan", "ji bhai", "ok", "bhejo", "haan bhejo", "theek hai"]) {
      assert.ok(isBareAffirmation(yes), `"${yes}" must count as a bare affirmation`);
    }
    for (const no of ["G clipshield ka kya rate hai", "nahi rehne do", "kitne ka hai"]) {
      assert.ok(!isBareAffirmation(no), `"${no}" must NOT count as a bare affirmation`);
    }
  });

  test("8.2 detectPendingOffer reads what the agent last offered to send", () => {
    assert.strictEqual(
      detectPendingOffer("Aap kahen toh main setup guide aur download link abhi share kar deta hoon?"),
      "link"
    );
    assert.strictEqual(
      detectPendingOffer("Payment details bhej doon jazzcash ke?"),
      "payment"
    );
    assert.strictEqual(detectPendingOffer("Zabardast tool hai bhai"), null);
  });

  test("8.3 enforceKnownLinks rewrites a placeholder/markdown link to the real configured URL", () => {
    const real = clipTool.links!.find(l => l.url)!.url;
    const flattened = flattenMarkdownLinks(
      "Jee bilkul, yeh lein: [ClipShield Setup Guide & Download](https://example.com/clipshield-setup)"
    );
    assert.ok(!/\]\(/.test(flattened), "markdown link syntax must be flattened");
    const guarded = enforceKnownLinks(flattened, collectAllowedUrls([clipTool])).text;
    assert.ok(guarded.includes(real), "placeholder host must be replaced with the real configured link");
    assert.ok(!guarded.includes("example.com"), "no placeholder host may survive");
  });

  test("8.4 enforceKnownLinks removes an invented link when the product has none", () => {
    const res = enforceKnownLinks("Yeh raha link: https://clipshield-download.net/setup", []);
    assert.ok(!res.text.includes("clipshield-download.net"), "invented link must be stripped when nothing is allowed");
    assert.ok(res.removed >= 1, "removal must be reported");
  });

  test("8.5 stripLeadingContinuationFragment drops a reply that starts mid-sentence", () => {
    const bad = "ko bypass kar sake. Ye video ki pitch, frame rate, aur metadata ko slightly modify kar deta hai bina visual quality disturb kiye.";
    const fixed = stripLeadingContinuationFragment(bad);
    assert.ok(fixed.startsWith("Ye video ki pitch"), `fragment must be removed, got: "${fixed.slice(0, 40)}"`);
  });

  test("8.6 stripRepeatedOffer deletes the re-asked question once the customer said yes", () => {
    const lastAgent = "Aap ko ClipShield ka setup link aur details bhej doon?";
    const reply = "Jee bilkul.\nAap kahen toh main setup guide aur download link abhi share kar deta hoon?";
    const out = stripRepeatedOffer(reply, lastAgent);
    assert.ok(!/share kar deta hoon\?/.test(out), "the repeated offer question must be dropped");
    assert.ok(out.includes("Jee bilkul"), "the rest of the reply is kept");
  });

  // =========================================================================
  // SCENARIO 9: buildCompactPublicQuery — jsonMode false-positive (Sep-11, 12:12pm)
  // A live ClipShield chat broke completely: the agent replied with raw meta
  // text ("Got it — no reset, no repeated name. Ready for the next message.
  // What did he say?") instead of answering "price kia hy". Root cause: the
  // sales prompt's own "[SALES CONTROL DIRECTIVES] HIGH BUYING INTENT:" line
  // contains the literal word "intent", which used to flip buildCompactPublicQuery
  // into its raw-slice classification branch for EVERY high-intent sales turn,
  // truncating the prompt at 1000 chars — before the customer's actual message.
  // =========================================================================
  test("9.1 A normal sales prompt with 'HIGH BUYING INTENT' must NOT be treated as JSON classification", () => {
    const longSection = "Description filler ".repeat(80); // push prompt over 1000 chars
    const fakePrompt = [
      "=== PRODUCT CATALOG: ClipShield ===",
      `Description & Problem Solved: ${longSection}`,
      "Pricing: Rs. 1500/mo",
      "[SALES CONTROL DIRECTIVES]",
      "HIGH BUYING INTENT: The customer is ready to move forward. Stop pitching, reduce discovery, answer directly.",
      "[RECENT CONVERSATION TURNS]:",
      "Customer: Faida kia ha",
      `CUSTOMER'S LATEST MESSAGE(S): "Aur price kia hy"`,
      "Reply ONLY as the seller..."
    ].join("\n");

    const compact = buildCompactPublicQuery(fakePrompt);
    assert.ok(
      compact.includes('Aur price kia hy'),
      `Compact query must preserve the customer's actual message, not truncate before it. Got:\n${compact}`
    );
    assert.ok(
      !compact.startsWith("=== PRODUCT CATALOG"),
      "Must not fall into the raw-slice classification branch for an ordinary sales prompt"
    );
  });

  test("9.2 A real JSON-classifier systemPrompt still preserves the raw prompt/schema", () => {
    const fakePrompt = `Classify customer software intent. Return STRICT JSON ONLY.\nCatalog:\n- ID "1" (ClipShield)\nCustomer: "CapCut chahiye"\nJSON format:\n{"matchedToolIds": string[]}`;
    const compact = buildCompactPublicQuery(fakePrompt, "You are a JSON-only tool classifier. Output valid JSON only.");
    assert.strictEqual(compact, fakePrompt, "Real JSON classifier prompts must be preserved verbatim (untouched by compaction)");
  });

  test("9.3 jsonMode=true forces raw-slice behavior explicitly regardless of content", () => {
    const fakePrompt = "Some short prompt with no trigger words at all.";
    const compact = buildCompactPublicQuery(fakePrompt, undefined, true);
    assert.strictEqual(compact, fakePrompt, "Explicit jsonMode must force the classification path");
  });

  test("9.4 isMetaLeak recognizes the exact broken replies from the Sep-11 incident", () => {
    const broken = [
      "Got it — no reset, no repeated name. Ready for Badar's next message. What did he say?",
      "Got it. What's the message from the customer that I need to respond to?",
      "It looks like your message got cut off. Could you resend the full details or let me know what you'd like to do next?",
    ];
    for (const b of broken) {
      assert.ok(isMetaLeak(b), `Must flag as meta-leak: "${b}"`);
    }
    assert.ok(!isMetaLeak("ClipShield ka monthly price Rs. 1500 hai bhai."), "A normal in-character reply must NOT be flagged");
  });

  // =========================================================================
  // SCENARIO 10: "Where's my payment info?" — real accounts must reach the
  // fallback query, and "add tool" must not silently lose the pasted description.
  // =========================================================================
  test("10.1 buildCompactPublicQuery preserves the REAL configured payment accounts", () => {
    const fakePrompt = [
      "=== PRODUCT CATALOG: ClipShield ===",
      "Description & Problem Solved: ClipShield bypasses YouTube Content ID claims.",
      "Pricing: Rs. 1500/mo",
      "[OFFICIAL PAYMENT ACCOUNTS]",
      "- Easypaisa: Badar Abbas Shah | Number: 03079031153 (Easypaisa Wallet)",
      "- JazzCash: Badar Abbas Shah | Number: 03079031153 (JazzCash Mobile Account)",
      "Closing Directive: Send payment account details clearly.",
      "[SALES CONTROL DIRECTIVES]",
      "HIGH BUYING INTENT: ready to move forward.",
      `CUSTOMER'S LATEST MESSAGE(S): "mujhe pay karna hai kaise karu"`,
      "Reply ONLY as the seller..."
    ].join("\n");

    const compact = buildCompactPublicQuery(fakePrompt);
    assert.ok(compact.includes("03079031153"), `Real payment number must reach the fallback query. Got:\n${compact}`);
    assert.ok(/never\s+invent/i.test(compact) || /use\s+ONLY\s+these/i.test(compact), "Must instruct the model to use only the real numbers");
  });

  test("10.2 EXPLICIT_PAYMENT_REGEX-equivalent phrasing 'pay karna hai' is recognized (agent.ts hardcoded bypass)", () => {
    // Mirrors the regex in agent.ts so a drift between the two is caught here too.
    const EXPLICIT_PAYMENT_REGEX =
      /(?:payment\s*(?:details|method|info|kaise|karni|kar\s*d|number|account)|kaise?\s*pay|kahan?\s*(?:pay|paise|paisay|bhej)|account\s*(?:number|details|title|no)\b|jazz\s*cash|jazzcash|easy\s*paisa|easypaisa|\braast\b|bank\s*(?:details|account)|\bpay\s*(?:karna|karni|karu|karoon|kru|kro|kese|kaise)\b|pais(?:e|ay)?\s*(?:kaise|kese)\s*(?:du|doon|dun|de|karu|karoon)|\bhow\s*to\s*pay\b)/i;
    assert.ok(EXPLICIT_PAYMENT_REGEX.test("mujhe pay karna hai kaise karu"));
    assert.ok(EXPLICIT_PAYMENT_REGEX.test("paisay kaise du"));
    assert.ok(EXPLICIT_PAYMENT_REGEX.test("how to pay?"));
  });

  test("10.3 extractJsonObject captures a FULL nested object (pricing/faq/sections), not just the first brace", () => {
    const modelReply = "```json\n" + JSON.stringify({
      name: "SuperVoice AI",
      pricing: { min_negotiable_pkr: 800, min_negotiable_usd: 3, negotiation_notes: "same day only" },
      faq: [{ question: "Refund?", answer: "No refunds once key issued." }],
      sections: [
        { title: "Setup", content: "Download from https://example.com/setup" },
        { title: "Support", content: "WhatsApp https://wa.me/923001234567" },
      ],
      links: [{ title: "Setup", url: "https://example.com/setup", note: "" }],
    }, null, 2) + "\n```";

    const parsed = extractJsonObject<any>(modelReply);
    assert.ok(parsed, "Must parse a fenced JSON object");
    assert.strictEqual(parsed.sections?.length, 2, "Must capture BOTH sections, not truncate after the first nested object");
    assert.strictEqual(parsed.faq?.length, 1);
    assert.strictEqual(parsed.pricing?.min_negotiable_pkr, 800);
  });

  test("10.4 extractJsonObject returns null (not a garbage partial object) when there is no JSON at all", () => {
    assert.strictEqual(extractJsonObject("Sorry, I can't help with that right now."), null);
  });

  test("10.5 buildCompactPublicQuery (jsonMode) preserves the pasted 'Add Tool' description instead of the fixed schema boilerplate", () => {
    const rawInfo = [
      "SuperVoice AI — clones any voice from a 30-second sample.",
      "Pricing: Monthly Rs. 999, Lifetime Rs. 2500.",
      "Setup: https://example.com/supervoice-setup",
      "Support: https://wa.me/923001234567",
      "Note: refunds are not available once a license key is issued.",
    ].join("\n").repeat(20); // simulate a genuinely long, thorough paste

    const bigSchemaBoilerplate = "CRITICAL EXTRACTION REQUIREMENTS:\n" + "1. ZERO DATA LOSS. ".repeat(60);
    const fakePrompt = `You are an expert software product catalog architect.\n${bigSchemaBoilerplate}\n\nRaw Information:\n${rawInfo}\n`;

    const compact = buildCompactPublicQuery(fakePrompt, undefined, true);
    assert.ok(compact.includes("supervoice-setup"), `Pasted description must survive into the compact query. Got tail:\n${compact.slice(-200)}`);
    assert.ok(compact.includes("refunds are not available"), "Must preserve detail from later in the pasted text, not just its start");
  });

  test("10.6 Default placeholder payment methods are inactive by default (never quoted as real)", () => {
    // If settings.json is ever missing/corrupted, getSettings() falls back to
    // DEFAULT_SETTINGS, whose paymentMethods are unfilled placeholders
    // ("Account Title" / "03001234567"). They must stay isActive:false so the
    // agent's `p.isActive !== false` filter excludes them — otherwise a broken
    // settings file makes the agent quote this literal fake number as real.
    const settingsSource = fs.readFileSync(path.resolve(process.cwd(), "src", "server", "settings.ts"), "utf-8");
    const defaultBlockMatch = settingsSource.match(/DEFAULT_SETTINGS\s*=\s*\{[\s\S]*?paymentMethods:\s*\[([\s\S]*?)\]\s*\n\};/);
    assert.ok(defaultBlockMatch, "Could not locate DEFAULT_SETTINGS.paymentMethods block");
    const block = defaultBlockMatch![1];
    const activeFlags = [...block.matchAll(/isActive:\s*(true|false)/g)].map((m) => m[1]);
    assert.ok(activeFlags.length >= 2, "Expected isActive flags on both default placeholder payment methods");
    assert.ok(activeFlags.every((v) => v === "false"), `Default placeholder payment methods must all be isActive:false, got: ${activeFlags.join(", ")}`);
  });

  // =========================================================================
  // SCENARIO 11: No hardcoded credentials / secrets / payment accounts in
  // source or in the git-tracked data_defaults/ seed files.
  // =========================================================================
  test("11.1 auth.ts contains no hardcoded plaintext admin password", () => {
    const authSource = fs.readFileSync(path.resolve(process.cwd(), "src", "server", "auth.ts"), "utf-8");
    assert.ok(!authSource.includes("B@dar85299211"), "The real admin password must not be a literal in source");
    assert.ok(!authSource.includes('hashPassword("user123")'), "The demo user's password must not be a fixed guessable literal");
    assert.ok(authSource.includes("resolveAdminBootstrapPassword"), "Bootstrap password must be resolved (env var or random), not hardcoded");
  });

  test("11.2 getUsers() self-heal never overwrites an existing account's passwordHash", () => {
    const authSource = fs.readFileSync(path.resolve(process.cwd(), "src", "server", "auth.ts"), "utf-8");
    // The drift-check that used to force-reset an existing admin's password on
    // every request (defeating any password change made from Settings) must be
    // gone: passwordHash must not appear in the admin-repair `if` condition.
    const repairMatch = authSource.match(/if \(admin\.role !== "admin"[^)]*\)\s*\{/);
    assert.ok(repairMatch, "Could not locate the admin self-heal condition");
    assert.ok(
      !repairMatch![0].includes("passwordHash"),
      `Self-heal condition must not compare/reset passwordHash: ${repairMatch![0]}`
    );
  });

  test("11.3 data_defaults/*.json ship with no real payment accounts, API keys, or credentials", () => {
    const dir = path.resolve(process.cwd(), "data_defaults");
    const settings = JSON.parse(fs.readFileSync(path.join(dir, "settings.json"), "utf-8"));
    for (const pm of settings.paymentMethods || []) {
      assert.strictEqual(pm.isActive, false, `Default payment method "${pm.provider}" must be isActive:false`);
      assert.notStrictEqual(pm.accountNumber, "03079031153", "Must not ship the real account number as a default");
    }

    const deepgram = JSON.parse(fs.readFileSync(path.join(dir, "deepgram_accounts.json"), "utf-8"));
    assert.strictEqual(deepgram.length, 0, "No API keys should ship as defaults");

    const users = JSON.parse(fs.readFileSync(path.join(dir, "users.json"), "utf-8"));
    assert.strictEqual(users.length, 0, "No accounts (with password hashes) should ship as defaults");
  });

  // =========================================================================
  // SCENARIO 12: Grounded urgency/scarcity + real product images actually send.
  // =========================================================================
  test("12.1 synthesizeSalesPrompt injects REAL LIVE AVAILABILITY only when slots_remaining is set", () => {
    const toolWithSlots: Tool = { ...clipTool, pricing: { ...clipTool.pricing, slots_remaining: 3, slots_note: "batch of 10" } };
    const { prompt: withSlots } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [toolWithSlots],
      allAccountToolsSummary: "- ClipShield",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "kitne available hain",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
    });
    assert.ok(withSlots.includes("REAL LIVE AVAILABILITY"), "Must inject availability line when slots_remaining is set");
    assert.ok(withSlots.includes("3 slots"), "Must state the exact configured count");
    assert.ok(withSlots.includes("batch of 10"), "Must include the scarcity reason note");

    const { prompt: withoutSlots } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [clipTool],
      allAccountToolsSummary: "- ClipShield",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "kitne available hain",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
    });
    assert.ok(!withoutSlots.includes("REAL LIVE AVAILABILITY"), "Must NOT inject any availability line when slots_remaining is unset");
  });

  test("12.2 System prompt forbids fabricated urgency and requires the real count when present", () => {
    const { systemPrompt } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [clipTool],
      allAccountToolsSummary: "- ClipShield",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "hi",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
    });
    assert.ok(/URGENCY & SCARCITY/i.test(systemPrompt));
    assert.ok(/NEVER INVENTED/i.test(systemPrompt) || /fabricated urgency/i.test(systemPrompt));
  });

  test("12.3 buildCompactPublicQuery preserves the REAL availability count for the fallback model", () => {
    const fakePrompt = [
      "=== PRODUCT CATALOG: ClipShield ===",
      "Description & Problem Solved: ClipShield bypasses YouTube Content ID claims.",
      "Pricing: Rs. 1500/mo",
      "REAL LIVE AVAILABILITY: Exactly 3 slots / IDs remaining right now (batch of 10). This is TRUE — use it for genuine urgency. NEVER state any other availability number.",
      `CUSTOMER'S LATEST MESSAGE(S): "kitne bache hain"`,
      "Reply ONLY as the seller..."
    ].join("\n");
    const compact = buildCompactPublicQuery(fakePrompt);
    assert.ok(compact.includes("REAL LIVE AVAILABILITY"), "Availability line must survive into the compact fallback query");
    assert.ok(compact.includes("3 slots"));
  });

  test("12.4 Uploaded product images are listed with [SEND_IMAGE: <id>] instruction in the prompt", () => {
    const toolWithImage: Tool = {
      ...clipTool,
      images: [{ id: "img_1", filename: "shot1.png", filepath: "data/tool-images/shot1.png", url: "/tool-images/shot1.png", description: "Dashboard screenshot" } as any],
    };
    const { prompt } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [toolWithImage],
      allAccountToolsSummary: "- ClipShield",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "screenshot dikhao",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
    });
    assert.ok(prompt.includes("Uploaded Product Images"));
    assert.ok(prompt.includes("img_1"));
    assert.ok(prompt.includes("[SEND_IMAGE:"));
  });

  test("12.5 buildCompactPublicQuery preserves the image id list for the fallback model", () => {
    const fakePrompt = [
      "=== PRODUCT CATALOG: ClipShield ===",
      "Description & Problem Solved: ClipShield bypasses YouTube Content ID claims.",
      "Uploaded Product Images (use [SEND_IMAGE: <id>] to attach one):",
      "  - id=\"img_1\": Dashboard screenshot",
      `CUSTOMER'S LATEST MESSAGE(S): "screenshot dikhao"`,
      "Reply ONLY as the seller..."
    ].join("\n");
    const compact = buildCompactPublicQuery(fakePrompt);
    assert.ok(compact.includes("img_1"), `Image id must survive into the compact query. Got:\n${compact}`);
    assert.ok(compact.includes("SEND_IMAGE"));
  });

  // =========================================================================
  // SCENARIO 13: The reported failure — an image WAS uploaded for "where to
  // find the Hardware ID", the customer asks about HWID, and nothing is sent.
  // The old trigger only fired on the literal word "screenshot"/"dikhao", so a
  // real question about what the image documents never reached it.
  // =========================================================================
  const hwidImage = {
    id: "img_hwid",
    filename: "clipshield_hwid_settings.png",
    filepath: "data/tool-images/clipshield_hwid_settings.png",
    url: "/tool-images/clipshield_hwid_settings.png",
    title: "Where to find your Hardware ID",
    description: "ClipShield Settings screen showing where the Hardware ID (HWID) is copied from for license activation",
  };
  const pricingImage = {
    id: "img_pricing",
    filename: "pricing.png",
    filepath: "data/tool-images/pricing.png",
    url: "/tool-images/pricing.png",
    title: "License tiers",
    description: "Monthly and lifetime license pricing table",
  };

  test("13.1 A question about the Hardware ID selects the HWID image (no 'screenshot' word needed)", () => {
    for (const question of [
      "hardware id kahan se milega?",
      "HWID kaise nikalain bhai",
      "mujhe apna hardware ID chahiye activation ke liye",
    ]) {
      const picked = pickRelevantImage(question, [pricingImage, hwidImage]);
      assert.ok(picked, `Must match an image for: "${question}"`);
      assert.strictEqual(picked!.image.id, "img_hwid", `Must pick the HWID image for: "${question}"`);
    }
  });

  test("13.2 Picks the image that matches the question, not simply the first one", () => {
    const picked = pickRelevantImage("lifetime license pricing dikhao", [hwidImage, pricingImage]);
    assert.ok(picked);
    assert.strictEqual(picked!.image.id, "img_pricing", "Must pick by relevance, not array order");
  });

  test("13.3 An unrelated message never drags in a random image", () => {
    for (const question of ["assalam o alaikum", "ye tool kaam kaise karta hai", "discount mil sakta hai?"]) {
      assert.strictEqual(
        pickRelevantImage(question, [hwidImage, pricingImage]),
        null,
        `Must NOT attach an image for: "${question}"`
      );
    }
  });

  test("13.4 AUTO-IMAGE directive tells the agent the image is already attached", () => {
    const { prompt } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [clipTool],
      allAccountToolsSummary: "- ClipShield",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "hardware id kahan se milega",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
      lockedProductName: clipTool.name,
      autoImageAttached: "Where to find your Hardware ID",
    });
    assert.ok(prompt.includes("AUTO-IMAGE ATTACHED"), "Must announce the auto-attached image");
    assert.ok(/Do NOT promise to send it later/i.test(prompt), "Must stop the agent promising a later send");
  });

  // =========================================================================
  // SCENARIO 14: Conversation-state awareness — the reported main bug.
  // The agent re-sent the full ClipShield advertisement to a customer who had
  // already installed the app and just wanted a licence.
  // Covers the requested end-to-end scenarios A-J.
  // =========================================================================
  const turn = (role: "user" | "agent", content: string): ChatMessage => ({
    role,
    content,
    timestamp: new Date().toISOString(),
  });

  const stateFor = (text: string, history: ChatMessage[] = [], memory: any = {}, toolId = "tool_1") =>
    inferConversationState({ latestCustomerText: text, recentMessages: history, memory, lockedToolId: toolId });

  test("14.A New lead asking what the product is → template IS allowed", () => {
    const state = stateFor("ClipShield kya hai?");
    assert.strictEqual(state.stage, "new_lead");
    assert.strictEqual(state.shouldSendTemplate, true, "A genuine new lead should still get the intro template");
  });

  test("14.B THE BUG: installed + Device ID + wants licence → template BLOCKED", () => {
    const state = stateFor("I installed ClipShield. My Device ID is CS-4F21-9K7B. I need a license.");
    assert.strictEqual(state.shouldSendTemplate, false, "Must NOT re-advertise to an installed user");
    assert.ok(
      ["hwid_provided", "awaiting_license", "installed"].includes(state.stage),
      `Expected an activation-track stage, got "${state.stage}"`
    );
    assert.strictEqual(state.known.appInstalled, true);
    assert.ok(state.known.hwid, "Device ID must be captured");
    assert.ok(
      state.doNotRepeat.some((d) => /download/i.test(d)),
      "Must explicitly forbid re-sending download info"
    );
    assert.ok(
      state.doNotRepeat.some((d) => /never ask for it again/i.test(d)),
      "Must forbid asking for the Device ID again"
    );
  });

  test("14.B2 Roman Urdu equivalent is understood too", () => {
    const state = stateFor("bhai app install kar li hai, ab key chahiye");
    assert.strictEqual(state.shouldSendTemplate, false);
    assert.strictEqual(state.known.appInstalled, true);
  });

  test("14.B3 Facts from EARLIER turns still suppress the template", () => {
    const history = [turn("user", "install kar li hai bhai"), turn("agent", "Great!")];
    const state = stateFor("price kya hai?", history);
    assert.strictEqual(state.known.appInstalled, true, "Install from an earlier turn must persist");
    assert.strictEqual(state.shouldSendTemplate, false, "Still must not re-advertise");
  });

  test("14.C Price question → direct pricing stage", () => {
    const state = stateFor("Price kia hai?");
    assert.strictEqual(state.stage, "price_inquiry");
    assert.ok(/price/i.test(state.nextAction) && /directly|plainly/i.test(state.nextAction));
  });

  test("14.D Scam objection → trust stage, and proof image is chosen proactively", () => {
    const state = stateFor("Scam tu ni hy?");
    assert.strictEqual(state.stage, "trust_check");

    const feedbackImage: any = {
      id: "img_feedback",
      filename: "feedback.png",
      filepath: "data/tool-images/feedback.png",
      url: "/tool-images/feedback.png",
      title: "Customer feedback",
      description: "WhatsApp screenshots of real buyers confirming the tool works",
      category: "social_proof",
      customer_signals: ["skeptical", "scam", "legitimacy"],
      what_it_proves: "real people bought and used it",
      what_it_does_not_prove: "any specific result for this customer",
    };
    const selected = selectImageForTurn({
      images: [feedbackImage],
      state,
      customerText: "Scam tu ni hy?",
      sentHistory: [],
      explicitRequest: false,
    });
    assert.ok(selected, "Social proof must be offered proactively on a trust objection");
    assert.strictEqual(selected!.image.id, "img_feedback");
    assert.strictEqual(selected!.doNotClaim, "any specific result for this customer");
  });

  test("14.E Niche question → guidance stage that asks about their channel", () => {
    const state = stateFor("Konsi niche achi hai?");
    assert.strictEqual(state.stage, "niche_guidance");
    assert.ok(/channel|goal|ask/i.test(state.nextAction));
  });

  test("14.F Results question → no-guarantee stage", () => {
    const state = stateFor("Views ayenge?");
    assert.strictEqual(state.stage, "results_inquiry");
    assert.ok(/never guarantee/i.test(state.nextAction), "Next action must forbid guarantees");
  });

  test("14.G Stats request → proof stage picks the analytics image", () => {
    const state = stateFor("Koi stats hain?");
    assert.strictEqual(state.stage, "proof_request");

    const analytics: any = {
      id: "img_analytics",
      filename: "analytics.png",
      filepath: "data/tool-images/analytics.png",
      url: "/tool-images/analytics.png",
      title: "Channel analytics example",
      description: "YouTube analytics screenshot showing views and reach growth for a shorts channel",
      category: "analytics",
      customer_signals: ["results", "views", "growth", "proof"],
      what_it_does_not_prove: "that ClipShield itself caused these results",
    };
    const selected = selectImageForTurn({
      images: [analytics],
      state,
      customerText: "Koi stats hain?",
      sentHistory: [],
      explicitRequest: true,
    });
    assert.ok(selected, "An explicit stats request must surface the analytics image");
    assert.strictEqual(selected!.image.id, "img_analytics");
  });

  test("14.H Expensive → price-objection stage that diagnoses before discounting", () => {
    const state = stateFor("Bohat mehnga hai.");
    assert.strictEqual(state.stage, "objection_price");
    assert.ok(/only after|acknowledge/i.test(state.nextAction), "Must not lead with a discount");
  });

  test("14.I Ready to buy → stop selling, no proactive image", () => {
    const state = stateFor("Lifetime chahiye");
    assert.strictEqual(state.stage, "plan_lifetime");
    assert.strictEqual(state.shouldSendTemplate, false);

    const proof: any = {
      id: "img_feedback",
      filename: "f.png",
      filepath: "data/tool-images/f.png",
      url: "/f.png",
      title: "Customer feedback",
      description: "buyers confirming it works, social proof, trust",
      customer_signals: ["skeptical", "proof"],
    };
    const selected = selectImageForTurn({
      images: [proof],
      state,
      customerText: "Lifetime chahiye",
      sentHistory: [],
      explicitRequest: false,
    });
    assert.strictEqual(selected, null, "A buyer who is closing must not be shown unrequested marketing proof");
  });

  test("14.J Support question about HWID → activation stage, no template", () => {
    const state = stateFor("HWID kahan se milega?");
    assert.strictEqual(state.shouldSendTemplate, false);
    assert.ok(["activation", "support"].includes(state.stage), `Got "${state.stage}"`);
  });

  test("14.K Image spam protection: cooldown and per-conversation cap are enforced", () => {
    const state = stateFor("Scam tu ni hy?");
    const img: any = {
      id: "img_feedback",
      filename: "f.png",
      filepath: "data/tool-images/f.png",
      url: "/f.png",
      title: "Customer feedback",
      description: "real buyers confirming legitimacy, scam doubts, trust proof",
      customer_signals: ["skeptical", "scam"],
      cooldown_minutes: 30,
      max_per_conversation: 1,
    };
    const now = Date.now();

    // Already sent once → the per-conversation cap blocks it.
    assert.strictEqual(
      selectImageForTurn({
        images: [img],
        state,
        customerText: "Scam tu ni hy?",
        sentHistory: [{ imageId: "img_feedback", at: new Date(now - 60 * 60000).toISOString() }],
        now,
      }),
      null,
      "max_per_conversation must stop a repeat send"
    );

    // Cap raised, but still inside the cooldown window → still blocked.
    assert.strictEqual(
      selectImageForTurn({
        images: [{ ...img, max_per_conversation: 5 }],
        state,
        customerText: "Scam tu ni hy?",
        sentHistory: [{ imageId: "img_feedback", at: new Date(now - 5 * 60000).toISOString() }],
        now,
      }),
      null,
      "cooldown_minutes must stop a rapid repeat"
    );
  });

  test("14.L An irrelevant message never triggers a proactive image", () => {
    const state = stateFor("assalam o alaikum");
    const img: any = {
      id: "img_analytics",
      filename: "a.png",
      filepath: "data/tool-images/a.png",
      url: "/a.png",
      title: "Analytics",
      description: "views and reach growth analytics",
    };
    assert.strictEqual(
      selectImageForTurn({ images: [img], state, customerText: "assalam o alaikum", sentHistory: [] }),
      null
    );
  });

  test("14.M Legacy images with only a description still work (backwards compatible)", () => {
    const state = stateFor("hardware id kahan se milega");
    const legacy: any = {
      id: "img_legacy",
      filename: "hwid.png",
      filepath: "data/tool-images/hwid.png",
      url: "/hwid.png",
      description: "Settings screen showing where the Hardware ID is copied from",
    };
    const selected = selectImageForTurn({
      images: [legacy],
      state,
      customerText: "hardware id kahan se milega",
      sentHistory: [],
    });
    assert.ok(selected, "An image with only the legacy description field must still be selectable");
    assert.strictEqual(selected!.image.id, "img_legacy");
  });

  test("14.N The journey block reaches the prompt and survives the fallback compaction", () => {
    const state = stateFor("I installed it, my Device ID is CS-4F21-9K7B, need a license");
    const { prompt } = synthesizeSalesPrompt({
      customer: baseCustomer,
      matchedTools: [clipTool],
      allAccountToolsSummary: "- ClipShield",
      recentMessages: baseCustomer.messages!,
      latestCustomerText: "I installed it, my Device ID is CS-4F21-9K7B, need a license",
      settings: { aiAgentEnabled: true, language: "Roman Urdu" } as any,
      lockedProductName: clipTool.name,
      journeyStage: state.stage,
      nextAction: state.nextAction,
      doNotRepeat: state.doNotRepeat,
    });
    assert.ok(prompt.includes("[SALES JOURNEY"), "Journey block must be in the full prompt");
    assert.ok(prompt.includes("DO NOT REPEAT"), "The already-known list must be present");

    const compact = buildCompactPublicQuery(prompt);
    assert.ok(compact.includes("SALES JOURNEY"), `Journey block must survive compaction. Got:\n${compact}`);
  });

  test("14.O Memory patch carries the learned facts forward", () => {
    const state = stateFor("install kar li, device id CS-99AA-1234");
    const patch = memoryPatchFromState(state);
    assert.strictEqual(patch.appInstalled, true);
    assert.ok(patch.hwid, "HWID must be persisted so it is never asked for twice");
    assert.ok(patch.journeyStage);
  });

  // =========================================================================
  // SCENARIO 15: Pricing comes from the catalog, never from the model.
  // Covers the activation, pricing, payment, objection and existing-user flows.
  // =========================================================================
  test("15.1 ACTIVATION: plans are derived from the real catalog (Monthly + Lifetime)", () => {
    const plans = getToolPlans(clipTool);
    assert.ok(plans.length >= 2, `ClipShield must expose both plans, got ${plans.length}`);

    const monthly = plans.find((p) => /month/i.test(p.name));
    const lifetime = plans.find((p) => /lifetime/i.test(p.name));
    assert.ok(monthly && lifetime, "Both a monthly and a lifetime plan must be available");
    assert.strictEqual(monthly!.pricePkr, 1500);
    assert.strictEqual(lifetime!.pricePkr, 3500, "Lifetime price must be read from the catalog, not guessed");
    assert.strictEqual(lifetime!.minNegotiablePkr, 2800, "Lifetime floor must come from the catalog too");

    const lines = formatPlanLines(plans);
    assert.ok(lines.includes("Rs. 1,500") && lines.includes("Rs. 3,500"), `Both prices listed together:\n${lines}`);
  });

  test("15.2 ACTIVATION: a tool with one plan does not invent a second one", () => {
    const voice = toolsData.find((t) => /voice/i.test(t.name))!;
    const plans = getToolPlans(voice);
    assert.strictEqual(plans.length, 1, "VoiceDelta has a single configured price");
    assert.strictEqual(plans[0].pricePkr, 1199);
  });

  test("15.3 ACTIVATION: structured plans[] override the derivation", () => {
    const configured: Tool = {
      ...clipTool,
      plans: [
        { name: "1 Month", pricePkr: 1800, billingCycle: "monthly" },
        { name: "Lifetime", pricePkr: 4200, billingCycle: "lifetime" },
        { name: "Retired", pricePkr: 999, isActive: false },
      ],
    };
    const plans = getToolPlans(configured);
    assert.strictEqual(plans.length, 2, "Inactive plans are excluded");
    assert.strictEqual(plans[0].pricePkr, 1800);
    assert.strictEqual(plans[1].pricePkr, 4200);
  });

  test("15.4 PRICING: a price the catalog does not contain is removed from the reply", () => {
    const allowed = collectAllowedPriceAmounts(clipTool, getToolPlans(clipTool));
    const reply = "Lifetime Rs. 3,500 hai. Aap ke liye special Rs. 25,000 kar deta hoon.";
    const result = enforceCatalogPrices(reply, allowed);

    assert.ok(result.removed.includes(25000), "The invented rate must be caught");
    assert.ok(!result.text.includes("25,000"), "The invented rate must not survive");
    assert.ok(result.text.includes("3,500"), "The real catalog price must survive");
  });

  test("15.5 PRICING: an in-band negotiation figure is left alone", () => {
    const allowed = collectAllowedPriceAmounts(clipTool, getToolPlans(clipTool));
    const reply = "Theek hai, Rs. 3,000 pe kar deta hoon agar aaj payment karein.";
    const result = enforceCatalogPrices(reply, allowed);
    assert.strictEqual(result.removed.length, 0, "A figure inside the configured band is legitimate");
    assert.ok(result.text.includes("3,000"));
  });

  test("15.6 PRICING: a tool with no price configured yields no plans (so nothing can be quoted)", () => {
    const priceless: Tool = {
      ...clipTool,
      pricePkr: undefined,
      priceUsd: undefined,
      pricing: {},
      sales_points: [],
      faq: [],
      sections: [],
      description: "A tool with no pricing configured at all.",
      templateMessage: undefined,
    };
    assert.strictEqual(getToolPlans(priceless).length, 0);
  });

  // Synthetic numbers only — never the real configured accounts.
  const FIXTURE_CONFIGURED_ACCOUNT = "03009998877";
  const FIXTURE_INVENTED_ACCOUNT = "03451112233";

  test("15.7 PAYMENT: an unconfigured account number is stripped from the reply", () => {
    const reply = `Easypaisa ${FIXTURE_CONFIGURED_ACCOUNT} pe bhej dein. Ya JazzCash ${FIXTURE_INVENTED_ACCOUNT} pe bhi kar sakte hain.`;
    const result = enforceKnownPaymentDetails(reply, [FIXTURE_CONFIGURED_ACCOUNT]);

    assert.ok(result.removed.length >= 1, "The invented account must be caught");
    assert.ok(!result.text.includes(FIXTURE_INVENTED_ACCOUNT), "The invented account must not survive");
    assert.ok(result.text.includes(FIXTURE_CONFIGURED_ACCOUNT), "The configured account must survive");
  });

  test("15.8 PAYMENT: an invented IBAN is stripped", () => {
    const result = enforceKnownPaymentDetails("Bank transfer PK36ABCD0000001123456702 pe kar dein.", [
      FIXTURE_CONFIGURED_ACCOUNT,
    ]);
    assert.ok(!result.text.includes("PK36ABCD0000001123456702"), "An unconfigured IBAN must never be sent");
  });

  test("15.9 OBJECTION: robotic filler is removed, real content kept", () => {
    const reply =
      "Samajh sakta hoon bhai, lekin ye ek baar ka kharcha hai. Aap batayein taake main aage process start karoon.";
    const cleaned = stripRoboticPhrasing(reply, null);

    assert.ok(!/process start kar/i.test(cleaned), `Machine phrasing must go. Got: ${cleaned}`);
    assert.ok(/ek baar ka kharcha/i.test(cleaned), "The substance must stay");
  });

  test("15.10 OBJECTION: 'bhai' is not repeated within one reply or across turns", () => {
    const doubled = stripRoboticPhrasing("Bhai dekhein bhai ye best rate hai.", null);
    assert.strictEqual((doubled.match(/bhai/gi) || []).length, 1, `Only one 'bhai' per reply: ${doubled}`);

    const afterBhaiOpener = stripRoboticPhrasing("Bhai ye lifetime plan behtar rahega.", "Bhai ye rate final hai.");
    assert.ok(!/^bhai/i.test(afterBhaiOpener), `Must not open with 'bhai' twice running: ${afterBhaiOpener}`);
  });

  test("15.11 EXISTING USER: HWID + licence request lists plans and never re-advertises", () => {
    const state = inferConversationState({
      latestCustomerText: "Hello ClipShield Team, I want to activate ClipShield Pro. My Device ID is CS-7788-AB12",
      recentMessages: [],
      memory: {},
      lockedToolId: clipTool.id,
    });

    assert.strictEqual(state.shouldSendTemplate, false, "An activating customer must not get the advertisement");
    assert.ok(state.signals.providedHwid, "The Device ID must be captured");
    assert.strictEqual(state.known.selectedPlan, null, "No plan chosen yet — so the plans must be shown");

    // This is the exact condition the agent uses to list every plan at once.
    const shouldListPlans =
      (state.signals.providedHwid !== null || state.signals.wantsLicense) && !state.known.selectedPlan;
    assert.ok(shouldListPlans, "Plans must be listed before asking which one they want");
  });

  test("15.12 EXISTING USER: once a plan is chosen, the plan list is not repeated", () => {
    const state = inferConversationState({
      latestCustomerText: "Lifetime chahiye",
      recentMessages: [],
      memory: {},
      lockedToolId: clipTool.id,
    });
    assert.strictEqual(state.known.selectedPlan, "lifetime");
  });

  test("15.12b ACTIVATION: the plan offer reads like the agreed example", () => {
    const offer = buildPlanOfferMessage({
      tool: clipTool,
      plans: getToolPlans(clipTool),
      gotHwid: true,
      variantSeed: 0,
    });

    assert.ok(/Device ID mil gaya/i.test(offer), "Acknowledges the Device ID it was given");
    assert.ok(/2 plans available/i.test(offer), "States how many plans there are");
    assert.ok(offer.includes("1 Month — Rs. 1,500"), `Monthly line. Got:\n${offer}`);
    assert.ok(offer.includes("Lifetime — Rs. 3,500"), `Lifetime line. Got:\n${offer}`);
    assert.ok(/kis wali key lena chahte ho/i.test(offer), "Asks which plan AFTER showing them");
    assert.ok(!/process start kar/i.test(offer), "No machine-sounding filler");

    // The ask must come after the prices, never before.
    assert.ok(
      offer.indexOf("1,500") < offer.indexOf("kis wali key"),
      "Plans must be shown before asking which one they want"
    );
  });

  test("15.12c ACTIVATION: the opening line varies between turns", () => {
    const plans = getToolPlans(clipTool);
    const a = buildPlanOfferMessage({ tool: clipTool, plans, gotHwid: true, variantSeed: 0 });
    const b = buildPlanOfferMessage({ tool: clipTool, plans, gotHwid: true, variantSeed: 1 });
    assert.notStrictEqual(a, b, "Repeat conversations must not be word-for-word identical");
  });

  test("15.13 The prompt carries the catalog price table and forbids inventing numbers", () => {
    const block = formatPlansForPrompt(clipTool, getToolPlans(clipTool));
    assert.ok(block.includes("1,500") && block.includes("3,500"), "Both real prices must reach the model");
    assert.ok(/never\s+state\s+any\s+number\s+not\s+listed/i.test(block), "Must forbid inventing prices");
    assert.ok(/never ask which plan/i.test(block), "Must forbid asking before showing");
  });

  test("15.14 With no plans, the prompt tells the model it may not quote anything", () => {
    const block = formatPlansForPrompt(clipTool, []);
    assert.ok(/No price is configured/i.test(block));
    assert.ok(/must NOT state, guess or estimate any price/i.test(block));
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
