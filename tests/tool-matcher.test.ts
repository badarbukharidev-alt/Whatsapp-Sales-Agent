import assert from "assert";
import {
  matchTool,
  matchToolSync,
  matchToolExactOrAlias,
  classifyToolIntentWithLLM,
  getUnstatedFacts,
  recordStatedFacts,
  clampPriceFloors,
  extractMentionedFacts
} from "../src/server/tool-matcher.js";
import { Tool, Customer } from "../src/types.js";

const mockTools: Tool[] = [
  {
    id: "tool_voicedelta",
    name: "VoiceDelta",
    description: "AI voice generator with 3600+ voices and voice cloning.",
    pricePkr: "1199",
    priceUsd: "5",
    aliases: ["voicedelta", "voice delta", "voice-delta"],
    keywords: ["voice", "voices", "voiceover", "voice over", "ai voice", "voice cloning", "tts", "elevenlabs"],
    pricing: { min_negotiable_pkr: 1000 },
    features: [
      "3,600+ distinct AI voices",
      "Instant 1-minute voice cloning with 99%+ fidelity",
      "Official ElevenLabs, OpenAI, Gemini models",
      "Unlimited voice generation on Pro plan"
    ]
  },
  {
    id: "tool_clipshield",
    name: "ClipShield – YouTube Copyright Claim Remover",
    description: "Desktop app to edit YouTube videos without copyright claims.",
    pricePkr: "1500",
    priceUsd: "6",
    aliases: ["clipshield", "clip shield", "clip-shield", "copyright claim remover"],
    keywords: ["copyright", "claim", "copyright claim", "bypass", "video downloader", "repurpose", "content id"],
    pricing: { min_negotiable_pkr: 1200 },
    features: [
      "9-layer anti-Content ID protection",
      "AI Hook finder for viral clips",
      "Smart 9:16 vertical reframing",
      "Super fast local PC processing"
    ]
  }
];

