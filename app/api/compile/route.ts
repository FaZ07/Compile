import { parseIntent }      from "@/lib/intent";
import { compileDAG }       from "@/lib/dag";
import { fetchWiki }        from "@/lib/nodes/wiki";
import { fetchPapers }      from "@/lib/nodes/papers";
import { fetchRepos }       from "@/lib/nodes/repos";
import { fetchTutorials }   from "@/lib/nodes/tutorials";
import { fetchDiscussions }  from "@/lib/nodes/discussions";
import { fetchTrends }      from "@/lib/nodes/trends";
import { synthesize }       from "@/lib/synthesize";
import { SSEStream }        from "@/lib/sse";
import type { Level, Goal, NodeId, NodeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { intention?: string; level?: Level; goal?: Goal };
  try { body = await req.json(); }
  catch { return new Response("bad json", { status: 400 }); }

  const text = (body.intention ?? "").trim();
  if (!text) return new Response("missing intention", { status: 400 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sse = new SSEStream(controller);
      try {
        // Stage 1: parse intent
        sse.send({ type: "stage", stage: "parse" });
        const intent = await parseIntent(text, { level: body.level, goal: body.goal });
        sse.send({ type: "intent", intent });

        // Stage 2: compile DAG
        sse.send({ type: "stage", stage: "compile" });
        const dag  = compileDAG(intent);
        const flat = dag.flatMap((s) => s.nodes) as NodeId[];
        sse.send({ type: "dag", nodes: flat });

        // Stage 3: fire all 6 sources in parallel
        sse.send({ type: "stage", stage: "fetch" });
        const results: Record<string, NodeResult> = {};

        await Promise.all([
          runNode("wiki",        sse, results, () => fetchWiki(intent.topic)),
          runNode("papers",      sse, results, () => fetchPapers(intent.topic)),
          runNode("repos",       sse, results, () => fetchRepos(intent.topic, intent.level)),
          runNode("tutorials",   sse, results, () => fetchTutorials(intent.topic)),
          runNode("discussions", sse, results, () => fetchDiscussions(intent.topic)),
          runNode("trends",      sse, results, () => fetchTrends(intent.topic, intent.goal)),
        ]);

        // Stage 4: synthesize
        sse.send({ type: "stage", stage: "synthesize" });
        const synthesis = await synthesize(intent, results);
        sse.send({ type: "synthesis", synthesis });

        sse.send({ type: "stage", stage: "done" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "compile failed";
        console.error("[compile]", msg);
        sse.send({ type: "error", message: "Compilation interrupted. Try again." });
      } finally {
        sse.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":    "text/event-stream",
      "Cache-Control":   "no-cache, no-transform",
      Connection:        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function runNode<T>(id: NodeId, sse: SSEStream, store: Record<string, NodeResult>, fn: () => Promise<T>): Promise<NodeResult<T>> {
  const t0 = Date.now();
  sse.send({ type: "node:start", id });
  try {
    const data   = await fn();
    const result: NodeResult<T> = { id, ok: true,  duration_ms: Date.now() - t0, data };
    store[id]    = result as NodeResult;
    sse.send({ type: "node:done", id, result: result as NodeResult });
    return result;
  } catch (err) {
    const result: NodeResult<T> = { id, ok: false, duration_ms: Date.now() - t0, error: err instanceof Error ? err.message : "unknown" };
    store[id]    = result as NodeResult;
    sse.send({ type: "node:done", id, result: result as NodeResult });
    return result;
  }
}
