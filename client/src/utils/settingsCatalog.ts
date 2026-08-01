import { canAccessSettingsTab } from '@/utils/settingsTabAccess';

export type SettingsLane = 'personal' | 'workspace';

export type SettingsAccessContext = {
  isOwner: boolean;
  role: string | null | undefined;
  permissions: Record<string, unknown> | null | undefined;
  entitledAddons?: { ai?: boolean } | null;
  inventoryEnabled?: boolean;
};

export type SettingsCatalogEntry = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  route: string;
  order: number;
  lane: SettingsLane;
  /** English search synonyms (matched case-insensitively). */
  aliases: string[];
  /** Lower = higher priority in Suggested. Omit to exclude from Suggested. */
  suggestedRank?: number;
  /**
   * Parent hub tab id. Leaves inherit access from the parent and are omitted
   * from the overview card grid (search / quick-jump / setup lane only).
   */
  parentId?: string;
  /** Surface in the Setup essentials lane until recently visited. */
  setupEssential?: boolean;
};

function hub(
  entry: Omit<SettingsCatalogEntry, 'parentId' | 'setupEssential'> & {
    setupEssential?: boolean;
  }
): SettingsCatalogEntry {
  return entry;
}

function leaf(
  entry: SettingsCatalogEntry & { parentId: string }
): SettingsCatalogEntry {
  return entry;
}

/**
 * Single source of truth for settings discovery (landing, quick-jump, palette).
 * Hubs first (sidebar order), then deep leaves for search.
 */
