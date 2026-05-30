// Plan a DAG of node executions given an Intent.
// Stage 1 = location only (everything else depends on it).
// Stage 2 = the rest, fired in parallel.

import type { Intent, NodeId } from "./types";

export interface DagStage {
  stage: number;
  nodes: NodeId[];
}

export function compileDAG(_intent: Intent): DagStage[] {
  return [
    { stage: 1, nodes: ["location"] },
    { stage: 2, nodes: ["weather", "wiki", "reddit", "flights", "stays", "events"] },
  ];
}

/** The flat node order — used by the UI for the 3D ring positioning. */
export function dagNodes(stages: DagStage[]): NodeId[] {
  return stages.flatMap((s) => s.nodes);
}
