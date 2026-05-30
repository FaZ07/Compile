// LIVE — Wikipedia REST API (no auth).
import type { WikiData } from "../types";

export async function fetchWiki(topic: string): Promise<WikiData> {
  const slug = encodeURIComponent(topic.trim().replace(/\s+/g, "_"));
  const res  = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
    headers: { "User-Agent": "COMPILE/1.0" },
  });

  if (!res.ok) {
    // fallback to search
    const sr = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`,
    );
    if (!sr.ok) throw new Error("Wikipedia unavailable");
    const sd    = (await sr.json()) as { query?: { search?: { title: string }[] } };
    const first = sd.query?.search?.[0]?.title;
    if (!first) throw new Error("No Wikipedia article");
    const r2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(first)}`);
    if (!r2.ok) throw new Error("Wikipedia fetch failed");
    const d2 = (await r2.json()) as WP;
    return { title: d2.title, summary: (d2.extract ?? "").slice(0, 500), url: d2.content_urls?.desktop?.page ?? "" };
  }

  const d = (await res.json()) as WP;
  return { title: d.title, summary: (d.extract ?? "").slice(0, 500), url: d.content_urls?.desktop?.page ?? "" };
}

interface WP { title: string; extract?: string; content_urls?: { desktop?: { page?: string } } }
