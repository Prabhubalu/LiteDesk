import type { Component } from 'vue';
import {
  BoltIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  TicketIcon,
  UserIcon,
} from '@heroicons/vue/24/outline';

export type AstraNbaIconKey =
  | 'envelope'
  | 'briefcase'
  | 'ticket'
  | 'user'
  | 'building'
  | 'document'
  | 'calendar'
  | 'task'
  | 'chart'
  | 'search'
  | 'sparkles'
  | 'bolt';

export type AstraNbaIconInput = {
  iconKey?: string | null;
  moduleKey?: string | null;
  kind?: string | null;
  /** Prefer title/label for heuristics — ignore long prompts that mention "emails" etc. */
  label?: string | null;
  title?: string | null;
};

const ICON_BY_KEY: Record<AstraNbaIconKey, Component> = {
  envelope: EnvelopeIcon,
  briefcase: BriefcaseIcon,
  ticket: TicketIcon,
  user: UserIcon,
  building: BuildingOffice2Icon,
  document: DocumentTextIcon,
  calendar: CalendarDaysIcon,
  task: ClipboardDocumentListIcon,
  chart: ChartBarIcon,
  search: MagnifyingGlassIcon,
  sparkles: SparklesIcon,
  bolt: BoltIcon,
};

function iconFromKey(raw?: string | null): Component | null {
  const key = String(raw || '').trim().toLowerCase() as AstraNbaIconKey;
  return ICON_BY_KEY[key] || null;
}

/**
 * Resolve a Heroicon for NBA cards.
 * Prefer server `iconKey`; fall back to title/label + moduleKey (never scan long prompts).
 */
export function resolveAstraNbaIcon(input: AstraNbaIconInput = {}): Component {
  const fromKey = iconFromKey(input.iconKey);
  if (fromKey) return fromKey;

  const mk = String(input.moduleKey || '').trim().toLowerCase();
  const title = [input.label, input.title]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (/\b(nudge|follow[\s-]?up|email|reply|inbox)\b/.test(title)) return EnvelopeIcon;
  if (/\b(brief|situation|summar)/.test(title)) return SparklesIcon;
  if (/\b(best next|next (best )?action|next step)\b/.test(title)) return BoltIcon;
  if (/\b(find|search|look\s*up)\b/.test(title)) return MagnifyingGlassIcon;
  if (/\b(pulse|chart|pipeline)\b/.test(title)) return ChartBarIcon;
  if (/\b(prep|meeting|event)\b/.test(title)) return CalendarDaysIcon;
  if (/\b(unblock|deal)\b/.test(title)) return BriefcaseIcon;
  if (/\b(case|triage)\b/.test(title)) return TicketIcon;
  if (/\b(quote|document)\b/.test(title)) return DocumentTextIcon;
  if (/\b(task|overdue|finish)\b/.test(title)) return ClipboardDocumentListIcon;
  if (/\b(re-?engage|contact|person)\b/.test(title)) return UserIcon;
  if (/\b(org|account|company)\b/.test(title)) return BuildingOffice2Icon;

  if (mk === 'people' || mk === 'contacts') return UserIcon;
  if (mk === 'organizations') return BuildingOffice2Icon;
  if (mk === 'deals') return BriefcaseIcon;
  if (mk === 'cases') return TicketIcon;
  if (mk === 'quotes') return DocumentTextIcon;
  if (mk === 'tasks') return ClipboardDocumentListIcon;
  if (mk === 'events') return CalendarDaysIcon;

  return SparklesIcon;
}
