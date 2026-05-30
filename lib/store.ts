// Client-side compile archive (localStorage). Cross-page state with zero backend:
// `/` saves each completed compile here; /dossier, /graph, /radar, /archives read it.

import type { Intent, CompileMetrics, Synthesis, NodeResult } from "./types";

export interface StoredCompile {
  id: string;            // slug of the topic — clean URLs, dedupes re-runs
  topic: string;
  level: string; goal: string; timeframe: string;
  createdAt: number;
  intent: Intent;
  metrics: CompileMetrics;
  synthesis: Synthesis;
  results: Record<string, NodeResult>;
  facts: string[];
}

const KEY = "compile.archive.v1";
const MAX = 40;

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}

function readAll(): StoredCompile[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as StoredCompile[]; } catch { return []; }
}
function writeAll(list: StoredCompile[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* quota */ }
}

export function saveCompile(b: Omit<StoredCompile, "id" | "createdAt">): string {
  const id = slugify(b.topic);
  const rec: StoredCompile = { ...b, id, createdAt: Date.now() };
  const rest = readAll().filter((x) => x.id !== id); // re-run overwrites
  writeAll([rec, ...rest]);
  return id;
}

export function listCompiles(): StoredCompile[] { return readAll().sort((a, b) => b.createdAt - a.createdAt); }
export function getCompile(id: string): StoredCompile | null { return readAll().find((x) => x.id === id) ?? null; }
export function deleteCompile(id: string) { writeAll(readAll().filter((x) => x.id !== id)); }

/** Ecosystem Score (directive 4): YC adoption + open-source star spikes. Deterministic. */
export function ecosystemScore(m: CompileMetrics): number {
  const yc = m.breakdown.find((f) => f.label.includes("YC"))?.value ?? 50;
  const stars = m.breakdown.find((f) => f.label.includes("star"))?.value ?? 50;
  const ph = m.breakdown.find((f) => f.label.includes("Product Hunt"))?.value ?? 50;
  return Math.round(Math.max(0, Math.min(100, yc * 0.45 + stars * 0.4 + ph * 0.15)));
}
