"use client";

interface Props {
  text: string;
  className?: string;
  delay?: number;     // seconds before first word
  stagger?: number;   // ms between words
  style?: React.CSSProperties;
}

/** Word-by-word boot reveal (compositor-thread CSS animation). */
export default function Reveal({ text, className = "", delay = 0, stagger = 60, style }: Props) {
  const words = text.split(" ");
  return (
    <span className={className} style={style} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <span className="word" style={{ animationDelay: `${delay + (i * stagger) / 1000}s` }}>
            {w}{i < words.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </span>
  );
}
