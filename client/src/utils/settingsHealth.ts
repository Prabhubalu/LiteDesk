export type SettingsHealthStatus = 'ok' | 'attention' | 'unknown';

export type SettingsHealthSignals = {
  orgName?: string | null;
  orgCurrency?: string | null;
  canCheckSecurity: boolean;
  twoFactorEnabled?: boolean | null;
  canCheckTaxes: boolean;
  taxCount?: number | null;
  canCheckNumbering: boolean;
  numberingEnabledCount?: number | null;
};

export type SettingsHealthItem = {
  catalogId: string;
  /** Hub card that should show the chip (parent or self). */
  hubId: string;
  status: SettingsHealthStatus;
  reasonKey: string;
};

/**
 * Pure evaluation of settings health from already-fetched signals.
 * Fail-soft: missing optional signals → unknown (omit from Needs attention).
 */
export function evaluateSettingsHealth(
  signals: SettingsHealthSignals
): SettingsHealthItem[] {
  const items: SettingsHealthItem[] = [];

  const nameOk = Boolean(String(signals.orgName || '').trim());
  const currencyOk = Boolean(String(signals.orgCurrency || '').trim());
  items.push({
    catalogId: 'organization',
    hubId: 'organization',
    status: nameOk && currencyOk ? 'ok' : 'attention',
    reasonKey: 'settings.healthReasonOrg',
  });

  if (signals.canCheckSecurity) {
    if (signals.twoFactorEnabled == null) {
      items.push({
        catalogId: 'security',
        hubId: 'security',
        status: 'unknown',
        reasonKey: 'settings.healthReasonSecurity2fa',
      });
    } else {
      items.push({
        catalogId: 'security',
        hubId: 'security',
        status: signals.twoFactorEnabled ? 'ok' : 'attention',
        reasonKey: 'settings.healthReasonSecurity2fa',
      });
    }
  }

  if (signals.canCheckTaxes) {
    if (signals.taxCount == null) {
      items.push({
        catalogId: 'inventory.taxes',
        hubId: 'inventory',
        status: 'unknown',
        reasonKey: 'settings.healthReasonTaxes',
      });
    } else {
      items.push({
        catalogId: 'inventory.taxes',
        hubId: 'inventory',
        status: signals.taxCount > 0 ? 'ok' : 'attention',
        reasonKey: 'settings.healthReasonTaxes',
      });
    }
  }

  if (signals.canCheckNumbering) {
    if (signals.numberingEnabledCount == null) {
      items.push({
        catalogId: 'automation.module-numbering',
        hubId: 'automation',
        status: 'unknown',
        reasonKey: 'settings.healthReasonNumbering',
      });
    } else {
      items.push({
        catalogId: 'automation.module-numbering',
        hubId: 'automation',
        status: signals.numberingEnabledCount > 0 ? 'ok' : 'attention',
        reasonKey: 'settings.healthReasonNumbering',
      });
    }
  }

  return items;
}

export function unwrapTaxList(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const data = (res as { data?: unknown }).data;
    if (Array.isArray(data)) return data;
  }
  return [];
}

export function countEnabledNumbering(configs: unknown): number | null {
  if (!Array.isArray(configs)) return null;
  return configs.filter((c) => c && typeof c === 'object' && (c as { enabled?: boolean }).enabled !== false).length;
}
