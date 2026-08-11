import Link from "next/link";
import Image from "next/image";

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link className="brand" href="#home" aria-label="Jai Bhavani Travels home" onClick={onClick}>
      <Image
        className="brand-logo"
        src="/brand/jai-bhavani-logo-horizontal.webp"
        alt="JBT Jai Bhavani Travels"
        width={700}
        height={216}
        priority
      />
    </Link>
  );
}
