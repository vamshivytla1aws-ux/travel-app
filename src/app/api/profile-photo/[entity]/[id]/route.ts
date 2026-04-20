import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { normalizeProfilePhotoMime } from "@/lib/image-mime";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";

type Params = {
  params: Promise<{ entity: string; id: string }>;
};

export async function GET(_request: Request, props: Params) {
  const { entity, id } = await props.params;
  const entityId = Number(id);
  if (!entityId || (entity !== "driver" && entity !== "employee")) {
    return NextResponse.json({ error: "Invalid photo request" }, { status: 400 });
  }
  const session = await requireApiModuleAccess(entity === "driver" ? "drivers" : "employees");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await ensureTransportEnhancements();

  const table = entity === "driver" ? "drivers" : "employees";
  const result = await query<{
    profile_photo_name: string | null;
    profile_photo_mime: string | null;
    profile_photo_data: Buffer | null;
  }>(
    `SELECT profile_photo_name, profile_photo_mime, profile_photo_data
     FROM ${table}
     WHERE id = $1`,
    [entityId],
  );
  const row = result.rows[0];
  if (!row?.profile_photo_data) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const contentType = normalizeProfilePhotoMime(row.profile_photo_name ?? "", row.profile_photo_mime);

  return new NextResponse(new Uint8Array(row.profile_photo_data), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${row.profile_photo_name ?? "profile-photo"}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
