// Structural spring physics — the only motion language in COMPILE.
// Standard easing/duration transitions are banned per the design protocol.

import type { Transition, Variants } from "framer-motion";

export const SPRING: Transition = { type: "spring", stiffness: 130, damping: 22, mass: 1.1 };
export const SPRING_SNAP: Transition = { type: "spring", stiffness: 320, damping: 26, mass: 0.7 };

/** Card / block entrance — rises into place on a spring. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { ...SPRING, delay: (i as number) * 0.05 } }),
};

/** Mechanical "stamp" landing — used for status confirmations. */
export const stampIn: Variants = {
  hidden: { opacity: 0, scale: 1.25, rotate: -4 },
  show: { opacity: 1, scale: 1, rotate: -3, transition: SPRING_SNAP },
};

/** High-frequency, low-amplitude shake — the submit "mechanical response". */
export const submitShake = {
  x: [0, -3, 3, -2, 2, -1, 1, 0],
  transition: { duration: 0.34 },
};
