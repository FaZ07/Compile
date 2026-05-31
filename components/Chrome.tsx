"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { listCompiles } from "@/lib/store";
import { ArrowUR } from "@/components/logos";

/** Shared brutalist top bar + route nav.
 *  Desktop: single row with links in centre.
 *  Mobile:  logo/WIRE row + scrollable nav strip below. */
export default function Chrome() {
  const path = usePathname();
  const [recent, setRecent] = useState<string | null>(null);
  useEffect(() => { setRecent(listCompiles()[0]?.id ?? null); }, [path]);

  const links: [string, string][] = [
    ["CONSOLE",  "/"],
    ["COMPARE",  "/compare"],
    ["DOSSIER",  recent ? `/dossier/${recent}` : "/archives"],
    ["GRAPH",    recent ? `/graph/${recent}`   : "/archives"],
    ["RADAR",    "/radar"],
    ["ARCHIVES", "/archives"],
  ];
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith("/" + href.split("/")[1]);

  return (
    <header className="fixed top-0 inset-x-0 z-50" style={{ background: "var(--paper)", borderBottom: "2px solid var(--ink)" }}>
      {/* ── top bar (all sizes) ── */}
      <div className="px-3 sm:px-4 lg:px-7 py-3 flex items-center justify-between">
        <Link href="/" className="press btn-ink px-3 py-1.5 flex items-center gap-2">
          <span className="display text-[1rem]">COMPILE</span>
        </Link>

        {/* desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(([l, href]) => (
            <Link key={l} href={href}
              className="mono text-[0.6rem] px-2.5 py-1.5 tracking-widest press"
              style={{ color: isActive(href) ? "var(--paper)" : "var(--ink-3)", background: isActive(href) ? "var(--ink)" : "transparent" }}>
              {l}
            </Link>
          ))}
        </nav>

        <a href="https://anakin.io/wire" target="_blank" rel="noreferrer"
          className="press btn-stamp px-3 py-1.5 mono text-[0.62rem] flex items-center gap-1.5">
          WIRE <ArrowUR s={12} />
        </a>
      </div>

      {/* ── mobile nav strip (scrollable row) ── */}
      <div className="md:hidden flex overflow-x-auto" style={{ borderTop: "1px solid var(--ink-3)" }}>
        {links.map(([l, href], i) => (
          <Link key={l} href={href}
            className="flex-shrink-0 mono text-[0.58rem] px-3.5 py-2 tracking-widest press"
            style={{
              borderRight: i < links.length - 1 ? "1px solid var(--ink-3)" : "none",
              color: isActive(href) ? "var(--paper)" : "var(--ink-3)",
              background: isActive(href) ? "var(--ink)" : "var(--paper)",
              whiteSpace: "nowrap",
            }}>
            {l}
          </Link>
        ))}
      </div>
    </header>
  );
}
