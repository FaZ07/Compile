// THE ORCHESTRATOR.
// Parses intent → compiles DAG → fires parallel sources → streams every event
// over SSE so the 3D graph can light up in real time → synthesizes the final answer.

import { parseIntent } from "@/lib/intent";
import { compileDAG } from "@/lib/dag";
import { resolveLocation } from "@/lib/nodes/location";
import { fetchWeather } from "@/lib/nodes/weather";
import { fetchReddit } from "@/lib/nodes/reddit";
import { fetchWiki } from "@/lib/nodes/wiki";
import { fetchFlights } from "@/lib/nodes/flights";
import { fetchStays } from "@/lib/nodes/stays";
import { fetchEvents } from "@/lib/nodes/events";
import { synthesize } from "@/lib/synthesize";
import { SSEStream } from "@/lib/sse";
import type { Intent, LocationData, NodeId, NodeResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { intention?: string; from?: string; to?: string; party?: number };
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const text = (body.intention ?? "").trim();
  if (!text && !body.to) return new Response("missing intention", { status: 400 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sse = new SSEStream(controller);
      try {
        // -- Stage 1: parse intent ---------------------------------------
        sse.send({ type: "stage", stage: "parse" });
        const intent = await parseIntent(text || `trip to ${body.to}`);
        // Explicit fields override parsed intent
        if (body.to) intent.destination = body.to;
        if (body.from !== undefined) intent.origin = body.from;
        if (body.party && body.party > 0) intent.party_size = body.party;
        sse.send({ type: "intent", intent });

        // -- Stage 2: compile DAG ----------------------------------------
        sse.send({ type: "stage", stage: "compile" });
        const dag = compileDAG(intent);
        const flat: NodeId[] = dag.flatMap((s) => s.nodes);
        sse.send({ type: "dag", nodes: flat });

        // -- Stage 3: fetch (resolveLocation gates everything) -----------
        sse.send({ type: "stage", stage: "fetch" });
        const results: Record<string, NodeResult> = {};

        const loc = await runNode<LocationData>("location", sse, results, () =>
          resolveLocation(intent.destination),
        );
        if (!loc.ok || !loc.data) {
          sse.send({ type: "error", message: `Couldn't resolve location: ${loc.error}` });
          sse.close();
          return;
        }
        const L = loc.data;

        const transportOrigin = intent.origin || "Bangalore";
        await Promise.all([
          runNode("weather", sse, results, () => fetchWeather(L)),
          runNode("wiki", sse, results, () => fetchWiki(intent.destination)),
          runNode("reddit", sse, results, () => fetchReddit(intent.destination, intent.vibe || intent.themes.join(" "))),
          runNode("flights", sse, results, () => fetchFlights(transportOrigin, intent.destination, intent.date_window)),
          runNode("stays", sse, results, () => fetchStays(intent.destination, intent.party_size, intent.budget_inr ?? 15000)),
          runNode("events", sse, results, () => fetchEvents(intent.destination)),
        ]);

        // -- Stage 4: synthesize -----------------------------------------
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function runNode<T>(
  id: NodeId,
  sse: SSEStream,
  store: Record<string, NodeResult>,
  fn: () => Promise<T>,
): Promise<NodeResult<T>> {
  const t0 = Date.now();
  sse.send({ type: "node:start", id });
  try {
    const data = await fn();
    const result: NodeResult<T> = { id, ok: true, duration_ms: Date.now() - t0, data };
    store[id] = result as NodeResult;
    sse.send({ type: "node:done", id, result: result as NodeResult });
    return result;
  } catch (err) {
    const result: NodeResult<T> = {
      id,
      ok: false,
      duration_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : "unknown error",
    };
    store[id] = result as NodeResult;
    sse.send({ type: "node:done", id, result: result as NodeResult });
    return result;
  }
}
