import qrcode from 'qrcode-generator';

/**
 * Render arbitrary text (here: an `otpauth://` URI) as a self-contained SVG
 * data URL. Generation is fully local — the TOTP secret is NEVER sent to a
 * third-party QR service. Uses the dependency-free `qrcode-generator` encoder.
 *
 * Returns a `data:image/svg+xml` URL suitable for an <img src>.
 */
export function qrSvgDataUrl(text: string): string {
  // type 0 = auto-pick the smallest version that fits; EC level M (good scan
  // reliability for short authenticator URIs). addData defaults to Byte mode —
  // our otpauth URI is ASCII so no multibyte handling is needed.
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  // scalable:true → viewBox-based SVG (crisp at any size); margin = quiet zone.
  const svg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
