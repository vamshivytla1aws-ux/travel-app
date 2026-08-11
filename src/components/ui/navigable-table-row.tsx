"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type NavigableTableRowProps = React.ComponentProps<typeof TableRow> & {
  href: string;
  navigationLabel: string;
};

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest("a, button, input, select, textarea, label, form, [role='button'], [data-row-navigation-ignore]"),
  );
}

export function NavigableTableRow({ href, navigationLabel, className, children, ...props }: NavigableTableRowProps) {
  const router = useRouter();
  const open = () => router.push(href);

  return (
    <TableRow
      {...props}
      tabIndex={0}
      aria-label={navigationLabel}
      className={cn("cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d9b966]/55", className)}
      onMouseEnter={() => router.prefetch(href)}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented && !isInteractiveTarget(event.target)) open();
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (!event.defaultPrevented && (event.key === "Enter" || event.key === " ") && !isInteractiveTarget(event.target)) {
          event.preventDefault();
          open();
        }
      }}
    >
      {children}
    </TableRow>
  );
}
