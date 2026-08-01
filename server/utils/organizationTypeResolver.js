/**
 * Resolve organization participation types across enabled apps.
 * Pure metadata resolver (mirrors peopleTypeResolver).
 */

const moduleProjections = require('../constants/moduleProjections');
const {
  ORGANIZATION_PARTICIPATION_BY_APP,
  ORGANIZATION_PARTICIPATION_APP_KEYS,
  resolveAvailableOrganizationRoles,
  normalizeAppKeySet,
} = require('../constants/organizationParticipation');

function normalizeAppKeys(maybeKeys) {
  if (!Array.isArray(maybeKeys)) return [];
  return [
    ...normalizeAppKeySet(maybeKeys),
  ];
}

/**
 * @param {{ enabledApps?: string[]|object[], appRegistry?: object }} options
 */
function resolveOrganizationTypes({ enabledApps = [], appRegistry = {} } = {}) {
  const projection = moduleProjections?.ORGANIZATION;
  const normalizedEnabled = normalizeAppKeys(enabledApps);
  const byApp = {};

  const appEntries =
    projection?.apps && typeof projection.apps === 'object'
      ? Object.entries(projection.apps)
      : ORGANIZATION_PARTICIPATION_APP_KEYS.map((k) => [
          k,
          {
            allowedTypes: (ORGANIZATION_PARTICIPATION_BY_APP[k]?.allowedTypes || []).map((t) =>
              String(t).toUpperCase().replace(/\s+/g, '_')
            ),
          },
        ]);

  for (const [rawAppKey, appConfig] of appEntries) {
    const appKey = String(rawAppKey).toUpperCase();
    if (normalizedEnabled.length > 0 && !normalizedEnabled.includes(appKey)) {
      continue;
    }
    if (
      appRegistry &&
      typeof appRegistry === 'object' &&
      Object.keys(appRegistry).length > 0 &&
      !appRegistry[appKey] &&
      !appRegistry[appKey.toLowerCase()]
    ) {
      continue;
    }

    const fromParticipation = ORGANIZATION_PARTICIPATION_BY_APP[appKey];
    const types = fromParticipation
      ? [...fromParticipation.allowedTypes]
      : Array.isArray(appConfig?.allowedTypes)
        ? appConfig.allowedTypes.map((t) => String(t))
        : [];

    byApp[appKey] = {
      appKey,
      types,
      defaultType: fromParticipation?.defaultType || types[0] || null,
      readOnly: Boolean(appConfig?.readOnly),
    };
  }

  const aggregatedMap = new Map();
  for (const entry of Object.values(byApp)) {
    for (const typeKey of entry.types) {
      const key = String(typeKey);
      if (!aggregatedMap.has(key)) {
        aggregatedMap.set(key, { typeKey: key, owningApps: [] });
      }
      aggregatedMap.get(key).owningApps.push(entry.appKey);
    }
  }

  return {
    byApp,
    aggregated: [...aggregatedMap.values()],
    availableRoles: resolveAvailableOrganizationRoles(enabledApps),
  };
}

module.exports = {
  resolveOrganizationTypes,
  normalizeAppKeys,
};
