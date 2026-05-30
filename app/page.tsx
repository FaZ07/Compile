"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import RealityGraph, { type NodeStateMap } from "@/components/RealityGraph";
import Reveal from "@/components/Reveal";
import Counter from "@/components/Counter";
import Sticky from "@/components/Sticky";
import { SourceLogo, GitHubLogo, ArrowUR } from "@/components/logos";
import { normalize, recencyLabel, repoScore } from "@/lib/metrics";
import { SPRING, riseIn, submitShake } from "@/lib/motion";
import { parseSSE } from "@/lib/sse";
import {
  SOURCES, NODE_ORDER,
  type CompileEvent, type Intent, type NodeId, type NodeResult, type Synthesis, type CompileMetrics,
  type Level, type Goal, type Paper, type Repo, type Tutorial, type Discussion, type TrendData, type ContextData,
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

  const reset = () => { setPhase("idle"); setError(null); setStatus("AWAITING INTENT"); };

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <TopBar onHome={reset} />
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
          <Dossier key="dos" intent={intent} synthesis={synthesis} metrics={metrics} results={results} facts={facts} onReset={reset} />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ── top bar ────────────────────────────────────────────────── */
function TopBar({ onHome }: { onHome: () => void }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 px-4 lg:px-7 py-3 flex items-center justify-between" style={{ borderBottom: "2px solid var(--ink)", background: "var(--paper)" }}>
      <button onClick={onHome} className="press btn-ink px-3 py-1.5 flex items-center gap-2">
        <span className="display text-[1rem]">COMPILE</span>
        <span className="mono text-[0.5rem]" style={{ color: "var(--stamp)" }}>v2.0</span>
      </button>
      <div className="hidden md:flex items-center gap-1.5">
        {["CONSOLE", "DOSSIER", "GRAPH", "RADAR", "ARCHIVES"].map((l, i) => (
          <span key={l} className="mono text-[0.6rem] px-2.5 py-1.5 tracking-widest" style={{ color: i === 0 ? "var(--ink)" : "var(--ink-3)" }}>{l}</span>
        ))}
      </div>
      <a href="https://anakin.io/wire" target="_blank" rel="noreferrer" className="press btn-stamp px-3 py-1.5 mono text-[0.62rem] flex items-center gap-1.5">WIRE <ArrowUR s={12} /></a>
    </header>
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
  const allIdle = useMemo(() => Object.fromEntries(NODE_ORDER.map((k) => [k, "idle"])) as NodeStateMap, []);
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="relative min-h-screen w-full">
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ opacity: 0.5 }}><RealityGraph nodes={NODE_ORDER} states={allIdle} phase="idle" /></div>

      <div className="relative z-10 mx-auto max-w-3xl px-5 pt-28 pb-24">
        <motion.div variants={riseIn} initial="hidden" animate="show" className="mb-4 flex items-center gap-3">
          <span className="cert">◇ AUTONOMOUS INTERNET INTELLIGENCE COMPILER</span>
        </motion.div>

        <motion.h1 variants={riseIn} initial="hidden" animate="show" custom={1} className="display text-[clamp(2.4rem,7vw,4.6rem)]">
          COMPILE THE INTERNET.
        </motion.h1>
        <motion.p variants={riseIn} initial="hidden" animate="show" custom={2} className="mt-3 text-[1.02rem] leading-relaxed max-w-xl" style={{ color: "var(--ink-2)" }}>
          Not a chatbot. Not search. COMPILE reconciles fragmented public signals — research, code, community, market — into executable strategic intelligence. <strong>Link an intention.</strong>
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
      <div className="fixed inset-0 z-0"><RealityGraph nodes={ids} states={p.states} phase="compiling" /></div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-24 grid gap-4 lg:grid-cols-[1fr_360px] pointer-events-none">
        {/* live status + velocity */}
        <div className="brutal p-5 self-start pointer-events-auto" style={{ background: "var(--paper)" }}>
          <p className="label">reconciliation state // {STAGE_LABEL[p.stage] ?? p.stage}</p>
          <p className="display text-[clamp(1.3rem,3vw,2rem)] mt-2 mono" style={{ color: "var(--stamp)", letterSpacing: "0.02em" }}>{p.status}</p>
          <div className="mt-4 flex items-end gap-4">
            <div>
              <p className="label">field velocity</p>
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

