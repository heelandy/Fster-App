import { describe, it, expect } from 'vitest';
import { qrSvgDataUrl } from './qr';
import { otpauthUri } from './totp';

describe('qrSvgDataUrl', () => {
  it('returns a self-contained SVG data URL (no external/network reference)', () => {
    const url = qrSvgDataUrl(otpauthUri('JBSWY3DPEHPK3PXP', 'parent@example.com'));
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = Buffer.from(url.slice('data:image/svg+xml;base64,'.length), 'base64').toString('utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox'); // scalable
    // Self-contained: modules are drawn inline (path/rect), with no external
    // <image> reference that could fetch the secret from a third party. The only
    // URL is the standard SVG xmlns (http://www.w3.org/2000/svg).
    expect(svg).toMatch(/<(path|rect)/);
    expect(svg).not.toContain('<image');
  });

  it('encodes a realistic full-length otpauth URI without throwing', () => {
    const long = otpauthUri('NB2W45DFOIZA' + 'JBSWY3DPEHPK3PXP'.repeat(2), 'a-very-long.foster.parent@example.org');
    const url = qrSvgDataUrl(long);
    expect(url.length).toBeGreaterThan(200);
  });
});
