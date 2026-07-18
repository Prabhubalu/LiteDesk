type OrganizationLike = {
  capabilities?: {
    portalFrameworkV1?: boolean;
  };
  settings?: {
    portalFrameworkV1Enabled?: boolean;
  };
} | null | undefined;

/**
 * Portal Framework v1 UI gate.
 * Prefers server-resolved `organization.capabilities.portalFrameworkV1`
 * (same logic as server `isPortalFrameworkV1Enabled`).
 * Fallback: `VITE_PORTAL_FRAMEWORK_V1`, then org setting.
 */
export function isPortalFrameworkV1Enabled(organization?: OrganizationLike): boolean {
  const resolved = organization?.capabilities?.portalFrameworkV1;
  if (resolved === true) return true;
  if (resolved === false) return false;

  const env = import.meta.env.VITE_PORTAL_FRAMEWORK_V1;
  if (env === 'true') return true;
  if (env === 'false') return false;

  return organization?.settings?.portalFrameworkV1Enabled === true;
}
