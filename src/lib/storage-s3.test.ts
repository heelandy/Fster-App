import { describe, it, expect } from 'vitest';
import { _internal } from './storage-s3';

describe('S3 SigV4 primitives', () => {
  it('sha256 of empty payload matches the universal constant', () => {
    expect(_internal.sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  // AWS documented vector: "Examples of how to derive a signing key for SigV4".
  it('derives the documented AWS signing key', () => {
    const key = _internal.deriveSigningKey(
      'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      '20150830',
      'us-east-1',
      'iam',
    );
    expect(key.toString('hex')).toBe(
      'c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9',
    );
  });
});
