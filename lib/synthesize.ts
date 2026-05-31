// Reconcile all source results into one executable knowledge artifact.
// Groq-driven; deterministic template fallback so the demo always lands.

import type {
  Intent, NodeResult, Synthesis, RoadmapPhase, ProjectIdea, Recommendation, EcosystemRisk,
  Paper, Repo, Tutorial, Discussion, TrendData, ContextData, CompileMetrics,
} from "./types";
import { resolveEntities } from "./entities";

const GROQ_KEY   = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

const PROFILE_SYNTHESIS: Record<string, string> = {
  // ── LEARN ───────────────────────────────────────────────────
  fundamentals:
    "LEARNING PROFILE: FUNDAMENTALS. Frame for zero prior knowledge.\n" +
    "• Heavily weight: documentation quality, beginner onboarding, tutorial density, community support, error message clarity.\n" +
    "• Projects: toy problems achievable in hours, not production systems.\n" +
    "• Insights must cover: biggest beginner traps, best free resources, time to first working prototype.\n" +
    "• Roadmap phases: CONCEPTUAL FOUNDATION → GUIDED PRACTICE → INDEPENDENT PROJECTS → SOLID BASELINE.",
  practical:
    "LEARNING PROFILE: PRACTICAL. Frame for a learn-by-doing practitioner.\n" +
    "• Weight: real-world project examples, production patterns, deployment ease, framework maturity.\n" +
    "• Projects: deployable apps, not toy examples.\n" +
    "• Insights must cover: beginner-to-production gaps, best project structure, deployment patterns.\n" +
    "• Roadmap phases: QUICK START → FIRST REAL PROJECT → PRODUCTION DEPLOYMENT → ITERATIVE MASTERY.",
  "deep-theory":
    "LEARNING PROFILE: DEEP THEORY. Frame for mathematical/architectural depth.\n" +
    "• Weight: academic papers, architecture internals, algorithmic complexity, mathematical rigor — theory over shortcuts.\n" +
    "• Projects: implementations of theoretical concepts, paper reproductions.\n" +
    "• Insights: key papers to read, where theory diverges from practice, architectural tradeoffs.\n" +
    "• Roadmap phases: MATHEMATICAL FOUNDATIONS → THEORETICAL ARCHITECTURE → ADVANCED INTERNALS → RESEARCH FRONTIER.",
  "fast-track":
    "LEARNING PROFILE: FAST-TRACK. Frame for competence in days, not months.\n" +
    "• Weight: shortest path to working knowledge, essential APIs only, skip heavy theory.\n" +
    "• Projects: achievable in 1–3 days maximum.\n" +
    "• Insights must be time-boxed: what to skip entirely, what to defer, what is absolutely non-negotiable.\n" +
    "• Roadmap phases: ESSENTIALS ONLY (day 1) → WORKING PROTOTYPE (day 3) → PRODUCTION CAPABLE (week 1) → GAPS IDENTIFIED.",
  "full-mastery":
    "LEARNING PROFILE: FULL MASTERY. Frame for comprehensive expertise.\n" +
    "• Cover everything: foundations, advanced patterns, edge cases, performance optimisation, contribution pathways.\n" +
    "• Projects grow in complexity towards open-source contribution.\n" +
    "• Insights: expert-level tradeoffs, where the community gets it wrong, path from competent to authoritative.\n" +
    "• Roadmap phases: COMPREHENSIVE FOUNDATIONS → ADVANCED PATTERNS → EXPERT OPTIMISATION → COMMUNITY CONTRIBUTION.",

  // ── BUILD ───────────────────────────────────────────────────
  mvp:
    "BUILD PROFILE: MVP. Frame for shipping a minimum viable product fast.\n" +
    "• Python and JavaScript/TypeScript dominate. Recommend managed services, hosted solutions.\n" +
    "• Cost at zero scale, time-to-first-deploy, and DX matter MORE than performance. Explicitly discourage premature optimisation.\n" +
    "• Projects: things deployable in a weekend.\n" +
    "• Roadmap phases: STACK DECISION (day 1) → CORE LOOP (week 1) → MVP LAUNCH → ITERATION.",
  production:
    "BUILD PROFILE: PRODUCTION-GRADE. Frame for reliable, observable systems.\n" +
    "• Go and Rust rise significantly vs Python. Reliability, observability, error handling are primary.\n" +
    "• Weight: deployment infra, monitoring/alerting, CI/CD, error budgets, on-call readiness, rollback strategy.\n" +
    "• Roadmap phases: ARCHITECTURE DESIGN → CORE IMPLEMENTATION → PRODUCTION HARDENING → OPERATIONAL EXCELLENCE.",
  scalable:
    "BUILD PROFILE: SCALABLE SYSTEMS. Frame for 10x–100x growth beyond current load.\n" +
    "• Distributed systems thinking. Go/Rust rise for performance-critical paths. Database scaling patterns are critical.\n" +
    "• Weight: horizontal scaling, distributed consistency, caching strategies, load testing, cost at scale.\n" +
    "• Roadmap phases: SCALABILITY AUDIT → DISTRIBUTED ARCHITECTURE → LOAD TESTING → SCALE OPERATIONS.",
  "solo-dev":
    "BUILD PROFILE: SOLO DEV. Frame for a single developer building alone.\n" +
    "• Developer experience (DX) is the PRIMARY weight. Opinionated frameworks, managed services, minimal ops burden.\n" +
    "• Avoid: complex infra, distributed systems, multi-team patterns. Optimise for: one person can understand and maintain this.\n" +
    "• Roadmap phases: FASTEST PATH TO VALUE → SOLO-FRIENDLY STACK → AUTOMATE OPS → SUSTAINABLE MAINTENANCE.",
  enterprise:
    "BUILD PROFILE: ENTERPRISE. Frame for adoption within a large organisation.\n" +
    "• Java, Go, C# rise vs Python/Node. Security, compliance (SOC2/GDPR/HIPAA), vendor support, stability over novelty.\n" +
    "• Weight: enterprise tool integration, procurement-friendly licensing, long-term maintenance, security posture.\n" +
    "• Roadmap phases: SECURITY & COMPLIANCE REVIEW → ENTERPRISE INTEGRATION → APPROVAL & PROCUREMENT → LONG-TERM MAINTENANCE.",

  // ── CAREER ──────────────────────────────────────────────────
  faang:
    "CAREER PROFILE: FAANG / BIG TECH. Frame for landing at Google, Meta, Amazon, Apple, Microsoft, Netflix.\n" +
    "• Weight: LeetCode/interview ecosystem, DSA relevance, system design interview patterns, top-tier market demand, compensation benchmarks.\n" +
    "• What these companies actually use in production vs what they interview on — name the gap.\n" +
    "• Roadmap phases: INTERVIEW FUNDAMENTALS → CODING PATTERN MASTERY → SYSTEM DESIGN → BEHAVIOURAL + OFFER.",
  startup:
    "CAREER PROFILE: STARTUP CAREER. Frame for roles at high-growth startups (Series A–C).\n" +
    "• Python and TypeScript dominate. Full-stack versatility, shipping speed, generalist over specialist.\n" +
    "• Weight: equity value signals, Series A/B startup demand, startup stack adoption, fast iteration patterns.\n" +
    "• Roadmap phases: FULL-STACK FOUNDATIONS → STARTUP STACK MASTERY → SHIPPING VELOCITY → STARTUP JOB SEARCH.",
  research:
    "CAREER PROFILE: RESEARCH ENGINEER. Frame for roles at AI labs and academia.\n" +
    "• Python/PyTorch/JAX dominate. Weight: academic lab adoption, paper implementation skills, ML engineering patterns.\n" +
    "• Research engineer roles at DeepMind, Anthropic, OpenAI, Meta AI — what they hire for vs what academia trains.\n" +
    "• Roadmap phases: RESEARCH ENGINEERING FOUNDATIONS → PAPER IMPLEMENTATION → LAB SKILLS → RESEARCH CAREER PATH.",
  freelance:
    "CAREER PROFILE: FREELANCE / CONSULTING. Frame for independent contract work.\n" +
    "• Client-facing technologies matter most: React, Node, Python. Weight: hourly rate premium by technology.\n" +
    "• Portfolio building, high-demand client verticals, proposal writing, retainer vs project-based models.\n" +
    "• Roadmap phases: MARKETABLE SKILL STACK → PORTFOLIO BUILD → CLIENT ACQUISITION → CONSULTING RATE OPTIMISATION.",
  quant:
    "CAREER PROFILE: QUANTITATIVE FINANCE / TRADING TECH. Frame for quant roles.\n" +
    "• C++ dominates for HFT and systematic trading. Python for strategy development and backtesting. Julia gaining ground.\n" +
    "• Weight: low-latency performance, numerical computing, financial data APIs, backtesting frameworks.\n" +
    "• Roadmap phases: QUANT FUNDAMENTALS → NUMERICAL IMPLEMENTATION → TRADING INFRASTRUCTURE → QUANT CAREER PATH.",
  infra:
    "CAREER PROFILE: INFRASTRUCTURE / PLATFORM ENGINEERING. Frame for infra/SRE/DevOps roles.\n" +
    "• Go and Rust dominate. Systems programming, Kubernetes, observability tooling, distributed systems.\n" +
    "• Weight: DevOps/SRE patterns, cloud certifications, container ecosystem, platform engineering principles.\n" +
    "• Roadmap phases: SYSTEMS FOUNDATIONS → INFRA TOOLING → CLOUD & CONTAINERS → PLATFORM ENGINEERING CAREER.",

  // ── RESEARCH ────────────────────────────────────────────────
  papers:
    "RESEARCH PROFILE: PAPER SURVEY. Frame for academic literature review.\n" +
    "• Weight: arXiv velocity, key survey papers, citation networks, seminal works, conference venues (NeurIPS/ICML/ICLR/ACL/CVPR).\n" +
    "• Insights: paper-reading strategies, reference management, identifying gaps, survey vs original research.\n" +
    "• Roadmap phases: LITERATURE SURVEY → DEEP PAPER READING → CITATION NETWORK MAPPING → RESEARCH SYNTHESIS.",
  implementation:
    "RESEARCH PROFILE: RESEARCH IMPLEMENTATION. Frame for reproducing and building on papers.\n" +
    "• Weight: reproducibility signals, GitHub stars on paper implementations, PyTorch/JAX dominance, repo quality.\n" +
    "• Insights: common reproducibility failures, ablation study design, how to extend baseline implementations.\n" +
    "• Roadmap phases: IMPLEMENTATION BASELINE → PAPER REPRODUCTION → ABLATION STUDY → IMPROVED IMPLEMENTATION.",
  frontier:
    "RESEARCH PROFILE: FRONTIER. Frame for cutting-edge pre-publication research.\n" +
    "• arXiv preprint velocity is the primary signal. Lab adoption (DeepMind/Anthropic/OpenAI/Meta AI) matters most.\n" +
    "• Weight: novelty signal, breakthrough detection, emerging technique identification, conference deadlines.\n" +
    "• Roadmap phases: FRONTIER SURVEY → EMERGING TECHNIQUE MASTERY → NOVEL CONTRIBUTION DESIGN → SUBMISSION.",
  academic:
    "RESEARCH PROFILE: ACADEMIC / PhD. Frame for university research context.\n" +
    "• Weight: publication venues, advisor/lab prestige, thesis positioning, grant funding patterns, academic job market.\n" +
    "• Insights: PhD vs industry researcher path, how to pick an advisor, publication strategy for tenure-track.\n" +
    "• Roadmap phases: ACADEMIC FOUNDATIONS → LITERATURE MASTERY → ORIGINAL CONTRIBUTION → PUBLICATION & THESIS DEFENCE.",
  "open-source":
    "RESEARCH PROFILE: OPEN-SOURCE CONTRIBUTION. Frame for contributing to research codebases.\n" +
    "• Weight: repository maturity, contribution pathways, community health, maintainer responsiveness, PR merge rates.\n" +
    "• Insights: how to find good first issues, code review culture in research repos, building maintainer trust.\n" +
    "• Roadmap phases: CODEBASE UNDERSTANDING → FIRST CONTRIBUTION → FEATURE DEVELOPMENT → MAINTAINER ROLE.",
};

