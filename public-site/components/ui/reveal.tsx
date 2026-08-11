"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function Reveal({ children, className = "", delay = 0, mask = false, premiumCard = false }: { children: ReactNode; className?: string; delay?: number; mask?: boolean; premiumCard?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      data-premium-card={premiumCard ? "" : undefined}
      initial={reduced ? false : { opacity: 0, y: 24, clipPath: mask ? "inset(0 0 18% 0)" : "inset(0 0 0 0)" }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0, clipPath: "inset(0 0 0 0)" }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
