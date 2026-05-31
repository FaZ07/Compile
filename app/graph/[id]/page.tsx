"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import Chrome from "@/components/Chrome";
import RealityGraph, { type NodeStateMap } from "@/components/RealityGraph";
import { SourceLogo, ArrowUR } from "@/components/logos";
import { getCompile, type StoredCompile } from "@/lib/store";
import { SPRING } from "@/lib/motion";
import { SOURCES, NODE_ORDER, type NodeId, type Paper, type Repo, type Tutorial, type Discussion, type TrendData, type ContextData } from "@/lib/types";

export default function GraphPage() {
  const { id } = useParams<{ id: string }>();
  const [rec, setRec] = useState<StoredCompile | null | undefined>(undefined);
  const [sel, setSel] = useState<NodeId | null>(null);
  useEffect(() => { setRec(getCompile(id)); }, [id]);

  // selecting a cluster lights its node orange in the live 3D graph
  const states: NodeStateMap = useMemo(
    () => Object.fromEntries(NODE_ORDER.map((k) => [k, k === sel ? "running" : "done"])) as NodeStateMap,
    [sel],
  );

  return (
    <main className="relative h-screen overflow-hidden">
      <Chrome />
      <div className="fixed inset-0 z-0"><RealityGraph nodes={NODE_ORDER} states={states} phase="complete" offsetX={1.8} /></div>

      {!rec && (
        <div className="fixed left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 brutal p-8 text-center" style={{ background: "var(--paper)" }}>
          <p className="display text-[1.5rem]">{rec === undefined ? "LOADING WORKSPACE…" : "NODE NOT FOUND"}</p>
          {rec === null && (<><p className="mono text-[0.7rem] mt-2" style={{ color: "var(--ink-3)" }}>/{id} has not been compiled in this browser yet</p><Link href="/" className="press btn-stamp inline-block px-6 py-3 mt-4 text-[0.86rem]">COMPILE IT ↗</Link></>)}
        </div>
      )}

      {rec && (
        <>
          {/* left — intelligence readout */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={SPRING}
            className="fixed left-4 top-20 z-10 brutal p-4 w-[260px]" style={{ background: "var(--paper)" }}>
            <p className="label">knowledge graph // workspace</p>
            <h1 className="display text-[1.4rem] mt-1 leading-tight">{rec.topic}</h1>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="brutal-inset p-2"><p className="mono text-[1.4rem] font-bold leading-none">{rec.metrics.field_velocity}</p><p className="label" style={{ fontSize: "0.42rem" }}>compile score</p></div>
              <div className="brutal-inset p-2"><p className="mono text-[1.4rem] font-bold leading-none" style={{ color: "var(--stamp)" }}>{rec.metrics.confidence}%</p><p className="label" style={{ fontSize: "0.42rem" }}>confidence</p></div>
            </div>
            <p className="mono text-[0.62rem] mt-3" style={{ color: "var(--ink-2)" }}>{rec.metrics.ecosystem_state.toUpperCase()} ECOSYSTEM · {rec.metrics.trajectory.toUpperCase()}</p>
            <Link href={`/dossier/${rec.id}`} className="press btn-ink inline-flex items-center gap-1.5 px-4 py-2 mt-3 mono text-[0.66rem]">FULL DOSSIER <ArrowUR s={11} /></Link>
          </motion.div>

          {/* right — cluster control sheet */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={SPRING}
            className="fixed right-4 top-20 bottom-4 z-10 brutal p-4 w-[300px] overflow-y-auto" style={{ background: "var(--paper)" }}>
            <p className="label mb-2">dependency clusters</p>
            <div className="grid gap-1.5">
              {NODE_ORDER.map((nid) => {
                const r = rec.results[nid];
                const active = sel === nid;
                return (
                  <button key={nid} onClick={() => setSel(active ? null : nid)} className="press flex items-center gap-2 px-2 py-2 text-left"
                    style={{ border: "2px solid var(--ink)", background: active ? "var(--stamp)" : "var(--paper)" }}>
                    <SourceLogo source={SOURCES[nid].source} />
                    <span className="text-[0.74rem] font-bold flex-1" style={{ color: active ? "var(--paper)" : "var(--ink)" }}>{SOURCES[nid].label}</span>
                    <span className="mono text-[0.6rem]" style={{ color: active ? "var(--paper)" : "var(--ink-3)" }}>{r?.count ?? 0}</span>
                  </button>
                );
              })}
            </div>

            {sel && (
              <div className="mt-3 pt-3" style={{ borderTop: "2px solid var(--ink)" }}>
                <p className="label mb-2">{SOURCES[sel].label} · {SOURCES[sel].source}</p>
                <ClusterItems id={sel} rec={rec} />
              </div>
            )}
            {!sel && <p className="mono text-[0.62rem] mt-3" style={{ color: "var(--ink-3)" }}>SELECT A CLUSTER TO TRACE ITS NODES →</p>}
          </motion.div>

          {/* legend */}
          <div className="fixed bottom-4 left-4 z-10 mono text-[0.56rem] flex gap-3" style={{ color: "var(--ink-2)" }}>
            <span>■ CHARCOAL = RESOLVED</span><span style={{ color: "var(--stamp)" }}>■ ORANGE = ACTIVE TRACE</span>
          </div>
        </>
      )}
    </main>
  );
}

function ClusterItems({ id, rec }: { id: NodeId; rec: StoredCompile }) {
  const data = rec.results[id]?.data;
  if (!data) return <p className="mono text-[0.62rem]" style={{ color: "var(--ink-3)" }}>NO SIGNAL</p>;

  if (id === "papers") return <List items={(data as Paper[]).map((p) => ({ label: p.title, meta: `${p.year} · ${p.category}`, url: p.url }))} />;
  if (id === "code") return <List items={(data as Repo[]).map((r) => ({ label: r.full_name, meta: `★${(r.stars / 1000).toFixed(0)}k · ${r.language}`, url: r.url }))} />;
  if (id === "tutorials") return <List items={(data as Tutorial[]).map((t) => ({ label: t.title, meta: t.platform, url: t.url }))} />;
  if (id === "community") return <List items={(data as Discussion[]).map((d) => ({ label: d.title, meta: `${d.source} · ↑${d.score}`, url: d.url }))} />;
  if (id === "trends") { const t = data as TrendData; return <List items={[...t.hot_tools.map((x) => ({ label: x, meta: "tool" })), ...t.companies.map((x) => ({ label: x, meta: "YC" })), ...t.launches.map((x) => ({ label: x, meta: "PH" }))]} />; }
  const c = data as ContextData;
  return <p className="text-[0.74rem] leading-relaxed" style={{ color: "var(--ink-2)" }}>{c.summary}</p>;
}

function List({ items }: { items: { label: string; meta: string; url?: string }[] }) {
  return (
    <div className="grid gap-1.5">
      {items.map((it, i) => {
        const inner = (
          <>
            <span className="text-[0.72rem] font-semibold leading-snug line-clamp-2">{it.label}</span>
            <span className="mono text-[0.54rem] block mt-0.5" style={{ color: "var(--ink-3)" }}>{it.meta}</span>
          </>
        );
        return it.url
          ? <a key={i} href={it.url} target="_blank" rel="noreferrer" className="press brutal-sm bg-transparent p-2 block">{inner}</a>
          : <div key={i} className="brutal-sm bg-transparent p-2">{inner}</div>;
      })}
    </div>
  );
}

