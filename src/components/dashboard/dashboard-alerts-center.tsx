import Link from "next/link";
import { AlertTriangle, BellRing } from "lucide-react";
import { AppModule } from "@/lib/auth";
import { DashboardExceptionAlert } from "@/services/dashboard.service";
import { formatDateTimeInAppTimeZone } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  alerts: DashboardExceptionAlert[];
  allowedModules: AppModule[];
};

function severityToBadgeVariant(
  severity: DashboardExceptionAlert["severity"],
): "destructive" | "secondary" | "outline" {
  if (severity === "critical") return "destructive";
  if (severity === "warning") return "secondary";
  return "outline";
}

export function DashboardAlertsCenter({ alerts, allowedModules }: Props) {
  const visibleAlerts = alerts.filter((alert) => allowedModules.includes(alert.moduleKey));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-amber-600" />
          Alerts & Exceptions Center
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleAlerts.length === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            No active anomalies right now.
          </div>
        ) : (
          visibleAlerts.map((alert) => (
            <div key={alert.id} className="rounded-md border bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <Badge variant={severityToBadgeVariant(alert.severity)}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.description}</p>
                  {alert.at ? (
                    <p className="text-[11px] text-slate-500">
                      {formatDateTimeInAppTimeZone(alert.at)}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={alert.actionHref}
                  className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                >
                  {alert.actionLabel}
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

