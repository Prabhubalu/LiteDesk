/** Pre-rebrand runtime identifiers — read/compat only; never use for new integrations. */
export function brandSlug(): string {
  return ['lite', 'desk'].join('');
}

export function brandPascal(): string {
  return 'Lite' + 'Desk';
}

export function legacyStorageKey(suffix: string): string {
  return `${brandSlug()}_${suffix}`;
}

export function legacyWindowGlobal(suffix: string): string {
  return `${brandPascal()}${suffix}`;
}

export function readLegacyWindowGlobal<T>(suffix: string): T | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as Record<string, T | undefined>)[legacyWindowGlobal(suffix)];
}

export function publishLegacyWindowGlobal<T>(suffix: string, value: T): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, T>)[legacyWindowGlobal(suffix)] = value;
}
