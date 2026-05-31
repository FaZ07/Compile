"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Chrome from "@/components/Chrome";
import Counter from "@/components/Counter";
import { parseSSE } from "@/lib/sse";
import { saveCompile } from "@/lib/store";
import { riseIn, SPRING, submitShake } from "@/lib/motion";
import type { Intent, CompileMetrics, Synthesis, NodeResult, Level, Goal } from "@/lib/types";

interface Bundle { intent: Intent; metrics: CompileMetrics; synthesis: Synthesis; results: Record<string, NodeResult>; facts: string[] }
type Phase = "idle" | "running" | "done";

const VS_SAMPLES = ["Rust vs Go", "LangChain vs MCP", "RAG vs fine-tuning", "Postgres vs MongoDB"];

async function compileOne(topic: string, level: Level, goal: Goal, onStatus: (s: string) => void): Promise<Bundle> {
  const res = await fetch("/api/compile", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intention: topic, level, goal, timeframe: "1 month" }),
  });
  if (!res.ok || !res.body) throw new Error(`server ${res.status}`);
  let intent!: Intent, metrics!: CompileMetrics, synthesis!: Synthesis;
  const results: Record<string, NodeResult> = {}; const facts: string[] = [];
  for await (const ev of parseSSE(res.body)) {
    if (ev.type === "intent") intent = ev.intent;
    else if (ev.type === "metrics") metrics = ev.metrics;
    else if (ev.type === "synthesis") synthesis = ev.synthesis;
    else if (ev.type === "node:done") results[ev.id] = ev.result;
    else if (ev.type === "fact") facts.push(ev.fact);
    else if (ev.type === "status") onStatus(ev.payload);
  }
  return { intent, metrics, synthesis, results, facts };
}

// deterministic strategic verdict — composite of score, trajectory, confidence
function composite(m: CompileMetrics): number {
  return m.field_velocity + (m.trajectory === "rising" ? 12 : m.trajectory === "stable" ? 4 : -6) + m.confidence * 0.1;
}

