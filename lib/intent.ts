// Parse a natural-language intention into a strict Intent object using Groq.
// Falls back to a heuristic parser if Groq isn't configured — so demo never breaks.

import type { Intent } from "./types";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export async function parseIntent(raw: string): Promise<Intent> {
  const fallback = heuristic(raw);
  if (!GROQ_KEY) return fallback;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an intent parser for a travel-compilation engine. Output STRICT JSON, no prose. " +
              "Fields: destination (string), origin (string|empty), budget_inr (number|0), party_size (number, default 2), " +
              "vibe (short phrase), themes (array of short tags), date_window (string like 'this weekend', 'next month'). " +
              "Indian context. Currency is INR.",
          },
          { role: "user", content: raw },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(txt) as Partial<Intent>;
    return {
      raw,
      destination: parsed.destination || fallback.destination,
      origin: parsed.origin || fallback.origin,
      budget_inr: typeof parsed.budget_inr === "number" && parsed.budget_inr > 0 ? parsed.budget_inr : fallback.budget_inr,
      party_size: parsed.party_size && parsed.party_size > 0 ? parsed.party_size : fallback.party_size,
      vibe: parsed.vibe || fallback.vibe,
      themes: Array.isArray(parsed.themes) && parsed.themes.length ? parsed.themes : fallback.themes,
      date_window: parsed.date_window || fallback.date_window,
    };
  } catch {
    return fallback;
  }
}

function heuristic(raw: string): Intent {
  const lower = raw.toLowerCase();
  // budget like ₹15k or 15000
  const k = lower.match(/(\d+(?:\.\d+)?)\s*k/);
  const plain = lower.match(/₹?\s*(\d{4,6})/);
  const budget = k ? Math.round(parseFloat(k[1]) * 1000) : plain ? parseInt(plain[1], 10) : 0;

  const destinations = ["goa", "manali", "rishikesh", "pondicherry", "ooty", "udaipur", "jaipur", "shillong", "kerala", "munnar"];
  const dest = destinations.find((d) => lower.includes(d)) ?? "Goa";

  const themes: string[] = [];
  for (const t of ["beach", "mountain", "nightlife", "quiet", "adventure", "food", "spiritual", "trek", "luxury", "budget"]) {
    if (lower.includes(t)) themes.push(t);
  }
  if (!themes.length) themes.push("relaxed");

  const party = lower.match(/(\d+)\s*(?:people|ppl|pax)/);
  const partyN = party ? parseInt(party[1], 10) : 2;

  let window = "this weekend";
  if (lower.includes("next weekend")) window = "next weekend";
  else if (lower.includes("next month")) window = "next month";
  else if (lower.includes("this month")) window = "this month";

  return {
    raw,
    destination: dest.charAt(0).toUpperCase() + dest.slice(1),
    origin: "Bangalore",
    budget_inr: budget || 15000,
    party_size: partyN,
    vibe: themes.join(", "),
    themes,
    date_window: window,
  };
}
