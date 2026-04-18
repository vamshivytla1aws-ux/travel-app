import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { APP_MODULES, requireModuleAccess, requireSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";

async function createUser(formData: FormData) {
  "use server";
  const session = await requireSession(["admin"]);
  await requireModuleAccess("user-admin");
  await ensureTransportEnhancements();

  const fullName = String(formData.get("fullName"));
  const email = String(formData.get("email")).toLowerCase();
  const password = String(formData.get("password"));
  const role = String(formData.get("role")) as "admin" | "dispatcher" | "fuel_manager" | "viewer";
  const accessCsv = String(formData.get("accessCsv") ?? "");
  const moduleAccess = accessCsv
    .split(",")
    .map((value) => value.trim())
    .filter((value) => APP_MODULES.includes(value as (typeof APP_MODULES)[number]));

  const existing = await query<{ id: number }>(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
  if ((existing.rowCount ?? 0) > 0) redirect("/admin/users?error=duplicate");

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query<{ id: number }>(
    `INSERT INTO users(full_name, email, password_hash, role, module_access)
     VALUES($1,$2,$3,$4,$5)
     RETURNING id`,
    [fullName, email, passwordHash, role, role === "admin" ? [...APP_MODULES] : moduleAccess],
  );

  await logAuditEvent({
    session,
    action: "create",
    entityType: "user",
    entityId: result.rows[0].id,
    details: { email, role },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?created=1");
}

async function updateUserAccess(formData: FormData) {
  "use server";
  const session = await requireSession(["admin"]);
  await requireModuleAccess("user-admin");
  await ensureTransportEnhancements();

  const userId = Number(formData.get("userId"));
  const role = String(formData.get("role")) as "admin" | "dispatcher" | "fuel_manager" | "viewer";
  const moduleAccess = formData
    .getAll("moduleAccess")
    .map((value) => String(value))
    .filter((value) => APP_MODULES.includes(value as (typeof APP_MODULES)[number]));
  if (!userId) return;

  await query(`UPDATE users SET role = $1, module_access = $2, updated_at = NOW() WHERE id = $3`, [
    role,
    role === "admin" ? [...APP_MODULES] : moduleAccess,
    userId,
  ]);
  await logAuditEvent({
    session,
    action: "update",
    entityType: "user_access",
    entityId: userId,
    details: { role, moduleAccess },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?updated=1");
}

async function deactivateUser(formData: FormData) {
  "use server";
  const session = await requireSession(["admin"]);
  await requireModuleAccess("user-admin");
  const userId = Number(formData.get("userId"));
  if (!userId) return;

  await query(`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`, [userId]);
  await logAuditEvent({
    session,
    action: "delete",
    entityType: "user",
    entityId: userId,
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}

type Props = {
  searchParams: Promise<{ created?: string; updated?: string; deleted?: string; error?: string }>;
};

export default async function UsersAdminPage(props: Props) {
  await requireSession(["admin"]);
  await requireModuleAccess("user-admin");
  await ensureTransportEnhancements();
  const searchParams = await props.searchParams;
  const users = await query<{
    id: number;
    full_name: string;
    email: string;
    role: string;
    module_access: string[] | null;
    is_active: boolean;
  }>(`SELECT id, full_name, email, role::text, module_access, is_active FROM users ORDER BY id DESC`);

  return (
    <AppShell>
      <EnterprisePageHeader title="User Access Control" subtitle="Admin managed users, roles and dashboard access" icon={KeyRound} tag="Admin" />
      {searchParams.error === "duplicate" ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">User email already exists.</div> : null}
      {searchParams.created === "1" ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">User created successfully.</div> : null}
      {searchParams.updated === "1" ? <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">User access updated successfully.</div> : null}
      {searchParams.deleted === "1" ? <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">User deactivated successfully.</div> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Create User</CardTitle></CardHeader>
          <CardContent>
            <form action={createUser} className="grid gap-2">
              <Label htmlFor="fullName">Full Name</Label><Input id="fullName" name="fullName" required />
              <Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required />
              <Label htmlFor="password">Password</Label><Input id="password" name="password" required />
              <Label htmlFor="role">Role</Label>
              <select id="role" name="role" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="viewer">
                <option value="admin">admin</option>
                <option value="dispatcher">dispatcher</option>
                <option value="fuel_manager">fuel_manager</option>
                <option value="viewer">viewer</option>
              </select>
              <Label>Dashboard Access</Label>
              <div className="grid gap-1 rounded border p-2 text-sm">
                {APP_MODULES.filter((module) => !["user-admin", "logs"].includes(module)).map((module) => (
                  <label key={module} className="flex items-center gap-2">
                    <input type="checkbox" name="moduleAccess" value={module} defaultChecked={module === "dashboard"} /> {module}
                  </label>
                ))}
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="moduleAccess" value="logs" /> logs
                </label>
              </div>
              <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">Create User</button>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Users</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Access</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.rows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{(user.module_access ?? []).join(", ") || "-"}</TableCell>
                    <TableCell>{user.is_active ? "active" : "inactive"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <form action={updateUserAccess} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <select name="role" defaultValue={user.role} className="h-8 rounded border border-input bg-transparent px-2 text-xs">
                            <option value="admin">admin</option>
                            <option value="dispatcher">dispatcher</option>
                            <option value="fuel_manager">fuel_manager</option>
                            <option value="viewer">viewer</option>
                          </select>
                          <input
                            name="accessCsv"
                            defaultValue={(user.module_access ?? []).join(",")}
                            className="h-8 w-44 rounded border border-input bg-transparent px-2 text-xs"
                          />
                          <button className="h-8 rounded bg-primary px-2 text-xs text-primary-foreground">Update</button>
                        </form>
                        <form action={deactivateUser}>
                          <input type="hidden" name="userId" value={user.id} />
                          <ConfirmSubmitButton label="Delete" message="Deactivate this user?" className="text-red-600 hover:underline" />
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
