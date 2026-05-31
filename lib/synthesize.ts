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
              "You are COMPILE — an autonomous internet intelligence compiler. You do not retrieve or summarise; " +
              "you reconcile fragmented public signals into executable strategic intelligence. " +
              "Given a query and LIVE reconciled signal data, output STRICT JSON (only the JSON) with exact fields:\n" +
              "headline: string (<=11 words, a decisive strategic verdict — institutional, not cute),\n" +
              "summary: string — EXACTLY 3 sentences of dense analytical synthesis: (1) what the field is and its current trajectory; " +
              "(2) durability verdict — production-grade infrastructure vs hype spike — justified with the Compile Score, confidence, and a named real repo; " +
              "(3) the strategic implication for the user's stated goal,\n" +
              "roadmap: array of 4 {phase:int, title:string, duration:string, objectives:string[3], resources:string[1-2]} — phases: Fundamentals, Ecosystem, Live Engineering, Career Optimization,\n" +
              "projects: array of 3 {title:string, difficulty:1|2|3, why:string} ordered easy->hard,\n" +
              "insights: string[3] — each a HIGH-CONVICTION, NON-OBVIOUS conclusion. Name a specific tradeoff, a concrete production-friction point, " +
              "or a preferred architectural alternative drawn from the community signals. No platitudes, no generic study advice.\n" +
              "trend_note: string (one institutional sentence on market durability / commercial viability, referencing venture or adoption signal).\n\n" +
              "TONE: strategic, precise, institutional, high-agency, research-grade — like a Palantir/Bloomberg analyst brief. The reader must feel EMPOWERED, not educated.\n" +
              "BANNED PHRASES: 'here are some resources', 'you may want to', 'this could help', 'I think', 'consider', 'in conclusion', 'dive in', 'happy learning'.\n" +
              "REQUIRED STYLE example: 'Rust demonstrates sustained infrastructure acceleration driven by concurrent increases in systems-level startup adoption, repository velocity, and high-trust backend tooling migration — but its borrow-checker learning curve remains the dominant onboarding friction cited across practitioner channels.'",
          },
          { role: "user", content: JSON.stringify({ intent, facts }, null, 2) },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const p = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;

    // Never trust the LLM's shape — coerce every field to its exact type.
    return {
      headline:   str(p.headline)   || fallback.headline,
      summary:    str(p.summary)    || fallback.summary,
      roadmap:    Array.isArray(p.roadmap)  && p.roadmap.length  ? p.roadmap.map(normPhase)    : fallback.roadmap,
      projects:   Array.isArray(p.projects) && p.projects.length ? p.projects.map(normProject) : fallback.projects,
      insights:   strArray(p.insights).length ? strArray(p.insights)                            : fallback.insights,
      trend_note: str(p.trend_note) || fallback.trend_note,
    };
  } catch {
    return fallback;
  }
}

// ── normalisers — guarantee the typed shape regardless of LLM drift ──
function str(v: unknown): string { return typeof v === "string" ? v : ""; }

function strArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => (typeof x === "string" ? x : str((x as { title?: string })?.title) || String(x))).filter(Boolean);
  }
  if (typeof v === "string") return v.split(/\n|·|•|;/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function normPhase(raw: unknown, i: number): RoadmapPhase {
  const p = (raw ?? {}) as Record<string, unknown>;
  return {
    phase:      typeof p.phase === "number" ? p.phase : i + 1,
    title:      str(p.title) || `Phase ${i + 1}`,
    duration:   str(p.duration) || `Week ${i + 1}`,
    objectives: strArray(p.objectives),
    resources:  strArray(p.resources),
  };
}

function normProject(raw: unknown): ProjectIdea {
  const p = (raw ?? {}) as Record<string, unknown>;
  const d = Number(p.difficulty);
  return {
    title:      str(p.title) || "Project",
    difficulty: (d === 1 || d === 2 || d === 3 ? d : 2) as 1 | 2 | 3,
    why:        str(p.why) || "",
  };
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
    ecosystem_state: m.ecosystem_state, confidence: m.confidence, confidence_label: m.confidence_label,
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

  const accel = f.trajectory === "rising" ? "sustained acceleration" : f.trajectory === "declining" ? "decelerating adoption" : "stable consolidation";
  const topStars = f.top_repos[0]?.stars ? `${f.top_repos[0].stars.toLocaleString()}-star ${f.top_repos[0].name}` : "open-source tooling";
  return {
    headline:   `${t}: ${f.ecosystem_state} ecosystem, ${f.field_velocity}/100 velocity.`,
    summary:    `${t} demonstrates ${accel} across ${f.artifacts_found} reconciled signals — repository gravity (${topStars}), publication cadence, and practitioner discourse converge on a ${f.confidence >= 70 ? "high-confidence" : "provisional"} intelligence profile. ${f.context_summary ? f.context_summary.slice(0, 160) : ""}`,
    roadmap,
    projects,
    insights: [
      f.discussions[0]?.title ? `Practitioner discourse concentrates on "${f.discussions[0].title}" — a leading indicator of where production friction and demand intersect.` : `${t} adoption is gated by fundamentals; depth precedes leverage in this ecosystem.`,
      f.hot_tools.length ? `Tooling consolidation favours ${f.hot_tools.join(", ")} — the migration surface where engineering effort compounds.` : `Tooling remains fragmented; early standardisation carries disproportionate strategic value.`,
      `Signal reconciliation reports ${f.trajectory} trajectory at ${f.confidence}% confidence — ${f.trajectory === "rising" ? "a durable acceleration window, not a hype spike." : f.trajectory === "declining" ? "pair with a modern successor to preserve relevance." : "mature infrastructure with dependable, non-speculative demand."}`,
    ],
    trend_note: f.trajectory === "rising"
      ? `Commercial viability is corroborated by venture placement (${f.yc_companies.join(", ")}) and accelerating repository velocity — durable, not speculative.`
      : `${t} represents stable, production-grade infrastructure with consistent enterprise demand.`,
  };
}