export const SETTINGS_CATALOG: SettingsCatalogEntry[] = [
  hub({
    id: 'profile',
    labelKey: 'settings.tabProfile',
    descriptionKey: 'settings.tabProfileDesc',
    route: '/settings?tab=profile',
    order: 10,
    lane: 'personal',
    aliases: ['me', 'account', 'password', 'avatar', 'photo', 'preferences'],
    suggestedRank: 6,
  }),
  hub({
    id: 'organization',
    labelKey: 'settings.tabCompany',
    descriptionKey: 'settings.tabCompanyDesc',
    route: '/settings?tab=organization',
    order: 20,
    lane: 'workspace',
    aliases: ['company', 'branding', 'logo', 'tenant', 'org'],
    suggestedRank: 2,
    setupEssential: true,
  }),
  hub({
    id: 'business-hours',
    labelKey: 'settings.tabBusinessHours',
    descriptionKey: 'settings.tabBusinessHoursDesc',
    route: '/settings?tab=business-hours',
    order: 30,
    lane: 'workspace',
    aliases: ['availability', 'schedule', 'working hours', 'timezone'],
  }),
  hub({
    id: 'users-access',
    labelKey: 'settings.tabUsersAccess',
    descriptionKey: 'settings.tabUsersAccessDesc',
    route: '/settings?tab=users-access',
    order: 40,
    lane: 'workspace',
    aliases: ['users', 'teams', 'groups', 'access', 'rbac'],
    suggestedRank: 1,
  }),
  hub({
    id: 'core-modules',
    labelKey: 'settings.tabCoreModules',
    descriptionKey: 'settings.tabCoreModulesDesc',
    route: '/settings?tab=core-modules',
    order: 50,
    lane: 'workspace',
    aliases: ['fields', 'schema', 'custom fields', 'modules', 'layout'],
    suggestedRank: 7,
  }),
  hub({
    id: 'applications',
    labelKey: 'settings.tabApplications',
    descriptionKey: 'settings.tabApplicationsDesc',
    route: '/settings?tab=applications',
    order: 60,
    lane: 'workspace',
    aliases: ['apps', 'sales', 'crm', 'modules config'],
    suggestedRank: 3,
  }),
  hub({
    id: 'addons',
    labelKey: 'settings.tabAddons',
    descriptionKey: 'settings.tabAddonsDesc',
    route: '/settings?tab=addons',
    order: 61,
    lane: 'workspace',
    aliases: ['marketplace', 'extensions', 'plugins'],
  }),
  hub({
    id: 'catalog',
    labelKey: 'settings.tabCatalog',
    descriptionKey: 'settings.tabCatalogDesc',
    route: '/settings?tab=catalog',
    order: 62,
    lane: 'workspace',
    aliases: ['products', 'items', 'sku'],
  }),
  hub({
    id: 'inventory',
    labelKey: 'settings.tabInventory',
    descriptionKey: 'settings.tabInventoryDesc',
    route: '/settings?tab=inventory',
    order: 65,
    lane: 'workspace',
    aliases: ['stock', 'warehouse', 'procurement'],
  }),
  hub({
    id: 'automation',
    labelKey: 'settings.tabAutomation',
    descriptionKey: 'settings.tabAutomationDesc',
    route: '/settings?tab=automation',
    order: 70,
    lane: 'workspace',
    aliases: ['workflow', 'routing'],
  }),
  hub({
    id: 'webforms',
    labelKey: 'settings.tabWebforms',
    descriptionKey: 'settings.tabWebformsDesc',
    route: '/settings?tab=webforms',
    order: 75,
    lane: 'workspace',
    aliases: ['forms', 'lead capture', 'embed'],
  }),
  hub({
    id: 'performance',
    labelKey: 'settings.tabPerformance',
    descriptionKey: 'settings.tabPerformanceDesc',
    route: '/settings?tab=performance',
    order: 80,
    lane: 'workspace',
    aliases: ['targets', 'kpi', 'goals', 'quota'],
  }),
  hub({
    id: 'subscriptions',
    labelKey: 'settings.tabSubscriptions',
    descriptionKey: 'settings.tabSubscriptionsDesc',
    route: '/settings?tab=subscriptions',
    order: 90,
    lane: 'workspace',
    aliases: ['billing', 'plan', 'invoice', 'payment', 'subscription'],
  }),
  hub({
    id: 'notifications',
    labelKey: 'settings.tabNotifications',
    descriptionKey: 'settings.tabNotificationsDesc',
    route: '/settings?tab=notifications&notificationPage=preferences',
    order: 100,
    lane: 'workspace',
    aliases: ['alerts', 'push'],
    suggestedRank: 5,
  }),
  hub({
    id: 'security',
    labelKey: 'settings.tabSecurity',
    descriptionKey: 'settings.tabSecurityDesc',
    route: '/settings?tab=security',
    order: 110,
    lane: 'workspace',
    aliases: ['sso', '2fa', 'mfa', 'login', 'password policy', 'session'],
    suggestedRank: 4,
    setupEssential: true,
  }),
  hub({
    id: 'integrations',
    labelKey: 'settings.tabIntegrations',
    descriptionKey: 'settings.tabIntegrationsDesc',
    route: '/settings?tab=integrations',
    order: 120,
    lane: 'workspace',
    aliases: ['api', 'webhook', 'zapier', 'connect'],
  }),
  hub({
    id: 'ai',
    labelKey: 'settings.tabAi',
    descriptionKey: 'settings.tabAiDesc',
    route: '/settings?tab=ai',
    order: 125,
    lane: 'workspace',
    aliases: ['openai', 'llm', 'assistant', 'arivu ai'],
  }),
  hub({
    id: 'audit-log',
    labelKey: 'settings.tabAuditLog',
    descriptionKey: 'settings.tabAuditLogDesc',
    route: '/settings?tab=audit-log',
    order: 130,
    lane: 'workspace',
    aliases: ['history', 'activity', 'changelog', 'trail'],
  }),

  // --- Deep leaves (search / quick-jump / setup) ---
  leaf({
    id: 'users-access.roles',
    parentId: 'users-access',
    labelKey: 'settings.usersTabRoles',
    descriptionKey: 'settings.tabUsersAccessDesc',
    route: '/settings?tab=users-access&usersAccessView=roles',
    order: 41,
    lane: 'workspace',
    aliases: ['roles', 'permissions', 'rbac'],
    setupEssential: true,
  }),
  leaf({
    id: 'users-access.users',
    parentId: 'users-access',
    labelKey: 'settings.usersTabManagement',
    descriptionKey: 'settings.tabUsersAccessDesc',
    route: '/settings?tab=users-access&usersAccessView=users',
    order: 42,
    lane: 'workspace',
    aliases: ['user management', 'invite', 'members'],
  }),
  leaf({
    id: 'users-access.groups',
    parentId: 'users-access',
    labelKey: 'settings.usersTabGroups',
    descriptionKey: 'settings.tabUsersAccessDesc',
    route: '/settings?tab=users-access&usersAccessView=groups',
    order: 43,
    lane: 'workspace',
    aliases: ['teams', 'groups'],
  }),
  leaf({
    id: 'catalog.categories',
    parentId: 'catalog',
    labelKey: 'settings.catalogTabCategories',
    descriptionKey: 'settings.tabCatalogDesc',
    route: '/settings?tab=catalog',
    order: 63,
    lane: 'workspace',
    aliases: ['categories', 'product categories'],
  }),
  leaf({
    id: 'catalog.price-books',
    parentId: 'catalog',
    labelKey: 'settings.catalogTabPriceBooks',
    descriptionKey: 'settings.tabCatalogDesc',
    route: '/settings?tab=catalog&catalogView=price-books',
    order: 64,
    lane: 'workspace',
    aliases: ['price book', 'pricebook', 'pricing'],
  }),
  leaf({
    id: 'catalog.item-groups',
    parentId: 'catalog',
    labelKey: 'settings.catalogTabItemGroups',
    descriptionKey: 'settings.tabCatalogDesc',
    route: '/settings?tab=catalog&catalogView=item-groups',
    order: 64.5,
    lane: 'workspace',
    aliases: ['item groups', 'variants'],
  }),
  leaf({
    id: 'inventory.taxes',
    parentId: 'inventory',
    labelKey: 'settings.inventoryTaxes',
    descriptionKey: 'settings.inventoryTaxesDesc',
    route: '/settings?tab=inventory&inventoryView=taxes',
    order: 66,
    lane: 'workspace',
    aliases: ['tax', 'taxes', 'vat', 'gst', 'sales tax'],
    setupEssential: true,
  }),
  leaf({
    id: 'inventory.charges',
    parentId: 'inventory',
    labelKey: 'settings.inventoryCharges',
    descriptionKey: 'settings.inventoryChargesDesc',
    route: '/settings?tab=inventory&inventoryView=charges',
    order: 67,
    lane: 'workspace',
    aliases: ['charges', 'fees', 'surcharge'],
  }),
  leaf({
    id: 'automation.assignment-rules',
    parentId: 'automation',
    labelKey: 'settings.automationAssignmentRules',
    descriptionKey: 'settings.automationAssignmentRulesDesc',
    route: '/settings?tab=automation&automationView=assignment-rules',
    order: 71,
    lane: 'workspace',
    aliases: ['assignment', 'assignment rules', 'routing rules'],
  }),
  leaf({
    id: 'automation.sla-policies',
    parentId: 'automation',
    labelKey: 'settings.automationSlaPolicies',
    descriptionKey: 'settings.automationSlaPoliciesDesc',
    route: '/settings?tab=automation&automationView=sla-policies',
    order: 72,
    lane: 'workspace',
    aliases: ['sla', 'sla policies', 'service level'],
  }),
  leaf({
    id: 'automation.mailroom',
    parentId: 'automation',
    labelKey: 'settings.automationMailroom',
    descriptionKey: 'settings.automationMailroomDesc',
    route: '/settings?tab=automation&automationView=mailroom',
    order: 73,
    lane: 'workspace',
    aliases: ['mailroom', 'inbound email', 'email channel'],
  }),
  leaf({
    id: 'automation.module-numbering',
    parentId: 'automation',
    labelKey: 'settings.automationModuleNumbering',
    descriptionKey: 'settings.automationModuleNumberingDesc',
    route: '/settings?tab=automation&automationView=module-numbering',
    order: 74,
    lane: 'workspace',
    aliases: ['number series', 'invoice numbering', 'document number', 'auto number'],
    setupEssential: true,
  }),
  leaf({
    id: 'notifications.channels',
    parentId: 'notifications',
    labelKey: 'settings.notificationsNavChannels',
    descriptionKey: 'settings.notificationsPageChannelsDesc',
    route: '/settings?tab=notifications&notificationPage=channels',
    order: 101,
    lane: 'workspace',
    aliases: ['email channels', 'smtp', 'notification channels'],
    setupEssential: true,
  }),
  leaf({
    id: 'notifications.preferences',
    parentId: 'notifications',
    labelKey: 'settings.notificationsNavPreferences',
    descriptionKey: 'settings.notificationsPagePreferencesDesc',
    route: '/settings?tab=notifications&notificationPage=preferences',
    order: 102,
    lane: 'workspace',
    aliases: ['notification preferences', 'email alerts'],
  }),
  leaf({
    id: 'notifications.digests',
    parentId: 'notifications',
    labelKey: 'settings.notificationsNavDigests',
    descriptionKey: 'settings.notificationsPageDigestsDesc',
    route: '/settings?tab=notifications&notificationPage=digests',
    order: 103,
    lane: 'workspace',
    aliases: ['digest', 'digest email'],
  }),
  leaf({
    id: 'notifications.rules',
    parentId: 'notifications',
    labelKey: 'settings.notificationsNavRules',
    descriptionKey: 'settings.notificationsPageRulesDesc',
    route: '/settings?tab=notifications&notificationPage=rules',
    order: 104,
    lane: 'workspace',
    aliases: ['notification rules'],
  }),
  leaf({
    id: 'notifications.health',
    parentId: 'notifications',
    labelKey: 'settings.notificationsNavHealth',
    descriptionKey: 'settings.notificationsPageHealthDesc',
    route: '/settings?tab=notifications&notificationPage=health',
    order: 105,
    lane: 'workspace',
    aliases: ['notification health', 'delivery'],
  }),
];

