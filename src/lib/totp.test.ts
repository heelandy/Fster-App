import { describe, it, expect } from 'vitest';
import { generateTotpSecret, verifyTotp, otpauthUri } from './totp';

// RFC 6238 test vector: ASCII secret "12345678901234567890" = Base32 below.
// At T=59s the SHA-1 TOTP is 94287082 → 6-digit truncation 287082.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP', () => {
  it('verifies the RFC 6238 reference code', () => {
    expect(verifyTotp(RFC_SECRET, '287082', 59)).toBe(true);
  });

  it('rejects an incorrect code', () => {
    expect(verifyTotp(RFC_SECRET, '000000', 59)).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(verifyTotp(RFC_SECRET, 'abcdef', 59)).toBe(false);
    expect(verifyTotp(RFC_SECRET, '12345', 59)).toBe(false);
  });

  it('accepts ±1 step of clock drift but not 2', () => {
    expect(verifyTotp(RFC_SECRET, '287082', 89)).toBe(true); // one step late
    expect(verifyTotp(RFC_SECRET, '287082', 119)).toBe(false); // two steps late
  });

  it('generates a usable Base32 secret and otpauth URI', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const uri = otpauthUri(secret, 'user@example.com');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(`secret=${secret}`);
  });
});
