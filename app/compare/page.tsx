"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Chrome from "@/components/Chrome";
import Counter from "@/components/Counter";
import { parseSSE } from "@/lib/sse";
import { saveCompile } from "@/lib/store";
import { riseIn, SPRING, submitShake } from "@/lib/motion";
import { validateComparisonCoherence } from "@/lib/entities";
import type { Intent, CompileMetrics, Synthesis, NodeResult, Level, Goal, GoalProfile } from "@/lib/types";

interface Bundle { intent: Intent; metrics: CompileMetrics; synthesis: Synthesis; results: Record<string, NodeResult>; facts: string[] }
type Phase = "idle" | "running" | "done";

const VS_SAMPLES = ["Rust vs Go", "LangChain vs MCP", "RAG vs fine-tuning", "Postgres vs MongoDB"];

type SubOpt = { id: GoalProfile; label: string };
const SUB_PROFILES: Record<Goal, SubOpt[]> = {
  learn:    [{ id: "fundamentals", label: "fundamentals" }, { id: "practical", label: "practical" }, { id: "deep-theory", label: "deep theory" }, { id: "fast-track", label: "fast-track" }, { id: "full-mastery", label: "full mastery" }],
  build:    [{ id: "mvp", label: "MVP" }, { id: "production", label: "production" }, { id: "scalable", label: "scalable" }, { id: "solo-dev", label: "solo-dev" }, { id: "enterprise", label: "enterprise" }],
  career:   [{ id: "faang", label: "FAANG" }, { id: "startup", label: "startup" }, { id: "research", label: "research" }, { id: "freelance", label: "freelance" }, { id: "quant", label: "quant" }, { id: "infra", label: "infra" }],
  research: [{ id: "papers", label: "papers" }, { id: "implementation", label: "implementation" }, { id: "frontier", label: "frontier" }, { id: "academic", label: "academic" }, { id: "open-source", label: "open-source" }],
  startup:  [{ id: "ai", label: "AI startup" }, { id: "infra", label: "infra startup" }, { id: "systems", label: "systems startup" }, { id: "research", label: "research startup" }, { id: "fintech", label: "fintech startup" }],
};
const DEFAULT_PROFILE: Record<Goal, GoalProfile> = { learn: "practical", build: "mvp", career: "faang", research: "frontier", startup: "ai" };

function confidenceMeta(confidence: number, trajectory: string) {
  if (confidence >= 80 && trajectory === "rising") return { label: "CONSENSUS LOCKED", cls: "cs-locked" };
  if (confidence >= 75)  return { label: "VERIFIED",                cls: "cs-verified" };
  if (confidence >= 60)  return { label: "HIGH CONVICTION",         cls: "cs-high" };
  if (confidence >= 45)  return { label: "MODERATE SIGNAL",         cls: "cs-moderate" };
  if (confidence >= 30)  return { label: "LOW CONFIDENCE",          cls: "cs-low" };
  return                        { label: "ECOSYSTEM FRAGMENTATION", cls: "cs-fragment" };
}

async function compileOne(
  topic: string, level: Level, goal: Goal, goalProfile: GoalProfile,
  depth: string, free: string,
  onStatus: (s: string) => void,
): Promise<Bundle> {
  const intention = free.trim() ? `${topic}. ${free}` : topic;
  const res = await fetch("/api/compile", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intention, level, goal, timeframe: depth, goalProfile }),
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

function composite(m: CompileMetrics): number {
  return m.field_velocity + (m.trajectory === "rising" ? 12 : m.trajectory === "stable" ? 4 : -6) + m.confidence * 0.1;
}

