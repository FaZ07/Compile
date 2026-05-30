interface Props { text: string; index?: number; label?: string }

const ROT = [-2, 1.6, -1.2, 2.2, -2.6, 1.1];
const TINT = ["#ffe6b8", "#d6e4ff", "#ffd6c7"]; // warm · blueprint · orange-pale

/** A study sticky-note: tinted paper, ink border, hard offset shadow, tape. */
export default function Sticky({ text, index = 0, label = "note to self" }: Props) {
  return (
    <div className="press relative p-4 pt-5"
      style={{ transform: `rotate(${ROT[index % ROT.length]}deg)`, background: TINT[index % TINT.length], border: "2px solid #1a1a1b", boxShadow: "4px 4px 0 0 #1a1a1b" }}>
      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rotate-[-3deg]" style={{ width: 56, height: 16, background: "rgba(255,69,0,0.55)", border: "1px solid rgba(0,0,0,0.2)" }} />
      <p className="label" style={{ fontSize: "0.46rem", marginBottom: 6 }}>{label}</p>
      <p className="text-[0.84rem] leading-snug" style={{ fontWeight: 500 }}>{text}</p>
    </div>
  );
}
