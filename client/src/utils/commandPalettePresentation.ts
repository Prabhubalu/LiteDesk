import type { Component } from 'vue';
import { getNavigationIconComponent } from '@/utils/navigationIcons';
import { withApiOrigin } from '@/config/apiBase';
import type { CommandPaletteItem } from '@/types/commandPalette.types';

export type SearchResultLike = {
  type: string;
  title?: string;
  subtitle?: string;
  avatar?: string | null;
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  route?: string;
};

const COMMAND_ID_MODULE: Record<string, string> = {
  'nav-inbox': 'inbox',
  'nav-people': 'people',
  'nav-platform': 'platform',
  'nav-settings': 'settings',
  'create-person': 'people',
  'create-organization': 'organizations',
  'create-task': 'tasks',
  'create-event': 'events',
  'schedule-audit': 'audits',
  'plan-audit-beat': 'audits',
  'inbox-create-task': 'tasks',
  'person-assign-task': 'tasks',
  'person-link-organization': 'organizations',
  'person-create-organization': 'organizations',
  'org-link-person': 'people',
  'org-create-deal': 'deals'
};

const SEARCH_TYPE_MODULE: Record<string, string> = {
  people: 'people',
  contacts: 'people',
  organizations: 'organizations',
  organization: 'organizations',
  deals: 'deals',
  tasks: 'tasks',
  events: 'events',
  forms: 'forms',
  items: 'items'
};

const COMMAND_ROUTE_HINT: Record<string, string> = {
  'nav-inbox': '/inbox',
  'nav-people': '/people',
  'nav-platform': '/platform/home',
  'nav-settings': '/settings',
  'schedule-audit': '/audit/schedule',
  'plan-audit-beat': '/audit/schedule'
};

export function getCommandModuleKey(command: CommandPaletteItem): string {
  if (command.moduleKey) return command.moduleKey;
  return COMMAND_ID_MODULE[command.id] || 'platform';
}

export function getCommandIconComponent(command: CommandPaletteItem): Component {
  return getNavigationIconComponent({
    moduleKey: getCommandModuleKey(command),
    icon: command.icon,
    id: command.id,
    route: COMMAND_ROUTE_HINT[command.id]
  });
}

export function searchResultModuleKey(type: string): string {
  return SEARCH_TYPE_MODULE[String(type || '').toLowerCase()] || String(type || '').toLowerCase();
}

export function resolveRecordAvatarSrc(avatar?: string | null): string | undefined {
  if (!avatar || typeof avatar !== 'string') return undefined;
  if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) {
    return avatar;
  }
  return withApiOrigin(avatar.startsWith('/') ? avatar : `/${avatar}`);
}

/** Avatar props for records — photo when present, otherwise letter initials (list view parity). */
export function getSearchResultAvatarProps(result: SearchResultLike): {
  user?: Record<string, unknown>;
  record?: Record<string, unknown>;
  icon?: Component;
} {
  const moduleKey = searchResultModuleKey(result.type);
  const avatar = resolveRecordAvatarSrc(result.avatar);

  if (moduleKey === 'people') {
    const firstName =
      result.first_name || result.firstName || splitTitle(result.title).firstName;
    const lastName =
      result.last_name || result.lastName || splitTitle(result.title).lastName;
    return {
      user: {
        firstName,
        lastName,
        name: result.title,
        avatar
      }
    };
  }

  return {
    record: {
      name: result.title,
      avatar
    }
  };
}

export function getRecentSearchAvatarProps(entry: {
  label: string;
  type?: string;
  avatar?: string;
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  moduleKey?: string;
}): {
  user?: Record<string, unknown>;
  record?: Record<string, unknown>;
} {
  const moduleKey = entry.moduleKey || (entry.type ? searchResultModuleKey(entry.type) : 'people');

  if (moduleKey === 'people') {
    return {
      user: {
        firstName: entry.first_name || entry.firstName || splitTitle(entry.label).firstName,
        lastName: entry.last_name || entry.lastName || splitTitle(entry.label).lastName,
        name: entry.label,
        avatar: resolveRecordAvatarSrc(entry.avatar)
      }
    };
  }

  return {
    record: {
      name: entry.label,
      avatar: resolveRecordAvatarSrc(entry.avatar)
    }
  };
}

function splitTitle(title?: string) {
  const parts = String(title || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ')
  };
}
