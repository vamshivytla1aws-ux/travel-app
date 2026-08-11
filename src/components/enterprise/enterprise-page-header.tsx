import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

type EnterprisePageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  tag?: string;
};

export function EnterprisePageHeader({
  title,
  subtitle,
  actions,
  icon: Icon,
  tag = "Transport Operations",
}: EnterprisePageHeaderProps) {
  return (
    <section className="relative mb-7 overflow-hidden rounded-2xl border border-[#d9b966]/15 bg-[linear-gradient(125deg,rgba(16,32,51,.95),rgba(7,16,28,.96))] px-5 py-5 shadow-[0_24px_70px_rgba(0,0,0,.24)] sm:px-7 sm:py-6">
      <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[#d9b966] to-transparent" aria-hidden />
      <div className="absolute -right-16 -top-24 h-52 w-52 rounded-full bg-[#d9b966]/[0.055] blur-3xl" aria-hidden />
      <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.22em] text-[#d8b765] uppercase">
            <span className="h-px w-7 bg-[#d8b765]/70" aria-hidden />{tag}
          </p>
          <h1 className="mt-3 flex items-center gap-3 font-display text-[clamp(2.05rem,4vw,3.25rem)] font-semibold leading-none tracking-[-0.035em] text-[#f3eee5]">
            {Icon ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d9b966]/20 bg-[#d9b966]/10"><Icon className="h-5 w-5 text-[#dfbd6e]" /></span> : null}
            <span className="truncate">{title}</span>
          </h1>
          {subtitle ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#94a0ae]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </section>
  );
}
