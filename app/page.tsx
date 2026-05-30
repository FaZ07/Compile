"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import RealityGraph, { type NodeStateMap } from "@/components/RealityGraph";
import Reveal from "@/components/Reveal";
import Counter from "@/components/Counter";
import Sticky from "@/components/Sticky";
import { SourceLogo, GitHubLogo, ArrowUR, GradCapIcon, PencilDoodle, PaperclipDoodle, StarDoodle, BookmarkDoodle } from "@/components/logos";
import { normalize, recencyLabel } from "@/lib/metrics";
import { parseSSE } from "@/lib/sse";
import {
  SOURCES, NODE_ORDER,
  type CompileEvent, type Intent, type NodeId, type NodeResult, type Synthesis, type CompileMetrics,
  type Level, type Goal, type Paper, type Repo, type Tutorial, type Discussion, type TrendData, type ContextData,
} from "@/lib/types";

/* ── constants ──────────────────────────────────────────────── */
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const GOALS: { id: Goal; icon: string; label: string }[] = [
  { id: "learn", icon: "📚", label: "Learn" },
  { id: "build", icon: "🔧", label: "Build" },
  { id: "research", icon: "🔬", label: "Research" },
  { id: "career", icon: "💼", label: "Career" },
  { id: "startup", icon: "🚀", label: "Startup" },
];
const DEPTHS = ["weekend", "1 week", "1 month", "3 months"];

type Sample = { topic: string; level: Level; goal: Goal; free: string };
const SAMPLES: Sample[] = [
  { topic: "RAG systems",        level: "intermediate", goal: "build",    free: "ship a production retrieval pipeline" },
  { topic: "AI agents",          level: "beginner",     goal: "learn",    free: "understand how autonomous agents reason" },
  { topic: "Rust",               level: "beginner",     goal: "career",   free: "land a systems-programming role" },
  { topic: "diffusion models",   level: "advanced",     goal: "research", free: "read the field's frontier papers" },
];

