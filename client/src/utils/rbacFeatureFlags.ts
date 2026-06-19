type OrganizationLike = {
  settings?: {
    rbacV2Enabled?: boolean;
    sharingV1Enabled?: boolean;
  };
} | null | undefined;

/**
 * RBAC v2 UI gate — mirrors server `isRbacV2Enabled`.
 * Env `VITE_RBAC_V2` overrides org setting for local dev.
 */
export function isRbacV2Enabled(organization?: OrganizationLike): boolean {
  const env = import.meta.env.VITE_RBAC_V2;
  if (env === 'true') return true;
  if (env === 'false') return false;
  return organization?.settings?.rbacV2Enabled === true;
}

export function isSharingV1Enabled(organization?: OrganizationLike): boolean {
  const env = import.meta.env.VITE_SHARING_V1;
  if (env === 'true') return true;
  if (env === 'false') return false;
  return organization?.settings?.sharingV1Enabled === true;
}
