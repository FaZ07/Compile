# ◇ COMPILE — the reality compiler for learning

> **Say what you want to learn. The internet compiles it.**
> Not a chatbot. Not a search engine. A *compiler* — intention in, one executable knowledge plan out, with real-time comparative metrics.

COMPILE takes a single learning goal, fires **6 sources across the live internet in parallel**, measures how fast the field is moving, and reconciles everything into a ranked, executable plan — visualised as a cinematic 3D reasoning graph that lights up node-by-node as reality resolves.

```
"Teach me RAG systems — I want to build a startup."
        ↓  ~10 seconds, fully autonomous
 Field Velocity 76/100 ▲ rising · 21 live artifacts
 → 4-phase roadmap · ranked repos · frontier papers · community truth · trend intel
```

---

## Why it's different

| Most projects | COMPILE |
|---|---|
| Chatbot: text → text | Compiler: intent → typed plan → parallel execution → reconciled artifact |
| One model guessing | 6 live sources, cross-checked |
| A list of links | **Ranked & compared** by stars, recency, citations, upvotes |
| "Here's some info" | **Field Velocity** — a measured score of how fast the field moves |

It demonstrates Wire's thesis literally: **the internet is your database.**

## The pipeline

```
POST /api/compile  (Server-Sent Events)
  parse      → Groq → typed Intent           (heuristic fallback — never breaks)
  compile    → DAG  → emit node list
  fetch      → all 6 SourceAdapters in parallel (allSettled)
               each streams node:start → node:done (+ real timing + count)
  metrics    → compute Field Velocity + trajectory
  synthesize → Groq → roadmap + projects + insights   (template fallback)
  done
```

Every source is a uniform `SourceAdapter` — **adding a source is one file.** One source failing never kills the compile.

## The 6 sources — 5 genuinely live, no API key

| Source | Provider | Status | Signal it contributes |
|---|---|---|---|
| Context   | Wikipedia REST     | 🟢 LIVE | grounding summary |
| Research  | arXiv Atom API     | 🟢 LIVE | latest papers, recency |
| Code      | GitHub Search      | 🟢 LIVE | repos ranked by stars + activity |
| Tutorials | DEV.to API         | 🟢 LIVE | articles, reactions (+ YouTube wire-ready) |
| Community | Hacker News + Reddit | 🟢 LIVE | discussions, upvotes, real opinions |
| Trends    | YC · Product Hunt · TechCrunch | 🟠 WIRE-READY | trajectory, hot tools, funded companies |

## Field Velocity — the comparative brain

A deterministic 0–100 score of how fast a field is moving, blended from:
`trajectory signal · research recency · code gravity (log stars) · community heat`.
It's the metric that turns COMPILE from a *reader* into an *analyst*.

## Tech

Next.js 15 · React 19 · TypeScript · **raw Three.js** (FogExp2 abyss · `UnrealBloomPass` glow · LERP inertial camera) · Tailwind · Framer Motion · SSE · **Groq** (llama-3.3-70b) for parse + synthesis. Zero paid infra — bloom ships inside `three`.

## Run it

```bash
npm install
cp .env.example .env.local   # add your GROQ_API_KEY (optional — falls back to heuristics)
npm run dev                  # → http://localhost:3000
```

## Design

Modern Urban Noir & Liquid Glass — obsidian `#050505`, cyan `#00FFFF` (active logic), gold `#D4AF37` (resolved success). Hanken Grotesk + JetBrains Mono. Plus study charm: sticky-note facts, notebook-ruled roadmap cards, brand logos, hand-drawn doodles. A place you'd want to sit and learn.

---

*Built for the Anakin Build-a-thon. Powered by Anakin Wire + Groq.*
