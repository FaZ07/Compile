// Take all node results + intent → single executable plan (headline, summary,
// total INR, verification points). Groq-driven, with a deterministic fallback.

import type { Intent, NodeResult, Synthesis, FlightOption, BusOption, StayOption, EventOption, WeatherData, RedditData } from "./types";

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
              "summary (3-4 sentences; calm, confident, specific numbers; mention the hidden-fee gap if facts.stay_fee_savings > 0; " +
              "if total exceeds budget say so plainly — 'this trip costs X, over your Y budget by Z'), " +
              "total_inr (integer; MUST be the arithmetic sum: cheapest_transport.price_inr × party_size + cheapest_stay.all_in_nightly_inr × nights. " +
              "cheapest_transport is whichever of cheapest_flight or cheapest_bus is lower price. " +
              "Calculate this exactly. NEVER cap or round to budget_inr. If no transport data, use stay only.), " +
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
  const buses = (r.buses?.data as BusOption[] | undefined) ?? [];
  const stays = (r.stays?.data as StayOption[] | undefined) ?? [];
  const events = (r.events?.data as EventOption[] | undefined) ?? [];
  const weather = r.weather?.data as WeatherData | undefined;
  const reddit = r.reddit?.data as RedditData | undefined;
  const nights = intent.nights ?? 2;

  const cheapestFlight = flights[0];
  const cheapestBus = buses[0];
  const cheapestTransport = (!cheapestFlight && cheapestBus) ? cheapestBus
    : (!cheapestBus && cheapestFlight) ? cheapestFlight
    : (cheapestFlight && cheapestBus)
      ? (cheapestFlight.price_inr <= cheapestBus.price_inr ? cheapestFlight : cheapestBus)
      : undefined;
  const transportPrice = cheapestTransport?.price_inr ?? 0;

  const stayTotal = stays[0] ? stays[0].all_in_nightly_inr * nights : 0;
  const computed_total = transportPrice * intent.party_size + stayTotal;

  return {
    cheapest_flight: cheapestFlight,
    cheapest_bus: cheapestBus,
    cheapest_transport: cheapestTransport,
    cheapest_transport_mode: cheapestBus && cheapestFlight
      ? (cheapestBus.price_inr < cheapestFlight.price_inr ? "bus" : "flight")
      : cheapestBus ? "bus" : "flight",
    transport_savings: cheapestBus && cheapestFlight
      ? Math.abs(cheapestFlight.price_inr - cheapestBus.price_inr)
      : 0,
    flight_options: flights.length,
    bus_options: buses.length,
    cheapest_stay: stays[0],
    stay_options: stays.length,
    stay_fee_savings: stays.length > 1 ? stays[stays.length - 1].all_in_nightly_inr - stays[0].all_in_nightly_inr : 0,
    weather,
    reddit_sentiment: reddit?.sentiment,
    top_event: events[0],
    intent_budget: intent.budget_inr,
    party_size: intent.party_size,
    nights,
    computed_total,
    over_budget: intent.budget_inr ? computed_total > intent.budget_inr : false,
  };
}

function template(intent: Intent, f: ReturnType<typeof extractFacts>): Synthesis {
  const transport = f.cheapest_transport?.price_inr ?? 0;
  const transportLabel = f.cheapest_transport_mode === "bus"
    ? `${(f.cheapest_bus as BusOption | undefined)?.operator ?? "Bus"} (${(f.cheapest_bus as BusOption | undefined)?.type ?? ""})`
    : `${f.cheapest_flight?.airline ?? "Flight"}`;
  const stay = f.cheapest_stay?.all_in_nightly_inr ?? 0;
  const nights = intent.nights ?? 2;
  const total = f.computed_total;
  const verification: Synthesis["verification"] = [];
  if (f.cheapest_flight) verification.push({ source: "Skyscanner", claim: `${f.cheapest_flight.airline} ${f.cheapest_flight.route} ₹${f.cheapest_flight.price_inr}/person`, link: "https://www.skyscanner.co.in/" });
  if (f.cheapest_bus) verification.push({ source: "Redbus", claim: `${f.cheapest_bus.operator} (${f.cheapest_bus.type}) ${f.cheapest_bus.route} ₹${f.cheapest_bus.price_inr}/person`, link: "https://www.redbus.in/" });
  if (f.cheapest_stay) verification.push({ source: f.cheapest_stay.platform, claim: `${f.cheapest_stay.name}, ${f.cheapest_stay.area} — all-in ₹${f.cheapest_stay.all_in_nightly_inr}/night`, link: "" });
  if (f.weather) verification.push({ source: "Open-Meteo", claim: `${f.weather.summary}; rain ${f.weather.rain_probability_pct}%`, link: "" });
  const overBudget = intent.budget_inr && total > intent.budget_inr;
  const budgetNote = overBudget
    ? ` Over your ₹${intent.budget_inr!.toLocaleString("en-IN")} budget by ₹${(total - intent.budget_inr!).toLocaleString("en-IN")}.`
    : "";
  const savingsNote = f.transport_savings > 0 ? ` Bus saves ₹${f.transport_savings}/person vs flight.` : "";
  return {
    headline: `${intent.destination} ${intent.date_window} — all-in ₹${total.toLocaleString("en-IN")} for ${intent.party_size} pax.`,
    summary: `${intent.destination} for ${intent.party_size} over ${nights} night${nights > 1 ? "s" : ""}: cheapest ${f.cheapest_transport_mode} is ${transportLabel} at ₹${transport}/person.${savingsNote} Stay in ${f.cheapest_stay?.area ?? "town"} at ₹${stay}/night all-in.${budgetNote} ${f.weather ? f.weather.summary + "." : ""}`,
    total_inr: Math.round(total),
    verification,
  };
}
