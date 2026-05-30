// MOCK — realistic Indian bus options (Redbus-style). Wire-ready.
// Swap fetchBuses body with Wire's Redbus action when WIRE_API_KEY is configured.

import type { BusOption } from "../types";

const OPERATORS = ["SRS Travels", "VRL Travels", "Orange Tours", "KSRTC", "Neeta Tours"];
const BUS_TYPES = ["Sleeper AC", "Seater Non-AC", "Volvo AC", "Semi-Sleeper AC"];

function seed(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  let x = h >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 0xffffffff; };
}

// Rough driving distance (km) between common Indian city pairs → estimate hours
const ROUTE_HOURS: Record<string, number> = {
  "bangalore-goa": 11, "bangalore-pondicherry": 5.5, "bangalore-ooty": 5,
  "bangalore-coimbatore": 6, "bangalore-mysore": 3, "bangalore-kodaikanal": 7,
  "chennai-pondicherry": 3, "chennai-ooty": 8, "chennai-coimbatore": 7,
  "mumbai-goa": 10, "mumbai-pune": 3.5, "hyderabad-goa": 14,
  "delhi-jaipur": 5, "delhi-manali": 14, "delhi-rishikesh": 6,
  "kolkata-shillong": 6,
};

function getHours(origin: string, destination: string): number {
  const key = `${origin.toLowerCase()}-${destination.toLowerCase()}`;
  const rev = `${destination.toLowerCase()}-${origin.toLowerCase()}`;
  return ROUTE_HOURS[key] ?? ROUTE_HOURS[rev] ?? 8;
}

export async function fetchBuses(origin: string, destination: string, dateWindow: string): Promise<BusOption[]> {
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 700));

  const hours = getHours(origin, destination);
  const r = seed(`bus-${origin}-${destination}-${dateWindow}`);

  // Base price scales with journey time: ₹120-180 per hour for non-AC, 180-260 for AC
  const nonAcBase = Math.round(hours * (120 + r() * 60));
  const acBase = Math.round(hours * (180 + r() * 80));

  const day = new Date();
  day.setDate(day.getDate() + 5);

  const options: BusOption[] = [
    {
      operator: OPERATORS[Math.floor(r() * OPERATORS.length)],
      type: "Seater Non-AC",
      depart: (() => { const d = new Date(day); d.setHours(18, 0, 0, 0); return d.toISOString(); })(),
      arrive: (() => { const d = new Date(day); d.setHours(18 + Math.floor(hours), Math.round((hours % 1) * 60), 0, 0); return d.toISOString(); })(),
      duration_hours: hours,
      price_inr: nonAcBase,
      route: `${origin} → ${destination}`,
    },
    {
      operator: OPERATORS[Math.floor(r() * OPERATORS.length)],
      type: "Semi-Sleeper AC",
      depart: (() => { const d = new Date(day); d.setHours(21, 30, 0, 0); return d.toISOString(); })(),
      arrive: (() => { const d = new Date(day); d.setHours(21 + Math.floor(hours) + 1, Math.round((hours % 1) * 60), 0, 0); return d.toISOString(); })(),
      duration_hours: hours + 0.5,
      price_inr: Math.round(acBase * 0.85),
      route: `${origin} → ${destination}`,
    },
    {
      operator: OPERATORS[Math.floor(r() * OPERATORS.length)],
      type: "Sleeper AC",
      depart: (() => { const d = new Date(day); d.setHours(22, 0, 0, 0); return d.toISOString(); })(),
      arrive: (() => { const d = new Date(day); d.setHours(22 + Math.floor(hours), Math.round((hours % 1) * 60), 0, 0); return d.toISOString(); })(),
      duration_hours: hours,
      price_inr: acBase,
      route: `${origin} → ${destination}`,
    },
  ].sort((a, b) => a.price_inr - b.price_inr);

  return options;
}
