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
  // Legacy session without entitledAddons payload — do not hard-hide.
  return true;
}