async function runTests() {
  console.log("==================================================");
  console.log("  RUNNING TOOL-MATCHER UNIT TESTS");
  console.log("==================================================");

  let passed = 0;
  const testQueue: Array<{ name: string; fn: () => void | Promise<void> }> = [];

  function test(name: string, fn: () => void | Promise<void>) {
    testQueue.push({ name, fn });
  }

  // 1. Exact Match Test
  test("Exact match on tool name", () => {
    const res = matchToolSync("Bhai VoiceDelta ka price kitna hai?", mockTools);
    assert.strictEqual(res.confidence, "exact");
    assert.strictEqual(res.matched.length, 1);
    assert.strictEqual(res.matched[0].id, "tool_voicedelta");
    assert.strictEqual(res.isUnknownProduct, false);
  });

  // 2. Alias Match Test
  test("Alias match (spaced or hyphenated)", () => {
    const res = matchToolSync("Mujhe clip shield software chahiye", mockTools);
    assert.strictEqual(res.confidence, "alias");
    assert.strictEqual(res.matched.length, 1);
    assert.strictEqual(res.matched[0].id, "tool_clipshield");
    assert.strictEqual(res.isUnknownProduct, false);
  });

  // 3. Keyword Match Test
  test("Keyword match when tool name is not explicitly mentioned", () => {
    const res = matchToolSync("Aapke pas voice cloning wala koi system hai?", mockTools);
    assert.strictEqual(res.confidence, "keyword");
    assert.strictEqual(res.matched.length, 1);
    assert.strictEqual(res.matched[0].id, "tool_voicedelta");
  });

  test("Keyword match for copyright claim bypass", () => {
    const res = matchToolSync("YouTube videos par copyright claim na aye aisi cheez chahiye", mockTools);
    assert.strictEqual(res.confidence, "keyword");
    assert.strictEqual(res.matched.length, 1);
    assert.strictEqual(res.matched[0].id, "tool_clipshield");
  });

  // 4. Multiple Tools Match Test
  test("Matches multiple tools when user asks about both", () => {
    const res = matchToolSync("VoiceDelta aur ClipShield dono ka demo de do", mockTools);
    assert.strictEqual(res.matched.length, 2);
    const ids = res.matched.map(t => t.id);
    assert.ok(ids.includes("tool_voicedelta"));
    assert.ok(ids.includes("tool_clipshield"));
  });

  // 5. No Match Test (Casual Conversation)
  test("No match on casual greeting or vague chatter", () => {
    const res = matchToolSync("Assalam o Alaikum bhai kaise ho?", mockTools);
    assert.strictEqual(res.confidence, "none");
    assert.strictEqual(res.matched.length, 0);
    assert.strictEqual(res.isUnknownProduct, false);
  });

  // 6. Unknown External Product Detection
  test("Detects unknown product inquiry: CapCut", () => {
    const res = matchToolSync("Bhai CapCut pro account mil jayega kya?", mockTools);
    assert.strictEqual(res.confidence, "none");
    assert.strictEqual(res.matched.length, 0);
    assert.strictEqual(res.isUnknownProduct, true);
    assert.strictEqual(res.queryProduct?.toLowerCase(), "capcut");
  });

  test("Detects unknown product inquiry: Canva", () => {
    const res = matchToolSync("Canva subscription hai aapke pas?", mockTools);
    assert.strictEqual(res.confidence, "none");
    assert.strictEqual(res.isUnknownProduct, true);
    assert.strictEqual(res.queryProduct?.toLowerCase(), "canva");
  });

  test("Detects unknown product inquiry: InVideo", () => {
    const res = matchToolSync("InVideo software ka rate kya hai?", mockTools);
    assert.strictEqual(res.confidence, "none");
    assert.strictEqual(res.isUnknownProduct, true);
    assert.strictEqual(res.queryProduct?.toLowerCase(), "invideo");
  });

  // 7. Hybrid Async Tool Matcher (Fast path + Fallback resilience)
  test("Hybrid matchTool resolves exact match without delay", async () => {
    const res = await matchTool("VoiceDelta details please", mockTools);
    assert.strictEqual(res.matched[0].id, "tool_voicedelta");
    assert.strictEqual(res.confidence, "exact");
  });

  test("Hybrid matchTool resolves unknown product: Netflix", async () => {
    const res = await matchTool("bhai netflix ka account kitne ka hai?", mockTools);
    assert.strictEqual(res.isUnknownProduct, true);
    assert.strictEqual(res.queryProduct?.toLowerCase(), "netflix");
  });

  // 7. Fact Subtraction Test (getUnstatedFacts)
  test("getUnstatedFacts returns all facts when none stated", () => {
    const all = mockTools[0].features!;
    const unstated = getUnstatedFacts(all, []);
    assert.strictEqual(unstated.length, all.length);
  });

  test("getUnstatedFacts filters out already stated facts", () => {
    const all = mockTools[0].features!;
    const stated = ["3,600+ distinct AI voices"];
    const unstated = getUnstatedFacts(all, stated);
    assert.strictEqual(unstated.length, all.length - 1);
    assert.ok(!unstated.some(f => f.includes("3,600+")));
  });

  test("getUnstatedFacts handles fuzzy token overlap", () => {
    const all = mockTools[0].features!;
    // Stated in slightly different wording
    const stated = ["Isme 3,600 se zyada distinct AI voices milti hain"];
    const unstated = getUnstatedFacts(all, stated);
    assert.ok(!unstated.some(f => f.includes("3,600+ distinct AI voices")));
  });

  // 8. Record Stated Facts Test
  test("recordStatedFacts correctly stores facts in customer object", () => {
    const customer: Customer = {
      phoneNumber: "923001234567",
      status: "New Customer",
      messages: []
    };

    recordStatedFacts(customer, "tool_voicedelta", ["3,600+ AI voices", "Voice cloning 99%"]);
    assert.ok(customer.factsStated);
    assert.strictEqual(customer.factsStated["tool_voicedelta"].length, 2);

    // Duplicate call should not duplicate entries
    recordStatedFacts(customer, "tool_voicedelta", ["3,600+ AI voices", "Unlimited generations"]);
    assert.strictEqual(customer.factsStated["tool_voicedelta"].length, 3);
  });

  // 9. Price Floor Clamping Test
  test("clampPriceFloors clamps quotes below min_negotiable_pkr", () => {
    // VoiceDelta floor is 1000
    const text1 = "Chalo bhai aap ke liye Rs. 700 me done karte hain";
    const clamped1 = clampPriceFloors(text1, [mockTools[0]]);
    assert.ok(clamped1.includes("Rs. 1,000"));
    assert.ok(!clamped1.includes("Rs. 700"));

    const text2 = "Ye tool 500 Rs ka hai";
    const clamped2 = clampPriceFloors(text2, [mockTools[0]]);
    assert.ok(clamped2.includes("Rs. 1,000"));

    // Quotes at or above floor must remain untouched
    const text3 = "VoiceDelta Rs. 1,199/month ka hai aur 3600 voices hain";
    const clamped3 = clampPriceFloors(text3, [mockTools[0]]);
    assert.ok(clamped3.includes("Rs. 1,199"));
    assert.ok(clamped3.includes("3600 voices"));
  });

  // 10. Extract Mentioned Facts Test
  test("extractMentionedFacts detects features used in reply text", () => {
    const reply = "Isme 3,600 distinct AI voices hain aur instant 1-minute voice cloning milti hai 99% accuracy ke sath.";
    const facts = extractMentionedFacts(reply, mockTools[0]);
    assert.ok(facts.length >= 1);
    assert.ok(facts.some(f => f.includes("3,600+")));
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
  console.log(`RESULTS: ${passed}/${total} tests passed.`);
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
