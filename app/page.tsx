"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import RealityGraph, { type NodeStateMap } from "@/components/RealityGraph";
import Chrome from "@/components/Chrome";
import DossierView from "@/components/DossierView";
import { SourceLogo, ArrowUR } from "@/components/logos";
import { SPRING, riseIn, submitShake } from "@/lib/motion";
import { saveCompile } from "@/lib/store";
import { parseSSE } from "@/lib/sse";
import {
  SOURCES, NODE_ORDER,
  type CompileEvent, type Intent, type NodeId, type NodeResult, type Synthesis, type CompileMetrics,
  type Level, type Goal, type GoalProfile,
} from "@/lib/types";

/* ── constants ──────────────────────────────────────────────── */
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const LEVEL_TIP: Record<Level, string> = {
  beginner:     "Beginner — assumes no prior knowledge, covers fundamentals first",
  intermediate: "Intermediate — assumes basic familiarity, focuses on practical depth",
  advanced:     "Advanced — assumes strong background, targets edge cases and internals",
};
const GOALS: { id: Goal; label: string; tip: string }[] = [
  { id: "learn",    label: "Learn",    tip: "Learn — broad conceptual understanding and mental models" },
  { id: "build",    label: "Build",    tip: "Build — practical implementation, shipping working code" },
  { id: "research", label: "Research", tip: "Research — literature review, papers, academic depth" },
  { id: "career",   label: "Career",   tip: "Career — interview prep, job-market signal, durable skills" },
  { id: "startup",  label: "Startup",  tip: "Startup — venture-grade analysis, moat, market fit, funding signals" },
];

