// LIVE — Wikipedia REST summary (no auth). Grounding context for the topic.
import type { ContextData } from "../types";
import type { SourceAdapter, SourceContext } from "./index";

async function fetchContext({ topic }: SourceContext): Promise<{ data: ContextData; count: number }> {
  const slug = encodeURIComponent(topic.trim().replace(/\s+/g, "_"));
  let res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
    headers: { "User-Agent": "COMPILE/2.0 (research compiler)" },
    cache: "no-store",
  });

  if (!res.ok) {
    // resolve via search, then summary
    const sr = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`,
    );
    if (!sr.ok) throw new Error(`Wikipedia ${sr.status}`);
    const sd = (await sr.json()) as { query?: { search?: { title: string }[] } };
    const first = sd.query?.search?.[0]?.title;
    if (!first) throw new Error("No Wikipedia article found");
    res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(first)}`);
    if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  }

  const j = (await res.json()) as { title: string; extract?: string; content_urls?: { desktop?: { page?: string } } };
  return {
    data: {
      title:   j.title,
      summary: (j.extract ?? "").slice(0, 600),
      url:     j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${slug}`,
    },
    count: j.extract ? 1 : 0,
  };
}

export const contextAdapter: SourceAdapter = { id: "context", run: fetchContext };
