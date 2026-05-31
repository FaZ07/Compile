// COMPILE — data contracts. Everything (SSE protocol, sources, UI) agrees here.

export type NodeId = "context" | "papers" | "code" | "tutorials" | "community" | "trends";

export interface SourceMeta {
  id: NodeId;
  label: string;   // shown on the 3D node + section header
  source: string;  // brand name
  live: boolean;   // hits a real public API right now
  accent: "cyan" | "gold";
  order: number;   // ring position in the constellation
}

export const SOURCES: Record<NodeId, SourceMeta> = {
  context:   { id: "context",   label: "Context",   source: "Wikipedia",        live: true,  accent: "cyan", order: 0 },
  papers:    { id: "papers",    label: "Research",  source: "arXiv",            live: true,  accent: "cyan", order: 1 },
  code:      { id: "code",      label: "Code",      source: "GitHub",           live: true,  accent: "gold", order: 2 },
  tutorials: { id: "tutorials", label: "Tutorials", source: "DEV.to",           live: true,  accent: "cyan", order: 3 },
  community: { id: "community", label: "Community", source: "Reddit + HN",      live: true,  accent: "gold", order: 4 },
  trends:    { id: "trends",    label: "Trends",    source: "YC · PH · TechCrunch", live: false, accent: "gold", order: 5 },
};

export const NODE_ORDER: NodeId[] = (Object.values(SOURCES) as SourceMeta[])
  .sort((a, b) => a.order - b.order)
  .map((s) => s.id);

// ── intent ──────────────────────────────────────────────────────
export type Level = "beginner" | "intermediate" | "advanced";
export type Goal  = "learn" | "build" | "research" | "career" | "startup";

export interface Intent {
  raw: string;
  topic: string;
  level: Level;
  goal: Goal;
  timeframe: string;  // "1 week" | "1 month" | "3 months" | "weekend"
  focus: string[];    // ["theory","implementation","papers",...]
}

// ── source payloads ─────────────────────────────────────────────
export interface ContextData { title: string; summary: string; url: string }

export interface Paper {
  title: string; authors: string[]; year: number;
  abstract: string; url: string; category: string;
}

export interface Repo {
  name: string; full_name: string; description: string;
  stars: number; language: string; url: string;
  topics: string[]; updated: string; pushed_days_ago: number;
}

export interface Tutorial {
  title: string; author: string; platform: "DEV.to" | "YouTube" | "Medium";
  url: string; tags: string[]; published: string;
  read_min?: number; reactions?: number; views?: number;
}

export interface Discussion {
  title: string; source: "Reddit" | "HN"; url: string;
  score: number; comments: number; snippet: string;
}

export interface TrendData {
  trajectory: Trajectory;
  note: string;
  hot_tools: string[];
  companies: string[];   // YC-style
  launches: string[];    // Product Hunt-style
}

export type Trajectory = "rising" | "stable" | "declining";

// ── node result envelope ────────────────────────────────────────
export interface NodeResult<T = unknown> {
  id: NodeId;
  ok: boolean;
  duration_ms: number;
  count: number;    // how many artifacts this source returned
  data?: T;
  error?: string;
}

// ── compile metrics (the comparative "analyze" surface) ─────────
export interface VelocityFactor {
  label: string;   // "GitHub star acceleration"
  value: number;   // normalized 0-100
  weight: number;  // contribution weight (sums to 1)
}

export type EcosystemState = "Dormant" | "Stable" | "Growing" | "Explosive";

export interface CompileMetrics {
  sources_queried: number;
  sources_live: number;
  sources_ok: number;
  artifacts_found: number;
  total_latency_ms: number;
  fastest_ms: number;
  field_velocity: number;          // 0-100 weighted synthesis
  trajectory: Trajectory;
  ecosystem_state: EcosystemState; // threshold interpretation
  breakdown: VelocityFactor[];     // the weighted components
  confidence: number;              // 0-100 intelligence confidence
  confidence_label: string;        // "MULTI-SOURCE CONSENSUS CONFIRMED" etc.
}

// ── synthesis ───────────────────────────────────────────────────
export interface RoadmapPhase {
  phase: number;
  title: string;
  duration: string;
  objectives: string[];
  resources: string[];
}

export interface ProjectIdea {
  title: string;
  difficulty: 1 | 2 | 3;  // starter / intermediate / advanced
  why: string;
}

export interface Recommendation {
  verdict: string;                          // "HIGH CONVICTION · COMMIT"
  conviction: "HIGH" | "MODERATE" | "LOW";
  confidence: number;
  reasoning: string[];
}

export interface EcosystemRisk {
  category: string;
  severity: "low" | "medium" | "high";
  note: string;
}

export interface Synthesis {
  headline: string;
  summary: string;
  roadmap: RoadmapPhase[];
  projects: ProjectIdea[];
  insights: string[];
  trend_note: string;
  recommendation?: Recommendation;          // deterministic strategic verdict
  risks?: EcosystemRisk[];                   // signal-derived risk matrix
}

// ── SSE protocol ────────────────────────────────────────────────
export type Stage = "parse" | "compile" | "fetch" | "metrics" | "synthesize" | "done";

export type CompileEvent =
  | { type: "stage";      stage: Stage }
  | { type: "status";     payload: string }       // industrial live-compile line
  | { type: "intent";     intent: Intent }
  | { type: "dag";        nodes: NodeId[] }
  | { type: "node:start"; id: NodeId }
  | { type: "node:done";  id: NodeId; result: NodeResult }
  | { type: "fact";       fact: string }
  | { type: "metric_tick"; payload: number }       // live field-velocity ramp
  | { type: "metrics";    metrics: CompileMetrics }
  | { type: "synthesis";  synthesis: Synthesis }
  | { type: "error";      message: string };
