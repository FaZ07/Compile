// MOCK — realistic local events. Swap with BookMyShow / Luma / Meetup.
import type { EventOption } from "../types";

const EVENT_TEMPLATES: { name: string; venue_suffix: string; min: number; max: number | "free" }[] = [
  { name: "Sunset Sessions — live music", venue_suffix: "Sky Bar", min: 0, max: "free" },
  { name: "Open-air jazz night", venue_suffix: "Promenade", min: 400, max: 800 },
  { name: "Weekend pottery workshop", venue_suffix: "Studio Loft", min: 600, max: 1100 },
  { name: "Sunrise yoga on the beach", venue_suffix: "Beach", min: 0, max: "free" },
  { name: "Indie film screening", venue_suffix: "Cinema House", min: 200, max: 350 },
  { name: "Local cooking class", venue_suffix: "Kitchen 9", min: 850, max: 1500 },
  { name: "Late-night DJ set", venue_suffix: "Hill House", min: 500, max: 1200 },
];

function seed(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  let x = h >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 0xffffffff; };
}

export async function fetchEvents(destination: string): Promise<EventOption[]> {
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 800));
  const r = seed(destination.toLowerCase());
  const day = new Date();
  day.setDate(day.getDate() + 6);
  return EVENT_TEMPLATES.slice(0, 4).map((t, i) => {
    const when = new Date(day);
    when.setDate(when.getDate() + (i % 2));
    when.setHours(18 + Math.floor(r() * 6), 0, 0, 0);
    const price = t.max === "free" ? "free" : Math.round(t.min + r() * (Number(t.max) - t.min));
    return {
      name: t.name,
      venue: `${destination} · ${t.venue_suffix}`,
      when: when.toISOString(),
      price_inr: price as number | "free",
    };
  });
}
