import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Edge middleware:
 *  1. Generates a per-request nonce and a strict Content-Security-Policy.
 *  2. Gates protected pages/APIs behind authentication.
 *  3. Restricts /admin and /api/admin to global admins.
 *
 * Note: no Prisma here — middleware runs on the Edge runtime. Auth is read from
 * the signed JWT only.
 */

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/stripe/webhook', '/api/health', '/api/cron', '/api/invites'];
const PROTECTED_PAGE_PREFIXES = ['/dashboard', '/admin', '/billing', '/account', '/support'];

function buildCsp(nonce: string, isHttps: boolean): string {
  const isDev = process.env.NODE_ENV !== 'production';
  // In development Next bundles modules with eval()-based source maps and uses
  // HMR, so the dev script-src must allow 'unsafe-eval' (and skip 'strict-dynamic'
  // so 'self' chunk scripts load). Production uses the strict nonce + strict-dynamic
  // policy with no eval.
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' 'unsafe-inline' 'nonce-${nonce}' https://js.stripe.com`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com`;
  const directives = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`, // Tailwind / Next inject styles inline
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' https://api.stripe.com`,
    `frame-src https://js.stripe.com https://hooks.stripe.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];
  // Only force HTTPS upgrades when actually served over HTTPS. On http://localhost
  // this directive would upgrade every request (including the sign-in POST) to
  // https://localhost, where nothing is listening — breaking the whole app.
  if (isHttps) directives.push(`upgrade-insecure-requests`);
  return directives.join('; ');
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isHttps =
    req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce, isHttps);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-invoke-path', pathname);
  requestHeaders.set('content-security-policy', csp);

  const isApi = pathname.startsWith('/api');
  const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((p) => pathname.startsWith(p));
  const needsAuth = (isApi && !isPublicApi) || isProtectedPage;
  const needsAdmin = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

  if (needsAuth) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      if (isApi) {
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      }
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (needsAdmin && token.role !== 'ADMIN') {
      if (isApi) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('content-security-policy', csp);
  return res;
}

export const config = {
  // Run on everything except static assets and the Next image optimizer.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
