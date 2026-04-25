import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { getAiScannerEnabled } from "@/lib/app-settings";
import { getUploadedFileBuffer, isUploadLikeFile } from "@/lib/document-storage";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { extractDriverIntakeFromScan } from "@/lib/driver-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("drivers");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureTransportEnhancements();
  const aiEnabled = await getAiScannerEnabled();
  if (!aiEnabled) {
    return NextResponse.json({ error: "AI is disabled" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!isUploadLikeFile(file) || file.size === 0) {
      return NextResponse.json({ error: "Upload a valid PDF/JPG/PNG file." }, { status: 400 });
    }

    const uploaded = await getUploadedFileBuffer(file);
    const extracted = await extractDriverIntakeFromScan({
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      data: uploaded.data,
    });
    return NextResponse.json(extracted);
  } catch (error) {
    console.error("Driver OCR intake failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR extraction failed." },
      { status: 500 },
    );
  }
}
