import { query } from "@/lib/db";

const AI_SCANNER_KEY = "ai_scanner_enabled";
const OCR_MODE_KEY = "ocr_mode";
export type OCRMode = "ai" | "non_ai";

function normalizeOcrMode(value: string | null | undefined): OCRMode {
  if (value === "ai" || value === "non_ai") return value;
  // backward compatibility: old "disabled" now maps to non_ai mode
  return "non_ai";
}

export async function getOcrMode(): Promise<OCRMode> {
  const modeResult = await query<{ setting_value: string }>(
    `SELECT setting_value
     FROM app_settings
     WHERE setting_key = $1
     LIMIT 1`,
    [OCR_MODE_KEY],
  );
  if (modeResult.rows[0]) {
    return normalizeOcrMode(modeResult.rows[0].setting_value);
  }

  // Backward compatibility for existing ai_scanner_enabled flag.
  const legacy = await getAiScannerEnabled();
  return legacy ? "ai" : "non_ai";
}

export async function setOcrMode(mode: OCRMode): Promise<void> {
  await query(
    `INSERT INTO app_settings(setting_key, setting_value)
     VALUES($1, $2)
     ON CONFLICT (setting_key) DO UPDATE
     SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
    [OCR_MODE_KEY, mode],
  );
  // Keep legacy setting in sync.
  await setAiScannerEnabled(mode === "ai");
}

export async function getUserCanUseOcr(userId: number): Promise<boolean> {
  const result = await query<{ can_use_ocr: boolean }>(
    `SELECT COALESCE(can_use_ocr, false) AS can_use_ocr
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );
  return Boolean(result.rows[0]?.can_use_ocr);
}

export async function getAiScannerEnabled(): Promise<boolean> {
  const result = await query<{ setting_value: string }>(
    `SELECT setting_value
     FROM app_settings
     WHERE setting_key = $1
     LIMIT 1`,
    [AI_SCANNER_KEY],
  );
  if (!result.rows[0]) return false;
  return result.rows[0].setting_value === "true";
}

export async function setAiScannerEnabled(enabled: boolean): Promise<void> {
  await query(
    `INSERT INTO app_settings(setting_key, setting_value)
     VALUES($1, $2)
     ON CONFLICT (setting_key) DO UPDATE
     SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
    [AI_SCANNER_KEY, enabled ? "true" : "false"],
  );
}
