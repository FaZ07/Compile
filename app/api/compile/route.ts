// THE ORCHESTRATOR — signal reconciliation pipeline.
// parse → compile DAG → 5 parallel signal pipelines → deterministic metrics
// → single LLM synthesis pass → done. Streams industrial status + live velocity
// ticks over SSE. Topic-cached for credit conservation (directive 4J).

import { parseIntent } from "@/lib/intent";
import { compileDAG, flattenDAG } from "@/lib/dag";
import { ADAPTERS, type SourceContext } from "@/lib/sources";
import { computeMetrics } from "@/lib/metrics";
import { synthesize } from "@/lib/synthesize";
import { pickFacts } from "@/lib/facts";
import { SSEStream } from "@/lib/sse";
import type { Intent, Level, Goal, NodeId, NodeResult, CompileMetrics, Synthesis } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Industrial reconciliation states (directive 4I) — never "loading".
const STATUS = [
  "SCANNING RESEARCH NETWORKS",
  "RECONCILING IMPLEMENTATION SIGNALS",
  "DETECTING COMMUNITY DIVERGENCE",
  "WEIGHING MARKET MOMENTUM",
  "CROSS-CHECKING SOURCE AGREEMENT",
];

interface Bundle { intent: Intent; order: NodeId[]; results: Record<string, NodeResult>; metrics: CompileMetrics; synthesis: Synthesis }
const CACHE = new Map<string, Bundle>();

export async function POST(req: Request) {
  let body: { intention?: string; level?: Level; goal?: Goal; timeframe?: string };
  try { body = await req.json(); }
  catch { return new Response("bad json", { status: 400 }); }

  const text = (body.intention ?? "").trim();
  if (!text) return new Response("missing intention", { status: 400 });
  const cacheKey = `${text}|${body.level ?? ""}|${body.goal ?? ""}|${body.timeframe ?? ""}`.toLowerCase();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sse = new SSEStream(controller);
      try {
        const cached = CACHE.get(cacheKey);
        if (cached) { await replay(sse, cached); sse.close(); return; }

        // 1 — parse intent
        sse.send({ type: "stage", stage: "parse" });
        sse.send({ type: "status", payload: "PARSING INTENT VECTOR" });
        const intent = await parseIntent(text, { level: body.level, goal: body.goal, timeframe: body.timeframe });
        sse.send({ type: "intent", intent });

        // 2 — compile DAG
        sse.send({ type: "stage", stage: "compile" });
        const order = flattenDAG(compileDAG(intent));
        sse.send({ type: "dag", nodes: order });

        // 3 — fire 5 signal pipelines in parallel; stream status + facts while waiting
        sse.send({ type: "stage", stage: "fetch" });
        const facts = pickFacts(4); let fi = 0, si = 0;
        const factTimer = setInterval(() => { if (fi < facts.length) sse.send({ type: "fact", fact: facts[fi++] }); }, 1500);
        const statusTimer = setInterval(() => { sse.send({ type: "status", payload: STATUS[si++ % STATUS.length] }); }, 850);

        const ctx: SourceContext = { topic: intent.topic, level: intent.level, goal: intent.goal };
        const results: Record<string, NodeResult> = {};
        await Promise.all(ADAPTERS.map((a) => runNode(a.id, sse, results, () => a.run(ctx))));
        clearInterval(factTimer); clearInterval(statusTimer);

        // 4 — deterministic metrics + live velocity ramp
        sse.send({ type: "stage", stage: "metrics" });
        sse.send({ type: "status", payload: "COMPUTING FIELD VELOCITY" });
        const metrics = computeMetrics(results);
        await rampVelocity(sse, metrics.field_velocity);
        sse.send({ type: "metrics", metrics });

        // 5 — single LLM synthesis pass
        sse.send({ type: "stage", stage: "synthesize" });
        sse.send({ type: "status", payload: "GENERATING EXECUTION BLUEPRINT" });
        const synthesis = await synthesize(intent, results, metrics);
        sse.send({ type: "synthesis", synthesis });

        CACHE.set(cacheKey, { intent, order, results, metrics, synthesis });
        sse.send({ type: "stage", stage: "done" });
      } catch (err) {
        console.error("[compile]", err instanceof Error ? err.message : err);
        sse.send({ type: "error", message: "Compilation interrupted. Try again." });
      } finally {
        sse.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function rampVelocity(sse: SSEStream, target: number) {
  const steps = 16;
  for (let i = 1; i <= steps; i++) { sse.send({ type: "metric_tick", payload: Math.round((target * i) / steps) }); await sleep(28); }
}

// Cached replay — instant, zero network / zero LLM (credit conservation).
async function replay(sse: SSEStream, b: Bundle) {
  sse.send({ type: "stage", stage: "parse" });
  sse.send({ type: "status", payload: "CACHE HIT · REPLAYING RECONCILED INTELLIGENCE" });
  sse.send({ type: "intent", intent: b.intent });
  sse.send({ type: "stage", stage: "compile" });
  sse.send({ type: "dag", nodes: b.order });
  sse.send({ type: "stage", stage: "fetch" });
  for (const id of b.order) {
    sse.send({ type: "node:start", id });
    const r = b.results[id];
    if (r) sse.send({ type: "node:done", id, result: r });
    await sleep(70);
  }
  sse.send({ type: "stage", stage: "metrics" });
  await rampVelocity(sse, b.metrics.field_velocity);
  sse.send({ type: "metrics", metrics: b.metrics });
  sse.send({ type: "stage", stage: "synthesize" });
  sse.send({ type: "synthesis", synthesis: b.synthesis });
  sse.send({ type: "stage", stage: "done" });
}

async function runNode(
  id: NodeId, sse: SSEStream, store: Record<string, NodeResult>,
  fn: () => Promise<{ data: unknown; count: number }>,
): Promise<void> {
  const t0 = Date.now();
  sse.send({ type: "node:start", id });
  try {
    const { data, count } = await fn();
    const result: NodeResult = { id, ok: true, duration_ms: Date.now() - t0, count, data };
    store[id] = result;
    sse.send({ type: "node:done", id, result });
  } catch (err) {
    const result: NodeResult = { id, ok: false, duration_ms: Date.now() - t0, count: 0, error: err instanceof Error ? err.message : "unknown" };
    store[id] = result;
    sse.send({ type: "node:done", id, result });
  }
}
