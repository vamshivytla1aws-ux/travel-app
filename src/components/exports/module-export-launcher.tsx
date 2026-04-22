import Link from "next/link";
import { MODULE_EXPORT_FIELDS, type ExportModuleKey } from "@/lib/module-export";

type Props = {
  moduleKey: ExportModuleKey;
  moduleLabel: string;
  basePath: string;
  searchParams: Record<string, string | undefined>;
  defaultQuery?: string;
  defaultStatus?: string;
};

function buildHref(
  basePath: string,
  current: Record<string, string | undefined>,
  updates: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  const merged = { ...current, ...updates };
  for (const [key, value] of Object.entries(merged)) {
    if (!value) continue;
    params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function ModuleExportLauncher({
  moduleKey,
  moduleLabel,
  basePath,
  searchParams,
  defaultQuery = "",
  defaultStatus = "",
}: Props) {
  const fields = MODULE_EXPORT_FIELDS[moduleKey];
  const exportOpen = searchParams.export === "1";
  const openHref = buildHref(basePath, searchParams, { export: "1" });
  const closeHref = buildHref(basePath, searchParams, { export: undefined });

  return (
    <>
      <Link href={openHref} className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium">
        Export {moduleLabel} Data
      </Link>
      {exportOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-md border bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Export {moduleLabel} Data</h3>
              <Link href={closeHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">
                Close
              </Link>
            </div>
            <form action="/api/reports/export" method="get" target="_blank" className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="module" value={moduleKey} />
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Format</label>
                <select name="format" defaultValue="pdf" className="h-9 rounded-md border border-input px-3 text-sm">
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel (CSV)</option>
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Search</label>
                <input name="q" defaultValue={defaultQuery} className="h-9 rounded-md border border-input px-3 text-sm" />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <input name="status" defaultValue={defaultStatus} className="h-9 rounded-md border border-input px-3 text-sm" />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">From Date</label>
                <input name="from" type="date" className="h-9 rounded-md border border-input px-3 text-sm" />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">To Date</label>
                <input name="to" type="date" className="h-9 rounded-md border border-input px-3 text-sm" />
              </div>
              <div className="md:col-span-4 grid gap-2 rounded border p-3 md:grid-cols-3">
                {fields.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="field" value={field.key} defaultChecked />
                    {field.label}
                  </label>
                ))}
              </div>
              <div className="md:col-span-4">
                <button className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground">
                  Export
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

