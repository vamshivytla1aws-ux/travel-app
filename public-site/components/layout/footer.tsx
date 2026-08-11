import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const nav = [["Home", "home"], ["Services", "services"], ["What We Are", "about"], ["Clients", "clients"], ["Contact", "contact"]];

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div className="footer-brand"><Logo /><p>Corporate employee transportation solutions—built on safety, punctuality and dependable operations.</p></div>
        <div className="footer-nav"><span>Navigate</span>{nav.map(([label, id]) => <a href={`#${id}`} key={id}>{label}</a>)}</div>
        <div className="footer-contact"><span>Get in touch</span><a href="tel:+919494665519"><Phone /> +91 94946 65519</a><a href="mailto:jaibhavanitravels9@gmail.com"><Mail /> jaibhavanitravels9@gmail.com</a><a href="mailto:jaibhavanitravels.enquiries@gmail.com"><Mail /> jaibhavanitravels.enquiries@gmail.com</a><p><MapPin /> Isnapur, Telangana 502307</p></div>
        <a className="footer-top" href="#home" aria-label="Back to top"><ArrowUpRight /></a>
      </div>
      <div className="container footer-bottom"><p>© {new Date().getFullYear()} Jai Bhavani Travels. All Rights Reserved.</p><p>Developed by <a href="https://www.aasthix.com" target="_blank" rel="noopener noreferrer">www.aasthix.com</a></p></div>
    </footer>
  );
}