const STAGE_LABEL: Record<string, string> = {
  parse: "Parsing intent", compile: "Compiling graph", fetch: "Querying the internet",
  metrics: "Measuring the field", synthesize: "Synthesising plan", done: "Done",
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
  const tick = useRef<number | null>(null);

  const run = useCallback(async () => {
    if (!topic.trim()) return;
    setError(null); setStage("parse"); setIntent(null); setNodes([]); setStates({});
    setResults({}); setMetrics(null); setSynthesis(null); setFacts([]);
    setLog([`$ compile "${topic}" --level ${level} --goal ${goal}`]);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "compile failed");
    } finally {
      if (tick.current) window.clearInterval(tick.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, level, goal, depth, free]);

  const apply = (ev: CompileEvent) => {
    switch (ev.type) {
      case "stage":
        setStage(ev.stage);
        setLog((l) => [...l, `· ${(STAGE_LABEL[ev.stage] ?? ev.stage).toLowerCase()}…`]);
        if (ev.stage === "done") setTimeout(() => setPhase("complete"), 700);
        break;
      case "intent":
        setIntent(ev.intent);
        setLog((l) => [...l, `· topic=${ev.intent.topic} level=${ev.intent.level} goal=${ev.intent.goal}`]);
        break;
      case "dag":
        setNodes(ev.nodes);
        setStates(Object.fromEntries(ev.nodes.map((n) => [n, "idle"])) as NodeStateMap);
        break;
      case "node:start":
        setStates((s) => ({ ...s, [ev.id]: "running" }));
        setLog((l) => [...l, `→ ${ev.id} · ${SOURCES[ev.id].source.toLowerCase()}`]);
        break;
      case "node:done":
        setStates((s) => ({ ...s, [ev.id]: ev.result.ok ? "done" : "error" }));
        setResults((r) => ({ ...r, [ev.id]: ev.result }));
        setLog((l) => [...l, ev.result.ok ? `✓ ${ev.id} · ${ev.result.count} found · ${ev.result.duration_ms}ms` : `✗ ${ev.id} failed`]);
        break;
      case "fact":
        setFacts((f) => [...f, ev.fact]);
        setLog((l) => [...l, `💡 ${ev.fact}`]);
        break;
      case "metrics": setMetrics(ev.metrics); break;
      case "synthesis": setSynthesis(ev.synthesis); break;
      case "error": setError(ev.message); break;
    }
  };

  const reset = () => { setPhase("idle"); setError(null); };

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={{ background: "var(--obsidian)" }}>
      <TopBar onHome={reset} />
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <Idle key="idle"
            topic={topic} setTopic={setTopic} level={level} setLevel={setLevel}
            goal={goal} setGoal={setGoal} depth={depth} setDepth={setDepth}
            free={free} setFree={setFree} onRun={run} error={error}
            onSample={(s) => { setTopic(s.topic); setLevel(s.level); setGoal(s.goal); setFree(s.free); }}
          />
        )}
        {phase === "compiling" && (
          <Compiling key="cmp" topic={topic} intent={intent} nodes={nodes} states={states}
            stage={stage} log={log} elapsed={elapsed} error={error} />
        )}
        {phase === "complete" && synthesis && intent && metrics && (
          <Report key="rep" intent={intent} synthesis={synthesis} metrics={metrics}
            results={results} facts={facts} onReset={reset} />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ── nav ────────────────────────────────────────────────────── */
function TopBar({ onHome }: { onHome: () => void }) {
  return (
    <header className="fixed top-4 inset-x-0 z-50 px-5 lg:px-9 flex items-center justify-between">
      <button onClick={onHome} className="glass rounded-full flex items-center gap-2 pl-3 pr-4" style={{ height: 44 }}>
        <GradCapIcon c="#d4af37" s={17} />
        <span className="font-extrabold tracking-tight text-[0.98rem]">compile</span>
      </button>
      <div className="hidden md:flex glass rounded-full px-1.5 py-1.5 items-center gap-0.5">
        {["Console", "Sources", "Method"].map((l) => (
          <span key={l} className="px-3.5 py-1.5 text-[0.8rem] font-medium text-silver cursor-default">{l}</span>
        ))}
      </div>
      <a href="https://anakin.io/wire" target="_blank" rel="noreferrer"
        className="bg-white text-black rounded-full flex items-center gap-1.5 px-4 font-semibold text-[0.8rem]" style={{ height: 44 }}>
        Anakin Wire <ArrowUR s={14} />
      </a>
    </header>
  );
}

/* ── segmented control ──────────────────────────────────────── */
function Seg<T extends string>({ value, options, onChange, render }: {
  value: T; options: T[]; onChange: (v: T) => void; render?: (v: T) => React.ReactNode;
}) {
  return (
    <div className="inline-flex glass rounded-full p-1 gap-0.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`rounded-full px-3 py-1.5 text-[0.74rem] font-medium transition-all ${value === o ? "bg-[var(--gold)] text-black" : "text-silver hover:text-white"}`}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

/* ── idle / console ─────────────────────────────────────────── */
function Idle(p: {
  topic: string; setTopic: (s: string) => void; level: Level; setLevel: (l: Level) => void;
  goal: Goal; setGoal: (g: Goal) => void; depth: string; setDepth: (d: string) => void;
  free: string; setFree: (s: string) => void; onRun: () => void; error: string | null;
  onSample: (s: Sample) => void;
}) {
  const allIdle = useMemo(() => Object.fromEntries(NODE_ORDER.map((k) => [k, "idle"])) as NodeStateMap, []);
  return (
    <motion.section initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative min-h-screen w-full">
      <div className="fixed inset-0 z-0 pointer-events-none"><RealityGraph nodes={NODE_ORDER} states={allIdle} phase="idle" /></div>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse at center, transparent 26%, rgba(5,5,5,0.86) 76%)" }} />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-5 py-28 text-center">
        <div className="boot" style={{ animationDelay: "0.05s" }}>
          <div className="glass rounded-full inline-flex items-center gap-2 pr-3.5 pl-1 py-1">
            <span className="bg-[var(--cyan)] text-black px-2.5 py-0.5 text-[0.6rem] font-bold rounded-full">LIVE</span>
            <span className="text-[0.78rem] text-silver">6 sources · 5 live APIs · one plan in ~10s</span>
          </div>
        </div>

        <div className="boot mt-5 flex items-center gap-2.5 opacity-60" style={{ animationDelay: "0.15s" }}>
          <PencilDoodle /><PaperclipDoodle /><StarDoodle /><BookmarkDoodle />
        </div>

        <h1 className="display text-[clamp(2.7rem,8vw,5.6rem)] mt-3">
          <Reveal text="Say what you" delay={0.2} className="block" />
          <Reveal text="want to learn." delay={0.45} className="block gold-text" />
        </h1>

        <p className="boot mt-5 max-w-xl text-[0.96rem] leading-relaxed text-silver" style={{ animationDelay: "0.9s" }}>
          COMPILE fires papers, code, tutorials, community, and trends across the live internet — in parallel — then reconciles one executable plan with real-time comparative metrics. Not a chatbot. A reality compiler.
        </p>

        {/* console */}
        <div className="boot mt-8 w-full max-w-2xl" style={{ animationDelay: "1.05s" }}>
          <div className="glass-strong rounded-[1.5rem] p-5 sm:p-6 text-left">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="mono text-[var(--cyan)] text-sm">$</span>
              <span className="eyebrow">compile console</span>
              <span className="ml-auto flex items-center gap-1.5 mono text-[0.56rem] text-ash">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--cyan)] pulse-dot" /> READY
              </span>
            </div>

            {/* topic */}
            <div className="flex items-center gap-2 glass rounded-xl px-4 py-3">
              <span className="eyebrow text-[0.46rem] shrink-0">TOPIC</span>
              <input value={p.topic} onChange={(e) => p.setTopic(e.target.value)} autoFocus
                placeholder="RAG systems, Rust, transformers…"
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") p.onRun(); }}
                className="flex-1 bg-transparent text-[clamp(1.05rem,2vw,1.4rem)] font-semibold text-white placeholder-white/25 focus:outline-none" />
            </div>

            {/* controls */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5">
              <div className="flex items-center gap-2">
                <span className="eyebrow text-[0.46rem]">LEVEL</span>
                <Seg value={p.level} options={LEVELS} onChange={p.setLevel} render={(v) => v[0].toUpperCase() + v.slice(1)} />
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <span className="eyebrow text-[0.46rem]">GOAL</span>
              <div className="inline-flex glass rounded-full p-1 gap-0.5 flex-wrap">
                {GOALS.map((g) => (
                  <button key={g.id} onClick={() => p.setGoal(g.id)}
                    className={`rounded-full px-2.5 py-1.5 text-[0.74rem] font-medium transition-all flex items-center gap-1 ${p.goal === g.id ? "bg-[var(--gold)] text-black" : "text-silver hover:text-white"}`}>
                    <span className="text-[0.7rem]">{g.icon}</span>{g.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="eyebrow text-[0.46rem]">DEPTH</span>
              <Seg value={p.depth} options={DEPTHS} onChange={p.setDepth} />
            </div>

            {/* free intent */}
            <textarea value={p.free} onChange={(e) => p.setFree(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") p.onRun(); }}
              rows={2} placeholder="add nuance — 'I want to build a startup', 'ace interviews'…"
              className="mt-4 block w-full resize-none bg-transparent text-[0.9rem] leading-relaxed text-silver placeholder-white/20 focus:outline-none" />

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="mono text-[0.55rem] text-ash">⌘/CTRL + ENTER</span>
              <button onClick={p.onRun}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[var(--gold)] px-7 py-2.5 font-bold text-black transition-transform hover:scale-[1.03] active:scale-95">
                <span className="relative z-10">COMPILE</span><ArrowUR s={15} className="relative z-10" />
              </button>
            </div>
          </div>

          {/* sample chips */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {SAMPLES.map((s) => (
              <button key={s.topic} onClick={() => p.onSample(s)}
                className="glass rounded-full px-3 py-1.5 text-[0.72rem] text-silver hover:text-white transition-colors flex items-center gap-1.5">
                {GOALS.find((g) => g.id === s.goal)?.icon} {s.topic}
              </button>
            ))}
          </div>

          {/* source chips */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {NODE_ORDER.map((id) => (
              <span key={id} className="glass rounded-full px-2.5 py-1 text-[0.62rem] flex items-center gap-1.5">
                <SourceLogo source={SOURCES[id].source} />
                <span className="text-silver">{SOURCES[id].source}</span>
                <span className={SOURCES[id].live ? "cyan-text" : "gold-text"}>{SOURCES[id].live ? "●" : "○"}</span>
              </span>
            ))}
          </div>
          {p.error && <p className="mt-4 text-center text-sm" style={{ color: "var(--ember)" }}>{p.error}</p>}
        </div>
      </div>

      <Landing />
    </motion.section>
  );
}

/* ── compiling theatre ──────────────────────────────────────── */
function Compiling(p: {
  topic: string; intent: Intent | null; nodes: NodeId[]; states: NodeStateMap;
  stage: string; log: string[]; elapsed: number; error: string | null;
}) {
  const ids = p.nodes.length ? p.nodes : NODE_ORDER;
  const done = ids.filter((n) => p.states[n] === "done" || p.states[n] === "error").length;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [p.log]);

  return (
    <motion.section initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative min-h-screen w-full">
      <div className="fixed inset-0 z-0"><RealityGraph nodes={ids} states={p.states} phase="compiling" /></div>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse at center, transparent 42%, rgba(5,5,5,0.6) 88%)" }} />

      <div className="relative z-10 mx-auto max-w-7xl px-5 lg:px-9 pt-24 grid gap-5 md:grid-cols-[1fr_auto] pointer-events-none">
        <div className="glass rounded-2xl p-5 self-start max-w-sm pointer-events-auto">
          <div className="flex items-center gap-2 mb-2"><GradCapIcon /><p className="eyebrow">compiling</p></div>
          <p className="text-[1.15rem] font-semibold leading-snug">{p.topic}</p>
          {p.intent && (
            <div className="mono mt-3 flex flex-wrap gap-1.5 text-[0.6rem]">
              {[p.intent.level, p.intent.goal, p.intent.timeframe].map((x) => (
                <span key={x} className="glass rounded-full px-2 py-0.5 text-silver">{x}</span>
              ))}
            </div>
          )}
          {/* node status pills */}
          <div className="mt-4 grid grid-cols-2 gap-1.5">
            {ids.map((id) => {
              const st = p.states[id] ?? "idle";
              return (
                <div key={id} className="glass rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                  <SourceLogo source={SOURCES[id].source} />
                  <span className="text-[0.64rem] text-silver flex-1 truncate">{SOURCES[id].label}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${st === "done" ? "bg-[var(--gold)]" : st === "running" ? "bg-[var(--cyan)] pulse-dot" : st === "error" ? "bg-[var(--ember)]" : "bg-white/20"}`} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-2xl p-5 self-start md:justify-self-end md:text-right min-w-[200px] pointer-events-auto">
          <p className="eyebrow cyan-text">{STAGE_LABEL[p.stage] ?? p.stage}</p>
          <p className="mono mt-2 text-[2.4rem] font-bold leading-none"><span className="gold-text">{done}</span><span className="text-white/30">/{ids.length}</span></p>
          <p className="mono mt-1 text-[0.62rem] text-ash">{(p.elapsed / 1000).toFixed(2)}s elapsed</p>
        </div>
      </div>

      {/* terminal */}
      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="mx-auto max-w-7xl px-5 lg:px-9 pb-5">
          <div className="glass-strong rounded-2xl p-4">
            <div className="mono text-[0.7rem] leading-relaxed max-h-32 overflow-y-auto pr-2">
              {p.log.map((l, i) => (
                <div key={i} className={l.startsWith("✓") ? "gold-text" : l.startsWith("✗") ? "" : l.startsWith("→") ? "cyan-text" : l.startsWith("💡") ? "text-[#e8d48a]" : "text-silver/70"} style={l.startsWith("✗") ? { color: "var(--ember)" } : undefined}>{l}</div>
              ))}
              <div ref={end} />
            </div>
          </div>
        </div>
      </div>
      {p.error && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 glass rounded-full px-4 py-2 text-xs" style={{ color: "var(--ember)" }}>{p.error}</div>}
    </motion.section>
  );
}

/* ── field velocity gauge ───────────────────────────────────── */
function Gauge({ value }: { value: number }) {
  const R = 58, C = 2 * Math.PI * R, pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative grid place-items-center" style={{ width: 150, height: 150 }}>
      <svg width="150" height="150" className="-rotate-90">
        <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <circle cx="75" cy="75" r={R} fill="none" stroke="var(--gold)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(0.22,1,0.36,1)", filter: "drop-shadow(0 0 6px rgba(212,175,55,0.5))" }} />
      </svg>
      <div className="absolute text-center">
        <div className="mono text-[2.4rem] font-bold leading-none gold-text"><Counter to={value} duration={1.6} /></div>
        <div className="eyebrow text-[0.46rem] mt-1">field velocity</div>
      </div>
    </div>
  );
}

function Trajectory({ t }: { t: "rising" | "stable" | "declining" }) {
  const map = { rising: { c: "var(--cyan)", a: "↑", l: "RISING" }, stable: { c: "var(--silver)", a: "→", l: "STABLE" }, declining: { c: "var(--ember)", a: "↓", l: "DECLINING" } };
  const m = map[t];
  return <span className="mono text-[0.8rem] font-bold inline-flex items-center gap-1.5" style={{ color: m.c }}>{m.a} {m.l}</span>;
}

/* ── report ─────────────────────────────────────────────────── */
function Report(p: {
  intent: Intent; synthesis: Synthesis; metrics: CompileMetrics;
  results: Record<string, NodeResult>; facts: string[]; onReset: () => void;
}) {
  const [tab, setTab] = useState<"code" | "papers" | "tutorials">("code");
  const { metrics: m, synthesis: s, results: r } = p;

  const context     = r.context?.data    as ContextData  | undefined;
  const repos       = (r.code?.data        as Repo[]        | undefined) ?? [];
  const papers      = (r.papers?.data     as Paper[]       | undefined) ?? [];
  const tutorials   = (r.tutorials?.data   as Tutorial[]    | undefined) ?? [];
  const community   = (r.community?.data   as Discussion[]  | undefined) ?? [];
  const trends      = r.trends?.data       as TrendData     | undefined;
  const maxStars = repos.reduce((a, x) => Math.max(a, x.stars), 1);

  return (
    <motion.section initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative">
      <div className="fixed inset-0 z-0 opacity-25 pointer-events-none">
        <RealityGraph nodes={NODE_ORDER} states={Object.fromEntries(NODE_ORDER.map((k) => [k, r[k]?.ok ? "done" : "error"])) as NodeStateMap} phase="complete" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse at top, transparent 18%, rgba(5,5,5,0.9) 80%)" }} />

      <div className="relative z-10 mx-auto max-w-5xl px-5 pt-28 pb-28">

        {/* meta + report bar */}
        <div className="boot flex items-center justify-between flex-wrap gap-3">
          <div className="glass rounded-full px-3 py-1.5 eyebrow flex items-center gap-2">
            <GradCapIcon s={13} /><span className="gold-text">{p.intent.topic}</span>
            <span className="text-white/25">/</span><span>{p.intent.level}</span>
            <span className="text-white/25">/</span><span>{p.intent.goal}</span>
          </div>
          <span className="glass glass-gold rounded-full px-3 py-1.5 mono text-[0.56rem] gold-text">✓ COMPILED · {m.sources_ok}/{m.sources_queried} SOURCES</span>
        </div>

        <div className="boot mt-5 grid grid-cols-2 md:grid-cols-4 gap-3" style={{ animationDelay: "0.1s" }}>
          <StatTile label="sources queried" value={m.sources_queried} />
          <StatTile label="artifacts found" value={m.artifacts_found} />
          <StatTile label="total latency" value={m.total_latency_ms / 1000} suffix="s" decimals={1} />
          <StatTile label="live APIs" value={m.sources_live} />
        </div>

        {/* hero: gauge + headline */}
        <div className="boot mt-10 grid gap-8 md:grid-cols-[auto_1fr] items-center" style={{ animationDelay: "0.2s" }}>
          <Gauge value={m.field_velocity} />
          <div>
            <Reveal text={s.headline} className="display text-[clamp(1.7rem,4.2vw,3rem)]" stagger={45} />
            <p className="mt-4 text-[1.02rem] leading-relaxed text-silver max-w-xl">{s.summary}</p>
            <div className="mt-3 inline-flex items-center gap-2 glass rounded-full px-3 py-1.5">
              <Trajectory t={m.trajectory} /><span className="text-silver text-[0.82rem]">{s.trend_note}</span>
            </div>
          </div>
        </div>

        {/* roadmap */}
        <Section icon={<BookmarkDoodle />} title="Roadmap" sub={`your ${p.intent.timeframe} plan`} />
        <div className="grid gap-4 sm:grid-cols-2 mt-6">
          {s.roadmap.map((ph, i) => (
            <motion.div key={ph.phase} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }} className="notebook p-5 pl-9">
              <div className="flex items-center justify-between mb-2">
                <span className="mono text-[0.55rem] text-ash">PHASE {ph.phase}</span>
                <span className="glass rounded-full px-2 py-0.5 mono text-[0.56rem] gold-text">{ph.duration}</span>
              </div>
              <h3 className="text-[1.15rem] font-bold">{ph.title}</h3>
              <ul className="mt-2.5 space-y-1.5">
                {ph.objectives.map((o, j) => (
                  <li key={j} className="flex items-start gap-2 text-[0.84rem] text-silver"><span className="gold-text mt-0.5">✓</span>{o}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ph.resources.map((rs, j) => <span key={j} className="glass rounded-full px-2 py-0.5 text-[0.58rem] text-silver">{rs.slice(0, 42)}</span>)}
              </div>
            </motion.div>
          ))}
        </div>

        {/* resources */}
        <Section icon={<GitHubLogo s={15} />} title="Ranked Resources" sub="compared by live signal" />
        <div className="mt-4 flex gap-2">
          {(["code", "papers", "tutorials"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-[0.76rem] font-semibold transition-all ${tab === t ? "bg-[var(--gold)] text-black" : "glass text-silver hover:text-white"}`}>
              {t === "code" ? `📦 Code (${repos.length})` : t === "papers" ? `📄 Papers (${papers.length})` : `🎥 Tutorials (${tutorials.length})`}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "code" && (
            <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 grid gap-2.5">
              {repos.map((rp, i) => (
                <a key={i} href={rp.url} target="_blank" rel="noreferrer" className="glass rounded-xl p-4 flex items-start gap-3 hover:glass-gold transition-all group">
                  <span className="mono text-[0.7rem] text-ash mt-1 w-5 shrink-0">#{i + 1}</span>
                  <GitHubLogo s={18} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold group-hover:gold-text transition-colors">{rp.full_name}</span>
                      <span className="glass rounded-full px-2 py-0.5 text-[0.58rem] text-silver">{rp.language}</span>
                      <span className="mono text-[0.58rem] text-ash">{recencyLabel(rp.pushed_days_ago)}</span>
                    </div>
                    <p className="text-silver text-[0.82rem] mt-1 line-clamp-2">{rp.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="bar-track h-1.5 flex-1 max-w-[200px]"><div className="h-full rounded-full" style={{ width: `${normalize(rp.stars, repos.map((x) => x.stars)) * 100}%`, background: "var(--gold)" }} /></div>
                      <span className="mono text-[0.62rem] gold-text">★ {rp.stars.toLocaleString()}</span>
                    </div>
                  </div>
                </a>
              ))}
              {!repos.length && <Empty />}
            </motion.div>
          )}
          {tab === "papers" && (
            <motion.div key="papers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 grid gap-2.5">
              {papers.map((pp, i) => (
                <a key={i} href={pp.url} target="_blank" rel="noreferrer" className="glass rounded-xl p-4 hover:glass-gold transition-all group block">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold group-hover:gold-text transition-colors leading-snug">{pp.title}</p>
                    <span className="glass rounded-full px-2 py-0.5 mono text-[0.56rem] cyan-text shrink-0">{pp.year}</span>
                  </div>
                  <p className="mono text-[0.6rem] text-ash mt-1 italic">{pp.authors.join(", ")} · {pp.category}</p>
                  <p className="text-silver text-[0.82rem] mt-2 line-clamp-2">{pp.abstract}</p>
                </a>
              ))}
              {!papers.length && <Empty />}
            </motion.div>
          )}
          {tab === "tutorials" && (
            <motion.div key="tut" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 grid gap-2.5">
              {tutorials.map((tt, i) => (
                <a key={i} href={tt.url} target="_blank" rel="noreferrer" className="glass rounded-xl p-4 flex items-start gap-3 hover:glass-gold transition-all group">
                  <div className="mt-0.5 shrink-0"><SourceLogo source={tt.platform} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold group-hover:gold-text transition-colors leading-snug">{tt.title}</p>
                    <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                      <span className="mono text-[0.6rem] text-ash">{tt.author}</span>
                      <span className="mono text-[0.58rem] cyan-text">{tt.platform}</span>
                      {tt.read_min && <span className="mono text-[0.58rem] text-ash">{tt.read_min} min</span>}
                      {tt.reactions != null && <span className="mono text-[0.58rem] text-ash">♥ {tt.reactions}</span>}
                      {tt.views != null && <span className="mono text-[0.58rem] text-ash">{(tt.views / 1000).toFixed(0)}k views</span>}
                    </div>
                  </div>
                  <ArrowUR s={14} className="text-white/20 group-hover:gold-text transition-colors mt-1 shrink-0" />
                </a>
              ))}
              {!tutorials.length && <Empty />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* projects */}
        <Section icon={<PencilDoodle />} title="Build This" sub="projects by difficulty" />
        <div className="grid gap-3 sm:grid-cols-3 mt-6">
          {s.projects.map((pr, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }} className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="mono text-[0.55rem] text-ash">{["STARTER", "INTERMEDIATE", "ADVANCED"][pr.difficulty - 1]}</span>
                <span>{Array.from({ length: 3 }).map((_, j) => <span key={j} className={j < pr.difficulty ? "gold-text" : "text-white/15"}>●</span>)}</span>
              </div>
              <p className="font-semibold text-[0.94rem] leading-snug">{pr.title}</p>
              <p className="text-silver text-[0.78rem] mt-2 leading-snug">{pr.why}</p>
            </motion.div>
          ))}
        </div>

        {/* community + insights */}
        {community.length > 0 && (
          <>
            <Section icon={<PaperclipDoodle />} title="Community Says" sub="reddit + hacker news, ranked by score" />
            <div className="grid gap-2.5 mt-6">
              {community.slice(0, 4).map((d, i) => (
                <a key={i} href={d.url} target="_blank" rel="noreferrer" className="glass rounded-xl p-4 flex items-start gap-3 hover:glass-gold transition-all group">
                  <SourceLogo source={d.source} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium group-hover:text-white leading-snug">{d.title}</p>
                    {d.snippet && <p className="text-silver/70 text-[0.78rem] mt-1 line-clamp-2">{d.snippet}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="mono text-[0.58rem] cyan-text">{d.source}</span>
                      <span className="mono text-[0.58rem] text-ash">↑ {d.score}</span>
                      <span className="mono text-[0.58rem] text-ash">💬 {d.comments}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}

        <Section icon={<StarDoodle />} title="Key Insights" sub="synthesised across all sources" />
        <div className="grid gap-2.5 mt-6">
          {s.insights.map((ins, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.07 * i }} className="glass rounded-xl px-5 py-4 flex gap-4">
              <span className="mono text-[0.56rem] gold-text mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-[0.9rem] leading-relaxed text-silver">{ins}</p>
            </motion.div>
          ))}
        </div>

        {/* trend intelligence + sticky facts */}
        {trends && (
          <>
            <Section icon={<span className="text-sm">🚀</span>} title="Trend Intelligence" sub="wire-ready · YC · Product Hunt · TechCrunch" />
            <div className="grid gap-4 sm:grid-cols-3 mt-6">
              <div className="glass rounded-xl p-5">
                <p className="eyebrow mb-3">hot tools</p>
                <div className="flex flex-wrap gap-1.5">{trends.hot_tools.map((t) => <span key={t} className="glass rounded-full px-2.5 py-1 text-[0.74rem] cyan-text">{t}</span>)}</div>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="eyebrow mb-3">yc companies</p>
                <div className="space-y-1.5">{trends.companies.map((c) => <div key={c} className="flex items-center gap-2 text-[0.82rem] text-silver"><span className="inline-flex items-center justify-center rounded-sm text-[0.5rem] font-bold text-white" style={{ width: 14, height: 14, background: "#FF6600" }}>Y</span>{c}</div>)}</div>
              </div>
              <div className="glass rounded-xl p-5">
                <p className="eyebrow mb-3">ph launches</p>
                <div className="space-y-1.5">{trends.launches.map((l) => <div key={l} className="flex items-center gap-2 text-[0.82rem] text-silver"><span className="inline-flex items-center justify-center rounded-full text-[0.5rem] font-bold text-white" style={{ width: 14, height: 14, background: "#DA552F" }}>P</span>{l}</div>)}</div>
              </div>
            </div>
          </>
        )}

        {/* sticky note facts */}
        {p.facts.length > 0 && (
          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {p.facts.slice(0, 3).map((f, i) => <Sticky key={i} text={f} index={i} />)}
          </div>
        )}

        {/* context footnote */}
        {context && (
          <div className="mt-12 glass rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><SourceLogo source="wikipedia" /><span className="eyebrow">context · wikipedia</span></div>
            <p className="text-silver text-[0.86rem] leading-relaxed">{context.summary}</p>
            <a href={context.url} target="_blank" rel="noreferrer" className="mono text-[0.62rem] cyan-text mt-2 inline-block">read more ↗</a>
          </div>
        )}

        <div className="mt-16 flex items-center justify-between gap-4 flex-wrap">
          <p className="mono text-xs text-ash">fastest source resolved in {p.metrics.fastest_ms}ms</p>
          <button onClick={p.onReset} className="glass rounded-full px-7 py-3.5 text-sm hover:gold-text transition-colors">Compile another topic</button>
        </div>
      </div>
    </motion.section>
  );
}

function StatTile({ label, value, suffix = "", decimals = 0 }: { label: string; value: number; suffix?: string; decimals?: number }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="mono text-[1.8rem] font-bold gold-text leading-none"><Counter to={value} suffix={suffix} decimals={decimals} /></div>
      <div className="eyebrow text-[0.5rem] mt-2">{label}</div>
    </div>
  );
}

function Section({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 mt-16">
      <div className="glass rounded-xl grid place-items-center mt-0.5" style={{ width: 34, height: 34 }}>{icon}</div>
      <div><h2 className="display text-[1.5rem]">{title}</h2><p className="eyebrow text-[0.52rem] mt-1">{sub}</p></div>
    </div>
  );
}

function Empty() { return <div className="glass rounded-xl px-5 py-8 text-center text-ash text-sm">no results — try a broader topic</div>; }

/* ── landing scroll depth ───────────────────────────────────── */
function Landing() {
  const sources = NODE_ORDER.map((id) => SOURCES[id]);
  return (
    <>
      <section className="relative z-10 border-t bg-[var(--obsidian)]" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-10 py-28">
          <p className="eyebrow">// the problem</p>
          <h2 className="display text-[clamp(2rem,5vw,3.6rem)] mt-4">Research is broken. <span className="gold-text">COMPILE fixes it.</span></h2>
          <p className="mt-5 max-w-xl text-silver leading-relaxed">Learning anything means juggling arXiv, GitHub, YouTube, Reddit and ten tabs — manually reconciling what&apos;s good, current, and worth your time. There&apos;s no intelligence layer. Until now.</p>
          <div className="grid gap-5 md:grid-cols-2 mt-12">
            <div className="glass rounded-2xl p-7">
              <p className="eyebrow" style={{ color: "var(--ember)" }}>the manual way</p>
              <ul className="mt-5 space-y-2.5 text-[0.92rem] text-silver/70">
                <li>Skim 20 arXiv abstracts by hand.</li><li>Guess which GitHub repo is alive.</li>
                <li>Fall into a YouTube rabbit hole.</li><li>Dig Reddit for the real opinion.</li><li>Reconcile it all yourself. Burn out.</li>
              </ul>
              <p className="mono mt-7 text-[0.7rem] tracking-widest" style={{ color: "var(--ember)" }}>≈ 3 HRS · 12 TABS · 0 CLARITY</p>
            </div>
            <div className="glass glass-gold rounded-2xl p-7 flex flex-col">
              <p className="eyebrow gold-text">the compile way</p>
              <p className="mt-5 text-[clamp(1.3rem,2.2vw,1.7rem)] font-bold leading-snug">&ldquo;Teach me RAG systems — I want to build a startup.&rdquo;</p>
              <div className="flex-1" />
              <p className="mono mt-7 text-[0.7rem] tracking-widest gold-text">→ ROADMAP + RANKED REPOS + VELOCITY · &lt;12s</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t bg-[var(--obsidian)]" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-10 py-28">
          <p className="eyebrow">// the sources</p>
          <h2 className="display text-[clamp(2rem,5vw,3.6rem)] mt-4">Six systems. <span className="gold-text">One intelligence.</span></h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-12">
            {sources.map((s) => (
              <div key={s.id} className="glass rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><SourceLogo source={s.source} /><span className="font-bold text-[1.05rem]">{s.label}</span></div>
                  <span className="mono text-[0.54rem] tracking-widest rounded-full px-2 py-1" style={{ color: s.live ? "var(--cyan)" : "var(--gold)", background: s.live ? "var(--cyan-dim)" : "var(--gold-dim)" }}>{s.live ? "LIVE" : "WIRE"}</span>
                </div>
                <p className="mono text-[0.6rem] text-ash mt-2">{s.source.toUpperCase()}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-silver/60 text-sm max-w-lg">Five hit real public APIs right now — no key required. One is Wire-ready: a single key flips the trend layer live.</p>
        </div>
      </section>

      <section className="relative z-10 border-t bg-[var(--obsidian)] text-center" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto max-w-4xl px-6 py-32">
          <p className="eyebrow">// the internet was built for websites</p>
          <h2 className="display text-[clamp(2.4rem,6.5vw,4.8rem)] mt-5">We compile it <span className="gold-text">for minds.</span></h2>
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="mt-10 inline-flex items-center gap-2.5 rounded-full bg-[var(--gold)] px-8 py-3.5 font-bold text-black transition-transform hover:scale-[1.03]">Start learning <ArrowUR s={15} /></button>
          <p className="mono mt-14 text-[0.6rem] tracking-[0.3em] text-ash">KNOWLEDGE LAYER · ANAKIN WIRE · GROQ</p>
        </div>
      </section>
    </>
  );
}
