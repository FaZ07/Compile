"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Reveal from "@/components/Reveal";
import Counter from "@/components/Counter";
import { SourceLogo, GitHubLogo, ArrowUR } from "@/components/logos";
import { recencyLabel, repoScore, semanticRelevance } from "@/lib/metrics";
import { riseIn } from "@/lib/motion";
import type {
  Intent, Synthesis, CompileMetrics, NodeResult,
  Paper, Repo, Tutorial, Discussion, TrendData, ContextData,
} from "@/lib/types";

export interface DossierProps {
  intent: Intent; synthesis: Synthesis; metrics: CompileMetrics;
  results: Record<string, NodeResult>; facts?: string[]; footer?: React.ReactNode;
}

/* ── confidence stamp helpers ───────────────────────────────── */
function confidenceMeta(confidence: number, trajectory: string): { label: string; cls: string } {
  if (confidence >= 80 && trajectory === "rising") return { label: "CONSENSUS LOCKED",        cls: "cs-locked" };
  if (confidence >= 75)                            return { label: "VERIFIED",                  cls: "cs-verified" };
  if (confidence >= 60)                            return { label: "HIGH CONVICTION",            cls: "cs-high" };
  if (confidence >= 45)                            return { label: "MODERATE SIGNAL",            cls: "cs-moderate" };
  if (confidence >= 30)                            return { label: "LOW CONFIDENCE",             cls: "cs-low" };
  return                                                  { label: "ECOSYSTEM FRAGMENTATION",   cls: "cs-fragment" };
}

function ConfidenceStamp({ confidence, trajectory, small }: { confidence: number; trajectory: string; small?: boolean }) {
  const { label, cls } = confidenceMeta(confidence, trajectory);
  return (
    <span className={`mono ${cls} conf-tick`}
      style={{ fontSize: small ? "0.46rem" : "0.52rem", padding: small ? "0.15rem 0.5rem" : "0.22rem 0.65rem", letterSpacing: "0.14em", display: "inline-block" }}>
      {label}
    </span>
  );
}

/* ── warning detection ──────────────────────────────────────── */
function detectWarnings(m: CompileMetrics, r: Record<string, NodeResult>) {
  const get = (key: string) => m.breakdown.find((b) => b.label.toLowerCase().includes(key))?.value ?? 50;
  const arxiv    = get("arxiv");
  const commit   = get("commit");
  const reddit   = get("reddit");
  const hn       = get("hacker");
  const communityAvg = (reddit + hn) / 2;

  const warnings: { id: string; label: string; detail: string }[] = [];

  if (m.trajectory === "declining") {
    warnings.push({ id: "decel", label: "ECOSYSTEM DECELERATION DETECTED", detail: "Adoption is cooling — verify a modern successor exists before committing engineering effort." });
  }
  if (m.confidence < 45) {
    warnings.push({ id: "instability", label: "SIGNAL INSTABILITY DETECTED", detail: "Cross-source agreement is low — treat these conclusions as provisional intelligence until more signals converge." });
  }
  if (arxiv > 65 && communityAvg < 28) {
    warnings.push({ id: "diverge", label: "RESEARCH / COMMUNITY DIVERGENCE", detail: `Academic signal (${arxiv}) far outpaces practitioner discourse (${Math.round(communityAvg)}) — theory is ahead of production adoption.` });
  }
  if (commit < 32 && arxiv > 50) {
    warnings.push({ id: "impl", label: "LOW IMPLEMENTATION CONSENSUS", detail: "Research activity is high but repository commit velocity is low — the ecosystem is pre-production or fragmented." });
  }
  const communityItems = (r.community?.data as Discussion[] | undefined) ?? [];
  const frictionCount = communityItems.filter((d) =>
    /issue|slow|problem|hard|broken|deprecat|pain|struggl|complex|footgun|expensive|latency/i.test(`${d.title} ${d.snippet}`)
  ).length;
  if (m.trajectory === "rising" && frictionCount >= 2) {
    warnings.push({ id: "market-comm", label: "MARKET / COMMUNITY DIVERGENCE", detail: `Rising trajectory conflicts with practitioner friction (${frictionCount} signals) — validate production readiness before committing.` });
  }

  return warnings;
}