export default function ComparePage() {
  const [a, setA] = useState("Rust");
  const [b, setB] = useState("Go");
  const [level, setLevel] = useState<Level>("advanced");
  const [goal, setGoal] = useState<Goal>("career");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusA, setStatusA] = useState("STANDBY");
  const [statusB, setStatusB] = useState("STANDBY");
  const [resA, setResA] = useState<Bundle | null>(null);
  const [resB, setResB] = useState<Bundle | null>(null);
  const [shaking, setShaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!a.trim() || !b.trim()) return;
    setError(null); setResA(null); setResB(null); setStatusA("INITIALISING"); setStatusB("INITIALISING"); setPhase("running");
    try {
      const [bundleA, bundleB] = await Promise.all([
        compileOne(a, level, goal, setStatusA),
        compileOne(b, level, goal, setStatusB),
      ]);
      setResA(bundleA); setResB(bundleB);
      saveCompile({ topic: bundleA.intent.topic, level, goal, timeframe: "1 month", intent: bundleA.intent, metrics: bundleA.metrics, synthesis: bundleA.synthesis, results: bundleA.results, facts: bundleA.facts });
      saveCompile({ topic: bundleB.intent.topic, level, goal, timeframe: "1 month", intent: bundleB.intent, metrics: bundleB.metrics, synthesis: bundleB.synthesis, results: bundleB.results, facts: bundleB.facts });
      setPhase("done");
    } catch (e) { setError(e instanceof Error ? e.message : "comparison failed"); setPhase("idle"); }
  };
  const submit = () => { if (!a.trim() || !b.trim()) return; setShaking(true); setTimeout(() => { setShaking(false); run(); }, 340); };

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Chrome />
      <div className="relative z-10 mx-auto max-w-4xl px-5 pt-20 pb-14">
        <motion.div variants={riseIn} initial="hidden" animate="show">
          <span className="cert">◇ STRATEGIC COMPARISON ENGINE</span>
          <h1 className="display text-[clamp(2rem,5.5vw,3.6rem)] mt-3">A vs B. <span style={{ color: "var(--stamp)" }}>ONE VERDICT.</span></h1>
          <p className="mono text-[0.72rem] mt-1" style={{ color: "var(--ink-3)" }}>reconciles two ecosystems head-to-head · which is the durable bet?</p>
        </motion.div>

        {/* input */}
        <motion.div animate={shaking ? submitShake : {}} className="brutal mt-6 p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-center">
            <input value={a} onChange={(e) => setA(e.target.value)} placeholder="Option A"
              className="brutal-inset p-3 display text-[clamp(1.2rem,3vw,1.8rem)] bg-transparent focus:outline-none" style={{ color: "var(--ink)" }} />
            <span className="display text-[1.4rem] text-center" style={{ color: "var(--stamp)" }}>VS</span>
            <input value={b} onChange={(e) => setB(e.target.value)} placeholder="Option B"
              className="brutal-inset p-3 display text-[clamp(1.2rem,3vw,1.8rem)] bg-transparent focus:outline-none" style={{ color: "var(--ink)" }} />
          </div>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2"><span className="label">level</span><MiniSeg value={level} opts={["beginner", "intermediate", "advanced"] as Level[]} on={setLevel} /></div>
            <div className="flex items-center gap-2"><span className="label">goal</span><MiniSeg value={goal} opts={["learn", "build", "career", "startup"] as Goal[]} on={setGoal} /></div>
            <button onClick={submit} disabled={phase === "running"} className="press btn-stamp ml-auto px-6 py-3 text-[0.88rem]" style={{ opacity: phase === "running" ? 0.6 : 1 }}>
              {phase === "running" ? "RECONCILING…" : "RECONCILE ▸"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {VS_SAMPLES.map((s) => (
              <button key={s} onClick={() => { const [x, y] = s.split(" vs "); setA(x); setB(y); }} className="press brutal-sm bg-transparent px-2.5 py-1 mono text-[0.62rem]" style={{ color: "var(--ink-2)" }}>{s}</button>
            ))}
          </div>
          {error && <p className="mt-3 mono text-sm" style={{ color: "var(--stamp)" }}>{error}</p>}
        </motion.div>

        {/* running */}
        {phase === "running" && (
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {[{ t: a, s: statusA }, { t: b, s: statusB }].map((x, i) => (
              <div key={i} className="brutal p-4">
                <p className="label">reconciling // {x.t}</p>
                <p className="display text-[1.1rem] mt-1 mono" style={{ color: "var(--stamp)" }}>{x.s}</p>
              </div>
            ))}
          </div>
        )}

        {/* verdict */}
        {phase === "done" && resA && resB && <Verdict a={resA} b={resB} goal={goal} />}
      </div>
    </main>
  );
}

