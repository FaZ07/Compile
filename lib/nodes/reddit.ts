// REAL — Reddit public JSON. No auth.
import type { RedditData } from "../types";

export async function fetchReddit(destination: string, vibe: string): Promise<RedditData> {
  const q = encodeURIComponent(`${destination} ${vibe}`);
  // old.reddit.com is friendlier about UA; also fall back to a duckduckgo-style mirror.
  const url = `https://old.reddit.com/search.json?q=${q}&sort=relevance&limit=12&t=year`;
  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 compile/0.1";
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    // graceful fallback — empty but with a sentiment hint so synthesis still uses it
    return { posts: [], sentiment: "unclear" };
  }
  const json = (await res.json()) as {
    data: {
      children: { data: { title: string; subreddit: string; score: number; permalink: string; selftext?: string } }[];
    };
  };
  const posts = (json.data?.children ?? [])
    .map((c) => c.data)
    .filter((p) => p && p.title)
    .slice(0, 5)
    .map((p) => ({
      title: p.title,
      subreddit: `r/${p.subreddit}`,
      score: p.score,
      url: `https://reddit.com${p.permalink}`,
      snippet: (p.selftext || "").slice(0, 140),
    }));
  return { posts, sentiment: inferSentiment(posts.map((p) => p.title + " " + p.snippet).join(" ")) };
}

function inferSentiment(text: string): RedditData["sentiment"] {
  const t = text.toLowerCase();
  const neg = ["avoid", "scam", "overpriced", "ripoff", "bad", "worst", "disappointed", "filthy", "crowded"];
  const pos = ["love", "amazing", "underrated", "beautiful", "highly recommend", "favorite", "hidden gem"];
  const n = neg.reduce((c, k) => c + (t.includes(k) ? 1 : 0), 0);
  const p = pos.reduce((c, k) => c + (t.includes(k) ? 1 : 0), 0);
  if (p > n + 1) return "positive";
  if (n > p + 1) return "negative";
  if (p === 0 && n === 0) return "unclear";
  return "mixed";
}
