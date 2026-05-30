// Cute study facts + learning-science tips. Streamed live during the compile
// (the "fact" SSE event) and pinned as sticky notes on the result page.

const STUDY_FACTS: string[] = [
  "Spaced repetition can boost long-term recall by ~200% vs cramming.",
  "Teaching a concept out loud is one of the fastest ways to find your gaps.",
  "The 'desirable difficulty' effect: harder recall now = stronger memory later.",
  "Interleaving topics beats blocking them — your brain learns to switch context.",
  "Sleep is when memories consolidate. A nap after study literally locks it in.",
  "Active recall (closing the book and testing yourself) > re-reading, every time.",
  "The Feynman technique: explain it like you're teaching a 12-year-old.",
  "Reading code is a skill. The best engineers read 10x more than they write.",
  "A messy first project teaches more than a perfect tutorial ever will.",
  "Star count ≠ quality. Check the last-commit date and open issues too.",
  "arXiv papers are free preprints — read the abstract + figures first, then decide.",
  "The 2-minute rule: if you can start in under 2 minutes, just start.",
  "Build in public. Shipping a tiny demo beats a perfect plan you never finish.",
  "Pomodoro works because urgency focuses attention — 25 on, 5 off.",
  "When stuck, rubber-duck it: explain the problem aloud to anything.",
];

const MICRO_NOTES: string[] = [
  "querying the open internet…",
  "ranking by signal, not noise…",
  "cross-checking sources…",
  "reconciling what actually works…",
  "filtering out tutorial hell…",
  "measuring how fast this field moves…",
];

export function pickFacts(n = 4): string[] {
  return shuffle(STUDY_FACTS).slice(0, n);
}

export function pickNote(): string {
  return MICRO_NOTES[Math.floor(Math.random() * MICRO_NOTES.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
