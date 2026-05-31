"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import RealityGraph, { type NodeStateMap } from "@/components/RealityGraph";
import Chrome from "@/components/Chrome";
import DossierView from "@/components/DossierView";
import { SourceLogo, ArrowUR } from "@/components/logos";
import Sticky from "@/components/Sticky";
import { SPRING, riseIn, submitShake } from "@/lib/motion";
import { saveCompile } from "@/lib/store";
import { parseSSE } from "@/lib/sse";
import {
  SOURCES, NODE_ORDER,
  type CompileEvent, type Intent, type NodeId, type NodeResult, type Synthesis, type CompileMetrics,
  type Level, type Goal,
} from "@/lib/types";

/* ── constants ──────────────────────────────────────────────── */
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const GOALS: { id: Goal; label: string }[] = [
  { id: "learn", label: "Learn" }, { id: "build", label: "Build" }, { id: "research", label: "Research" },
  { id: "career", label: "Career" }, { id: "startup", label: "Startup" },
];
const DEPTHS = ["weekend", "1 week", "1 month", "3 months"];
type Sample = { topic: string; level: Level; goal: Goal; free: string };
const SAMPLES: Sample[] = [
  { topic: "RAG systems", level: "intermediate", goal: "build", free: "ship production retrieval infrastructure" },
  { topic: "Rust vs Go for AI infra", level: "advanced", goal: "career", free: "decide the durable systems language" },
  { topic: "diffusion models", level: "advanced", goal: "research", free: "map the frontier of generative research" },
  { topic: "AI agents", level: "beginner", goal: "learn", free: "understand autonomous agent architecture" },
];
const STAGE_LABEL: Record<string, string> = {
  parse: "PARSE", compile: "COMPILE", fetch: "RECONCILE", metrics: "SYNTHESIZE", synthesize: "BLUEPRINT", done: "COMPLETE",
};
type Phase = "idle" | "compiling" | "complete";
const IDLE_STATES: NodeStateMap = Object.fromEntries(NODE_ORDER.map((k) => [k, "idle"])) as NodeStateMap;

