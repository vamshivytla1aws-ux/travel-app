import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"], display: "swap" });

const description = "Reliable corporate employee pick-up and drop services with a fleet of 80+ buses serving Isnapur, Patancheru, Sangareddy and the Hyderabad region.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.jaibhavanitravels.com"),
  title: "Jai Bhavani Travels | Corporate Employee Transport Services Hyderabad",
  description,
  applicationName: "Jai Bhavani Travels",
  keywords: ["Corporate Employee Transportation Hyderabad", "Employee Pick-up and Drop Hyderabad", "Corporate Bus Services Hyderabad", "Employee Transport Isnapur", "Corporate Transportation Patancheru", "Bus Transport Sangareddy", "Staff Transportation Services Hyderabad"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Jai Bhavani Travels",
    title: "Premium Corporate Employee Transportation | Jai Bhavani Travels",
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Jai Bhavani Travels premium employee transport solutions" }],
  },
  twitter: { card: "summary_large_image", title: "Jai Bhavani Travels | Corporate Employee Transport", description, images: ["/og.png"] },
  category: "Corporate transportation",
};

export const viewport: Viewport = { themeColor: "#07111f", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${manrope.variable} ${cormorant.variable}`}><body>{children}</body></html>;
}
