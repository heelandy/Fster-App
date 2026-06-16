export const metadata = { title: 'Privacy Policy — Foster Care HMS' };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Privacy Policy</h1>
      <p className="text-xs text-slate-400">Last updated: [DATE] · Operated by [Company Name] (“we”, “us”).</p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">1. Who this is for</h2>
      <p>
        Foster Care HMS is a private tool for foster parents and authorized caregivers to manage placement
        information. It is not intended for use by children directly, and accounts are created by adults.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">2. Information we collect</h2>
      <ul className="list-disc pl-5">
        <li><strong>Account data:</strong> name, email, password (stored only as a bcrypt hash), and security settings (e.g. two-factor).</li>
        <li><strong>Household &amp; child records you enter:</strong> child profiles, case numbers, caseworker/medical/contact details, appointments, daily care logs, medications, documents, expenses, routines and licensing information. This includes <strong>sensitive personal data about children in care</strong>.</li>
        <li><strong>Billing data:</strong> subscription status and invoices. Card details are handled entirely by Stripe and never touch our servers.</li>
        <li><strong>Technical/security data:</strong> IP address, user agent, and audit logs of security-relevant and administrative actions.</li>
      </ul>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">3. How we use it</h2>
      <p>
        Solely to provide the service: storing and displaying your records, authentication, billing, sending
        transactional emails (verification, password reset, invitations, reminders), security monitoring, and
        support. We do <strong>not</strong> sell personal data or use child data for advertising.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">4. How it’s protected</h2>
      <ul className="list-disc pl-5">
        <li>Encryption in transit (HTTPS/HSTS) and <strong>encryption at rest</strong> (AES-256-GCM) for sensitive child/medical fields, uploaded files, and security secrets.</li>
        <li>Role-based access control and household scoping — users only see records for households they belong to. Administrators see aggregate metrics, <strong>not</strong> individual child records.</li>
        <li>Password hashing (bcrypt), account lockout, rate limiting, optional two-factor authentication, CSRF protection, and audit logging.</li>
      </ul>

      <h2 id="retention" className="mt-4 text-lg font-semibold text-slate-900">5. Data retention &amp; deletion</h2>
      <ul className="list-disc pl-5">
        <li>Records are retained while your account/household is active. You may export or delete records in-app at any time.</li>
        <li>On account deletion, associated household data is removed within <strong>[N] days</strong>, except where longer retention is legally required.</li>
        <li>Audit/security logs are retained for <strong>[N months]</strong> for safety and compliance.</li>
        <li>Backups are retained for <strong>[N days]</strong> and then rotated out.</li>
      </ul>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">6. Sharing &amp; processors</h2>
      <p>
        We share data only with infrastructure providers acting on our behalf: [hosting provider], [database host],
        Stripe (payments), and [email provider]. Each processes data only to provide their service.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">7. Your rights</h2>
      <p>
        Depending on your jurisdiction ([e.g. GDPR/CCPA]) you may have rights to access, correct, export, or delete
        your data, and to object to certain processing. Contact us at <strong>[privacy@yourdomain]</strong>.
      </p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">8. Children’s data &amp; legal basis</h2>
      <p>
        Child information is entered by authorized adult caregivers as part of providing foster care. [Confirm your
        lawful basis and any applicable foster-care confidentiality statutes, COPPA considerations, and
        state/agency requirements with counsel.]
      </p>

      <h2 className="mt-4 text-lg font-semibold text-slate-900">9. Contact</h2>
      <p>[Company Name], [address]. Questions: <strong>[privacy@yourdomain]</strong>.</p>
    </>
  );
}
