import type { CommandPaletteItem } from '@/types/commandPalette.types';
import { canAccessSettingsTab } from '@/utils/settingsTabAccess';

export type SettingsAccessContext = {
  isOwner: boolean;
  role: string | null | undefined;
  permissions: Record<string, unknown> | null | undefined;
  entitledAddons?: { ai?: boolean } | null;
};

type SettingsPaletteTab = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  route: string;
  order: number;
};

/** Top-level settings tabs only — no deep sub-routes. Order matches Settings sidebar. */
const SETTINGS_PALETTE_TABS: SettingsPaletteTab[] = [
  {
    id: 'profile',
    labelKey: 'settings.tabProfile',
    descriptionKey: 'settings.tabProfileDesc',
    route: '/settings?tab=profile',
    order: 10,
  },
  {
    id: 'organization',
    labelKey: 'settings.tabCompany',
    descriptionKey: 'settings.tabCompanyDesc',
    route: '/settings?tab=organization',
    order: 20,
  },
  {
    id: 'business-hours',
    labelKey: 'settings.tabBusinessHours',
    descriptionKey: 'settings.tabBusinessHoursDesc',
    route: '/settings?tab=business-hours',
    order: 30,
  },
  {
    id: 'users-access',
    labelKey: 'settings.tabUsersAccess',
    descriptionKey: 'settings.tabUsersAccessDesc',
    route: '/settings?tab=users-access',
    order: 40,
  },
  {
    id: 'core-modules',
    labelKey: 'settings.tabCoreModules',
    descriptionKey: 'settings.tabCoreModulesDesc',
    route: '/settings?tab=core-modules',
    order: 50,
  },
  {
    id: 'applications',
    labelKey: 'settings.tabApplications',
    descriptionKey: 'settings.tabApplicationsDesc',
    route: '/settings?tab=applications',
    order: 60,
  },
  {
    id: 'automation',
    labelKey: 'settings.tabAutomation',
    descriptionKey: 'settings.tabAutomationDesc',
    route: '/settings?tab=automation',
    order: 70,
  },
  {
    id: 'performance',
    labelKey: 'settings.tabPerformance',
    descriptionKey: 'settings.tabPerformanceDesc',
    route: '/settings?tab=performance',
    order: 80,
  },
  {
    id: 'subscriptions',
    labelKey: 'settings.tabSubscriptions',
    descriptionKey: 'settings.tabSubscriptionsDesc',
    route: '/settings?tab=subscriptions',
    order: 90,
  },
  {
    id: 'notifications',
    labelKey: 'settings.tabNotifications',
    descriptionKey: 'settings.tabNotificationsDesc',
    route: '/settings?tab=notifications&notificationPage=preferences',
    order: 100,
  },
  {
    id: 'security',
    labelKey: 'settings.tabSecurity',
    descriptionKey: 'settings.tabSecurityDesc',
    route: '/settings?tab=security',
    order: 110,
  },
  {
    id: 'integrations',
    labelKey: 'settings.tabIntegrations',
    descriptionKey: 'settings.tabIntegrationsDesc',
    route: '/settings?tab=integrations',
    order: 120,
  },
  {
    id: 'ai',
    labelKey: 'settings.tabAi',
    descriptionKey: 'settings.tabAiDesc',
    route: '/settings?tab=ai',
    order: 125,
  },
];

/**
 * Permission-aware settings navigation for the command palette.
 * Hub + top-level tabs only; deep config stays in Settings surfaces.
 */
export function buildSettingsPaletteCommands(
  t: (key: string) => string,
  ctx: SettingsAccessContext
): CommandPaletteItem[] {
  const settingsLabel = t('navigation.settings');
  const commands: CommandPaletteItem[] = [
    {
      id: 'nav-settings',
      label: settingsLabel,
      description: t('navigation.commandPaletteSettingsHubDesc'),
      category: 'settings',
      scope: 'global',
      moduleKey: 'settings',
      icon: 'cog',
      kind: 'navigate',
      run: (nav) => {
        nav.openTab('/settings', { title: settingsLabel, background: false });
      },
    },
  ];

  for (const tab of SETTINGS_PALETTE_TABS) {
    if (!canAccessSettingsTab(tab.id, ctx)) continue;

    const label = t(tab.labelKey);
    commands.push({
      id: `nav-settings-${tab.id}`,
      label,
      description: t(tab.descriptionKey),
      category: 'settings',
      scope: 'global',
      moduleKey: 'settings',
      icon: 'cog',
      kind: 'navigate',
      run: (nav) => {
        nav.openTab(tab.route, { title: label, background: false });
      },
    });
  }

  return commands;
}

export function settingsCommandSortOrder(commandId: string): number {
  if (commandId === 'nav-settings') return 0;
  const tab = SETTINGS_PALETTE_TABS.find((t) => commandId === `nav-settings-${t.id}`);
  return tab?.order ?? 999;
}
