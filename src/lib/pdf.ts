/**
 * Minimal zero-dependency PDF generator for simple, printable text records
 * (e.g. a licensing / compliance summary). Single column of left-aligned text,
 * auto-paginated onto US-Letter pages with Helvetica / Helvetica-Bold.
 *
 * This is deliberately NOT a general PDF library — just enough to produce a
 * clean, downloadable record without pulling in a heavy dependency. Text is
 * sanitized to the WinAnsi/ASCII range so byte length == string length, which
 * keeps the cross-reference offsets correct.
 */

export interface PdfLine {
  text: string;
  size?: number; // font size in pt (default 11)
  bold?: boolean;
  gap?: number; // extra space (pt) ABOVE this line
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 54;
const TOP = 740;
const BOTTOM = 54;
const LEADING = 16;

// PDF/WinAnsi can't render arbitrary Unicode; map the few symbols we emit and
// drop anything else outside printable ASCII so offsets stay byte-accurate.
function sanitize(s: string): string {
  return s
    .replace(/[•·]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/→/g, '->')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[\\()]/g, (c) => '\\' + c); // escape PDF string metacharacters
}

interface Placed { x: number; y: number; size: number; bold: boolean; text: string }

const TEXT_WIDTH = PAGE_W - 2 * MARGIN_X;

