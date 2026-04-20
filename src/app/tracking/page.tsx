import { AppShell } from "@/components/app-shell";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPinned } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50, 100] as const;

type Props = {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
};

export default async function TrackingPage(props: Props) {
  await requireSession();
  await requireModuleAccess("tracking");
  const searchParams = await props.searchParams;
  const logs = await query<{
    bus_number: string;
    logged_at: string;
    latitude: string;
    longitude: string;
    speed_kmph: string;
  }>(
    `SELECT b.bus_number, g.logged_at::text, g.latitude::text, g.longitude::text, g.speed_kmph::text
     FROM gps_logs g
     JOIN buses b ON b.id = g.bus_id
     ORDER BY g.logged_at DESC
     LIMIT 100`,
  );
  const q = String(searchParams.q ?? "").trim().toLowerCase();
  const filtered = logs.rows.filter((log) => !q || log.bus_number.toLowerCase().includes(q));
  const requestedPageSize = Number(searchParams.pageSize ?? "15");
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number]) ? requestedPageSize : 15;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const parsedPage = Number(searchParams.page ?? "1");
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleLogs = filtered.slice(startIndex, startIndex + pageSize);

  return (
    <AppShell>
      <EnterprisePageHeader
        title="Live Tracking"
        subtitle="Track current GPS positions and speed snapshots"
        icon={MapPinned}
        tag="Tracking"
      />
      <Card>
        <CardHeader>
          <CardTitle>Mock Live Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="grid gap-2 md:grid-cols-4">
            <Input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search bus number" />
            <select name="pageSize" defaultValue={String(pageSize)} className="h-10 rounded-md border border-input bg-transparent px-3 text-sm">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <button className="h-10 rounded-md border border-input px-3 text-sm">Apply</button>
            <a href="/tracking" className="inline-flex h-10 items-center justify-center rounded-md border border-input px-3 text-sm">Clear</a>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bus</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Latitude</TableHead>
                <TableHead>Longitude</TableHead>
                <TableHead>Speed (km/h)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLogs.map((log, idx) => (
                <TableRow key={`${log.bus_number}-${idx}`}>
                  <TableCell>{log.bus_number}</TableCell>
                  <TableCell>{new Date(log.logged_at).toLocaleString()}</TableCell>
                  <TableCell>{Number(log.latitude).toFixed(5)}</TableCell>
                  <TableCell>{Number(log.longitude).toFixed(5)}</TableCell>
                  <TableCell>{Number(log.speed_kmph).toFixed(1)}</TableCell>
                </TableRow>
              ))}
              {visibleLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No tracking logs found for current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {total === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <a
                className={`rounded border px-2 py-1 ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                href={`/tracking?q=${encodeURIComponent(searchParams.q ?? "")}&pageSize=${pageSize}&page=${Math.max(1, currentPage - 1)}`}
              >
                Prev
              </a>
              <span>{currentPage}/{totalPages}</span>
              <a
                className={`rounded border px-2 py-1 ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                href={`/tracking?q=${encodeURIComponent(searchParams.q ?? "")}&pageSize=${pageSize}&page=${Math.min(totalPages, currentPage + 1)}`}
              >
                Next
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
