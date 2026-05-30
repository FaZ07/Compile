interface Props { text: string; index?: number; label?: string }

const ROT = [-2.5, 1.8, -1.2, 2.4, -3, 1.2];

/** A study sticky-note with washi tape + slight rotation. */
export default function Sticky({ text, index = 0, label = "note to self" }: Props) {
  const rot = ROT[index % ROT.length];
  return (
    <div className="sticky p-4 pt-5" style={{ transform: `rotate(${rot}deg)` }}>
      <p className="mono text-[0.5rem] uppercase tracking-[0.2em] text-[#8a7a3a] mb-1.5">{label}</p>
      <p className="text-[0.86rem] leading-snug" style={{ fontFamily: "var(--font-sans)" }}>{text}</p>
    </div>
  );
}
