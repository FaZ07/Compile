"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Chrome from "@/components/Chrome";
import { listCompiles, deleteCompile, type StoredCompile } from "@/lib/store";
import { riseIn } from "@/lib/motion";

const TAB_TINT = ["#ffe6b8", "#d6e4ff", "#ffd6c7", "#e4f0d0"];

export default function ArchivesPage() {
  const [items, setItems] = useState<StoredCompile[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setItems(listCompiles()); setMounted(true); }, []);

  const remove = (id: string) => { deleteCompile(id); setItems(listCompiles()); };

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Chrome />
      <div className="relative z-10 mx-auto max-w-5xl px-3 sm:px-5 pt-24 sm:pt-20 pb-14">
        <motion.div variants={riseIn} initial="hidden" animate="show">
          <span className="cert">◇ FILING LIBRARY</span>
          <h1 className="display text-[clamp(2rem,5vw,3.4rem)] mt-3">ARCHIVES</h1>
          <p className="mono text-[0.72rem] mt-1" style={{ color: "var(--ink-3)" }}>{mounted ? `${items.length} compiled dossier${items.length === 1 ? "" : "s"} on file` : "loading archive…"}</p>
        </motion.div>

        {!mounted ? null : items.length === 0 ? (
          <div className="brutal mt-8 p-10 text-center">
            <p className="display text-[1.4rem]">ARCHIVE EMPTY</p>
            <p className="mono text-[0.72rem] mt-2" style={{ color: "var(--ink-3)" }}>compiled intelligence is filed here automatically</p>
            <Link href="/" className="press btn-stamp inline-block px-6 py-3 mt-5 text-[0.86rem]">COMPILE YOUR FIRST INTENT ↗</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r, i) => (
              <motion.div key={r.id} variants={riseIn} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i % 6} className="relative">
                {/* folder tab */}
                <div className="folder-tab mono text-[0.56rem]" style={{ background: TAB_TINT[i % TAB_TINT.length] }}>{r.goal.toUpperCase()} · {r.level.slice(0, 3).toUpperCase()}</div>
                <div className="brutal p-4" style={{ marginTop: -2 }}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="display text-[1.15rem] leading-tight">{r.topic}</h3>
                    <button onClick={() => remove(r.id)} className="press mono text-[0.7rem] px-1.5" style={{ border: "2px solid var(--ink)" }} title="shred">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="brutal-inset p-2"><p className="mono text-[1.3rem] font-bold leading-none">{r.metrics.field_velocity}</p><p className="label" style={{ fontSize: "0.42rem" }}>velocity</p></div>
                    <div className="brutal-inset p-2 flex flex-col justify-center"><p className="mono text-[0.62rem] font-bold" style={{ color: "var(--stamp)" }}>{r.metrics.ecosystem_state.toUpperCase()}</p><p className="mono text-[0.56rem]" style={{ color: "var(--ink-3)" }}>{r.metrics.trajectory}</p></div>
                  </div>
                  <p className="mono text-[0.54rem] mt-3" style={{ color: "var(--ink-3)" }}>FILED {new Date(r.createdAt).toLocaleDateString()} · {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="cert" style={{ fontSize: "0.5rem", transform: "rotate(-3deg)" }}>✓ COMPILED</span>
                    <div className="flex gap-1.5">
                      <Link href={`/graph/${r.id}`} className="press brutal-sm bg-transparent px-2.5 py-1.5 mono text-[0.56rem]">GRAPH</Link>
                      <Link href={`/dossier/${r.id}`} className="press btn-ink px-2.5 py-1.5 mono text-[0.56rem]">OPEN ↗</Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
