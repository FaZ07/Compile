"use client";

import { useEffect, useRef, useState } from "react";

interface Props { to: number; duration?: number; prefix?: string; className?: string; }

export default function CountUp({ to, duration = 1.6, prefix = "", className = "num" }: Props) {
  const [val, setVal] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    start.current = null;
    let raf = 0;
    const tick = (now: number) => {
      if (start.current == null) start.current = now;
      const t = Math.min((now - start.current) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);

  return <span className={className}>{prefix}{val.toLocaleString("en-IN")}</span>;
}
