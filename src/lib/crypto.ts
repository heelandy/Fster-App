import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from './env';

/**
 * Authenticated symmetric encryption (AES-256-GCM) for sensitive data at rest.
 *
 * - Strings: `encryptString` returns `enc:v1:<base64(iv|tag|ciphertext)>`.
 *   `decryptString` passes through any value that lacks the prefix, so existing
 *   plaintext rows keep working (safe, incremental migration).
 * - Files: `encryptBytes` prepends a 4-byte magic header; `decryptBytes` passes
 *   through files that lack it.
 *
 * The key is derived by SHA-256 over ENCRYPTION_KEY, so any passphrase length is
 * accepted while the AES key is always 32 bytes. IV is random per message.
 */

const KEY = createHash('sha256').update(env.ENCRYPTION_KEY).digest(); // 32 bytes
const STR_PREFIX = 'enc:v1:';
const FILE_MAGIC = Buffer.from('FCE1', 'ascii');
const IV_LEN = 12;
const TAG_LEN = 16;

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(STR_PREFIX);
}

export function encryptString(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return STR_PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptString(value: string): string {
  if (!isEncrypted(value)) return value; // plaintext passthrough
  const raw = Buffer.from(value.slice(STR_PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function encryptBytes(data: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([FILE_MAGIC, iv, tag, ct]);
}

export function decryptBytes(data: Buffer): Buffer {
  if (data.length < FILE_MAGIC.length || !data.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) {
    return data; // not encrypted — passthrough
  }
  const body = data.subarray(FILE_MAGIC.length);
  const iv = body.subarray(0, IV_LEN);
  const tag = body.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = body.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}
