// THE FIELD VELOCITY ENGINE — deterministic strategic synthesis (no LLM cost).
// Reconciles live signals into a weighted 0-100 velocity, an ecosystem state,
// a confidence score, and a comparative breakdown. Per directive 4B / 4H / 4J.

import type {
  CompileMetrics, VelocityFactor, EcosystemState,
  NodeResult, Paper, Repo, Discussion, TrendData, Trajectory,
} from "./types";

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const logScore = (v: number, saturate: number) => clamp((Math.log10(v + 1) / Math.log10(saturate + 1)) * 100);

export function computeMetrics(results: Record<string, NodeResult>): CompileMetrics {
  const list = Object.values(results);
  const ok = list.filter((r) => r.ok);

  const papers    = (results.papers?.data    as Paper[]      | undefined) ?? [];
  const repos     = (results.code?.data       as Repo[]       | undefined) ?? [];
  const community = (results.community?.data   as Discussion[] | undefined) ?? [];
  const trends    = results.trends?.data       as TrendData    | undefined;
  const trajectory: Trajectory = trends?.trajectory ?? "stable";

  const yr = new Date().getFullYear();
  const hn     = community.filter((d) => d.source === "HN");
  const reddit = community.filter((d) => d.source === "Reddit");

  // ── seven normalized 0-100 signal factors ──────────────────────
  const maxStars = repos.reduce((m, r) => Math.max(m, r.stars), 0);
  const githubStarAcceleration = logScore(maxStars, 120_000);                       // 0.25

  const avgPush = repos.length ? repos.reduce((a, r) => a + r.pushed_days_ago, 0) / repos.length : 120;
  const githubCommitVelocity = clamp(100 - avgPush * 1.6);                          // 0.20  (fresh push = fast)

  const recentPapers = papers.filter((p) => p.year >= yr - 1).length;
  const arxivPublicationFrequency = papers.length
    ? clamp((recentPapers / papers.length) * 70 + logScore(papers.length, 6) * 0.3)
    : 35;                                                                          // 0.20

  const redditScore = reddit.reduce((a, d) => a + Math.max(0, d.score), 0);
  const redditDiscussionGrowth = logScore(redditScore, 4000);                      // 0.10

  const hnEngage = hn.reduce((a, d) => a + Math.max(0, d.score) + d.comments * 2, 0);
  const hackerNewsEngagement = logScore(hnEngage, 3000);                           // 0.10

  const ycStartupAdoption = trajectory === "rising" ? 90 : trajectory === "stable" ? 55 : 22;  // 0.10
  const productHuntMomentum = trajectory === "rising" ? 82 : trajectory === "stable" ? 50 : 18; // 0.05

  const breakdown: VelocityFactor[] = [
    { label: "GitHub star acceleration", value: Math.round(githubStarAcceleration), weight: 0.25 },
    { label: "Commit velocity",          value: Math.round(githubCommitVelocity),   weight: 0.20 },
    { label: "arXiv publication rate",   value: Math.round(arxivPublicationFrequency), weight: 0.20 },
    { label: "Reddit discussion growth", value: Math.round(redditDiscussionGrowth),  weight: 0.10 },
    { label: "Hacker News engagement",   value: Math.round(hackerNewsEngagement),    weight: 0.10 },
    { label: "YC startup adoption",      value: Math.round(ycStartupAdoption),       weight: 0.10 },
    { label: "Product Hunt momentum",    value: Math.round(productHuntMomentum),     weight: 0.05 },
  ];

  const field_velocity = Math.round(clamp(breakdown.reduce((a, f) => a + f.value * f.weight, 0)));
  const ecosystem_state: EcosystemState =
    field_velocity <= 25 ? "Dormant" : field_velocity <= 50 ? "Stable" : field_velocity <= 75 ? "Growing" : "Explosive";

  // ── confidence model (4H): source agreement · recency · density ─
  const agreement = (ok.length / Math.max(1, list.length)) * 100;
  const recencyConsistency = papers.length ? (recentPapers / papers.length) * 100 : 50;
  const discussionDensity = logScore(community.length * 18 + repos.length * 12, 160);
  const confidence = Math.round(clamp(agreement * 0.5 + recencyConsistency * 0.25 + discussionDensity * 0.25));
  const confidence_label =
    confidence >= 70 ? "MULTI-SOURCE CONSENSUS CONFIRMED" :
    confidence >= 45 ? "PARTIAL CONSENSUS — CORROBORATING" :
    "SIGNAL INSTABILITY DETECTED";

  return {
    sources_queried: list.length,
    sources_live: list.filter((r) => r.id !== "trends").length,
    sources_ok: ok.length,
    artifacts_found: list.reduce((a, r) => a + (r.count ?? 0), 0),
    total_latency_ms: list.reduce((a, r) => a + r.duration_ms, 0),
    fastest_ms: ok.length ? Math.min(...ok.map((r) => r.duration_ms)) : 0,
    field_velocity, trajectory, ecosystem_state, breakdown, confidence, confidence_label,
  };
}

/** Deterministic repo implementation score (directive 4E), 0-100. */
export function repoScore(r: Repo, maxStars: number): number {
  const starsNorm = maxStars ? (Math.log10(r.stars + 1) / Math.log10(maxStars + 1)) * 100 : 0;
  const recentCommit = clamp(100 - r.pushed_days_ago * 1.6);
  const breadth = clamp(r.topics.length * 18);          // proxy: documented surface
  const freshness = clamp(100 - r.pushed_days_ago * 0.8);
  return Math.round(clamp(starsNorm * 0.5 + recentCommit * 0.25 + breadth * 0.15 + freshness * 0.1));
}

export function normalize(value: number, all: number[]): number {
  const max = Math.max(...all, 1);
  return Math.max(0.05, value / max);
}

export function recencyLabel(days: number): string {
  if (days <= 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}
