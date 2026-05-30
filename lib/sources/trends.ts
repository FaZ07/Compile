// WIRE-READY (mock) — startup/trend layer. Swap with Wire's Product Hunt +
// Y Combinator + TechCrunch actions when WIRE_API_KEY is set. Deterministic so
// a given topic always yields the same defensible trajectory.
import type { TrendData, Trajectory } from "../types";
import type { SourceAdapter, SourceContext } from "./index";

const RISING    = ["rag","agent","llm","ai","ml","gpu","rust","wasm","vector","embedding","multimodal","diffusion","transformer","fine-tun","langchain","langgraph","mcp","inference","quantiz"];
const DECLINING = ["jquery","angularjs","ruby on rails","php","soap","flash","backbone"];
const STABLE    = ["react","next","python","typescript","go","docker","kubernetes","postgres","graphql","redis","fastapi","django"];

const YC: Record<string, string[]> = {
  default: ["Cognition AI", "Perplexity", "Together AI"],
  rag:     ["Vectara", "LlamaIndex", "Chroma"],
  agent:   ["Cognition AI", "MultiOn", "Lindy"],
  rust:    ["Zed", "Turso", "Warp"],
};
const PH: Record<string, string[]> = {
  default: ["Cursor", "v0 by Vercel", "bolt.new"],
  rag:     ["Perplexity", "Exa", "Jina AI"],
  agent:   ["Devin", "Manus", "OpenHands"],
  rust:    ["Zed", "Tauri", "Biome"],
};

function seed(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  let x = h >>> 0;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 0xffffffff);
}

async function fetchTrends({ topic }: SourceContext): Promise<{ data: TrendData; count: number }> {
  await new Promise((r) => setTimeout(r, 280 + Math.random() * 360)); // network feel
  const lower = topic.toLowerCase();
  const rnd = seed(topic);

  const trajectory: Trajectory =
    RISING.some((t) => lower.includes(t))    ? "rising"    :
    DECLINING.some((t) => lower.includes(t)) ? "declining" :
    STABLE.some((t) => lower.includes(t))    ? "stable"    :
    rnd() > 0.55 ? "rising" : "stable";

  const key = Object.keys(YC).find((k) => k !== "default" && lower.includes(k)) ?? "default";

  const tools: string[] = [];
  if (/rag|llm|ai|ml|agent/.test(lower)) tools.push("LangChain", "LlamaIndex", "Chroma", "Ollama");
  else if (/rust/.test(lower))           tools.push("Tokio", "Axum", "Serde", "Cargo");
  else if (/react|next|web|front/.test(lower)) tools.push("Next.js", "shadcn/ui", "Tailwind", "tRPC");
  else                                   tools.push("Python", "PyTorch", "Hugging Face", "Docker");

  const note =
    trajectory === "rising"    ? `${topic} is among the fastest-moving areas in tech — YC funded 40+ companies here in the last year.` :
    trajectory === "declining" ? `${topic} adoption is cooling; pair it with a modern alternative to stay current.` :
                                 `${topic} is mature and in steady demand across startups and enterprise.`;

  return {
    data: { trajectory, note, hot_tools: tools.slice(0, 4), companies: YC[key] ?? YC.default, launches: PH[key] ?? PH.default },
    count: 1,
  };
}

export const trendsAdapter: SourceAdapter = { id: "trends", run: fetchTrends };
