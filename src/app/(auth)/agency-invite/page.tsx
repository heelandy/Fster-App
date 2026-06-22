import Link from 'next/link';
import { Heart } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { hashToken } from '@/lib/tokens';
import { humanize } from '@/lib/enums';
import { AcceptAgencyInviteButton } from '@/components/accept-agency-invite';
import { SignOutButton } from '@/components/sign-out-button';

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold text-brand-700">
          <Heart className="h-5 w-5" fill="currentColor" /> Foster Care HMS
        </Link>
        <div className="card">{children}</div>
      </div>
    </main>
  );
}

export default async function AgencyInvitePage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? '';
  const invite = token
    ? await prisma.agencyInvite.findUnique({
        where: { tokenHash: hashToken(token) },
        select: { email: true, role: true, acceptedAt: true, expiresAt: true, agency: { select: { name: true } } },
      })
    : null;

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          This invitation is invalid, has already been used, or has expired. Ask the agency admin to send a new one.
        </p>
        <Link href="/login" className="btn-primary mt-4 inline-block">Go to sign in</Link>
      </Shell>
    );
  }

  const roleLabel = humanize(invite.role);
  const session = await auth();
  const signedInEmail = session?.user?.email ?? null;
  const callbackUrl = `/agency-invite?token=${encodeURIComponent(token)}`;

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-slate-900">Join {invite.agency.name}</h1>
      <p className="mt-2 text-sm text-slate-600">
        You’ve been invited to join as a <span className="font-medium">{roleLabel}</span> using{' '}
        <span className="font-medium">{invite.email}</span>.
      </p>

      {!signedInEmail && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Sign in or create an account with that email to accept.</p>
          <div className="flex gap-3">
            <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="btn-primary">Sign in</Link>
            <Link href="/register" className="btn-secondary">Create account</Link>
          </div>
        </div>
      )}

      {signedInEmail && signedInEmail.toLowerCase() === invite.email.toLowerCase() && (
        <div className="mt-4">
          <AcceptAgencyInviteButton token={token} />
        </div>
      )}

      {signedInEmail && signedInEmail.toLowerCase() !== invite.email.toLowerCase() && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-red-600">
            You’re signed in as <span className="font-medium">{signedInEmail}</span>, but this invite was sent to{' '}
            <span className="font-medium">{invite.email}</span>. Sign out and sign back in with the invited address.
          </p>
          <SignOutButton />
        </div>
      )}
    </Shell>
  );
}
