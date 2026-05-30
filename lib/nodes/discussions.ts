// LIVE — HN via Algolia (real) + Reddit (real, graceful 403 fallback).
import type { DiscussionPost } from "../types";

export async function fetchDiscussions(topic: string): Promise<DiscussionPost[]> {
  const [hn, reddit] = await Promise.allSettled([fetchHN(topic), fetchReddit(topic)]);
  const posts: DiscussionPost[] = [
    ...(hn.status === "fulfilled" ? hn.value : []),
    ...(reddit.status === "fulfilled" ? reddit.value : []),
  ];
  return posts.sort((a, b) => b.score - a.score).slice(0, 8);
}

async function fetchHN(topic: string): Promise<DiscussionPost[]> {
  const q   = encodeURIComponent(topic);
  const url = `https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=5`;
  const res = await fetch(url, { headers: { "User-Agent": "COMPILE/1.0" } });
  if (!res.ok) throw new Error(`HN ${res.status}`);
  const data = (await res.json()) as { hits?: HNHit[] };
  return (data.hits ?? []).filter((h) => h.title).slice(0, 4).map((h): DiscussionPost => ({
    title:    h.title,
    source:   "HN",
    url:      h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    score:    h.points ?? 0,
    comments: h.num_comments ?? 0,
    snippet:  h.story_text ? h.story_text.replace(/<[^>]+>/g, "").slice(0, 160) : "",
  }));
}

async function fetchReddit(topic: string): Promise<DiscussionPost[]> {
  const q   = encodeURIComponent(topic);
  const url = `https://www.reddit.com/search.json?q=${q}&sort=top&t=month&limit=5`;
  const res = await fetch(url, {
    headers: { "User-Agent": "COMPILE/1.0 (research tool)" },
  });
  if (!res.ok) return []; // graceful 403 fallback
  const data = (await res.json()) as { data?: { children?: { data: RedditPost }[] } };
  return (data.data?.children ?? []).slice(0, 4).map((c): DiscussionPost => ({
    title:    c.data.title,
    source:   "Reddit",
    url:      `https://reddit.com${c.data.permalink}`,
    score:    c.data.score,
    comments: c.data.num_comments,
    snippet:  (c.data.selftext ?? "").slice(0, 160),
  }));
}

interface HNHit { title: string; url?: string; objectID: string; points?: number; num_comments?: number; story_text?: string }
interface RedditPost { title: string; permalink: string; score: number; num_comments: number; selftext?: string }
