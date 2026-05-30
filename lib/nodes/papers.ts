// LIVE — arXiv public API (no auth). Returns recent + cited papers on any topic.
import type { Paper } from "../types";

export async function fetchPapers(topic: string): Promise<Paper[]> {
  const q   = encodeURIComponent(`all:${topic}`);
  const url = `https://export.arxiv.org/api/query?search_query=${q}&start=0&max_results=6&sortBy=lastUpdatedDate&sortOrder=descending`;

  const res  = await fetch(url, { headers: { "User-Agent": "COMPILE/1.0 (research tool)" } });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  const xml  = await res.text();

  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);

  return entries.slice(0, 5).map((entry): Paper => {
    const title    = (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "Untitled").replace(/\s+/g, " ").trim();
    const abstract = (entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    const url      = entry.match(/<id>(.*?)<\/id>/)?.[1]?.trim() ?? "";
    const year     = parseInt(entry.match(/<published>(\d{4})/)?.[1] ?? "2024", 10);
    const authors  = [...entry.matchAll(/<name>(.*?)<\/name>/g)].map((m) => m[1]).slice(0, 3);
    return { title, authors, year, abstract: abstract + (abstract.length === 300 ? "…" : ""), url, source: "arXiv" };
  });
}
