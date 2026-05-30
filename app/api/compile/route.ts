// THE ORCHESTRATOR
// parse → compile DAG → fire all source adapters in parallel → compute metrics
// → synthesize → done. Every step streams over SSE so the 3D graph + console
// react in real time. One source failing never kills the compile.

import { parseIntent }  from "@/lib/intent";
import { compileDAG, flattenDAG } from "@/lib/dag";
import { ADAPTERS, type SourceContext } from "@/lib/sources";
import { computeMetrics } from "@/lib/metrics";
import { synthesize } from "@/lib/synthesize";
import { pickFacts } from "@/lib/facts";
import { SSEStream } from "@/lib/sse";
import type { Level, Goal, NodeId, NodeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { intention?: string; level?: Level; goal?: Goal; timeframe?: string };
  try { body = await req.json(); }
  catch { return new Response("bad json", { status: 400 }); }

  const text = (body.intention ?? "").trim();
  if (!text) return new Response("missing intention", { status: 400 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sse = new SSEStream(controller);
      try {
        // 1 — parse
        sse.send({ type: "stage", stage: "parse" });
        const intent = await parseIntent(text, { level: body.level, goal: body.goal, timeframe: body.timeframe });
        sse.send({ type: "intent", intent });

        // 2 — compile DAG
        sse.send({ type: "stage", stage: "compile" });
        const nodes = flattenDAG(compileDAG(intent));
        sse.send({ type: "dag", nodes });

        // 3 — fetch (all adapters in parallel) + drip cute facts while we wait
        sse.send({ type: "stage", stage: "fetch" });
        const facts = pickFacts(4);
        let fi = 0;
        const factTimer = setInterval(() => {
          if (fi < facts.length) sse.send({ type: "fact", fact: facts[fi++] });
        }, 1400);

        const ctx: SourceContext = { topic: intent.topic, level: intent.level, goal: intent.goal };
        const results: Record<string, NodeResult> = {};
        await Promise.all(ADAPTERS.map((a) => runNode(a.id, sse, results, () => a.run(ctx))));
        clearInterval(factTimer);

        // 4 — metrics
        sse.send({ type: "stage", stage: "metrics" });
        const metrics = computeMetrics(results);
        sse.send({ type: "metrics", metrics });

        // 5 — synthesize
        sse.send({ type: "stage", stage: "synthesize" });
        const synthesis = await synthesize(intent, results, metrics);
        sse.send({ type: "synthesis", synthesis });

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

// runs one adapter: emits start, times it, captures data+count, emits done.
async function runNode(
  id: NodeId,
  sse: SSEStream,
  store: Record<string, NodeResult>,
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