type SubOption = { id: GoalProfile; label: string; tip: string };
const SUB_PROFILES: Record<Goal, SubOption[]> = {
  learn: [
    { id: "fundamentals",  label: "fundamentals", tip: "Weight: beginner onboarding, documentation quality, tutorial density" },
    { id: "practical",     label: "practical",    tip: "Weight: real-world examples, production patterns, learn-by-doing resources" },
    { id: "deep-theory",   label: "deep theory",  tip: "Weight: academic papers, architecture internals, mathematical rigor" },
    { id: "fast-track",    label: "fast-track",   tip: "Weight: shortest path to competence, essential APIs only, days not months" },
    { id: "full-mastery",  label: "full mastery", tip: "Weight: comprehensive depth, edge cases, expert patterns, contribution paths" },
  ],
  build: [
    { id: "mvp",        label: "MVP",        tip: "Python/JS/TS, managed services, DX over performance, ship fast" },
    { id: "production", label: "production", tip: "Go/Rust rise, reliability, observability, CI/CD, error budgets" },
    { id: "scalable",   label: "scalable",   tip: "Distributed systems, horizontal scaling, database patterns, load testing" },
    { id: "solo-dev",   label: "solo-dev",   tip: "Opinionated frameworks, managed services, minimal ops — one engineer can own this" },
    { id: "enterprise", label: "enterprise", tip: "Java/Go/C#, security, compliance (SOC2/GDPR), vendor support, stability" },
  ],
  career: [
    { id: "faang",     label: "FAANG",     tip: "LeetCode/DSA ecosystem, system design interviews, big-tech market demand" },
    { id: "startup",   label: "startup",   tip: "Python/TypeScript, full-stack versatility, equity signals, Series A/B demand" },
    { id: "research",  label: "research",  tip: "PyTorch/JAX, AI lab roles (DeepMind/Anthropic/OpenAI), research engineer path" },
    { id: "freelance", label: "freelance", tip: "Client-facing tech, hourly rate premium, portfolio building, consulting rates" },
    { id: "quant",     label: "quant",     tip: "C++ for HFT, Python for backtesting, numerical computing, financial data APIs" },
    { id: "infra",     label: "infra",     tip: "Go/Rust, Kubernetes, DevOps/SRE patterns, cloud certifications, platform engineering" },
  ],
  research: [
    { id: "papers",         label: "papers",         tip: "arXiv velocity, survey papers, citation networks, conference venues (NeurIPS/ICML/ICLR)" },
    { id: "implementation", label: "implementation", tip: "Reproducibility signals, GitHub stars on paper repos, PyTorch/JAX, repo quality" },
    { id: "frontier",       label: "frontier",       tip: "Preprint velocity, lab adoption (DeepMind/Anthropic/OpenAI), novelty signal, breakthrough detection" },
    { id: "academic",       label: "academic",       tip: "Publication venues, advisor prestige, thesis positioning, grant funding, academic job market" },
    { id: "open-source",    label: "open-source",    tip: "Repository maturity, contribution pathways, maintainer responsiveness, PR merge rates" },
  ],
  startup: [
    { id: "ai",       label: "AI startup",       tip: "Model moat, data flywheel, compute costs, OpenAI/Anthropic competitive surface, a16z/YC AI signals" },
    { id: "infra",    label: "infra startup",     tip: "OSS-to-enterprise flywheel, dev tooling, Hashicorp/Datadog attack surface, infra YC cohort" },
    { id: "systems",  label: "systems startup",   tip: "Latency moat, hardware constraints, low-level hiring difficulty, safety/reliability" },
    { id: "research", label: "research startup",  tip: "Paper-to-product distance, PhD team ratio, publication velocity as defensibility" },
    { id: "fintech",  label: "fintech startup",   tip: "Regulatory moat, payment rails, compliance surface, KYC/AML, Sequoia/a16z fintech signals" },
  ],
};
const DEFAULT_PROFILE: Record<Goal, GoalProfile> = {
  learn:    "practical",
  build:    "mvp",
  career:   "faang",
  research: "frontier",
  startup:  "ai",
};
const DEPTHS = ["weekend", "1 week", "1 month", "3 months"];
const DEPTH_TIP: Record<string, string> = {
  "weekend":  "Weekend — 2-day sprint, essentials only",
  "1 week":   "1 Week — solid foundation + one project",
  "1 month":  "1 Month — full roadmap, production-ready",
  "3 months": "3 Months — deep mastery + career/startup ready",
};
type Sample = { topic: string; level: Level; goal: Goal; free: string };
const SAMPLES: Sample[] = [
  { topic: "RAG systems",          level: "intermediate", goal: "build",    free: "ship production retrieval infrastructure" },
  { topic: "Rust vs Go for AI infra", level: "advanced",  goal: "career",   free: "decide the durable systems language" },
  { topic: "diffusion models",      level: "advanced",    goal: "research",  free: "map the frontier of generative research" },
  { topic: "AI agents",             level: "beginner",    goal: "learn",     free: "understand autonomous agent architecture" },
];
const STAGE_LABEL: Record<string, string> = {
  parse: "PARSE", compile: "COMPILE", fetch: "RECONCILE", metrics: "SYNTHESIZE", synthesize: "BLUEPRINT", done: "COMPLETE",
};
type Phase = "idle" | "compiling" | "complete";
const IDLE_STATES: NodeStateMap = Object.fromEntries(NODE_ORDER.map((k) => [k, "idle"])) as NodeStateMap;

