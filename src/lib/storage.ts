import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from './env';
import { encryptBytes, decryptBytes } from './crypto';
import { s3Configured, s3Put, s3Get, s3Delete } from './storage-s3';

/**
 * Private, access-controlled file storage.
 *
 * Files are stored under a random, unguessable storage key and are never served
 * by a static URL — only through the authenticated `/api/files/[id]` route after
 * an ownership + permission check. The backend is pluggable via STORAGE_DRIVER:
 *   - "local" (default): private disk dir, OUTSIDE Next's `/public`.
 *   - "s3": S3-compatible object storage (AWS S3 / Cloudflare R2) — required on
 *     serverless/multi-instance hosts where the local disk is ephemeral.
 * Bytes are AES-256-GCM encrypted by the app before they reach either backend.
 */

const STORAGE_ROOT = path.resolve(process.cwd(), env.FILE_STORAGE_DIR);
const USE_S3 = s3Configured();

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_TYPES.has(mime);
}

// Storage keys we mint are always "<2 hex>/<48 hex>". Reject anything else so a
// tampered key can't reach unexpected objects (S3) or paths (local).
function assertSafeKey(storageKey: string): void {
  if (!/^[0-9a-f]{2}\/[0-9a-f]{48}$/.test(storageKey)) {
    throw new Error('Invalid storage key.');
  }
}

/** Resolve a storage key to an absolute path, rejecting any path traversal. */
function resolveKey(storageKey: string): string {
  const resolved = path.resolve(STORAGE_ROOT, storageKey);
  const rel = path.relative(STORAGE_ROOT, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Invalid storage key (path traversal blocked).');
  }
  return resolved;
}

export interface SavedFile {
  storageKey: string;
  sizeBytes: number;
}

/**
 * Lightweight magic-byte check: returns true if the file's actual bytes clearly
 * contradict its declared MIME type (e.g. HTML/script disguised as an image or
 * PDF). This stops the client-supplied MIME from being trusted blindly.
 */
function contentContradictsMime(data: Buffer, mime: string): boolean {
  const head = data.subarray(0, 16);
  const startsWith = (...sig: number[]) => sig.every((b, i) => head[i] === b);

  // First non-whitespace / non-BOM byte — a leading '<' suggests HTML/SVG/XML.
  let firstByte = 0;
  for (let i = 0; i < Math.min(data.length, 64); i++) {
    const c = data[i];
    if (![0x20, 0x09, 0x0a, 0x0d, 0xef, 0xbb, 0xbf].includes(c)) {
      firstByte = c;
      break;
    }
  }
  const looksLikeMarkup = firstByte === 0x3c; // '<'

  switch (mime) {
    case 'application/pdf':
      return !startsWith(0x25, 0x50, 0x44, 0x46); // %PDF
    case 'image/png':
      return !startsWith(0x89, 0x50, 0x4e, 0x47); // \x89PNG
    case 'image/jpeg':
      return !(head[0] === 0xff && head[1] === 0xd8); // JPEG SOI
    case 'image/webp':
      return !startsWith(0x52, 0x49, 0x46, 0x46); // RIFF
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return !startsWith(0x50, 0x4b, 0x03, 0x04); // PK zip (docx/xlsx)
    case 'text/plain':
      return looksLikeMarkup; // a .txt that opens with '<' is likely HTML
    default:
      // Legacy Office (OLE) and HEIC vary too much to assert; allow.
      return false;
  }
}

export async function saveFile(data: Buffer, mimeType: string): Promise<SavedFile> {
  if (data.byteLength > env.MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds the maximum allowed size.');
  }
  if (!isAllowedMime(mimeType)) {
    throw new Error('File type is not allowed.');
  }
  if (contentContradictsMime(data, mimeType)) {
    throw new Error('File content does not match its declared type.');
  }
  // Shard by two-char prefix to avoid huge flat directories; random 32-byte key.
  const id = randomBytes(24).toString('hex');
  const storageKey = path.posix.join(id.slice(0, 2), id);
  // Encrypt the file bytes at rest; sizeBytes records the original (plaintext) size.
  const encrypted = encryptBytes(data);

  if (USE_S3) {
    await s3Put(storageKey, encrypted);
  } else {
    const dest = resolveKey(storageKey);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, encrypted, { mode: 0o600 });
  }
  return { storageKey, sizeBytes: data.byteLength };
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  if (USE_S3) {
    // Validate the key shape even for S3 (defence in depth against odd keys).
    assertSafeKey(storageKey);
    return decryptBytes(await s3Get(storageKey));
  }
  return decryptBytes(await readFile(resolveKey(storageKey)));
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  try {
    if (USE_S3) {
      assertSafeKey(storageKey);
      await s3Delete(storageKey);
    } else {
      await unlink(resolveKey(storageKey));
    }
  } catch {
    // Already gone — safe to ignore.
  }
}
