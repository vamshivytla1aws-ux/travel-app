import {
  ArrowRight,
  BusFront,
  CalendarClock,
  Check,
  Clock3,
  Gauge,
  Headphones,
  MapPinned,
  Route,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";

const services = [
  { icon: BusFront, number: "01", title: "Employee Pick-up & Drop", copy: "Safe, comfortable and punctual employee transportation across planned corporate routes." },
  { icon: UsersRound, number: "02", title: "Corporate Transport Contracts", copy: "Dedicated transportation solutions for organizations with flexible long-term operational contracts." },
  { icon: Route, number: "03", title: "Route Planning & Fleet Management", copy: "Efficient route planning, fleet allocation and transport coordination designed to improve punctuality and efficiency." },
  { icon: ShieldCheck, number: "04", title: "Safe & Timely Operations", copy: "Well-maintained vehicles, trained staff and disciplined operational processes focused on dependable transportation." },
];

const strengths = [
  { icon: BusFront, title: "Reliable Fleet", copy: "A dependable fleet ready for planned daily operations.", large: true },
  { icon: UsersRound, title: "Experienced Operations Team", copy: "Disciplined coordination from route to reporting." },
  { icon: ShieldCheck, title: "Employee Safety", copy: "Safety-led processes throughout every journey." },
  { icon: Clock3, title: "On-Time Pick-up & Drop", copy: "Schedules designed around workforce shift timings.", large: true },
  { icon: Gauge, title: "Corporate Expertise", copy: "Transport solutions shaped for organizational needs." },
  { icon: Route, title: "Flexible Route Management", copy: "Routes that adapt as teams and shifts change." },
  { icon: Wrench, title: "Preventive Maintenance", copy: "Vehicles maintained for reliable daily performance." },
  { icon: Headphones, title: "Operational Support", copy: "Responsive assistance when operations need it." },
];

export function Services() {
  return (
    <section id="services" className="section services-section">
      <div className="container">
        <Reveal className="section-heading heading-row" mask>
          <div><p className="eyebrow"><span /> Our services</p><h2>Mobility built around<br /><em>your workforce.</em></h2></div>
          <p>Dependable corporate transportation designed for the rhythm, scale and responsibility of modern operations.</p>
        </Reveal>
        <div className="service-grid">
          {services.map(({ icon: Icon, number, title, copy }, index) => (
            <Reveal key={title} className="service-card" delay={index * 0.06} premiumCard>
              <div className="service-icon"><Icon /></div><span className="card-number">{number}</span>
              <h3>{title}</h3><p>{copy}</p><span className="card-link">Explore solution <ArrowRight /></span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AboutSection() {
  return (
    <section id="about" className="section about-section">
      <div className="bus-outline" aria-hidden="true"><BusFront /></div>
      <div className="container about-grid">
        <Reveal className="about-label" mask>
          <p className="eyebrow"><span /> What we are</p>
          <div className="about-index">80<span>+</span><small>Strong fleet</small></div>
        </Reveal>
        <Reveal className="about-copy" delay={0.08} mask>
          <h2>Moving people.<br /><em>Powering business.</em></h2>
          <p className="lead">Jai Bhavani Travels is a trusted corporate transportation company providing reliable employee pick-up and drop services for organizations across the Hyderabad industrial region.</p>
          <p>With a fleet of around 80 buses and a workforce of more than 100 employees, we focus on safe transportation, punctual operations, disciplined fleet management and long-term corporate partnerships.</p>
          <blockquote><span>Our goal is simple</span>Move employees safely, comfortably and on time — every day.</blockquote>
        </Reveal>
      </div>
    </section>
  );
}

export function WhyChooseUs() {
  return (
    <section className="section why-section">
      <div className="container">
        <Reveal className="section-heading heading-row" mask>
          <div><p className="eyebrow"><span /> Why Jai Bhavani</p><h2>Confidence in<br /><em>every kilometre.</em></h2></div>
          <p>Operational discipline, experienced people and a service mindset that keeps your workforce moving.</p>
        </Reveal>
        <div className="strength-grid">
          {strengths.map(({ icon: Icon, title, copy, large }, index) => (
            <Reveal key={title} className={`strength-item ${large ? "large" : ""}`} delay={(index % 4) * 0.04} premiumCard>
              <Icon /><div><h3>{title}</h3><p>{copy}</p></div><span><Check /></span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const fleet = [
  { title: "Corporate Buses", tag: "Daily workforce mobility", position: "72% center" },
  { title: "Employee Coaches", tag: "Comfort across every route", position: "48% center" },
  { title: "Staff Transportation Vehicles", tag: "Flexible operational support", position: "88% center" },
];

export function FleetSection() {
  return (
    <section className="section fleet-section">
      <div className="container">
        <Reveal className="section-heading heading-row fleet-heading" mask>
          <div><p className="eyebrow"><span /> Our fleet</p><h2>Built for dependable<br /><em>employee mobility.</em></h2></div>
          <div className="fleet-count"><strong>80+</strong><span>Buses in our<br />overall fleet</span></div>
        </Reveal>
        <div className="fleet-grid">
          {fleet.map((item, index) => (
            <Reveal className="fleet-card" key={item.title} delay={index * 0.08} premiumCard>
              <Image src="/images/jai-bhavani-hero-coaches.webp" alt={`${item.title} for corporate employee transportation`} fill sizes="(max-width: 760px) 100vw, 33vw" style={{ objectPosition: item.position }} />
              <div className="fleet-overlay" />
              <div className="fleet-card-copy"><span>0{index + 1}</span><p>{item.tag}</p><h3>{item.title}</h3></div>
              <div className="fleet-arrow"><ArrowRight /></div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Clients() {
  const clients = [
    "TOSHIBA",
    "MRF",
    "DMart",
    "MAHINDRA",
    "Style Union",
    "Optimus Pharma",
    "SMT Cardiovascular Pvt. Ltd.",
    "Valentine Laboratory",
    "Hammond Power Solutions Pvt. Ltd.",
    "Tofflon India Pvt. Ltd.",
  ];

  return (
    <section id="clients" className="section clients-section">
      <div className="container">
        <Reveal className="clients-intro" mask>
          <p className="eyebrow"><span /> Trusted partnerships</p>
          <h2>Trusted by leading organizations</h2>
          <p>Supporting respected businesses with professional employee transportation.</p>
        </Reveal>
        <div className="client-grid" aria-label="Organizations served by Jai Bhavani Travels">
          {clients.map((client, index) => (
            <Reveal className="client-tile" key={client} delay={index * 0.06} premiumCard>
              <span>0{index + 1}</span><strong title={client}>{client}</strong><Sparkles aria-hidden="true" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export const processPoints = [
  { icon: MapPinned, label: "Planned routes" },
  { icon: CalendarClock, label: "Shift-aligned schedules" },
  { icon: ShieldCheck, label: "Safety-led operations" },
];
