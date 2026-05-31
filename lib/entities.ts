// ENTITY RESOLUTION — disambiguates acronyms and forces domain lock
// before retrieval fires. Prevents MCP → "Microsoft Certified Professional",
// DSA → "Digital Signature Algorithm", etc.

import type { Domain } from "./types";

export interface EntityDef {
  full:       string;   // canonical expansion
  domain:     Domain;   // locks domain when this entity is detected
  confidence: number;   // 0-1: how certain we are of this expansion
  contextClues: string[]; // co-occurring terms that boost confidence
}

// ── Known entities ────────────────────────────────────────────────────────────
export const KNOWN_ENTITIES: Record<string, EntityDef> = {
  // AI / ML infrastructure
  MCP:       { full: "Model Context Protocol",                domain: "ai-engineering",     confidence: 0.96, contextClues: ["langchain","agent","tool","openai","anthropic","llm","rag","claude","gpt"] },
  RAG:       { full: "Retrieval Augmented Generation",        domain: "ai-engineering",     confidence: 0.97, contextClues: ["vector","embedding","retrieval","langchain","llm","search","chroma","faiss"] },
  LLM:       { full: "Large Language Model",                  domain: "ai-engineering",     confidence: 0.99, contextClues: ["gpt","claude","gemini","llama","mistral","inference","fine-tun"] },
  RLHF:      { full: "Reinforcement Learning from Human Feedback", domain: "ai-engineering", confidence: 0.98, contextClues: ["alignment","reward","ppo","dpo","fine-tun","openai"] },
  LoRA:      { full: "Low-Rank Adaptation",                   domain: "ai-engineering",     confidence: 0.96, contextClues: ["fine-tun","peft","quantiz","llm","training","adapter"] },
  PEFT:      { full: "Parameter-Efficient Fine-Tuning",       domain: "ai-engineering",     confidence: 0.97, contextClues: ["lora","adapter","fine-tun","llm","training"] },
  FAISS:     { full: "Facebook AI Similarity Search",         domain: "ai-engineering",     confidence: 0.97, contextClues: ["vector","embedding","rag","similarity","search","index"] },
  LCEL:      { full: "LangChain Expression Language",         domain: "ai-engineering",     confidence: 0.97, contextClues: ["langchain","chain","runnable","pipe","invoke"] },
  SFT:       { full: "Supervised Fine-Tuning",                domain: "ai-engineering",     confidence: 0.93, contextClues: ["rlhf","training","dataset","llm","alignment"] },
  HuggingFace:{ full: "Hugging Face",                         domain: "ai-engineering",     confidence: 0.99, contextClues: ["transformers","model","tokenizer","hub","inference"] },
  // Interview / CS
  DSA:       { full: "Data Structures and Algorithms",        domain: "interview-prep",     confidence: 0.94, contextClues: ["leetcode","interview","competitive","arrays","graphs","trees","dp"] },
  LeetCode:  { full: "LeetCode",                              domain: "interview-prep",     confidence: 0.99, contextClues: ["dsa","grind","blind75","neetcode","interview"] },
  // DevOps / infra
  SRE:       { full: "Site Reliability Engineering",          domain: "devops",             confidence: 0.97, contextClues: ["sla","slo","oncall","observability","prometheus","pagerduty"] },
  IaC:       { full: "Infrastructure as Code",                domain: "devops",             confidence: 0.97, contextClues: ["terraform","ansible","pulumi","cloudformation","helm"] },
  "CI/CD":   { full: "Continuous Integration / Continuous Deployment", domain: "devops",   confidence: 0.99, contextClues: ["github actions","jenkins","gitlab","pipeline","deploy"] },
  K8s:       { full: "Kubernetes",                            domain: "devops",             confidence: 0.99, contextClues: ["docker","container","helm","pod","deployment","cluster"] },
  // Finance
  HFT:       { full: "High-Frequency Trading",                domain: "general-programming",confidence: 0.94, contextClues: ["latency","c++","trading","market","order","quant"] },
  // Web
  DX:        { full: "Developer Experience",                  domain: "web-development",    confidence: 0.88, contextClues: ["api","sdk","docs","onboarding","friction","tooling"] },
};

