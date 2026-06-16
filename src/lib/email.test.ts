import { describe, it, expect } from 'vitest';
import { escapeHtml } from './email';

describe('escapeHtml (email injection guard)', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<a href="x">hi</a>')).toBe('&lt;a href=&quot;x&quot;&gt;hi&lt;/a&gt;');
  });

  it('escapes ampersands first (no double-encoding artifacts)', () => {
    expect(escapeHtml('Tom & Jerry <b>')).toBe('Tom &amp; Jerry &lt;b&gt;');
  });

  it('neutralises an injected link in a household name', () => {
    const malicious = 'Acme<script>alert(1)</script>';
    const out = escapeHtml(malicious);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('The Smith Home')).toBe('The Smith Home');
  });
});
