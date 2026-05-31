"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Chrome from "@/components/Chrome";
import RealityGraph, { type NodeStateMap } from "@/components/RealityGraph";
import { SourceLogo, ArrowUR } from "@/components/logos";
import { getCompile, type StoredCompile } from "@/lib/store";
import { SPRING } from "@/lib/motion";
import { SOURCES, NODE_ORDER, type NodeId, type Paper, type Repo, type Tutorial, type Discussion, type TrendData, type ContextData } from "@/lib/types";

function confidenceMeta(confidence: number, trajectory: string) {
  if (confidence >= 80 && trajectory === "rising") return { label: "CONSENSUS LOCKED", cls: "cs-locked" };
  if (confidence >= 75)  return { label: "VERIFIED",                cls: "cs-verified" };
  if (confidence >= 60)  return { label: "HIGH CONVICTION",         cls: "cs-high" };
  if (confidence >= 45)  return { label: "MODERATE SIGNAL",         cls: "cs-moderate" };
  if (confidence >= 30)  return { label: "LOW CONFIDENCE",          cls: "cs-low" };
  return                        { label: "ECOSYSTEM FRAGMENTATION", cls: "cs-fragment" };
}
function heatLabel(v: number) { return v >= 76 ? "EXPLOSIVE ↑↑" : v >= 60 ? "RISING ↑" : v >= 40 ? "STABLE →" : "COOLING ↓"; }
function heatColor(v: number) { return v >= 76 ? "var(--stamp)" : v >= 60 ? "#d4af37" : v >= 40 ? "var(--ink-2)" : "#4488ff"; }

