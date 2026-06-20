import { requireHousehold } from '@/lib/authz';

// Curated foster-parent resource library. Static, vetted external links grouped
// by topic. (Future: editable per-agency content + saved/bookmarked items.)
const SECTIONS: { title: string; icon: string; items: { name: string; href: string; note: string }[] }[] = [
  {
    title: 'Trauma-informed parenting (TBRI)',
    icon: '💛',
    items: [
      { name: 'Karyn Purvis Institute of Child Development', href: 'https://child.tcu.edu/', note: 'TBRI® — Trust-Based Relational Intervention' },
      { name: 'The Connected Child (book)', href: 'https://child.tcu.edu/about-us/tbri/', note: 'Foundational TBRI reading for caregivers' },
    ],
  },
  {
    title: 'School & IEP advocacy',
    icon: '🎓',
    items: [
      { name: 'Understood.org — IEPs', href: 'https://www.understood.org/en/articles/what-is-an-iep', note: 'What an IEP is and how to advocate' },
      { name: 'Wrightslaw', href: 'https://www.wrightslaw.com/', note: 'Special-education law & advocacy' },
    ],
  },
  {
    title: 'Foster care support & training',
    icon: '🤝',
    items: [
      { name: 'AdoptUSKids — for families', href: 'https://www.adoptuskids.org/for-families', note: 'Guidance for foster & adoptive families' },
      { name: 'Child Welfare Information Gateway', href: 'https://www.childwelfare.gov/', note: 'Federal resources & state directories' },
      { name: 'National Foster Parent Association', href: 'https://nfpaonline.org/', note: 'Training, advocacy & community' },
    ],
  },
  {
    title: 'Crisis & wellbeing',
    icon: '🆘',
    items: [
      { name: '988 Suicide & Crisis Lifeline', href: 'https://988lifeline.org/', note: 'Call or text 988 (US), 24/7' },
      { name: 'Childhelp National Child Abuse Hotline', href: 'https://www.childhelp.org/hotline/', note: '1-800-422-4453' },
    ],
  },
];

export default async function ResourcesPage() {
  await requireHousehold();
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Resource library</h1>
      <p className="mb-6 text-sm text-slate-600">Curated, trusted resources for foster parents. Links open in a new tab.</p>
      <div className="space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{s.icon} {s.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {s.items.map((it) => (
                <a key={it.href} href={it.href} target="_blank" rel="noopener noreferrer" className="card transition hover:border-brand-300">
                  <p className="font-medium text-brand-700">{it.name} ↗</p>
                  <p className="mt-1 text-sm text-slate-600">{it.note}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
