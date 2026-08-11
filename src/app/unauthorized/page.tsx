import Image from "next/image";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="premium-app flex min-h-screen items-center justify-center px-4">
      <div className="premium-surface w-full max-w-lg rounded-2xl p-8 text-center">
        <Image src="/brand/jbt-mark.webp" alt="JBT" width={72} height={72} className="mx-auto mb-5 h-16 w-16 object-contain mix-blend-screen" />
        <p className="text-[9px] font-bold tracking-[0.22em] text-[#b99a55] uppercase">Access Control</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[#f0e8d9]">Unauthorized</h1>
        <p className="mt-3 text-sm text-[#8e9bab]">You do not have permission to access this page.</p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-lg border border-[#d9b966]/25 bg-[#d9b966]/10 px-4 py-2 text-sm font-semibold text-[#e4c578] transition-colors hover:bg-[#d9b966]/15">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
