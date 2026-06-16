import { describe, it, expect } from 'vitest';
import { generateToken, hashToken } from './tokens';

describe('opaque tokens', () => {
  it('hash matches the raw token', () => {
    const { raw, hash } = generateToken();
    expect(hashToken(raw)).toBe(hash);
  });

  it('is deterministic for the same input', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('produces unique tokens and hashes', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it('stores a hash, never the raw token', () => {
    const { raw, hash } = generateToken();
    expect(hash).not.toContain(raw);
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });
});
