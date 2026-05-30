/* Brand source logos + study doodles. Pure SVG, no deps. */

export function GitHubLogo({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.34.85.01 1.7.12 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z"/></svg>;
}
export function ArxivLogo() {
  return <span className="inline-flex items-center justify-center rounded px-1 py-0.5 text-[0.6rem] font-bold text-white" style={{ background: "#b31b1b" }}>arXiv</span>;
}
export function RedditLogo({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.74c.69 0 1.25.56 1.25 1.25a1.25 1.25 0 0 1-2.5.06l-2.6-.55-.8 3.75c1.83.07 3.48.63 4.68 1.49.3-.31.73-.49 1.2-.49.97 0 1.76.79 1.76 1.76 0 .72-.43 1.33-1.01 1.61.04.17.05.35.05.53 0 2.69-3.13 4.87-7 4.87s-7-2.18-7-4.87c0-.18.01-.36.04-.53A1.75 1.75 0 0 1 4.03 12c0-.97.79-1.76 1.76-1.76.46 0 .89.18 1.2.49 1.21-.86 2.88-1.42 4.74-1.49l.9-4.18a.34.34 0 0 1 .14-.2.35.35 0 0 1 .24-.04l2.91.62a1.21 1.21 0 0 1 1.09-.7zM9.25 12a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm5.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm-5.47 3.99a.33.33 0 0 0-.23.09.33.33 0 0 0 0 .47c.84.84 2.49.91 2.96.91.48 0 2.11-.06 2.96-.91a.36.36 0 0 0 .03-.47.33.33 0 0 0-.47 0c-.55.53-1.69.73-2.52.73-.83 0-1.97-.2-2.52-.73a.33.33 0 0 0-.22-.09z"/></svg>;
}
export function YCLogo() {
  return <span className="inline-flex items-center justify-center rounded-sm text-[0.55rem] font-bold text-white" style={{ width: 16, height: 16, background: "#FF6600" }}>Y</span>;
}
export function HNLogo() {
  return <span className="inline-flex items-center justify-center rounded-sm text-[0.5rem] font-bold text-white" style={{ width: 16, height: 16, background: "#FF6600" }}>HN</span>;
}
export function DevLogo() {
  return <span className="inline-flex items-center justify-center rounded-[3px] text-[0.46rem] font-bold text-black bg-white" style={{ width: 22, height: 16 }}>DEV</span>;
}
export function YouTubeLogo({ s = 16 }: { s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="#FF0000"><path d="M23.5 6.2a3 3 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3 3 0 0 0 .5 6.2C0 8.07 0 12 0 12s0 3.93.5 5.8a3 3 0 0 0 2.12 2.14C4.5 20.45 12 20.45 12 20.45s7.5 0 9.38-.51A3 3 0 0 0 23.5 17.8C24 15.93 24 12 24 12s0-3.93-.5-5.8zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>;
}
export function WikiLogo() {
  return <span className="inline-flex items-center justify-center rounded-full text-[0.6rem] font-bold text-white" style={{ width: 16, height: 16, background: "#3366cc" }}>W</span>;
}
export function PHLogo() {
  return <span className="inline-flex items-center justify-center rounded-full text-[0.5rem] font-bold text-white" style={{ width: 16, height: 16, background: "#DA552F" }}>P</span>;
}

/** Maps a source/platform string to its logo. */
export function SourceLogo({ source }: { source: string }) {
  const s = source.toLowerCase();
  if (s.includes("github"))    return <GitHubLogo />;
  if (s.includes("arxiv"))     return <ArxivLogo />;
  if (s.includes("reddit"))    return <RedditLogo />;
  if (s.includes("youtube"))   return <YouTubeLogo />;
  if (s.includes("dev"))       return <DevLogo />;
  if (s.includes("wiki"))      return <WikiLogo />;
  if (s.includes("hn") || s.includes("hacker")) return <HNLogo />;
  if (s.includes("yc") || s.includes("combinator")) return <YCLogo />;
  if (s.includes("ph") || s.includes("product hunt")) return <PHLogo />;
  return <span className="mono text-[0.6rem] text-ash">{source.slice(0, 2).toUpperCase()}</span>;
}

/* ── study doodles ─────────────────────────────────────────── */
export function PencilDoodle({ c = "#d4af37" }: { c?: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={c} strokeWidth="1.4" strokeOpacity="0.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export function PaperclipDoodle({ c = "#00ffff" }: { c?: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke={c} strokeWidth="1.4" strokeOpacity="0.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export function StarDoodle({ c = "#d4af37" }: { c?: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.9 6.9L22 9.6l-5.4 4.7L18.2 22 12 18.2 5.8 22l1.6-7.7L2 9.6l7.1-.7L12 2z" stroke={c} strokeWidth="1.3" strokeOpacity="0.7" strokeLinejoin="round"/></svg>;
}
export function BookmarkDoodle({ c = "#00ffff" }: { c?: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke={c} strokeWidth="1.4" strokeOpacity="0.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export function GradCapIcon({ c = "#d4af37", s = 16 }: { c?: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>;
}
export function ArrowUR({ s = 16, className = "" }: { s?: number; className?: string }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>;
}
