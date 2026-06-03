import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentListIcon,
  CogIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentChartBarIcon,
  DocumentCurrencyDollarIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  InboxIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
  PresentationChartLineIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  TicketIcon,
  UserGroupIcon,
  UsersIcon
} from '@heroicons/vue/24/outline';
import {
  MODULE_ICON_COMPONENTS,
  MODULE_ICON_IDS,
  resolveStoredModuleIconId
} from '@/utils/moduleIcons';

type IconLookupItem = {
  moduleKey?: string;
  icon?: string;
  label?: string;
  route?: string;
  id?: string;
};

const MODULE_ICON_MAP: Record<string, any> = {
  attention: ExclamationTriangleIcon,
  inbox: InboxIcon,
  platform: Squares2X2Icon,
  people: UserGroupIcon,
  organizations: BuildingOfficeIcon,
  deals: BriefcaseIcon,
  tasks: CheckCircleIcon,
  events: CalendarDaysIcon,
  items: CubeIcon,
  forms: ClipboardDocumentListIcon,
  responses: InboxIcon,
  import: ArchiveBoxIcon,
  dashboard: DocumentChartBarIcon,
  audits: DocumentMagnifyingGlassIcon,
  findings: ExclamationTriangleIcon,
  ...MODULE_ICON_COMPONENTS
};

const RAW_ICON_MAP: Record<string, any> = {
  users: UsersIcon,
  user: UserGroupIcon,
  'building-office': BuildingOfficeIcon,
  building: BuildingOfficeIcon,
  briefcase: BriefcaseIcon,
  'check-circle': CheckCircleIcon,
  check: CheckCircleIcon,
  calendar: CalendarIcon,
  'calendar-days': CalendarDaysIcon,
  cog: CogIcon,
  squares: Squares2X2Icon,
  'presentation-chart': PresentationChartLineIcon,
  'document-magnifying-glass': DocumentMagnifyingGlassIcon,
  'exclamation-triangle': ExclamationTriangleIcon,
  'clipboard-document': ClipboardDocumentIcon,
  clipboard: ClipboardDocumentIcon,
  'clipboard-document-list': ClipboardDocumentListIcon,
  cube: CubeIcon,
  'arrow-down-tray': ArrowDownTrayIcon,
  download: ArrowDownTrayIcon,
  inbox: InboxIcon,
  folder: FolderIcon,
  search: MagnifyingGlassIcon,
  lifebuoy: LifebuoyIcon,
  ticket: TicketIcon,
  support: LifebuoyIcon,
  'shield-check': ShieldCheckIcon,
  shield: ShieldCheckIcon,
  'document-text': DocumentTextIcon,
  'shopping-cart': ShoppingCartIcon,
  'document-currency-dollar': DocumentCurrencyDollarIcon,
  'credit-card': CreditCardIcon,
  ...Object.fromEntries(
    Object.entries(MODULE_ICON_IDS).map(([moduleKey, iconId]) => [moduleKey, MODULE_ICON_COMPONENTS[moduleKey]])
  )
};

const EMOJI_ICON_MAP: Record<string, string> = {
  '👥': 'users',
  '🏢': 'building',
  '💼': 'briefcase',
  '✅': 'check',
  '📅': 'calendar',
  '📦': 'cube',
  '📝': 'clipboard',
  '📥': 'download',
  '⚙️': 'cog',
  '💰': 'briefcase',
  '🎧': 'lifebuoy',
  '🛟': 'lifebuoy',
  '🌐': 'squares',
  '📋': 'clipboard',
  '🛡️': 'shield-check',
  '🎫': 'ticket',
  '💳': 'credit-card'
};

export function getIconComponent(icon?: string, moduleKey?: string): any {
  const resolvedId = resolveStoredModuleIconId(icon, moduleKey);
  const normalized = String(EMOJI_ICON_MAP[icon || ''] || resolvedId || icon || '').toLowerCase();
  return RAW_ICON_MAP[normalized] || Squares2X2Icon;
}

export function getNavigationIconComponent(item: IconLookupItem): any {
  const moduleKey = String(item.moduleKey || '').toLowerCase();
  // Shared platform key `cases`: Helpdesk tickets vs Audit findings (also moduleKey `cases`).
  if (moduleKey === 'cases') {
    const routeLower = String(item.route || '').toLowerCase();
    const rawId = String(item.id || '');
    if (routeLower.startsWith('/audit/') || rawId.toUpperCase().startsWith('AUDIT:')) {
      return ExclamationTriangleIcon;
    }
    return TicketIcon;
  }
  if (moduleKey && MODULE_ICON_MAP[moduleKey]) {
    return MODULE_ICON_MAP[moduleKey];
  }

  const route = String(item.route || '').toLowerCase();
  if (route.includes('/audit/audits')) {
    return DocumentMagnifyingGlassIcon;
  }
  if (route.includes('/audit/findings')) {
    return ExclamationTriangleIcon;
  }
  if (route.includes('/audit/responses')) {
    return ClipboardDocumentListIcon;
  }

  const iconComponent = getIconComponent(item.icon, moduleKey);
  if (iconComponent !== Squares2X2Icon) {
    return iconComponent;
  }

  const label = String(item.label || '').toLowerCase();
  if (label.includes('deal')) return BriefcaseIcon;
  if (label.includes('response')) return InboxIcon;
  if (label.includes('import')) return ArchiveBoxIcon;
  if (label.includes('dashboard')) return DocumentChartBarIcon;

  const rawId = String(item.id || '');
  const idTail = rawId.includes(':') ? String(rawId.split(':').pop() || '').toLowerCase() : '';
  if (idTail && MODULE_ICON_MAP[idTail]) {
    return MODULE_ICON_MAP[idTail];
  }

  return Squares2X2Icon;
}

