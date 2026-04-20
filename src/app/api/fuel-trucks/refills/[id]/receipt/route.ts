import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { query } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, props: Params) {
  const session = await requireApiModuleAccess("fuel-truck");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await ensureTransportEnhancements();

  const { id } = await props.params;
  const refillId = Number(id);
  if (!refillId) {
    return NextResponse.json({ error: "Invalid refill id" }, { status: 400 });
  }

  const result = await query<{
    receipt_file_name: string | null;
    receipt_mime_type: string | null;
    receipt_data: Buffer | null;
  }>(
    `SELECT receipt_file_name, receipt_mime_type, receipt_data
     FROM fuel_truck_refills
     WHERE id = $1`,
    [refillId],
  );

  const refill = result.rows[0];
  if (!refill || !refill.receipt_data) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const binary = new Uint8Array(refill.receipt_data);
  return new NextResponse(binary, {
    headers: {
      "Content-Type": refill.receipt_mime_type ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${refill.receipt_file_name ?? "receipt"}"`,
    },
  });
}

