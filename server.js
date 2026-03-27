const express = require("express");
const cors = require("cors");
const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" })); // Restrict to your domain in production

// ── API Key Pool ──────────────────────────────────────────────────────────────
const API_KEYS = [
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3,
].filter(Boolean); // removes undefined if a key isn't set

if (API_KEYS.length === 0) {
  console.error("❌  No Gemini API keys found. Check your .env file.");
  process.exit(1);
}

let keyIndex = 0; // round-robin pointer

// Round-robin key selector (more balanced than random)
function getNextKey() {
  const key = API_KEYS[keyIndex];
  keyIndex = (keyIndex + 1) % API_KEYS.length;
  return key;
}

// ── Gemini Model ──────────────────────────────────────────────────────────────
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_BASE  = "https://generativelanguage.googleapis.com/v1beta/models";

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status : "online",
    model  : GEMINI_MODEL,
    keys   : API_KEYS.length,
    uptime : Math.floor(process.uptime()) + "s",
  });
});

// ── /api/analyze  (fake-news detector) ───────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "Request body must include non-empty `text`." });
  }

  const prompt = `Analyze this news article for authenticity. Respond using EXACTLY this format:

Verdict: Fake / Real / Uncertain
Confidence: Low / Medium / High
Reason: [2-3 sentences explaining your reasoning]

News:
${text.trim()}`;

  // Try each key in rotation; fall back to next on 429 / quota errors
  let lastError = null;

  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    const apiKey = getNextKey();

    try {
      const geminiRes = await fetch(
        `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent`,
        {
          method : "POST",
          headers: {
            "Content-Type"  : "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      // Handle quota / rate-limit — try next key
      if (geminiRes.status === 429 || geminiRes.status === 403) {
        console.warn(`⚠  Key #${attempt + 1} hit rate limit (${geminiRes.status}), rotating…`);
        lastError = `Key quota exceeded (HTTP ${geminiRes.status})`;
        continue;
      }

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text();
        return res.status(502).json({ error: "Gemini API error", detail: errBody });
      }

      const data   = await geminiRes.json();
      const output = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      return res.json({ result: output.replace(/\*\*/g, "") });

    } catch (err) {
      console.error("Fetch error:", err.message);
      lastError = err.message;
    }
  }

  // All keys failed
  res.status(503).json({
    error : "All API keys are exhausted or unavailable.",
    detail: lastError,
  });
});

// ── /api/livefeed  (genuine news feed — future use) ──────────────────────────
app.post("/api/livefeed", async (req, res) => {
  const { query = "latest world news" } = req.body;

  const prompt = `Give me 5 recent, factual news headlines about: "${query}".
Format each item as:
HEADLINE: <headline>
SUMMARY: <1 sentence summary>
CATEGORY: <Technology / Politics / Science / Health / Business / Other>
---`;

  const apiKey = getNextKey();

  try {
    const geminiRes = await fetch(
      `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent`,
      {
        method : "POST",
        headers: {
          "Content-Type"  : "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      return res.status(502).json({ error: "Gemini API error", detail: errBody });
    }

    const data   = await geminiRes.json();
    const output = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return res.json({ result: output.replace(/\*\*/g, "") });

  } catch (err) {
    res.status(503).json({ error: "Feed fetch failed.", detail: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅  Factify backend running on http://localhost:${PORT}`);
  console.log(`🔑  Loaded ${API_KEYS.length} API key(s) — round-robin rotation enabled`);
});