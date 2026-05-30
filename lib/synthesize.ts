// Reconcile all source results into one executable knowledge artifact.
// Groq-driven; deterministic template fallback so the demo always lands.

import type {
  Intent, NodeResult, Synthesis, RoadmapPhase, ProjectIdea,
  Paper, Repo, Tutorial, Discussion, TrendData, ContextData, CompileMetrics,
} from "./types";

const GROQ_KEY   = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export async function synthesize(
  intent: Intent,
  results: Record<string, NodeResult>,
  metrics: CompileMetrics,
): Promise<Synthesis> {
  const facts    = extractFacts(intent, results, metrics);
  const fallback = template(intent, facts);
  if (!GROQ_KEY) return fallback;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.55,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are COMPILE, an autonomous research compiler. Given a learning intent and LIVE source data, " +
              "output STRICT JSON (only the JSON) with these exact fields:\n" +
              "headline: string (<=11 words, decisive, cinematic — a verdict on this knowledge plan),\n" +
              "summary: string (2-3 sentences: what the topic is + the current state of the field + why it matters now; use the real numbers),\n" +
              "roadmap: array of 3-4 {phase:int, title:string, duration:string, objectives:string[3], resources:string[1-2]} — a concrete plan scaled to the timeframe,\n" +
              "projects: array of 3 {title:string, difficulty:1|2|3, why:string} ordered easy->hard,\n" +
              "insights: string[3] — real takeaways grounded in the community discussions and trend data,\n" +
              "trend_note: string (one sentence on career/research demand).\n" +
              "Cite actual repos/papers/tools from the facts. Be specific. No hedging, no 'consider'.",
          },
          { role: "user", content: JSON.stringify({ intent, facts }, null, 2) },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const p = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as Partial<Synthesis>;

    return {
      headline:   p.headline   || fallback.headline,
      summary:    p.summary    || fallback.summary,
      roadmap:    Array.isArray(p.roadmap)  && p.roadmap.length  ? p.roadmap  : fallback.roadmap,
      projects:   Array.isArray(p.projects) && p.projects.length ? p.projects : fallback.projects,
      insights:   Array.isArray(p.insights) && p.insights.length ? p.insights : fallback.insights,
      trend_note: p.trend_note || fallback.trend_note,
    };
  } catch {
    return fallback;
  }
}

function extractFacts(intent: Intent, r: Record<string, NodeResult>, m: CompileMetrics) {
  const context   = r.context?.data    as ContextData  | undefined;
  const papers    = (r.papers?.data    as Paper[]       | undefined) ?? [];
  const repos     = (r.code?.data       as Repo[]        | undefined) ?? [];
  const tutorials = (r.tutorials?.data  as Tutorial[]    | undefined) ?? [];
  const community = (r.community?.data  as Discussion[]  | undefined) ?? [];
  const trends    = r.trends?.data      as TrendData     | undefined;

  return {
    topic: intent.topic, level: intent.level, goal: intent.goal, timeframe: intent.timeframe,
    field_velocity: m.field_velocity, trajectory: m.trajectory, artifacts_found: m.artifacts_found,
    context_summary: context?.summary,
    top_papers:    papers.slice(0, 3).map((p) => ({ title: p.title, year: p.year, authors: p.authors.slice(0, 2) })),
    top_repos:     repos.slice(0, 3).map((r) => ({ name: r.full_name, stars: r.stars, lang: r.language, desc: r.description })),
    top_tutorials: tutorials.slice(0, 2).map((t) => ({ title: t.title, platform: t.platform })),
    discussions:   community.slice(0, 4).map((d) => ({ title: d.title, source: d.source, score: d.score })),
    hot_tools:     trends?.hot_tools ?? [],
    yc_companies:  trends?.companies ?? [],
  };
}

function template(intent: Intent, f: ReturnType<typeof extractFacts>): Synthesis {
  const t = intent.topic;
  const r0 = f.top_repos[0]?.name ?? "the top repo";
  const r1 = f.top_repos[1]?.name ?? "a starter repo";
  const tut = f.top_tutorials[0]?.title ?? "a hands-on tutorial";
  const paper = f.top_papers[0]?.title?.slice(0, 48) ?? "a key paper";

  const roadmap: RoadmapPhase[] = [
    { phase: 1, title: "Foundations",        duration: "Week 1", objectives: [`Grasp the core ideas behind ${t}`, "Read the overview + skim 2 paper abstracts", "Set up your environment"], resources: [r0, tut] },
    { phase: 2, title: "Hands-on",           duration: "Week 2", objectives: [`Clone and run ${r0}`, "Follow a build-along tutorial", "Ship a tiny working prototype"], resources: [r1] },
    { phase: 3, title: "Depth",              duration: "Week 3", objectives: [`Read "${paper}"`, "Engage with the community threads", "Map your remaining gaps"], resources: [paper] },
    { phase: 4, title: "Build & share",      duration: "Week 4", objectives: ["Finish your project", "Write it up", "Share for feedback"], resources: ["DEV.to", "GitHub"] },
  ];

  const projects: ProjectIdea[] = [
    { title: `Minimal ${t} demo from scratch`,        difficulty: 1, why: "Forces you to understand the moving parts without a framework hiding them." },
    { title: `Reproduce a result from ${paper}`,       difficulty: 2, why: "Bridges theory and practice — the fastest way to truly learn." },
    { title: `Production-ready ${t} tool, open-sourced`, difficulty: 3, why: "A portfolio piece that proves depth and ships real value." },
  ];

  return {
    headline:   `${t}: ${f.field_velocity}/100 field velocity — ${f.trajectory}.`,
    summary:    `${f.context_summary ?? `${t} sits at the intersection of research and engineering.`} Compiled from ${f.artifacts_found} live artifacts across papers, repos, and community — here is your ${intent.timeframe} path.`,
    roadmap,
    projects,
    insights: [
      f.discussions[0]?.title ? `The community keeps returning to: "${f.discussions[0].title}".` : `Nail the fundamentals of ${t} before chasing advanced tricks.`,
      f.hot_tools.length ? `The tools that actually matter right now: ${f.hot_tools.join(", ")}.` : `Pick one tool and go deep before spreading wide.`,
      `Field signal is ${f.trajectory} — ${f.trajectory === "rising" ? "a great time to skill up here." : "stable, dependable demand."}`,
    ],
    trend_note: f.trajectory === "rising"
      ? `${t} has rapidly growing demand — YC names include ${f.yc_companies.join(", ")}.`
      : `${t} carries steady, reliable demand across the industry.`,
  };
}
