"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import CompileGraph, { type NodeStateMap } from "@/components/CompileGraph";
import BlurText from "@/components/BlurText";
import CountUp from "@/components/CountUp";
import { parseSSE } from "@/lib/sse";
import {
  NODE_REGISTRY,
  type CompileEvent,
  type Intent,
  type NodeId,
  type NodeResult,
  type Synthesis,
} from "@/lib/types";

const INR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

type Sample = { from: string; to: string; intention: string };
const SAMPLES: Sample[] = [
  { from: "Bangalore", to: "Goa", intention: "this weekend, ₹15k, quiet beach" },
  { from: "Chennai", to: "Pondicherry", intention: "next weekend, ₹10k, slow + food" },
  { from: "", to: "Manali", intention: "next month, ₹25k for 3, snow + trek" },
];

const STAGE_LABELS: Record<string, string> = {
  parse: "Parsing intent",
  compile: "Compiling execution graph",
  fetch: "Reading the internet",
  synthesize: "Reconciling reality",
  done: "Done",
};

type Phase = "idle" | "compiling" | "complete";

export default function Page() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [from, setFrom] = useState<string>(SAMPLES[0].from);
  const [to, setTo] = useState<string>(SAMPLES[0].to);
  const [party, setParty] = useState<number>(0);
  const [intention, setIntention] = useState<string>(SAMPLES[0].intention);
  const [stage, setStage] = useState<string>("parse");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [nodes, setNodes] = useState<NodeId[]>([]);
  const [states, setStates] = useState<NodeStateMap>({});
  const [results, setResults] = useState<Record<string, NodeResult>>({});
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<number | null>(null);

  const startCompile = useCallback(async () => {
    if (!intention.trim() && !to.trim()) return;
    setError(null);
    setStage("parse");
    setIntent(null);
    setNodes([]);
    setStates({});
    setResults({});
    setSynthesis(null);
    const logLine = [from && `from ${from}`, to && `to ${to}`, intention].filter(Boolean).join(" · ");
    setLog([`> ${logLine}`]);
    setPhase("compiling");
    const t0 = Date.now();
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => setElapsedMs(Date.now() - t0), 80) as unknown as number;

    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intention,
          from: from.trim() || undefined,
          to: to.trim() || undefined,
          party: party > 0 ? party : undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Server ${res.status}`);
      for await (const ev of parseSSE(res.body)) applyEvent(ev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compile failed.");
    } finally {
      if (tickRef.current) window.clearInterval(tickRef.current);
    }
  }, [intention]);

  const applyEvent = (ev: CompileEvent) => {
    switch (ev.type) {
      case "stage": {
        setStage(ev.stage);
        setLog((l) => [...l, `· ${(STAGE_LABELS[ev.stage] ?? ev.stage).toLowerCase()}…`]);
        if (ev.stage === "done") setTimeout(() => setPhase("complete"), 850);
        break;
      }
      case "intent":
        setIntent(ev.intent);
        setLog((l) => [...l, `· intent → ${ev.intent.destination} · ${ev.intent.party_size}p · ₹${(ev.intent.budget_inr ?? 0).toLocaleString("en-IN")}`]);
        break;
      case "dag":
        setNodes(ev.nodes);
        setStates(Object.fromEntries(ev.nodes.map((n) => [n, "idle"])) as NodeStateMap);
        setLog((l) => [...l, `· dag → ${ev.nodes.length} nodes`]);
        break;
      case "node:start":
        setStates((s) => ({ ...s, [ev.id]: "running" }));
        setLog((l) => [...l, `→ ${ev.id} · ${NODE_REGISTRY[ev.id].source.toLowerCase()}…`]);
        break;
      case "node:done":
        setStates((s) => ({ ...s, [ev.id]: ev.result.ok ? "done" : "error" }));
        setResults((r) => ({ ...r, [ev.id]: ev.result }));
        setLog((l) => [...l, ev.result.ok ? `✓ ${ev.id} resolved in ${ev.result.duration_ms}ms` : `✗ ${ev.id} failed`]);
        break;
      case "synthesis":
        setSynthesis(ev.synthesis);
        break;
      case "error":
        setError(ev.message);
        break;
    }
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("auto") as Provider | null;
    if (p && ["goa", "manali", "pondicherry"].includes(p as string)) {
      const found = SAMPLES.find((s) => s.to.toLowerCase().includes(String(p).toLowerCase()));
      if (found) { setFrom(found.from); setTo(found.to); setIntention(found.intention); }
      setTimeout(() => startCompile(), 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  type Provider = string;

  const reset = () => { setPhase("idle"); setError(null); };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black">
      <Nav onHome={reset} />
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <Idle key="idle"
            from={from} setFrom={setFrom}
            to={to} setTo={setTo}
            party={party} setParty={setParty}
            intention={intention} setIntention={setIntention}
            onCompile={startCompile} error={error}
          />
        )}
        {phase === "compiling" && (
          <Compiling key="comp" intention={intention} intent={intent} nodes={nodes} states={states} stage={stage} log={log} elapsedMs={elapsedMs} error={error} />
        )}
        {phase === "complete" && synthesis && intent && (
          <Complete key="done" intention={intention} intent={intent} synthesis={synthesis} results={results} onReset={reset} />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ============================ NAV ============================ */
function Nav({ onHome }: { onHome: () => void }) {
  const links = ["Reconcile", "Sources", "Verify"];
  return (
    <header className="fixed top-4 inset-x-0 z-50 px-6 lg:px-10 flex items-center justify-between">
      <button onClick={onHome} className="liquid-glass rounded-full flex items-center" style={{ height: 46, paddingLeft: 6, paddingRight: 18 }}>
        <span className="grid place-items-center rounded-full" style={{ width: 34, height: 34 }}>
          <span className="serif text-signal text-2xl lowercase leading-none">c</span>
        </span>
        <span className="font-sans font-medium tracking-tight text-platinum text-[0.95rem]">compile</span>
      </button>

      <div className="hidden md:flex liquid-glass rounded-full px-1.5 py-1.5 items-center gap-0.5">
        {links.map((l) => (
          <span key={l} className="px-3.5 py-2 text-[0.82rem] font-medium text-platinum/80 font-sans cursor-default">{l}</span>
        ))}
      </div>

      <a href="https://anakin.io/wire" target="_blank" rel="noreferrer" className="bg-white text-black rounded-full flex items-center gap-1.5 px-4 font-medium text-[0.82rem] whitespace-nowrap" style={{ height: 46 }}>
        Anakin Wire <ArrowUpRight className="h-4 w-4" />
      </a>
    </header>
  );
}

/* ============================ IDLE ============================ */
function Idle({
  from, setFrom, to, setTo, party, setParty, intention, setIntention, onCompile, error,
}: {
  from: string; setFrom: (s: string) => void;
  to: string; setTo: (s: string) => void;
  party: number; setParty: (n: number) => void;
  intention: string; setIntention: (s: string) => void;
  onCompile: () => void; error: string | null;
}) {
  const allIdle = useMemo(() => Object.fromEntries(Object.keys(NODE_REGISTRY).map((k) => [k, "idle"])) as NodeStateMap, []);
  const allNodeIds = useMemo(() => Object.keys(NODE_REGISTRY) as NodeId[], []);

  return (
    <motion.section initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative min-h-screen w-full">
      {/* live 3D graph as the cinematic background */}
      <div className="fixed inset-0 z-0">
        <CompileGraph nodes={allNodeIds} states={allIdle} phase="idle" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(0,0,0,0.82)_78%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-black to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-28 text-center">
        {/* badge */}
        <div className="rise" style={{ animationDelay: "0.1s" }}>
          <div className="liquid-glass rounded-full inline-flex items-center gap-2 pr-3.5">
            <span className="bg-signal text-black px-2.5 py-1 text-[0.62rem] font-semibold rounded-full tracking-wide">LIVE</span>
            <span className="text-[0.8rem] text-platinum/85 font-sans">Eight sources reconciled in under 10 seconds</span>
          </div>
        </div>

        {/* headline */}
        <div className="mt-5">
          <BlurText text="Say what you want." className="serif text-platinum leading-[0.82] text-[clamp(2.6rem,7.5vw,5.4rem)]" delay={0.45} style={{ letterSpacing: "-1px" }} />
          <BlurText text="The internet bends." className="serif text-signal leading-[0.82] text-[clamp(2.6rem,7.5vw,5.4rem)]" delay={0.9} style={{ letterSpacing: "-1px" }} />
        </div>

        <p className="rise mt-5 max-w-xl font-sans font-light text-[0.95rem] leading-relaxed text-platinum/70" style={{ animationDelay: "0.85s" }}>
          Type one intention. Compile fires seven live sources in parallel, reconciles their truth, and returns one executable plan — not a chatbot, not a dashboard. A reality compiler.
        </p>

        {/* command card */}
        <div className="rise mt-8 w-full max-w-2xl" style={{ animationDelay: "1s" }}>
          <div className="card-strong rounded-[1.6rem] p-6 text-left">
            {/* header row */}
            <div className="flex items-center gap-2.5">
              <span className="num text-signal text-sm">&gt;</span>
              <span className="eyebrow text-[0.52rem]">your intention</span>
              <span className="ml-auto flex items-center gap-2 num text-[0.58rem] text-ash">
                <span className="h-1.5 w-1.5 rounded-full bg-pulse animate-pulse" /> READY
              </span>
            </div>

            {/* from → to + party row */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-1 min-w-[120px] liquid-glass rounded-xl px-3 py-2">
                <span className="eyebrow text-[0.48rem] text-ash shrink-0">FROM</span>
                <input
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="Bangalore"
                  className="flex-1 min-w-0 bg-transparent font-sans text-[0.88rem] text-platinum placeholder-platinum/30 focus:outline-none"
                />
              </div>
              <span className="text-platinum/30 text-lg shrink-0">→</span>
              <div className="flex items-center gap-1.5 flex-1 min-w-[120px] liquid-glass rounded-xl px-3 py-2">
                <span className="eyebrow text-[0.48rem] text-ash shrink-0">TO</span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="Goa, Manali…"
                  autoFocus
                  className="flex-1 min-w-0 bg-transparent font-sans text-[0.88rem] text-platinum placeholder-platinum/30 focus:outline-none"
                />
              </div>
              {/* party stepper */}
              <div className="flex items-center gap-0 liquid-glass rounded-xl overflow-hidden shrink-0">
                <button onClick={() => setParty(Math.max(0, party - 1))}
                  className="px-3 py-2 text-platinum/60 hover:text-platinum transition-colors font-sans text-sm">−</button>
                <div className="px-2 py-2 text-center min-w-[2.5rem]">
                  {party === 0
                    ? <span className="eyebrow text-[0.48rem] text-ash leading-none">PAX</span>
                    : <span className="font-sans text-[0.88rem] text-platinum">{party}</span>}
                </div>
                <button onClick={() => setParty(Math.min(12, party + 1))}
                  className="px-3 py-2 text-platinum/60 hover:text-signal transition-colors font-sans text-sm">+</button>
              </div>
            </div>

            {/* intent textarea — vibe / budget / dates */}
            <textarea
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onCompile(); }}
              rows={2}
              placeholder="this weekend, ₹15k, quiet beach…"
              className="mt-4 block w-full resize-none border-0 bg-transparent serif text-[clamp(1.2rem,2.2vw,1.7rem)] leading-tight text-platinum placeholder-platinum/25 focus:outline-none"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {SAMPLES.map((s) => (
                  <button key={s.to} onClick={() => { setFrom(s.from); setTo(s.to); setIntention(s.intention); }}
                    className={`liquid-glass rounded-full px-3 py-1.5 text-[0.72rem] font-sans transition-colors ${to === s.to && intention === s.intention ? "text-signal" : "text-platinum/75 hover:text-platinum"}`}>
                    {s.from ? `${s.from} → ${s.to}` : s.to}
                  </button>
                ))}
              </div>
              <button onClick={onCompile}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-signal px-6 py-2.5 font-medium tracking-wide text-[#1a1205] transition-transform hover:scale-[1.02] active:scale-95">
                <span className="relative z-10">COMPILE</span>
                <ArrowUpRight className="relative z-10 h-4 w-4" />
                <span className="absolute inset-0 -translate-x-full bg-white/40 transition-transform duration-500 group-hover:translate-x-0" />
              </button>
            </div>
          </div>

          {/* source chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
            {Object.values(NODE_REGISTRY).map((n) => (
              <span key={n.id} className="liquid-glass rounded-full px-2.5 py-1 text-[0.62rem] font-sans flex items-center gap-1.5">
                <span className={n.real ? "text-pulse" : "text-signal"}>{n.real ? "●" : "○"}</span>
                <span className="text-platinum/70">{n.source.replace(" *", "")}</span>
              </span>
            ))}
          </div>
          <p className="num mt-4 text-center text-[0.56rem] tracking-[0.25em] text-ash">
            ⌘/CTRL+ENTER · <span className="text-pulse">●</span> LIVE API · <span className="text-signal">○</span> WIRE-READY
          </p>

          {error && <p className="mt-4 text-center text-sm text-ember">{error}</p>}
        </div>

        {/* scroll cue */}
        <div className="rise absolute bottom-6 left-1/2 -translate-x-1/2 eyebrow text-[0.5rem]" style={{ animationDelay: "1.6s" }}>
          ↓ how it compiles
        </div>
      </div>

      {/* ───── content sections (scroll depth) ───── */}
      <LandingSections />
    </motion.section>
  );
}

/* consistent section shell — one spacing system for every content block */
function Section({ kicker, title, accent, sub, children }: {
  kicker: string; title: string; accent?: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <section className="relative z-10 border-t border-[var(--line)] bg-[#070709]">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 py-28 lg:py-36">
        <p className="eyebrow">{kicker}</p>
        <h2 className="serif text-platinum leading-[0.95] text-[clamp(2.2rem,5.5vw,4rem)] mt-5" style={{ letterSpacing: "-1px" }}>
          {title} {accent && <span className="text-signal">{accent}</span>}
        </h2>
        {sub && <p className="mt-6 max-w-xl font-sans font-light text-[1rem] leading-relaxed text-platinum/60">{sub}</p>}
        <div className="mt-16">{children}</div>
      </div>
    </section>
  );
}

function LandingSections() {
  const engine = [
    { Icon: IconGraph, tags: ["Semantic parse", "Strict schema"], title: "Intent becomes a graph", body: "Your sentence is parsed into a typed plan — budget, dates, vibe isolated — then compiled into a dependency graph of web actions." },
    { Icon: IconParallel, tags: ["7 sources", "Fired at once"], title: "Reality, in parallel", body: "Seven live systems resolve simultaneously. The eleven tabs you'd open by hand, collapsed into a single request." },
    { Icon: IconVerify, tags: ["Cross-checked", "Cited"], title: "Reconciled truth", body: "One answer, every number cited to its source. Open it on your phone and it matches — live. An LLM guesses; COMPILE reads." },
  ];

  const sources = [
    { label: "Coordinates", source: "Nominatim", live: true, gives: "Resolves any place to exact coordinates." },
    { label: "Weather", source: "Open-Meteo", live: true, gives: "Seven-day forecast — rain, temperature, conditions." },
    { label: "Context", source: "Wikipedia", live: true, gives: "Grounding context on the destination." },
    { label: "Ground truth", source: "Reddit", live: true, gives: "Unfiltered takes from people who actually went." },
    { label: "Flights", source: "Skyscanner", live: false, gives: "Live fares compared across airlines." },
    { label: "Buses", source: "Redbus", live: false, gives: "Bus fares and operators — often cheaper than flights for under 10h routes." },
    { label: "Stays", source: "Agoda + Airbnb", live: false, gives: "Rooms at the true all-in price, fees included." },
    { label: "Events", source: "BookMyShow", live: false, gives: "What's actually on those nights." },
  ];

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <>
      {/* §01 — the problem */}
      <Section kicker="// the problem" title="Eleven tabs." accent="One sentence."
        sub="Modern internet tasks aren't hard because of thinking. They're hard because reality is scattered across a dozen logins that refuse to talk to each other.">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card rounded-[1.4rem] p-7">
            <p className="eyebrow text-ember">the manual way</p>
            <ul className="mt-6 space-y-3 font-sans text-[0.92rem] text-platinum/55">
              <li>Open Skyscanner. Compare fares by hand.</li>
              <li>Switch to Agoda, then Booking, then Airbnb.</li>
              <li>Dig through Reddit for the real vibe.</li>
              <li>Check weather. Check what's on.</li>
              <li>Reconcile it all into a budget yourself.</li>
            </ul>
            <div className="num mt-8 text-[0.72rem] tracking-widest text-ember/80">≈ 40 MIN · 11 TABS · 6 LOGINS</div>
          </div>
          <div className="card rounded-[1.4rem] p-7 flex flex-col">
            <p className="eyebrow text-signal">the compile way</p>
            <p className="mt-6 serif text-[clamp(1.4rem,2.4vw,1.9rem)] leading-snug text-platinum">
              &ldquo;Goa this weekend, ₹15k, 2 people, quiet beach.&rdquo;
            </p>
            <div className="flex-1" />
            <div className="num mt-8 text-[0.72rem] tracking-widest text-signal">&rarr; ONE PLAN · &lt;10s · 0 TABS</div>
          </div>
        </div>
      </Section>

      {/* §02 — how it compiles */}
      <Section kicker="// how it compiles" title="Not a chatbot." accent="A compiler.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[{ n: "8", l: "live sources" }, { n: "<10s", l: "to reconcile" }, { n: "4", l: "real-time APIs" }, { n: "0", l: "hallucinated facts" }].map((s) => (
            <div key={s.l} className="card rounded-[1.1rem] p-6">
              <div className="serif text-signal text-[2.6rem] leading-none">{s.n}</div>
              <div className="num text-[0.58rem] tracking-widest text-ash mt-3 uppercase">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {engine.map((c) => (
            <div key={c.title} className="card rounded-[1.4rem] p-7 min-h-[300px] flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="liquid-glass rounded-[0.8rem] relative grid place-items-center" style={{ width: 46, height: 46 }}>
                  <c.Icon />
                </div>
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
                  {c.tags.map((t) => (
                    <span key={t} className="liquid-glass rounded-full px-2.5 py-1 text-[0.6rem] text-platinum/75 font-sans whitespace-nowrap">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex-1" />
              <div>
                <h3 className="serif text-platinum text-[1.7rem] leading-none">{c.title}</h3>
                <p className="mt-3 font-sans font-light text-[0.88rem] leading-relaxed text-platinum/65 max-w-[34ch]">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* §03 — the sources */}
      <Section kicker="// the sources" title="Eight systems." accent="One truth."
        sub="Each one fires in parallel and returns clean structured data. Four are live public APIs today; four are wire-ready — one key flips them to live.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => (
            <div key={s.source} className="card rounded-[1.2rem] p-6">
              <div className="flex items-center justify-between">
                <span className="serif text-platinum text-[1.4rem] leading-none">{s.label}</span>
                <span className={`num text-[0.55rem] tracking-widest rounded-full px-2 py-1 ${s.live ? "text-pulse" : "text-signal"}`} style={{ background: s.live ? "var(--pulse-dim)" : "var(--signal-dim)" }}>
                  {s.live ? "LIVE" : "WIRE"}
                </span>
              </div>
              <div className="num text-[0.62rem] tracking-wider text-ash mt-2">{s.source.toUpperCase()}</div>
              <p className="mt-4 font-sans font-light text-[0.86rem] leading-relaxed text-platinum/60">{s.gives}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* §04 — closing CTA */}
      <section className="relative z-10 border-t border-[var(--line)] bg-[#070709]">
        <div className="mx-auto max-w-4xl px-6 py-32 lg:py-44 text-center">
          <p className="eyebrow">// the internet was built for websites</p>
          <h2 className="serif text-platinum leading-[0.92] text-[clamp(2.6rem,7vw,5.2rem)] mt-6" style={{ letterSpacing: "-1px" }}>
            We compile it <br /><span className="text-signal">for intentions.</span>
          </h2>
          <button onClick={scrollTop}
            className="group mt-12 inline-flex items-center gap-2.5 rounded-full bg-signal px-8 py-3.5 font-medium tracking-wide text-[#1a1205] transition-transform hover:scale-[1.02] active:scale-95">
            <span>Say it once</span><ArrowUpRight className="h-4 w-4" />
          </button>
          <p className="num mt-16 text-[0.6rem] tracking-[0.3em] text-ash">EXECUTION LAYER · ANAKIN WIRE · GROQ</p>
        </div>
      </section>
    </>
  );
}

/* engine icons */
function IconGraph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="5" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="12" r="2" />
      <line x1="7" y1="6" x2="17" y2="11" /><line x1="7" y1="18" x2="17" y2="13" />
    </svg>
  );
}
function IconParallel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="1.4" fill="#ffb84d" /><circle cx="15" cy="12" r="1.4" fill="#ffb84d" /><circle cx="7" cy="18" r="1.4" fill="#ffb84d" />
    </svg>
  );
}
function IconVerify() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#ffb84d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 2.5l7.5 3v5.5c0 4.4-3.2 8-7.5 9-4.3-1-7.5-4.6-7.5-9V5.5z" />
      <polyline points="9 12 11 14 15.5 9.5" />
    </svg>
  );
}

/* ============================ COMPILING ============================ */
function Compiling({
  intention, intent, nodes, states, stage, log, elapsedMs, error,
}: {
  intention: string; intent: Intent | null; nodes: NodeId[]; states: NodeStateMap;
  stage: string; log: string[]; elapsedMs: number; error: string | null;
}) {
  const total = nodes.length || 7;
  const doneCount = useMemo(() => nodes.filter((n) => states[n] === "done" || states[n] === "error").length, [nodes, states]);
  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [log]);

  return (
    <motion.section initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative min-h-screen w-full">
      <div className="fixed inset-0 z-0">
        <CompileGraph nodes={nodes.length ? nodes : (Object.keys(NODE_REGISTRY) as NodeId[])} states={states} phase="compiling" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_85%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 pt-24 grid gap-6 md:grid-cols-[1fr_auto_1fr]">
        {/* intent panel */}
        <div className="liquid-glass rounded-[1.25rem] p-5 self-start max-w-md">
          <p className="eyebrow text-[0.52rem]">Intent</p>
          <p className="mt-2 serif text-[1.2rem] leading-snug text-platinum/90">{intention}</p>
          {intent && (
            <div className="num mt-4 grid grid-cols-2 gap-x-5 gap-y-1.5 text-[0.66rem] text-ash">
              <Field k="dest" v={intent.destination} />
              <Field k="budget" v={`₹${(intent.budget_inr ?? 0).toLocaleString("en-IN")}`} />
              <Field k="party" v={`${intent.party_size}`} />
              <Field k="dates" v={intent.date_window} />
            </div>
          )}
        </div>

        <div />

        {/* stage panel */}
        <div className="liquid-glass rounded-[1.25rem] p-5 self-start md:justify-self-end md:text-right min-w-[210px]">
          <p className="eyebrow text-[0.52rem] text-signal">{STAGE_LABELS[stage] ?? stage}</p>
          <p className="serif mt-2 text-[2.4rem] leading-none text-platinum">
            <span className="text-signal">{doneCount}</span><span className="text-platinum/35"> / {total}</span>
          </p>
          <p className="num mt-1 text-[0.62rem] text-ash">{(elapsedMs / 1000).toFixed(2)}s elapsed</p>
        </div>
      </div>

      {/* terminal log */}
      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 pb-6">
          <div className="liquid-glass-strong rounded-[1.25rem] p-4">
            <div className="num text-[0.7rem] leading-relaxed text-platinum/75 max-h-32 overflow-y-auto pr-2">
              {log.map((l, i) => (
                <div key={i} className={l.startsWith("✓") ? "text-signal" : l.startsWith("✗") ? "text-ember" : l.startsWith("→") ? "text-pulse" : "text-platinum/60"}>{l}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 liquid-glass rounded-full px-4 py-2 text-xs text-ember">{error}</div>}
    </motion.section>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-platinum/30 uppercase tracking-wider">{k}</span>
      <span className="text-platinum/90 truncate">{v}</span>
    </div>
  );
}

/* ============================ COMPLETE ============================ */
function Complete({
  intention, intent, synthesis, results, onReset,
}: {
  intention: string; intent: Intent; synthesis: Synthesis;
  results: Record<string, NodeResult>; onReset: () => void;
}) {
  const realCount = Object.values(results).filter((r) => r.ok && NODE_REGISTRY[r.id].real).length;

  return (
    <motion.section initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative">
      <div className="fixed inset-0 z-0 opacity-45 pointer-events-none">
        <CompileGraph nodes={Object.keys(NODE_REGISTRY) as NodeId[]} states={Object.fromEntries(Object.keys(NODE_REGISTRY).map((k) => [k, results[k]?.ok ? "done" : "error"])) as NodeStateMap} phase="complete" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,rgba(0,0,0,0.8)_80%)]" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-28 pb-28">
        {/* meta */}
        <div className="flex items-center justify-between">
          <div className="liquid-glass rounded-full px-3 py-1.5 eyebrow text-[0.52rem] flex items-center gap-2">
            <span className="text-signal">{intent.destination}</span>
            <span className="text-platinum/25">/</span><span>{intent.date_window}</span>
            <span className="text-platinum/25">/</span><span>{intent.party_size} pax</span>
          </div>
          <span className="liquid-glass-signal liquid-glass rounded-full px-3 py-1.5 num text-[0.56rem] tracking-widest text-signal">● {realCount} LIVE SOURCES RECONCILED</span>
        </div>

        {/* synthesis headline */}
        <div className="mt-12">
          <BlurText text={synthesis.headline} justify="start" className="serif text-platinum leading-[1.0] text-[clamp(2.2rem,5.2vw,4rem)]" stagger={70} style={{ letterSpacing: "-0.5px" }} />
        </div>

        {/* total + summary */}
        <div className="mt-12 grid gap-8 md:grid-cols-[auto_1fr] items-end">
          <div>
            <p className="eyebrow text-[0.52rem]">Compiled total</p>
            <p className="serif text-signal leading-[0.8] text-[clamp(4rem,11vw,8rem)] mt-2">
              <CountUp to={synthesis.total_inr} prefix="₹" duration={1.9} className="serif" />
            </p>
          </div>
          <p className="font-sans font-light text-[1.05rem] leading-relaxed text-platinum/80 max-w-lg">{synthesis.summary}</p>
        </div>

        {/* verification */}
        <div className="mt-16">
          <p className="eyebrow text-[0.52rem]">Verify on the real internet</p>
          <p className="mt-2 font-sans font-light text-sm text-platinum/60 max-w-md">Every claim is reconciled from live data we just pulled. Open the source on your phone — the numbers match in real time.</p>
          <div className="mt-7 grid gap-3">
            {synthesis.verification.map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                className="liquid-glass rounded-[1rem] px-5 py-4 flex items-start gap-4">
                <span className="num text-[0.58rem] tracking-widest text-signal mt-1 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex-1">
                  <div className="num text-[0.6rem] tracking-widest text-ash">{v.source.toUpperCase()}</div>
                  <div className="text-platinum mt-1 font-sans">{v.claim}</div>
                </div>
                {v.link && <a href={v.link} target="_blank" rel="noreferrer" className="text-xs text-ash hover:text-signal whitespace-nowrap mt-1.5">verify ↗</a>}
              </motion.div>
            ))}
          </div>
        </div>

        {/* source dump as liquid-glass cards */}
        <div className="mt-16">
          <p className="eyebrow text-[0.52rem]">Source dump</p>
          <div className="mt-7 grid gap-3 md:grid-cols-2">
            {Object.values(results).map((r) => (
              <div key={r.id} className={`liquid-glass rounded-[1rem] p-4 ${r.ok ? "" : "opacity-60"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${r.ok ? "bg-signal" : "bg-ember"}`} />
                    <span className="font-sans font-medium text-platinum">{NODE_REGISTRY[r.id].label}</span>
                    <span className="num text-[0.58rem] text-ash tracking-wider">{NODE_REGISTRY[r.id].source}</span>
                  </div>
                  <span className="num text-[0.62rem] text-ash">{r.duration_ms}ms</span>
                </div>
                <div className="num mt-3 text-[0.7rem] leading-snug text-platinum/60 max-h-24 overflow-hidden">{r.ok ? renderPreview(r) : `error: ${r.error}`}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 flex items-center justify-between gap-4 flex-wrap">
          <p className="num max-w-md text-xs text-ash">&gt; {intention}</p>
          <button onClick={onReset} className="liquid-glass rounded-full px-7 py-3.5 text-sm text-platinum hover:text-signal transition-colors">Compile another</button>
        </div>
      </div>
    </motion.section>
  );
}

function renderPreview(r: NodeResult): string {
  if (!r.data) return "—";
  if (r.id === "location") { const d = r.data as { display_name: string; lat: number; lon: number }; return `${d.display_name} · ${d.lat.toFixed(3)}, ${d.lon.toFixed(3)}`; }
  if (r.id === "weather") { const d = r.data as { summary: string; rain_probability_pct: number }; return `${d.summary} · rain ${d.rain_probability_pct}%`; }
  if (r.id === "wiki") { const d = r.data as { title: string; summary: string }; return `${d.title} — ${d.summary.slice(0, 130)}…`; }
  if (r.id === "reddit") { const d = r.data as { posts: { title: string }[]; sentiment: string }; return `sentiment: ${d.sentiment} · top: "${d.posts[0]?.title?.slice(0, 80) ?? "—"}"`; }
  if (r.id === "flights") { const d = r.data as { airline: string; price_inr: number; route: string }[]; return d.slice(0, 3).map((f) => `${f.airline} ${f.route} ₹${f.price_inr}`).join(" · "); }
  if (r.id === "buses") { const d = r.data as { operator: string; type: string; price_inr: number; duration_hours: number }[]; return d.slice(0, 3).map((b) => `${b.operator} (${b.type}) ₹${b.price_inr} · ${b.duration_hours}h`).join(" · "); }
  if (r.id === "stays") { const d = r.data as { platform: string; name: string; all_in_nightly_inr: number; nightly_inr: number }[]; const s = d[0]; return s ? `cheapest: ${s.name} (${s.platform}) — shown ₹${s.nightly_inr}, all-in ₹${s.all_in_nightly_inr}` : "—"; }
  if (r.id === "events") { const d = r.data as { name: string; price_inr: number | "free" }[]; return d.slice(0, 3).map((e) => `${e.name} (${e.price_inr === "free" ? "free" : "₹" + e.price_inr})`).join(" · "); }
  return JSON.stringify(r.data).slice(0, 130);
}

/* ============================ icons ============================ */
function ArrowUpRight({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}
