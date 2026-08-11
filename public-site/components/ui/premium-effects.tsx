"use client";

import { useEffect } from "react";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function PremiumEffects() {
  useEffect(() => {
    const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const updateProgress = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
        document.documentElement.style.setProperty("--page-progress", progress.toFixed(4));
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!precisePointer.matches || reducedMotion.matches) return;

      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest<HTMLElement>("[data-premium-card]");
      if (card) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
        card.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
      }

      const magnetic = target?.closest<HTMLElement>("[data-magnetic]");
      if (magnetic) {
        const rect = magnetic.getBoundingClientRect();
        const x = clamp((event.clientX - rect.left - rect.width / 2) * 0.035, -3, 3);
        const y = clamp((event.clientY - rect.top - rect.height / 2) * 0.035, -3, 3);
        magnetic.style.setProperty("--magnetic-x", `${x.toFixed(2)}px`);
        magnetic.style.setProperty("--magnetic-y", `${y.toFixed(2)}px`);
      }
    };

    const onPointerOut = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      const magnetic = target?.closest<HTMLElement>("[data-magnetic]");
      if (magnetic && !related?.closest("[data-magnetic]")?.isSameNode(magnetic)) {
        magnetic.style.setProperty("--magnetic-x", "0px");
        magnetic.style.setProperty("--magnetic-y", "0px");
      }
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
      document.documentElement.style.removeProperty("--page-progress");
    };
  }, []);

  return null;
}