/* ── dossier report (page 2 inline) ─────────────────────────── */
function Dossier(p: { intent: Intent; synthesis: Synthesis; metrics: CompileMetrics; results: Record<string, NodeResult>; facts: string[]; onReset: () => void }) {
  const [tab, setTab] = useState<"code" | "papers" | "tutorials">("code");
  const { metrics: m, synthesis: s, results: r } = p;
  const context = r.context?.data as ContextData | undefined;
  const repos = (r.code?.data as Repo[] | undefined) ?? [];
  const papers = (r.papers?.data as Paper[] | undefined) ?? [];
  const tutorials = (r.tutorials?.data as Tutorial[] | undefined) ?? [];
  const community = (r.community?.data as Discussion[] | undefined) ?? [];
  const trends = r.trends?.data as TrendData | undefined;
  const maxStars = repos.reduce((a, x) => Math.max(a, x.stars), 1);
  const traj = { rising: "↑ RISING", stable: "→ STABLE", declining: "↓ DECLINING" }[m.trajectory];

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="relative">
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ opacity: 0.16 }}>
        <RealityGraph nodes={NODE_ORDER} states={Object.fromEntries(NODE_ORDER.map((k) => [k, r[k]?.ok ? "done" : "error"])) as NodeStateMap} phase="complete" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-5 pt-24 pb-24">
        {/* dossier header */}
        <motion.div variants={riseIn} initial="hidden" animate="show" className="brutal p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap pb-3" style={{ borderBottom: "2px solid var(--ink)" }}>
            <div>
              <p className="label">compiled dossier // {p.intent.goal} · {p.intent.level} · {p.intent.timeframe}</p>
              <h1 className="display text-[clamp(1.8rem,4.6vw,3rem)] mt-1">{p.intent.topic}</h1>
            </div>
            <span className="cert">✓ {m.confidence_label}</span>
          </div>

          {/* intelligence header grid */}
          <div className="grid gap-4 sm:grid-cols-[180px_1fr] mt-4 items-center">
            <div className="text-center brutal-inset p-3">
              <p className="display text-[3.6rem] leading-none">{m.field_velocity}<span className="text-[1rem]" style={{ color: "var(--ink-3)" }}>/100</span></p>
              <p className="label mt-1">field velocity</p>
              <p className="mono text-[0.7rem] mt-2 px-2 py-1" style={{ background: "var(--stamp)", color: "var(--paper)" }}>{m.ecosystem_state.toUpperCase()} ECOSYSTEM</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="signals" v={m.artifacts_found} />
              <Stat label="sources" v={m.sources_ok} suffix={`/${m.sources_queried}`} />
              <Stat label="latency" v={m.total_latency_ms / 1000} suffix="s" dec={1} />
              <Stat label="confidence" v={m.confidence} suffix="%" />
              <div className="brutal-inset p-2.5"><p className="mono text-[0.9rem] font-bold" style={{ color: "var(--stamp)" }}>{traj}</p><p className="label mt-1" style={{ fontSize: "0.44rem" }}>trajectory</p></div>
              <div className="brutal-inset p-2.5"><p className="mono text-[0.78rem] font-bold">{m.fastest_ms}ms</p><p className="label mt-1" style={{ fontSize: "0.44rem" }}>fastest</p></div>
            </div>
          </div>
        </motion.div>

        {/* velocity breakdown — the bloomberg surface */}
        <Block title="FIELD VELOCITY BREAKDOWN" sub="weighted signal reconciliation">
          <div className="grid gap-2.5">
            {m.breakdown.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="text-[0.78rem] w-44 shrink-0">{f.label}</span>
                <div className="bar-track h-5 flex-1"><div className="h-full flex items-center justify-end pr-1.5" style={{ width: `${Math.max(6, f.value)}%`, background: f.value >= 60 ? "var(--stamp)" : "var(--ink)" }}><span className="mono text-[0.56rem]" style={{ color: "var(--paper)" }}>{f.value}</span></div></div>
                <span className="mono text-[0.56rem] w-10 text-right" style={{ color: "var(--ink-3)" }}>×{f.weight}</span>
              </div>
            ))}
          </div>
        </Block>

        {/* verdict */}
        <Block title="STRATEGIC VERDICT" sub="reconciled intelligence synthesis">
          <Reveal text={s.headline} className="display text-[clamp(1.4rem,3.4vw,2.2rem)]" stagger={40} />
          <p className="mt-4 text-[1rem] leading-relaxed" style={{ color: "var(--ink-2)" }}>{s.summary}</p>
          <div className="mt-3 inline-flex items-center gap-2"><span className="cert">{traj} @ {m.confidence}% CONF</span><span className="text-[0.86rem]" style={{ color: "var(--ink-2)" }}>{s.trend_note}</span></div>
        </Block>

        {/* build compiler — 4-phase blueprint */}
        <Block title="BUILD COMPILER" sub={`${p.intent.timeframe} execution blueprint`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.roadmap.map((ph, i) => (
              <motion.div key={ph.phase} variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} className="brutal-sm bg-transparent p-4">
                <div className="flex items-center justify-between pb-2 mb-2" style={{ borderBottom: "2px solid var(--ink)" }}>
                  <span className="mono text-[0.62rem] font-bold">PHASE {ph.phase} · {ph.title.toUpperCase()}</span>
                  <span className="mono text-[0.56rem] px-1.5 py-0.5" style={{ background: "var(--ink)", color: "var(--paper)" }}>{ph.duration}</span>
                </div>
                <ul className="grid gap-1.5">
                  {ph.objectives.map((o, j) => (
                    <li key={j} className="flex items-start gap-2 text-[0.82rem]"><span className="mono mt-0.5" style={{ color: "var(--stamp)" }}>☐</span>{o}</li>
                  ))}
                </ul>
                {ph.resources.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{ph.resources.map((rs, j) => <span key={j} className="mono text-[0.56rem] px-1.5 py-0.5" style={{ border: "1px solid var(--ink-3)", color: "var(--ink-3)" }}>{rs.slice(0, 38)}</span>)}</div>}
              </motion.div>
            ))}
          </div>
        </Block>

        {/* ranked implementations */}
        <Block title="RANKED IMPLEMENTATIONS" sub="deterministic repo scoring">
          <div className="flex gap-0 mb-3" style={{ width: "fit-content", border: "2px solid var(--ink)" }}>
            {(["code", "papers", "tutorials"] as const).map((t, i) => (
              <button key={t} onClick={() => setTab(t)} className="mono text-[0.64rem] px-3 py-1.5 press"
                style={{ borderLeft: i ? "2px solid var(--ink)" : "none", background: tab === t ? "var(--ink)" : "var(--paper)", color: tab === t ? "var(--paper)" : "var(--ink-2)" }}>
                {t === "code" ? `CODE ${repos.length}` : t === "papers" ? `PAPERS ${papers.length}` : `TUTORIALS ${tutorials.length}`}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            {tab === "code" && (
              <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-2">
                {repos.map((rp, i) => { const sc = repoScore(rp, maxStars); return (
                  <a key={i} href={rp.url} target="_blank" rel="noreferrer" className="press brutal-sm bg-transparent p-3 flex items-center gap-3">
                    <span className="mono text-[0.7rem] w-6" style={{ color: "var(--ink-3)" }}>{String(i + 1).padStart(2, "0")}</span>
                    <GitHubLogo s={16} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-[0.86rem]">{rp.full_name}</span><span className="mono text-[0.54rem] px-1 py-0.5" style={{ border: "1px solid var(--ink-3)", color: "var(--ink-3)" }}>{rp.language}</span><span className="mono text-[0.54rem]" style={{ color: "var(--ink-3)" }}>{recencyLabel(rp.pushed_days_ago)}</span></div>
                      <p className="text-[0.76rem] mt-0.5 line-clamp-2" style={{ color: "var(--ink-2)" }}>{rp.description}</p>
                    </div>
                    <div className="text-right shrink-0 w-16"><p className="mono text-[1.1rem] font-bold" style={{ color: sc >= 60 ? "var(--stamp)" : "var(--ink)" }}>{sc}</p><p className="mono text-[0.46rem]" style={{ color: "var(--ink-3)" }}>SIGNAL · ★{(rp.stars / 1000).toFixed(0)}k</p></div>
                  </a>
                ); })}
                {!repos.length && <Empty />}
              </motion.div>
            )}
            {tab === "papers" && (
              <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-2">
                {papers.map((pp, i) => (
                  <a key={i} href={pp.url} target="_blank" rel="noreferrer" className="press brutal-sm bg-transparent p-3 block">
                    <div className="flex items-start justify-between gap-2"><span className="font-bold text-[0.86rem] leading-snug">{pp.title}</span><span className="mono text-[0.54rem] px-1.5 py-0.5 shrink-0" style={{ background: "var(--ink)", color: "var(--paper)" }}>{pp.year}</span></div>
                    <p className="mono text-[0.58rem] mt-1 italic" style={{ color: "var(--ink-3)" }}>{pp.authors.join(", ")} · {pp.category}</p>
                    <p className="text-[0.76rem] mt-1.5 line-clamp-2" style={{ color: "var(--ink-2)" }}>{pp.abstract}</p>
                  </a>
                ))}
                {!papers.length && <Empty />}
              </motion.div>
            )}
            {tab === "tutorials" && (
              <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-2">
                {tutorials.map((tt, i) => (
                  <a key={i} href={tt.url} target="_blank" rel="noreferrer" className="press brutal-sm bg-transparent p-3 flex items-center gap-3">
                    <SourceLogo source={tt.platform} />
                    <div className="flex-1 min-w-0"><p className="font-bold text-[0.84rem] leading-snug">{tt.title}</p><p className="mono text-[0.56rem] mt-0.5" style={{ color: "var(--ink-3)" }}>{tt.author} · {tt.platform}{tt.read_min ? ` · ${tt.read_min}min` : ""}{tt.views ? ` · ${(tt.views / 1000).toFixed(0)}k views` : ""}</p></div>
                    <ArrowUR s={13} />
                  </a>
                ))}
                {!tutorials.length && <Empty />}
              </motion.div>
            )}
          </AnimatePresence>
        </Block>

        {/* community reality engine — redacted */}
        {community.length > 0 && (
          <Block title="COMMUNITY REALITY ENGINE" sub="hover to declassify ecosystem friction">
            <div className="grid gap-2">
              {community.slice(0, 5).map((d, i) => (
                <div key={i} className="brutal-sm bg-transparent p-3 flex items-start gap-3">
                  <SourceLogo source={d.source} />
                  <div className="flex-1 min-w-0">
                    <a href={d.url} target="_blank" rel="noreferrer" className="font-bold text-[0.82rem] leading-snug hover:underline">{d.title}</a>
                    <p className="text-[0.74rem] mt-1"><span className="redacted">{d.snippet || "operational friction signal — practitioner feedback diverges from marketing narrative on scalability and production cost."}</span></p>
                    <p className="mono text-[0.54rem] mt-1" style={{ color: "var(--ink-3)" }}>{d.source} · ↑{d.score} · 💬{d.comments}</p>
                  </div>
                </div>
              ))}
            </div>
          </Block>
        )}

        {/* strategic insights */}
        <Block title="STRATEGIC INSIGHTS" sub="high-conviction conclusions">
          <div className="grid gap-2">
            {s.insights.map((ins, i) => (
              <div key={i} className="brutal-sm bg-transparent p-3 flex gap-3"><span className="mono text-[0.6rem] font-bold shrink-0" style={{ color: "var(--stamp)" }}>{String(i + 1).padStart(2, "0")}</span><p className="text-[0.86rem] leading-relaxed">{ins}</p></div>
            ))}
          </div>
        </Block>

        {/* build this */}
        <Block title="EXECUTION TARGETS" sub="ranked by difficulty">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {s.projects.map((pr, i) => (
              <div key={i} className="brutal-sm bg-transparent p-4">
                <div className="flex items-center justify-between mb-1.5"><span className="mono text-[0.54rem]" style={{ color: "var(--ink-3)" }}>{["STARTER", "INTERMEDIATE", "ADVANCED"][pr.difficulty - 1]}</span><span>{Array.from({ length: 3 }).map((_, j) => <span key={j} style={{ color: j < pr.difficulty ? "var(--stamp)" : "var(--ink-3)" }}>■</span>)}</span></div>
                <p className="font-bold text-[0.88rem] leading-snug">{pr.title}</p>
                <p className="text-[0.74rem] mt-1.5" style={{ color: "var(--ink-2)" }}>{pr.why}</p>
              </div>
            ))}
          </div>
        </Block>

        {/* trend intel */}
        {trends && (
          <Block title="MARKET INTELLIGENCE" sub="wire-ready · YC · Product Hunt · TechCrunch">
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="brutal-sm bg-transparent p-3"><p className="label mb-2">tooling consolidation</p><div className="flex flex-wrap gap-1.5">{trends.hot_tools.map((t) => <span key={t} className="mono text-[0.62rem] px-1.5 py-0.5" style={{ background: "var(--stamp)", color: "var(--paper)" }}>{t}</span>)}</div></div>
              <div className="brutal-sm bg-transparent p-3"><p className="label mb-2">venture placement</p>{trends.companies.map((c) => <p key={c} className="text-[0.78rem]">▸ {c}</p>)}</div>
              <div className="brutal-sm bg-transparent p-3"><p className="label mb-2">launch momentum</p>{trends.launches.map((l) => <p key={l} className="text-[0.78rem]">▸ {l}</p>)}</div>
            </div>
          </Block>
        )}

        {/* sticky facts */}
        {p.facts.length > 0 && <div className="mt-10 grid gap-5 sm:grid-cols-3">{p.facts.slice(0, 3).map((f, i) => <Sticky key={i} text={f} index={i} />)}</div>}

        {context && (
          <div className="brutal-inset mt-10 p-4">
            <div className="flex items-center gap-2 mb-1.5"><SourceLogo source="wikipedia" /><span className="label">context · wikipedia</span></div>
            <p className="text-[0.82rem] leading-relaxed" style={{ color: "var(--ink-2)" }}>{context.summary}</p>
          </div>
        )}

        <div className="mt-12 flex items-center justify-between gap-4 flex-wrap pt-4 rule">
          <p className="mono text-[0.62rem]" style={{ color: "var(--ink-3)" }}>fastest pipeline reconciled in {m.fastest_ms}ms · {m.confidence_label.toLowerCase()}</p>
          <button onClick={p.onReset} className="press btn-ink px-6 py-3 text-[0.86rem]">COMPILE ANOTHER</button>
        </div>
      </div>
    </motion.section>
  );
}

/* ── shared bits ────────────────────────────────────────────── */
function Block({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="mt-6 brutal p-5">
      <div className="flex items-baseline justify-between mb-4 pb-2" style={{ borderBottom: "2px solid var(--ink)" }}>
        <h2 className="display text-[1.25rem]">{title}</h2><span className="label">{sub}</span>
      </div>
      {children}
    </motion.div>
  );
}
function Stat({ label, v, suffix = "", dec = 0 }: { label: string; v: number; suffix?: string; dec?: number }) {
  return <div className="brutal-inset p-2.5"><p className="mono text-[1.1rem] font-bold"><Counter to={v} decimals={dec} suffix={suffix} duration={1.2} /></p><p className="label mt-1" style={{ fontSize: "0.44rem" }}>{label}</p></div>;
}
function Empty() { return <div className="brutal-sm bg-transparent p-6 text-center mono text-[0.7rem]" style={{ color: "var(--ink-3)" }}>NO SIGNAL — BROADEN INTENT</div>; }
