/**
 * Browsers often omit `File.type` for HEIC/phone uploads, defaulting to empty → stored as octet-stream.
 * Infer a usable image/* MIME from the filename; used for profile photos and API responses.
 */
export function inferImageMimeFromFileName(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    tif: "image/tiff",
    tiff: "image/tiff",
    heic: "image/heic",
    heif: "image/heic",
    avif: "image/avif",
  };
  return map[ext] ?? null;
}

export function normalizeProfilePhotoMime(fileName: string, reportedMime: string | null | undefined): string {
  const trimmed = (reportedMime ?? "").trim();
  const raw = trimmed.toLowerCase();
  if (raw && raw !== "application/octet-stream" && raw.startsWith("image/")) {
    return trimmed;
  }
  return inferImageMimeFromFileName(fileName) ?? "application/octet-stream";
}
