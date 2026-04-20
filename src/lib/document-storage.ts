import { query } from "@/lib/db";

export async function getUploadedFileBuffer(file: File): Promise<{
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
}> {
  const bytes = await file.arrayBuffer();
  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    data: Buffer.from(bytes),
  };
}

export async function ensureDocumentTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS bus_documents (
      id BIGSERIAL PRIMARY KEY,
      bus_id BIGINT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
      document_type VARCHAR(60) NOT NULL,
      document_name VARCHAR(160) NOT NULL,
      file_url TEXT,
      file_name VARCHAR(255),
      mime_type VARCHAR(120),
      file_size_bytes INTEGER,
      file_data BYTEA,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS driver_documents (
      id BIGSERIAL PRIMARY KEY,
      driver_id BIGINT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      document_type VARCHAR(60) NOT NULL,
      document_name VARCHAR(160) NOT NULL,
      file_url TEXT,
      file_name VARCHAR(255),
      mime_type VARCHAR(120),
      file_size_bytes INTEGER,
      file_data BYTEA,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE bus_documents
      ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120),
      ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
      ADD COLUMN IF NOT EXISTS file_data BYTEA;
  `);

  await query(`
    ALTER TABLE driver_documents
      ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120),
      ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
      ADD COLUMN IF NOT EXISTS file_data BYTEA;
  `);

  // Backward compatibility: older schemas used file_url as required.
  // Current uploads store binary data in file_data and may leave file_url empty.
  await query(`ALTER TABLE bus_documents ALTER COLUMN file_url DROP NOT NULL;`);
  await query(`ALTER TABLE driver_documents ALTER COLUMN file_url DROP NOT NULL;`);
}
