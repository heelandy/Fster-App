'use client';

import { useState } from 'react';
import { CrudResource } from './crud-resource';
import { DocumentsClient } from './documents-client';
import { ChecklistClient } from './checklist-client';
import {
  appointmentFields,
  appointmentColumns,
  careLogFields,
  careLogColumns,
  medicationFields,
  medicationColumns,
  expenseFields,
  expenseColumns,
  contactFields,
  contactColumns,
} from './resource-configs';

export interface ChildPerms {
  appointments: boolean;
  appointmentsWrite: boolean;
  careLogs: boolean;
  careLogsWrite: boolean;
  medications: boolean;
  medicationsWrite: boolean;
  documents: boolean;
  documentsWrite: boolean;
  expenses: boolean;
  expensesWrite: boolean;
  contacts: boolean;
  contactsWrite: boolean;
  routines: boolean;
  routinesWrite: boolean;
}

export function ChildTabs({ childId, perms }: { childId: string; perms: ChildPerms }) {
  const tabs: { key: string; label: string; show: boolean }[] = [
    { key: 'appointments', label: '📅 Appointments', show: perms.appointments },
    { key: 'care-logs', label: '📝 Care Logs', show: perms.careLogs },
    { key: 'medications', label: '💊 Medications', show: perms.medications },
    { key: 'documents', label: '📄 Documents', show: perms.documents },
    { key: 'routines', label: '🔁 Routines', show: perms.routines },
    { key: 'expenses', label: '💵 Expenses', show: perms.expenses },
    { key: 'contacts', label: '📇 Contacts', show: perms.contacts },
  ].filter((t) => t.show);

  const [active, setActive] = useState(tabs[0]?.key ?? '');

  if (tabs.length === 0) return <p className="text-sm text-slate-500">No accessible sections.</p>;

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              active === t.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'appointments' && (
        <CrudResource title="Appointments" endpoint="/api/appointments" fields={appointmentFields} columns={appointmentColumns} canWrite={perms.appointmentsWrite} fixedChildId={childId} emptyText="No appointments for this child yet." />
      )}
      {active === 'care-logs' && (
        <CrudResource title="Care Logs" endpoint="/api/care-logs" fields={careLogFields} columns={careLogColumns} canWrite={perms.careLogsWrite} fixedChildId={childId} emptyText="No care logs for this child yet." />
      )}
      {active === 'medications' && (
        <CrudResource title="Medications" endpoint="/api/medications" fields={medicationFields} columns={medicationColumns} canWrite={perms.medicationsWrite} fixedChildId={childId} emptyText="No medications for this child yet." />
      )}
      {active === 'documents' && <DocumentsClient canWrite={perms.documentsWrite} fixedChildId={childId} />}
      {active === 'routines' && (
        <ChecklistClient title="Routines" endpoint="/api/routines" itemToggleEndpoint="/api/routine-tasks" itemsKey="tasks" canWrite={perms.routinesWrite} fixedChildId={childId} />
      )}
      {active === 'expenses' && (
        <CrudResource title="Expenses" endpoint="/api/expenses" fields={expenseFields} columns={expenseColumns} canWrite={perms.expensesWrite} fixedChildId={childId} emptyText="No expenses for this child yet." />
      )}
      {active === 'contacts' && (
        <CrudResource title="Contacts" endpoint="/api/contacts" fields={contactFields} columns={contactColumns} canWrite={perms.contactsWrite} fixedChildId={childId} emptyText="No contacts for this child yet." />
      )}
    </div>
  );
}
