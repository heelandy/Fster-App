import { createHash, createHmac } from 'node:crypto';
import { env } from './env';

/**
 * Minimal S3-compatible client (AWS S3 / Cloudflare R2) using AWS Signature V4,
 * implemented on Node crypto — no SDK dependency. We only need three opaque-blob
 * operations (PutObject / GetObject / DeleteObject); files are already encrypted
 * by the app and served only through the authenticated route, so no public URLs
 * or presigning are required. Uses path-style addressing (works for S3 and R2).
 */

const SERVICE = 's3';

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function amzDate(now = new Date()): { date: string; dateTime: string } {
  const dateTime = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  return { date: dateTime.slice(0, 8), dateTime };
}

function deriveSigningKey(secret: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}
function signingKey(secret: string, date: string, region: string): Buffer {
  return deriveSigningKey(secret, date, region, SERVICE);
}

export function s3Configured(): boolean {
  return (
    env.STORAGE_DRIVER === 's3' &&
    Boolean(env.STORAGE_S3_ENDPOINT && env.STORAGE_S3_BUCKET && env.STORAGE_S3_ACCESS_KEY_ID && env.STORAGE_S3_SECRET_ACCESS_KEY)
  );
}

/** Sign and execute a single S3 request. `key` is the object key (no leading slash). */
async function s3Request(method: 'PUT' | 'GET' | 'DELETE', key: string, body?: Buffer): Promise<Response> {
  const endpoint = env.STORAGE_S3_ENDPOINT.replace(/\/$/, '');
  const url = new URL(`${endpoint}/${env.STORAGE_S3_BUCKET}/${key}`);
  const region = env.STORAGE_S3_REGION || 'auto';
  const { date, dateTime } = amzDate();
  const payloadHash = sha256Hex(body ?? Buffer.alloc(0));

  // Canonical request.
  const canonicalUri = url.pathname
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const host = url.host;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${dateTime}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  // String to sign.
  const scope = `${date}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', dateTime, scope, sha256Hex(canonicalRequest)].join('\n');

  // Signature + auth header.
  const signature = hmac(signingKey(env.STORAGE_S3_SECRET_ACCESS_KEY, date, region), stringToSign).toString('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${env.STORAGE_S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': dateTime,
      ...(body ? { 'Content-Length': String(body.byteLength) } : {}),
    },
    body: body ?? undefined,
  });
}

export async function s3Put(key: string, body: Buffer): Promise<void> {
  const res = await s3Request('PUT', key, body);
  if (!res.ok) throw new Error(`S3 put failed: ${res.status} ${await res.text().catch(() => '')}`);
}

export async function s3Get(key: string): Promise<Buffer> {
  const res = await s3Request('GET', key);
  if (!res.ok) throw new Error(`S3 get failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function s3Delete(key: string): Promise<void> {
  const res = await s3Request('DELETE', key);
  // S3 returns 204 on delete; treat 404 as already-gone.
  if (!res.ok && res.status !== 404) throw new Error(`S3 delete failed: ${res.status}`);
}

// Exported for unit testing the SigV4 signing-key derivation against AWS vectors.
export const _internal = { deriveSigningKey, sha256Hex };
