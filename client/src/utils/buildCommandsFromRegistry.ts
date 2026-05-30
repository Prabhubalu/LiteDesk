/**
 * ============================================================================
 * PLATFORM COMMAND PALETTE: Builder Function
 * ============================================================================
 *
 * Builds command palette from:
 * - locked SidebarStructure (surfaces / identity / lens / governance)
 * - dashboard actions
 *
 * This builder intentionally mirrors the sidebar doctrine:
 * surfaces → identity → app lens → app nav → governance.
 *
 * ============================================================================
 */

import type {
  CommandItem,
  CommandPaletteDefinition,
  CommandScope,
  CommandCategory,
} from '@/types/command.types';
import { PermissionOutcome } from '@/types/permission-visibility.types';
import type { SidebarStructure, SidebarItem, AppSummary } from '@/types/sidebar.types';
import type { DashboardDefinition } from '@/types/dashboard.types';

function toKeywords(label: string, extra: string[] = []): string[] {
  return [label.toLowerCase(), ...extra.map((s) => s.toLowerCase())];
}

function buildShellCommands(shell: SidebarItem[]): CommandItem[] {
  return shell
    .filter((i) => i.kind === 'surface')
    .map((i) => ({
      id: `shell-${i.id}`,
      label: i.label,
      description: `Navigate to ${i.label}`,
      icon: i.icon,
      route: i.route,
      scope: 'GLOBAL' as CommandScope,
      visibility: PermissionOutcome.ENABLED,
      category: 'navigation' as CommandCategory,
      keywords: toKeywords(i.label, [i.id]),
      order: 1,
    }));
}

function buildCoreModuleCommands(coreModules: SidebarItem[]): CommandItem[] {
  return coreModules
    .filter((i) => i.kind === 'coreModule')
    .map((i) => ({
      id: `core-module-${i.id}`,
      label: i.label,
      description: `Navigate to ${i.label}`,
      icon: i.icon,
      route: i.route,
      scope: 'GLOBAL' as CommandScope,
      visibility: PermissionOutcome.ENABLED,
      category: 'navigation' as CommandCategory,
      keywords: toKeywords(i.label, [i.id]),
      order: 10,
    }));
}

function buildAppSwitcherCommands(apps: AppSummary[]): CommandItem[] {
  return apps.map((app, idx) => ({
    id: `app-${app.id}`,
    label: app.name,
    description: `Switch app lens to ${app.name}`,
    icon: app.icon,
    route: app.dashboardRoute,
    scope: 'APP' as CommandScope,
    visibility: PermissionOutcome.ENABLED,
    category: 'apps' as CommandCategory,
    appKey: app.id,
    keywords: toKeywords(app.name, [app.id, 'lens', 'app']),
    order: 100 + idx,
  }));
}

function buildAppNavCommands(appNav: SidebarStructure['appNav']): CommandItem[] {
  const commands: CommandItem[] = [];

  if (appNav.dashboard && appNav.dashboard.kind === 'app') {
    commands.push({
      id: `app-dashboard-${appNav.appId}`,
      label: appNav.dashboard.label,
      description: `Open ${appNav.dashboard.label} dashboard`,
      icon: appNav.dashboard.icon,
      route: appNav.dashboard.route,
      scope: 'APP' as CommandScope,
      visibility: PermissionOutcome.ENABLED,
      category: 'apps' as CommandCategory,
      appKey: appNav.appId,
      keywords: toKeywords(appNav.dashboard.label, [appNav.appId, 'dashboard']),
      order: 200,
    });
  }

  for (const module of appNav.modules) {
    if (module.kind !== 'app') continue;
    commands.push({
      id: `module-${appNav.appId}-${module.moduleKey || module.id}`,
      label: module.label,
      description: `Open ${module.label}`,
      icon: module.icon,
      route: module.route,
      scope: 'MODULE' as CommandScope,
      visibility: PermissionOutcome.ENABLED,
      category: 'modules' as CommandCategory,
      appKey: appNav.appId,
      moduleKey: module.moduleKey,
      keywords: toKeywords(module.label, [String(module.moduleKey || ''), appNav.appId]),
      order: 210,
    });
  }

  return commands;
}

