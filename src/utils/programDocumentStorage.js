import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROGRAM_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const PROGRAM_DOCUMENT_MIME = 'application/pdf';

const uploadsRoot = process.env.PROGRAM_DOCUMENTS_DIR
  || path.join(__dirname, '../../uploads/program-documents');

export function getProgramDocumentsDir() {
  return uploadsRoot;
}

export async function ensureProgramDocumentsDir() {
  await fs.mkdir(uploadsRoot, { recursive: true });
}

export function buildStoredFileName(programId, originalName = 'document.pdf') {
  const safeBase = String(originalName)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.pdf$/i, '')
    .slice(0, 80) || 'document';
  return `${programId}_${Date.now()}_${safeBase}.pdf`;
}

export function resolveStoredFilePath(storedName) {
  const base = path.basename(String(storedName || ''));
  return path.join(uploadsRoot, base);
}

export function programDocumentFromFile(file) {
  return {
    fileName: file.originalname,
    storedName: file.filename,
    mimeType: PROGRAM_DOCUMENT_MIME,
    fileSize: file.size,
  };
}

export async function deleteProgramDocumentFile(storedName) {
  if (!storedName) return;
  try {
    await fs.unlink(resolveStoredFilePath(storedName));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}
