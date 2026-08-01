/**
 * Parse organization type rows from GET/PATCH status-types API.
 */

import {
  resolveAvailableOrganizationRoles,
  type OrganizationEnabledAppLike,
} from '@/platform/organizations/organizationParticipation';

export interface OrganizationTypeDef {
  value: string;
  label: string;
  enabled: boolean;
  /**
   * `undefined` = inherit platform defaults; `[]` = explicitly no type-scoped fields;
   * non-empty = explicit field keys.
   */
  fields?: string[];
}

export type OrganizationTypePicklistOption = {
  value: string;
  label: string;
};

export const DEFAULT_ORGANIZATION_TYPE_VALUES = [
  'Lead',
  'Customer',
  'Marketing Lead',
  'Vendor',
  'Partner',
] as const;

export const RETIRED_ORGANIZATION_TYPE_VALUES = ['Distributor', 'Dealer'] as const;

export function isRetiredOrganizationTypeValue(value: unknown): boolean {
  const v = String(value ?? '').trim().toLowerCase();
  return RETIRED_ORGANIZATION_TYPE_VALUES.some((type) => type.toLowerCase() === v);
}

/** Picklist options for Organizations `types` (enabled types, else platform defaults). */
export function organizationTypeDefsToPicklistOptions(
  typeDefs: ReadonlyArray<OrganizationTypeDef> | null | undefined,
  options?: {
    /** When provided, only roles declared by enabled participation apps are shown. */
    enabledApps?: ReadonlyArray<OrganizationEnabledAppLike> | null;
  }
): OrganizationTypePicklistOption[] {
  const defs = (Array.isArray(typeDefs) ? typeDefs : []).filter(
    (d) => d && d.enabled !== false && !isRetiredOrganizationTypeValue(d.value ?? d.label)
  );
  const gateByApps = options != null && Object.prototype.hasOwnProperty.call(options, 'enabledApps');

  if (gateByApps) {
    const roles = resolveAvailableOrganizationRoles(options?.enabledApps);
    const byKey = new Map(
      defs.map((d) => [String(d.value ?? d.label ?? '').trim().toLowerCase(), d] as const)
    );
    return roles
      .map((role) => {
        const match = byKey.get(role.toLowerCase());
        // Tenant explicitly disabled this role
        const rawDisabled = (Array.isArray(typeDefs) ? typeDefs : []).find(
          (d) =>
            String(d?.value ?? d?.label ?? '')
              .trim()
              .toLowerCase() === role.toLowerCase() && d.enabled === false
        );
        if (rawDisabled) return null;
        return {
          value: match ? String(match.value ?? role).trim() || role : role,
          label: match
            ? String(match.label ?? match.value ?? role).trim() || role
            : role,
        };
      })
      .filter((row): row is OrganizationTypePicklistOption => row != null);
  }

  const source =
    defs.length > 0
      ? defs
      : DEFAULT_ORGANIZATION_TYPE_VALUES.map((value) => ({
          value,
          label: value,
          enabled: true as const,
        }));
  return source
    .map((d) => {
      const value = String(d.value ?? d.label ?? '').trim();
      if (!value) return null;
      return {
        value,
        label: String(d.label ?? value).trim() || value,
      };
    })
    .filter((row): row is OrganizationTypePicklistOption => row != null);
}

function isTypeDefish(x: unknown): x is { value?: unknown; label?: unknown; enabled?: unknown; fields?: unknown } {
  return typeof x === 'object' && x !== null && !Array.isArray(x) && ('value' in x || 'label' in x);
}

function parseTypeDefFields(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const fk = String(x ?? '').trim();
    if (!fk) continue;
    const low = fk.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(fk);
  }
  return out.length > 0 ? out : [];
}

export function parseOrganizationTypesFromStatusTypesPayload(data: unknown): OrganizationTypeDef[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const orgTypes = (data as { organizationTypes?: unknown }).organizationTypes;
  if (!Array.isArray(orgTypes)) return [];

  const typeDefs: OrganizationTypeDef[] = [];
  for (let i = 0; i < orgTypes.length; i++) {
    const row = orgTypes[i];
    if (!isTypeDefish(row)) continue;
    const value = String(row.value ?? row.label ?? '').trim();
    if (!value) continue;
    if (isRetiredOrganizationTypeValue(value)) continue;
    const label = String(row.label ?? value).trim() || value;
    const enabled = row.enabled !== undefined ? Boolean(row.enabled) : true;
    const fields = parseTypeDefFields(row.fields);
    const td: OrganizationTypeDef = { value, label, enabled };
    if (fields !== undefined) td.fields = fields;
    typeDefs.push(td);
  }
  return typeDefs;
}