// ── Co-occurrence domain signals ───────────────────────────────────────────────
// If any of these appear in the query, force domain lock to ai-engineering
const AI_COOCCURRENCE = /\b(langchain|llamaindex|openai|anthropic|claude|gpt|gemini|llama|mistral|rag|vector\s?db|chroma|pinecone|weaviate|qdrant|agent|crewai|autogen|langgraph|hugging\s?face|pytorch|tensorflow|transformer|embedding|tokenizer|inference|fine.?tun|diffusion|stable\s?diffusion|midjourney|dall.?e)\b/i;

export interface ResolvedIntent {
  expandedTopic:  string;   // topic with acronyms expanded for better GitHub/arXiv search
  entityNotes:    string;   // human-readable: "MCP = Model Context Protocol (96%)"
  forcedDomain:   Domain | undefined;
  entityCount:    number;
}

/**
 * Resolves entities in a raw query string.
 * Returns expanded topic for search, entity notes for Groq context, and forced domain.
 */
export function resolveEntities(raw: string): ResolvedIntent {
  const lower = raw.toLowerCase();
  const notes: string[] = [];
  let forcedDomain: Domain | undefined;
  let expanded = raw;

  for (const [abbr, def] of Object.entries(KNOWN_ENTITIES)) {
    const pattern = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (!pattern.test(raw)) continue;

    // Check context clues to confirm this expansion (vs alternative meanings)
    const contextMatch = def.contextClues.some((c) => lower.includes(c));
    const effectiveConf = contextMatch ? Math.min(0.99, def.confidence + 0.03) : def.confidence;

    // Only resolve if confident enough
    if (effectiveConf >= 0.85) {
      notes.push(`${abbr} = ${def.full} (${Math.round(effectiveConf * 100)}% confidence)`);
      // Expand in search string — replace abbreviation with full form for better API results
      expanded = expanded.replace(pattern, def.full);
      // Lock domain if not already set or if this entity has higher confidence
      if (!forcedDomain || effectiveConf > 0.95) {
        forcedDomain = def.domain;
      }
    }
  }

  // Co-occurrence check: AI tools mentioned → force AI engineering domain
  if (!forcedDomain || forcedDomain === "general-programming") {
    if (AI_COOCCURRENCE.test(lower)) {
      forcedDomain = "ai-engineering";
    }
  }

  return {
    expandedTopic: expanded.trim(),
    entityNotes:   notes.join(" · "),
    forcedDomain,
    entityCount:   notes.length,
  };
}

/**
 * Cross-signal validation: do the two topics in a comparison logically coexist?
 * Returns a divergence note if they clearly don't.
 */
export function validateComparisonCoherence(topicA: string, topicB: string): string | null {
  const a = topicA.toLowerCase();
  const b = topicB.toLowerCase();

  const isAI  = (t: string) => AI_COOCCURRENCE.test(t) || /\b(ml|ai|llm|neural|model|embedding|rag|agent)\b/.test(t);
  const isCSP  = (t: string) => /microsoft certified|mcp cert|professional cert/i.test(t);
  const isInterview = (t: string) => /leetcode|dsa|interview|competitive/i.test(t);
  const isWeb  = (t: string) => /\b(react|vue|angular|next|svelte|frontend|backend|fullstack)\b/.test(t);

  // Clear semantic mismatch patterns
  if (isAI(a) && isCSP(b))      return "⚠ ENTITY DIVERGENCE — comparing AI tooling to a certification program. Did you mean 'Model Context Protocol'?";
  if (isAI(b) && isCSP(a))      return "⚠ ENTITY DIVERGENCE — comparing AI tooling to a certification program. Did you mean 'Model Context Protocol'?";
  if (isAI(a) && isInterview(b)) return "⚠ DOMAIN DIVERGENCE — AI tooling vs interview prep are different domains. Consider separating into two compiles.";
  if (isWeb(a) && isAI(b))       return null; // web + AI is a valid comparison (Next.js vs LangChain for startup, e.g.)

  return null; // coherent
}