// Legacy startup map (keep for backwards compat)
const STARTUP_SYNTHESIS: Record<string, string> = {
  ai:
    "The user is building an AI STARTUP. Frame all conclusions through a technical founder's lens:\n" +
    "• Model differentiation vs commodity API wrappers — what creates a defensible moat?\n" +
    "• Inference cost structure and compute scaling — what breaks unit economics at scale?\n" +
    "• Data flywheel mechanics — how does proprietary data compound against incumbents?\n" +
    "• B2B vs consumer go-to-market split — where is the near-term revenue?\n" +
    "• Competitive dynamics vs OpenAI/Anthropic/Google — where is the viable attack surface?\n" +
    "• YC/a16z AI vertical investment signals — what is the funded consensus?\n" +
    "Replace roadmap phase titles with: DEFENSIBILITY AUDIT, BUILD THE MOAT, MARKET INSERTION, RAISE SIGNAL.",
  infra:
    "The user is building an INFRASTRUCTURE STARTUP. Frame conclusions for a developer-tools founder:\n" +
    "• OSS-to-enterprise flywheel — where does community adoption convert to revenue?\n" +
    "• Developer experience as the primary acquisition channel — what reduces friction to zero?\n" +
    "• Hashicorp/Datadog/Vercel competitive surface — where does the wedge exist?\n" +
    "• Infrastructure YC cohort signals and recent Series A patterns in this space.\n" +
    "• Horizontal vs vertical platform risk — build wide or go deep?\n" +
    "Replace roadmap phase titles with: OSS WEDGE, COMMUNITY FLYWHEEL, ENTERPRISE MOTION, SERIES A SIGNAL.",
  systems:
    "The user is building a SYSTEMS STARTUP. Frame for a low-level/hardware-adjacent founder:\n" +
    "• Latency and reliability as the primary competitive moat — what is the measurable edge?\n" +
    "• Systems programmer hiring pool — what is the realistic team composition?\n" +
    "• Hardware constraint mapping — where does the software/hardware boundary create leverage?\n" +
    "• Safety and correctness guarantees as enterprise differentiator.\n" +
    "• Benchmarks and customer proof points — what constitutes credible validation?\n" +
    "Replace roadmap phase titles with: SYSTEMS BASELINE, PERFORMANCE MOAT, ENTERPRISE PROOF, SCALE SIGNAL.",
  research:
    "The user is building a RESEARCH STARTUP. Frame for an academic-founder spinning out:\n" +
    "• Paper-to-product distance — how many engineering months between publication and deployable system?\n" +
    "• Publication velocity as defensibility — does continued research compound the moat?\n" +
    "• PhD team composition vs engineering hires — what is the right ratio at seed?\n" +
    "• Research lab competitive dynamics — DeepMind/FAIR/MSR proximity risk?\n" +
    "• Grant funding vs venture — what is the right capital strategy for this research domain?\n" +
    "Replace roadmap phase titles with: RESEARCH BASELINE, PUBLICATION MOAT, FIRST PROTOTYPE, COMMERCIALISATION PATH.",
  fintech:
    "The user is building a FINTECH STARTUP. Frame for a financial-infrastructure founder:\n" +
    "• Regulatory moat — does compliance complexity create a barrier or an obstacle?\n" +
    "• Payment rail choices — Stripe vs direct card network access vs banking-as-a-service providers.\n" +
    "• Compliance cost surface — KYC/AML/PCI-DSS — what is the minimum viable compliance stack?\n" +
    "• Data network effects — how does transaction volume create compounding intelligence advantage?\n" +
    "• Incumbent disruption vector — where are the banks most exposed?\n" +
    "• Sequoia/a16z fintech and recent YC fintech cohort investment signals.\n" +
    "Replace roadmap phase titles with: REGULATORY AUDIT, COMPLIANCE STACK, PAYMENT INFRASTRUCTURE, GTM & LICENSING.",
};

