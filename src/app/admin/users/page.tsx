import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { ModuleExportLauncher } from "@/components/exports/module-export-launcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAiScannerEnabled, setAiScannerEnabled } from "@/lib/app-settings";
import { APP_MODULES, normalizeModuleAccess, requireAdminSession, requireModuleAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { query, withTransaction } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";

function parseModuleAccessFromFormData(formData: FormData): (typeof APP_MODULES)[number][] {
  const selectedFromCheckboxes = formData
    .getAll("moduleAccess")
    .map((value) => String(value).trim())
    .filter((value) => APP_MODULES.includes(value as (typeof APP_MODULES)[number]));
  const unique = Array.from(new Set(selectedFromCheckboxes));
  if (unique.length === 0) return ["dashboard"];
  return unique as (typeof APP_MODULES)[number][];
}

async function createUser(formData: FormData) {
  "use server";
  const session = await requireAdminSession();
  await requireModuleAccess("user-admin");
  await ensureTransportEnhancements();

  const fullName = String(formData.get("fullName"));
  const email = String(formData.get("email")).toLowerCase();
  const password = String(formData.get("password"));
  const role = String(formData.get("role")) as "admin" | "dispatcher" | "fuel_manager" | "viewer" | "updater";
  const moduleAccess = parseModuleAccessFromFormData(formData);

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
  redirect(`/admin/users?created=${Date.now()}`);
}

async function updateUserAccess(formData: FormData) {
  "use server";
  const session = await requireAdminSession();
  await requireModuleAccess("user-admin");
  await ensureTransportEnhancements();

  const userId = Number(formData.get("userId"));
  const role = String(formData.get("role")) as "admin" | "dispatcher" | "fuel_manager" | "viewer" | "updater";
  const moduleAccess = parseModuleAccessFromFormData(formData);
  if (!userId) return;
  if (userId === session.id && role !== "admin") {
    redirect("/admin/users?error=self-demote");
  }

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
  redirect(`/admin/users?updated=${Date.now()}`);
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function deleteUser(formData: FormData) {
  "use server";
  const session = await requireAdminSession();
  await requireModuleAccess("user-admin");
  await ensureTransportEnhancements();
  const userId = Number(formData.get("userId"));
  if (!userId) return;
  if (userId === session.id) {
    redirect("/admin/users?error=self-delete");
  }

  let deleted = false;
  try {
    deleted = await withTransaction(async (client) => {
      const references = await client.query<{
        schema_name: string;
        table_name: string;
        column_name: string;
        is_not_null: boolean;
      }>(
        `SELECT ns.nspname AS schema_name, tbl.relname AS table_name, att.attname AS column_name, att.attnotnull AS is_not_null
         FROM pg_constraint con
         JOIN pg_class tbl ON tbl.oid = con.conrelid
         JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
         JOIN unnest(con.conkey) AS ck(attnum) ON TRUE
         JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ck.attnum
         WHERE con.contype = 'f' AND con.confrelid = 'users'::regclass`,
      );

      for (const ref of references.rows) {
        if (ref.table_name === "users") continue;
        const table = `${quoteIdentifier(ref.schema_name)}.${quoteIdentifier(ref.table_name)}`;
        const column = quoteIdentifier(ref.column_name);
        if (ref.is_not_null) {
          const dependent = await client.query<{ total: string }>(
            `SELECT COUNT(*)::text AS total FROM ${table} WHERE ${column} = $1`,
            [userId],
          );
          if (Number(dependent.rows[0]?.total ?? "0") > 0) {
            throw new Error(`cannot_delete_due_to_dependency:${ref.table_name}`);
          }
          continue;
        }
        await client.query(`UPDATE ${table} SET ${column} = NULL WHERE ${column} = $1`, [userId]);
      }

      const deleteResult = await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      return (deleteResult.rowCount ?? 0) > 0;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("cannot_delete_due_to_dependency:")) {
      redirect("/admin/users?error=dependency");
    }
    throw error;
  }
  if (!deleted) {
    redirect("/admin/users?error=notfound");
  }

  await logAuditEvent({
    session,
    action: "delete",
    entityType: "user",
    entityId: userId,
  });
  revalidatePath("/admin/users");
  redirect(`/admin/users?deleted=${Date.now()}`);
}

async function updateAiScannerSetting(formData: FormData) {
  "use server";
  const session = await requireAdminSession();
  await requireModuleAccess("user-admin");
  await ensureTransportEnhancements();
  const enabled = String(formData.get("enabled")) === "true";
  await setAiScannerEnabled(enabled);
  await logAuditEvent({
    session,
    action: "update",
    entityType: "app_setting",
    details: { key: "ai_scanner_enabled", enabled },
  });
  revalidatePath("/admin/users");
  revalidatePath("/drivers");
  redirect(`/admin/users?ai=${enabled ? "enabled" : "disabled"}`);
}

type Props = {
  searchParams: Promise<{ created?: string; updated?: string; deleted?: string; error?: string; export?: string; ai?: string }>;
};

export default async function UsersAdminPage(props: Props) {
  await requireAdminSession();
  await requireModuleAccess("user-admin");
  await ensureTransportEnhancements();
  const searchParams = await props.searchParams;
  const [users, aiEnabled] = await Promise.all([
    query<{
    id: number;
    full_name: string;
    email: string;
    role: string;
    module_access: string[] | null;
    is_active: boolean;
    }>(`SELECT id, full_name, email, role::text, module_access, is_active FROM users ORDER BY id DESC`),
    getAiScannerEnabled(),
  ]);
  const editableModules = APP_MODULES.filter((module) => module !== "user-admin");

  return (
    <AppShell>
      <EnterprisePageHeader
        title="User Access Control"
        subtitle="Admin managed users, roles and dashboard access"
        icon={KeyRound}
        tag="Admin"
        actions={
          <ModuleExportLauncher
            moduleKey="users"
            moduleLabel="Users"
            basePath="/admin/users"
            searchParams={{
              export: searchParams.export,
              created: searchParams.created,
              updated: searchParams.updated,
              deleted: searchParams.deleted,
              error: searchParams.error,
            }}
          />
        }
      />
      {searchParams.error === "duplicate" ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">User email already exists.</div> : null}
      {searchParams.error === "self-demote" ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">You cannot remove your own admin role.</div> : null}
      {searchParams.error === "self-delete" ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">You cannot delete your own account.</div> : null}
      {searchParams.error === "notfound" ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">User not found.</div> : null}
      {searchParams.error === "dependency" ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">User cannot be deleted because dependent records require this user reference.</div> : null}
      {searchParams.created ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">User created successfully.</div> : null}
      {searchParams.updated ? <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">User access updated successfully. User must sign out and sign in again to load latest permissions.</div> : null}
      {searchParams.deleted ? <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">User deleted permanently.</div> : null}
      {searchParams.ai === "enabled" ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">AI is enabled</div> : null}
      {searchParams.ai === "disabled" ? <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">AI is disabled</div> : null}
      <Card className="mb-4">
        <CardHeader><CardTitle>AI Controls</CardTitle></CardHeader>
        <CardContent>
          <form action={updateAiScannerSetting} className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Driver Scanner OCR is currently <span className="font-semibold">{aiEnabled ? "enabled" : "disabled"}</span>.
            </p>
            <input type="hidden" name="enabled" value={aiEnabled ? "false" : "true"} />
            <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">
              {aiEnabled ? "Disable AI" : "Enable AI"}
            </button>
          </form>
        </CardContent>
      </Card>
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
                <option value="updater">updater</option>
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
                    {(() => {
                      const normalizedModules = normalizeModuleAccess(user.module_access, user.role as "admin" | "dispatcher" | "fuel_manager" | "viewer" | "updater");
                      return (
                        <>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{normalizedModules.join(", ") || "-"}</TableCell>
                    <TableCell>{user.is_active ? "active" : "inactive"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-start justify-end gap-2">
                        <form action={updateUserAccess} className="grid gap-2 rounded border p-2 text-left">
                          <input type="hidden" name="userId" value={user.id} />
                          <select name="role" defaultValue={user.role} className="h-8 rounded border border-input bg-transparent px-2 text-xs">
                            <option value="admin">admin</option>
                            <option value="dispatcher">dispatcher</option>
                            <option value="fuel_manager">fuel_manager</option>
                            <option value="viewer">viewer</option>
                            <option value="updater">updater</option>
                          </select>
                          <div className="grid max-w-[260px] grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            {editableModules.map((module) => (
                              <label key={`${user.id}-${module}`} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  name="moduleAccess"
                                  value={module}
                                  defaultChecked={normalizedModules.includes(module)}
                                />
                                {module}
                              </label>
                            ))}
                          </div>
                          <button className="h-8 rounded bg-primary px-2 text-xs text-primary-foreground">Update Access</button>
                        </form>
                        <form action={deleteUser}>
                          <input type="hidden" name="userId" value={user.id} />
                          <ConfirmSubmitButton label="Delete" message="Delete this user permanently?" className="text-red-600 hover:underline" />
                        </form>
                      </div>
                    </TableCell>
                        </>
                      );
                    })()}
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
