'use strict';

/**
 * ATIP Connection Engine — pairing, discovery health, checklist, reconnect.
 */

const crypto = require('crypto');
const tallyConnectionService = require('../tallyConnectionService');
const TallyConnection = require('../../../../models/TallyConnection');
const TallyCompanyBinding = require('../../../../models/TallyCompanyBinding');
const { ATIP_HEALTH_STATES } = require('../../../../constants/atipConstants');
const { isSupportedTallyVersion } = require('../../../../constants/tallyVersionMatrix');

function buildChecklistFromHealth(health = {}) {
  const checks = Array.isArray(health.checks) ? health.checks : [];
  const byId = Object.fromEntries(checks.map((c) => [c.id || c.key || c.name, c]));
  const pick = (id, fallbackOk = false) => {
    const c = byId[id];
    if (!c) return { id, ok: fallbackOk, message: 'Not reported' };
    return {
      id,
      ok: c.ok !== false && c.status !== 'fail' && c.status !== 'error',
      message: c.message || c.detail || null,
      raw: c,
    };
  };

  const versionOk = health.tallyVersion ? isSupportedTallyVersion(health.tallyVersion) : false;

  return {
    tallyRunning: pick('tally_running', Boolean(health.tallyRunning)),
    portListening: pick('xml_port', Boolean(health.port || health.xmlPort)),
    versionSupported: {
      id: 'version',
      ok: Boolean(versionOk),
      message: versionOk ? 'Supported' : 'Unsupported or unknown Tally version',
      tallyVersion: health.tallyVersion || null,
    },
    companyOpen: pick('company_open', Boolean((health.companies || []).length)),
    tdlLoaded: pick('tdl_loaded', Boolean(health.tdlLoaded || health.tdlPackVersion)),
    xmlPermissions: pick('xml_permissions', true),
    licenseOk: pick('license', health.licenseStatus !== 'invalid'),
    updatedAt: new Date().toISOString(),
  };
}

function deriveHealthState({ connection, checklist, bindings = [] }) {
  if (!connection || connection.status === 'revoked') return 'offline';
  if (connection.status === 'offline' || connection.status === 'pending_pair') {
    return connection.status === 'pending_pair' ? 'searching' : 'offline';
  }
  if (connection.status === 'paired' && !connection.heartbeatAt) return 'searching';

  const required = ['tallyRunning', 'portListening', 'versionSupported', 'companyOpen'];
  const allRequiredOk = required.every((k) => checklist?.[k]?.ok);
  const activeBindings = bindings.filter((b) => b.enabled && b.boundAt);
  const metadataReady = activeBindings.every(
    (b) => b.activeMetadataSnapshotId && b.healthState === 'ready'
  );

  if (!allRequiredOk) {
    if (checklist?.tallyRunning?.ok || checklist?.portListening?.ok) return 'found';
    return connection.status === 'online' ? 'degraded' : 'searching';
  }
  if (activeBindings.length === 0) return 'found';
  if (!metadataReady) return 'metadata_pending';
  return 'ready';
}

async function getConnection({ organizationId }) {
  return tallyConnectionService.getConnection(organizationId);
}

async function startPairing(args) {
  return tallyConnectionService.createPairingCode(args);
}

async function completePairing(args) {
  return tallyConnectionService.completePairing(args);
}

