import type { Intent, NodeId } from "./types";

export interface DagStage { stage: number; nodes: NodeId[] }

export function compileDAG(_intent: Intent): DagStage[] {
  // All nodes fire in parallel — no location-gating needed for research
  return [
    { stage: 1, nodes: ["wiki", "papers", "repos", "tutorials", "discussions", "trends"] },
  ];
}

export function dagNodes(stages: DagStage[]): NodeId[] {
  return stages.flatMap((s) => s.nodes);
}