export function isSettingsHub(entry: SettingsCatalogEntry): boolean {
  return !entry.parentId;
}

export function settingsAccessTabId(entry: SettingsCatalogEntry): string {
  return entry.parentId || entry.id;
}

export function getAccessibleSettingsCatalog(
  ctx: SettingsAccessContext
): SettingsCatalogEntry[] {
  return SETTINGS_CATALOG.filter((entry) =>
    canAccessSettingsTab(settingsAccessTabId(entry), ctx)
  );
}

export function getSettingsHubCatalog(
  ctx: SettingsAccessContext
): SettingsCatalogEntry[] {
  return getAccessibleSettingsCatalog(ctx).filter(isSettingsHub);
}

export type SettingsSearchHit = SettingsCatalogEntry & {
  label: string;
  description: string;
  parentLabel?: string;
  score: number;
};

/**
 * Ranked fuzzy-ish match: exact label > alias > prefix > substring on label/desc/id.
 */
export function searchSettingsCatalog(
  query: string,
  entries: SettingsCatalogEntry[],
  t: (key: string) => string
): SettingsSearchHit[] {
  const q = query.trim().toLowerCase();
  const parentLabelById = new Map(
    entries
      .filter(isSettingsHub)
      .map((e) => [e.id, t(e.labelKey)] as const)
  );

  if (!q) {
    return entries.map((entry) => ({
      ...entry,
      label: t(entry.labelKey),
      description: t(entry.descriptionKey),
      parentLabel: entry.parentId ? parentLabelById.get(entry.parentId) : undefined,
      score: entry.order,
    }));
  }

  const hits: SettingsSearchHit[] = [];
  for (const entry of entries) {
    const label = t(entry.labelKey);
    const description = t(entry.descriptionKey);
    const labelL = label.toLowerCase();
    const descL = description.toLowerCase();
    const idL = entry.id.toLowerCase();

    let score = -1;
    if (labelL === q || idL === q) score = 0;
    else if (entry.aliases.some((a) => a.toLowerCase() === q)) score = 1;
    else if (labelL.startsWith(q) || idL.startsWith(q)) score = 2;
    else if (entry.aliases.some((a) => a.toLowerCase().startsWith(q))) score = 3;
    else if (labelL.includes(q) || idL.includes(q)) score = 4;
    else if (entry.aliases.some((a) => a.toLowerCase().includes(q))) score = 5;
    else if (descL.includes(q)) score = 6;

    if (score >= 0) {
      hits.push({
        ...entry,
        label,
        description,
        parentLabel: entry.parentId ? parentLabelById.get(entry.parentId) : undefined,
        score,
      });
    }
  }

  return hits.sort((a, b) => a.score - b.score || a.order - b.order);
}
