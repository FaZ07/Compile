// LIVE — GitHub repo search (no auth, 60 req/hr/IP). Ranked by stars.
import type { Repo } from "../types";
import type { SourceAdapter, SourceContext } from "./index";

async function fetchCode({ topic, level }: SourceContext): Promise<{ data: Repo[]; count: number }> {
  const hint = level === "beginner" ? " tutorial OR example OR awesome" : "";
  const q = encodeURIComponent(`${topic}${hint}`);
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=6`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "COMPILE/2.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const j = (await res.json()) as { items?: GHRepo[] };

  const now = Date.now();
  const repos = (j.items ?? []).slice(0, 5).map((r): Repo => ({
    name:        r.name,
    full_name:   r.full_name,
    description: r.description ?? "",
    stars:       r.stargazers_count,
    language:    r.language ?? "—",
    url:         r.html_url,
    topics:      (r.topics ?? []).slice(0, 4),
    updated:     r.pushed_at?.slice(0, 10) ?? "",
    pushed_days_ago: r.pushed_at ? Math.round((now - Date.parse(r.pushed_at)) / 86_400_000) : 999,
  }));

  return { data: repos, count: repos.length };
}

interface GHRepo {
  name: string; full_name: string; description: string | null;
  stargazers_count: number; language: string | null; html_url: string;
  topics?: string[]; pushed_at?: string;
}

export const codeAdapter: SourceAdapter = { id: "code", run: fetchCode };