async function recordHeartbeat({ organizationId, agentDeviceId, health = {}, agentVersion, agentHostname }) {
  const result = await tallyConnectionService.recordHeartbeat({
    organizationId,
    agentDeviceId,
    agentVersion,
    metadata: {
      health,
      agentHostname: agentHostname || null,
      atipHeartbeat: true,
    },
  });

  const connection = await TallyConnection.findOne({
    organizationId,
    revokedAt: null,
  }).sort({ updatedAt: -1 });

  if (!connection) return { connection: result, healthState: 'offline', checklist: {}, companyChanged: false };

  const checklist = buildChecklistFromHealth(health);
  const companyFingerprint = crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        (health.companies || []).map((c) => ({
          guid: c.guid || c.companyGuid,
          name: c.name || c.companyName,
          fy: c.financialYear || c.fy,
        }))
      )
    )
    .digest('hex')
    .slice(0, 32);

  const companyChanged =
    connection.lastCompanyFingerprint &&
    connection.lastCompanyFingerprint !== companyFingerprint;

  const bindings = await TallyCompanyBinding.find({ organizationId, connectionId: connection._id });
  const healthState = deriveHealthState({ connection, checklist, bindings });

  connection.validationChecklist = checklist;
  connection.healthState = healthState;
  connection.lastCompanyFingerprint = companyFingerprint;
  connection.metadata = {
    ...(connection.metadata || {}),
    lastHealth: {
      tallyVersion: health.tallyVersion || null,
      port: health.port || health.xmlPort || null,
      tdlPackVersion: health.tdlPackVersion || null,
      companyChanged,
      at: new Date().toISOString(),
    },
  };
  await connection.save();

  return {
    ...result,
    healthState,
    checklist,
    companyChanged,
  };
}

async function getWizardState({ organizationId }) {
  const connection = await getConnection({ organizationId });
  const bindings = connection
    ? await TallyCompanyBinding.find({ organizationId, connectionId: connection._id }).lean()
    : [];
  const checklist = connection?.validationChecklist || {};
  const healthState = connection?.healthState || 'searching';

  // Later steps must not appear complete until prior ones are.
  const rawSteps = [
    { id: 'connect', label: 'Connect Tally', done: Boolean(connection && connection.status !== 'pending_pair' && connection.status !== 'revoked') },
    { id: 'detect_company', label: 'Detect company', done: bindings.some((b) => b.companyGuid) },
    { id: 'scan_metadata', label: 'Scan metadata', done: bindings.some((b) => b.activeMetadataSnapshotId) },
    { id: 'ai_mappings', label: 'AI field mappings', done: bindings.some((b) => b.activeMappingVersionId) },
    { id: 'review', label: 'Review suggestions', done: healthState === 'ready' || bindings.some((b) => b.enabled && b.activeMappingVersionId) },
    { id: 'start_sync', label: 'Start synchronisation', done: bindings.some((b) => b.lastSyncAt) },
    { id: 'progress', label: 'Live progress', done: healthState === 'ready' && bindings.some((b) => b.lastSyncAt) },
    { id: 'complete', label: 'Integration complete', done: healthState === 'ready' && bindings.some((b) => b.enabled && b.lastSyncAt) },
  ];

  let locked = false;
  const steps = rawSteps.map((s) => {
    if (locked) return { ...s, done: false };
    if (!s.done) {
      locked = true;
      return { ...s, done: false };
    }
    return { ...s, done: true };
  });

  const currentStep = steps.find((s) => !s.done)?.id || 'complete';

  return {
    healthState,
    checklist,
    connection: connection
      ? {
          id: String(connection._id),
          status: connection.status,
          healthState: connection.healthState,
          agentVersion: connection.agentVersion,
          heartbeatAt: connection.heartbeatAt,
        }
      : null,
    bindings: bindings.map((b) => ({
      companyGuid: b.companyGuid,
      companyName: b.companyName,
      enabled: b.enabled,
      healthState: b.healthState,
      boundAt: b.boundAt,
      activeMetadataSnapshotId: b.activeMetadataSnapshotId,
      activeMappingVersionId: b.activeMappingVersionId,
    })),
    steps,
    currentStep,
    ready: healthState === 'ready',
    healthStates: ATIP_HEALTH_STATES,
  };
}

async function setBindingHealth({ organizationId, companyGuid, healthState, checklist = null }) {
  const update = { healthState };
  if (checklist) update.validationChecklist = checklist;
  return TallyCompanyBinding.findOneAndUpdate(
    { organizationId, companyGuid },
    { $set: update },
    { new: true }
  );
}

module.exports = {
  getConnection,
  startPairing,
  completePairing,
  recordHeartbeat,
  getWizardState,
  buildChecklistFromHealth,
  deriveHealthState,
  setBindingHealth,
};