/* ── page ───────────────────────────────────────────────────── */
export default function Page() {
  const [phase, setPhase]           = useState<Phase>("idle");
  const [topic, setTopic]           = useState(SAMPLES[0].topic);
  const [level, setLevel]           = useState<Level>(SAMPLES[0].level);
  const [goal, setGoal]             = useState<Goal>(SAMPLES[0].goal);
  const [goalProfile, setGoalProfile] = useState<GoalProfile>(DEFAULT_PROFILE[SAMPLES[0].goal]);
  const [depth, setDepth]           = useState("1 month");
  const [free, setFree]             = useState(SAMPLES[0].free);
  const [stage, setStage]           = useState("parse");
  const [status, setStatus]         = useState("AWAITING INTENT");
  const [liveVel, setLiveVel]       = useState(0);
  const [intent, setIntent]         = useState<Intent | null>(null);
  const [nodes, setNodes]           = useState<NodeId[]>([]);
  const [states, setStates]         = useState<NodeStateMap>({});
  const [lockedNodes, setLockedNodes] = useState<Set<NodeId>>(new Set());
  const [results, setResults]       = useState<Record<string, NodeResult>>({});
  const [metrics, setMetrics]       = useState<CompileMetrics | null>(null);
  const [synthesis, setSynthesis]   = useState<Synthesis | null>(null);
  const [facts, setFacts]           = useState<string[]>([]);
  const [log, setLog]               = useState<string[]>([]);
  const [error, setError]           = useState<string | null>(null);
  const [elapsed, setElapsed]       = useState(0);
  const [shaking, setShaking]       = useState(false);
  const tick = useRef<number | null>(null);

  const run = useCallback(async () => {
    if (!topic.trim()) return;
    setError(null); setStage("parse"); setStatus("INITIALISING COMPILER"); setLiveVel(0);
    setIntent(null); setNodes([]); setStates({}); setLockedNodes(new Set());
    setResults({}); setMetrics(null); setSynthesis(null); setFacts([]);
    setLog([`$ compile "${topic}" --level ${level} --goal ${goal} --profile ${goalProfile} --depth "${depth}"`]);
    setPhase("compiling");
    const t0 = Date.now();
    if (tick.current) window.clearInterval(tick.current);
    tick.current = window.setInterval(() => setElapsed(Date.now() - t0), 80) as unknown as number;
    try {
      const res = await fetch("/api/compile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intention: `${topic}. ${free}`, level, goal, timeframe: depth, goalProfile }),
      });
      if (!res.ok || !res.body) throw new Error(`server ${res.status}`);
      for await (const ev of parseSSE(res.body)) apply(ev);
    } catch (e) { setError(e instanceof Error ? e.message : "compile failed"); }
    finally { if (tick.current) window.clearInterval(tick.current); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, level, goal, goalProfile, depth, free]);

  const submit = () => { if (!topic.trim()) return; setShaking(true); setTimeout(() => { setShaking(false); run(); }, 340); };

  const apply = (ev: CompileEvent) => {
    switch (ev.type) {
      case "stage": setStage(ev.stage); if (ev.stage === "done") setTimeout(() => setPhase("complete"), 650); break;
      case "status": setStatus(ev.payload); setLog((l) => [...l, `▶ ${ev.payload}`]); break;
      case "intent": setIntent(ev.intent); setLog((l) => [...l, `· topic=${ev.intent.topic} level=${ev.intent.level} goal=${ev.intent.goal}`]); break;
      case "dag": setNodes(ev.nodes); setStates(Object.fromEntries(ev.nodes.map((n) => [n, "idle"])) as NodeStateMap); break;
      case "node:start": setStates((s) => ({ ...s, [ev.id]: "running" })); setLog((l) => [...l, `→ ${ev.id} · ${SOURCES[ev.id].source.toLowerCase()}`]); break;
      case "node:done":
        setStates((s) => ({ ...s, [ev.id]: ev.result.ok ? "done" : "error" }));
        setResults((r) => ({ ...r, [ev.id]: ev.result }));
        setLog((l) => [...l, ev.result.ok ? `✓ ${ev.id} · ${ev.result.count} signals · ${ev.result.duration_ms}ms` : `✗ ${ev.id} no signal`]);
        if (ev.result.ok) {
          setLockedNodes((s) => new Set([...s, ev.id]));
          setTimeout(() => setLockedNodes((s) => { const n = new Set(s); n.delete(ev.id); return n; }), 1100);
        }
        break;
      case "fact":        setFacts((f) => [...f, ev.fact]); break;
      case "metric_tick": setLiveVel(ev.payload); break;
      case "metrics":     setMetrics(ev.metrics); setLiveVel(ev.metrics.field_velocity); break;
      case "synthesis":   setSynthesis(ev.synthesis); break;
      case "error":       setError(ev.message); break;
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

  const graphStates  = phase === "idle" ? IDLE_STATES : states;
  const graphOpacity = phase === "complete" ? 0.16 : phase === "compiling" ? 1 : 0.5;

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Chrome />
      <motion.div className="fixed inset-0 z-0 pointer-events-none" animate={{ opacity: graphOpacity }} transition={SPRING}>
        <RealityGraph nodes={NODE_ORDER} states={graphStates} phase={phase} fieldVelocity={metrics?.field_velocity} />
      </motion.div>
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <Console key="idle" topic={topic} setTopic={setTopic} level={level} setLevel={setLevel}
            goal={goal} setGoal={(g) => { setGoal(g); setGoalProfile(DEFAULT_PROFILE[g]); }}
            goalProfile={goalProfile} setGoalProfile={setGoalProfile}
            depth={depth} setDepth={setDepth} free={free} setFree={setFree}
            onSubmit={submit} shaking={shaking} error={error}
            onSample={(s) => { setTopic(s.topic); setLevel(s.level); setGoal(s.goal); setGoalProfile(DEFAULT_PROFILE[s.goal]); setFree(s.free); }} />
        )}
        {phase === "compiling" && (
          <Compiling key="cmp" topic={topic} nodes={nodes} states={states} lockedNodes={lockedNodes}
            stage={stage} status={status} liveVel={liveVel} log={log} elapsed={elapsed} error={error} intent={intent} />
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

/* ── segmented control ──────────────────────────────────────── */
function Seg<T extends string>({ value, options, onChange, cap, tips }: {
  value: T; options: T[]; onChange: (v: T) => void; cap?: boolean; tips?: Record<string, string>
}) {
  return (
    <div className="inline-flex" style={{ border: "2px solid var(--ink)" }}>
      {options.map((o, i) => (
        <button key={o} onClick={() => onChange(o)} title={tips?.[o]}
          className="mono text-[0.64rem] px-2.5 py-1.5 press"
          style={{ borderLeft: i ? "2px solid var(--ink)" : "none", background: value === o ? "var(--ink)" : "var(--paper)", color: value === o ? "var(--paper)" : "var(--ink-2)", textTransform: cap ? "capitalize" : "none" }}>
          {o}
        </button>
      ))}
    </div>
  );
}

/* ── console ────────────────────────────────────────────────── */
function Console(p: {
  topic: string; setTopic: (s: string) => void; level: Level; setLevel: (l: Level) => void;
  goal: Goal; setGoal: (g: Goal) => void; goalProfile: GoalProfile; setGoalProfile: (v: GoalProfile) => void;
  depth: string; setDepth: (d: string) => void;
  free: string; setFree: (s: string) => void; onSubmit: () => void; shaking: boolean; error: string | null; onSample: (s: Sample) => void;
}) {
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="relative min-h-screen w-full">
      <div className="relative z-10 mx-auto max-w-6xl px-3 sm:px-5 pt-14 sm:pt-16 pb-6">
        <motion.div variants={riseIn} initial="hidden" animate="show" className="flex items-center gap-3 flex-wrap">
          <span className="cert">◇ AUTONOMOUS INTERNET INTELLIGENCE COMPILER</span>
        </motion.div>
        <motion.h1 variants={riseIn} initial="hidden" animate="show" custom={1} className="display text-[clamp(1.7rem,4.4vw,3rem)] mt-2">
          COMPILE THE INTERNET.<br /><span style={{ color: "var(--stamp)" }}>ONE VERDICT. ZERO NOISE.</span>
        </motion.h1>
        <motion.p variants={riseIn} initial="hidden" animate="show" custom={2} className="mono text-[0.78rem] mt-2 max-w-xl leading-relaxed" style={{ color: "var(--ink-2)" }}>
          The internet is the largest database in human history. It still can&apos;t tell you exactly what to do next.
        </motion.p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.12fr_0.88fr] items-start">
          {/* LEFT — manifest */}
          <motion.div animate={p.shaking ? submitShake : {}} className="brutal p-4">
            <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: "2px solid var(--ink)" }}>
              <span className="label">intelligence manifest // 001</span>
              <span className="mono text-[0.56rem] flex items-center gap-1.5" style={{ color: "var(--stamp)" }}>
                <span className="inline-block w-2 h-2 pulse-dot" style={{ background: "var(--stamp)" }} /> ARMED
              </span>
            </div>
            <label className="label">intention</label>
            <input value={p.topic} onChange={(e) => p.setTopic(e.target.value)} autoFocus
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") p.onSubmit(); }}
              placeholder="LINK AN INTENTION…" title="Enter the technology, concept, or topic you want compiled"
              className="block w-full bg-transparent display text-[clamp(1.2rem,2.6vw,1.8rem)] mt-1 focus:outline-none" style={{ color: "var(--ink)" }} />
            <div className="mt-3 grid gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="label w-10 shrink-0">level</span>
                <Seg value={p.level} options={LEVELS} onChange={p.setLevel} cap tips={LEVEL_TIP} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="label w-10 shrink-0">goal</span>
                <div className="inline-flex flex-wrap" style={{ border: "2px solid var(--ink)", width: "fit-content" }}>
                  {GOALS.map((g, i) => (
                    <button key={g.id} onClick={() => p.setGoal(g.id)} title={g.tip}
                      className="mono text-[0.62rem] px-2 py-1.5 press"
                      style={{ borderLeft: i ? "2px solid var(--ink)" : "none", background: p.goal === g.id ? "var(--stamp)" : "var(--paper)", color: p.goal === g.id ? "var(--paper)" : "var(--ink-2)" }}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* sub-profile selector — always shown, adapts to active goal */}
              <motion.div key={p.goal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
                className="flex items-start gap-2 flex-wrap">
                <span className="label w-10 shrink-0 pt-1.5">profile</span>
                <div className="flex flex-col gap-0.5">
                  <div className="inline-flex flex-wrap" style={{ border: "2px solid var(--stamp)", width: "fit-content" }}>
                    {SUB_PROFILES[p.goal].map((opt, i) => (
                      <button key={opt.id} onClick={() => p.setGoalProfile(opt.id)} title={opt.tip}
                        className="mono text-[0.56rem] px-2 py-1.5 press"
                        style={{ borderLeft: i ? "2px solid var(--stamp)" : "none", background: p.goalProfile === opt.id ? "var(--stamp)" : "var(--paper)", color: p.goalProfile === opt.id ? "var(--paper)" : "var(--ink-2)" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="label w-10 shrink-0">depth</span>
                <Seg value={p.depth} options={DEPTHS} onChange={p.setDepth} tips={DEPTH_TIP} />
              </div>
            </div>
            <textarea value={p.free} onChange={(e) => p.setFree(e.target.value)} rows={2}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") p.onSubmit(); }}
              placeholder="strategic context — 'decide the durable systems language'…"
              title="Optional free-text context — shapes the synthesis tone and focus"
              className="brutal-inset mt-3 block w-full p-2.5 resize-none text-[0.84rem] focus:outline-none" style={{ color: "var(--ink-2)" }} />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="mono text-[0.54rem]" style={{ color: "var(--ink-3)" }}>⌘/CTRL + ENTER</span>
              <button onClick={p.onSubmit} title="Run all 6 signal pipelines in parallel and synthesise a dossier (~10s)"
                className="press btn-stamp px-6 py-2.5 flex items-center gap-2 text-[0.88rem]">COMPILE <ArrowUR s={15} /></button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {SAMPLES.map((s) => (
                <button key={s.topic} onClick={() => p.onSample(s)} title={`Load sample: ${s.topic} — ${s.free}`}
                  className="press brutal-sm bg-transparent px-2.5 py-1 mono text-[0.6rem]" style={{ color: "var(--ink-2)" }}>{s.topic}</button>
              ))}
            </div>
            {p.error && <p className="mt-3 mono text-sm" style={{ color: "var(--stamp)" }}>{p.error}</p>}
          </motion.div>

          {/* RIGHT */}
          <div className="grid gap-3">
            <Link href="/compare" className="press brutal p-4 block" title="Compare two technologies head-to-head with live signal data">
              <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: "2px solid var(--ink)" }}>
                <span className="label" style={{ fontSize: "0.5rem" }}>sample // rust vs go</span>
                <span className="mono text-[0.54rem]" style={{ color: "var(--stamp)" }}>RUN LIVE ▸</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div><p className="display text-[1.9rem] leading-none">76</p><p className="mono text-[0.5rem]" style={{ color: "var(--ink-3)" }}>RUST · EXPLOSIVE ↑</p></div>
                <span className="display text-[0.95rem]" style={{ color: "var(--stamp)" }}>VS</span>
                <div className="text-right"><p className="display text-[1.9rem] leading-none">61</p><p className="mono text-[0.5rem]" style={{ color: "var(--ink-3)" }}>GO · GROWING →</p></div>
              </div>
              <p className="text-[0.72rem] mt-2" style={{ color: "var(--ink-2)" }}><strong style={{ color: "var(--ink)" }}>Verdict:</strong> Rust leads on repository velocity + systems-level adoption.</p>
            </Link>

            <div className="brutal-sm bg-transparent p-3">
              <p className="label mb-2" style={{ fontSize: "0.5rem" }}>signal sources</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {NODE_ORDER.map((id) => (
                  <div key={id} className="flex items-center gap-1.5" title={`${SOURCES[id].source} — ${SOURCES[id].live ? "Live public API" : "Anakin Wire live search"}`}>
                    <SourceLogo source={SOURCES[id].source} />
                    <span className="text-[0.68rem] font-semibold flex-1 truncate">{SOURCES[id].label}</span>
                    <span className="mono" style={{ fontSize: "0.42rem", color: SOURCES[id].live ? "var(--ink-3)" : "var(--stamp)" }}>{SOURCES[id].live ? "LIVE" : "WIRE"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="brutal-sm bg-transparent p-3">
              <p className="label mb-2" style={{ fontSize: "0.5rem" }}>every dossier yields</p>
              <div className="grid gap-1 mono text-[0.62rem]" style={{ color: "var(--ink-2)" }}>
                <span>▸ Strategic recommendation + conviction</span>
                <span>▸ Compile Score breakdown (7 signals)</span>
                <span>▸ Ecosystem risk matrix</span>
                <span>▸ 4-phase build compiler + ranked repos</span>
              </div>
            </div>
          </div>
        </div>

        <div className="brutal mt-4 p-3 text-center">
          <p className="display text-[clamp(0.85rem,2.1vw,1.3rem)]">Google gives you websites. <span style={{ color: "var(--ink-3)" }}>·</span> <span style={{ color: "var(--ink-2)" }}>Search gives you answers.</span> <span style={{ color: "var(--ink-3)" }}>·</span> <span style={{ color: "var(--stamp)" }}>COMPILE gives you conviction.</span></p>
        </div>
      </div>
    </motion.section>
  );
}

/* ── compiling theatre — tight, no wasted space ─────────────── */
function Compiling(p: {
  topic: string; nodes: NodeId[]; states: NodeStateMap; lockedNodes: Set<NodeId>;
  stage: string; status: string; liveVel: number; log: string[]; elapsed: number; error: string | null;
  intent?: Intent | null;
}) {
  const ids  = p.nodes.length ? p.nodes : NODE_ORDER;
  const done = ids.filter((n) => p.states[n] === "done" || p.states[n] === "error").length;
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [p.log]);

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="relative min-h-screen w-full">
      <div className="relative z-10 mx-auto max-w-6xl px-3 sm:px-5 pt-14 sm:pt-16 pb-44 sm:pb-36 grid gap-3 lg:grid-cols-[1fr_320px]">

        {/* status + velocity */}
        <div className="brutal p-4 self-start" style={{ background: "var(--paper)" }}>
          <p className="label">reconciliation state // {STAGE_LABEL[p.stage] ?? p.stage}</p>
          <p className="display text-[clamp(1rem,2.2vw,1.55rem)] mt-1.5 mono" style={{ color: "var(--stamp)", letterSpacing: "0.02em" }}>{p.status}</p>
          <div className="mt-3 flex items-end gap-3">
            <div>
              <p className="label" style={{ fontSize: "0.46rem" }}>compile score</p>
              <p className="display text-[2.8rem] leading-none mono" title="Field Velocity: weighted score of how fast this ecosystem is moving (0–100)">{p.liveVel}<span className="text-[1rem]" style={{ color: "var(--ink-3)" }}>/100</span></p>
            </div>
            <div className="flex-1 bar-track h-3 mb-1.5"><div className="h-full" style={{ width: `${p.liveVel}%`, background: "var(--stamp)", transition: "width 0.1s linear" }} /></div>
          </div>
          <p className="mono text-[0.56rem] mt-1" style={{ color: "var(--ink-3)" }} title="Wall-clock time since compile started">{(p.elapsed / 1000).toFixed(2)}s · {done}/{ids.length} pipelines reconciled</p>
          {p.intent?.goalProfile && (
            <p className="mono text-[0.52rem] mt-1.5 px-2 py-0.5 inline-block" style={{ background: "var(--ink-2)", color: "var(--paper)", letterSpacing: "0.14em" }}>
              ACTIVE PROFILE · {p.intent.goal.toUpperCase()} / {p.intent.goalProfile.toUpperCase().replace(/-/g, " ")}
            </p>
          )}
        </div>

        {/* node checklist with LOCKED stamp */}
        <div className="brutal p-3 self-start" style={{ background: "var(--paper)" }}>
          <p className="label mb-2" style={{ fontSize: "0.5rem" }}>signal pipelines</p>
          <div className="grid gap-1">
            {ids.map((id) => {
              const st = p.states[id] ?? "idle";
              const justLocked = p.lockedNodes.has(id);
              return (
                <div key={id} className="relative flex items-center gap-2 px-2 py-1"
                  title={`${SOURCES[id].label} — ${SOURCES[id].source}${st === "done" ? " · signal locked" : st === "running" ? " · reconciling live data" : ""}`}
                  style={{ border: "2px solid var(--ink)", background: st === "running" ? "var(--stamp)" : "var(--paper)", transition: "background 0.2s" }}>
                  <SourceLogo source={SOURCES[id].source} />
                  <span className="text-[0.68rem] font-semibold flex-1" style={{ color: st === "running" ? "var(--paper)" : "var(--ink)" }}>{SOURCES[id].label}</span>
                  <span className="mono text-[0.58rem] relative" style={{ color: st === "running" ? "var(--paper)" : st === "done" ? "var(--stamp)" : "var(--ink-3)", minWidth: 50, textAlign: "right" }}>
                    {st === "done" ? (
                      <span key={justLocked ? "lk-new" : "lk"} className={justLocked ? "stamp-in inline-block" : "inline-block"}>✓ LOCKED</span>
                    ) : st === "running" ? "···" : st === "error" ? "✗ ERR" : "—"}
                  </span>
                  {justLocked && <span className="lock-ring" style={{ borderRadius: 0 }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* terminal — fixed bottom, compact height */}
      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="mx-auto max-w-6xl px-3 sm:px-5 pb-2 sm:pb-3">
          <div className="brutal p-2" style={{ background: "var(--ink)" }}>
            <p className="label mb-0.5" style={{ fontSize: "0.4rem", color: "rgba(249,247,242,0.4)" }}>SIGNAL LOG</p>
            <div className="mono text-[0.58rem] sm:text-[0.64rem] leading-relaxed max-h-16 sm:max-h-20 overflow-y-auto pr-1" style={{ color: "var(--paper)" }}>
              {p.log.map((l, i) => (
                <div key={i} style={{ color: l.startsWith("✓") ? "#a8e6a3" : l.startsWith("✗") ? "var(--stamp)" : l.startsWith("▶") ? "var(--stamp)" : l.startsWith("→") ? "#d6e4ff" : "rgba(249,247,242,0.5)" }}>{l}</div>
              ))}
              <div ref={endRef} />
            </div>
          </div>
        </div>
      </div>
      {p.error && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 brutal px-4 py-2 mono text-xs" style={{ color: "var(--stamp)" }}>{p.error}</div>}
    </motion.section>
  );
}

