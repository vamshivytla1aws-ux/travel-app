import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Route } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusAlert } from "@/components/ui/status-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { safeDecodeURIComponent } from "@/lib/url";
import { RoutesService } from "@/services/routes.service";

const routesService = new RoutesService();
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50, 100] as const;

async function createRoute(formData: FormData) {
  "use server";
  const session = await requireSession(["admin", "dispatcher"]);
  await requireModuleAccess("routes");
  try {
    const result = await query<{ id: number }>(
      `INSERT INTO routes(route_code, route_name, start_location, end_location, total_distance_km, estimated_duration_minutes)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [
        String(formData.get("routeCode")),
        String(formData.get("routeName")),
        String(formData.get("startLocation")),
        String(formData.get("endLocation")),
        Number(formData.get("totalDistanceKm")),
        Number(formData.get("estimatedDurationMinutes")),
      ],
    );
    await logAuditEvent({ session, action: "create", entityType: "route", entityId: result.rows[0].id });
    revalidatePath("/routes");
    redirect(`/routes?created=${Date.now()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create route";
    redirect(`/routes?error=${encodeURIComponent(message)}`);
  }
}

type Props = {
  searchParams: Promise<{ created?: string; error?: string; q?: string; page?: string; pageSize?: string }>;
};

export default async function RoutesPage(props: Props) {
  await requireSession();
  await requireModuleAccess("routes");
  const searchParams = await props.searchParams;
  const routes = await routesService.listRoutes();
  const q = String(searchParams.q ?? "").trim().toLowerCase();
  const filtered = routes.filter(
    (route) =>
      !q ||
      route.routeCode.toLowerCase().includes(q) ||
      route.routeName.toLowerCase().includes(q) ||
      route.startLocation.toLowerCase().includes(q) ||
      route.endLocation.toLowerCase().includes(q),
  );
  const requestedPageSize = Number(searchParams.pageSize ?? "15");
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number]) ? requestedPageSize : 15;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const parsedPage = Number(searchParams.page ?? "1");
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleRoutes = filtered.slice(startIndex, startIndex + pageSize);

  return (
    <AppShell>
      <EnterprisePageHeader
        title="Route Planner"
        subtitle="Design route coverage and optimize travel distance for shifts"
        icon={Route}
        tag="Route Design"
      />
      {searchParams.created ? (
        <StatusAlert className="mb-4" tone="success" message="Route created successfully." />
      ) : null}
      {searchParams.error ? (
        <StatusAlert className="mb-4" tone="error" message={safeDecodeURIComponent(searchParams.error)} />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-violet-200/70 bg-violet-50/40 dark:border-violet-900 dark:bg-violet-950/20">
          <CardHeader><CardTitle>Create Route</CardTitle></CardHeader>
          <CardContent>
            <form action={createRoute} className="grid gap-2">
              <Label htmlFor="routeCode">Code</Label><Input id="routeCode" name="routeCode" required />
              <Label htmlFor="routeName">Name</Label><Input id="routeName" name="routeName" required />
              <Label htmlFor="startLocation">Start</Label><Input id="startLocation" name="startLocation" required />
              <Label htmlFor="endLocation">End</Label><Input id="endLocation" name="endLocation" required />
              <Label htmlFor="totalDistanceKm">Distance (km)</Label><Input id="totalDistanceKm" name="totalDistanceKm" type="number" step="0.01" required />
              <Label htmlFor="estimatedDurationMinutes">Duration (min)</Label><Input id="estimatedDurationMinutes" name="estimatedDurationMinutes" type="number" required />
              <Button type="submit">Save</Button>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 border-violet-200/70 dark:border-violet-900">
          <CardHeader><CardTitle>Routes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <form className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-4">
              <Input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search code/name/start/end" />
              <select name="pageSize" defaultValue={String(pageSize)} className="h-10 rounded-md border border-input bg-transparent px-3 text-sm">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline">Apply</Button>
              <Link href="/routes" className="inline-flex h-10 items-center justify-center rounded-md border border-input px-3 text-sm">
                Clear
              </Link>
            </form>
            {q ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border bg-muted px-2 py-1">Search: {q}</span>
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Distance</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {visibleRoutes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell>{route.routeCode}</TableCell>
                    <TableCell>{route.routeName}</TableCell>
                    <TableCell>{route.totalDistanceKm.toFixed(2)} km</TableCell>
                  </TableRow>
                ))}
                {visibleRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No routes found.
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
                <Link
                  className={`rounded border px-2 py-1 ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  href={`/routes?q=${encodeURIComponent(searchParams.q ?? "")}&pageSize=${pageSize}&page=${Math.max(1, currentPage - 1)}`}
                >
                  Prev
                </Link>
                <span>{currentPage}/{totalPages}</span>
                <Link
                  className={`rounded border px-2 py-1 ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                  href={`/routes?q=${encodeURIComponent(searchParams.q ?? "")}&pageSize=${pageSize}&page=${Math.min(totalPages, currentPage + 1)}`}
                >
                  Next
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
