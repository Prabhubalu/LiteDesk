import type { CommandPaletteItem } from '@/types/commandPalette.types';
import {
  SETTINGS_CATALOG,
  settingsAccessTabId,
  type SettingsAccessContext,
} from '@/utils/settingsCatalog';
import { canAccessSettingsTab } from '@/utils/settingsTabAccess';

export type { SettingsAccessContext };

/**
 * Permission-aware settings navigation for the command palette.
 * Includes hubs and deep leaf destinations.
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

  for (const tab of SETTINGS_CATALOG) {
    if (!canAccessSettingsTab(settingsAccessTabId(tab), ctx)) continue;

    const label = t(tab.labelKey);
    const parent = tab.parentId
      ? SETTINGS_CATALOG.find((e) => e.id === tab.parentId)
      : undefined;
    const description = parent
      ? `${t(parent.labelKey)} · ${t(tab.descriptionKey)}`
      : t(tab.descriptionKey);

    commands.push({
      id: `nav-settings-${tab.id}`,
      label,
      description,
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
  const tab = SETTINGS_CATALOG.find((t) => commandId === `nav-settings-${t.id}`);
  return tab?.order ?? 999;
}
