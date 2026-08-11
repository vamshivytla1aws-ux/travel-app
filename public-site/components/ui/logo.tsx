import Link from "next/link";

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link className="brand" href="#home" aria-label="Jai Bhavani Travels home" onClick={onClick}>
      <span className="brand-mark" aria-hidden="true"><span>JB</span></span>
      <span className="brand-copy">
        <strong>Jai Bhavani</strong>
        <span>Travels</span>
      </span>
    </Link>
  );
}
