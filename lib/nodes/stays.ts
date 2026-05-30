// MOCK — realistic stays with platform-specific HIDDEN FEES surfaced.
// This is the heart of the "Honey moment": platforms show one price; we show the
// all-in. Swap with Wire's Agoda/Booking/Airbnb actions when available.

import type { StayOption } from "../types";

const AREAS: Record<string, string[]> = {
  goa: ["Anjuna", "Vagator", "Palolem", "Morjim", "Assagao", "Mandrem"],
  manali: ["Old Manali", "Vashisht", "Aleo", "Solang"],
  pondicherry: ["White Town", "Auroville", "Promenade"],
  default: ["Town centre", "Old quarter", "Seaside"],
};

const STAY_NAMES = [
  "Banyan Studio", "Whitewash Villa", "The Quiet House", "Coral Cottage",
  "Mango Tree Stay", "Driftwood Loft", "The Goan Hideout", "Saltbreeze Studio",
  "Forest Floor Cabin", "Patio 21", "The Tile House", "Halcyon Suite",
];

function seed(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  let x = h >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 0xffffffff; };
}

const PLATFORMS = ["Agoda", "Booking.com", "Airbnb"];

export async function fetchStays(destination: string, partySize: number, budgetInr: number): Promise<StayOption[]> {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 1100));
  const r = seed(destination.toLowerCase() + partySize);
  const areas = AREAS[destination.toLowerCase()] ?? AREAS.default;
  const target = Math.max(800, Math.floor((budgetInr || 15000) / 3.2)); // per-night target

  return Array.from({ length: 6 }, (_, i) => {
    const platform = PLATFORMS[i % PLATFORMS.length];
    const nightly = Math.round(target * (0.55 + r() * 0.75));
    const fees = feesFor(platform, nightly, r);
    const all_in = nightly + fees.reduce((a, f) => a + f.amount, 0);
    return {
      platform,
      name: STAY_NAMES[(i * 3 + Math.floor(r() * 7)) % STAY_NAMES.length],
      area: areas[i % areas.length],
      nightly_inr: nightly,
      all_in_nightly_inr: all_in,
      fee_breakdown: fees,
      rating: Math.round((7.6 + r() * 2) * 10) / 10,
    };
  }).sort((a, b) => a.all_in_nightly_inr - b.all_in_nightly_inr);
}

function feesFor(platform: string, nightly: number, r: () => number) {
  const fees: { label: string; amount: number }[] = [];
  if (platform === "Airbnb") {
    fees.push({ label: "Service fee", amount: Math.round(nightly * 0.14) });
    fees.push({ label: "Cleaning fee", amount: 350 + Math.round(r() * 700) });
  } else if (platform === "Booking.com") {
    fees.push({ label: "Property tax & fees", amount: Math.round(nightly * 0.08) });
    if (r() < 0.6) fees.push({ label: "Resort fee", amount: 250 + Math.round(r() * 450) });
  } else {
    fees.push({ label: "Taxes & fees", amount: Math.round(nightly * 0.12) });
  }
  return fees;
}