/* ── minimized right-side sticky panel ──────────────────────── */
const STICKY_TINT  = ["#ffe6b8", "#d6e4ff", "#ffd6c7"];
const STICKY_LABEL = ["HOW IT SCORES", "PRO TIP", "IT REMEMBERS"];

function StickyPanel({ facts }: { facts: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const items = facts.slice(0, 3);
  if (!items.length) return null;
  return (
    <div className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 flex-col gap-1.5">
      {items.map((f, i) => (
        <div key={i} className="relative flex items-stretch">
          {/* expanded card — slides out to the left */}
          <AnimatePresence>
            {open === i && (
              <motion.div key="card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}
                className="absolute right-[22px] top-0 w-48 p-3" style={{ background: STICKY_TINT[i], border: "2px solid var(--ink)", boxShadow: "-3px 3px 0 0 var(--ink)", zIndex: 1 }}>
                <p className="label mb-1.5" style={{ fontSize: "0.44rem" }}>{STICKY_LABEL[i]}</p>
                <p className="text-[0.76rem] leading-snug">{f}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* tab strip */}
          <button onClick={() => setOpen(open === i ? null : i)} title={STICKY_LABEL[i]}
            className="flex items-center justify-center press"
            style={{ width: 22, minHeight: 72, background: STICKY_TINT[i], border: "2px solid var(--ink)", borderRight: "none", writingMode: "vertical-rl", textOrientation: "mixed", fontSize: "0.42rem", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.14em", color: "var(--ink)", cursor: "pointer", userSelect: "none" }}>
            {STICKY_LABEL[i]}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function DossierView({ intent, synthesis: s, metrics: m, results: r, facts = [], footer }: DossierProps) {
  const [tab, setTab] = useState<"code" | "papers" | "tutorials">("code");
  const context   = r.context?.data    as ContextData   | undefined;
  const repos     = (r.code?.data      as Repo[]        | undefined) ?? [];
  const papers    = (r.papers?.data    as Paper[]       | undefined) ?? [];
  const tutorials = (r.tutorials?.data as Tutorial[]    | undefined) ?? [];
  const community = (r.community?.data as Discussion[]  | undefined) ?? [];
  const trends    = r.trends?.data     as TrendData     | undefined;
  // Sort repos by semantic relevance (topic + domain) before display
  const sortedRepos = [...repos].sort((a, b) =>
    repoScore(b, repos.reduce((m, r) => Math.max(m, r.stars), 1), intent.topic, intent.domain) -
    repoScore(a, repos.reduce((m, r) => Math.max(m, r.stars), 1), intent.topic, intent.domain)
  );
  const maxStars  = repos.reduce((a, x) => Math.max(a, x.stars), 1);
  const traj      = { rising: "↑ RISING", stable: "→ STABLE", declining: "↓ DECLINING" }[m.trajectory];
  const warnings  = detectWarnings(m, r);
  const confMeta  = confidenceMeta(m.confidence, m.trajectory);

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-3 sm:px-5 pt-16 pb-12">
      <StickyPanel facts={facts} />

      {/* classification strip */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2 px-1">
        <span className="mono text-[0.54rem] tracking-[0.22em]" style={{ color: "var(--ink-3)" }}>◇ CLASSIFICATION // OPEN-SOURCE INTELLIGENCE · COMPILE-OSINT</span>
        <span className="mono text-[0.54rem] tracking-[0.22em]" style={{ color: "var(--ink-3)" }}>REF-{intent.topic.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}</span>
      </div>

      {/* header */}
      <motion.div variants={riseIn} initial="hidden" animate="show" className="brutal p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap pb-3" style={{ borderBottom: "2px solid var(--ink)" }}>
          <div>
            <p className="label">compiled dossier // {intent.goal} · {intent.level} · {intent.timeframe}</p>
            <h1 className="display text-[clamp(1.6rem,4vw,2.6rem)] mt-1">{intent.topic}</h1>
            {intent.goalProfile && (
              <p className="mono text-[0.52rem] mt-1.5 inline-block px-2 py-0.5 tracking-[0.16em]"
                style={{ background: "var(--stamp)", color: "var(--paper)" }}>
                {intent.goal.toUpperCase()} // {intent.goalProfile.toUpperCase().replace(/-/g, " ")}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`cert ${m.confidence < 45 ? "border-[var(--stamp)] text-[var(--stamp)]" : ""}`}>{m.confidence < 45 ? "⚠" : "✓"} {m.confidence_label}</span>
            <ConfidenceStamp confidence={m.confidence} trajectory={m.trajectory} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr] mt-3 items-center">
          <div className="text-center brutal-inset p-2.5">
            <p className="display text-[3.2rem] leading-none">{m.field_velocity}<span className="text-[0.9rem]" style={{ color: "var(--ink-3)" }}>/100</span></p>
            <p className="label mt-0.5">compile score</p>
            <p className="mono text-[0.62rem] mt-1.5 px-2 py-0.5" style={{ background: "var(--stamp)", color: "var(--paper)" }}>{m.ecosystem_state.toUpperCase()} ECOSYSTEM</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label="signals"    v={m.artifacts_found} />
            <Stat label="sources"    v={m.sources_ok} suffix={`/${m.sources_queried}`} />
            <Stat label="latency"    v={m.total_latency_ms / 1000} suffix="s" dec={1} />
            <Stat label="confidence" v={m.confidence} suffix="%" />
            <HoverCell tip="Momentum direction reconciled across all sources: rising / stable / declining"><p className="mono text-[0.88rem] font-bold" style={{ color: "var(--stamp)" }}>{traj}</p><p className="label mt-0.5" style={{ fontSize: "0.42rem" }}>trajectory</p></HoverCell>
            <HoverCell tip="Fastest individual source response time — shows which API was quickest"><p className="mono text-[0.72rem] font-bold">{m.fastest_ms}ms</p><p className="label mt-0.5" style={{ fontSize: "0.42rem" }}>fastest</p></HoverCell>
          </div>
        </div>
      </motion.div>

      {/* intent precision warning */}
      {intent.precision === "low" && (
        <div className="mt-2 px-3 py-2 flex items-center gap-2.5 flex-wrap" style={{ border: "2px solid var(--ink)", background: "var(--paper-2)" }}>
          <span className="mono text-[0.62rem] font-bold">⚑ LOW INTENT PRECISION</span>
          <span className="text-[0.74rem]" style={{ color: "var(--ink-2)" }}>
            Intent was broad — domain auto-classified as <strong>{(intent.domain ?? "general").toUpperCase().replace(/-/g," ")}</strong>. For sharper results, specify a subdomain (e.g. "Python web development", "ML engineering", "DSA interview prep").
          </span>
        </div>
      )}

      {/* operational warnings — right after header */}
      {warnings.map((w) => (
        <div key={w.id} className="mt-2 px-3 py-2 flex items-start gap-2.5 flex-wrap warn-flash"
          style={{ border: "2px solid var(--stamp)", background: "rgba(255,69,0,0.06)" }}>
          <span className="mono text-[0.66rem] font-bold shrink-0" style={{ color: "var(--stamp)" }}>⚠ {w.label}</span>
          <span className="text-[0.74rem] leading-snug" style={{ color: "var(--ink-2)" }}>{w.detail}</span>
        </div>
      ))}

      {/* strategic recommendation */}
      {s.recommendation && (
        <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-3 brutal p-4" style={{ background: "var(--ink)", color: "var(--paper)" }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="mono text-[0.52rem] tracking-[0.22em]" style={{ color: "var(--stamp)" }}>◇ STRATEGIC RECOMMENDATION</p>
              <p className="display text-[clamp(1.3rem,3.6vw,2.2rem)] mt-1">{s.recommendation.verdict}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="mono text-[1.7rem] font-bold leading-none" style={{ color: "var(--stamp)" }}>{s.recommendation.confidence}%</p>
              <p className="mono text-[0.46rem] tracking-widest" style={{ color: "rgba(249,247,242,0.5)" }}>CONVICTION BAND</p>
              <div className="h-2 mt-1 w-24" style={{ border: "1px solid rgba(249,247,242,0.35)" }}><div className="h-full" style={{ width: `${s.recommendation.confidence}%`, background: "var(--stamp)" }} /></div>
              <ConfidenceStamp confidence={m.confidence} trajectory={m.trajectory} small />
            </div>
          </div>
          <ul className="mt-2.5 grid gap-1">
            {s.recommendation.reasoning.map((rr, i) => (
              <li key={i} className="flex items-start gap-2 text-[0.82rem]" style={{ color: "rgba(249,247,242,0.84)" }}><span style={{ color: "var(--stamp)" }}>▸</span>{rr}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* score breakdown + risk matrix — side by side */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} className="brutal p-4">
          <div className="flex items-baseline justify-between mb-2 pb-1.5" style={{ borderBottom: "2px solid var(--ink)" }}>
            <h2 className="display text-[1.05rem]">COMPILE SCORE</h2>
            <span className="label" style={{ fontSize: "0.44rem" }}>weighted signal</span>
          </div>
          <div className="grid gap-2">
            {m.breakdown.map((f) => (
              <div key={f.label} className="flex items-center gap-2 px-1 py-0.5 rounded-none cursor-default"
                title={`${f.label}: ${f.value}/100 · weight ×${f.weight}`}
                style={{ transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--paper-2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <span className="text-[0.7rem] w-36 shrink-0 leading-tight">{f.label}</span>
                <div className="bar-track h-4 flex-1"><div className="h-full flex items-center justify-end pr-1" style={{ width: `${Math.max(6, f.value)}%`, background: f.value >= 60 ? "var(--stamp)" : "var(--ink)" }}><span className="mono text-[0.5rem]" style={{ color: "var(--paper)" }}>{f.value}</span></div></div>
                <span className="mono text-[0.5rem] w-8 text-right shrink-0" style={{ color: "var(--ink-3)" }}>×{f.weight}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {s.risks && s.risks.length > 0 && (
          <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} className="brutal p-4">
            <div className="flex items-baseline justify-between mb-2 pb-1.5" style={{ borderBottom: "2px solid var(--ink)" }}>
              <h2 className="display text-[1.05rem]">RISK MATRIX</h2>
              <span className="label" style={{ fontSize: "0.44rem" }}>signal-derived</span>
            </div>
            <div className="grid gap-2">
              {s.risks.map((rk) => {
                const col = rk.severity === "high" ? "var(--stamp)" : rk.severity === "medium" ? "var(--ink)" : "var(--ink-3)";
                return (
                  <div key={rk.category} className="flex items-start gap-2 p-2 cursor-default"
                    title={`${rk.category} — ${rk.severity.toUpperCase()} severity`}
                    style={{ border: "2px solid var(--ink)", transition: "border-color 0.12s, background 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = col; e.currentTarget.style.background = "var(--paper-2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--ink)"; e.currentTarget.style.background = ""; }}>
                    <span className="mono text-[0.5rem] px-1.5 py-0.5 shrink-0 text-center leading-tight" style={{ background: col, color: "var(--paper)", minWidth: 54 }}>{rk.severity.toUpperCase()}</span>
                    <div className="flex-1 min-w-0"><p className="font-bold text-[0.76rem] leading-tight">{rk.category}</p><p className="text-[0.68rem] mt-0.5" style={{ color: "var(--ink-2)" }}>{rk.note}</p></div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* strategic verdict */}
      <Block title="STRATEGIC VERDICT" sub="reconciled intelligence synthesis" stamp={<ConfidenceStamp confidence={m.confidence} trajectory={m.trajectory} small />}>
        <Reveal text={s.headline} className="display text-[clamp(1.2rem,3vw,2rem)]" stagger={40} />
        <p className="mt-3 text-[0.9rem] leading-relaxed" style={{ color: "var(--ink-2)" }}>{s.summary}</p>
        <div className="mt-2 inline-flex items-center gap-2 flex-wrap"><span className="cert">{traj} @ {m.confidence}% CONF</span><span className="text-[0.82rem]" style={{ color: "var(--ink-2)" }}>{s.trend_note}</span></div>
      </Block>

      {/* build compiler */}
      <Block title="BUILD COMPILER" sub={`${intent.timeframe} execution blueprint`}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {s.roadmap.map((ph, i) => (
            <motion.div key={ph.phase} variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} className="brutal-sm bg-transparent p-3">
              <div className="flex items-center justify-between pb-1.5 mb-1.5" style={{ borderBottom: "2px solid var(--ink)" }}>
                <span className="mono text-[0.58rem] font-bold">PHASE {ph.phase} · {ph.title.toUpperCase()}</span>
                <span className="mono text-[0.52rem] px-1.5 py-0.5" style={{ background: "var(--ink)", color: "var(--paper)" }}>{ph.duration}</span>
              </div>
              <ul className="grid gap-1">
                {ph.objectives.map((o, j) => <li key={j} className="flex items-start gap-1.5 text-[0.78rem]"><span className="mono mt-0.5" style={{ color: "var(--stamp)" }}>☐</span>{o}</li>)}
              </ul>
              {ph.resources.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{ph.resources.map((rs, j) => <span key={j} className="mono text-[0.52rem] px-1.5 py-0.5" style={{ border: "1px solid var(--ink-3)", color: "var(--ink-3)" }}>{rs.slice(0, 36)}</span>)}</div>}
            </motion.div>
          ))}
        </div>
      </Block>

      {/* ranked implementations */}
      <Block title="RANKED IMPLEMENTATIONS" sub="deterministic repo scoring">
        <div className="flex gap-0 mb-3" style={{ width: "fit-content", border: "2px solid var(--ink)" }}>
          {(["code", "papers", "tutorials"] as const).map((t, i) => (
            <button key={t} onClick={() => setTab(t)} className="mono text-[0.62rem] px-3 py-1.5 press"
              style={{ borderLeft: i ? "2px solid var(--ink)" : "none", background: tab === t ? "var(--ink)" : "var(--paper)", color: tab === t ? "var(--paper)" : "var(--ink-2)" }}>
              {t === "code" ? `CODE ${repos.length}` : t === "papers" ? `PAPERS ${papers.length}` : `TUTORIALS ${tutorials.length}`}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          {tab === "code" && (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-1.5">
              {sortedRepos.map((rp, i) => { const sc = repoScore(rp, maxStars, intent.topic, intent.domain); return (
                <a key={i} href={rp.url} target="_blank" rel="noreferrer" className="press brutal-sm bg-transparent p-2.5 flex items-center gap-2.5">
                  <span className="mono text-[0.66rem] w-5" style={{ color: "var(--ink-3)" }}>{String(i + 1).padStart(2, "0")}</span>
                  <GitHubLogo s={15} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap"><span className="font-bold text-[0.82rem]">{rp.full_name}</span><span className="mono text-[0.5rem] px-1 py-0.5" style={{ border: "1px solid var(--ink-3)", color: "var(--ink-3)" }}>{rp.language}</span><span className="mono text-[0.5rem]" style={{ color: "var(--ink-3)" }}>{recencyLabel(rp.pushed_days_ago)}</span></div>
                    <p className="text-[0.72rem] mt-0.5 line-clamp-2" style={{ color: "var(--ink-2)" }}>{rp.description}</p>
                  </div>
                  <div className="text-right shrink-0 w-14"><p className="mono text-[1rem] font-bold" style={{ color: sc >= 60 ? "var(--stamp)" : "var(--ink)" }}>{sc}</p><p className="mono text-[0.44rem]" style={{ color: "var(--ink-3)" }}>★{(rp.stars / 1000).toFixed(0)}k</p></div>
                </a>
              ); })}
              {!repos.length && <Empty />}
            </motion.div>
          )}
          {tab === "papers" && (
            <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-1.5">
              {papers.map((pp, i) => (
                <a key={i} href={pp.url} target="_blank" rel="noreferrer" className="press brutal-sm bg-transparent p-2.5 block">
                  <div className="flex items-start justify-between gap-2"><span className="font-bold text-[0.82rem] leading-snug">{pp.title}</span><span className="mono text-[0.52rem] px-1.5 py-0.5 shrink-0" style={{ background: "var(--ink)", color: "var(--paper)" }}>{pp.year}</span></div>
                  <p className="mono text-[0.56rem] mt-0.5 italic" style={{ color: "var(--ink-3)" }}>{pp.authors.join(", ")} · {pp.category}</p>
                  <p className="text-[0.72rem] mt-1 line-clamp-2" style={{ color: "var(--ink-2)" }}>{pp.abstract}</p>
                </a>
              ))}
              {!papers.length && <Empty />}
            </motion.div>
          )}
          {tab === "tutorials" && (
            <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-1.5">
              {tutorials.map((tt, i) => (
                <a key={i} href={tt.url} target="_blank" rel="noreferrer" className="press brutal-sm bg-transparent p-2.5 flex items-center gap-2.5">
                  <SourceLogo source={tt.platform} />
                  <div className="flex-1 min-w-0"><p className="font-bold text-[0.8rem] leading-snug">{tt.title}</p><p className="mono text-[0.54rem] mt-0.5" style={{ color: "var(--ink-3)" }}>{tt.author} · {tt.platform}{tt.read_min ? ` · ${tt.read_min}min` : ""}{tt.views ? ` · ${(tt.views / 1000).toFixed(0)}k views` : ""}</p></div>
                  <ArrowUR s={12} />
                </a>
              ))}
              {!tutorials.length && <Empty />}
            </motion.div>
          )}
        </AnimatePresence>
      </Block>

      {/* community + insights — side by side */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {community.length > 0 && (
          <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} className="brutal p-4">
            <div className="flex items-baseline justify-between mb-2 pb-1.5" style={{ borderBottom: "2px solid var(--ink)" }}>
              <h2 className="display text-[1.05rem]">COMMUNITY</h2>
              <span className="label" style={{ fontSize: "0.44rem" }}>hover to declassify</span>
            </div>
            <div className="grid gap-1.5">
              {community.slice(0, 4).map((d, i) => (
                <div key={i} className="flex items-start gap-2 p-2" style={{ border: "2px solid var(--ink)" }}>
                  <SourceLogo source={d.source} />
                  <div className="flex-1 min-w-0">
                    <a href={d.url} target="_blank" rel="noreferrer" className="font-bold text-[0.76rem] leading-snug hover:underline line-clamp-2">{d.title}</a>
                    <p className="text-[0.68rem] mt-0.5"><span className="redacted">{d.snippet || "operational friction signal — practitioner feedback diverges from marketing narrative."}</span></p>
                    <p className="mono text-[0.5rem] mt-0.5" style={{ color: "var(--ink-3)" }}>{d.source} · ↑{d.score}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} className="brutal p-4">
          <div className="flex items-baseline justify-between mb-2 pb-1.5" style={{ borderBottom: "2px solid var(--ink)" }}>
            <h2 className="display text-[1.05rem]">INSIGHTS</h2>
            <ConfidenceStamp confidence={m.confidence} trajectory={m.trajectory} small />
          </div>
          <div className="grid gap-2">
            {s.insights.map((ins, i) => (
              <div key={i} className="flex gap-2.5 p-2.5 cursor-default"
                style={{ border: "2px solid var(--ink)", borderLeft: "4px solid var(--ink)", transition: "border-color 0.12s, background 0.12s" }}
                onMouseEnter={e => { e.currentTarget.style.borderLeftColor = "var(--stamp)"; e.currentTarget.style.background = "var(--paper-2)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderLeftColor = "var(--ink)"; e.currentTarget.style.background = ""; }}>
                <span className="mono text-[0.58rem] font-bold shrink-0" style={{ color: "var(--stamp)" }}>{String(i + 1).padStart(2, "0")}</span>
                <p className="text-[0.8rem] leading-relaxed">{ins}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* execution targets + market — side by side */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} className="brutal p-4">
          <div className="flex items-baseline justify-between mb-2 pb-1.5" style={{ borderBottom: "2px solid var(--ink)" }}>
            <h2 className="display text-[1.05rem]">EXECUTION TARGETS</h2>
            <span className="label" style={{ fontSize: "0.44rem" }}>ranked by difficulty</span>
          </div>
          <div className="grid gap-2">
            {s.projects.map((pr, i) => (
              <div key={i} className="brutal-sm bg-transparent p-3">
                <div className="flex items-center justify-between mb-1"><span className="mono text-[0.5rem]" style={{ color: "var(--ink-3)" }}>{["STARTER", "INTERMEDIATE", "ADVANCED"][pr.difficulty - 1]}</span><span>{Array.from({ length: 3 }).map((_, j) => <span key={j} style={{ color: j < pr.difficulty ? "var(--stamp)" : "var(--ink-3)" }}>■</span>)}</span></div>
                <p className="font-bold text-[0.84rem] leading-snug">{pr.title}</p>
                <p className="text-[0.7rem] mt-1" style={{ color: "var(--ink-2)" }}>{pr.why}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {trends && (
          <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} className="brutal p-4">
            <div className="flex items-baseline justify-between mb-2 pb-1.5" style={{ borderBottom: "2px solid var(--ink)" }}>
              <h2 className="display text-[1.05rem]">MARKET INTEL</h2>
              <span className="label" style={{ fontSize: "0.44rem" }}>YC · PH · TechCrunch</span>
            </div>
            <div className="grid gap-2.5">
              <div className="brutal-sm bg-transparent p-2.5"><p className="label mb-1.5" style={{ fontSize: "0.44rem" }}>tooling consolidation</p><div className="flex flex-wrap gap-1">{trends.hot_tools.map((t) => <span key={t} className="mono text-[0.58rem] px-1.5 py-0.5" style={{ background: "var(--stamp)", color: "var(--paper)" }}>{t}</span>)}</div></div>
              <div className="brutal-sm bg-transparent p-2.5"><p className="label mb-1.5" style={{ fontSize: "0.44rem" }}>venture placement</p>{trends.companies.map((c) => <p key={c} className="text-[0.74rem]">▸ {c}</p>)}</div>
              <div className="brutal-sm bg-transparent p-2.5"><p className="label mb-1.5" style={{ fontSize: "0.44rem" }}>launch momentum</p>{trends.launches.map((l) => <p key={l} className="text-[0.74rem]">▸ {l}</p>)}</div>
            </div>
          </motion.div>
        )}
      </div>

      {/* wikipedia context — collapsed at bottom */}
      {context && (
        <details className="brutal-inset mt-3 p-3 group">
          <summary className="flex items-center gap-2 cursor-pointer list-none">
            <SourceLogo source="wikipedia" />
            <span className="label" style={{ fontSize: "0.48rem" }}>context · wikipedia · {context.title}</span>
            <span className="mono text-[0.48rem] ml-auto" style={{ color: "var(--ink-3)" }}>▸ EXPAND</span>
          </summary>
          <p className="text-[0.78rem] leading-relaxed mt-2" style={{ color: "var(--ink-2)" }}>{context.summary}</p>
        </details>
      )}

      {footer && <div className="mt-8 pt-4 rule">{footer}</div>}
    </div>
  );
}

function Block({ title, sub, children, stamp }: { title: string; sub: string; children: React.ReactNode; stamp?: React.ReactNode }) {
  const [hdr, setHdr] = useState(false);
  return (
    <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="mt-3 brutal p-4">
      <div className="flex items-baseline justify-between mb-2.5 pb-2 cursor-default"
        style={{ borderBottom: `2px solid ${hdr ? "var(--stamp)" : "var(--ink)"}`, transition: "border-color 0.15s" }}
        onMouseEnter={() => setHdr(true)} onMouseLeave={() => setHdr(false)}>
        <h2 className="display text-[1.1rem]" style={{ color: hdr ? "var(--stamp)" : "", transition: "color 0.15s" }}>{title}</h2>
        <div className="flex items-center gap-2">{stamp}<span className="label" style={{ fontSize: "0.44rem" }}>{sub}</span></div>
      </div>
      {children}
    </motion.div>
  );
}
const STAT_TIP: Record<string, string> = {
  signals:    "Total artifacts collected across all 6 sources (papers + repos + tutorials + discussions + trends)",
  sources:    "Sources that returned valid data / total sources queried",
  latency:    "Wall-clock time for all 6 parallel network requests to complete",
  confidence: "Multi-source agreement score — how much the 6 sources agree (0–100%). Above 70% = high consensus",
};

function HoverCell({ children, tip, className = "" }: { children: React.ReactNode; tip?: string; className?: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className={`brutal-inset p-2 cursor-default ${className}`}
      style={{ background: on ? "var(--ink)" : "", transition: "background 0.12s, color 0.12s" }}
      title={tip} onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)}>
      <div style={{ color: on ? "var(--paper)" : "" }}>{children}</div>
    </div>
  );
}
function Stat({ label, v, suffix = "", dec = 0 }: { label: string; v: number; suffix?: string; dec?: number }) {
  return (
    <HoverCell tip={STAT_TIP[label] ?? label}>
      <p className="mono text-[1rem] font-bold"><Counter to={v} decimals={dec} suffix={suffix} duration={1.2} /></p>
      <p className="label mt-0.5" style={{ fontSize: "0.42rem" }}>{label}</p>
    </HoverCell>
  );
}
function Empty() { return <div className="brutal-sm bg-transparent p-5 text-center mono text-[0.66rem]" style={{ color: "var(--ink-3)" }}>NO SIGNAL — BROADEN INTENT</div>; }

