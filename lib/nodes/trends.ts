// Wire-ready mock — swap with PH + YC + TechCrunch Wire actions when key is set.
import type { TrendSignal } from "../types";

function seed(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  let x = h >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 0xffffffff; };
}

const RISING_TOPICS  = ["rag","agent","llm","ai","gpu","rust","wasm","vector","embedding","multimodal","diffusion","transformer","fine-tun","langchain","langgraph","mcp"];
const STABLE_TOPICS  = ["react","next","python","typescript","docker","kubernetes","postgres","graphql","redis","fastapi"];
const DECLINING_TOPICS = ["jquery","angular","ruby","php","rest","monolith","jquery","webpack"];

const YC_COMPANIES: Record<string,string[]> = {
  default: ["Cognition AI","Imbue","Cohere","Together AI","Perplexity","Harvey"],
  rag:     ["Vectara","Weaviate","Chroma","Pinecone","LlamaIndex"],
  agent:   ["Cognition AI","AutoGPT","Fixie","MultiOn","Adept"],
  rust:    ["Zed Industries","Turso","Neon","Cloudflare Workers"],
};

const PH_LAUNCHES: Record<string,string[]> = {
  default: ["Cursor","Perplexity Pro","v0 by Vercel","bolt.new","Replit Agent"],
  rag:     ["Perplexity","Kagi","You.com","Exa","Jina AI"],
  agent:   ["Devin","Cursor","Manus","OpenHands","SWE-agent"],
};

export async function fetchTrends(topic: string, goal: string): Promise<TrendSignal> {
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
  const lower = topic.toLowerCase();
  const r = seed(topic + goal);

  const trajectory: "rising" | "stable" | "declining" =
    RISING_TOPICS.some((t) => lower.includes(t))   ? "rising"   :
    DECLINING_TOPICS.some((t) => lower.includes(t)) ? "declining" :
    STABLE_TOPICS.some((t) => lower.includes(t))    ? "stable"   :
    r() > 0.6 ? "rising" : "stable";

  const key = Object.keys(YC_COMPANIES).find((k) => k !== "default" && lower.includes(k)) ?? "default";

  const note =
    trajectory === "rising"   ? `${topic} is one of the fastest-growing areas in tech — YC W24/S24 had 40+ companies in this space.` :
    trajectory === "stable"   ? `${topic} is a mature, high-demand skill with consistent hiring across startups and enterprises.` :
    `${topic} adoption is declining; consider pairing it with modern alternatives to stay relevant.`;

  const hot_tools: string[] = [];
  if (lower.includes("rag") || lower.includes("llm") || lower.includes("ai")) hot_tools.push("LangChain", "LlamaIndex", "ChromaDB", "Weaviate");
  if (lower.includes("rust")) hot_tools.push("Tokio", "Axum", "Serde", "Cargo");
  if (lower.includes("web") || lower.includes("next") || lower.includes("react")) hot_tools.push("Next.js 15", "shadcn/ui", "Tailwind", "tRPC");
  if (!hot_tools.length) hot_tools.push("Python", "PyTorch", "Hugging Face", "FastAPI");

  return {
    domain:       topic,
    trajectory,
    note,
    hot_tools:    hot_tools.slice(0, 4),
    yc_companies: (YC_COMPANIES[key] ?? YC_COMPANIES.default).slice(0, 3),
    ph_launches:  (PH_LAUNCHES[key] ?? PH_LAUNCHES.default).slice(0, 3),
  };
}
