"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function formatSegment(segment: string): string {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function EnterpriseBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    return { href, label: formatSegment(segment), isLast: index === segments.length - 1 };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-300">
      <Link href="/dashboard" className="hover:text-yellow-200">
        Home
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-2">
          <span aria-hidden>/</span>
          {crumb.isLast ? (
            <span className="font-semibold text-yellow-200">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-yellow-200">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

