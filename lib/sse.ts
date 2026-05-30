// SSE helpers — server-side encoder & client-side parser.

import type { CompileEvent } from "./types";

export class SSEStream {
  private encoder = new TextEncoder();
  private closed = false;
  constructor(private controller: ReadableStreamDefaultController<Uint8Array>) {}

  send(event: CompileEvent) {
    if (this.closed) return;
    const line = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(line));
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.controller.close();
    } catch {
      /* already closed */
    }
  }
}

/** Parse an SSE byte stream into CompileEvent objects via async iteration. */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<CompileEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        yield JSON.parse(line.slice(5).trim()) as CompileEvent;
      } catch {
        /* ignore malformed */
      }
    }
  }
}
