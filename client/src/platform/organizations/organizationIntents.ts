/**
 * ORGANIZATION INTENT CONFIGURATION - DEFINITIONS
 * 
 * ARCHITECTURAL PURPOSE:
 * This file exports the canonical Organization Intent Definitions that map
 * organization types to their allowed lifecycle statuses.
 * 
 * IMPORTANT: This is a CONFIGURATION LAYER ONLY.
 * - It does NOT create organizations
 * - It does NOT enforce backend validation rules
 * - It does NOT modify existing create/edit behavior
 * 
 * PURPOSE:
 * This configuration exists to drive UI intent & status visibility.
 * It provides a canonical mapping between:
 * - Organization types (Customer, Vendor, Partner, etc.)
 * - Allowed lifecycle statuses for each type
 * - Default status values
 * - Editability rules for create vs. edit contexts
 * 
 * USAGE:
 * This configuration is read-only and serves as the source of truth
 * for which statuses should be visible/selectable in the UI based on
 * the organization types selected.
 */

import type { OrganizationIntentDefinition } from './organizationIntent.types';
import {
  getOrganizationTypesForField,
  ORGANIZATION_INTENT_STATUS_FIELD_KEYS,
} from '../fields/organizationFieldModel';

/**
 * Canonical array of Organization Intent Definitions.
 * 
 * Each intent maps organization types to their allowed statuses and defaults.
 */
export const ORGANIZATION_INTENT_DEFINITIONS: OrganizationIntentDefinition[] = [
  {
    key: 'customer',
    label: 'Customer',
    organizationTypes: ['Customer', 'Lead', 'Marketing Lead'],
    allowedStatuses: ['Prospect', 'Active', 'On Hold', 'At Risk', 'Inactive', 'Churned'],
    defaultStatus: 'Prospect',
    editableInCreate: true,
    editableInEdit: true,
  },
  {
    key: 'vendor',
    label: 'Vendor',
    organizationTypes: ['Vendor'],
    allowedStatuses: ['Prospect', 'Onboarding', 'Approved', 'Suspended', 'Inactive', 'Rejected'],
    defaultStatus: 'Prospect',
    editableInCreate: true,
    editableInEdit: true,
  },
  {
    key: 'partner',
    label: 'Partner',
    organizationTypes: ['Partner'],
    allowedStatuses: ['Invited', 'Onboarding', 'Active', 'Paused', 'Inactive'],
    defaultStatus: 'Invited',
    editableInCreate: true,
    editableInEdit: true,
  },
];

/**
 * Get all intent definitions that apply to the given organization types.
 * 
 * @param types - Array of organization type strings (e.g. ['Customer', 'Vendor'])
 * @returns Array of intent definitions that match any of the provided types
 */
export function getOrganizationIntentsForTypes(
  types: string[]
): OrganizationIntentDefinition[] {
  if (!types || types.length === 0) {
    return [];
  }
  
  return ORGANIZATION_INTENT_DEFINITIONS.filter(intent =>
    intent.organizationTypes.some(intentType =>
      types.includes(intentType)
    )
  );
}

/**
 * Get all allowed statuses for the given organization types.
 * Combines statuses from all matching intents and deduplicates.
 * 
 * @param types - Array of organization type strings (e.g. ['Customer', 'Vendor'])
 * @returns Array of unique status strings that are allowed for these types
 */
export function getAllowedStatusesForTypes(types: string[]): string[] {
  const intents = getOrganizationIntentsForTypes(types);
  const statusSet = new Set<string>();
  
  for (const intent of intents) {
    for (const status of intent.allowedStatuses) {
      statusSet.add(status);
    }
  }
  
  return Array.from(statusSet).sort();
}

/**
 * Get the default status for the given organization types.
 * 
 * If multiple intents match and they have different default statuses,
 * returns the first one found (order matters in ORGANIZATION_INTENT_DEFINITIONS).
 * 
 * @param types - Array of organization type strings (e.g. ['Customer'])
 * @returns Default status string, or null if no matching intent found
 */
export function getDefaultStatusForTypes(types: string[]): string | null {
  const intents = getOrganizationIntentsForTypes(types);
  
  if (intents.length === 0) {
    return null;
  }
  
  // Return the first matching intent's default status
  // In case of multiple matches, the first one in the array takes precedence
  return intents[0]?.defaultStatus ?? null;
}

function matchingTypesForStatusField(fieldKey: string, selectedTypes: string[]): string[] {
  if (!ORGANIZATION_INTENT_STATUS_FIELD_KEYS.has(fieldKey)) return [];
  if (!selectedTypes?.length) return [];
  const relevantTypes = getOrganizationTypesForField(fieldKey);
  if (relevantTypes.length === 0) return [];
  return selectedTypes.filter((type) => relevantTypes.includes(type));
}

/** Allowed lifecycle statuses for a type-scoped status field (customerStatus, etc.). */
export function getAllowedStatusesForOrganizationStatusField(
  fieldKey: string,
  selectedTypes: string[]
): string[] {
  const matchingTypes = matchingTypesForStatusField(fieldKey, selectedTypes);
  if (matchingTypes.length === 0) return [];
  return getAllowedStatusesForTypes(matchingTypes);
}

/** Default lifecycle status for a type-scoped status field. */
export function getDefaultStatusForOrganizationStatusField(
  fieldKey: string,
  selectedTypes: string[]
): string | null {
  const matchingTypes = matchingTypesForStatusField(fieldKey, selectedTypes);
  if (matchingTypes.length === 0) return null;
  return getDefaultStatusForTypes(matchingTypes);
}

// ============================================================================
// DEV-ONLY ASSERTIONS
// ============================================================================

if (import.meta.env.DEV) {
  // Assertion 1: Every intent must have at least one type
  for (const intent of ORGANIZATION_INTENT_DEFINITIONS) {
    if (!intent.organizationTypes || intent.organizationTypes.length === 0) {
      throw new Error(
        `[OrganizationIntents] Intent "${intent.key}" must have at least one organizationType`
      );
    }
  }
  
  // Assertion 2: No two intents may define conflicting defaultStatus for the same type
  const typeToDefaultStatus = new Map<string, string>();
  for (const intent of ORGANIZATION_INTENT_DEFINITIONS) {
    for (const orgType of intent.organizationTypes) {
      const existingDefault = typeToDefaultStatus.get(orgType);
      if (existingDefault && existingDefault !== intent.defaultStatus) {
        throw new Error(
          `[OrganizationIntents] Conflicting defaultStatus for type "${orgType}": ` +
          `"${existingDefault}" (from another intent) vs "${intent.defaultStatus}" (from intent "${intent.key}")`
        );
      }
      typeToDefaultStatus.set(orgType, intent.defaultStatus);
    }
  }
  
  // Assertion 3: allowedStatuses must include defaultStatus
  for (const intent of ORGANIZATION_INTENT_DEFINITIONS) {
    if (!intent.allowedStatuses.includes(intent.defaultStatus)) {
      throw new Error(
        `[OrganizationIntents] Intent "${intent.key}" has defaultStatus "${intent.defaultStatus}" ` +
        `which is not in allowedStatuses: [${intent.allowedStatuses.join(', ')}]`
      );
    }
  }
}
