import type { Intent, Level, Goal } from "./types";

const GROQ_KEY   = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export async function parseIntent(raw: string, overrides?: { level?: Level; goal?: Goal }): Promise<Intent> {
  const fallback = heuristic(raw, overrides);
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
              "You are an intent parser for a research-and-learning compilation engine. Output STRICT JSON, no prose. " +
              "Fields: " +
              "topic (string — the core subject, e.g. 'RAG systems', 'Rust', 'AI agents'), " +
              "level ('beginner'|'intermediate'|'advanced' — infer from context, default 'beginner'), " +
              "goal ('learn'|'research'|'build'|'career'|'startup' — what the user wants to do), " +
              "focus (string[] — e.g. ['theory','implementation','papers','projects'] — what aspects matter), " +
              "timeframe (string — e.g. '1 week', '1 month', 'ongoing'; default '1 month'). " +
              "Be concise. No extra fields.",
          },
          { role: "user", content: raw },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt  = data.choices?.[0]?.message?.content ?? "";
    const p    = JSON.parse(txt) as Partial<Intent>;

    return {
      raw,
      topic:     p.topic     || fallback.topic,
      level:     overrides?.level ?? (p.level as Level | undefined)     ?? fallback.level,
      goal:      overrides?.goal  ?? (p.goal  as Goal  | undefined)     ?? fallback.goal,
      focus:     Array.isArray(p.focus) && p.focus.length ? p.focus : fallback.focus,
      timeframe: p.timeframe || fallback.timeframe,
    };
  } catch {
    return fallback;
  }
}

function heuristic(raw: string, overrides?: { level?: Level; goal?: Goal }): Intent {
  const lower = raw.toLowerCase();

  // topic: strip common intent words, keep the subject
  const cleaned = lower
    .replace(/teach me|learn|i want to|how to|explain|understand|build|research|study|master|beginner guide to|intro to/g, "")
    .replace(/\s+/g, " ").trim();
  const topic = cleaned || raw;

  const level: Level = overrides?.level ?? (
    lower.includes("beginner") || lower.includes("start") || lower.includes("basics") || lower.includes("intro") ? "beginner" :
    lower.includes("advanced") || lower.includes("deep") || lower.includes("expert") ? "advanced" :
    "intermediate"
  );

  const goal: Goal = overrides?.goal ?? (
    lower.includes("startup") || lower.includes("company") || lower.includes("business") ? "startup" :
    lower.includes("career") || lower.includes("job") || lower.includes("hire") ? "career" :
    lower.includes("build") || lower.includes("project") || lower.includes("implement") ? "build" :
    lower.includes("research") || lower.includes("paper") || lower.includes("academic") ? "research" :
    "learn"
  );

  const focus: string[] = [];
  if (lower.includes("paper") || lower.includes("research") || lower.includes("academic")) focus.push("papers");
  if (lower.includes("code") || lower.includes("implement") || lower.includes("build") || lower.includes("project")) focus.push("implementation");
  if (lower.includes("theory") || lower.includes("concept") || lower.includes("understand")) focus.push("theory");
  if (lower.includes("startup") || lower.includes("career") || lower.includes("job")) focus.push("career");
  if (!focus.length) focus.push("theory", "implementation");

  const timeframe =
    lower.includes("week") ? "1 week" :
    lower.includes("month") ? "1 month" :
    lower.includes("3 month") || lower.includes("quarter") ? "3 months" :
    "1 month";

  return { raw, topic: topic.slice(0, 80), level, goal, focus, timeframe };
}
