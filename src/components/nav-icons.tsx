import {
  LayoutDashboard,
  Sun,
  Users,
  Siren,
  CalendarDays,
  FileText,
  ClipboardList,
  Pill,
  DollarSign,
  Contact,
  Repeat,
  CheckSquare,
  ShieldCheck,
  Heart,
  Phone,
  DoorOpen,
  BookOpen,
  CalendarRange,
  Library,
  Building2,
  Home,
  CreditCard,
  MessageCircle,
  User,
  Settings,
  Gavel,
  GraduationCap,
  Syringe,
  Award,
  type LucideIcon,
} from 'lucide-react';

/**
 * Stable keys for every navigation destination. The server layout tags each nav
 * item with one of these; the client nav resolves it to a Lucide icon plus the
 * soft colour chip used in the sidebar mockup. Kept emoji-free by design.
 */
export type IconKey =
  | 'overview'
  | 'today'
  | 'children'
  | 'emergency'
  | 'appointments'
  | 'documents'
  | 'careLogs'
  | 'medications'
  | 'expenses'
  | 'contacts'
  | 'routines'
  | 'checklists'
  | 'licensing'
  | 'behavior'
  | 'communication'
  | 'visits'
  | 'journal'
  | 'court'
  | 'education'
  | 'immunizations'
  | 'training'
  | 'timeline'
  | 'resources'
  | 'agency'
  | 'household'
  | 'billing'
  | 'support'
  | 'account'
  | 'admin';

interface IconSpec {
  Icon: LucideIcon;
  /** Icon colour when the row is inactive. */
  color: string;
  /** Soft chip background behind the icon when the row is inactive. */
  chip: string;
}

export const NAV_ICONS: Record<IconKey, IconSpec> = {
  overview: { Icon: LayoutDashboard, color: 'text-brand-600', chip: 'bg-brand-100' },
  today: { Icon: Sun, color: 'text-amber-500', chip: 'bg-amber-50' },
  children: { Icon: Users, color: 'text-orange-500', chip: 'bg-orange-50' },
  emergency: { Icon: Siren, color: 'text-red-500', chip: 'bg-red-50' },
  appointments: { Icon: CalendarDays, color: 'text-blue-500', chip: 'bg-blue-50' },
  documents: { Icon: FileText, color: 'text-violet-500', chip: 'bg-violet-50' },
  careLogs: { Icon: ClipboardList, color: 'text-sky-500', chip: 'bg-sky-50' },
  medications: { Icon: Pill, color: 'text-rose-500', chip: 'bg-rose-50' },
  expenses: { Icon: DollarSign, color: 'text-emerald-500', chip: 'bg-emerald-50' },
  contacts: { Icon: Contact, color: 'text-teal-500', chip: 'bg-teal-50' },
  routines: { Icon: Repeat, color: 'text-indigo-500', chip: 'bg-indigo-50' },
  checklists: { Icon: CheckSquare, color: 'text-green-500', chip: 'bg-green-50' },
  licensing: { Icon: ShieldCheck, color: 'text-blue-600', chip: 'bg-blue-50' },
  behavior: { Icon: Heart, color: 'text-pink-500', chip: 'bg-pink-50' },
  communication: { Icon: Phone, color: 'text-cyan-500', chip: 'bg-cyan-50' },
  visits: { Icon: DoorOpen, color: 'text-orange-600', chip: 'bg-orange-50' },
  journal: { Icon: BookOpen, color: 'text-purple-500', chip: 'bg-purple-50' },
  court: { Icon: Gavel, color: 'text-amber-700', chip: 'bg-amber-50' },
  education: { Icon: GraduationCap, color: 'text-sky-600', chip: 'bg-sky-50' },
  immunizations: { Icon: Syringe, color: 'text-red-500', chip: 'bg-red-50' },
  training: { Icon: Award, color: 'text-yellow-600', chip: 'bg-yellow-50' },
  timeline: { Icon: CalendarRange, color: 'text-slate-500', chip: 'bg-slate-100' },
  resources: { Icon: Library, color: 'text-fuchsia-500', chip: 'bg-fuchsia-50' },
  agency: { Icon: Building2, color: 'text-slate-600', chip: 'bg-slate-100' },
  household: { Icon: Home, color: 'text-brand-500', chip: 'bg-brand-100' },
  billing: { Icon: CreditCard, color: 'text-emerald-600', chip: 'bg-emerald-50' },
  support: { Icon: MessageCircle, color: 'text-blue-500', chip: 'bg-blue-50' },
  account: { Icon: User, color: 'text-slate-600', chip: 'bg-slate-100' },
  admin: { Icon: Settings, color: 'text-slate-700', chip: 'bg-slate-100' },
};
