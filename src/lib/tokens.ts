import { createHash, randomBytes } from 'crypto';

/**
 * Opaque single-use tokens for password reset and household invites.
 *
 * The raw token is sent to the user (email link); only its SHA-256 hash is
 * persisted, so a database leak does not expose usable tokens. Lookups hash the
 * presented token and match by the indexed `tokenHash` column.
 */

export function generateToken(bytes = 32): { raw: string; hash: string } {
  const raw = randomBytes(bytes).toString('base64url');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
