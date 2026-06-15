// Local workflow markers. Keys MUST match the backend TicketStatus::STATUSES.
// Tailwind classes are written as full literal strings so they survive purge.
export const STATUSES = [
  {
    key: 'not_started',
    label: 'Pas commencé',
    short: 'À faire',
    dot: 'bg-slate-400',
    bar: 'bg-slate-300',
    ring: 'ring-slate-300',
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
    soft: 'bg-slate-50',
    accent: 'border-slate-300',
  },
  {
    key: 'in_progress',
    label: 'En cours',
    short: 'En cours',
    dot: 'bg-blue-500',
    bar: 'bg-blue-500',
    ring: 'ring-blue-400',
    badge: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
    soft: 'bg-blue-50/60',
    accent: 'border-blue-400',
  },
  {
    key: 'dev_done',
    label: 'Développement terminé',
    short: 'Dev OK',
    dot: 'bg-violet-500',
    bar: 'bg-violet-500',
    ring: 'ring-violet-400',
    badge: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
    soft: 'bg-violet-50/60',
    accent: 'border-violet-400',
  },
  {
    key: 'feedback',
    label: 'Retours à traiter',
    short: 'Retours',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    ring: 'ring-amber-400',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    soft: 'bg-amber-50/60',
    accent: 'border-amber-400',
  },
  {
    key: 'review_done',
    label: 'Review terminée',
    short: 'Review OK',
    dot: 'bg-cyan-500',
    bar: 'bg-cyan-500',
    ring: 'ring-cyan-400',
    badge: 'bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200',
    soft: 'bg-cyan-50/60',
    accent: 'border-cyan-400',
  },
  {
    key: 'merged',
    label: 'Mergé',
    short: 'Mergé',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    ring: 'ring-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    soft: 'bg-emerald-50/60',
    accent: 'border-emerald-400',
  },
]

export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]))
export const DEFAULT_STATUS = 'not_started'

export function statusMeta(key) {
  return STATUS_MAP[key] || STATUS_MAP[DEFAULT_STATUS]
}

// Calendar event kinds.
export const EVENT_KINDS = {
  ticket: { label: 'Ticket', color: '#3563ff' },
  other_project: { label: 'Autre projet', color: '#f97316' },
  note: { label: 'Note', color: '#64748b' },
}

// Working-hours window shown in the hour grid.
export const DAY_START_HOUR = 8
export const DAY_END_HOUR = 20
export const HOUR_HEIGHT = 56 // px per hour