export default function ComparePage() {
  const [a, setA] = useState("Rust");
  const [b, setB] = useState("Go");
  const [level, setLevel]           = useState<Level>("advanced");
  const [goal, setGoal]             = useState<Goal>("career");
  const [goalProfile, setGoalProfile] = useState<GoalProfile>(DEFAULT_PROFILE["career"]);
  const [depth, setDepth]           = useState("1 month");
  const [free, setFree]             = useState("");
  const [phase, setPhase]           = useState<Phase>("idle");
  const [statusA, setStatusA]       = useState("STANDBY");
  const [statusB, setStatusB]       = useState("STANDBY");
  const [resA, setResA]             = useState<Bundle | null>(null);
  const [resB, setResB]             = useState<Bundle | null>(null);
  const [shaking, setShaking]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const run = async () => {
    if (!a.trim() || !b.trim()) return;
    setError(null); setResA(null); setResB(null);
    setStatusA("INITIALISING"); setStatusB("INITIALISING"); setPhase("running");
    try {
      const [bundleA, bundleB] = await Promise.all([
        compileOne(a, level, goal, goalProfile, depth, free, setStatusA),
        compileOne(b, level, goal, goalProfile, depth, free, setStatusB),
      ]);
      setResA(bundleA); setResB(bundleB);
      saveCompile({ topic: bundleA.intent.topic, level, goal, timeframe: depth, intent: bundleA.intent, metrics: bundleA.metrics, synthesis: bundleA.synthesis, results: bundleA.results, facts: bundleA.facts });
      saveCompile({ topic: bundleB.intent.topic, level, goal, timeframe: depth, intent: bundleB.intent, metrics: bundleB.metrics, synthesis: bundleB.synthesis, results: bundleB.results, facts: bundleB.facts });
      setPhase("done");
    } catch (e) { setError(e instanceof Error ? e.message : "comparison failed"); setPhase("idle"); }
  };
  const submit = () => { if (!a.trim() || !b.trim()) return; setShaking(true); setTimeout(() => { setShaking(false); run(); }, 340); };

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Chrome />
      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-16 pb-10">
        <motion.div variants={riseIn} initial="hidden" animate="show">
          <span className="cert">◇ STRATEGIC COMPARISON ENGINE</span>
          <h1 className="display text-[clamp(1.8rem,5vw,3.2rem)] mt-2">A vs B. <span style={{ color: "var(--stamp)" }}>ONE VERDICT.</span></h1>
          <p className="mono text-[0.68rem] mt-1" style={{ color: "var(--ink-3)" }}>reconciles two ecosystems head-to-head · which is the durable bet?</p>
        </motion.div>

        {/* input */}
        <motion.div animate={shaking ? submitShake : {}} className="brutal mt-4 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-center">
            <input value={a} onChange={(e) => setA(e.target.value)} placeholder="Option A"
              className="brutal-inset p-2.5 display text-[clamp(1.1rem,2.6vw,1.7rem)] bg-transparent focus:outline-none" style={{ color: "var(--ink)" }} />
            <span className="display text-[1.3rem] text-center" style={{ color: "var(--stamp)" }}>VS</span>
            <input value={b} onChange={(e) => setB(e.target.value)} placeholder="Option B"
              className="brutal-inset p-2.5 display text-[clamp(1.1rem,2.6vw,1.7rem)] bg-transparent focus:outline-none" style={{ color: "var(--ink)" }} />
          </div>
          <div className="mt-3 grid gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2"><span className="label">level</span><MiniSeg value={level} opts={["beginner", "intermediate", "advanced"] as Level[]} on={setLevel} /></div>
              <div className="flex items-center gap-2"><span className="label">goal</span><MiniSeg value={goal} opts={["learn", "build", "research", "career", "startup"] as Goal[]} on={(g) => { setGoal(g); setGoalProfile(DEFAULT_PROFILE[g]); }} /></div>
              <div className="flex items-center gap-2"><span className="label">depth</span><MiniSeg value={depth} opts={["weekend", "1 week", "1 month", "3 months"]} on={setDepth} /></div>
            </div>
            {/* sub-profile — no overflow-hidden so buttons never clip */}
            <motion.div key={goal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
              className="flex items-center gap-2 flex-wrap">
              <span className="label">profile</span>
              <div className="inline-flex flex-wrap" style={{ border: "2px solid var(--stamp)", width: "fit-content" }}>
                {SUB_PROFILES[goal].map((opt, i) => (
                  <button key={opt.id} onClick={() => setGoalProfile(opt.id)} className="mono text-[0.56rem] px-2 py-1.5 press"
                    style={{ borderLeft: i ? "2px solid var(--stamp)" : "none", background: goalProfile === opt.id ? "var(--stamp)" : "var(--paper)", color: goalProfile === opt.id ? "var(--paper)" : "var(--ink-2)" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
          <textarea value={free} onChange={(e) => setFree(e.target.value)} rows={2}
            placeholder="strategic context — 'evaluate for production AI infra at scale'…"
            title="Optional free-text context that shapes both compilations identically"
            className="brutal-inset mt-3 block w-full p-2.5 resize-none text-[0.82rem] focus:outline-none" style={{ color: "var(--ink-2)" }} />
          <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {VS_SAMPLES.map((s) => (
                <button key={s} onClick={() => { const [x, y] = s.split(" vs "); setA(x); setB(y); }} className="press brutal-sm bg-transparent px-2.5 py-1 mono text-[0.6rem]" style={{ color: "var(--ink-2)" }}>{s}</button>
              ))}
            </div>
            <button onClick={submit} disabled={phase === "running"} className="press btn-stamp px-5 py-2.5 text-[0.86rem]" style={{ opacity: phase === "running" ? 0.6 : 1 }}>
              {phase === "running" ? "RECONCILING…" : "RECONCILE ▸"}
            </button>
          </div>
          {error && <p className="mt-3 mono text-sm" style={{ color: "var(--stamp)" }}>{error}</p>}
        </motion.div>

        {/* running */}
        {phase === "running" && (
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {[{ t: a, s: statusA }, { t: b, s: statusB }].map((x, i) => (
              <div key={i} className="brutal p-3">
                <p className="label">reconciling // {x.t}</p>
                <p className="display text-[1rem] mt-1 mono" style={{ color: "var(--stamp)" }}>{x.s}</p>
              </div>
            ))}
          </div>
        )}

        {phase === "done" && resA && resB && <Verdict a={resA} b={resB} goal={goal} goalProfile={goalProfile} />}
      </div>
    </main>
  );
}

function Verdict({ a, b, goal, goalProfile }: { a: Bundle; b: Bundle; goal: Goal; goalProfile: GoalProfile }) {
  const ca = composite(a.metrics), cb = composite(b.metrics);
  const win = ca >= cb ? a : b, lose = ca >= cb ? b : a;
  let edge = win.metrics.breakdown[0]; let edgeDelta = -Infinity;
  for (const f of win.metrics.breakdown) {
    const lf = lose.metrics.breakdown.find((x) => x.label === f.label);
    const d = f.value - (lf?.value ?? 0);
    if (d > edgeDelta) { edgeDelta = d; edge = f; }
  }

  // Validate that the two topics are semantically coherent
  const coherenceWarning = validateComparisonCoherence(win.intent.topic, lose.intent.topic);

  // Institutional verdict — describes the comparison, NOT the user goal verb
  const wTraj  = win.metrics.trajectory;
  const lTraj  = lose.metrics.trajectory;
  const wEco   = win.metrics.ecosystem_state.toLowerCase();
  const lEco   = lose.metrics.ecosystem_state.toLowerCase();
  const wScore = win.metrics.field_velocity;
  const lScore = lose.metrics.field_velocity;
  const delta  = wScore - lScore;

  const trajectoryNote = (t: string) =>
    t === "rising" ? "accelerating adoption trajectory" :
    t === "stable" ? "stable production adoption" :
    "decelerating momentum";

  const reasoning =
    `${win.intent.topic} currently demonstrates ${trajectoryNote(wTraj)} — Compile Score ${wScore} vs ${lScore} (+${delta}), ` +
    `with a decisive edge in ${edge.label.toLowerCase()}. Ecosystem state: ${wEco.toUpperCase()}, ` +
    `${win.metrics.confidence}% cross-source confidence. ` +
    `${lose.intent.topic} shows ${trajectoryNote(lTraj)} at ${lScore} — ${lEco.toUpperCase()} ecosystem — ` +
    `viable in contexts where ${edge.label.toLowerCase()} is not the primary constraint.`;

  const winConf  = confidenceMeta(win.metrics.confidence,  win.metrics.trajectory);
  const loseConf = confidenceMeta(lose.metrics.confidence, lose.metrics.trajectory);

  // startup bet labels
  function betLabel(score: number): string {
    if (goal !== "startup") return score >= ca || score >= cb ? "RECOMMENDED" : "";
    if (score >= 90) return "STRONG BET";
    if (score >= 75) return "BET";
    if (score >= 55) return "CONDITIONAL BET";
    return "NO-BET";
  }

  return (
    <motion.div variants={riseIn} initial="hidden" animate="show">
      {/* verdict banner */}
      <div className="brutal mt-4 p-4" style={{ background: "var(--ink)", color: "var(--paper)" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="mono text-[0.52rem] tracking-[0.22em]" style={{ color: "var(--stamp)" }}>◇ STRATEGIC VERDICT // MULTI-SOURCE RECONCILED</p>
            <p className="display text-[clamp(1.3rem,3.8vw,2.2rem)] mt-1">▲ {win.intent.topic.toUpperCase()}</p>
          </div>
          <span className={`mono ${winConf.cls} conf-tick`}
            style={{ fontSize: "0.52rem", padding: "0.22rem 0.65rem", letterSpacing: "0.14em" }}>
            {winConf.label}
          </span>
        </div>
        {coherenceWarning && (
          <div className="mt-2 px-2.5 py-1.5 text-[0.72rem]" style={{ border: "1px solid var(--stamp)", color: "var(--stamp)" }}>
            {coherenceWarning}
          </div>
        )}
        <p className="text-[0.9rem] leading-relaxed mt-2" style={{ color: "rgba(249,247,242,0.82)" }}>{reasoning}</p>
        <p className="mono text-[0.52rem] mt-2" style={{ color: "rgba(249,247,242,0.5)" }}>
          SCORING PROFILE: {goal.toUpperCase()} / {goalProfile.toUpperCase().replace(/-/g, " ")}
        </p>
      </div>

      {/* two columns */}
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        {[a, b].map((x, i) => {
          const isWin = x === win;
          const xConf = confidenceMeta(x.metrics.confidence, x.metrics.trajectory);
          const score = composite(x.metrics);
          const bet   = betLabel(score);
          return (
            <div key={i}
              className={`brutal p-4 ${isWin ? "pulse-winner" : ""}`}
              style={isWin ? { border: "3px solid var(--stamp)" } : undefined}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="display text-[1.2rem]">{x.intent.topic}</h3>
                  {isWin && x.metrics.confidence >= 65 && (
                    <p className="mono text-[0.44rem] mt-0.5 tracking-[0.16em]" style={{ color: "var(--stamp)" }}>
                      ▲ HIGH CONVICTION · DECISIVELY SELECTED
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {bet && <span className={`mono ${isWin ? "cs-high" : "cs-moderate"}`} style={{ fontSize: "0.5rem", padding: "0.18rem 0.55rem" }}>{bet}</span>}
                  <span className={`mono ${xConf.cls} conf-tick`} style={{ fontSize: "0.44rem", padding: "0.12rem 0.4rem" }}>{xConf.label}</span>
                </div>
              </div>
              <div className="flex items-end gap-3 mt-2">
                <p className="display text-[2.8rem] leading-none"><Counter to={x.metrics.field_velocity} duration={1.2} /></p>
                <div className="mb-1">
                  <p className="mono text-[0.56rem]" style={{ color: "var(--ink-3)" }}>COMPILE SCORE</p>
                  <p className="mono text-[0.62rem] font-bold" style={{ color: "var(--stamp)" }}>{x.metrics.ecosystem_state.toUpperCase()} · {x.metrics.trajectory.toUpperCase()}</p>
                </div>
              </div>
              {/* animated confidence bar — winner only */}
              {isWin && (
                <div className="mt-1.5 bar-track h-1.5">
                  <motion.div className="h-full" style={{ background: "var(--stamp)" }}
                    initial={{ width: 0 }} animate={{ width: `${x.metrics.confidence}%` }} transition={{ duration: 1, delay: 0.3 }} />
                </div>
              )}
              <p className="mono text-[0.56rem] mt-1" style={{ color: "var(--ink-3)" }}>{x.metrics.confidence}% confidence · {x.metrics.artifacts_found} signals</p>
              <Link href={`/dossier/${slug(x.intent.topic)}`} className="press btn-ink inline-block px-4 py-2 mt-2.5 mono text-[0.6rem]">FULL DOSSIER ↗</Link>
            </div>
          );
        })}
      </div>

      {/* head-to-head factors */}
      <div className="brutal mt-3 p-4">
        <div className="flex items-baseline justify-between mb-2 pb-1.5" style={{ borderBottom: "2px solid var(--ink)" }}>
          <p className="label">head-to-head // signal factors</p>
          <div className="flex gap-1.5">
            <span className={`mono ${winConf.cls}`} style={{ fontSize: "0.44rem", padding: "0.1rem 0.4rem" }}>A: {winConf.label}</span>
            <span className={`mono ${loseConf.cls}`} style={{ fontSize: "0.44rem", padding: "0.1rem 0.4rem" }}>B: {loseConf.label}</span>
          </div>
        </div>
        <div className="grid gap-2">
          {a.metrics.breakdown.map((fa) => {
            const fb = b.metrics.breakdown.find((x) => x.label === fa.label);
            const vb = fb?.value ?? 0;
            return (
              <div key={fa.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex items-center gap-1.5 justify-end"><span className="mono text-[0.58rem] w-7 text-right font-bold">{fa.value}</span><div className="bar-track h-3 flex-1" style={{ maxWidth: 110 }}><div className="h-full ml-auto" style={{ width: `${Math.max(5, fa.value)}%`, background: fa.value >= vb ? "var(--stamp)" : "var(--ink)" }} /></div></div>
                <span className="text-[0.58rem] text-center px-1" style={{ color: "var(--ink-3)", minWidth: 108 }}>{fa.label}</span>
                <div className="flex items-center gap-1.5"><div className="bar-track h-3 flex-1" style={{ maxWidth: 110 }}><div className="h-full" style={{ width: `${Math.max(5, vb)}%`, background: vb > fa.value ? "var(--stamp)" : "var(--ink)" }} /></div><span className="mono text-[0.58rem] w-7 font-bold">{vb}</span></div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 mt-2.5 pt-2" style={{ borderTop: "2px solid var(--ink)" }}>
          <span className="display text-[0.85rem] text-right pr-3">◂ {a.intent.topic}</span>
          <span className="display text-[0.85rem] pl-3">{b.intent.topic} ▸</span>
        </div>
      </div>
    </motion.div>
  );
}

function MiniSeg<T extends string>({ value, opts, on }: { value: T; opts: T[]; on: (v: T) => void }) {
  return (
    <div className="inline-flex" style={{ border: "2px solid var(--ink)" }}>
      {opts.map((o, i) => (
        <button key={o} onClick={() => on(o)} className="mono text-[0.56rem] px-2 py-1 press"
          style={{ borderLeft: i ? "2px solid var(--ink)" : "none", background: value === o ? "var(--ink)" : "var(--paper)", color: value === o ? "var(--paper)" : "var(--ink-2)" }}>{o}</button>
      ))}
    </div>
  );
}

function slug(s: string): string { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }
