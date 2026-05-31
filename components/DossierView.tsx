"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Reveal from "@/components/Reveal";
import Counter from "@/components/Counter";
import Sticky from "@/components/Sticky";
import { SourceLogo, GitHubLogo, ArrowUR } from "@/components/logos";
import { recencyLabel, repoScore } from "@/lib/metrics";
import { riseIn } from "@/lib/motion";
import type {
  Intent, Synthesis, CompileMetrics, NodeResult,
  Paper, Repo, Tutorial, Discussion, TrendData, ContextData,
} from "@/lib/types";

export interface DossierProps {
  intent: Intent; synthesis: Synthesis; metrics: CompileMetrics;
  results: Record<string, NodeResult>; facts?: string[]; footer?: React.ReactNode;
}

export default function DossierView({ intent, synthesis: s, metrics: m, results: r, facts = [], footer }: DossierProps) {
  const [tab, setTab] = useState<"code" | "papers" | "tutorials">("code");
  const context = r.context?.data as ContextData | undefined;
  const repos = (r.code?.data as Repo[] | undefined) ?? [];
  const papers = (r.papers?.data as Paper[] | undefined) ?? [];
  const tutorials = (r.tutorials?.data as Tutorial[] | undefined) ?? [];
  const community = (r.community?.data as Discussion[] | undefined) ?? [];
  const trends = r.trends?.data as TrendData | undefined;
  const maxStars = repos.reduce((a, x) => Math.max(a, x.stars), 1);
  const traj = { rising: "↑ RISING", stable: "→ STABLE", declining: "↓ DECLINING" }[m.trajectory];

  return (
    <div className="relative z-10 mx-auto max-w-4xl px-5 pt-20 pb-16">
      {/* classification strip */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3 px-1">
        <span className="mono text-[0.54rem] tracking-[0.22em]" style={{ color: "var(--ink-3)" }}>◇ CLASSIFICATION // OPEN-SOURCE INTELLIGENCE · COMPILE-OSINT</span>
        <span className="mono text-[0.54rem] tracking-[0.22em]" style={{ color: "var(--ink-3)" }}>REF-{intent.topic.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}</span>
      </div>
      {/* header */}
      <motion.div variants={riseIn} initial="hidden" animate="show" className="brutal p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap pb-3" style={{ borderBottom: "2px solid var(--ink)" }}>
          <div>
            <p className="label">compiled dossier // {intent.goal} · {intent.level} · {intent.timeframe}</p>
            <h1 className="display text-[clamp(1.8rem,4.6vw,3rem)] mt-1">{intent.topic}</h1>
          </div>
          <span className="cert" style={m.confidence < 45 ? { background: "var(--stamp)", color: "var(--paper)" } : undefined}>{m.confidence < 45 ? "⚠" : "✓"} {m.confidence_label}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-[180px_1fr] mt-4 items-center">
          <div className="text-center brutal-inset p-3">
            <p className="display text-[3.6rem] leading-none">{m.field_velocity}<span className="text-[1rem]" style={{ color: "var(--ink-3)" }}>/100</span></p>
            <p className="label mt-1">compile score</p>
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

      {s.recommendation && (
        <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-3 brutal p-5" style={{ background: "var(--ink)", color: "var(--paper)" }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="mono text-[0.54rem] tracking-[0.22em]" style={{ color: "var(--stamp)" }}>◇ STRATEGIC RECOMMENDATION</p>
              <p className="display text-[clamp(1.5rem,4vw,2.4rem)] mt-1">{s.recommendation.verdict}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="mono text-[1.9rem] font-bold leading-none" style={{ color: "var(--stamp)" }}>{s.recommendation.confidence}%</p>
              <p className="mono text-[0.5rem] tracking-widest" style={{ color: "rgba(249,247,242,0.6)" }}>CONVICTION BAND</p>
              <div className="h-2 mt-1.5 w-28" style={{ border: "1px solid rgba(249,247,242,0.4)" }}><div className="h-full" style={{ width: `${s.recommendation.confidence}%`, background: "var(--stamp)" }} /></div>
            </div>
          </div>
          <ul className="mt-3 grid gap-1.5">
            {s.recommendation.reasoning.map((rr, i) => (
              <li key={i} className="flex items-start gap-2 text-[0.84rem]" style={{ color: "rgba(249,247,242,0.86)" }}><span style={{ color: "var(--stamp)" }}>▸</span>{rr}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {(m.trajectory === "declining" || m.confidence < 45) && (
        <div className="mt-3 p-3 flex items-center gap-2 flex-wrap" style={{ border: "2px solid var(--stamp)", background: "rgba(255,69,0,0.07)" }}>
          <span className="mono text-[0.7rem] font-bold" style={{ color: "var(--stamp)" }}>⚠ {m.trajectory === "declining" ? "ECOSYSTEM DECELERATION DETECTED" : "SIGNAL INSTABILITY DETECTED"}</span>
          <span className="text-[0.76rem]" style={{ color: "var(--ink-2)" }}>{m.trajectory === "declining" ? "Adoption is cooling — pair with a modern successor before committing engineering effort." : "Cross-source agreement is low — treat these conclusions as provisional intelligence."}</span>
        </div>
      )}

      <Block title="COMPILE SCORE BREAKDOWN" sub="weighted signal reconciliation">
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

      {s.risks && s.risks.length > 0 && (
        <Block title="ECOSYSTEM RISK MATRIX" sub="signal-derived threat assessment">
          <div className="grid gap-2">
            {s.risks.map((rk) => {
              const col = rk.severity === "high" ? "var(--stamp)" : rk.severity === "medium" ? "var(--ink)" : "var(--ink-3)";
              return (
                <div key={rk.category} className="flex items-center gap-3 p-2.5" style={{ border: "2px solid var(--ink)" }}>
                  <span className="mono text-[0.54rem] px-2 py-1 shrink-0 text-center" style={{ background: col, color: "var(--paper)", minWidth: 70 }}>{rk.severity.toUpperCase()}</span>
                  <div className="flex-1 min-w-0"><p className="font-bold text-[0.82rem]">{rk.category}</p><p className="text-[0.74rem]" style={{ color: "var(--ink-2)" }}>{rk.note}</p></div>
                </div>
              );
            })}
          </div>
        </Block>
      )}

      <Block title="STRATEGIC VERDICT" sub="reconciled intelligence synthesis">
        <Reveal text={s.headline} className="display text-[clamp(1.4rem,3.4vw,2.2rem)]" stagger={40} />
        <p className="mt-4 text-[1rem] leading-relaxed" style={{ color: "var(--ink-2)" }}>{s.summary}</p>
        <div className="mt-3 inline-flex items-center gap-2 flex-wrap"><span className="cert">{traj} @ {m.confidence}% CONF</span><span className="text-[0.86rem]" style={{ color: "var(--ink-2)" }}>{s.trend_note}</span></div>
      </Block>

      <Block title="BUILD COMPILER" sub={`${intent.timeframe} execution blueprint`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {s.roadmap.map((ph, i) => (
            <motion.div key={ph.phase} variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} className="brutal-sm bg-transparent p-4">
              <div className="flex items-center justify-between pb-2 mb-2" style={{ borderBottom: "2px solid var(--ink)" }}>
                <span className="mono text-[0.62rem] font-bold">PHASE {ph.phase} · {ph.title.toUpperCase()}</span>
                <span className="mono text-[0.56rem] px-1.5 py-0.5" style={{ background: "var(--ink)", color: "var(--paper)" }}>{ph.duration}</span>
              </div>
              <ul className="grid gap-1.5">
                {ph.objectives.map((o, j) => <li key={j} className="flex items-start gap-2 text-[0.82rem]"><span className="mono mt-0.5" style={{ color: "var(--stamp)" }}>☐</span>{o}</li>)}
              </ul>
              {ph.resources.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{ph.resources.map((rs, j) => <span key={j} className="mono text-[0.56rem] px-1.5 py-0.5" style={{ border: "1px solid var(--ink-3)", color: "var(--ink-3)" }}>{rs.slice(0, 38)}</span>)}</div>}
            </motion.div>
          ))}
        </div>
      </Block>

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

      <Block title="STRATEGIC INSIGHTS" sub="high-conviction conclusions">
        <div className="grid gap-2">
          {s.insights.map((ins, i) => (
            <div key={i} className="brutal-sm bg-transparent p-3 flex gap-3"><span className="mono text-[0.6rem] font-bold shrink-0" style={{ color: "var(--stamp)" }}>{String(i + 1).padStart(2, "0")}</span><p className="text-[0.86rem] leading-relaxed">{ins}</p></div>
          ))}
        </div>
      </Block>

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

      {trends && (
        <Block title="MARKET INTELLIGENCE" sub="wire-ready · YC · Product Hunt · TechCrunch">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="brutal-sm bg-transparent p-3"><p className="label mb-2">tooling consolidation</p><div className="flex flex-wrap gap-1.5">{trends.hot_tools.map((t) => <span key={t} className="mono text-[0.62rem] px-1.5 py-0.5" style={{ background: "var(--stamp)", color: "var(--paper)" }}>{t}</span>)}</div></div>
            <div className="brutal-sm bg-transparent p-3"><p className="label mb-2">venture placement</p>{trends.companies.map((c) => <p key={c} className="text-[0.78rem]">▸ {c}</p>)}</div>
            <div className="brutal-sm bg-transparent p-3"><p className="label mb-2">launch momentum</p>{trends.launches.map((l) => <p key={l} className="text-[0.78rem]">▸ {l}</p>)}</div>
          </div>
        </Block>
      )}

      {facts.length > 0 && <div className="mt-10 grid gap-5 sm:grid-cols-3">{facts.slice(0, 3).map((f, i) => <Sticky key={i} text={f} index={i} />)}</div>}

      {context && (
        <div className="brutal-inset mt-10 p-4">
          <div className="flex items-center gap-2 mb-1.5"><SourceLogo source="wikipedia" /><span className="label">context · wikipedia</span></div>
          <p className="text-[0.82rem] leading-relaxed" style={{ color: "var(--ink-2)" }}>{context.summary}</p>
        </div>
      )}

      {footer && <div className="mt-12 pt-4 rule">{footer}</div>}
    </div>
  );
}

function Block({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <motion.div variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="mt-4 brutal p-4">
      <div className="flex items-baseline justify-between mb-3 pb-2" style={{ borderBottom: "2px solid var(--ink)" }}>
        <h2 className="display text-[1.2rem]">{title}</h2><span className="label">{sub}</span>
      </div>
      {children}
    </motion.div>
  );
}
function Stat({ label, v, suffix = "", dec = 0 }: { label: string; v: number; suffix?: string; dec?: number }) {
  return <div className="brutal-inset p-2.5"><p className="mono text-[1.1rem] font-bold"><Counter to={v} decimals={dec} suffix={suffix} duration={1.2} /></p><p className="label mt-1" style={{ fontSize: "0.44rem" }}>{label}</p></div>;
}
function Empty() { return <div className="brutal-sm bg-transparent p-6 text-center mono text-[0.7rem]" style={{ color: "var(--ink-3)" }}>NO SIGNAL — BROADEN INTENT</div>; }
