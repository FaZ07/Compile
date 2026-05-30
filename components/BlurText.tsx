interface Props {
  text: string;
  className?: string;
  /** seconds before the first word starts */
  delay?: number;
  /** ms between each word */
  stagger?: number;
  style?: React.CSSProperties;
  justify?: "center" | "start";
}

/**
 * Word-by-word reveal. Pure CSS animation (compositor thread) so the heavy
 * Three.js render loop on the main thread cannot stall it.
 */
export default function BlurText({
  text,
  className = "",
  delay = 0,
  stagger = 80,
  style,
  justify = "center",
}: Props) {
  const words = text.split(" ");
  return (
    <p
      className={className}
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: justify === "center" ? "center" : "flex-start",
        rowGap: "0.1em",
        ...style,
      }}
    >
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className="word-in"
          style={{ marginRight: "0.26em", animationDelay: `${delay + (i * stagger) / 1000}s` }}
        >
          {w}
        </span>
      ))}
    </p>
  );
}
