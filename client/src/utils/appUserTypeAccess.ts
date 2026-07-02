/**
 * Mirrors server/constants/appRegistry.js userTypesAllowed for client-side
 * navigation and entitlement checks. Keep in sync with appRegistry.js.
 */
const APP_USER_TYPES_ALLOWED: Record<string, readonly string[]> = {
  SALES: ['INTERNAL'],
  HELPDESK: ['INTERNAL'],
  PROJECTS: ['INTERNAL'],
  AUDIT: ['INTERNAL', 'EXTERNAL'],
  PORTAL: ['EXTERNAL'],
  INVENTORY: ['INTERNAL'],
  MARKETING: ['INTERNAL'],
};

function normalizeAppKey(appKey: string): string {
  return String(appKey || '').trim().toUpperCase();
}

function normalizeUserType(userType: string | undefined): string {
  return String(userType || 'INTERNAL').trim().toUpperCase();
}

export function validateUserTypeForApp(userType: string | undefined, appKey: string): boolean {
  const normalizedAppKey = normalizeAppKey(appKey);
  const allowed = APP_USER_TYPES_ALLOWED[normalizedAppKey];
  if (!allowed) return false;
  return allowed.includes(normalizeUserType(userType));
}
