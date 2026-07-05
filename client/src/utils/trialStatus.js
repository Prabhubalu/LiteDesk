/**
 * Returns true when the organization is on trial and the trial end date has passed.
 */
export function isOrganizationTrialExpired(organization) {
  const subscription = organization?.subscription;
  if (!subscription || subscription.status !== 'trial') {
    return false;
  }
  if (!subscription.trialEndDate) {
    return false;
  }
  return new Date() > new Date(subscription.trialEndDate);
}

export function hasUsedTrialExtension(organization) {
  return organization?.subscription?.trialExtensionUsed === true;
}

/**
 * Merge authoritative trial snapshot from the server into local organization state.
 */
export function applyTrialSnapshotToOrganization(organization, snapshot) {
  if (!organization || !snapshot) return organization;

  const subscription = { ...(organization.subscription || {}) };

  if (snapshot.trialEndDate != null) {
    subscription.trialEndDate = snapshot.trialEndDate;
  }
  if (snapshot.extensionUsed === true) {
    subscription.trialExtensionUsed = true;
  }
  if (snapshot.subscriptionStatus) {
    subscription.status = snapshot.subscriptionStatus;
  } else if (snapshot.expired === false) {
    const currentStatus = subscription.status;
    if (!currentStatus || currentStatus === 'trial' || currentStatus === 'expired') {
      subscription.status = 'trial';
    }
  }

  return { ...organization, subscription };
}

export function isTrialExpiredRoute(route) {
  return route?.name === 'trial-expired' || route?.path === '/trial-expired';
}

export function isSubscribeSettingsRoute(route) {
  if (!route?.path?.startsWith('/settings')) {
    return false;
  }
  const tab = route.query?.tab;
  return tab === 'subscriptions';
}

export function canAccessWhileTrialExpired(route) {
  return isTrialExpiredRoute(route) || isSubscribeSettingsRoute(route);
}