function buildPlatformCommands(platform: SidebarItem[]): CommandItem[] {
  return platform
    .filter((i) => i.kind === 'platform')
    .map((i, idx) => ({
      id: `platform-${i.id}`,
      label: i.label,
      description: `Navigate to ${i.label}`,
      icon: i.icon,
      route: i.route,
      scope: 'GLOBAL' as CommandScope,
      visibility: PermissionOutcome.ENABLED,
      category: 'settings' as CommandCategory,
      keywords: toKeywords(i.label, [i.id, 'settings']),
      order: 300 + idx,
    }));
}

function buildActionCommands(dashboards: DashboardDefinition[]): CommandItem[] {
  const commands: CommandItem[] = [];

  for (const dashboard of dashboards) {
    for (const action of dashboard.actions) {
      if (action.visibility === PermissionOutcome.HIDDEN) continue;

      commands.push({
        id: `action-${dashboard.appKey}-${action.key}`,
        label: action.label,
        description:
          action.type === 'create'
            ? `Create new ${action.label.toLowerCase()}`
            : action.type === 'import'
              ? `Import data`
              : action.type === 'configure'
                ? `Configure ${dashboard.title}`
                : action.label,
        icon: action.icon,
        route: action.route,
        scope: 'APP' as CommandScope,
        permission: action.permission,
        visibility: action.visibility,
        category: 'actions' as CommandCategory,
        appKey: dashboard.appKey,
        keywords: toKeywords(action.label, [action.key, action.type, dashboard.title]),
        order: action.order ?? 999,
      });
    }
  }

  return commands;
}

function groupByCategory(commands: CommandItem[]): Record<CommandCategory, CommandItem[]> {
  const grouped: Record<CommandCategory, CommandItem[]> = {
    navigation: [],
    actions: [],
    modules: [],
    apps: [],
    settings: [],
    system: [],
  };

  for (const command of commands) {
    grouped[command.category].push(command);
  }

  for (const category in grouped) {
    grouped[category as CommandCategory].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  return grouped;
}

function groupByScope(commands: CommandItem[]): Record<CommandScope, CommandItem[]> {
  const grouped: Record<CommandScope, CommandItem[]> = {
    GLOBAL: [],
    APP: [],
    MODULE: [],
  };

  for (const command of commands) {
    grouped[command.scope].push(command);
  }

  for (const scope in grouped) {
    grouped[scope as CommandScope].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  return grouped;
}

export type BuildCommandsFromRegistryOptions = {
  /** When set, includes modules from every entitled app (e.g. Helpdesk Cases), not only the active lens. */
  allAppNavs?: SidebarStructure['appNav'][];
};

export function buildCommandsFromRegistry(
  sidebarStructure: SidebarStructure,
  dashboards: DashboardDefinition[],
  options?: BuildCommandsFromRegistryOptions
): CommandPaletteDefinition {
  const commands: CommandItem[] = [];

  commands.push(...buildShellCommands(sidebarStructure.shell));
  commands.push(...buildCoreModuleCommands(sidebarStructure.coreModules));
  commands.push(...buildAppSwitcherCommands(sidebarStructure.appSwitcher.apps));

  const appNavs = options?.allAppNavs?.length
    ? options.allAppNavs
    : [sidebarStructure.appNav];
  for (const appNav of appNavs) {
    commands.push(...buildAppNavCommands(appNav));
  }

  commands.push(...buildPlatformCommands(sidebarStructure.platform));
  commands.push(...buildActionCommands(dashboards));

  commands.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return {
    version: 1,
    commands,
    commandsByCategory: groupByCategory(commands),
    commandsByScope: groupByScope(commands),
  };
}

export function searchCommands(commands: CommandItem[], query: string): CommandItem[] {
  if (!query || query.trim() === '') return commands;

  const normalizedQuery = query.toLowerCase().trim();

  return commands.filter((command) => {
    if (command.label.toLowerCase().includes(normalizedQuery)) return true;
    if (command.description?.toLowerCase().includes(normalizedQuery)) return true;
    if (command.keywords?.some((keyword) => keyword.includes(normalizedQuery))) return true;
    if (command.route?.toLowerCase().includes(normalizedQuery)) return true;
    return false;
  });
}