/* ── page ───────────────────────────────────────────────────── */
export default function Page() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [topic, setTopic] = useState(SAMPLES[0].topic);
  const [level, setLevel] = useState<Level>(SAMPLES[0].level);
  const [goal, setGoal] = useState<Goal>(SAMPLES[0].goal);
  const [depth, setDepth] = useState("1 month");
  const [free, setFree] = useState(SAMPLES[0].free);

  const [stage, setStage] = useState("parse");
  const [status, setStatus] = useState("AWAITING INTENT");
  const [liveVel, setLiveVel] = useState(0);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [nodes, setNodes] = useState<NodeId[]>([]);
  const [states, setStates] = useState<NodeStateMap>({});
  const [results, setResults] = useState<Record<string, NodeResult>>({});
  const [metrics, setMetrics] = useState<CompileMetrics | null>(null);
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null);
  const [facts, setFacts] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [shaking, setShaking] = useState(false);
  const tick = useRef<number | null>(null);

  const run = useCallback(async () => {
    if (!topic.trim()) return;
    setError(null); setStage("parse"); setStatus("INITIALISING COMPILER"); setLiveVel(0);
    setIntent(null); setNodes([]); setStates({}); setResults({}); setMetrics(null); setSynthesis(null); setFacts([]);
    setLog([`$ compile "${topic}" --level ${level} --goal ${goal} --depth "${depth}"`]);
    setPhase("compiling");
    const t0 = Date.now();
    if (tick.current) window.clearInterval(tick.current);
    tick.current = window.setInterval(() => setElapsed(Date.now() - t0), 80) as unknown as number;
    try {
      const res = await fetch("/api/compile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intention: `${topic}. ${free}`, level, goal, timeframe: depth }),
      });
      if (!res.ok || !res.body) throw new Error(`server ${res.status}`);
      for await (const ev of parseSSE(res.body)) apply(ev);
    } catch (e) { setError(e instanceof Error ? e.message : "compile failed"); }
    finally { if (tick.current) window.clearInterval(tick.current); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, level, goal, depth, free]);

  const submit = () => { if (!topic.trim()) return; setShaking(true); setTimeout(() => { setShaking(false); run(); }, 340); };

  const apply = (ev: CompileEvent) => {
    switch (ev.type) {
      case "stage": setStage(ev.stage); if (ev.stage === "done") setTimeout(() => setPhase("complete"), 650); break;
      case "status": setStatus(ev.payload); setLog((l) => [...l, `▶ ${ev.payload}`]); break;
      case "intent": setIntent(ev.intent); setLog((l) => [...l, `· topic=${ev.intent.topic} level=${ev.intent.level} goal=${ev.intent.goal}`]); break;
      case "dag": setNodes(ev.nodes); setStates(Object.fromEntries(ev.nodes.map((n) => [n, "idle"])) as NodeStateMap); break;
      case "node:start": setStates((s) => ({ ...s, [ev.id]: "running" })); setLog((l) => [...l, `→ ${ev.id} · ${SOURCES[ev.id].source.toLowerCase()}`]); break;
      case "node:done": setStates((s) => ({ ...s, [ev.id]: ev.result.ok ? "done" : "error" })); setResults((r) => ({ ...r, [ev.id]: ev.result })); setLog((l) => [...l, ev.result.ok ? `✓ ${ev.id} · ${ev.result.count} signals · ${ev.result.duration_ms}ms` : `✗ ${ev.id} no signal`]); break;
      case "fact": setFacts((f) => [...f, ev.fact]); break;
      case "metric_tick": setLiveVel(ev.payload); break;
      case "metrics": setMetrics(ev.metrics); setLiveVel(ev.metrics.field_velocity); break;
      case "synthesis": setSynthesis(ev.synthesis); break;
      case "error": setError(ev.message); break;
    }
  };

  const [savedId, setSavedId] = useState<string | null>(null);
  useEffect(() => {
    if (phase === "complete" && intent && synthesis && metrics) {
      setSavedId(saveCompile({ topic: intent.topic, level, goal, timeframe: depth, intent, metrics, synthesis, results, facts }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const reset = () => { setPhase("idle"); setError(null); setStatus("AWAITING INTENT"); };

  // ONE persistent canvas drives every phase — it never remounts, so it stays
  // alive through the compile and LERPs seamlessly from compiling → output.
  const graphStates = phase === "idle" ? IDLE_STATES : states;
  const graphOpacity = phase === "complete" ? 0.16 : phase === "compiling" ? 1 : 0.5;

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Chrome />
      <motion.div className="fixed inset-0 z-0 pointer-events-none" animate={{ opacity: graphOpacity }} transition={SPRING}>
        <RealityGraph nodes={NODE_ORDER} states={graphStates} phase={phase} />
      </motion.div>
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <Console key="idle" topic={topic} setTopic={setTopic} level={level} setLevel={setLevel}
            goal={goal} setGoal={setGoal} depth={depth} setDepth={setDepth} free={free} setFree={setFree}
            onSubmit={submit} shaking={shaking} error={error}
            onSample={(s) => { setTopic(s.topic); setLevel(s.level); setGoal(s.goal); setFree(s.free); }} />
        )}
        {phase === "compiling" && (
          <Compiling key="cmp" topic={topic} intent={intent} nodes={nodes} states={states}
            stage={stage} status={status} liveVel={liveVel} log={log} elapsed={elapsed} error={error} />
        )}
        {phase === "complete" && synthesis && intent && metrics && (
          <motion.section key="dos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="relative">
            <DossierView intent={intent} synthesis={synthesis} metrics={metrics} results={results} facts={facts}
              footer={
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="mono text-[0.62rem]" style={{ color: "var(--ink-3)" }}>archived · {metrics.confidence_label.toLowerCase()}</p>
                  <div className="flex gap-2 flex-wrap">
                    {savedId && <Link href={`/graph/${savedId}`} className="press brutal-sm bg-transparent px-5 py-3 mono text-[0.72rem]">OPEN GRAPH ↗</Link>}
                    {savedId && <Link href={`/dossier/${savedId}`} className="press brutal-sm bg-transparent px-5 py-3 mono text-[0.72rem]">PERMALINK ↗</Link>}
                    <button onClick={reset} className="press btn-ink px-6 py-3 text-[0.86rem]">COMPILE ANOTHER</button>
                  </div>
                </div>
              } />
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ── brutalist segmented control ────────────────────────────── */
function Seg<T extends string>({ value, options, onChange, cap }: { value: T; options: T[]; onChange: (v: T) => void; cap?: boolean }) {
  return (
    <div className="inline-flex" style={{ border: "2px solid var(--ink)" }}>
      {options.map((o, i) => (
        <button key={o} onClick={() => onChange(o)}
          className="mono text-[0.64rem] px-2.5 py-1.5 press"
          style={{ borderLeft: i ? "2px solid var(--ink)" : "none", background: value === o ? "var(--ink)" : "var(--paper)", color: value === o ? "var(--paper)" : "var(--ink-2)", textTransform: cap ? "capitalize" : "none" }}>
          {o}
        </button>
      ))}
    </div>
  );
}

/* ── console (page 1) ───────────────────────────────────────── */
function Console(p: {
  topic: string; setTopic: (s: string) => void; level: Level; setLevel: (l: Level) => void;
  goal: Goal; setGoal: (g: Goal) => void; depth: string; setDepth: (d: string) => void;
  free: string; setFree: (s: string) => void; onSubmit: () => void; shaking: boolean; error: string | null; onSample: (s: Sample) => void;
}) {
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="relative min-h-screen w-full">
      <div className="relative z-10 mx-auto max-w-3xl px-5 pt-28 pb-24">
        <motion.div variants={riseIn} initial="hidden" animate="show" className="mb-4 flex items-center gap-3">
          <span className="cert">◇ AUTONOMOUS INTERNET INTELLIGENCE COMPILER</span>
        </motion.div>

        <motion.h1 variants={riseIn} initial="hidden" animate="show" custom={1} className="display text-[clamp(2.4rem,7vw,4.6rem)]">
          COMPILE THE INTERNET.
        </motion.h1>
        <motion.p variants={riseIn} initial="hidden" animate="show" custom={2} className="display text-[clamp(1.1rem,3vw,1.9rem)] mt-2">
          NOT A CHATBOT. <span style={{ color: "var(--stamp)" }}>A REALITY COMPILER.</span>
        </motion.p>
        <motion.p variants={riseIn} initial="hidden" animate="show" custom={3} className="mt-3 text-[1.02rem] leading-relaxed max-w-xl" style={{ color: "var(--ink-2)" }}>
          The internet is fragmented across outdated tutorials, abandoned repos, and misleading hype cycles. COMPILE reconciles those signals — research, code, community, market — into one executable intelligence dossier. <strong>Link an intention.</strong>
        </motion.p>

        {/* manifest sheet */}
        <motion.div animate={p.shaking ? submitShake : {}} variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} custom={3} className="brutal mt-8 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: "2px solid var(--ink)" }}>
            <span className="label">intelligence manifest // 001</span>
            <span className="mono text-[0.56rem] flex items-center gap-1.5" style={{ color: "var(--stamp)" }}><span className="inline-block w-2 h-2" style={{ background: "var(--stamp)" }} /> ARMED</span>
          </div>

          <label className="label">intention</label>
          <input value={p.topic} onChange={(e) => p.setTopic(e.target.value)} autoFocus
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") p.onSubmit(); }}
            placeholder="LINK AN INTENTION…"
            className="block w-full bg-transparent display text-[clamp(1.4rem,3.4vw,2.2rem)] mt-1 focus:outline-none"
            style={{ color: "var(--ink)" }} />

          <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr]">
            <span className="label pt-2">level</span><div><Seg value={p.level} options={LEVELS} onChange={p.setLevel} cap /></div>
            <span className="label pt-2">goal</span>
            <div className="inline-flex flex-wrap" style={{ border: "2px solid var(--ink)", width: "fit-content" }}>
              {GOALS.map((g, i) => (
                <button key={g.id} onClick={() => p.setGoal(g.id)} className="mono text-[0.64rem] px-2.5 py-1.5 press"
                  style={{ borderLeft: i ? "2px solid var(--ink)" : "none", background: p.goal === g.id ? "var(--stamp)" : "var(--paper)", color: p.goal === g.id ? "var(--paper)" : "var(--ink-2)" }}>{g.label}</button>
              ))}
            </div>
            <span className="label pt-2">depth</span><div><Seg value={p.depth} options={DEPTHS} onChange={p.setDepth} /></div>
          </div>

          <textarea value={p.free} onChange={(e) => p.setFree(e.target.value)} rows={2}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") p.onSubmit(); }}
            placeholder="strategic context — 'decide the durable systems language', 'ship to production'…"
            className="brutal-inset mt-5 block w-full p-3 resize-none text-[0.88rem] focus:outline-none" style={{ color: "var(--ink-2)" }} />

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="mono text-[0.56rem]" style={{ color: "var(--ink-3)" }}>⌘/CTRL + ENTER</span>
            <button onClick={p.onSubmit} className="press btn-stamp px-7 py-3 flex items-center gap-2 text-[0.92rem]">COMPILE <ArrowUR s={16} /></button>
          </div>
        </motion.div>

        {/* sample manifests */}
        <div className="mt-4 flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button key={s.topic} onClick={() => p.onSample(s)} className="press brutal-sm bg-transparent px-3 py-1.5 mono text-[0.66rem]" style={{ color: "var(--ink-2)" }}>{s.topic}</button>
          ))}
        </div>

        {/* source registry */}
        <div className="mt-8">
          <p className="label mb-2">signal sources // 5 live · 1 wire-ready</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NODE_ORDER.map((id) => (
              <div key={id} className="brutal-sm bg-transparent px-3 py-2 flex items-center gap-2">
                <SourceLogo source={SOURCES[id].source} />
                <span className="text-[0.74rem] font-semibold flex-1">{SOURCES[id].label}</span>
                <span className="mono text-[0.5rem] px-1.5 py-0.5" style={{ background: SOURCES[id].live ? "var(--ink)" : "var(--stamp)", color: "var(--paper)" }}>{SOURCES[id].live ? "LIVE" : "WIRE"}</span>
              </div>
            ))}
          </div>
        </div>
        {/* field notes — cute + informative */}
        <div className="mt-9 grid gap-5 sm:grid-cols-3">
          <Sticky index={0} label="how it scores" text="Field Velocity = commit rate × paper cadence × startup adoption. 76+ means an explosive ecosystem." />
          <Sticky index={1} label="pro tip" text="Inside a dossier, hover the blacked-out Community blocks to declassify the real ecosystem friction." />
          <Sticky index={2} label="it remembers" text="Every compile is filed to Archives — reopen it as a dossier or a live 3D knowledge graph." />
        </div>
        {/* showcase — strategic intelligence sample */}
        <Link href="/compare" className="press brutal mt-4 p-5 block">
          <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: "2px solid var(--ink)" }}>
            <span className="label">sample reconciliation // rust vs go for ai infra</span>
            <span className="mono text-[0.56rem]" style={{ color: "var(--stamp)" }}>RUN LIVE ▸</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div><p className="display text-[2.2rem] leading-none">76</p><p className="mono text-[0.56rem]" style={{ color: "var(--ink-3)" }}>RUST · EXPLOSIVE ↑</p></div>
            <span className="display text-[1.1rem]" style={{ color: "var(--stamp)" }}>VS</span>
            <div className="text-right"><p className="display text-[2.2rem] leading-none">61</p><p className="mono text-[0.56rem]" style={{ color: "var(--ink-3)" }}>GO · GROWING →</p></div>
          </div>
          <p className="text-[0.8rem] mt-3" style={{ color: "var(--ink-2)" }}><strong style={{ color: "var(--ink)" }}>Verdict:</strong> Rust leads on repository velocity and systems-level startup adoption — the durable infrastructure bet.</p>
        </Link>
        <div className="mt-9 brutal p-6 text-center">
          <p className="display text-[clamp(1.1rem,3.2vw,1.9rem)]">THE INTERNET WAS BUILT FOR WEBSITES.</p>
          <p className="display text-[clamp(1.1rem,3.2vw,1.9rem)]" style={{ color: "var(--stamp)" }}>COMPILE REBUILDS IT FOR MINDS.</p>
        </div>
        {p.error && <p className="mt-4 mono text-sm" style={{ color: "var(--stamp)" }}>{p.error}</p>}
      </div>
    </motion.section>
  );
}

