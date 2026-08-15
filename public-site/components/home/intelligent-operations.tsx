import {
  BellRing,
  ClipboardList,
  Fuel,
  MapPinned,
  Route,
  ShieldCheck,
  Video,
  Wrench,
} from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

const capabilities = [
  {
    icon: Video,
    number: "01",
    title: "Live CCTV Monitoring",
    copy: "On-board camera visibility supports safer journeys, operational oversight and faster incident review.",
    featured: true,
    signal: "Safety oversight",
  },
  {
    icon: MapPinned,
    number: "02",
    title: "Real-Time GPS Bus Tracking",
    copy: "Live vehicle location and movement visibility help our operations team coordinate routes and respond quickly.",
    featured: true,
    signal: "Fleet visibility",
  },
  {
    icon: Route,
    number: "03",
    title: "Route & Shift Monitoring",
    copy: "Daily route progress and workforce shift schedules are monitored for dependable coordination.",
  },
  {
    icon: ShieldCheck,
    number: "04",
    title: "Driver & Vehicle Compliance",
    copy: "Driver records, vehicle documents and important validity dates stay organized and visible.",
  },
  {
    icon: Wrench,
    number: "05",
    title: "Preventive Maintenance Control",
    copy: "Planned servicing and vehicle-condition records support reliable daily fleet readiness.",
  },
  {
    icon: Fuel,
    number: "06",
    title: "Fuel & Mileage Monitoring",
    copy: "Fuel movement, odometer readings and mileage performance are tracked with operational discipline.",
  },
  {
    icon: BellRing,
    number: "07",
    title: "Emergency Response Coordination",
    copy: "Structured escalation helps the team respond to breakdowns, delays and safety incidents promptly.",
  },
  {
    icon: ClipboardList,
    number: "08",
    title: "Daily Reports & Alerts",
    copy: "Operational summaries and exception alerts keep important daily actions from being missed.",
  },
] as const;

export function IntelligentOperations() {
  return (
    <section className="section intelligent-section" aria-labelledby="intelligent-operations-title">
      <div className="operations-grid-visual" aria-hidden="true" />
      <div className="container">
        <Reveal className="section-heading heading-row operations-heading" mask>
          <div>
            <p className="eyebrow"><span /> Intelligent fleet operations</p>
            <h2 id="intelligent-operations-title">Visibility behind<br /><em>every journey.</em></h2>
          </div>
          <p>Technology-supported oversight helps our operations team protect people, coordinate vehicles and maintain dependable service throughout the day.</p>
        </Reveal>

        <div className="operations-grid">
          {capabilities.map(({ icon: Icon, number, title, copy, ...capability }, index) => {
            const featured = "featured" in capability && capability.featured;
            const signal = "signal" in capability ? capability.signal : undefined;

            return (
              <Reveal
                key={title}
                className={`operations-card${featured ? " operations-card-featured" : ""}`}
                delay={(index % 4) * 0.05}
                premiumCard
              >
                <div className="operations-card-top">
                  <span className="operations-icon"><Icon aria-hidden="true" /></span>
                  <span className="operations-number">{number}</span>
                </div>
                {featured ? <div className="operations-route" aria-hidden="true"><span /><i /><i /></div> : null}
                <div className="operations-card-copy">
                  {signal ? <p className="operations-signal"><span aria-hidden="true" />{signal}</p> : null}
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
