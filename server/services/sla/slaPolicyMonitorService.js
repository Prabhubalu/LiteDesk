'use strict';

const SlaInstance = require('../../models/SlaInstance');
const SlaPolicy = require('../../models/SlaPolicy');
const { computeInstanceProgress, WARNING_THRESHOLD_PERCENT } = require('./slaPolicyClockService');
const { resolveSlaScheduleForOrganization } = require('../helpdeskBusinessHoursService');
const { appendLog } = require('./slaPolicyEngine');
const {
  getOrganizationNotificationPrefs,
  emitSlaInstanceNotification,
  processInstanceEscalation,
  loadCaseForInstance
} = require('./slaPolicyNotificationService');

async function tickSlaPolicyInstances({ limit = 500 } = {}) {
  const rows = await SlaInstance.find({
    status: { $in: ['running', 'paused'] }
  })
    .select('_id organizationId policyId policyKey moduleKey recordId status policySnapshot targetAt alertsSent escalationState')
    .limit(limit)
    .lean();

  const scheduleCache = new Map();
  const prefsCache = new Map();
  const policyCache = new Map();
  const caseCache = new Map();
  let breached = 0;
  let warnings = 0;
  let escalationsSent = 0;

  for (const row of rows) {
    const orgKey = String(row.organizationId);
    if (!scheduleCache.has(orgKey)) {
      scheduleCache.set(orgKey, await resolveSlaScheduleForOrganization(row.organizationId));
    }
    const progress = computeInstanceProgress(row, scheduleCache.get(orgKey));
    if (progress.met || progress.elapsedPercent == null) continue;

    const prefs = await getOrganizationNotificationPrefs(row.organizationId, prefsCache);
    const warningKey = `warning_${row.milestoneKey}`;
    const breachKey = `breach_${row.milestoneKey}`;

    if (progress.elapsedPercent >= 100 && row.status !== 'breached') {
      await SlaInstance.updateOne(
        { _id: row._id },
        { $set: { status: 'breached', breachedAt: new Date(), stoppedAt: new Date() } }
      );
      await appendLog({
        organizationId: row.organizationId,
        instanceId: row._id,
        policyKey: row.policyKey,
        moduleKey: row.moduleKey,
        recordId: row.recordId,
        eventType: 'breached',
        payload: { elapsedPercent: progress.elapsedPercent, milestoneKey: row.milestoneKey }
      });

      if (prefs.notifyOnSlaBreach && !row.alertsSent?.[breachKey]) {
        const caseKey = `${row.recordId}`;
        if (!caseCache.has(caseKey)) {
          caseCache.set(caseKey, await loadCaseForInstance(row));
        }
        await emitSlaInstanceNotification({
          caseRecord: caseCache.get(caseKey),
          instance: row,
          type: 'breach',
          elapsedPercent: progress.elapsedPercent
        });
        await SlaInstance.updateOne(
          { _id: row._id },
          { $set: { [`alertsSent.${breachKey}`]: new Date() } }
        );
      }
      breached += 1;
    } else if (
      prefs.notifyOnSlaWarning &&
      progress.elapsedPercent >= WARNING_THRESHOLD_PERCENT &&
      progress.elapsedPercent < 100 &&
      !row.alertsSent?.[warningKey]
    ) {
      const caseKey = `${row.recordId}`;
      if (!caseCache.has(caseKey)) {
        caseCache.set(caseKey, await loadCaseForInstance(row));
      }
      await emitSlaInstanceNotification({
        caseRecord: caseCache.get(caseKey),
        instance: row,
        type: 'warning',
        elapsedPercent: progress.elapsedPercent
      });
      await SlaInstance.updateOne(
        { _id: row._id },
        { $set: { [`alertsSent.${warningKey}`]: new Date() } }
      );
      await appendLog({
        organizationId: row.organizationId,
        instanceId: row._id,
        policyKey: row.policyKey,
        moduleKey: row.moduleKey,
        recordId: row.recordId,
        eventType: 'notified',
        payload: { type: 'warning', elapsedPercent: progress.elapsedPercent, milestoneKey: row.milestoneKey }
      });
      warnings += 1;
    }

    if (progress.elapsedPercent >= WARNING_THRESHOLD_PERCENT) {
      const policyKey = String(row.policyId);
      if (!policyCache.has(policyKey)) {
        policyCache.set(policyKey, await SlaPolicy.findById(row.policyId).lean());
      }
      const policy = policyCache.get(policyKey);
      const caseKey = `${row.recordId}`;
      if (!caseCache.has(caseKey)) {
        caseCache.set(caseKey, await loadCaseForInstance(row));
      }
      const escalationResult = await processInstanceEscalation({
        instance: row,
        caseRecord: caseCache.get(caseKey),
        policy
      });
      if (escalationResult) {
        await SlaInstance.updateOne(
          { _id: row._id },
          { $set: { escalationState: escalationResult } }
        );
        await appendLog({
          organizationId: row.organizationId,
          instanceId: row._id,
          policyKey: row.policyKey,
          moduleKey: row.moduleKey,
          recordId: row.recordId,
          eventType: 'escalated',
          payload: { stepIndex: escalationResult.stepIndex - 1 }
        });
        escalationsSent += 1;
      }
    }
  }

  return { scanned: rows.length, breached, warnings, escalationsSent };
}

module.exports = {
  tickSlaPolicyInstances
};
