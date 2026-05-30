"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import CompileGraph, { type NodeStateMap } from "@/components/CompileGraph";
import BlurText from "@/components/BlurText";
import { parseSSE } from "@/lib/sse";
import {
  NODE_REGISTRY,
  type CompileEvent,
  type Intent,
  type NodeId,
  type NodeResult,
  type Synthesis,
  type Level,
  type Goal,
  type Paper,
  type Repo,
  type Tutorial,
  type DiscussionPost,
  type TrendSignal,
} from "@/lib/types";

/* ── samples ─────────────────────────────────────────────────── */
type Sample = { topic: string; label: string; level: Level; goal: Goal; intention: string };
const SAMPLES: Sample[] = [
  { topic: "RAG systems",  label: "RAG",        level: "intermediate", goal: "build",    intention: "build a production RAG pipeline" },
  { topic: "AI agents",    label: "AI Agents",  level: "beginner",     goal: "learn",    intention: "understand how autonomous agents work" },
  { topic: "Rust",         label: "Rust",        level: "beginner",     goal: "learn",    intention: "learn systems programming from scratch" },
  { topic: "start an AI company", label: "AI Startup", level: "advanced", goal: "startup", intention: "research the AI startup landscape" },
];

const STAGE_LABELS: Record<string, string> = {
  parse: "Parsing intent", compile: "Compiling knowledge graph",
  fetch: "Querying the internet", synthesize: "Synthesising intelligence", done: "Done",
};

const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const LEVEL_LABEL: Record<Level, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

type Phase = "idle" | "compiling" | "complete";

/* ── source logos ─────────────────────────────────────────────── */
function SourceLogo({ source }: { source: string }) {
  const s = source.toLowerCase();
  if (s.includes("arxiv"))   return <span className="font-bold text-[0.65rem] px-1 py-0.5 rounded bg-[#b31b1b] text-white">Ar</span>;
  if (s.includes("github"))  return <GitHubIcon />;
  if (s.includes("youtube")) return <YouTubeIcon />;
  if (s.includes("reddit"))  return <RedditIcon />;
  if (s.includes("hn") || s.includes("hacker")) return <HNIcon />;
  if (s.includes("dev.to"))  return <DevToIcon />;
  if (s.includes("wikipedia") || s.includes("wiki")) return <WikiIcon />;
  if (s.includes("product hunt") || s.includes("ph")) return <PHIcon />;
  if (s.includes("yc") || s.includes("ycombinator")) return <YCIcon />;
  return <span className="text-[0.65rem] text-ash font-mono">{source.slice(0, 2).toUpperCase()}</span>;
}

