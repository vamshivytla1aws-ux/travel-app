import { cn } from "@/lib/utils";

type AlertTone = "success" | "error" | "warning" | "info";

const toneClasses: Record<AlertTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
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
      className={cn("rounded-md border px-3 py-2 text-sm", toneClasses[tone], className)}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <p>{message}</p>
    </div>
  );
}

