"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";

const links = [
  ["Home", "home"],
  ["Services", "services"],
  ["What We Are", "about"],
  ["Clients", "clients"],
  ["Contact", "contact"],
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setActive(entry.target.id)),
      { rootMargin: "-38% 0px -55%", threshold: 0 },
    );
    links.forEach(([, id]) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className={`site-header ${scrolled || open ? "is-scrolled" : ""}`}>
      <span className="header-progress" aria-hidden="true"><span /></span>
      <div className="header-inner">
        <Logo onClick={() => setOpen(false)} />
        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map(([label, id]) => (
            <a key={id} href={`#${id}`} className={active === id ? "active" : ""}>{label}</a>
          ))}
        </nav>
        <button
          className="menu-button"
          type="button"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <nav id="mobile-navigation" className={`mobile-nav ${open ? "open" : ""}`} aria-label="Mobile navigation">
        {links.map(([label, id], index) => (
          <a key={id} href={`#${id}`} onClick={() => setOpen(false)} style={{ "--index": index } as React.CSSProperties}>
            <span>0{index + 1}</span>{label}
          </a>
        ))}
        <a className="mobile-quote" href="#contact" onClick={() => setOpen(false)}>Request a quote</a>
      </nav>
    </header>
  );
}