/* ── page ─────────────────────────────────────────────────────── */
export default function Page() {
  const [phase, setPhase]         = useState<Phase>("idle");
  const [topic, setTopic]         = useState(SAMPLES[0].topic);
  const [level, setLevel]         = useState<Level>(SAMPLES[0].level);
  const [goal, setGoal]           = useState<Goal>(SAMPLES[0].goal);
  const [intention, setIntention] = useState(SAMPLES[0].intention);
  const [stage, setStage]         = useState("parse");
  const [intent, setIntent]       = useState<Intent | null>(null);
  const [nodes, setNodes]         = useState<NodeId[]>([]);
  const [states, setStates]       = useState<NodeStateMap>({});
  const [results, setResults]     = useState<Record<string, NodeResult>>({});
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null);
  const [log, setLog]             = useState<string[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<number | null>(null);

  const startCompile = useCallback(async () => {
    if (!topic.trim()) return;
    setError(null); setStage("parse"); setIntent(null);
    setNodes([]); setStates({}); setResults({}); setSynthesis(null);
    setLog([`> ${topic}`]);
    setPhase("compiling");
    const t0 = Date.now();
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => setElapsedMs(Date.now() - t0), 80) as unknown as number;

    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intention: `${topic}. ${intention}`, level, goal }),
      });
      if (!res.ok || !res.body) throw new Error(`Server ${res.status}`);
      for await (const ev of parseSSE(res.body)) applyEvent(ev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compile failed.");
    } finally {
      if (tickRef.current) window.clearInterval(tickRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, level, goal, intention]);

  const applyEvent = (ev: CompileEvent) => {
    switch (ev.type) {
      case "stage":
        setStage(ev.stage);
        setLog((l) => [...l, `· ${(STAGE_LABELS[ev.stage] ?? ev.stage).toLowerCase()}…`]);
        if (ev.stage === "done") setTimeout(() => setPhase("complete"), 850);
        break;
      case "intent":
        setIntent(ev.intent);
        setLog((l) => [...l, `· intent → ${ev.intent.topic} · ${ev.intent.level} · ${ev.intent.goal}`]);
        break;
      case "dag":
        setNodes(ev.nodes);
        setStates(Object.fromEntries(ev.nodes.map((n) => [n, "idle"])) as NodeStateMap);
        setLog((l) => [...l, `· dag → ${ev.nodes.length} nodes`]);
        break;
      case "node:start":
        setStates((s) => ({ ...s, [ev.id]: "running" }));
        setLog((l) => [...l, `→ ${ev.id} · ${NODE_REGISTRY[ev.id].source.toLowerCase()}…`]);
        break;
      case "node:done":
        setStates((s) => ({ ...s, [ev.id]: ev.result.ok ? "done" : "error" }));
        setResults((r) => ({ ...r, [ev.id]: ev.result }));
        setLog((l) => [...l, ev.result.ok ? `✓ ${ev.id} in ${ev.result.duration_ms}ms` : `✗ ${ev.id} failed`]);
        break;
      case "synthesis": setSynthesis(ev.synthesis); break;
      case "error":     setError(ev.message);        break;
    }
  };

  const reset = () => { setPhase("idle"); setError(null); };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black">
      <Nav onHome={reset} />
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <Idle key="idle"
            topic={topic} setTopic={setTopic}
            level={level} setLevel={setLevel}
            intention={intention} setIntention={setIntention}
            onCompile={startCompile} error={error}
          />
        )}
        {phase === "compiling" && (
          <Compiling key="comp" topic={topic} intent={intent} nodes={nodes}
            states={states} stage={stage} log={log} elapsedMs={elapsedMs} error={error} />
        )}
        {phase === "complete" && synthesis && intent && (
          <Complete key="done" intent={intent} synthesis={synthesis} results={results} onReset={reset} />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ── nav ──────────────────────────────────────────────────────── */
function Nav({ onHome }: { onHome: () => void }) {
  return (
    <header className="fixed top-4 inset-x-0 z-50 px-6 lg:px-10 flex items-center justify-between">
      <button onClick={onHome} className="liquid-glass rounded-full flex items-center" style={{ height: 46, paddingLeft: 6, paddingRight: 18 }}>
        <span className="grid place-items-center rounded-full" style={{ width: 34, height: 34 }}>
          <BookOpenIcon />
        </span>
        <span className="font-sans font-medium tracking-tight text-platinum text-[0.95rem] ml-1">compile</span>
      </button>
      <div className="hidden md:flex liquid-glass rounded-full px-1.5 py-1.5 items-center gap-0.5">
        {["Research", "Sources", "Roadmap"].map((l) => (
          <span key={l} className="px-3.5 py-2 text-[0.82rem] font-medium text-platinum/80 font-sans cursor-default">{l}</span>
        ))}
      </div>
      <a href="https://anakin.io/wire" target="_blank" rel="noreferrer"
        className="bg-white text-black rounded-full flex items-center gap-1.5 px-4 font-medium text-[0.82rem] whitespace-nowrap" style={{ height: 46 }}>
        Anakin Wire <ArrowUpRightIcon className="h-4 w-4" />
      </a>
    </header>
  );
}

/* ── idle ─────────────────────────────────────────────────────── */
function Idle({ topic, setTopic, level, setLevel, intention, setIntention, onCompile, error }: {
  topic: string; setTopic: (s: string) => void;
  level: Level;  setLevel: (l: Level) => void;
  intention: string; setIntention: (s: string) => void;
  onCompile: () => void; error: string | null;
}) {
  const allIdle    = useMemo(() => Object.fromEntries(Object.keys(NODE_REGISTRY).map((k) => [k, "idle"])) as NodeStateMap, []);
  const allNodeIds = useMemo(() => Object.keys(NODE_REGISTRY) as NodeId[], []);

  return (
    <motion.section initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative min-h-screen w-full">
      {/* 3D knowledge graph background */}
      <div className="fixed inset-0 z-0"><CompileGraph nodes={allNodeIds} states={allIdle} phase="idle" /></div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(0,0,0,0.82)_78%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-black to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-28 text-center">

        {/* badge */}
        <div className="rise" style={{ animationDelay: "0.1s" }}>
          <div className="liquid-glass rounded-full inline-flex items-center gap-2 pr-3.5">
            <span className="bg-signal text-black px-2.5 py-1 text-[0.62rem] font-semibold rounded-full tracking-wide">LIVE</span>
            <span className="text-[0.8rem] text-platinum/85 font-sans">6 sources compiled in under 12 seconds</span>
          </div>
        </div>

        {/* decorative study doodles */}
        <div className="mt-4 flex items-center justify-center gap-3 opacity-40">
          <NotebookDoodle />
          <PencilDoodle />
          <NotebookDoodle />
        </div>

        {/* headline */}
        <div className="mt-3">
          <BlurText text="Learn anything." className="serif text-platinum leading-[0.82] text-[clamp(2.6rem,7.5vw,5.4rem)]" delay={0.45} style={{ letterSpacing: "-1px" }} />
          <BlurText text="The internet compiles." className="serif text-signal leading-[0.82] text-[clamp(2.6rem,7.5vw,5.4rem)]" delay={0.9} style={{ letterSpacing: "-1px" }} />
        </div>

        <p className="rise mt-5 max-w-xl font-sans font-light text-[0.95rem] leading-relaxed text-platinum/70" style={{ animationDelay: "0.85s" }}>
          Type what you want to learn or research. COMPILE fires papers, repos, tutorials, and community in parallel — then synthesises one executable knowledge plan.
        </p>

        {/* input card */}
        <div className="rise mt-8 w-full max-w-2xl" style={{ animationDelay: "1s" }}>
          <div className="card-strong rounded-[1.6rem] p-6 text-left">

            {/* header */}
            <div className="flex items-center gap-2.5">
              <GraduationCapIcon />
              <span className="eyebrow text-[0.52rem]">your learning intent</span>
              <span className="ml-auto flex items-center gap-2 num text-[0.58rem] text-ash">
                <span className="h-1.5 w-1.5 rounded-full bg-pulse animate-pulse" /> READY
              </span>
            </div>

            {/* topic field */}
            <div className="mt-4 flex items-center gap-2 liquid-glass rounded-xl px-4 py-3">
              <span className="eyebrow text-[0.48rem] text-ash shrink-0">TOPIC</span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="RAG systems, Rust, AI agents…"
                autoFocus
                className="flex-1 bg-transparent serif text-[clamp(1.1rem,2vw,1.5rem)] text-platinum placeholder-platinum/30 focus:outline-none leading-tight"
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onCompile(); }}
              />
            </div>

            {/* level selector */}
            <div className="mt-3 flex items-center gap-2">
              <span className="eyebrow text-[0.48rem] text-ash shrink-0">LEVEL</span>
              <div className="flex gap-1.5">
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`rounded-full px-3 py-1 text-[0.72rem] font-sans transition-all ${level === l ? "bg-signal text-[#1a1205] font-semibold" : "liquid-glass text-platinum/70 hover:text-platinum"}`}>
                    {LEVEL_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>

            {/* goal / vibe textarea */}
            <textarea
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onCompile(); }}
              rows={2}
              placeholder="what's your goal? build a startup, ace interviews, write a paper…"
              className="mt-4 block w-full resize-none border-0 bg-transparent font-sans text-[0.92rem] leading-relaxed text-platinum/80 placeholder-platinum/25 focus:outline-none"
            />

            {/* sample chips + compile */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {SAMPLES.map((s) => (
                  <button key={s.label}
                    onClick={() => { setTopic(s.topic); setLevel(s.level); setIntention(s.intention); }}
                    className={`liquid-glass rounded-full px-3 py-1.5 text-[0.72rem] font-sans transition-colors flex items-center gap-1.5 ${topic === s.topic ? "text-signal" : "text-platinum/75 hover:text-platinum"}`}>
                    <span className="text-[0.6rem]">{s.goal === "startup" ? "🚀" : s.goal === "build" ? "🔧" : s.goal === "research" ? "🔬" : "📚"}</span>
                    {s.label}
                  </button>
                ))}
              </div>
              <button onClick={onCompile}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-signal px-6 py-2.5 font-medium tracking-wide text-[#1a1205] transition-transform hover:scale-[1.02] active:scale-95">
                <span className="relative z-10">COMPILE</span>
                <ArrowUpRightIcon className="relative z-10 h-4 w-4" />
                <span className="absolute inset-0 -translate-x-full bg-white/40 transition-transform duration-500 group-hover:translate-x-0" />
              </button>
            </div>
          </div>

          {/* source chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {Object.values(NODE_REGISTRY).map((n) => (
              <span key={n.id} className="liquid-glass rounded-full px-2.5 py-1 text-[0.62rem] font-sans flex items-center gap-1.5">
                <SourceLogo source={n.source} />
                <span className={n.real ? "text-pulse" : "text-signal"}>●</span>
                <span className="text-platinum/70">{n.source.replace(" *", "")}</span>
              </span>
            ))}
          </div>
          <p className="num mt-4 text-center text-[0.56rem] tracking-[0.25em] text-ash">
            ⌘/CTRL+ENTER · <span className="text-pulse">●</span> LIVE API · <span className="text-signal">●</span> WIRE-READY
          </p>

          {error && <p className="mt-4 text-center text-sm text-ember">{error}</p>}
        </div>

        <div className="rise absolute bottom-6 left-1/2 -translate-x-1/2 eyebrow text-[0.5rem]" style={{ animationDelay: "1.6s" }}>↓ how it compiles</div>
      </div>

      <LandingSections />
    </motion.section>
  );
}

/* ── compiling ────────────────────────────────────────────────── */
function Compiling({ topic, intent, nodes, states, stage, log, elapsedMs, error }: {
  topic: string; intent: Intent | null; nodes: NodeId[]; states: NodeStateMap;
  stage: string; log: string[]; elapsedMs: number; error: string | null;
}) {
  const total    = nodes.length || 6;
  const doneCount = useMemo(() => nodes.filter((n) => states[n] === "done" || states[n] === "error").length, [nodes, states]);
  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [log]);

  return (
    <motion.section initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative min-h-screen w-full">
      <div className="fixed inset-0 z-0">
        <CompileGraph nodes={nodes.length ? nodes : (Object.keys(NODE_REGISTRY) as NodeId[])} states={states} phase="compiling" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_85%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 pt-24 grid gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="liquid-glass rounded-[1.25rem] p-5 self-start max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCapIcon /><p className="eyebrow text-[0.52rem]">Compiling</p>
          </div>
          <p className="serif text-[1.2rem] leading-snug text-platinum/90">{topic}</p>
          {intent && (
            <div className="num mt-4 grid grid-cols-2 gap-x-5 gap-y-1.5 text-[0.66rem] text-ash">
              <Field k="topic" v={intent.topic} />
              <Field k="level" v={intent.level} />
              <Field k="goal"  v={intent.goal} />
              <Field k="time"  v={intent.timeframe} />
            </div>
          )}
        </div>
        <div />
        <div className="liquid-glass rounded-[1.25rem] p-5 self-start md:justify-self-end md:text-right min-w-[210px]">
          <p className="eyebrow text-[0.52rem] text-signal">{STAGE_LABELS[stage] ?? stage}</p>
          <p className="serif mt-2 text-[2.4rem] leading-none text-platinum">
            <span className="text-signal">{doneCount}</span><span className="text-platinum/35"> / {total}</span>
          </p>
          <p className="num mt-1 text-[0.62rem] text-ash">{(elapsedMs / 1000).toFixed(2)}s elapsed</p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 pb-6">
          <div className="liquid-glass-strong rounded-[1.25rem] p-4">
            <div className="num text-[0.7rem] leading-relaxed text-platinum/75 max-h-32 overflow-y-auto pr-2">
              {log.map((l, i) => (
                <div key={i} className={l.startsWith("✓") ? "text-signal" : l.startsWith("✗") ? "text-ember" : l.startsWith("→") ? "text-pulse" : "text-platinum/60"}>{l}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 liquid-glass rounded-full px-4 py-2 text-xs text-ember">{error}</div>}
    </motion.section>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-platinum/30 uppercase tracking-wider">{k}</span>
      <span className="text-platinum/90 truncate">{v}</span>
    </div>
  );
}

/* ── complete ─────────────────────────────────────────────────── */
function Complete({ intent, synthesis, results, onReset }: {
  intent: Intent; synthesis: Synthesis; results: Record<string, NodeResult>; onReset: () => void;
}) {
  const [tab, setTab] = useState<"papers" | "repos" | "tutorials">("repos");
  const realCount = Object.values(results).filter((r) => r.ok && NODE_REGISTRY[r.id].real).length;
  const papers      = (results.papers?.data      as Paper[]          | undefined) ?? [];
  const repos       = (results.repos?.data        as Repo[]           | undefined) ?? [];
  const tutorials   = (results.tutorials?.data    as Tutorial[]       | undefined) ?? [];
  const discussions = (results.discussions?.data  as DiscussionPost[] | undefined) ?? [];
  const trends      = results.trends?.data        as TrendSignal      | undefined;

  const trendColor = synthesis.trend === "rising" ? "text-signal" : synthesis.trend === "declining" ? "text-ember" : "text-pulse";
  const trendIcon  = synthesis.trend === "rising" ? "↑" : synthesis.trend === "declining" ? "↓" : "→";

  return (
    <motion.section initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative">
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
        <CompileGraph nodes={Object.keys(NODE_REGISTRY) as NodeId[]}
          states={Object.fromEntries(Object.keys(NODE_REGISTRY).map((k) => [k, results[k]?.ok ? "done" : "error"])) as NodeStateMap}
          phase="complete" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,rgba(0,0,0,0.85)_80%)]" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-28 pb-28">

        {/* meta row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="liquid-glass rounded-full px-3 py-1.5 eyebrow text-[0.52rem] flex items-center gap-2">
            <GraduationCapIcon />
            <span className="text-signal">{intent.topic}</span>
            <span className="text-platinum/25">/</span><span>{intent.level}</span>
            <span className="text-platinum/25">/</span><span>{intent.goal}</span>
          </div>
          <span className="liquid-glass rounded-full px-3 py-1.5 num text-[0.56rem] tracking-widest text-signal">● {realCount} LIVE SOURCES COMPILED</span>
        </div>

        {/* headline */}
        <div className="mt-10">
          <BlurText text={synthesis.headline} justify="start" className="serif text-platinum leading-[1.0] text-[clamp(1.8rem,4.5vw,3.4rem)]" stagger={60} style={{ letterSpacing: "-0.5px" }} />
        </div>

        {/* summary */}
        <p className="mt-6 font-sans font-light text-[1.05rem] leading-relaxed text-platinum/75 max-w-2xl">{synthesis.summary}</p>

        {/* trend pill */}
        <div className="mt-4 inline-flex items-center gap-2 liquid-glass rounded-full px-4 py-2">
          <span className={`num text-[0.8rem] font-bold ${trendColor}`}>{trendIcon} {synthesis.trend.toUpperCase()}</span>
          <span className="text-platinum/60 text-[0.82rem] font-sans">{synthesis.trend_note}</span>
        </div>

        {/* ── ROADMAP ── */}
        <div className="mt-14">
          <SectionHeader icon={<MapIcon />} title="Roadmap" sub={`Your ${intent.timeframe} learning plan`} />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {synthesis.roadmap.map((phase) => (
              <motion.div key={phase.phase} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * phase.phase }}
                className="card rounded-[1.2rem] p-5 relative overflow-hidden">
                {/* notebook line decoration */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[1.2rem]" style={{ background: `hsl(${phase.phase * 60}, 60%, 55%)` }} />
                <div className="pl-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="num text-[0.58rem] tracking-widest text-ash">PHASE {phase.phase}</span>
                    <span className="liquid-glass rounded-full px-2.5 py-0.5 num text-[0.58rem] text-signal">{phase.duration}</span>
                  </div>
                  <h3 className="serif text-platinum text-[1.2rem] leading-tight">{phase.title}</h3>
                  <ul className="mt-3 space-y-1.5">
                    {phase.objectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-[0.82rem] font-sans text-platinum/70">
                        <span className="text-signal mt-0.5 shrink-0">✓</span>{obj}
                      </li>
                    ))}
                  </ul>
                  {phase.resources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {phase.resources.map((r, i) => (
                        <span key={i} className="liquid-glass rounded-full px-2 py-0.5 text-[0.6rem] text-platinum/60 font-sans">{r.slice(0, 40)}</span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── RESOURCES tabs ── */}
        <div className="mt-14">
          <SectionHeader icon={<LibraryIcon />} title="Resources" sub="Compiled from live sources" />
          <div className="mt-4 flex gap-2">
            {(["repos","papers","tutorials"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-[0.76rem] font-sans font-medium transition-all ${tab === t ? "bg-signal text-[#1a1205]" : "liquid-glass text-platinum/70 hover:text-platinum"}`}>
                {t === "repos" ? "📦 Repos" : t === "papers" ? "📄 Papers" : "🎥 Tutorials"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "repos" && (
              <motion.div key="repos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 grid gap-3">
                {repos.slice(0, 5).map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noreferrer"
                    className="liquid-glass rounded-[1rem] px-5 py-4 flex items-start gap-4 hover:border-signal/30 transition-colors group">
                    <GitHubIcon size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans font-semibold text-platinum group-hover:text-signal transition-colors">{r.full_name}</span>
                        {r.language && <span className="liquid-glass rounded-full px-2 py-0.5 text-[0.6rem] text-platinum/60">{r.language}</span>}
                      </div>
                      <p className="text-platinum/60 text-[0.82rem] mt-1 leading-snug line-clamp-2">{r.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="num text-[0.65rem] text-signal">⭐ {r.stars.toLocaleString()}</span>
                        {r.topics.slice(0, 3).map((t) => <span key={t} className="num text-[0.58rem] text-ash">{t}</span>)}
                      </div>
                    </div>
                    <ArrowUpRightIcon className="h-4 w-4 text-platinum/20 group-hover:text-signal transition-colors shrink-0 mt-1" />
                  </a>
                ))}
                {repos.length === 0 && <EmptyState label="No repos found" />}
              </motion.div>
            )}

            {tab === "papers" && (
              <motion.div key="papers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 grid gap-3">
                {papers.slice(0, 5).map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer"
                    className="liquid-glass rounded-[1rem] px-5 py-4 hover:border-signal/30 transition-colors group block">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-sans font-medium text-platinum group-hover:text-signal transition-colors leading-snug">{p.title}</p>
                        <p className="num text-[0.62rem] text-ash mt-1">{p.authors.join(", ")} · {p.year} · {p.source}</p>
                      </div>
                      <span className="liquid-glass rounded-full px-2 py-0.5 num text-[0.58rem] text-signal shrink-0">{p.year}</span>
                    </div>
                    <p className="mt-2 text-platinum/55 text-[0.82rem] leading-snug line-clamp-3">{p.abstract}</p>
                  </a>
                ))}
                {papers.length === 0 && <EmptyState label="No papers found" />}
              </motion.div>
            )}

            {tab === "tutorials" && (
              <motion.div key="tutorials" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 grid gap-3">
                {tutorials.slice(0, 5).map((t, i) => (
                  <a key={i} href={t.url} target="_blank" rel="noreferrer"
                    className="liquid-glass rounded-[1rem] px-5 py-4 flex items-start gap-4 hover:border-signal/30 transition-colors group">
                    <div className="shrink-0 mt-0.5"><SourceLogo source={t.platform} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans font-medium text-platinum group-hover:text-signal transition-colors leading-snug">{t.title}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="num text-[0.62rem] text-ash">{t.author}</span>
                        <span className="num text-[0.6rem] text-signal">{t.platform}</span>
                        {t.read_time_min && <span className="num text-[0.6rem] text-ash">{t.read_time_min} min read</span>}
                        {t.views && <span className="num text-[0.6rem] text-ash">{(t.views / 1000).toFixed(0)}k views</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.tags.slice(0, 3).map((tag) => <span key={tag} className="liquid-glass rounded-full px-2 py-0.5 text-[0.58rem] text-platinum/50">#{tag}</span>)}
                      </div>
                    </div>
                    <ArrowUpRightIcon className="h-4 w-4 text-platinum/20 group-hover:text-signal transition-colors shrink-0 mt-1" />
                  </a>
                ))}
                {tutorials.length === 0 && <EmptyState label="No tutorials found" />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── BUILD THIS ── */}
        <div className="mt-14">
          <SectionHeader icon={<WrenchIcon />} title="Build This" sub="Project ideas ordered by difficulty" />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {synthesis.projects.map((proj, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}
                className="card rounded-[1.2rem] p-5">
                <span className="num text-[0.58rem] tracking-widest text-ash">{i === 0 ? "STARTER" : i === 1 ? "INTERMEDIATE" : "ADVANCED"}</span>
                <p className="mt-2 font-sans text-[0.92rem] text-platinum/85 leading-snug">{proj}</p>
                <div className="mt-3 flex">
                  {Array.from({ length: i + 1 }).map((_, j) => (
                    <span key={j} className="text-signal text-xs">●</span>
                  ))}
                  {Array.from({ length: 3 - i - 1 }).map((_, j) => (
                    <span key={j} className="text-platinum/20 text-xs">●</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── COMMUNITY ── */}
        {discussions.length > 0 && (
          <div className="mt-14">
            <SectionHeader icon={<ChatIcon />} title="Community Says" sub="From Reddit & Hacker News" />
            <div className="mt-6 grid gap-3">
              {discussions.slice(0, 4).map((d, i) => (
                <a key={i} href={d.url} target="_blank" rel="noreferrer"
                  className="liquid-glass rounded-[1rem] px-5 py-4 flex items-start gap-3 hover:border-signal/30 transition-colors group">
                  <SourceLogo source={d.source} />
                  <div className="flex-1 min-w-0">
                    <p className="font-sans font-medium text-platinum/90 group-hover:text-platinum leading-snug">{d.title}</p>
                    {d.snippet && <p className="mt-1 text-platinum/50 text-[0.8rem] leading-snug line-clamp-2">{d.snippet}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="num text-[0.6rem] text-signal">{d.source}</span>
                      <span className="num text-[0.6rem] text-ash">↑ {d.score}</span>
                      <span className="num text-[0.6rem] text-ash">💬 {d.comments}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── insights ── */}
        <div className="mt-14">
          <SectionHeader icon={<LightbulbIcon />} title="Key Insights" sub="AI-synthesised from all sources" />
          <div className="mt-6 grid gap-3">
            {synthesis.insights.map((ins, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}
                className="liquid-glass rounded-[1rem] px-5 py-4 flex gap-4">
                <span className="num text-[0.58rem] tracking-widest text-signal mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <p className="font-sans text-platinum/80 text-[0.9rem] leading-relaxed">{ins}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── tools & trends ── */}
        {trends && (
          <div className="mt-14">
            <SectionHeader icon={<TrendIcon />} title="Trend Intelligence" sub="Wire-ready: Product Hunt · Y Combinator · TechCrunch" />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="card rounded-[1.2rem] p-5">
                <p className="eyebrow text-[0.52rem] text-ash mb-3">HOT TOOLS</p>
                <div className="flex flex-wrap gap-2">
                  {trends.hot_tools.map((t) => <span key={t} className="liquid-glass rounded-full px-3 py-1 text-[0.75rem] text-signal font-sans">{t}</span>)}
                </div>
              </div>
              <div className="card rounded-[1.2rem] p-5">
                <p className="eyebrow text-[0.52rem] text-ash mb-3">YC COMPANIES</p>
                <div className="space-y-1.5">
                  {trends.yc_companies.map((c) => (
                    <div key={c} className="flex items-center gap-2"><YCIcon /><span className="text-[0.82rem] text-platinum/80 font-sans">{c}</span></div>
                  ))}
                </div>
              </div>
              <div className="card rounded-[1.2rem] p-5">
                <p className="eyebrow text-[0.52rem] text-ash mb-3">PH LAUNCHES</p>
                <div className="space-y-1.5">
                  {trends.ph_launches.map((p) => (
                    <div key={p} className="flex items-center gap-2"><PHIcon /><span className="text-[0.82rem] text-platinum/80 font-sans">{p}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-20 flex items-center justify-between gap-4 flex-wrap">
          <p className="num max-w-md text-xs text-ash">&gt; {intent.topic} · {intent.level} · {intent.goal}</p>
          <button onClick={onReset} className="liquid-glass rounded-full px-7 py-3.5 text-sm text-platinum hover:text-signal transition-colors">
            Compile another topic
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="liquid-glass rounded-[1rem] px-5 py-8 text-center text-platinum/40 font-sans text-sm">{label}</div>;
}

function SectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="liquid-glass rounded-[0.7rem] grid place-items-center mt-1" style={{ width: 34, height: 34 }}>{icon}</div>
      <div>
        <h2 className="serif text-platinum text-[1.6rem] leading-none">{title}</h2>
        <p className="num text-[0.58rem] tracking-widest text-ash mt-1">{sub.toUpperCase()}</p>
      </div>
    </div>
  );
}

/* ── landing sections ─────────────────────────────────────────── */
function Section({ kicker, title, accent, sub, children }: { kicker: string; title: string; accent?: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="relative z-10 border-t border-[var(--line)] bg-[#070709]">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 py-28 lg:py-36">
        <p className="eyebrow">{kicker}</p>
        <h2 className="serif text-platinum leading-[0.95] text-[clamp(2.2rem,5.5vw,4rem)] mt-5" style={{ letterSpacing: "-1px" }}>
          {title} {accent && <span className="text-signal">{accent}</span>}
        </h2>
        {sub && <p className="mt-6 max-w-xl font-sans font-light text-[1rem] leading-relaxed text-platinum/60">{sub}</p>}
        <div className="mt-16">{children}</div>
      </div>
    </section>
  );
}

function LandingSections() {
  const sources = [
    { id: "wiki",        label: "Context",   source: "Wikipedia",       live: true,  gives: "Grounding overview — what this field is, its history, key concepts." },
    { id: "papers",      label: "Research",  source: "arXiv",           live: true,  gives: "Latest academic papers, ranked by recency and relevance." },
    { id: "repos",       label: "Code",      source: "GitHub",          live: true,  gives: "Top repos ranked by stars, language, and beginner-friendliness." },
    { id: "tutorials",   label: "Tutorials", source: "DEV.to + YouTube",live: false, gives: "Practical guides and video walkthroughs from the dev community." },
    { id: "discussions", label: "Community", source: "Reddit + HN",     live: true,  gives: "What practitioners actually say — pain points, tools that work, debates." },
    { id: "trends",      label: "Trends",    source: "PH + YC + TC",   live: false, gives: "Startup activity, YC-funded companies, Product Hunt launches in this space." },
  ];

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <>
      <Section kicker="// the problem" title="Research is broken." accent="COMPILE fixes it."
        sub="Students waste hours jumping between papers, repos, YouTube, Reddit, and tutorials — manually reconciling everything. There's no intelligence layer.">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card rounded-[1.4rem] p-7">
            <p className="eyebrow text-ember">the manual way</p>
            <ul className="mt-6 space-y-3 font-sans text-[0.92rem] text-platinum/55">
              <li>Search arXiv. Skim 20 papers manually.</li>
              <li>GitHub search. No idea which repo is good.</li>
              <li>YouTube rabbit hole. Outdated content.</li>
              <li>Reddit threads. No structure.</li>
              <li>Reconcile it all yourself. Give up.</li>
            </ul>
            <div className="num mt-8 text-[0.72rem] tracking-widest text-ember/80">≈ 3 HRS · 12 TABS · 0 CLARITY</div>
          </div>
          <div className="card rounded-[1.4rem] p-7 flex flex-col">
            <p className="eyebrow text-signal">the compile way</p>
            <p className="mt-6 serif text-[clamp(1.4rem,2.4vw,1.9rem)] leading-snug text-platinum">&ldquo;Teach me RAG systems. I want to build a startup.&rdquo;</p>
            <div className="flex-1" />
            <div className="num mt-8 text-[0.72rem] tracking-widest text-signal">→ ROADMAP + REPOS + PAPERS · &lt;12s · 0 TABS</div>
          </div>
        </div>
      </Section>

      <Section kicker="// the sources" title="Six systems." accent="One intelligence."
        sub="Each fires in parallel and returns structured data. Four hit real public APIs right now — no key required.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => (
            <div key={s.id} className="card rounded-[1.2rem] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SourceLogo source={s.source} />
                  <span className="serif text-platinum text-[1.2rem] leading-none">{s.label}</span>
                </div>
                <span className={`num text-[0.55rem] tracking-widest rounded-full px-2 py-1 ${s.live ? "text-pulse" : "text-signal"}`}
                  style={{ background: s.live ? "var(--pulse-dim)" : "var(--signal-dim)" }}>
                  {s.live ? "LIVE" : "WIRE"}
                </span>
              </div>
              <div className="num text-[0.62rem] tracking-wider text-ash mt-2">{s.source.toUpperCase()}</div>
              <p className="mt-4 font-sans font-light text-[0.86rem] leading-relaxed text-platinum/60">{s.gives}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="relative z-10 border-t border-[var(--line)] bg-[#070709]">
        <div className="mx-auto max-w-4xl px-6 py-32 lg:py-44 text-center">
          <p className="eyebrow">// the internet was built for websites</p>
          <h2 className="serif text-platinum leading-[0.92] text-[clamp(2.6rem,7vw,5.2rem)] mt-6" style={{ letterSpacing: "-1px" }}>
            We compile it <br /><span className="text-signal">for learners.</span>
          </h2>
          <button onClick={scrollTop}
            className="group mt-12 inline-flex items-center gap-2.5 rounded-full bg-signal px-8 py-3.5 font-medium tracking-wide text-[#1a1205] transition-transform hover:scale-[1.02] active:scale-95">
            <span>Start learning</span><ArrowUpRightIcon className="h-4 w-4" />
          </button>
          <p className="num mt-16 text-[0.6rem] tracking-[0.3em] text-ash">KNOWLEDGE LAYER · ANAKIN WIRE · GROQ</p>
        </div>
      </section>
    </>
  );
}

/* ── icons ────────────────────────────────────────────────────── */
function ArrowUpRightIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>;
}
function BookOpenIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
}
function GraduationCapIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>;
}
function MapIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
}
function LibraryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M2 3h6v18H2zM16 3h6v18h-6zM9 3h6v18H9z"/></svg>;
}
function WrenchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
}
function ChatIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function LightbulbIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>;
}
function TrendIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
}

/* source logo mini icons */
function GitHubIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-platinum/70"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>;
}
function YouTubeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>;
}
function RedditIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>;
}
function HNIcon() {
  return <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-[0.55rem] font-bold text-white" style={{ background: "#FF6600" }}>Y</span>;
}
function DevToIcon() {
  return <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-[0.5rem] font-bold text-white bg-black border border-white/20">DEV</span>;
}
function WikiIcon() {
  return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.6rem] font-bold text-white bg-[#3366cc]">W</span>;
}
function PHIcon() {
  return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.55rem] font-bold text-white" style={{ background: "#DA552F" }}>PH</span>;
}
function YCIcon() {
  return <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-[0.55rem] font-bold text-white" style={{ background: "#FF6600" }}>YC</span>;
}

/* decorative study doodles */
function NotebookDoodle() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="4" y="3" width="20" height="22" rx="2" stroke="#ffb84d" strokeWidth="1.4" strokeOpacity="0.6"/>
      <line x1="8" y1="9"  x2="20" y2="9"  stroke="#ffb84d" strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="8" y1="13" x2="20" y2="13" stroke="#ffb84d" strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="8" y1="17" x2="16" y2="17" stroke="#ffb84d" strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="4" y1="7"  x2="4" y2="21"  stroke="#5dd5e6" strokeWidth="2.5" strokeOpacity="0.5" strokeLinecap="round"/>
    </svg>
  );
}
function PencilDoodle() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="#ffb84d" strokeWidth="1.4" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
