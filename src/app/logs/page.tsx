import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { ModuleExportLauncher } from "@/components/exports/module-export-launcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { formatDateTimeInAppTimeZone } from "@/lib/timezone";

type Props = {
  searchParams: Promise<{ entity?: string; action?: string; page?: string; pageSize?: string; export?: string }>;
};

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50, 100] as const;

export default async function LogsPage(props: Props) {
  await requireModuleAccess("logs");
  await ensureTransportEnhancements();
  const searchParams = await props.searchParams;
  const entity = searchParams.entity ? String(searchParams.entity) : "";
  const action = searchParams.action ? String(searchParams.action) : "";
  const requestedPageSize = Number(searchParams.pageSize ?? "20");
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : 20;
  const page = Number(searchParams.page ?? "1");
  const offset = (Number.isFinite(page) && page > 0 ? page - 1 : 0) * pageSize;

  const logs = await query<{
    id: number;
    user_email: string | null;
    action: string;
    entity_type: string;
    entity_id: number | null;
    details: Record<string, unknown> | null;
    created_at: string;
  }>(
    `SELECT id, user_email, action, entity_type, entity_id, details, created_at::text
     FROM audit_logs
     WHERE ($1 = '' OR entity_type = $1)
       AND ($2 = '' OR action = $2)
     ORDER BY created_at DESC
     LIMIT $3
     OFFSET $4`,
    [entity, action, pageSize, offset],
  );

  return (
    <AppShell>
      <EnterprisePageHeader
        title="Activity Logs"
        subtitle="Track who changed what across operations"
        icon={ClipboardList}
        tag="Audit"
        actions={
          <ModuleExportLauncher
            moduleKey="logs"
            moduleLabel="Logs"
            basePath="/logs"
            searchParams={{
              q: [entity, action].filter(Boolean).join(" ").trim() || undefined,
              export: searchParams.export,
              entity: searchParams.entity,
              action: searchParams.action,
              page: searchParams.page,
              pageSize: searchParams.pageSize,
            }}
            defaultQuery={[entity, action].filter(Boolean).join(" ").trim()}
          />
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Log Portal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-5">
            <Input name="entity" placeholder="Entity (fuel_entry, user, trip)" defaultValue={entity} />
            <Input name="action" placeholder="Action (create, update, delete)" defaultValue={action} />
            <select name="pageSize" defaultValue={String(pageSize)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <input type="hidden" name="page" value="1" />
            <Button type="submit">Filter</Button>
            <Link href="/logs" className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm">Clear</Link>
          </form>
          {(entity || action) ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {entity ? <span className="rounded-full border bg-muted px-2 py-1">Entity: {entity}</span> : null}
              {action ? <span className="rounded-full border bg-muted px-2 py-1">Action: {action}</span> : null}
            </div>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.rows.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateTimeInAppTimeZone(log.created_at)} IST</TableCell>
                  <TableCell>{log.user_email ?? "system"}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.entity_type}</TableCell>
                  <TableCell>{log.entity_id ?? "-"}</TableCell>
                  <TableCell className="max-w-[420px] truncate">{log.details ? JSON.stringify(log.details) : "-"}</TableCell>
                </TableRow>
              ))}
              {logs.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No logs found for current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {logs.rows.length} logs on this page</span>
            <div className="flex items-center gap-2">
              <Link
                className={`rounded border px-2 py-1 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                href={`/logs?entity=${encodeURIComponent(entity)}&action=${encodeURIComponent(action)}&pageSize=${pageSize}&page=${Math.max(1, page - 1)}`}
              >
                Prev
              </Link>
              <span>Page {Number.isFinite(page) && page > 0 ? page : 1}</span>
              <Link
                className={`rounded border px-2 py-1 ${logs.rows.length < pageSize ? "pointer-events-none opacity-50" : ""}`}
                href={`/logs?entity=${encodeURIComponent(entity)}&action=${encodeURIComponent(action)}&pageSize=${pageSize}&page=${(Number.isFinite(page) && page > 0 ? page : 1) + 1}`}
              >
                Next
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
