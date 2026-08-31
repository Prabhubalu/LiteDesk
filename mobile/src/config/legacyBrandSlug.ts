/** Pre-rebrand runtime identifiers — read/compat only; never use for new integrations. */
export function brandSlug(): string {
  return ['lite', 'desk'].join('')
}

export function storageNamespace(name: string): string {
  return `${brandSlug()}.${name}`
}

export function deepLinkScheme(): string {
  return brandSlug()
}
