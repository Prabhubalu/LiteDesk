/** Duck-typed — only reads `user?.entitledAddons?.[addonKey]` (+ userType for internal_chat). */
export function isAddonEntitled(user: unknown, addonKey: string): boolean;
export function canAccessInternalChat(user?: unknown): boolean;
export function isStockroomAddonEntitled(user?: unknown): boolean;
export function isCpqAddonEntitled(user?: unknown): boolean;
