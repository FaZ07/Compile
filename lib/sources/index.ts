// Source adapter registry. Every external source implements one uniform shape,
// so the orchestrator treats them identically and adding a source = one file.

import type { NodeId, Level, Goal, Domain } from "../types";
import { contextAdapter }   from "./wikipedia";
import { papersAdapter }    from "./arxiv";
import { codeAdapter }      from "./github";
import { tutorialsAdapter } from "./devto";
import { communityAdapter } from "./community";
import { trendsAdapter }    from "./trends";

export interface SourceContext {
  topic: string;
  level: Level;
  goal: Goal;
  domain?: Domain;
}

export interface SourceAdapter {
  id: NodeId;
  run(ctx: SourceContext): Promise<{ data: unknown; count: number }>;
}

export const ADAPTERS: SourceAdapter[] = [
  contextAdapter,
  papersAdapter,
  codeAdapter,
  tutorialsAdapter,
  communityAdapter,
  trendsAdapter,
];
