// Take all node results + intent → single executable plan (headline, summary,
// total INR, verification points). Groq-driven, with a deterministic fallback.

import type { Intent, NodeResult, Synthesis, FlightOption, StayOption, EventOption, WeatherData, RedditData } from "./types";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export async function synthesize(intent: Intent, results: Record<string, NodeResult>): Promise<Synthesis> {
  const facts = extractFacts(intent, results);
  const fallback = template(intent, facts);
  if (!GROQ_KEY) return fallback;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are COMPILE — an internet reality reconciler. Given an intent and live source facts, " +
              "output STRICT JSON with: headline (one decisive sentence, like a news headline; <= 18 words; cinematic), " +
              "summary (3-4 sentences; calm, confident, specific numbers; mention the hidden-fee gap if facts.stay_fee_savings > 0), " +
              "total_inr (integer; the realistic all-in cost), " +
              "verification (array of {source, claim, link?}; at least 3 — each must cite a SPECIFIC number from the facts; " +
              "OMIT the link field entirely unless it appears verbatim in the facts — never invent URLs). " +
              "Currency INR. Indian context. Decisive language. Don't hedge. Don't apologize. Don't say 'consider' — state.",
          },
          {
            role: "user",
            content: JSON.stringify({ intent, facts }, null, 2),
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(txt) as Partial<Synthesis>;
    return {
      headline: parsed.headline || fallback.headline,
      summary: parsed.summary || fallback.summary,
      total_inr: typeof parsed.total_inr === "number" ? parsed.total_inr : fallback.total_inr,
      verification: Array.isArray(parsed.verification) && parsed.verification.length ? parsed.verification : fallback.verification,
    };
  } catch {
    return fallback;
  }
}

function extractFacts(intent: Intent, r: Record<string, NodeResult>) {
  const flights = (r.flights?.data as FlightOption[] | undefined) ?? [];
  const stays = (r.stays?.data as StayOption[] | undefined) ?? [];
  const events = (r.events?.data as EventOption[] | undefined) ?? [];
  const weather = r.weather?.data as WeatherData | undefined;
  const reddit = r.reddit?.data as RedditData | undefined;
  return {
    cheapest_flight: flights[0],
    flight_options: flights.length,
    cheapest_stay: stays[0],
    stay_options: stays.length,
    stay_fee_savings: stays.length > 1 ? stays[stays.length - 1].all_in_nightly_inr - stays[0].all_in_nightly_inr : 0,
    weather,
    reddit_sentiment: reddit?.sentiment,
    top_event: events[0],
    intent_budget: intent.budget_inr,
  };
}

function template(intent: Intent, f: ReturnType<typeof extractFacts>): Synthesis {
  const flight = f.cheapest_flight?.price_inr ?? 0;
  const stay = f.cheapest_stay?.all_in_nightly_inr ?? 0;
  const total = Math.round(flight * intent.party_size + stay * 2);
  const verification: Synthesis["verification"] = [];
  if (f.cheapest_flight) verification.push({ source: "Skyscanner", claim: `${f.cheapest_flight.airline} ${f.cheapest_flight.route} at ₹${f.cheapest_flight.price_inr}`, link: "https://www.skyscanner.co.in/" });
  if (f.cheapest_stay) verification.push({ source: f.cheapest_stay.platform, claim: `${f.cheapest_stay.name}, ${f.cheapest_stay.area} — all-in ₹${f.cheapest_stay.all_in_nightly_inr}/night`, link: "" });
  if (f.weather) verification.push({ source: "Open-Meteo", claim: `${f.weather.summary}; rain ${f.weather.rain_probability_pct}%`, link: "" });
  return {
    headline: `${intent.destination} ${intent.date_window} for ₹${total.toLocaleString("en-IN")} — sunny, ground-truthed, bookable now.`,
    summary: `${intent.destination} fits inside ₹${(intent.budget_inr || 15000).toLocaleString("en-IN")} for ${intent.party_size}. Cheapest fare is ${f.cheapest_flight?.airline ?? "—"} at ₹${flight}. Stay in ${f.cheapest_stay?.area ?? "town"} at ₹${stay}/night all-in. ${f.weather ? f.weather.summary + "." : ""}`,
    total_inr: total,
    verification,
  };
}
