"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { listCompiles } from "@/lib/store";
import { ArrowUR } from "@/components/logos";

/** Shared brutalist top bar + real route nav (active-link aware). */
export default function Chrome() {
  const path = usePathname();
  const [recent, setRecent] = useState<string | null>(null);
  useEffect(() => { setRecent(listCompiles()[0]?.id ?? null); }, [path]);

  const links: [string, string][] = [
    ["CONSOLE", "/"],
    ["COMPARE", "/compare"],
    ["DOSSIER", recent ? `/dossier/${recent}` : "/archives"],
    ["GRAPH", recent ? `/graph/${recent}` : "/archives"],
    ["RADAR", "/radar"],
    ["ARCHIVES", "/archives"],
  ];
  const isActive = (href: string) => href === "/" ? path === "/" : path.startsWith("/" + href.split("/")[1]);

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-4 lg:px-7 py-3 flex items-center justify-between" style={{ borderBottom: "2px solid var(--ink)", background: "var(--paper)" }}>
      <Link href="/" className="press btn-ink px-3 py-1.5 flex items-center gap-2">
        <span className="display text-[1rem]">COMPILE</span>
        <span className="mono text-[0.5rem]" style={{ color: "var(--stamp)" }}>v2.0</span>
      </Link>
      <nav className="hidden md:flex items-center gap-1">
        {links.map(([l, href]) => (
          <Link key={l} href={href} className="mono text-[0.6rem] px-2.5 py-1.5 tracking-widest press"
            style={{ color: isActive(href) ? "var(--paper)" : "var(--ink-3)", background: isActive(href) ? "var(--ink)" : "transparent" }}>
            {l}
          </Link>
        ))}
      </nav>
      <a href="https://anakin.io/wire" target="_blank" rel="noreferrer" className="press btn-stamp px-3 py-1.5 mono text-[0.62rem] flex items-center gap-1.5">WIRE <ArrowUR s={12} /></a>
    </header>
  );
}
