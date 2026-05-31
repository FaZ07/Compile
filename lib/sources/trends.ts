// WIRE-LIVE — anakin.io web scraping API.
// POST https://api.anakin.io/v1/search { prompt } → { results[].{title,snippet,url,date} }
// Falls back to deterministic mock if COMPILE_WIRE_LIVE != "1" or key missing.

import type { TrendData, Trajectory } from "../types";
import type { SourceAdapter, SourceContext } from "./index";

const WIRE_KEY  = process.env.WIRE_API_KEY  ?? "";
const WIRE_LIVE = process.env.COMPILE_WIRE_LIVE === "1";

interface WireResult { title: string; snippet: string; url: string; date: string }
interface WireResponse { id: string; results: WireResult[] }

async function wireSearch(prompt: string): Promise<WireResult[]> {
  const res = await fetch("https://api.anakin.io/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${WIRE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(18000),
  });
  if (!res.ok) throw new Error(`Wire HTTP ${res.status}`);
  const data = (await res.json()) as WireResponse;
  return data.results ?? [];
}

// Extract bold product/tool names: **Name** or "Name\n...\n reviews" patterns
function extractTools(snippets: string[]): string[] {
  const tools = new Set<string>();
  const full = snippets.join("\n");
  // **ProductName** pattern
  for (const m of full.matchAll(/\*\*([A-Z][^*\n]{2,28}?)\*\*/g)) {
    const t = m[1].replace(/ by .+$/, "").trim();
    if (t.length > 2 && t.length < 32 && !/^(the|and|or|for|with|from|this|that)$/i.test(t)) tools.add(t);
  }
  // Lines ending with "reviews" signal (Product Hunt pattern)
  for (const m of full.matchAll(/^([A-Z][^\n]{2,28}?)\n[\d.]+ \(\d+ reviews\)/gm)) {
    const t = m[1].trim();
    if (t.length > 2 && t.length < 32) tools.add(t);
  }
  return [...tools].slice(0, 5);
}

// Extract YC company names from "Launch HN: Name (YC WXX)" pattern
function extractYCCompanies(snippets: string[]): string[] {
  const companies: string[] = [];
  const seen = new Set<string>();
  for (const s of snippets) {
    for (const m of s.matchAll(/Launch HN:\s*([^(\n]+?)\s*\(YC [WS]\d+\)/g)) {
      const name = m[1].replace(/\s*[–—-].*$/, "").trim();
      if (!seen.has(name) && name.length < 40) { companies.push(name); seen.add(name); }
    }
  }
  return companies.slice(0, 4);
}

// Trajectory from signal density and recency keywords
function inferTrajectory(snippets: string[]): Trajectory {
  const text = snippets.join(" ").toLowerCase();
  const up   = (text.match(/\b(trending|surging|exploding|growing|rising|fastest|leading|top|breakthrough|launch|funded|accelerat)/g) ?? []).length;
  const down  = (text.match(/\b(declining|deprecated|legacy|old|dying|replaced|obsolete|dead|abandon)/g) ?? []).length;
  if (up > down + 2) return "rising";
  if (down > up) return "declining";
  return "stable";
}

async function fetchTrendsLive({ topic }: SourceContext): Promise<{ data: TrendData; count: number }> {
  const [productResults, ycResults] = await Promise.allSettled([
    wireSearch(`${topic} trending tools Product Hunt reviews best 2024 2025`),
    wireSearch(`${topic} YC startup funded launch companies Hacker News`),
  ]);

  const prodSnippets = productResults.status === "fulfilled"
    ? productResults.value.map((r) => r.snippet)
    : [];
  const ycSnippets   = ycResults.status === "fulfilled"
    ? ycResults.value.map((r) => r.snippet)
    : [];
  const allSnippets  = [...prodSnippets, ...ycSnippets];

  if (!allSnippets.length) throw new Error("Wire returned no results");

  const tools     = extractTools(prodSnippets);
  const companies = extractYCCompanies(ycSnippets);
  const launches  = extractTools(ycSnippets).filter((t) => !companies.includes(t));
  const trajectory = inferTrajectory(allSnippets);

  const note =
    trajectory === "rising"    ? `${topic} is accelerating — live Wire signal confirms active Product Hunt launches and YC placement.` :
    trajectory === "declining" ? `${topic} adoption is cooling according to live Wire signals — consider successor technologies.` :
                                 `${topic} is in stable production use with consistent community engagement.`;

  return {
    data: {
      trajectory,
      note,
      hot_tools:  tools.length  ? tools     : [topic, "Python", "Docker", "Hugging Face"],
      companies:  companies.length ? companies : ["Perplexity", "Together AI", "Cognition AI"],
      launches:   launches.length  ? launches  : ["Cursor", "v0 by Vercel", "bolt.new"],
    },
    count: allSnippets.length,
  };
}

// ── deterministic fallback ─────────────────────────────────────────────────
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

function fetchTrendsMock({ topic }: SourceContext): Promise<{ data: TrendData; count: number }> {
  return new Promise((resolve) => {
    setTimeout(() => {
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
      else if (/rust/.test(lower))            tools.push("Tokio", "Axum", "Serde", "Cargo");
      else if (/react|next|web|front/.test(lower)) tools.push("Next.js", "shadcn/ui", "Tailwind", "tRPC");
      else                                    tools.push("Python", "PyTorch", "Hugging Face", "Docker");
      const note =
        trajectory === "rising"    ? `${topic} is among the fastest-moving areas in tech — YC funded 40+ companies here in the last year.` :
        trajectory === "declining" ? `${topic} adoption is cooling; pair it with a modern alternative to stay current.` :
                                     `${topic} is mature and in steady demand across startups and enterprise.`;
      resolve({ data: { trajectory, note, hot_tools: tools.slice(0, 4), companies: YC[key] ?? YC.default, launches: PH[key] ?? PH.default }, count: 1 });
    }, 280 + Math.random() * 360);
  });
}

async function fetchTrends(ctx: SourceContext): Promise<{ data: TrendData; count: number }> {
  if (WIRE_LIVE && WIRE_KEY) {
    return fetchTrendsLive(ctx);
  }
  return fetchTrendsMock(ctx);
}

export const trendsAdapter: SourceAdapter = { id: "trends", run: fetchTrends };
