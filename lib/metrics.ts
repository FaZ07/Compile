// THE FIELD VELOCITY ENGINE — deterministic strategic synthesis (no LLM cost).
// Reconciles live signals into a weighted 0-100 velocity, an ecosystem state,
// a confidence score, and a comparative breakdown. Per directive 4B / 4H / 4J.

import type {
  CompileMetrics, VelocityFactor, EcosystemState,
  NodeResult, Paper, Repo, Discussion, TrendData, Trajectory, Domain,
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

// ── Domain signal vocabulary for semantic relevance ──────────
const DOMAIN_SIGNALS: Partial<Record<Domain, string[]>> = {
  "ai-engineering":     ["ml","ai","neural","model","training","llm","transformer","deep","learning","embedding","vector","diffusion","rag","agent","inference","gpt","nlp","cv"],
  "web-development":    ["web","frontend","backend","react","vue","angular","next","node","html","css","javascript","typescript","api","rest","fullstack","svelte"],
  "systems-programming":["rust","cpp","c++","system","kernel","embedded","memory","concurrency","performance","compiler","wasm","low-level","allocator","simd"],
  "interview-prep":     ["leetcode","algorithm","data-structure","interview","competitive","dsa","coding-challenge","grind","arrays","graphs","trees"],
  "data-science":       ["pandas","numpy","sklearn","jupyter","statistics","analytics","visualization","data-science","matplotlib","scipy","seaborn"],
  "devops":             ["docker","kubernetes","k8s","terraform","ansible","helm","devops","cicd","monitoring","observability","prometheus","grafana"],
};

/** Semantic relevance of a repo to a topic + domain, 0–100. */
export function semanticRelevance(r: Repo, topic: string, domain?: Domain): number {
  const corpus = `${r.name} ${r.full_name} ${r.description ?? ""} ${r.topics.join(" ")}`.toLowerCase();

  // Topic word match ratio
  const topicWords = topic.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["the","and","for","how","with","using","into","from"].includes(w));
  const matchCount = topicWords.filter((w) => corpus.includes(w)).length;
  const matchRatio = topicWords.length ? matchCount / topicWords.length : 0.5;

  // Domain alignment bonus / penalty
  const signals = domain ? (DOMAIN_SIGNALS[domain] ?? []) : [];
  let domainScore = 0;
  if (signals.length > 0) {
    const domainMatches = signals.filter((s) => corpus.includes(s)).length;
    const ratio = domainMatches / signals.length;
    domainScore = ratio >= 0.15 ? ratio * 30 : -35; // penalty for clear off-domain repos
  }

  return clamp(Math.round(matchRatio * 70 + domainScore));
}

/** Repo implementation score: semantic relevance dominates (0.5 weight). */
export function repoScore(r: Repo, maxStars: number, topic?: string, domain?: Domain): number {
  const starsNorm  = maxStars ? (Math.log10(r.stars + 1) / Math.log10(maxStars + 1)) * 100 : 0;
  const activity   = clamp(100 - r.pushed_days_ago * 1.6);
  const breadth    = clamp(r.topics.length * 18);
  const freshness  = clamp(100 - r.pushed_days_ago * 0.8);
  const quality    = starsNorm * 0.4 + activity * 0.35 + breadth * 0.15 + freshness * 0.1;

  if (topic) {
    const relevance = semanticRelevance(r, topic, domain);
    // New weighting: semantic relevance 0.5 · activity 0.2 · quality 0.2 · popularity 0.1
    return Math.round(clamp(relevance * 0.5 + activity * 0.2 + quality * 0.2 + starsNorm * 0.1));
  }
  return Math.round(clamp(quality));
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
