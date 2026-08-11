"use client";

import { useEffect, useRef, useState } from "react";

function Count({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setCount(target);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / 1100, 1);
        setCount(Math.round(target * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      observer.disconnect();
    }, { threshold: 0.6 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}+</span>;
}

export function StatsStrip() {
  return (
    <section className="stats-strip" aria-label="Company statistics">
      <div className="container stats-grid">
        <div><strong><Count target={80} /></strong><span>Buses</span></div>
        <div><strong><Count target={100} /></strong><span>Employees</span></div>
        <div><strong>Corporate</strong><span>Transport</span></div>
        <div><strong>Safe &amp;</strong><span>Reliable</span></div>
      </div>
    </section>
  );
}
