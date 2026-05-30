// REAL — Wikipedia REST API. No auth.
import type { WikiData } from "../types";

export async function fetchWiki(destination: string): Promise<WikiData> {
  const title = encodeURIComponent(destination.trim());
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const j = (await res.json()) as { title: string; extract: string; content_urls?: { desktop?: { page?: string } } };
  return {
    title: j.title,
    summary: (j.extract ?? "").slice(0, 320),
    url: j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${title}`,
  };
}
