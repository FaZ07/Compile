// LIVE — GitHub public search API (no auth, 60 req/hr).
import type { Repo } from "../types";

export async function fetchRepos(topic: string, level: string): Promise<Repo[]> {
  const qualifiers = level === "beginner" ? "topic:beginner-friendly" : "";
  const q   = encodeURIComponent(`${topic} ${qualifiers}`.trim());
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=6`;

  const res  = await fetch(url, {
    headers: {
      "Accept":     "application/vnd.github+json",
      "User-Agent": "COMPILE/1.0",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = (await res.json()) as { items?: GHRepo[] };

  return (data.items ?? []).slice(0, 5).map((r): Repo => ({
    name:        r.name,
    full_name:   r.full_name,
    description: r.description ?? "",
    stars:       r.stargazers_count,
    language:    r.language ?? "—",
    url:         r.html_url,
    topics:      (r.topics ?? []).slice(0, 4),
    updated:     r.updated_at?.slice(0, 10) ?? "",
  }));
}

interface GHRepo {
  name: string; full_name: string; description: string | null;
  stargazers_count: number; language: string | null; html_url: string;
  topics?: string[]; updated_at?: string;
}
