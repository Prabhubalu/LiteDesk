/** Duck-typed — only reads `user?.entitledAddons?.[addonKey]`. */
export function isAddonEntitled(user: unknown, addonKey: string): boolean;
export function isStockroomAddonEntitled(user?: unknown): boolean;
export function isCpqAddonEntitled(user?: unknown): boolean;
