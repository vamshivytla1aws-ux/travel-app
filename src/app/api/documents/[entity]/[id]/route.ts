import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { query } from "@/lib/db";

type Params = {
  params: Promise<{ entity: string; id: string }>;
};

export async function GET(request: Request, props: Params) {
  const { entity, id } = await props.params;
  const documentId = Number(id);
  if (!documentId || (entity !== "bus" && entity !== "driver")) {
    return NextResponse.json({ error: "Invalid document request" }, { status: 400 });
  }
  const session = await requireApiModuleAccess(entity === "bus" ? "buses" : "drivers");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await ensureTransportEnhancements();

  const table = entity === "bus" ? "bus_documents" : "driver_documents";
  const result = await query<{
    file_name: string | null;
    mime_type: string | null;
    file_data: Buffer | null;
    file_url: string | null;
  }>(
    `SELECT file_name, mime_type, file_data, file_url
     FROM ${table}
     WHERE id = $1`,
    [documentId],
  );

  const document = result.rows[0];
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (document.file_data) {
    const binary = new Uint8Array(document.file_data);
    return new NextResponse(binary, {
      headers: {
        "Content-Type": document.mime_type ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${document.file_name ?? "document"}"`,
      },
    });
  }

  if (document.file_url) {
    return NextResponse.redirect(new URL(document.file_url, request.url));
  }

  return NextResponse.json({ error: "Document file is empty" }, { status: 404 });
}
