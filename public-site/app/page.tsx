import { ContactSection } from "@/components/home/contact";
import { Hero } from "@/components/home/hero";
import { AboutSection, Clients, FleetSection, Services, WhyChooseUs } from "@/components/home/sections";
import { StatsStrip } from "@/components/home/stats";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

const structuredData = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  name: "Jai Bhavani Travels",
  url: "https://www.jaibhavanitravels.com",
  logo: "https://www.jaibhavanitravels.com/brand/jai-bhavani-logo-transparent.png",
  email: "jaibhavanitravels9@gmail.com",
  telephone: "+91-9494665519",
  description: "Corporate employee transportation, employee pick-up and drop, route planning and fleet operations across the Hyderabad industrial region.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Plot No 5 and 26, Pramuk Nagar, Isnapur, Patancheru",
    addressLocality: "Sangareddy",
    addressRegion: "Telangana",
    postalCode: "502307",
    addressCountry: "IN",
  },
  areaServed: ["Isnapur", "Patancheru", "Sangareddy", "Hyderabad Region"],
  contactPoint: [{ "@type": "ContactPoint", telephone: "+91-9494665519", contactType: "sales", areaServed: "IN", availableLanguage: ["English", "Telugu", "Hindi"] }],
};

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Header />
      <main id="main-content"><Hero /><Services /><StatsStrip /><AboutSection /><WhyChooseUs /><FleetSection /><Clients /><ContactSection /></main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </>
  );
}
