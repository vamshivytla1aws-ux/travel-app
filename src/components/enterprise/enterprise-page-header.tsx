import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { enterpriseContainer } from "@/lib/ui-core";

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
    <div className={enterpriseContainer}>
      <div className="mb-6 flex items-start justify-between gap-4 rounded border border-slate-300 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tag}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {Icon ? <Icon className="h-6 w-6 text-yellow-500" /> : null}
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
    </div>
  );
}
