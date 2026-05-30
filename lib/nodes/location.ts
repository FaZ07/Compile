// REAL — Nominatim (OpenStreetMap) geocoder. No auth, no key.
import type { LocationData } from "../types";

export async function resolveLocation(query: string): Promise<LocationData> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "compile-hackathon/0.1 (anakin)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const arr = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  if (!arr.length) throw new Error(`No location for "${query}"`);
  const r = arr[0];
  return { display_name: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) };
}
