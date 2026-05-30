"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  to: number;
  duration?: number;     // seconds
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/** Eased count-up. Animates from 0 → `to` once on mount. */
export default function Counter({ to, duration = 1.4, prefix = "", suffix = "", decimals = 0, className }: Props) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(to * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setVal(to);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [to, duration]);

  const shown = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString("en-US");
  return <span className={className}>{prefix}{shown}{suffix}</span>;
}
