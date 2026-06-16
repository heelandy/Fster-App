import Link from 'next/link';

export const metadata = { title: 'Terms of Service — Foster Care HMS' };

export default function TermsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Terms of Service</h1>
      <p className="text-xs text-slate-400">Last updated: [DATE] · [Company Name].</p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">1. Acceptance</h2>
      <p>By creating an account or using Foster Care HMS (the “Service”), you agree to these Terms. If you do not agree, do not use the Service.</p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">2. Eligibility &amp; accounts</h2>
      <p>
        You must be an adult authorized to manage the foster-care information you enter. You are responsible for
        the accuracy of your data, for keeping your credentials secure, and for activity under your account. Enable
        two-factor authentication where possible.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">3. Acceptable use</h2>
      <ul className="list-disc pl-5">
        <li>Only enter information you are authorized to record and share within your household.</li>
        <li>Do not attempt to access other households’ data, probe security, or disrupt the Service.</li>
        <li>Only invite caregivers who are entitled to the relevant information; respect the access level you assign them.</li>
      </ul>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">4. Subscriptions &amp; billing</h2>
      <p>
        Paid plans are billed via Stripe on a recurring basis until cancelled. Prices and features are shown at
        checkout. You can manage or cancel your subscription in the billing portal. [State your refund policy.]
        Failure to pay may downgrade or suspend paid features after a grace period.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">5. Your data</h2>
      <p>
        You retain ownership of the information you enter. You grant us a limited license to process it solely to
        operate the Service, as described in the <Link href="/privacy" className="text-brand-700 hover:underline">Privacy Policy</Link>.
        You are responsible for keeping your own records as required by your agency or jurisdiction.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">6. Availability &amp; disclaimers</h2>
      <p>
        The Service is provided “as is” without warranties of any kind. It is an organizational tool and is not a
        substitute for professional, legal, or medical advice, nor for any official record-keeping required by a
        court or agency. [Add limitation-of-liability and indemnification clauses reviewed by counsel.]
      </p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">7. Termination</h2>
      <p>
        You may delete your account at any time. We may suspend or terminate accounts that violate these Terms.
        On termination, data is handled as described in the Privacy Policy’s retention section.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">8. Changes &amp; governing law</h2>
      <p>
        We may update these Terms; material changes will be notified in-app or by email. These Terms are governed by
        the laws of [jurisdiction]. Contact: <strong>[legal@yourdomain]</strong>.
      </p>
    </>
  );
}
