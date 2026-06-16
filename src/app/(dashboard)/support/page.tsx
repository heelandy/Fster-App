import { SupportClient } from '@/components/support-client';

export const dynamic = 'force-dynamic';

export default function SupportPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Support</h1>
      <p className="mb-6 text-sm text-slate-600">
        Question or problem? Open a ticket and our team will reply here.
      </p>
      <SupportClient />
    </div>
  );
}
