// Compile an Intent into an execution DAG. All six sources are independent,
// so they fire in a single parallel stage. (Kept as a stage list so the shape
// can grow into gated multi-stage graphs without touching the orchestrator.)

import type { Intent, NodeId } from "./types";
import { NODE_ORDER } from "./types";

export interface DagStage { stage: number; nodes: NodeId[] }

export function compileDAG(_intent: Intent): DagStage[] {
  return [{ stage: 1, nodes: [...NODE_ORDER] }];
}

export function flattenDAG(stages: DagStage[]): NodeId[] {
  return stages.flatMap((s) => s.nodes);
}
