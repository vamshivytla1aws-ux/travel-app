import { query } from "@/lib/db";
import {
  DRIVER_DATE_FIELDS,
  DRIVER_DIGIT_NORMALIZE_FIELDS,
  DRIVER_INTAKE_FIELDS,
  DRIVER_NUMERIC_FIELDS,
  type DriverIntakeFieldKey,
} from "@/lib/driver-intake-schema";

type OCRExtractionPayload = {
  prefill?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
  unmappedText?: unknown;
};

const MAX_OCR_FILE_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
}

function normalizeDateValue(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${month}-${day}`;
  }
  return "";
}

function normalizeDigits(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function normalizeNumeric(raw: string): string {
  const cleaned = raw.replace(/[^0-9.\-]/g, "").trim();
  if (!cleaned) return "";
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return "";
  return String(parsed);
}

function normalizeRegistration(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sanitizePrefill(prefill: Record<string, unknown>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const key of DRIVER_INTAKE_FIELDS) {
    const raw = prefill[key];
    const asText = String(raw ?? "").trim();
    if (!asText) continue;
    if (DRIVER_DATE_FIELDS.has(key)) {
      const normalizedDate = normalizeDateValue(asText);
      if (normalizedDate) safe[key] = normalizedDate;
      continue;
    }
    if (DRIVER_NUMERIC_FIELDS.has(key)) {
      const normalizedNumber = normalizeNumeric(asText);
      if (normalizedNumber) safe[key] = normalizedNumber;
      continue;
    }
    if (DRIVER_DIGIT_NORMALIZE_FIELDS.has(key)) {
      const normalizedDigits = normalizeDigits(asText);
      safe[key] = normalizedDigits || asText;
      continue;
    }
    safe[key] = asText;
  }
  return safe;
}

function sanitizeConfidence(confidence: Record<string, unknown>): Record<string, number> {
  const safe: Record<string, number> = {};
  for (const key of DRIVER_INTAKE_FIELDS) {
    const value = Number(confidence[key]);
    if (!Number.isFinite(value)) continue;
    const bounded = Math.max(0, Math.min(1, value));
    safe[key] = bounded;
  }
  return safe;
}

function getResponseOutputText(payload: Record<string, unknown>): string {
  const direct = payload.output_text;
  if (typeof direct === "string" && direct.trim()) return direct;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? ((item as { content: unknown[] }).content)
      : [];
    for (const chunk of content) {
      if (!chunk || typeof chunk !== "object") continue;
      const textValue =
        (chunk as { text?: unknown }).text ??
        (chunk as { output_text?: unknown }).output_text;
      if (typeof textValue === "string" && textValue.trim()) return textValue;
    }
  }
  return "";
}

async function applyBusLinkage(prefill: Record<string, string>) {
  const registrationRaw = prefill.vehicleRegistrationNo;
  if (!registrationRaw) return prefill;
  const normalized = normalizeRegistration(registrationRaw);
  if (!normalized) return prefill;

  const matched = await query<{ id: number; registration_number: string; odometer_km: string }>(
    `SELECT id, registration_number, odometer_km::text
     FROM buses
     WHERE regexp_replace(upper(registration_number), '[^A-Z0-9]', '', 'g') = $1
     LIMIT 1`,
    [normalized],
  );
  const row = matched.rows[0];
  if (!row) return prefill;
  return {
    ...prefill,
    vehicleBusId: String(row.id),
    vehicleRegistrationNo: row.registration_number,
    presentReadingKm: prefill.presentReadingKm?.trim()
      ? prefill.presentReadingKm
      : String(Number(row.odometer_km)),
  };
}

function buildPrompt() {
  return `
Extract driver intake fields from the uploaded scanner document.
Return STRICT JSON only with this shape:
{
  "prefill": { "<fieldName>": "<string value>" },
  "confidence": { "<fieldName>": 0.0_to_1.0 },
  "unmappedText": "<important leftover text>"
}

Use only these field names:
${DRIVER_INTAKE_FIELDS.join(", ")}

Rules:
- Provide values as plain strings.
- Dates can be dd-mm-yyyy or dd/mm/yyyy or yyyy-mm-dd.
- If a field is missing, omit it from "prefill".
- "confidence" should contain only mapped fields.
- Do not invent values.
- Do not include markdown.
  `.trim();
}

export async function extractDriverIntakeFromScan(input: {
  fileName: string;
  mimeType: string;
  data: Buffer;
}) {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType.toLowerCase())) {
    throw new Error("Unsupported file format. Use pdf/jpg/jpeg/png/webp.");
  }
  if (input.data.byteLength <= 0) throw new Error("Uploaded file is empty.");
  if (input.data.byteLength > MAX_OCR_FILE_BYTES) {
    throw new Error("Uploaded file is too large. Maximum allowed is 20MB.");
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_OCR_MODEL || "gpt-4.1-mini";
  const base64Data = input.data.toString("base64");
  const contentItem =
    input.mimeType.toLowerCase() === "application/pdf"
      ? {
          type: "input_file",
          filename: input.fileName || "driver-scan.pdf",
          file_data: `data:application/pdf;base64,${base64Data}`,
        }
      : {
          type: "input_image",
          image_url: `data:${input.mimeType};base64,${base64Data}`,
        };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildPrompt() }],
        },
        {
          role: "user",
          content: [contentItem],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OCR extraction failed: ${response.status} ${errText}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const outputText = getResponseOutputText(payload);
  if (!outputText) throw new Error("No text was returned from OCR extraction.");

  let parsed: OCRExtractionPayload = {};
  try {
    parsed = JSON.parse(stripJsonFence(outputText)) as OCRExtractionPayload;
  } catch {
    throw new Error("OCR response was not valid JSON.");
  }

  const prefill = sanitizePrefill(
    parsed.prefill && typeof parsed.prefill === "object"
      ? (parsed.prefill as Record<string, unknown>)
      : {},
  );
  const linkedPrefill = await applyBusLinkage(prefill);
  const confidence = sanitizeConfidence(
    parsed.confidence && typeof parsed.confidence === "object"
      ? (parsed.confidence as Record<string, unknown>)
      : {},
  );
  const unmappedText =
    typeof parsed.unmappedText === "string" ? parsed.unmappedText.trim() : "";

  return {
    prefill: linkedPrefill as Partial<Record<DriverIntakeFieldKey, string>>,
    confidence: confidence as Partial<Record<DriverIntakeFieldKey, number>>,
    unmappedText,
  };
}

