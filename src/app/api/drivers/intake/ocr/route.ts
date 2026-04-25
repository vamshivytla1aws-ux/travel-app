import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { getOcrMode, getUserCanUseOcr } from "@/lib/app-settings";
import { getUploadedFileBuffer, isUploadLikeFile } from "@/lib/document-storage";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { extractDriverIntakeFromScan, extractDriverIntakeFromScanNonAI } from "@/lib/driver-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("drivers");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureTransportEnhancements();
  const canUseOcr = session.role === "admin" ? true : await getUserCanUseOcr(session.id);
  if (!canUseOcr) {
    return NextResponse.json({ error: "OCR access is not granted for this user." }, { status: 403 });
  }
  const mode = await getOcrMode();

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!isUploadLikeFile(file) || file.size === 0) {
      return NextResponse.json({ error: "Upload a valid PDF/JPG/PNG file." }, { status: 400 });
    }

    const uploaded = await getUploadedFileBuffer(file);
    const extracted =
      mode === "ai"
        ? await extractDriverIntakeFromScan({
            fileName: uploaded.fileName,
            mimeType: uploaded.mimeType,
            data: uploaded.data,
          })
        : await extractDriverIntakeFromScanNonAI({
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
