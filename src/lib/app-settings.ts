import { query } from "@/lib/db";

const AI_SCANNER_KEY = "ai_scanner_enabled";

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

