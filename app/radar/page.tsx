"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Chrome from "@/components/Chrome";
import { listCompiles, ecosystemScore, type StoredCompile } from "@/lib/store";
import { riseIn } from "@/lib/motion";

type Sort = "velocity" | "ecosystem" | "confidence" | "recent";
const SORTS: Sort[] = ["velocity", "ecosystem", "confidence", "recent"];

export default function RadarPage() {
  const [items, setItems] = useState<StoredCompile[]>([]);
  const [mounted, setMounted] = useState(false);
  const [sort, setSort] = useState<Sort>("velocity");
  useEffect(() => { setItems(listCompiles()); setMounted(true); }, []);

  const rows = useMemo(() => {
    const r = [...items];
    if (sort === "velocity") r.sort((a, b) => b.metrics.field_velocity - a.metrics.field_velocity);
    if (sort === "ecosystem") r.sort((a, b) => ecosystemScore(b.metrics) - ecosystemScore(a.metrics));
    if (sort === "confidence") r.sort((a, b) => b.metrics.confidence - a.metrics.confidence);
    if (sort === "recent") r.sort((a, b) => b.createdAt - a.createdAt);
    return r;
  }, [items, sort]);

  const avg = items.length ? Math.round(items.reduce((a, x) => a + x.metrics.field_velocity, 0) / items.length) : 0;
  const hottest = rows[0];

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Chrome />
      <div className="relative z-10 mx-auto max-w-5xl px-5 pt-24 pb-24">
        <motion.div variants={riseIn} initial="hidden" animate="show" className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <span className="cert">◇ STRATEGIC INTELLIGENCE ENGINE</span>
            <h1 className="display text-[clamp(2rem,5vw,3.4rem)] mt-3">RADAR</h1>
            <p className="mono text-[0.72rem] mt-1" style={{ color: "var(--ink-3)" }}>real-time ecosystem performance · GitHub × arXiv × YC velocity</p>
          </div>
          <div className="flex gap-2">
            <div className="brutal-inset p-3 text-center"><p className="display text-[2rem] leading-none">{avg}</p><p className="label mt-1" style={{ fontSize: "0.42rem" }}>avg score</p></div>
            <div className="brutal-inset p-3 text-center"><p className="display text-[2rem] leading-none">{items.length}</p><p className="label mt-1" style={{ fontSize: "0.42rem" }}>tracked</p></div>
          </div>
        </motion.div>

        {/* sort controls */}
        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <span className="label">sort</span>
          <div className="inline-flex" style={{ border: "2px solid var(--ink)" }}>
            {SORTS.map((s, i) => (
              <button key={s} onClick={() => setSort(s)} className="mono text-[0.62rem] px-3 py-1.5 press"
                style={{ borderLeft: i ? "2px solid var(--ink)" : "none", background: sort === s ? "var(--ink)" : "var(--paper)", color: sort === s ? "var(--paper)" : "var(--ink-2)" }}>{s}</button>
            ))}
          </div>
          {hottest && <span className="mono text-[0.62rem] ml-auto" style={{ color: "var(--ink-3)" }}>HOTTEST: <span style={{ color: "var(--stamp)" }}>{hottest.topic}</span></span>}
        </div>

        {/* grid */}
        {!mounted ? null : rows.length === 0 ? (
          <div className="brutal mt-6 p-10 text-center">
            <p className="display text-[1.4rem]">NO SIGNALS TRACKED</p>
            <p className="mono text-[0.72rem] mt-2" style={{ color: "var(--ink-3)" }}>compile a topic to populate the radar</p>
            <Link href="/" className="press btn-stamp inline-block px-6 py-3 mt-5 text-[0.86rem]">OPEN CONSOLE ↗</Link>
          </div>
        ) : (
          <div className="brutal mt-6 overflow-hidden">
            {/* header */}
            <div className="grid items-center gap-2 px-3 py-2 mono text-[0.54rem]" style={{ gridTemplateColumns: "1.6fr 1.4fr 0.9fr 0.8fr 0.7fr", background: "var(--ink)", color: "var(--paper)" }}>
              <span>TOPIC</span><span>COMPILE SCORE</span><span>ECO SCORE</span><span>CONF</span><span>STATE</span>
            </div>
            {rows.map((r, i) => {
              const eco = ecosystemScore(r.metrics);
              const tcol = r.metrics.trajectory === "rising" ? "var(--stamp)" : r.metrics.trajectory === "declining" ? "var(--ink-3)" : "var(--ink-2)";
              return (
                <Link key={r.id} href={`/dossier/${r.id}`} className="press grid items-center gap-2 px-3 py-2.5"
                  style={{ gridTemplateColumns: "1.6fr 1.4fr 0.9fr 0.8fr 0.7fr", borderTop: "2px solid var(--ink)", background: "var(--paper)" }}>
                  <div className="min-w-0"><p className="font-bold text-[0.82rem] truncate">{r.topic}</p><p className="mono text-[0.5rem]" style={{ color: "var(--ink-3)" }}>{r.level} · {r.goal}</p></div>
                  <div className="flex items-center gap-2"><div className="bar-track h-3.5 flex-1"><div className="h-full" style={{ width: `${r.metrics.field_velocity}%`, background: r.metrics.field_velocity >= 60 ? "var(--stamp)" : "var(--ink)" }} /></div><span className="mono text-[0.7rem] font-bold w-7">{r.metrics.field_velocity}</span></div>
                  <span className="mono text-[0.78rem] font-bold">{eco}</span>
                  <span className="mono text-[0.78rem]">{r.metrics.confidence}%</span>
                  <span className="mono text-[0.6rem] font-bold" style={{ color: tcol }}>{r.metrics.trajectory === "rising" ? "↑" : r.metrics.trajectory === "declining" ? "↓" : "→"} {r.metrics.ecosystem_state.slice(0, 4).toUpperCase()}</span>
                </Link>
              );
            })}
          </div>
        )}
        <p className="mono text-[0.56rem] mt-4" style={{ color: "var(--ink-3)" }}>Compile Score weighs commit rate × publication cadence × adoption. Ecosystem Score weighs YC placement × star spikes × launch momentum. Deterministic · recomputed per compile.</p>
      </div>
    </main>
  );
}
