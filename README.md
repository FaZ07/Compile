# COMPILE — _say what you want. the internet bends._

An **intention compiler**. Type one natural-language goal; COMPILE parses it, compiles a
dependency graph of web actions, fires **seven live sources in parallel**, reconciles their
truth, and returns **one executable plan** — every number cited and verifiable. Not a chatbot.
Not a dashboard. A reality compiler.

Built for the **Anakin Build-a-thon**. Powered by **Anakin Wire** (action layer) + **Groq** (parse + synthesis).

> **Why this can't just be ChatGPT:** an LLM can _advise_ you to "check Skyscanner, look on
> Reddit." It cannot fetch the live ₹6,030 fare, the 95%-rain forecast, or the real all-in
> stay price right now. COMPILE _reads the real internet_ in parallel. Execution, not intelligence.

---

## The experience

1. **Hero** — type an intention over a live 3D execution graph (Three.js).
2. **Compile** — watch the graph light up node-by-node + a live terminal log as sources resolve (SSE stream).
3. **Reveal** — a synthesized headline, a big total, and **verification cards** you can check on your phone.

Three.js graph + liquid-glass UI (Fraunces / Hanken Grotesk / JetBrains Mono), obsidian + gold + cyan.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000   (project usually runs on 3010 in dev here)
# or production:
npm run build && npm run start
```

Create **`.env.local`** (gitignored):

```env
GROQ_API_KEY=gsk_...           # required for live intent-parse + synthesis (falls back to heuristics without it)
GROQ_MODEL=llama-3.3-70b-versatile

# Anakin Wire — optional. Present = available, but stays DORMANT until you wire it in (see below).
WIRE_API_KEY=ak_...
WIRE_BASE_URL=https://anakin.io/v1/wire
```

**No keys required to demo** — 4 sources are live public APIs (no auth), 3 are realistic mocks.

---

## Architecture

```
Browser (app/page.tsx)  ── POST /api/compile (SSE) ──▶  app/api/compile/route.ts  [the orchestrator]
                                                          │
   stage: parse     → lib/intent.ts      (Groq → strict Intent)
   stage: compile   → lib/dag.ts         (Intent → DAG of nodes)
   stage: fetch     → lib/nodes/*.ts     (resolveLocation gates, then 6 in parallel)
   stage: synthesize→ lib/synthesize.ts  (Groq → headline + total + verification)
                                                          │
   every step streamed as a CompileEvent (lib/sse.ts) ──▶ 3D graph + terminal log + reveal
```

### Sources (`lib/nodes/`)
| Node | Source | Status |
|------|--------|--------|
| location | Nominatim (OpenStreetMap) | 🟢 live, no auth |
| weather  | Open-Meteo | 🟢 live, no auth |
| wiki     | Wikipedia REST | 🟢 live, no auth |
| reddit   | Reddit JSON | 🟢 live (graceful fallback on 403) |
| flights  | Skyscanner | 🟡 **mock** → Wire-ready |
| stays    | Agoda / Booking / Airbnb | 🟡 **mock** → Wire-ready (surfaces hidden-fee gap) |
| events   | BookMyShow | 🟡 **mock** → Wire-ready |

### Mock → Wire (going fully live)
The 3 mocked nodes have the **exact return shape** Wire will produce. To go live:
1. Set `WIRE_API_KEY` in `.env.local`.
2. In each `lib/nodes/{flights,stays,events}.ts`, replace the seeded-mock body with a Wire
   `POST /v1/wire/task` → poll `GET /v1/wire/jobs/{id}` call (catalogue action IDs from the Anakin dashboard).
   Nothing else changes — `analyze`/`synthesize`/UI are source-agnostic.

> **Wire is intentionally dormant** to protect the ~500 free credits. Each Wire action ≈ 1 credit.
> Keep it mock for design/rehearsal; flip to live only for the recorded demo + judging.

---

## Stack
Next.js 15 · React 19 · TypeScript · Three.js (raw, no R3F) · Tailwind · Framer Motion · SSE · Groq · Anakin Wire.

## Deploy
Vercel, zero-config. Add `GROQ_API_KEY` (+ optional `WIRE_API_KEY`) as Environment Variables.
With no keys it still runs (heuristic parse + mock sources), so the live URL works immediately.
