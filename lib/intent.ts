// Parse a free-text learning goal into a typed Intent.
// Groq-driven, with a deterministic heuristic fallback so the demo never breaks.
// Explicit UI controls (level/goal/timeframe) always win over the parse.

import type { Intent, Level, Goal, StartupType, GoalProfile, Domain, IntentPrecision } from "./types";
import { resolveEntities } from "./entities";

const GROQ_KEY   = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export interface IntentOverrides {
  level?: Level;
  goal?: Goal;
  timeframe?: string;
  startupType?: StartupType;
  goalProfile?: GoalProfile;
}

const PROFILE_CONTEXT: Record<string, string> = {
  // learn
  fundamentals:  "FUNDAMENTALS learner — weight beginner onboarding, documentation quality, tutorial density, community support for beginners, error message clarity.",
  practical:     "PRACTICAL learner — weight real-world project examples, production patterns, deployment ease, framework maturity, learn-by-doing resources.",
  "deep-theory": "DEEP THEORY learner — weight academic papers, architecture internals, algorithmic foundations, mathematical rigor, theoretical depth over practical shortcuts.",
  "fast-track":  "FAST-TRACK learner — weight shortest path to working knowledge, essential APIs only, skip theory, rapid deployment patterns, achievable in days not months.",
  "full-mastery":"FULL MASTERY — comprehensive expertise, edge cases, performance optimisation, contribution pathways, expert-level depth.",
  // build
  mvp:           "MVP builder — Python/JS/TS dominated, managed services, hosted solutions, time-to-deploy prioritised, DX over performance, zero premature optimisation.",
  production:    "PRODUCTION builder — Go/Rust rise, reliability, observability, error budgets, CI/CD, on-call readiness, deployment infrastructure.",
  scalable:      "SCALABLE builder — distributed systems, horizontal scaling, database scaling, caching, load testing, Go/Rust for performance-critical paths.",
  "solo-dev":    "SOLO DEV builder — DX is primary, opinionated frameworks, managed services, minimal ops burden, strong documentation, single-engineer maintainability.",
  enterprise:    "ENTERPRISE builder — Java/Go/C# rise, security, compliance (SOC2/GDPR/HIPAA), vendor support, long-term maintenance, procurement-friendly licensing.",
  // career
  faang:         "FAANG career — interview ecosystem, LeetCode/HackerRank presence, DSA relevance, system design interview patterns, top-tier company market demand.",
  startup:       "STARTUP career — Python/TypeScript dominance, full-stack versatility, shipping speed, equity signals, Series A/B demand, generalist over specialist.",
  research:      "RESEARCH ENGINEER career — Python/PyTorch/JAX, academic lab adoption, paper implementation skills, top AI lab roles (DeepMind/Anthropic/OpenAI/Meta AI).",
  freelance:     "FREELANCE career — client-facing tech (React/Node/Python), hourly rate premium by technology, portfolio building, high-demand client verticals.",
  quant:         "QUANT career — C++ dominates for HFT/systematic trading, Python for strategy/backtesting, Julia gaining, numerical computing, financial data APIs, low latency.",
  infra:         "INFRA career — Go/Rust dominate, systems programming, Kubernetes, observability tooling, DevOps/SRE patterns, cloud provider certifications.",
  // research
  papers:        "PAPER RESEARCH — arXiv velocity, survey papers, citation networks, seminal works, conference venues (NeurIPS/ICML/ICLR/ACL/CVPR), literature review workflows.",
  implementation:"RESEARCH IMPLEMENTATION — reproducibility signals, GitHub stars on paper implementations, PyTorch/JAX, repo quality, community implementation maturity.",
  frontier:      "FRONTIER RESEARCH — arXiv preprint velocity, lab adoption (DeepMind/Anthropic/OpenAI/Meta AI), novelty signal, emerging technique detection, conference deadlines.",
  academic:      "ACADEMIC research — publication venues, advisor/lab prestige, thesis positioning, grant funding, academic job market, PhD program fit.",
  "open-source": "OPEN-SOURCE research — repository maturity, contribution pathways, community health, maintainer responsiveness, PR merge rates, first-contribution complexity.",
  // startup (existing)
  ai:            "AI startup — model differentiation, data moat, compute costs, B2B vs consumer split, OpenAI/Anthropic competitive surface, a16z/YC AI vertical signals.",
  systems:       "SYSTEMS startup — latency moat, hardware constraints, systems-level hiring difficulty, safety/reliability moat.",
  fintech:       "FINTECH startup — regulatory moat, payment rail choices, compliance surface, data network effects, KYC/AML, Sequoia/a16z fintech signals.",
};

