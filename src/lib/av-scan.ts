import { env, avScanConfigured } from './env';

export interface ScanResult {
  clean: boolean;
  reason?: string;
}

/**
 * Optional malware/AV scan for uploaded bytes. When `AV_SCAN_URL` is set the file
 * is POSTed to it (as octet-stream) and treated as infected unless the scanner
 * replies `{ "clean": true }`. Unset = scanning is skipped (returns clean).
 *
 * Fails CLOSED when configured: a scanner error rejects the upload rather than
 * storing an unscanned file — the safer default for a malware gate.
 */
export async function scanUpload(bytes: Buffer, filename: string, mime: string): Promise<ScanResult> {
  if (!avScanConfigured) return { clean: true };
  try {
    const res = await fetch(env.AV_SCAN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': filename.slice(0, 255),
        'X-Mime-Type': mime,
      },
      body: new Uint8Array(bytes),
    });
    if (!res.ok) return { clean: false, reason: `scanner returned ${res.status}` };
    const data = (await res.json().catch(() => ({}))) as { clean?: boolean; infected?: boolean };
    const clean = data.clean === true || data.infected === false;
    return clean ? { clean: true } : { clean: false, reason: 'file was flagged by the malware scan' };
  } catch {
    return { clean: false, reason: 'malware scan was unavailable' };
  }
}
