'use client';

// Shared support-ticket UI used by both the user view (support-client) and the
// staff view (admin-tickets), so status/priority styling and the message thread
// render identically and only need to change in one place.

export interface TicketMessage {
  id: string;
  body: string;
  fromStaff: boolean;
  createdAt: string;
}

export const TICKET_STATUSES = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-slate-100 text-slate-600',
};

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-slate-100 text-slate-600',
  LOW: 'bg-slate-100 text-slate-500',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'}`}>{status.toLowerCase()}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`badge ${PRIORITY_STYLES[priority] ?? 'bg-slate-100 text-slate-600'}`}>{priority.toLowerCase()}</span>;
}

/** Renders a ticket's message bubbles. Labels differ by viewer (user vs staff). */
export function TicketThread({
  messages,
  staffLabel = '🛟 Support team',
  userLabel = 'You',
}: {
  messages: TicketMessage[];
  staffLabel?: string;
  userLabel?: string;
}) {
  return (
    <div className="mt-4 space-y-3">
      {messages.map((m) => (
        <div key={m.id} className={`rounded-lg p-3 text-sm ${m.fromStaff ? 'border border-brand-100 bg-brand-50' : 'bg-slate-50'}`}>
          <p className="mb-1 text-xs font-medium text-slate-500">
            {m.fromStaff ? staffLabel : userLabel} · {new Date(m.createdAt).toLocaleString()}
          </p>
          <p className="whitespace-pre-wrap text-slate-800">{m.body}</p>
        </div>
      ))}
    </div>
  );
}