export async function parseIntent(raw: string, ov: IntentOverrides = {}): Promise<Intent> {
  const profile = ov.goalProfile ?? (ov.startupType as GoalProfile | undefined);

  // ── Entity resolution first — expand acronyms, lock domain ──────────────
  const { expandedTopic, entityNotes, forcedDomain } = resolveEntities(raw);
  const domain    = forcedDomain ?? inferDomain(raw);
  const precision = inferPrecision(raw, domain);

  // Use expanded topic as the basis for heuristic (better search terms)
  const effectiveRaw = expandedTopic !== raw ? expandedTopic : raw;
  const fallback  = { ...heuristic(effectiveRaw, ov), domain, precision };
  if (!GROQ_KEY) return { ...fallback, goalProfile: profile, startupType: ov.startupType };

  const profileCtx  = profile ? `\n\nActive profile context: ${PROFILE_CONTEXT[profile] ?? profile}` : "";
  const entityCtx   = entityNotes ? `\n\nRESOLVED ENTITIES (use these exact expansions): ${entityNotes}` : "";

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You parse a goal into STRICT JSON (no prose). Fields: " +
              "topic (string — core subject, e.g. 'RAG systems', 'Rust ownership', concise and search-friendly), " +
              "level ('beginner'|'intermediate'|'advanced'), " +
              "goal ('learn'|'build'|'research'|'career'|'startup'), " +
              "timeframe ('weekend'|'1 week'|'1 month'|'3 months'), " +
              "focus (string[] from: 'theory','implementation','papers','projects','career','startup'). " +
              "Infer sensibly. For topic: use the canonical expanded form (not the abbreviation) so it is search-friendly." + profileCtx + entityCtx,
          },
          { role: "user", content: raw },
        ],
      }),
    });
    if (!res.ok) return { ...fallback, goalProfile: profile, startupType: ov.startupType };
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const p = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as Partial<Intent>;

    return {
      raw,
      topic:       (p.topic || fallback.topic).slice(0, 90),
      level:       ov.level     ?? (p.level as Level | undefined) ?? fallback.level,
      goal:        ov.goal      ?? (p.goal  as Goal  | undefined) ?? fallback.goal,
      timeframe:   ov.timeframe ?? p.timeframe ?? fallback.timeframe,
      focus:       Array.isArray(p.focus) && p.focus.length ? p.focus.slice(0, 5) : fallback.focus,
      goalProfile: profile,
      startupType: ov.startupType,
      domain,
      precision,
    };
  } catch {
    return { ...fallback, goalProfile: profile, startupType: ov.startupType, domain, precision };
  }
}

// ── Domain + precision inference ──────────────────────────────
function inferDomain(text: string): Domain {
  const t = text.toLowerCase();
  if (/\b(ml|ai|llm|rag|neural|deep.?learn|machine.?learn|vector|embedding|transformer|diffusion|gpt|bert|agent|nlp|computer.?vision|pytorch|tensorflow|hugging.?face|langchain|mcp|inference|fine.?tun)\b/.test(t)) return "ai-engineering";
  if (/\b(react|vue|angular|next\.?js|svelte|nuxt|frontend|backend|full.?stack|web.?dev|html|css|javascript|typescript|node\.?js|express|django|flask|rails|rest.?api|graphql)\b/.test(t)) return "web-development";
  if (/\b(rust|c\+\+|cpp|systems?.programming|kernel|embedded|low.?level|memory.?safe|concurrency|performance.?engineer|compiler|wasm|assembly)\b/.test(t)) return "systems-programming";
  if (/\b(leetcode|dsa|data.?struct|algorithm|interview.?prep|competitive.?prog|hackerrank|codeforces|grind|coding.?interview)\b/.test(t)) return "interview-prep";
  if (/\b(pandas|numpy|sklearn|scikit|data.?science|statistics|jupyter|matplotlib|r.?lang|scipy|analytics|tableau|power.?bi)\b/.test(t)) return "data-science";
  if (/\b(docker|kubernetes|k8s|devops|ci.?cd|terraform|ansible|helm|aws|gcp|azure|sre|observability|infra.?engineer)\b/.test(t)) return "devops";
  return "general-programming";
}

function inferPrecision(raw: string, domain: Domain): IntentPrecision {
  const text  = raw.trim().toLowerCase();
  const words = text.split(/\s+/).length;

  // Explicit vague patterns — generic even if they have extra words like "in 3 months"
  const isVague =
    /^(coding|programming|development|software|tech|computer\s*science|code)\b/.test(text) ||
    /\b(coding|programming)\s+(mastery|skills?|basics?|fundamentals?|learning)/.test(text) ||
    (words <= 2 && domain === "general-programming");

  if (isVague && domain === "general-programming") return "low";
  if (words <= 3 && domain === "general-programming") return "low";
  if (domain !== "general-programming") return words >= 3 ? "high" : "medium";
  return "medium";
}

function heuristic(raw: string, ov: IntentOverrides): Intent {
  const lower = raw.toLowerCase();

  const topic = (lower
    .replace(/teach me|i want to|i wanna|how (to|do i)|learn(ing)?|study|master|understand|explain|build|research|intro(duction)? to|guide to|get into|deep dive into/g, "")
    .replace(/\s+/g, " ")
    .trim() || raw).slice(0, 90);

  const level: Level = ov.level ?? (
    /beginner|start|basics|scratch|new to|intro|never/.test(lower) ? "beginner" :
    /advanced|expert|deep|internals|research-grade|phd/.test(lower) ? "advanced" :
    "intermediate"
  );

  const goal: Goal = ov.goal ?? (
    /startup|company|business|found|venture/.test(lower) ? "startup" :
    /career|job|interview|hire|salary/.test(lower)       ? "career"  :
    /build|implement|project|ship|make/.test(lower)      ? "build"   :
    /research|paper|academic|thesis|novel/.test(lower)   ? "research" :
    "learn"
  );

  const focus: string[] = [];
  if (/paper|research|academic/.test(lower))            focus.push("papers");
  if (/code|implement|build|project|ship/.test(lower))  focus.push("implementation");
  if (/theory|concept|understand|intuition/.test(lower))focus.push("theory");
  if (/career|job|startup|interview/.test(lower))       focus.push("career");
  if (!focus.length) focus.push("theory", "implementation");

  const timeframe = ov.timeframe ?? (
    /weekend|2 day|two day/.test(lower) ? "weekend"  :
    /\bweek\b|7 day/.test(lower)        ? "1 week"   :
    /3 month|quarter|90 day/.test(lower)? "3 months" :
    "1 month"
  );

  return { raw, topic, level, goal, timeframe, focus };
}
