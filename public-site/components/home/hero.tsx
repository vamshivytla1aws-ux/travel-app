"use client";

import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight, BusFront, MapPin, MessageCircle, Phone, Route, ShieldCheck, UsersRound } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";

const quickStats = [
  { icon: BusFront, value: "80+", label: "Buses" },
  { icon: UsersRound, value: "100+", label: "Employees" },
  { icon: Route, value: "Employee", label: "Pick-up & Drop" },
  { icon: ShieldCheck, value: "Safe & Reliable", label: "Operations" },
];

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [desktopMotion, setDesktopMotion] = useState(false);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 55, damping: 22 });
  const y = useSpring(rawY, { stiffness: 55, damping: 22 });
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const imageLift = useTransform(scrollYProgress, [0, 1], [0, -54]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.035]);
  const copyLift = useTransform(scrollYProgress, [0, 1], [0, -34]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.72, 1], [1, 0.86, 0.08]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const update = () => setDesktopMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function handlePointer(event: MouseEvent<HTMLElement>) {
    if (reduced || window.innerWidth < 900) return;
    const rect = event.currentTarget.getBoundingClientRect();
    rawX.set(((event.clientX - rect.left) / rect.width - 0.5) * 10);
    rawY.set(((event.clientY - rect.top) / rect.height - 0.5) * 7);
  }

  return (
    <section ref={heroRef} id="home" className="hero" onMouseMove={handlePointer} onMouseLeave={() => { rawX.set(0); rawY.set(0); }}>
      <motion.div
        className="hero-image"
        style={!desktopMotion || reduced ? undefined : { y: imageLift, scale: imageScale }}
      >
        <motion.div
          className="hero-image-enter"
          initial={reduced ? false : { opacity: 0, x: 70, scale: 1.04 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div className="hero-image-parallax" style={{ x, y }}>
            <Image
              src="/images/jai-bhavani-hero-coaches.webp"
              alt="Two premium employee transport coaches travelling on a highway at blue hour"
              fill
              priority
              fetchPriority="high"
              sizes="100vw"
              quality={90}
            />
          </motion.div>
        </motion.div>
      </motion.div>
      <div className="hero-shade" aria-hidden="true" />
      <div className="road-streak road-streak-one" aria-hidden="true" />
      <div className="road-streak road-streak-two" aria-hidden="true" />
      <div className="road-streak road-streak-three" aria-hidden="true" />
      <div className="headlight-bloom" aria-hidden="true" />
      <div className="hero-orbit" aria-hidden="true" />
      <div className="hero-handoff" aria-hidden="true" />
      <div className="container hero-content">
        <motion.div
          className="hero-copy"
          initial={reduced ? false : "hidden"}
          animate="visible"
          style={!desktopMotion || reduced ? undefined : { y: copyLift, opacity: copyOpacity }}
          variants={{ visible: { transition: { staggerChildren: 0.11, delayChildren: 0.2 } } }}
        >
          <motion.p className="eyebrow" variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
            <span /> Corporate mobility, redefined
          </motion.p>
          <motion.h1 variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}>
            Premium Employee<br /><em>Transport Solutions</em>
          </motion.h1>
          <motion.p className="hero-lead" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            Reliable employee pick-up and drop services backed by a modern fleet, an experienced team and an unwavering commitment to safety, punctuality and operational excellence.
          </motion.p>
          <motion.div className="hero-actions" variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
            <a className="button button-gold" href="#contact" data-magnetic>Get a quote <ArrowUpRight /></a>
            <a className="button button-ghost" href="tel:+919494665519"><Phone /> Contact us</a>
            <a className="icon-button" href="https://wa.me/919494665519" target="_blank" rel="noopener noreferrer" aria-label="Chat with Jai Bhavani Travels on WhatsApp"><MessageCircle /></a>
          </motion.div>
          <motion.p className="service-region" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>
            <MapPin /> Serving Isnapur <span>•</span> Patancheru <span>•</span> Sangareddy <span>•</span> Hyderabad Region
          </motion.p>
        </motion.div>
        <motion.div
          className="hero-stats"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.7 }}
        >
          {quickStats.map(({ icon: Icon, value, label }) => (
            <div key={label}>
              <Icon aria-hidden="true" />
              <span className="hero-stat-copy"><strong>{value}</strong><span>{label}</span></span>
            </div>
          ))}
        </motion.div>
      </div>
      <a className="scroll-cue" href="#services" aria-label="Scroll to services"><span /> Explore</a>
    </section>
  );
}
