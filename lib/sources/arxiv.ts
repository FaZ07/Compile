// LIVE — arXiv Atom API (no auth). Latest papers on the topic.
import type { Paper } from "../types";
import type { SourceAdapter, SourceContext } from "./index";

async function fetchPapers({ topic }: SourceContext): Promise<{ data: Paper[]; count: number }> {
  const q = encodeURIComponent(`all:${topic}`);
  const url = `https://export.arxiv.org/api/query?search_query=${q}&start=0&max_results=6&sortBy=relevance&sortOrder=descending`;
  const res = await fetch(url, { headers: { "User-Agent": "COMPILE/2.0 (research compiler)" }, cache: "no-store" });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  const xml = await res.text();

  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
  const papers = entries.slice(0, 5).map((e): Paper => {
    const title    = clean(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "Untitled");
    const abstract = clean(e.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").slice(0, 320);
    const url      = (e.match(/<id>(.*?)<\/id>/)?.[1] ?? "").trim();
    const year     = parseInt(e.match(/<published>(\d{4})/)?.[1] ?? `${new Date().getFullYear()}`, 10);
    const authors  = [...e.matchAll(/<name>(.*?)<\/name>/g)].map((m) => m[1].trim()).slice(0, 3);
    const category = (e.match(/<arxiv:primary_category[^>]*term="([^"]+)"/)?.[1] ?? "cs").trim();
    return { title, abstract: abstract + (abstract.length >= 320 ? "…" : ""), url, year, authors, category };
  });

  return { data: papers, count: papers.length };
}

function clean(s: string): string { return s.replace(/\s+/g, " ").trim(); }

export const papersAdapter: SourceAdapter = { id: "papers", run: fetchPapers };
