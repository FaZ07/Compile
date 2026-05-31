// LIVE — GitHub repo search (no auth, 60 req/hr/IP). Domain-aware with semantic post-filtering.
import type { Repo } from "../types";
import type { SourceAdapter, SourceContext } from "./index";
import type { Domain } from "../types";

// Language qualifiers that improve signal quality per domain (safe GitHub syntax)
const DOMAIN_LANG: Partial<Record<Domain, string>> = {
  "ai-engineering":     " language:Python",
  "data-science":       " language:Python",
  "systems-programming":" language:Rust OR language:C++",
  "devops":             "",
  "web-development":    " language:TypeScript OR language:JavaScript",
};

// Additional safe keyword hints appended to query
const DOMAIN_KW: Partial<Record<Domain, string>> = {
  "interview-prep":     " algorithms data-structures",
  "ai-engineering":     " machine-learning",
  "web-development":    " web framework",
};

// Post-fetch exclusion: repos whose name+desc strongly signals a different domain
const DOMAIN_EXCLUSIONS: Partial<Record<Domain, RegExp>> = {
  "interview-prep":     /\b(framework|production|cloud|saas|deployment|infra)\b/i,
  "ai-engineering":     /\b(leetcode|interview.prep|data-struct(?:ure)?|competitive.prog)\b/i,
  "systems-programming":/\b(react|vue|angular|django|rails|express|frontend)\b/i,
};

async function fetchCode({ topic, level, domain }: SourceContext): Promise<{ data: Repo[]; count: number }> {
  const langHint = domain ? (DOMAIN_LANG[domain] ?? "") : "";
  const kwHint   = domain ? (DOMAIN_KW[domain] ?? "") : "";
  const lvlHint  = level === "beginner" ? " tutorial OR example" : "";

  // Keep the query simple and safe — GitHub search is finicky with complex qualifiers
  const rawQ = `${topic}${kwHint}${lvlHint}${langHint}`.trim();
  const q    = encodeURIComponent(rawQ);
  const url  = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=10`;

  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "COMPILE/2.0" },
    cache: "no-store",
  });

  // Fallback: if the complex query fails, retry with topic only
  let items: GHRepo[] = [];
  if (!res.ok) {
    const fallback = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(topic)}&sort=stars&order=desc&per_page=10`,
      { headers: { Accept: "application/vnd.github+json", "User-Agent": "COMPILE/2.0" }, cache: "no-store" },
    );
    if (!fallback.ok) throw new Error(`GitHub ${res.status}`);
    const fj = (await fallback.json()) as { items?: GHRepo[] };
    items = fj.items ?? [];
  } else {
    const j = (await res.json()) as { items?: GHRepo[] };
    items = j.items ?? [];
    // If domain query returned nothing, fall back to plain topic
    if (!items.length && (langHint || kwHint)) {
      const plain = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(topic)}&sort=stars&order=desc&per_page=10`,
        { headers: { Accept: "application/vnd.github+json", "User-Agent": "COMPILE/2.0" }, cache: "no-store" },
      );
      if (plain.ok) { const pj = (await plain.json()) as { items?: GHRepo[] }; items = pj.items ?? []; }
    }
  }

  const now = Date.now();
  const exclusion = domain ? DOMAIN_EXCLUSIONS[domain] : undefined;

  const repos = items
    .filter((r) => {
      if (!exclusion) return true;
      const corpus = `${r.name} ${r.description ?? ""} ${(r.topics ?? []).join(" ")}`;
      return !exclusion.test(corpus);
    })
    .slice(0, 6)
    .map((r): Repo => ({
      name:            r.name,
      full_name:       r.full_name,
      description:     r.description ?? "",
      stars:           r.stargazers_count,
      language:        r.language ?? "—",
      url:             r.html_url,
      topics:          (r.topics ?? []).slice(0, 5),
      updated:         r.pushed_at?.slice(0, 10) ?? "",
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