function Verdict({ a, b, goal }: { a: Bundle; b: Bundle; goal: Goal }) {
  const ca = composite(a.metrics), cb = composite(b.metrics);
  const win = ca >= cb ? a : b, lose = ca >= cb ? b : a;
  // biggest factor advantage for the winner
  let edge = win.metrics.breakdown[0]; let edgeDelta = -Infinity;
  for (const f of win.metrics.breakdown) {
    const lf = lose.metrics.breakdown.find((x) => x.label === f.label);
    const d = f.value - (lf?.value ?? 0);
    if (d > edgeDelta) { edgeDelta = d; edge = f; }
  }
  const reasoning =
    `${win.intent.topic} leads — Compile Score ${win.metrics.field_velocity} vs ${lose.metrics.field_velocity}, ` +
    `${win.metrics.trajectory} trajectory at ${win.metrics.confidence}% confidence. Its decisive edge is ` +
    `${edge.label.toLowerCase()} (+${edgeDelta}). Verdict: prioritise ${win.intent.topic} for ${goal}.`;

  return (
    <motion.div variants={riseIn} initial="hidden" animate="show">
      {/* verdict banner */}
      <div className="brutal mt-6 p-5" style={{ background: "var(--ink)", color: "var(--paper)" }}>
        <p className="mono text-[0.56rem] tracking-[0.22em]" style={{ color: "var(--stamp)" }}>◇ STRATEGIC VERDICT // MULTI-SOURCE RECONCILED</p>
        <p className="display text-[clamp(1.4rem,4vw,2.4rem)] mt-2">▲ {win.intent.topic.toUpperCase()}</p>
        <p className="text-[0.95rem] leading-relaxed mt-2" style={{ color: "rgba(249,247,242,0.82)" }}>{reasoning}</p>
      </div>

      {/* two columns */}
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        {[a, b].map((x, i) => {
          const isWin = x === win;
          return (
            <div key={i} className="brutal p-5" style={isWin ? { borderColor: "var(--stamp)", boxShadow: "5px 5px 0 0 var(--stamp)" } : undefined}>
              <div className="flex items-center justify-between">
                <h3 className="display text-[1.3rem]">{x.intent.topic}</h3>
                {isWin && <span className="cert" style={{ background: "var(--stamp)", color: "var(--paper)" }}>RECOMMENDED</span>}
              </div>
              <div className="flex items-end gap-3 mt-3">
                <p className="display text-[3rem] leading-none"><Counter to={x.metrics.field_velocity} duration={1.2} /></p>
                <div className="mb-1.5">
                  <p className="mono text-[0.6rem]" style={{ color: "var(--ink-3)" }}>COMPILE SCORE</p>
                  <p className="mono text-[0.66rem] font-bold" style={{ color: "var(--stamp)" }}>{x.metrics.ecosystem_state.toUpperCase()} · {x.metrics.trajectory.toUpperCase()}</p>
                </div>
              </div>
              <p className="mono text-[0.6rem] mt-2" style={{ color: "var(--ink-3)" }}>{x.metrics.confidence}% confidence · {x.metrics.artifacts_found} signals</p>
              <Link href={`/dossier/${slug(x.intent.topic)}`} className="press btn-ink inline-block px-4 py-2 mt-3 mono text-[0.62rem]">FULL DOSSIER ↗</Link>
            </div>
          );
        })}
      </div>

      {/* head-to-head factors */}
      <div className="brutal mt-3 p-5">
        <p className="label mb-3">head-to-head // signal factors</p>
        <div className="grid gap-2.5">
          {a.metrics.breakdown.map((fa) => {
            const fb = b.metrics.breakdown.find((x) => x.label === fa.label);
            const vb = fb?.value ?? 0;
            return (
              <div key={fa.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex items-center gap-1.5 justify-end"><span className="mono text-[0.6rem] w-7 text-right font-bold">{fa.value}</span><div className="bar-track h-3.5 flex-1" style={{ maxWidth: 120 }}><div className="h-full ml-auto" style={{ width: `${Math.max(5, fa.value)}%`, background: fa.value >= vb ? "var(--stamp)" : "var(--ink)" }} /></div></div>
                <span className="text-[0.62rem] text-center px-1" style={{ color: "var(--ink-3)", minWidth: 110 }}>{fa.label}</span>
                <div className="flex items-center gap-1.5"><div className="bar-track h-3.5 flex-1" style={{ maxWidth: 120 }}><div className="h-full" style={{ width: `${Math.max(5, vb)}%`, background: vb > fa.value ? "var(--stamp)" : "var(--ink)" }} /></div><span className="mono text-[0.6rem] w-7 font-bold">{vb}</span></div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 mt-3 pt-2" style={{ borderTop: "2px solid var(--ink)" }}>
          <span className="display text-[0.9rem] text-right pr-3">◂ {a.intent.topic}</span>
          <span className="display text-[0.9rem] pl-3">{b.intent.topic} ▸</span>
        </div>
      </div>
    </motion.div>
  );
}

function MiniSeg<T extends string>({ value, opts, on }: { value: T; opts: T[]; on: (v: T) => void }) {
  return (
    <div className="inline-flex" style={{ border: "2px solid var(--ink)" }}>
      {opts.map((o, i) => (
        <button key={o} onClick={() => on(o)} className="mono text-[0.58rem] px-2 py-1 press"
          style={{ borderLeft: i ? "2px solid var(--ink)" : "none", background: value === o ? "var(--ink)" : "var(--paper)", color: value === o ? "var(--paper)" : "var(--ink-2)" }}>{o}</button>
      ))}
    </div>
  );
}

function slug(s: string): string { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }
