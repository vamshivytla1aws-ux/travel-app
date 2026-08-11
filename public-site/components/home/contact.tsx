import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { ContactForm } from "@/components/home/contact-form";
import { processPoints } from "@/components/home/sections";

const mapUrl = "https://www.google.com/maps/search/?api=1&query=Plot+No+5+and+26%2C+Pramuk+Nagar%2C+Isnapur%2C+Patancheru%2C+Sangareddy%2C+Telangana+502307";

export function ContactSection() {
  return (
    <section id="contact" className="section contact-section">
      <div className="container">
        <Reveal className="contact-top" mask>
          <p className="eyebrow"><span /> Let&apos;s talk transport</p>
          <h2>Let&apos;s move your<br /><em>workforce better.</em></h2>
          <p>Looking for reliable employee transportation for your organization? Talk to Jai Bhavani Travels about routes, fleet requirements and corporate transport solutions.</p>
        </Reveal>
        <div className="contact-layout">
          <Reveal className="contact-details" premiumCard>
            <div className="contact-block"><Phone /><div><span>Phone</span><a href="tel:+919494665519">+91 94946 65519</a><a href="tel:+919866243498">+91 98662 43498</a><a href="tel:+919666227227">+91 96662 27227</a></div></div>
            <div className="contact-block"><Mail /><div><span>Email</span><a href="mailto:jaibhavanitravels9@gmail.com">jaibhavanitravels9@gmail.com</a></div></div>
            <div className="contact-block"><MapPin /><div><span>Address</span><address>Plot No 5 and 26, Pramuk Nagar,<br />Isnapur, Patancheru, Sangareddy,<br />Telangana — 502307</address></div></div>
            <div className="contact-actions">
              <a className="button button-gold" href="tel:+919494665519" data-magnetic>Call now <Phone /></a>
              <a className="button button-outline" href="https://wa.me/919494665519" target="_blank" rel="noopener noreferrer">WhatsApp <MessageCircle /></a>
            </div>
          </Reveal>
          <Reveal delay={0.08}><ContactForm /></Reveal>
        </div>
        <Reveal className="map-panel" premiumCard>
          <div className="map-visual" aria-hidden="true">
            <span className="map-road road-a" /><span className="map-road road-b" /><span className="map-road road-c" />
            <div className="map-pin"><MapPin /></div>
          </div>
          <div className="map-copy"><span>Our location</span><h3>Isnapur, Telangana</h3><p>Strategically located near Patancheru and the Hyderabad industrial region.</p><a href={mapUrl} target="_blank" rel="noopener noreferrer">Get directions <ArrowUpRight /></a></div>
          <div className="process-list">
            {processPoints.map(({ icon: Icon, label }) => <div key={label}><Icon /><span>{label}</span></div>)}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
