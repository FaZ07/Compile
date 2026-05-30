// LIVE — Hacker News (Algolia) + Reddit search. Both real; Reddit 403s degrade
// gracefully. Merged + ranked by score so the loudest signal floats to top.
import type { Discussion } from "../types";
import type { SourceAdapter, SourceContext } from "./index";

async function fetchCommunity({ topic }: SourceContext): Promise<{ data: Discussion[]; count: number }> {
  const [hn, reddit] = await Promise.allSettled([fetchHN(topic), fetchReddit(topic)]);
  const posts = [
    ...(hn.status     === "fulfilled" ? hn.value     : []),
    ...(reddit.status === "fulfilled" ? reddit.value : []),
  ].sort((a, b) => b.score - a.score).slice(0, 8);

  if (!posts.length && hn.status === "rejected") throw new Error("community sources unreachable");
  return { data: posts, count: posts.length };
}

async function fetchHN(topic: string): Promise<Discussion[]> {
  const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=5`,
    { headers: { "User-Agent": "COMPILE/2.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`HN ${res.status}`);
  const j = (await res.json()) as { hits?: HNHit[] };
  return (j.hits ?? []).filter((h) => h.title).slice(0, 4).map((h): Discussion => ({
    title:    h.title,
    source:   "HN",
    url:      h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    score:    h.points ?? 0,
    comments: h.num_comments ?? 0,
    snippet:  (h.story_text ?? "").replace(/<[^>]+>/g, "").slice(0, 150),
  }));
}

async function fetchReddit(topic: string): Promise<Discussion[]> {
  const res = await fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&sort=top&t=year&limit=5`,
    { headers: { "User-Agent": "COMPILE/2.0 (research compiler)" }, cache: "no-store" });
  if (!res.ok) return []; // graceful 403
  const j = (await res.json()) as { data?: { children?: { data: RedditPost }[] } };
  return (j.data?.children ?? []).slice(0, 4).map((c): Discussion => ({
    title:    c.data.title,
    source:   "Reddit",
    url:      `https://reddit.com${c.data.permalink}`,
    score:    c.data.score,
    comments: c.data.num_comments,
    snippet:  (c.data.selftext ?? "").replace(/\s+/g, " ").slice(0, 150),
  }));
}

interface HNHit { title: string; url?: string; objectID: string; points?: number; num_comments?: number; story_text?: string }
interface RedditPost { title: string; permalink: string; score: number; num_comments: number; selftext?: string }

export const communityAdapter: SourceAdapter = { id: "community", run: fetchCommunity };
