// COMPILE — ResearchOS types. Shared across SSE protocol and UI.

export type NodeId =
  | "wiki"
  | "papers"
  | "repos"
  | "tutorials"
  | "discussions"
  | "trends";

export interface NodeMeta {
  id: NodeId;
  label: string;
  source: string;
  real: boolean;
  angleOrder: number;
}

export const NODE_REGISTRY: Record<NodeId, NodeMeta> = {
  wiki:        { id: "wiki",        label: "Context",   source: "Wikipedia",              real: true,  angleOrder: 0 },
  papers:      { id: "papers",      label: "Papers",    source: "arXiv",                  real: true,  angleOrder: 1 },
  repos:       { id: "repos",       label: "Code",      source: "GitHub",                 real: true,  angleOrder: 2 },
  tutorials:   { id: "tutorials",   label: "Tutorials", source: "DEV.to + YouTube *",     real: false, angleOrder: 3 },
  discussions: { id: "discussions", label: "Community", source: "Reddit + HN",            real: true,  angleOrder: 4 },
  trends:      { id: "trends",      label: "Trends",    source: "PH + YC + TechCrunch *", real: false, angleOrder: 5 },
};

export type Level = "beginner" | "intermediate" | "advanced";
export type Goal  = "learn" | "research" | "build" | "career" | "startup";

export interface Intent {
  raw: string;
  topic: string;
  level: Level;
  goal: Goal;
  focus: string[];      // e.g. ["theory", "implementation", "papers"]
  timeframe: string;    // "1 week", "1 month", "3 months"
}

// ---- Node payloads ----------------------------------------

export interface WikiData {
  title: string;
  summary: string;
  url: string;
}

export interface Paper {
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  url: string;
  source: "arXiv" | "Semantic Scholar";
}

export interface Repo {
  name: string;
  full_name: string;
  description: string;
  stars: number;
  language: string;
  url: string;
  topics: string[];
  updated: string;
}

export interface Tutorial {
  title: string;
  author: string;
  platform: "DEV.to" | "YouTube" | "Medium";
  url: string;
  tags: string[];
  published: string;
  read_time_min?: number;
  views?: number;
}

export interface DiscussionPost {
  title: string;
  source: "Reddit" | "HN";
  url: string;
  score: number;
  comments: number;
  snippet: string;
}

export interface TrendSignal {
  domain: string;
  trajectory: "rising" | "stable" | "declining";
  note: string;
  hot_tools: string[];
  yc_companies: string[];
  ph_launches: string[];
}

export type NodePayload =
  | { id: "wiki";        data: WikiData }
  | { id: "papers";      data: Paper[] }
  | { id: "repos";       data: Repo[] }
  | { id: "tutorials";   data: Tutorial[] }
  | { id: "discussions"; data: DiscussionPost[] }
  | { id: "trends";      data: TrendSignal };

export interface NodeResult<T = unknown> {
  id: NodeId;
  ok: boolean;
  duration_ms: number;
  data?: T;
  error?: string;
}

// ---- Synthesis ----------------------------------------

export interface RoadmapPhase {
  phase: number;
  title: string;
  duration: string;
  objectives: string[];
  resources: string[];
}

export interface Synthesis {
  headline: string;
  summary: string;
  roadmap: RoadmapPhase[];
  projects: string[];
  insights: string[];
  trend: "rising" | "stable" | "declining";
  trend_note: string;
}

export interface Verification {
  source: string;
  claim: string;
  link?: string;
}

// ---- Wire SSE protocol ----------------------------------------

export type CompileEvent =
  | { type: "stage";     stage: "parse" | "compile" | "fetch" | "synthesize" | "done" }
  | { type: "intent";    intent: Intent }
  | { type: "dag";       nodes: NodeId[] }
  | { type: "node:start"; id: NodeId }
  | { type: "node:done";  id: NodeId; result: NodeResult }
  | { type: "synthesis"; synthesis: Synthesis }
  | { type: "error";     message: string };
