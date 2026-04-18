import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const enterpriseContainer = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
export const enterpriseCard =
  "rounded-xl border border-border bg-card text-card-foreground shadow-enterprise";
