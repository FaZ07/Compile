// LIVE — DEV.to free public API (no auth). YouTube is Wire-ready mock.
import type { Tutorial } from "../types";

export async function fetchTutorials(topic: string): Promise<Tutorial[]> {
  const tag = topic.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);
  const broad = topic.toLowerCase().split(/\s+/)[0];

  // Try specific tag first, fall back to broader term
  let articles: DEVArticle[] = [];
  for (const t of [tag, broad, "ai"]) {
    try {
      const res = await fetch(
        `https://dev.to/api/articles?tag=${encodeURIComponent(t)}&top=7&per_page=5`,
        { headers: { "User-Agent": "COMPILE/1.0" } },
      );
      if (res.ok) {
        const data = (await res.json()) as DEVArticle[];
        if (data.length) { articles = data; break; }
      }
    } catch { /* try next */ }
  }

  const real: Tutorial[] = articles.slice(0, 4).map((a): Tutorial => ({
    title:         a.title,
    author:        a.user?.name ?? a.user?.username ?? "Unknown",
    platform:      "DEV.to",
    url:           a.url,
    tags:          a.tag_list ?? [],
    published:     a.published_at?.slice(0, 10) ?? "",
    read_time_min: a.reading_time_minutes,
  }));

  // Wire-ready YouTube mocks (same shape, swappable with Wire YouTube action)
  const ytMocks: Tutorial[] = [
    {
      title:    `${topic} — Complete Beginner's Guide`,
      author:   "Andrej Karpathy",
      platform: "YouTube",
      url:      "https://youtube.com",
      tags:     [topic.split(" ")[0].toLowerCase()],
      published: new Date().toISOString().slice(0, 10),
      views:    142000,
    },
    {
      title:    `Building with ${topic} from Scratch`,
      author:   "Fireship",
      platform: "YouTube",
      url:      "https://youtube.com",
      tags:     ["tutorial", "code"],
      published: new Date().toISOString().slice(0, 10),
      views:    89000,
    },
  ];

  return [...real, ...ytMocks].slice(0, 5);
}

interface DEVArticle {
  title: string; url: string; tag_list: string[];
  published_at: string; reading_time_minutes: number;
  user?: { name?: string; username?: string };
}
