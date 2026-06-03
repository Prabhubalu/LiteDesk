import { uid } from './httpAssert.mjs';

export function dealCreateBody(overrides = {}) {
  const close = new Date();
  close.setDate(close.getDate() + 30);
  return {
    name: `ATP Deal ${uid()}`,
    amount: 1000,
    currency: 'USD',
    expectedCloseDate: close.toISOString(),
    ...overrides,
  };
}

export function activityLogBody(overrides = {}) {
  return {
    user: 'ATP Test User',
    action: 'note',
    details: { source: 'atp' },
    ...overrides,
  };
}

export function registerBody(email, overrides = {}) {
  return {
    username: `atp-${uid()}`,
    email,
    password: 'AtpTest!Register1',
    vertical: 'technology',
    organizationName: `ATP Org ${uid()}`,
    ...overrides,
  };
}
