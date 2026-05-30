import type { Intent, NodeResult, Synthesis, RoadmapPhase, Paper, Repo, Tutorial, DiscussionPost, TrendSignal, WikiData } from "./types";

const GROQ_KEY   = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export async function synthesize(intent: Intent, results: Record<string, NodeResult>): Promise<Synthesis> {
  const facts    = extractFacts(intent, results);
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
              "You are COMPILE — an autonomous research intelligence engine. Given a learning/research intent and live source data, " +
              "output STRICT JSON (no prose outside the JSON) with exactly these fields:\n" +
              "headline: string (≤12 words, decisive, cinematic — like a news headline for this knowledge plan),\n" +
              "summary: string (2-3 sentences: what the topic is, current state of the field, why it matters NOW),\n" +
              "roadmap: array of 3-4 objects {phase:number, title:string, duration:string, objectives:string[3], resources:string[2]} — concrete week-by-week plan,\n" +
              "projects: string[3] — project ideas ordered beginner→advanced,\n" +
              "insights: string[3] — key insights from community discussions (real pain points, tools that work, common mistakes),\n" +
              "trend: 'rising'|'stable'|'declining',\n" +
              "trend_note: string (one sentence on career/research demand).\n" +
              "Be specific, cite actual tools/papers/repos from the facts. No generic advice.",
          },
          {
            role: "user",
            content: JSON.stringify({ intent, facts }, null, 2),
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data   = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt    = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(txt) as Partial<Synthesis>;

    return {
      headline:   parsed.headline   || fallback.headline,
      summary:    parsed.summary    || fallback.summary,
      roadmap:    Array.isArray(parsed.roadmap)   && parsed.roadmap.length   ? parsed.roadmap   : fallback.roadmap,
      projects:   Array.isArray(parsed.projects)  && parsed.projects.length  ? parsed.projects  : fallback.projects,
      insights:   Array.isArray(parsed.insights)  && parsed.insights.length  ? parsed.insights  : fallback.insights,
      trend:      parsed.trend      || fallback.trend,
      trend_note: parsed.trend_note || fallback.trend_note,
    };
  } catch {
    return fallback;
  }
}

function extractFacts(intent: Intent, r: Record<string, NodeResult>) {
  const wiki        = r.wiki?.data        as WikiData       | undefined;
  const papers      = (r.papers?.data     as Paper[]        | undefined) ?? [];
  const repos       = (r.repos?.data      as Repo[]         | undefined) ?? [];
  const tutorials   = (r.tutorials?.data  as Tutorial[]     | undefined) ?? [];
  const discussions = (r.discussions?.data as DiscussionPost[] | undefined) ?? [];
  const trends      = r.trends?.data      as TrendSignal    | undefined;

  return {
    wiki_summary:    wiki?.summary,
    top_papers:      papers.slice(0, 3).map((p) => ({ title: p.title, authors: p.authors.slice(0, 2), year: p.year, url: p.url })),
    top_repos:       repos.slice(0, 3).map((r) => ({ name: r.full_name, stars: r.stars, language: r.language, description: r.description })),
    top_tutorials:   tutorials.slice(0, 3).map((t) => ({ title: t.title, platform: t.platform, author: t.author })),
    top_discussions: discussions.slice(0, 4).map((d) => ({ title: d.title, source: d.source, score: d.score, snippet: d.snippet })),
    trend:           trends?.trajectory ?? "stable",
    trend_note:      trends?.note ?? "",
    hot_tools:       trends?.hot_tools ?? [],
    yc_companies:    trends?.yc_companies ?? [],
    intent_topic:    intent.topic,
    intent_level:    intent.level,
    intent_goal:     intent.goal,
    intent_timeframe: intent.timeframe,
  };
}

function template(intent: Intent, f: ReturnType<typeof extractFacts>): Synthesis {
  const t = intent.topic;
  const roadmap: RoadmapPhase[] = [
    { phase: 1, title: "Foundations", duration: "Week 1", objectives: [`Understand core concepts of ${t}`, "Read Wikipedia overview + key paper abstracts", "Set up dev environment"], resources: [f.top_repos[0]?.name ?? "GitHub search", f.top_tutorials[0]?.title ?? "DEV.to guide"] },
    { phase: 2, title: "Core Implementation", duration: "Week 2", objectives: [`Clone and run top repos`, `Follow ${f.top_tutorials[0]?.platform ?? "DEV.to"} tutorial series`, "Build a minimal working prototype"], resources: [f.top_repos[1]?.name ?? "GitHub", f.top_tutorials[1]?.title ?? "YouTube tutorial"] },
    { phase: 3, title: "Deep Dive", duration: "Week 3", objectives: [`Read 2-3 arXiv papers on ${t}`, "Engage with Reddit/HN discussions", "Identify gaps in your understanding"], resources: [f.top_papers[0]?.title?.slice(0, 50) ?? "arXiv", f.top_discussions[0]?.title?.slice(0, 50) ?? "HN thread"] },
    { phase: 4, title: "Build & Share", duration: "Week 4", objectives: ["Complete your project", "Write a blog post or GitHub README", "Share with the community"], resources: ["DEV.to", "GitHub"] },
  ];

  return {
    headline:   `${t} — compiled from ${[f.top_papers.length, f.top_repos.length, f.top_tutorials.length].reduce((a, b) => a + b, 0)} live sources.`,
    summary:    `${f.wiki_summary ?? `${t} is an active area of study at the intersection of research and engineering.`} Based on ${f.top_repos.length} GitHub repos, ${f.top_papers.length} arXiv papers, and community discussions, this is your compiled learning path.`,
    roadmap,
    projects:   [`Build a minimal ${t} prototype from scratch`, `Reproduce results from the most-cited ${t} paper`, `Build a production-ready ${t} tool and open-source it`],
    insights:   [
      f.top_discussions[0]?.snippet || `The most common struggle with ${t} is getting the fundamentals right before jumping to advanced use cases.`,
      f.top_discussions[1]?.snippet || `Top tools in this space: ${f.hot_tools.join(", ") || "Python, PyTorch, Hugging Face"}.`,
      `Community sentiment: ${f.trend === "rising" ? "extremely bullish" : f.trend === "stable" ? "steady demand" : "shifting focus"} on ${t}.`,
    ],
    trend:      f.trend as "rising" | "stable" | "declining",
    trend_note: f.trend_note || `${t} has ${f.trend === "rising" ? "rapidly growing" : "consistent"} demand in the job market.`,
  };
}