export default function GraphPage() {
  const { id }  = useParams<{ id: string }>();
  const [rec,   setRec]   = useState<StoredCompile | null | undefined>(undefined);
  const [sel,   setSel]   = useState<NodeId | null>(null);
  const [sheet, setSheet] = useState<"info" | "clusters">("info");
  useEffect(() => { setRec(getCompile(id)); }, [id]);

  const states: NodeStateMap = useMemo(
    () => Object.fromEntries(NODE_ORDER.map((k) => [k, k === sel ? "running" : "done"])) as NodeStateMap,
    [sel],
  );

  const vel  = rec?.metrics.field_velocity ?? 50;
  const conf = rec ? confidenceMeta(rec.metrics.confidence, rec.metrics.trajectory) : null;

  const InfoContent = rec ? (
    <>
      <p className="label" style={{ fontSize: "0.46rem" }}>knowledge graph // workspace</p>
      <h1 className="display text-[1.2rem] mt-1 leading-tight">{rec.topic}</h1>
      <div className="grid grid-cols-2 gap-1.5 mt-2.5">
        <div className="brutal-inset p-2">
          <p className="mono text-[1.2rem] font-bold leading-none" style={{ color: heatColor(vel) }}>{vel}</p>
          <p className="label mt-0.5" style={{ fontSize: "0.4rem" }}>compile score</p>
        </div>
        <div className="brutal-inset p-2">
          <p className="mono text-[1.2rem] font-bold leading-none" style={{ color: "var(--stamp)" }}>{rec.metrics.confidence}%</p>
          <p className="label mt-0.5" style={{ fontSize: "0.4rem" }}>confidence</p>
        </div>
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="label" style={{ fontSize: "0.4rem" }}>field velocity</span>
          <span className="mono text-[0.48rem] font-bold" style={{ color: heatColor(vel) }}>{heatLabel(vel)}</span>
        </div>
        <div className="bar-track h-1.5">
          <div className="h-full" style={{ width: `${vel}%`, background: heatColor(vel) }} />
        </div>
      </div>
      {conf && <div className="mt-2"><span className={`mono ${conf.cls} conf-tick`} style={{ fontSize: "0.46rem", padding: "0.18rem 0.48rem", letterSpacing: "0.12em", display: "inline-block" }}>{conf.label}</span></div>}
      <p className="mono text-[0.52rem] mt-1.5" style={{ color: "var(--ink-2)" }}>
        {rec.metrics.ecosystem_state.toUpperCase()} · {rec.metrics.trajectory.toUpperCase()} · {rec.metrics.artifacts_found} artifacts
      </p>
      {rec.intent?.goalProfile && (
        <p className="mono text-[0.46rem] mt-1 px-2 py-0.5 inline-block tracking-[0.13em]" style={{ background: "var(--stamp)", color: "var(--paper)" }}>
          {rec.intent.goal.toUpperCase()} // {String(rec.intent.goalProfile).toUpperCase().replace(/-/g," ")}
        </p>
      )}
      <Link href={`/dossier/${rec.id}`} className="press btn-ink inline-flex items-center gap-1.5 px-3 py-2 mt-2.5 mono text-[0.6rem]">FULL DOSSIER <ArrowUR s={10} /></Link>
    </>
  ) : null;

  const ClustersContent = rec ? (
    <>
      <p className="label mb-1.5" style={{ fontSize: "0.46rem" }}>dependency clusters</p>
      <div className="grid gap-1">
        {NODE_ORDER.map((nid) => {
          const r      = rec.results[nid];
          const active = sel === nid;
          return (
            <button key={nid} onClick={() => setSel(active ? null : nid)}
              className="press flex items-center gap-2 px-2 py-1.5 text-left"
              style={{ border: "2px solid var(--ink)", background: active ? "var(--stamp)" : "var(--paper)" }}>
              <SourceLogo source={SOURCES[nid].source} />
              <span className="text-[0.7rem] font-bold flex-1" style={{ color: active ? "var(--paper)" : "var(--ink)" }}>{SOURCES[nid].label}</span>
              <span className="mono text-[0.54rem]" style={{ color: active ? "var(--paper)" : "var(--ink-3)" }}>{r?.count ?? 0}</span>
              {active && <span className="mono text-[0.46rem] stamp-in" style={{ color: "var(--paper)" }}>TRACE ▸</span>}
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="mt-3 pt-2.5" style={{ borderTop: "2px solid var(--ink)" }}>
          <div className="flex items-center gap-2 mb-2">
            <p className="label" style={{ fontSize: "0.46rem" }}>{SOURCES[sel].label} · {SOURCES[sel].source}</p>
            {conf && <span className={`mono ${conf.cls}`} style={{ fontSize: "0.4rem", padding: "0.1rem 0.38rem" }}>{conf.label}</span>}
          </div>
          <ClusterItems id={sel} rec={rec} />
        </div>
      )}
      {!sel && <p className="mono text-[0.56rem] mt-2.5" style={{ color: "var(--ink-3)" }}>SELECT A CLUSTER TO ILLUMINATE →</p>}
    </>
  ) : null;

  /* ────────────────────────────────────────────────────────────
     MOBILE layout: canvas at top (relative height) + scrollable panels below
     DESKTOP layout: fixed full-screen canvas + fixed side panels
  ──────────────────────────────────────────────────────────── */
  return (
    <main className="relative min-h-screen overflow-x-hidden md:h-screen md:overflow-hidden">
      <Chrome />

      {/* ── MOBILE: canvas in normal flow (avoids iOS fixed WebGL bug) ── */}
      {/* marginTop = logo bar (~48px) + mobile nav strip (~36px) = 84px */}
      <div className="md:hidden relative z-0" style={{ height: "44vh", marginTop: "84px" }}>
        <RealityGraph nodes={NODE_ORDER} states={states} phase="complete" offsetX={0} fieldVelocity={vel} />
      </div>

      {/* ── DESKTOP: full-screen canvas ── */}
      <div className="hidden md:block fixed inset-0 z-0">
        <RealityGraph nodes={NODE_ORDER} states={states} phase="complete" offsetX={1.8} fieldVelocity={vel} />
      </div>

      {/* ── Not found ── */}
      {!rec && (
        <div className="fixed left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 brutal p-8 text-center" style={{ background: "var(--paper)" }}>
          <p className="display text-[1.5rem]">{rec === undefined ? "LOADING…" : "NODE NOT FOUND"}</p>
          {rec === null && (<><p className="mono text-[0.7rem] mt-2" style={{ color: "var(--ink-3)" }}>/{id} not compiled yet</p><Link href="/" className="press btn-stamp inline-block px-6 py-3 mt-4 text-[0.86rem]">COMPILE IT ↗</Link></>)}
        </div>
      )}

      {rec && (
        <>
          {/* ── DESKTOP side panels ── */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={SPRING}
            className="hidden md:block fixed left-4 top-20 z-10 brutal p-4 w-[240px]" style={{ background: "var(--paper)" }}>
            {InfoContent}
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={SPRING}
            className="hidden md:block fixed right-4 top-20 bottom-4 z-10 brutal p-4 w-[280px] overflow-y-auto" style={{ background: "var(--paper)" }}>
            {ClustersContent}
          </motion.div>

          <div className="hidden md:flex fixed bottom-4 left-4 z-10 mono text-[0.5rem] gap-4" style={{ color: "var(--ink-2)" }}>
            <span style={{ color: heatColor(vel) }}>■ VELOCITY {vel}/100</span>
            <span>■ CHARCOAL = RESOLVED</span>
            <span style={{ color: "var(--stamp)" }}>■ ORANGE = ACTIVE TRACE</span>
          </div>

          {/* ── MOBILE panels: tabs below the canvas ── */}
          <div className="md:hidden relative z-10" style={{ background: "var(--paper)", borderTop: "2px solid var(--ink)" }}>
            {/* tab strip */}
            <div className="flex" style={{ borderBottom: "2px solid var(--ink)" }}>
              {(["info", "clusters"] as const).map((tab, i) => (
                <button key={tab} onClick={() => setSheet(tab)}
                  className="flex-1 mono text-[0.62rem] py-3 press"
                  style={{ borderLeft: i ? "2px solid var(--ink)" : "none", background: sheet === tab ? "var(--ink)" : "var(--paper)", color: sheet === tab ? "var(--paper)" : "var(--ink-3)" }}>
                  {tab === "info" ? "◇ INTEL" : "⬡ CLUSTERS"}
                </button>
              ))}
            </div>
            {/* tab content */}
            <div className="p-4 pb-8">
              <AnimatePresence mode="wait">
                {sheet === "info" ? (
                  <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                    {InfoContent}
                  </motion.div>
                ) : (
                  <motion.div key="clusters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                    {ClustersContent}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function ClusterItems({ id, rec }: { id: NodeId; rec: StoredCompile }) {
  const data = rec.results[id]?.data;
  if (!data) return <p className="mono text-[0.56rem]" style={{ color: "var(--ink-3)" }}>NO SIGNAL</p>;
  if (id === "papers")    return <List items={(data as Paper[]).map((p) => ({ label: p.title, meta: `${p.year} · ${p.category}`, url: p.url }))} />;
  if (id === "code")      return <List items={(data as Repo[]).map((r) => ({ label: r.full_name, meta: `★${(r.stars/1000).toFixed(0)}k · ${r.language}`, url: r.url }))} />;
  if (id === "tutorials") return <List items={(data as Tutorial[]).map((t) => ({ label: t.title, meta: t.platform, url: t.url }))} />;
  if (id === "community") return <List items={(data as Discussion[]).map((d) => ({ label: d.title, meta: `${d.source} · ↑${d.score}`, url: d.url }))} />;
  if (id === "trends") {
    const t = data as TrendData;
    return <List items={[...t.hot_tools.map((x) => ({ label: x, meta: "tool" })), ...t.companies.map((x) => ({ label: x, meta: "YC" })), ...t.launches.map((x) => ({ label: x, meta: "PH" }))]} />;
  }
  const c = data as ContextData;
  return <p className="text-[0.68rem] leading-relaxed" style={{ color: "var(--ink-2)" }}>{c.summary}</p>;
}

function List({ items }: { items: { label: string; meta: string; url?: string }[] }) {
  return (
    <div className="grid gap-1">
      {items.map((it, i) => {
        const inner = (<><span className="text-[0.66rem] font-semibold leading-snug line-clamp-2">{it.label}</span><span className="mono text-[0.48rem] block mt-0.5" style={{ color: "var(--ink-3)" }}>{it.meta}</span></>);
        return it.url
          ? <a key={i} href={it.url} target="_blank" rel="noreferrer" className="press brutal-sm bg-transparent p-2 block">{inner}</a>
          : <div key={i} className="brutal-sm bg-transparent p-2">{inner}</div>;
      })}
    </div>
  );
}