/* ── compiling theatre (page transition) ────────────────────── */
function Compiling(p: {
  topic: string; intent: Intent | null; nodes: NodeId[]; states: NodeStateMap;
  stage: string; status: string; liveVel: number; log: string[]; elapsed: number; error: string | null;
}) {
  const ids = p.nodes.length ? p.nodes : NODE_ORDER;
  const done = ids.filter((n) => p.states[n] === "done" || p.states[n] === "error").length;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [p.log]);

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="relative min-h-screen w-full">
      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-24 grid gap-4 lg:grid-cols-[1fr_360px] pointer-events-none">
        {/* live status + velocity */}
        <div className="brutal p-5 self-start pointer-events-auto" style={{ background: "var(--paper)" }}>
          <p className="label">reconciliation state // {STAGE_LABEL[p.stage] ?? p.stage}</p>
          <p className="display text-[clamp(1.3rem,3vw,2rem)] mt-2 mono" style={{ color: "var(--stamp)", letterSpacing: "0.02em" }}>{p.status}</p>
          <div className="mt-4 flex items-end gap-4">
            <div>
              <p className="label">compile score</p>
              <p className="display text-[3.4rem] leading-none mono">{p.liveVel}<span className="text-[1.2rem]" style={{ color: "var(--ink-3)" }}>/100</span></p>
            </div>
            <div className="flex-1 bar-track h-4 mb-2"><div className="h-full" style={{ width: `${p.liveVel}%`, background: "var(--stamp)", transition: "width 0.1s linear" }} /></div>
          </div>
          <p className="mono text-[0.6rem] mt-1" style={{ color: "var(--ink-3)" }}>{(p.elapsed / 1000).toFixed(2)}s · {done}/{ids.length} pipelines reconciled</p>
        </div>

        {/* node manifest checklist */}
        <div className="brutal p-4 self-start pointer-events-auto" style={{ background: "var(--paper)" }}>
          <p className="label mb-2">signal pipelines</p>
          <div className="grid gap-1.5">
            {ids.map((id) => {
              const st = p.states[id] ?? "idle";
              return (
                <div key={id} className="flex items-center gap-2 px-2 py-1.5" style={{ border: "2px solid var(--ink)", background: st === "running" ? "var(--stamp)" : "var(--paper)" }}>
                  <SourceLogo source={SOURCES[id].source} />
                  <span className="text-[0.72rem] font-semibold flex-1" style={{ color: st === "running" ? "var(--paper)" : "var(--ink)" }}>{SOURCES[id].label}</span>
                  <span className="mono text-[0.6rem]" style={{ color: st === "running" ? "var(--paper)" : st === "done" ? "var(--ink)" : "var(--ink-3)" }}>
                    {st === "done" ? "✓ LOCKED" : st === "running" ? "···" : st === "error" ? "✗" : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* terminal */}
      <div className="fixed inset-x-0 bottom-0 z-10 pointer-events-none">
        <div className="mx-auto max-w-6xl px-5 pb-5">
          <div className="brutal p-3 pointer-events-auto" style={{ background: "var(--ink)" }}>
            <div className="mono text-[0.68rem] leading-relaxed max-h-28 overflow-y-auto pr-2" style={{ color: "var(--paper)" }}>
              {p.log.map((l, i) => (
                <div key={i} style={{ color: l.startsWith("✓") ? "var(--paper)" : l.startsWith("✗") ? "var(--stamp)" : l.startsWith("▶") ? "var(--stamp)" : l.startsWith("→") ? "#d6e4ff" : "rgba(249,247,242,0.6)" }}>{l}</div>
              ))}
              <div ref={end} />
            </div>
          </div>
        </div>
      </div>
      {p.error && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 brutal px-4 py-2 mono text-xs" style={{ color: "var(--stamp)" }}>{p.error}</div>}
    </motion.section>
  );
}