export async function synthesize(
  intent: Intent,
  results: Record<string, NodeResult>,
  metrics: CompileMetrics,
): Promise<Synthesis> {
  const facts    = extractFacts(intent, results, metrics);
  const strat    = strategicLayer(intent, facts, metrics);
  const fallback = { ...template(intent, facts), ...strat };
  if (!GROQ_KEY) return fallback;

  // Resolve active profile — goalProfile takes precedence, startupType is legacy alias
  const activeProfile = intent.goalProfile ?? intent.startupType;

  // Profile-specific synthesis layer
  let profileLayer = "";
  if (activeProfile && PROFILE_SYNTHESIS[activeProfile]) {
    profileLayer = `\n\n${PROFILE_SYNTHESIS[activeProfile]}`;
  } else if (intent.goal === "startup" && intent.startupType && STARTUP_SYNTHESIS[intent.startupType]) {
    profileLayer = `\n\nSTARTUP MODE — ${STARTUP_SYNTHESIS[intent.startupType]}`;
  }

  const startupLayer = profileLayer; // unified

  // Entity resolution context — prevents Groq from confusing MCP, RAG, etc.
  const { entityNotes } = resolveEntities(intent.raw ?? intent.topic);
  const entityLayer = entityNotes
    ? `\n\nENTITY RESOLUTION (treat these as canonical): ${entityNotes}. Use the full expansion in all analysis — never the abbreviation alone.`
    : "";

  const startupVerdictFmt = intent.goal === "startup"
    ? "verdict field in recommendation must use startup framing: 'STRONG BET · BUILD', 'BET · COMMIT', 'CONDITIONAL BET · VALIDATE FIRST', 'NO-BET · WAIT'. Never use plain LEARN/CAREER."
    : "";

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
              `CRITICAL TIMELINE RULES — roadmap 'duration' MUST match the overall timeframe '${intent.timeframe}':\n` +
              "- timeframe 'weekend' → durations: 'Day 1 — morning', 'Day 1 — afternoon', 'Day 2', 'Weekend wrap'\n" +
              "- timeframe '1 week' → durations: 'Days 1–2', 'Days 3–4', 'Days 5–6', 'Day 7'\n" +
              "- timeframe '1 month' → durations: 'Week 1', 'Weeks 2–3', 'Week 4', 'Week 4 — Final'\n" +
              "- timeframe '3 months' → durations: 'Weeks 1–3', 'Weeks 4–6', 'Weeks 7–9', 'Weeks 10–12'\n" +
              "NEVER write '1 day' or '2 days' inside a 3-month roadmap. NEVER write 'Week 8' inside a 1-week roadmap. Match the scale.\n\n" +
              "roadmap: array of 4 {phase:int, title:string, duration:string, objectives:string[3], resources:string[1-2]},\n" +
              "projects: array of 3 {title:string, difficulty:1|2|3, why:string} ordered easy->hard,\n" +
              "insights: string[3] — each a HIGH-CONVICTION, NON-OBVIOUS conclusion. Name a specific tradeoff, a concrete production-friction point, " +
              "or a preferred architectural alternative drawn from the community signals. No platitudes, no generic study advice.\n" +
              "trend_note: string (one institutional sentence on market durability / commercial viability, referencing venture or adoption signal).\n\n" +
              "TONE: strategic, precise, institutional, high-agency, research-grade — like a Palantir/Bloomberg analyst brief. The reader must feel EMPOWERED, not educated.\n" +
              "BANNED PHRASES: 'here are some resources', 'you may want to', 'this could help', 'I think', 'consider', 'in conclusion', 'dive in', 'happy learning'.\n" +
              "REQUIRED STYLE example: 'Rust demonstrates sustained infrastructure acceleration driven by concurrent increases in systems-level startup adoption, repository velocity, and high-trust backend tooling migration — but its borrow-checker learning curve remains the dominant onboarding friction cited across practitioner channels.'\n" +
              (startupVerdictFmt ? startupVerdictFmt + "\n" : "") +
              (intent.domain && intent.domain !== "general-programming"
                ? `\nDOMAIN LOCK: This query is classified as '${intent.domain.toUpperCase()}'. ALL repos, papers, and tools cited must belong to this domain. Reject off-domain results even if popular.\n`
                : "") +
              entityLayer +
              startupLayer,
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
      ...strat,
    };
  } catch {
    return fallback;
  }
}