// Greedy word-wrap to the page width (Helvetica avg char width ≈ 0.5em).
function wrapLine(ln: PdfLine): PdfLine[] {
  const size = ln.size ?? 11;
  const maxChars = Math.max(8, Math.floor(TEXT_WIDTH / (size * 0.5)));
  const words = ln.text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    if (line && (line.length + 1 + w.length) > maxChars) { out.push(line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  if (out.length <= 1) return [ln];
  // First wrapped row keeps the gap; continuation rows hug the line above.
  return out.map((t, i) => ({ text: t, size, bold: ln.bold, gap: i === 0 ? ln.gap : 0 }));
}

/** Lay lines out into pages, returning each page's positioned text runs. */
function paginate(rawLines: PdfLine[]): Placed[][] {
  const lines = rawLines.flatMap(wrapLine);
  const pages: Placed[][] = [];
  let cur: Placed[] = [];
  let y = TOP;
  for (const ln of lines) {
    const size = ln.size ?? 11;
    const gap = ln.gap ?? 0;
    if (y - gap - LEADING < BOTTOM) {
      pages.push(cur);
      cur = [];
      y = TOP;
    }
    y -= gap;
    cur.push({ x: MARGIN_X, y, size, bold: !!ln.bold, text: sanitize(ln.text) });
    y -= LEADING;
  }
  pages.push(cur);
  return pages;
}

function contentStream(page: Placed[]): string {
  let s = '';
  for (const r of page) {
    const font = r.bold ? '/F2' : '/F1';
    s += `BT ${font} ${r.size} Tf ${r.x} ${r.y} Td (${r.text}) Tj ET\n`;
  }
  return s;
}

/** Build a PDF document from a flat list of text lines. Returns raw bytes. */
export function buildTextPdf(lines: PdfLine[]): Buffer {
  const pages = paginate(lines);

  // Object layout: 1=Catalog, 2=Pages, 3=F1, 4=F2, then per page a Page object
  // and a Contents stream object.
  const pageObjStart = 5;
  const pageRefs: number[] = [];
  for (let i = 0; i < pages.length; i++) pageRefs.push(pageObjStart + i * 2);

  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  pages.forEach((page, i) => {
    const pageNo = pageObjStart + i * 2;
    const contentNo = pageNo + 1;
    objects[pageNo] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNo} 0 R >>`;
    const stream = contentStream(page);
    objects[contentNo] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`;
  });

  // Serialize with a cross-reference table.
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    if (!objects[i]) continue;
    offsets[i] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, 'latin1');
  const count = objects.length; // includes the free object 0
  pdf += `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) {
    const off = offsets[i] ?? 0;
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}

export interface LicensingItem {
  name: string;
  category: string | null;
  status: string;
  dueDate: Date | null;
  completedAt?: Date | null;
}

const fmtDate = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
const pretty = (s: string) => s.replaceAll('_', ' ').toLowerCase();

export interface ChildReportData {
  childName: string;
  dateOfBirth: Date | null;
  caseNumber: string | null;
  caseworkerName: string | null;
  school: string | null;
  placementStatus: string;
  placements: { status: string; placementDate: Date; endDate: Date | null }[];
  appointments: { title: string; type: string; startsAt: Date }[];
  medications: { name: string; dosage: string | null; schedule: string | null }[];
  careLogs: { logDate: Date; behavior: string | null; mood: string | null; incidents: string | null; milestones: string | null }[];
}

/**
 * Render a court / caseworker report for one child from logged data —
 * placements, appointments, active medications and recent care-log notes.
 */
export function buildChildReportPdf(data: ChildReportData): Buffer {
  const lines: PdfLine[] = [
    { text: 'Foster Care Report', size: 20, bold: true },
    { text: data.childName, size: 13, gap: 4 },
    { text: `Generated ${new Date().toISOString().slice(0, 10)}`, size: 9, gap: 2 },
  ];

  lines.push({ text: 'Child', size: 13, bold: true, gap: 16 });
  lines.push({ text: `Date of birth: ${fmtDate(data.dateOfBirth)}`, size: 10, gap: 6 });
  lines.push({ text: `Case number: ${data.caseNumber || '—'}`, size: 10, gap: 2 });
  lines.push({ text: `Caseworker: ${data.caseworkerName || '—'}`, size: 10, gap: 2 });
  lines.push({ text: `School: ${data.school || '—'}`, size: 10, gap: 2 });
  lines.push({ text: `Placement status: ${pretty(data.placementStatus)}`, size: 10, gap: 2 });

  lines.push({ text: `Placement history (${data.placements.length})`, size: 13, bold: true, gap: 18 });
  if (data.placements.length === 0) lines.push({ text: 'None recorded.', size: 10, gap: 6 });
  for (const p of data.placements) {
    lines.push({ text: `${pretty(p.status)}   ${fmtDate(p.placementDate)}${p.endDate ? ` -> ${fmtDate(p.endDate)}` : ''}`, size: 10, gap: 6 });
  }

  lines.push({ text: `Appointments (${data.appointments.length})`, size: 13, bold: true, gap: 18 });
  if (data.appointments.length === 0) lines.push({ text: 'None recorded.', size: 10, gap: 6 });
  for (const a of data.appointments) {
    lines.push({ text: `${fmtDate(a.startsAt)}   ${pretty(a.type)}   ${a.title}`, size: 10, gap: 6 });
  }

  lines.push({ text: `Active medications (${data.medications.length})`, size: 13, bold: true, gap: 18 });
  if (data.medications.length === 0) lines.push({ text: 'None recorded.', size: 10, gap: 6 });
  for (const m of data.medications) {
    lines.push({ text: `${m.name}${m.dosage ? ` — ${m.dosage}` : ''}${m.schedule ? ` (${m.schedule})` : ''}`, size: 10, gap: 6 });
  }

  lines.push({ text: `Recent care-log notes (${data.careLogs.length})`, size: 13, bold: true, gap: 18 });
  if (data.careLogs.length === 0) lines.push({ text: 'None recorded.', size: 10, gap: 6 });
  for (const c of data.careLogs) {
    const notes = [c.behavior && `behavior: ${c.behavior}`, c.mood && `mood: ${c.mood}`, c.incidents && `incident: ${c.incidents}`, c.milestones && `milestone: ${c.milestones}`]
      .filter(Boolean)
      .join('   ');
    lines.push({ text: `${fmtDate(c.logDate)}   ${notes || '—'}`, size: 10, gap: 6 });
  }

  return buildTextPdf(lines);
}

export interface TransitionData {
  childName: string;
  dateOfBirth: Date | null;
  school: string | null;
  doctorName: string | null;
  allergies: string | null;
  importantNotes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medications: { name: string; dosage: string | null; schedule: string | null }[];
  routines: { name: string }[];
}

/**
 * Placement-transition packet — the essentials that travel with a child when
 * they move homes: summary, medical, medications, routines and comfort notes.
 */
export function buildTransitionPacketPdf(d: TransitionData): Buffer {
  const lines: PdfLine[] = [
    { text: 'Placement Transition Packet', size: 20, bold: true },
    { text: d.childName, size: 13, gap: 4 },
    { text: `Generated ${new Date().toISOString().slice(0, 10)}`, size: 9, gap: 2 },

    { text: 'Summary', size: 13, bold: true, gap: 16 },
    { text: `Date of birth: ${fmtDate(d.dateOfBirth)}`, size: 10, gap: 6 },
    { text: `School: ${d.school || '—'}`, size: 10, gap: 2 },
    { text: `Doctor: ${d.doctorName || '—'}`, size: 10, gap: 2 },
    { text: `Emergency contact: ${d.emergencyContactName || '—'}${d.emergencyContactPhone ? ` (${d.emergencyContactPhone})` : ''}`, size: 10, gap: 2 },

    { text: 'Allergies & medical', size: 13, bold: true, gap: 16 },
    { text: d.allergies || 'None recorded', size: 10, gap: 6 },

    { text: `Medications (${d.medications.length})`, size: 13, bold: true, gap: 16 },
  ];
  if (d.medications.length === 0) lines.push({ text: 'None recorded.', size: 10, gap: 6 });
  for (const m of d.medications) lines.push({ text: `${m.name}${m.dosage ? ` — ${m.dosage}` : ''}${m.schedule ? ` (${m.schedule})` : ''}`, size: 10, gap: 6 });

  lines.push({ text: `Routines (${d.routines.length})`, size: 13, bold: true, gap: 16 });
  if (d.routines.length === 0) lines.push({ text: 'None recorded.', size: 10, gap: 6 });
  for (const r of d.routines) lines.push({ text: r.name, size: 10, gap: 6 });

  lines.push({ text: 'Comfort items & notes', size: 13, bold: true, gap: 16 });
  lines.push({ text: d.importantNotes || '—', size: 10, gap: 6 });

  return buildTextPdf(lines);
}

export interface JournalGroup {
  childName: string;
  entries: { entryDate: Date; title: string | null; body: string }[];
}

/** Child story & success journal as a keepsake memory book. */
export function buildJournalPdf(groups: JournalGroup[]): Buffer {
  const lines: PdfLine[] = [
    { text: 'A Story Worth Telling', size: 20, bold: true },
    { text: 'Child Story & Success Journal', size: 12, gap: 4 },
    { text: `Generated ${new Date().toISOString().slice(0, 10)}`, size: 9, gap: 2 },
  ];
  if (groups.every((g) => g.entries.length === 0)) {
    lines.push({ text: 'No journal entries yet.', size: 11, gap: 16 });
  }
  for (const g of groups) {
    if (g.entries.length === 0) continue;
    lines.push({ text: g.childName, size: 15, bold: true, gap: 20 });
    for (const e of g.entries) {
      lines.push({ text: `${fmtDate(e.entryDate)}${e.title ? ` — ${e.title}` : ''}`, size: 12, bold: true, gap: 12 });
      lines.push({ text: e.body, size: 10, gap: 2 });
    }
  }
  return buildTextPdf(lines);
}

/** Render a household's licensing / compliance list into a printable PDF. */
export function buildLicensingPdf(homeName: string, items: LicensingItem[]): Buffer {
  const lines: PdfLine[] = [
    { text: 'Licensing & Compliance', size: 20, bold: true },
    { text: homeName, size: 12, gap: 4 },
    { text: `Generated ${new Date().toISOString().slice(0, 10)}`, size: 9, gap: 2 },
  ];
  if (items.length === 0) {
    lines.push({ text: 'No licensing requirements tracked yet.', size: 11, gap: 16 });
  } else {
    lines.push({ text: `Requirements (${items.length})`, size: 12, bold: true, gap: 18 });
    for (const it of items) {
      lines.push({ text: it.name, size: 12, bold: true, gap: 10 });
      const meta: string[] = [`Status: ${pretty(it.status)}`];
      if (it.category) meta.push(`Category: ${it.category}`);
      meta.push(`Due: ${fmtDate(it.dueDate)}`);
      if (it.completedAt) meta.push(`Completed: ${fmtDate(it.completedAt)}`);
      lines.push({ text: meta.join('    '), size: 10, gap: 2 });
    }
  }
  return buildTextPdf(lines);
}
