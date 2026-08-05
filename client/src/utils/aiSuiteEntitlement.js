/**
 * Client-side gate for Arivu AI suite (addon key `ai` / legacy ai_* aliases).
 * Mirrors server isAiSuiteEntitledForOrg via login/profile entitledAddons.ai.
 *
 * @param {{ entitledAddons?: { ai?: boolean } | null } | null | undefined} user
 * @returns {boolean}
 */
export function isAiSuiteEntitled(user) {
  // When entitlements have been loaded, require explicit true.
  if (user?.entitledAddons && typeof user.entitledAddons === 'object') {
    return user.entitledAddons.ai === true;
  }
  // No entitlement payload yet — do not mount Astra (avoids speculative
  // /ai/v2/* calls that 401 and wipe a valid CRM session via apiClient logout).
  return false;
}