// Deterministic strategic cognition — recommendation + risk matrix from real
// signals. Always present (no LLM dependency), always defensible.
function strategicLayer(intent: Intent, f: ReturnType<typeof extractFacts>, m: CompileMetrics): { recommendation: Recommendation; risks: EcosystemRisk[] } {
  const bv = (key: string) => m.breakdown.find((x) => x.label.toLowerCase().includes(key))?.value ?? 50;
  const action = ({ learn: "LEARN", build: "BUILD", career: "COMMIT", research: "INVESTIGATE", startup: "BET" } as Record<string, string>)[intent.goal] ?? "LEARN";
  const conviction: "HIGH" | "MODERATE" | "LOW" =
    m.trajectory === "declining" ? "LOW" : m.field_velocity >= 70 ? "HIGH" : m.field_velocity >= 45 ? "MODERATE" : "LOW";
  const verdict = m.trajectory === "declining" ? `DEPRIORITISE · ${action}` : `${conviction} CONVICTION · ${action}`;

  const stars = f.top_repos[0]?.stars ?? 0;
  const reasoning = [
    `Repository gravity ${stars >= 20000 ? "strong" : stars >= 5000 ? "moderate" : "early-stage"} — lead implementation ${f.top_repos[0]?.name ?? "n/a"} at ${stars.toLocaleString()} stars.`,
    `Research cadence ${bv("arxiv") >= 55 ? "active" : "maturing"} (${bv("arxiv")}/100); commit velocity ${bv("commit") >= 55 ? "high" : "intermittent"} (${bv("commit")}/100).`,
    `${m.trajectory.toUpperCase()} trajectory reconciled at ${m.confidence}% cross-source agreement — ${m.sources_ok}/${m.sources_queried} signals locked.`,
  ];

  const sev = (n: number, hi: number, mid: number): "low" | "medium" | "high" => (n >= hi ? "low" : n >= mid ? "medium" : "high");
  const risks: EcosystemRisk[] = [
    { category: "Production Stability", severity: sev(bv("commit"), 60, 30), note: bv("commit") >= 60 ? "Active commit cadence across lead repositories." : "Maintenance signal intermittent — verify repo liveness before adoption." },
    { category: "Community Consensus", severity: sev(m.confidence, 70, 45), note: m.confidence >= 70 ? "Multi-source agreement is high and consistent." : "Cross-source signal is fragmented — treat conclusions as provisional." },
    { category: "Tooling Volatility", severity: m.field_velocity >= 76 ? "high" : m.trajectory === "rising" ? "medium" : "low", note: m.field_velocity >= 76 ? "Explosive growth — orchestration patterns shift rapidly." : m.trajectory === "rising" ? "Standards still consolidating; expect churn." : "Mature, stable tooling surface." },
  ];

  return { recommendation: { verdict, conviction, confidence: m.confidence, reasoning }, risks };
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
    topic: intent.topic, level: intent.level, goal: intent.goal, timeframe: intent.timeframe, domain: intent.domain, precision: intent.precision,
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

// Realistic phase durations matched to overall timeframe
function phaseTimeline(timeframe: string): [string, string, string, string] {
  const tf = (timeframe ?? "").toLowerCase();
  if (tf === "weekend")  return ["Day 1 — morning",  "Day 1 — afternoon", "Day 2",         "Weekend wrap"];
  if (tf === "1 week")   return ["Days 1–2",          "Days 3–4",          "Days 5–6",      "Day 7"];
  if (tf === "3 months") return ["Weeks 1–3",         "Weeks 4–6",         "Weeks 7–9",     "Weeks 10–12"];
  return                         ["Week 1",            "Weeks 2–3",         "Week 4",        "Week 4 — Final"];
}

function template(intent: Intent, f: ReturnType<typeof extractFacts>): Synthesis {
  const t  = intent.topic;
  const r0 = f.top_repos[0]?.name ?? "the top repo";
  const r1 = f.top_repos[1]?.name ?? "a starter repo";
  const tut   = f.top_tutorials[0]?.title ?? "a hands-on tutorial";
  const paper = f.top_papers[0]?.title?.slice(0, 48) ?? "a key paper";
  const [d1, d2, d3, d4] = phaseTimeline(intent.timeframe);

  const roadmap: RoadmapPhase[] = [
    { phase: 1, title: "Foundations",   duration: d1, objectives: [`Grasp the core ideas behind ${t}`, "Read the overview + skim 2 paper abstracts", "Set up your environment"], resources: [r0, tut] },
    { phase: 2, title: "Hands-on",      duration: d2, objectives: [`Clone and run ${r0}`, "Follow a build-along tutorial", "Ship a working prototype"], resources: [r1] },
    { phase: 3, title: "Depth",         duration: d3, objectives: [`Read "${paper}"`, "Engage with the community threads", "Map your remaining gaps"], resources: [paper] },
    { phase: 4, title: "Build & ship",  duration: d4, objectives: ["Finish your project", "Write it up", "Share for feedback"], resources: ["DEV.to", "GitHub"] },
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
