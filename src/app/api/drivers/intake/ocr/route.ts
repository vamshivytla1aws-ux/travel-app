import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { getOcrMode, getUserCanUseOcr } from "@/lib/app-settings";
import { getUploadedFileBuffer, isUploadLikeFile } from "@/lib/document-storage";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";
import { extractDriverIntakeFromScan, extractDriverIntakeFromScanNonAI } from "@/lib/driver-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTimeoutLikeError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? "");
  const stack = String((error as { stack?: string })?.stack ?? "");
  return (
    message.includes("UND_ERR_HEADERS_TIMEOUT") ||
    message.toLowerCase().includes("headers timeout") ||
    message.toLowerCase().includes("fetch failed") ||
    stack.includes("UND_ERR_HEADERS_TIMEOUT")
  );
}

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
    let extracted;
    if (mode === "ai") {
      try {
        extracted = await extractDriverIntakeFromScan({
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          data: uploaded.data,
        });
      } catch (aiError) {
        if (!isTimeoutLikeError(aiError)) throw aiError;
        // Graceful fallback: keep import working when upstream AI response times out.
        const fallback = await extractDriverIntakeFromScanNonAI({
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          data: uploaded.data,
        });
        extracted = {
          ...fallback,
          unmappedText:
            `${fallback.unmappedText ?? ""}\n\n[Notice] AI OCR timed out, imported using Non-AI OCR fallback.`.trim(),
        };
      }
    } else {
      extracted = await extractDriverIntakeFromScanNonAI({
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        data: uploaded.data,
      });
    }
    return NextResponse.json(extracted);
  } catch (error) {
    console.error("Driver OCR intake failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OCR extraction failed." },
      { status: 500 },
    );
  }
}
