import { cn } from "@/lib/utils";

type AlertTone = "success" | "error" | "warning" | "info";

const toneClasses: Record<AlertTone, string> = {
  success: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200",
  error: "border-red-400/20 bg-red-400/[0.08] text-red-200",
  warning: "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
  info: "border-sky-400/20 bg-sky-400/[0.08] text-sky-200",
};

type StatusAlertProps = {
  title?: string;
  message: string;
  tone?: AlertTone;
  className?: string;
};

export function StatusAlert({ title, message, tone = "info", className }: StatusAlertProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("rounded-lg border px-3 py-2 text-sm shadow-[inset_0_1px_rgba(255,255,255,.025)]", toneClasses[tone], className)}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <p>{message}</p>
    </div>
  );
}
