// Parse a free-text learning goal into a typed Intent.
// Groq-driven, with a deterministic heuristic fallback so the demo never breaks.
// Explicit UI controls (level/goal/timeframe) always win over the parse.

import type { Intent, Level, Goal } from "./types";

const GROQ_KEY   = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export interface IntentOverrides {
  level?: Level;
  goal?: Goal;
  timeframe?: string;
}

export async function parseIntent(raw: string, ov: IntentOverrides = {}): Promise<Intent> {
  const fallback = heuristic(raw, ov);
  if (!GROQ_KEY) return fallback;

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
              "You parse a learning/research goal into STRICT JSON (no prose). Fields: " +
              "topic (string — the core subject to research, e.g. 'RAG systems', 'Rust ownership', 'transformer architecture'), " +
              "level ('beginner'|'intermediate'|'advanced'), " +
              "goal ('learn'|'build'|'research'|'career'|'startup'), " +
              "timeframe (string: 'weekend'|'1 week'|'1 month'|'3 months'), " +
              "focus (string[] from: 'theory','implementation','papers','projects','career'). " +
              "Infer sensibly. Keep topic concise and search-friendly.",
          },
          { role: "user", content: raw },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const p = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as Partial<Intent>;

    return {
      raw,
      topic:     (p.topic || fallback.topic).slice(0, 90),
      level:     ov.level     ?? (p.level as Level | undefined) ?? fallback.level,
      goal:      ov.goal      ?? (p.goal  as Goal  | undefined) ?? fallback.goal,
      timeframe: ov.timeframe ?? p.timeframe ?? fallback.timeframe,
      focus:     Array.isArray(p.focus) && p.focus.length ? p.focus.slice(0, 5) : fallback.focus,
    };
  } catch {
    return fallback;
  }
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
