"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import Chrome from "@/components/Chrome";
import DossierView from "@/components/DossierView";
import RealityGraph, { type NodeStateMap } from "@/components/RealityGraph";
import { getCompile, type StoredCompile } from "@/lib/store";
import { NODE_ORDER } from "@/lib/types";
import { SPRING } from "@/lib/motion";

const DONE: NodeStateMap = Object.fromEntries(NODE_ORDER.map((k) => [k, "done"])) as NodeStateMap;

export default function DossierPage() {
  const { id } = useParams<{ id: string }>();
  const [rec, setRec] = useState<StoredCompile | null | undefined>(undefined);
  useEffect(() => { setRec(getCompile(id)); }, [id]);

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <Chrome />
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ opacity: 0.14 }}>
        <RealityGraph nodes={NODE_ORDER} states={DONE} phase="complete" />
      </div>

      {rec === undefined ? (
        <div className="relative z-10 pt-40 text-center mono text-sm" style={{ color: "var(--ink-3)" }}>RETRIEVING DOSSIER…</div>
      ) : rec === null ? (
        <div className="relative z-10 pt-40 mx-auto max-w-md px-5 text-center">
          <div className="brutal p-8">
            <p className="display text-[1.6rem]">NO DOSSIER ON FILE</p>
            <p className="mono text-[0.72rem] mt-2" style={{ color: "var(--ink-3)" }}>/{id}</p>
            <Link href="/" className="press btn-stamp inline-block px-6 py-3 mt-5 text-[0.86rem]">COMPILE IT ↗</Link>
          </div>
        </div>
      ) : (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING} className="relative">
          <DossierView intent={rec.intent} synthesis={rec.synthesis} metrics={rec.metrics} results={rec.results} facts={rec.facts}
            footer={
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="mono text-[0.62rem]" style={{ color: "var(--ink-3)" }}>archived {new Date(rec.createdAt).toLocaleDateString()} · {rec.metrics.confidence_label.toLowerCase()}</p>
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/graph/${rec.id}`} className="press brutal-sm bg-transparent px-5 py-3 mono text-[0.72rem]">OPEN GRAPH ↗</Link>
                  <Link href="/archives" className="press brutal-sm bg-transparent px-5 py-3 mono text-[0.72rem]">ARCHIVES</Link>
                  <Link href="/" className="press btn-ink px-6 py-3 text-[0.86rem]">NEW COMPILE</Link>
                </div>
              </div>
            } />
        </motion.section>
      )}
    </main>
  );
}
