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

type OCRResult = {
  prefill: Partial<Record<DriverIntakeFieldKey, string>>;
  confidence: Partial<Record<DriverIntakeFieldKey, number>>;
  unmappedText: string;
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
}): Promise<OCRResult> {
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

function normalizeFreeText(input: string) {
  return input
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractLabelValue(text: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escaped}\\s*[:\\-]?\\s*([^\\n]{2,120})`, "i");
    const match = text.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function extractFirstByRegex(text: string, regex: RegExp): string {
  const match = text.match(regex);
  return match?.[1]?.trim() ?? "";
}

function mapLocalTextToDriverFields(rawText: string): {
  prefill: Record<string, string>;
  confidence: Record<string, number>;
  unmappedText: string;
} {
  const text = normalizeFreeText(rawText);
  const prefill: Record<string, string> = {};
  const confidence: Record<string, number> = {};

  const mappings: Array<{ key: DriverIntakeFieldKey; labels?: string[]; regex?: RegExp; conf: number }> = [
    { key: "fullName", labels: ["Driver Name", "Name"], conf: 0.8 },
    { key: "phone", labels: ["Contact No", "Contact Number", "Mobile"], conf: 0.8 },
    { key: "bloodGroup", labels: ["Blood Group"], conf: 0.85 },
    { key: "fatherName", labels: ["Father's Name", "Fathers Name"], conf: 0.85 },
    { key: "fatherContact", labels: ["Contact Number (Father)", "Father Contact"], conf: 0.8 },
    { key: "motherName", labels: ["Mother's Name", "Mothers Name"], conf: 0.85 },
    { key: "motherContact", labels: ["Contact Number (Mother)", "Mother Contact"], conf: 0.8 },
    { key: "spouseName", labels: ["Spouse Name"], conf: 0.85 },
    { key: "spouseContact", labels: ["Contact Number (Spouse)", "Spouse Contact"], conf: 0.8 },
    { key: "child1Name", labels: ["Children's (1)", "Children 1"], conf: 0.75 },
    { key: "child2Name", labels: ["Children's (2)", "Children 2"], conf: 0.75 },
    { key: "panOrVoterId", labels: ["PAN Card No / Voter ID", "PAN", "Voter ID"], conf: 0.85 },
    { key: "aadhaarNo", labels: ["Aadhaar No", "Aadhar No"], conf: 0.9 },
    { key: "bankAccountNumber", labels: ["Bank Account No"], conf: 0.8 },
    { key: "bankName", labels: ["Name of the Bank", "Bank Name"], conf: 0.8 },
    { key: "bankIfsc", labels: ["IFSC No", "IFSC"], conf: 0.85 },
    { key: "pfAccountNumber", labels: ["PF Account No", "EPF"], conf: 0.75 },
    { key: "uanNumber", labels: ["UAN No", "UAN"], conf: 0.75 },
    { key: "esicNumber", labels: ["ESIC No", "ESIC"], conf: 0.75 },
    { key: "vehicleRegistrationNo", labels: ["Vehicles No", "Vehicle Registration", "Vehicle No"], conf: 0.8 },
    { key: "presentReadingKm", labels: ["Present Reading"], conf: 0.75 },
    { key: "licenseNumber", labels: ["Driving License No", "DL No"], conf: 0.9 },
    { key: "licenseExpiry", labels: ["Validity (DL)", "DL Validity"], conf: 0.85 },
    { key: "badgeNo", labels: ["Badge No"], conf: 0.85 },
    { key: "badgeValidity", labels: ["Validity (Badge)", "Badge Validity"], conf: 0.85 },
    { key: "education", labels: ["Education"], conf: 0.8 },
    { key: "experienceYears", labels: ["Experience"], conf: 0.75 },
    { key: "dateOfBirth", labels: ["Date of Birth", "DOB"], conf: 0.85 },
    { key: "maritalStatus", labels: ["Marital Status"], conf: 0.8 },
    { key: "religion", labels: ["Religion"], conf: 0.75 },
    { key: "presentVillage", labels: ["Present Village", "Village"], conf: 0.7 },
    { key: "presentLandmark", labels: ["Present Land Mark", "Land Mark"], conf: 0.7 },
    { key: "presentPostOffice", labels: ["Present Post Office", "Post Office"], conf: 0.7 },
    { key: "presentMandal", labels: ["Present Mandal", "Mandal"], conf: 0.7 },
    { key: "presentPoliceStation", labels: ["Present Police Station", "Police Station"], conf: 0.7 },
    { key: "presentDistrict", labels: ["Present District", "District"], conf: 0.7 },
    { key: "presentState", labels: ["Present State", "State"], conf: 0.7 },
    { key: "presentPinCode", labels: ["Present Pin Code No", "Pin Code"], conf: 0.7 },
    { key: "permanentVillage", labels: ["Permanent Village"], conf: 0.7 },
    { key: "permanentLandmark", labels: ["Permanent Land Mark"], conf: 0.7 },
    { key: "permanentPostOffice", labels: ["Permanent Post Office"], conf: 0.7 },
    { key: "permanentMandal", labels: ["Permanent Mandal"], conf: 0.7 },
    { key: "permanentPoliceStation", labels: ["Permanent Police Station"], conf: 0.7 },
    { key: "permanentDistrict", labels: ["Permanent District"], conf: 0.7 },
    { key: "permanentState", labels: ["Permanent State"], conf: 0.7 },
    { key: "permanentPinCode", labels: ["Permanent Pin Code No"], conf: 0.7 },
    { key: "reference1Name", labels: ["Reference 1 – Person Name", "Reference 1"], conf: 0.75 },
    { key: "reference1Relationship", labels: ["Relationship with Person (Ref 1)"], conf: 0.75 },
    { key: "reference1Contact", labels: ["Contact No (Ref 1)"], conf: 0.75 },
    { key: "reference2Name", labels: ["Reference 2 – Person Name", "Reference 2"], conf: 0.75 },
    { key: "reference2Relationship", labels: ["Relationship with Person (Ref 2)"], conf: 0.75 },
    { key: "reference2Contact", labels: ["Contact No (Ref 2)"], conf: 0.75 },
    { key: "presentSalary", labels: ["Present Salary"], conf: 0.8 },
    { key: "salaryExpectation", labels: ["Salary Expectation"], conf: 0.8 },
    { key: "salaryOffered", labels: ["Salary Offered"], conf: 0.8 },
    { key: "joiningDate", labels: ["Joining Date"], conf: 0.85 },
    { key: "candidateSignatureText", labels: ["Candidate Signature / Date", "Candidate Signature"], conf: 0.7 },
    { key: "appointeeSignatureText", labels: ["Signature of Appointee"], conf: 0.7 },
    { key: "approvalAuthoritySignatureText", labels: ["Signature of Approval Authority"], conf: 0.7 },
    { key: "vehicleRegistrationNo", regex: /\b([A-Z]{2}\s?\d{1,2}[A-Z]{1,3}\d{3,4})\b/i, conf: 0.65 },
    { key: "phone", regex: /\b(\d{10,15})\b/, conf: 0.6 },
    { key: "aadhaarNo", regex: /\b(\d{12})\b/, conf: 0.6 },
  ];

  for (const map of mappings) {
    if (prefill[map.key]) continue;
    const rawValue = map.labels ? extractLabelValue(text, map.labels) : extractFirstByRegex(text, map.regex!);
    if (!rawValue) continue;
    prefill[map.key] = rawValue;
    confidence[map.key] = map.conf;
  }

  return {
    prefill,
    confidence,
    unmappedText: text.slice(0, 2000),
  };
}

async function extractTextWithNonAiEngine(input: {
  fileName: string;
  mimeType: string;
  data: Buffer;
}): Promise<string> {
  const mime = input.mimeType.toLowerCase();
  if (mime === "application/pdf") {
    // Avoid browser-dependent PDF parsers in Node server runtime (DOMMatrix errors on some hosts).
    // Best-effort text extraction from PDF content streams for text-based PDFs only.
    const latin = input.data.toString("latin1");
    const tokens: string[] = [];
    const re = /\(([^)]{2,})\)\s*Tj|\[([\s\S]*?)\]\s*TJ/gm;
    let match: RegExpExecArray | null;
    while ((match = re.exec(latin)) !== null) {
      if (match[1]) {
        tokens.push(match[1]);
      } else if (match[2]) {
        const nested = match[2].match(/\(([^)]{1,})\)/g) ?? [];
        nested.forEach((chunk) => tokens.push(chunk.slice(1, -1)));
      }
    }
    const text = tokens
      .join(" ")
      .replace(/\\[nrtbf()\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length >= 20) return text;
    throw new Error(
      "Non-AI OCR cannot reliably read this PDF scan. Upload JPG/PNG image or switch OCR mode to AI OCR for PDF.",
    );
  }

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(input.data);
    return String(result.data?.text ?? "").trim();
  } finally {
    await worker.terminate();
  }
}

export async function extractDriverIntakeFromScanNonAI(input: {
  fileName: string;
  mimeType: string;
  data: Buffer;
}): Promise<OCRResult> {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType.toLowerCase())) {
    throw new Error("Unsupported file format. Use pdf/jpg/jpeg/png/webp.");
  }
  if (input.data.byteLength <= 0) throw new Error("Uploaded file is empty.");
  if (input.data.byteLength > MAX_OCR_FILE_BYTES) {
    throw new Error("Uploaded file is too large. Maximum allowed is 20MB.");
  }

  const rawText = await extractTextWithNonAiEngine(input);
  if (!rawText) throw new Error("No text was detected by non-AI OCR.");

  const mapped = mapLocalTextToDriverFields(rawText);
  const prefill = sanitizePrefill(mapped.prefill);
  const linkedPrefill = await applyBusLinkage(prefill);
  const confidence = sanitizeConfidence(mapped.confidence);

  return {
    prefill: linkedPrefill as Partial<Record<DriverIntakeFieldKey, string>>,
    confidence: confidence as Partial<Record<DriverIntakeFieldKey, number>>,
    unmappedText: mapped.unmappedText,
  };
}
