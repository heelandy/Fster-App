import { describe, it, expect } from 'vitest';
import { encryptString, decryptString, isEncrypted, encryptBytes, decryptBytes } from './crypto';

describe('field encryption', () => {
  it('round-trips a string and produces ciphertext that differs from plaintext', () => {
    const plain = 'CASE-1024 / sensitive note';
    const enc = encryptString(plain);
    expect(enc).not.toBe(plain);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptString(enc)).toBe(plain);
  });

  it('uses a random IV (same input -> different ciphertext)', () => {
    expect(encryptString('x')).not.toBe(encryptString('x'));
  });

  it('passes through plaintext on decrypt (safe incremental migration)', () => {
    expect(decryptString('not-encrypted')).toBe('not-encrypted');
    expect(isEncrypted('not-encrypted')).toBe(false);
  });

  it('round-trips binary file bytes and passes through unencrypted bytes', () => {
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 255]);
    const enc = encryptBytes(data);
    expect(enc.equals(data)).toBe(false);
    expect(decryptBytes(enc).equals(data)).toBe(true);
    expect(decryptBytes(data).equals(data)).toBe(true); // passthrough
  });
});
