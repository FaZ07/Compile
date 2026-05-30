// The "analyze" brain. Turns raw source results into comparative, real-time
// metrics — most importantly Field Velocity (0-100): how fast this field moves.
// Fully deterministic so the same query yields the same defensible numbers.

import type { CompileMetrics, NodeResult, Paper, Repo, Discussion, TrendData, Trajectory } from "./types";

export function computeMetrics(results: Record<string, NodeResult>): CompileMetrics {
  const list = Object.values(results);
  const ok   = list.filter((r) => r.ok);

  const papers      = (results.papers?.data     as Paper[]      | undefined) ?? [];
  const repos       = (results.code?.data        as Repo[]       | undefined) ?? [];
  const community   = (results.community?.data    as Discussion[] | undefined) ?? [];
  const trends      = results.trends?.data        as TrendData    | undefined;

  const trajectory: Trajectory = trends?.trajectory ?? "stable";

  // ── Field Velocity: weighted, log-scaled, clamped 0-100 ──────────
  let v = 0;

  // 1. trajectory signal (max 38)
  v += trajectory === "rising" ? 38 : trajectory === "stable" ? 20 : 6;

  // 2. research recency (max 22) — share of papers from this/last year
  const yr = new Date().getFullYear();
  const recent = papers.filter((p) => p.year >= yr - 1).length;
  v += papers.length ? (recent / papers.length) * 22 : 8;

  // 3. code gravity (max 25) — log of the strongest repo's stars
  const maxStars = repos.reduce((m, r) => Math.max(m, r.stars), 0);
  v += Math.min(25, Math.log10(maxStars + 1) * 5); // ~100k stars saturates

  // 4. community heat (max 15) — log of total discussion score
  const heat = community.reduce((a, d) => a + Math.max(0, d.score), 0);
  v += Math.min(15, Math.log10(heat + 1) * 4);

  const field_velocity = Math.max(0, Math.min(100, Math.round(v)));

  return {
    sources_queried: list.length,
    sources_live:    list.filter((r) => r.id !== "trends").length,
    sources_ok:      ok.length,
    artifacts_found: list.reduce((a, r) => a + (r.count ?? 0), 0),
    total_latency_ms: list.reduce((a, r) => a + r.duration_ms, 0),
    fastest_ms:      ok.length ? Math.min(...ok.map((r) => r.duration_ms)) : 0,
    field_velocity,
    trajectory,
  };
}

/** Normalise a value within a list to 0-1 for comparison bars. */
export function normalize(value: number, all: number[]): number {
  const max = Math.max(...all, 1);
  return Math.max(0.05, value / max);
}

/** Human "x days ago" → friendly recency label. */
export function recencyLabel(days: number): string {
  if (days <= 1)  return "today";
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}
