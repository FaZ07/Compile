// MOCK — realistic Indian-domestic flight options. Seeded by destination so the
// same demo always yields the same compelling numbers. Swap with Wire's
// Skyscanner action when WIRE_API_KEY is configured.

import type { FlightOption } from "../types";

const AIRLINES = ["IndiGo", "Air India", "Vistara", "Akasa Air", "SpiceJet"];

const IATA: Record<string, string> = {
  bangalore: "BLR", bengaluru: "BLR", chennai: "MAA", mumbai: "BOM", delhi: "DEL",
  hyderabad: "HYD", kolkata: "CCU", pune: "PNQ",
  goa: "GOI", manali: "KUU", rishikesh: "DED", pondicherry: "PNY",
  ooty: "CJB", udaipur: "UDR", jaipur: "JAI", shillong: "SHL", kerala: "COK", munnar: "COK",
};

function seed(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  let x = h >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 0xffffffff; };
}

export async function fetchFlights(origin: string, destination: string, dateWindow: string): Promise<FlightOption[]> {
  // simulate network latency without blocking the demo
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 900));
  const from = IATA[origin.toLowerCase()] ?? "BLR";
  const to = IATA[destination.toLowerCase()] ?? "GOI";
  const r = seed(from + to + dateWindow);
  const base = 2800 + Math.floor(r() * 3200);
  const day = new Date();
  day.setDate(day.getDate() + 6); // weekend-ish

  return AIRLINES.slice(0, 3).map((a, i) => {
    const price = Math.round(base + i * 600 + r() * 800);
    const dep = new Date(day);
    dep.setHours(6 + i * 4, Math.floor(r() * 60), 0, 0);
    const arr = new Date(dep.getTime() + (75 + r() * 25) * 60000);
    return {
      airline: a,
      depart: dep.toISOString(),
      arrive: arr.toISOString(),
      price_inr: price,
      route: `${from} → ${to}`,
    };
  });
}
