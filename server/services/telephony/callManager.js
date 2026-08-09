'use strict';

const TelephonyCall = require('../../models/TelephonyCall');
const TelephonyCallNote = require('../../models/TelephonyCallNote');
const TelephonyRecording = require('../../models/TelephonyRecording');
const TelephonyWebhookReceipt = require('../../models/TelephonyWebhookReceipt');
const { getProviderForOrganization } = require('./telephonyProviderRegistry');
const { identifyCaller } = require('./callerIdentificationService');
const telephonySSEHub = require('./telephonySSEHub');
const telephonyNotificationService = require('./telephonyNotificationService');
const telephonyEventService = require('./telephonyEventService');
const { enqueueTelephonyJob } = require('./telephonyQueueService');

const TERMINAL_STATUSES = new Set([
  'completed',
  'busy',
  'no-answer',
  'failed',
  'canceled',
  'missed',
]);

function mapProviderStatus(status) {
  const s = String(status || '').toLowerCase().replace(/_/g, '-');
  if (s === 'completed' || s === 'complete') return 'completed';
  if (s === 'busy') return 'busy';
  if (s === 'no-answer' || s === 'noanswer') return 'no-answer';
  if (s === 'failed') return 'failed';
  if (s === 'canceled' || s === 'cancelled') return 'canceled';
  if (s === 'in-progress' || s === 'inprogress' || s === 'answered') return 'in-progress';
  if (s === 'queued' || s === 'queue') return 'queued';
  if (s === 'ringing') return 'ringing';
  return s || 'ringing';
}

async function placeOutboundCall({
  organizationId,
  to,
  from = null,
  agentUserId = null,
  url = null,
  statusCallback = null,
  campaignId = null,
  linkedCaseId = null,
}) {
  const adapter = await getProviderForOrganization(organizationId);
  if (!adapter) {
    const err = new Error('No active telephony provider configured');
    err.statusCode = 400;
    throw err;
  }

  const identity = await identifyCaller(organizationId, to);
  const result = await adapter.placeCall({ to, from, url, statusCallback });

  const call = await TelephonyCall.create({
    organizationId,
    providerKey: adapter.providerKey,
    providerCallSid: result.callSid,
    direction: 'outbound',
    status: mapProviderStatus(result.status) || 'queued',
    from: from || adapter.credentials.fromNumber || '',
    to,
    agentUserId: agentUserId || null,
    startedAt: new Date(),
    campaignId: campaignId || null,
    linkedPersonId: identity.linkedPersonId,
    linkedLeadId: identity.linkedLeadId,
    linkedOrganizationId: identity.linkedOrganizationId,
    linkedDealId: identity.linkedDealId,
    linkedCaseId: linkedCaseId || identity.linkedCaseId,
    providerMeta: { placeResult: { status: result.status } },
  });

  telephonySSEHub.publishToOrg(organizationId, {
    type: 'CallAnswered',
    callId: String(call._id),
    direction: 'outbound',
    status: call.status,
  });

  return call;
}

async function handleNormalizedWebhook({
  organizationId,
  providerKey,
  event,
  adapter = null,
}) {
  if (!organizationId || !event?.eventId) {
    return { processed: false, reason: 'invalid_event' };
  }

  try {
    await TelephonyWebhookReceipt.create({
      organizationId,
      providerKey,
      providerEventId: event.eventId,
      eventType: event.eventType || '',
      processedAt: new Date(),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return { processed: false, reason: 'duplicate' };
    }
    throw err;
  }

  const callSid = event.callSid;
  let call = null;
  if (callSid) {
    call = await TelephonyCall.findOne({ organizationId, providerCallSid: callSid });
  }

  const status = mapProviderStatus(event.status);
  const direction = event.direction || (call?.direction) || 'inbound';

  if (!call && direction === 'inbound' && callSid) {
    const identity = await identifyCaller(organizationId, event.from);
    call = await TelephonyCall.create({
      organizationId,
      providerKey,
      providerCallSid: callSid,
      direction: 'inbound',
      status: status || 'ringing',
      from: event.from || '',
      to: event.to || '',
      startedAt: new Date(),
      linkedPersonId: identity.linkedPersonId,
      linkedLeadId: identity.linkedLeadId,
      linkedOrganizationId: identity.linkedOrganizationId,
      linkedDealId: identity.linkedDealId,
      linkedCaseId: identity.linkedCaseId,
      providerMeta: { firstEvent: event.eventType, display: identity.display },
    });

    telephonySSEHub.publishToOrg(organizationId, {
      type: 'IncomingCall',
      callId: String(call._id),
      from: call.from,
      to: call.to,
      display: identity.display,
    });
    telephonyEventService.emitIncomingCall({
      organizationId,
      callId: call._id,
      metadata: {
        from: call.from,
        to: call.to,
        providerCallSid: callSid,
        display: identity.display,
      },
    });
    await telephonyNotificationService.notifyIncomingCall({ organizationId, call });
  }

  if (!call) {
    return { processed: true, reason: 'no_call_match', call: null };
  }

  const previousStatus = call.status;

  if (status === 'in-progress' && previousStatus !== 'in-progress') {
    call.status = 'in-progress';
    call.answeredAt = call.answeredAt || new Date();
    await call.save();
    telephonySSEHub.publishToOrg(organizationId, {
      type: 'CallAnswered',
      callId: String(call._id),
    });
    telephonyEventService.emitCallAnswered({
      organizationId,
      callId: call._id,
      metadata: { status: call.status, answeredAt: call.answeredAt },
    });
  } else if (TERMINAL_STATUSES.has(status)) {
    const wasMissed =
      status === 'no-answer' ||
      status === 'busy' ||
      status === 'canceled' ||
      (status === 'completed' && !call.answeredAt && direction === 'inbound');

    call.status = wasMissed && status !== 'completed' ? (status === 'no-answer' ? 'missed' : status) : status;
    if (wasMissed && direction === 'inbound' && (status === 'no-answer' || status === 'canceled')) {
      call.status = 'missed';
    }
    call.endedAt = new Date();
    if (event.durationSeconds != null) {
      call.durationSeconds = event.durationSeconds;
    } else if (call.answeredAt) {
      call.durationSeconds = Math.max(
        0,
        Math.round((call.endedAt - call.answeredAt) / 1000)
      );
    }
    await call.save();

    if (call.status === 'missed') {
      telephonySSEHub.publishToOrg(organizationId, {
        type: 'CallMissed',
        callId: String(call._id),
      });
      telephonyEventService.emitCallMissed({
        organizationId,
        callId: call._id,
        metadata: { from: call.from, to: call.to, status: call.status },
      });
      await telephonyNotificationService.notifyMissedCall({ organizationId, call });
    } else {
      telephonySSEHub.publishToOrg(organizationId, {
        type: 'CallEnded',
        callId: String(call._id),
        status: call.status,
        durationSeconds: call.durationSeconds,
      });
    }

    telephonyEventService.emitCallEnded({
      organizationId,
      callId: call._id,
      metadata: {
        status: call.status,
        durationSeconds: call.durationSeconds,
        from: call.from,
        to: call.to,
      },
    });

    try {
      const { recordCallActivity } = require('./callActivityAdapter');
      await recordCallActivity({ organizationId, call });
    } catch (err) {
      console.warn('[callManager] activity adapter failed', err.message);
    }
  } else if (status && status !== previousStatus) {
    call.status = status;
    await call.save();
  }

  if (event.recordingUrl || event.recordingSid) {
    let recording = await TelephonyRecording.findOne({
      organizationId,
      callId: call._id,
      providerRecordingSid: event.recordingSid || null,
    });
    if (!recording) {
      recording = await TelephonyRecording.create({
        organizationId,
        callId: call._id,
        providerKey,
        providerRecordingSid: event.recordingSid || null,
        storageKey: event.recordingUrl || null,
        encryptionStatus: 'pending',
        durationSeconds: event.durationSeconds,
      });
      call.recordingId = recording._id;
      await call.save();
    }

    enqueueTelephonyJob('ingestRecording', {
      organizationId: String(organizationId),
      callId: String(call._id),
      recordingId: String(recording._id),
      recordingUrl: event.recordingUrl || null,
    });

    telephonySSEHub.publishToOrg(organizationId, {
      type: 'RecordingReady',
      callId: String(call._id),
      recordingId: String(recording._id),
    });
    telephonyEventService.emitRecordingReady({
      organizationId,
      callId: call._id,
      metadata: { recordingId: String(recording._id) },
    });
    await telephonyNotificationService.notifyRecordingReady({
      organizationId,
      call,
      recording,
    });
  }

  void adapter;
  return { processed: true, call };
}

async function hangUp({ organizationId, callId }) {
  const call = await TelephonyCall.findOne({ _id: callId, organizationId });
  if (!call) {
    const err = new Error('Call not found');
    err.statusCode = 404;
    throw err;
  }
  const adapter = await getProviderForOrganization(organizationId);
  if (adapter && call.providerCallSid) {
    await adapter.hangUp(call.providerCallSid);
  }
  call.status = 'completed';
  call.endedAt = new Date();
  await call.save();
  telephonySSEHub.publishToOrg(organizationId, {
    type: 'CallEnded',
    callId: String(call._id),
  });
  return call;
}

async function mute({ organizationId, callId }) {
  const call = await getCall(organizationId, callId);
  const adapter = await getProviderForOrganization(organizationId);
  if (adapter && call.providerCallSid) {
    try {
      await adapter.mute(call.providerCallSid);
    } catch (err) {
      // Client-side mute providers (e.g. Twilio Device) may no-op or signal unsupported.
      if (err?.name !== 'UnsupportedProviderCapabilityError') throw err;
    }
  }
  return call;
}

async function hold({ organizationId, callId, resume = false }) {
  const call = await getCall(organizationId, callId);
  const adapter = await getProviderForOrganization(organizationId);
  if (adapter && call.providerCallSid) {
    if (resume && typeof adapter.resume === 'function') {
      await adapter.resume(call.providerCallSid);
    } else {
      await adapter.hold(call.providerCallSid);
    }
  }
  telephonySSEHub.publishToOrg(organizationId, {
    type: resume ? 'CallResumed' : 'CallHeld',
    callId: String(call._id),
  });
  return call;
}

async function transfer({ organizationId, callId, to }) {
  const call = await getCall(organizationId, callId);
  const adapter = await getProviderForOrganization(organizationId);
  if (!adapter || !call.providerCallSid) {
    const err = new Error('No active provider or call SID for transfer');
    err.statusCode = 400;
    throw err;
  }
  await adapter.transfer(call.providerCallSid, to);
  telephonySSEHub.publishToOrg(organizationId, {
    type: 'CallTransferred',
    callId: String(call._id),
    to,
  });
  return call;
}

async function getCall(organizationId, callId) {
  const call = await TelephonyCall.findOne({ _id: callId, organizationId }).lean();
  if (!call) {
    const err = new Error('Call not found');
    err.statusCode = 404;
    throw err;
  }
  return call;
}

async function listCalls(organizationId, { limit = 50, skip = 0, status, agentUserId } = {}) {
  const filter = { organizationId };
  if (status) filter.status = status;
  if (agentUserId) filter.agentUserId = agentUserId;
  const rows = await TelephonyCall.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Math.min(Number(limit) || 50, 200))
    .lean();
  const total = await TelephonyCall.countDocuments(filter);
  return { rows, total };
}

async function attachNotes({
  organizationId,
  callId,
  userId,
  notes,
  disposition = null,
  followUpDate = null,
  nextAction = null,
}) {
  const call = await TelephonyCall.findOne({ _id: callId, organizationId });
  if (!call) {
    const err = new Error('Call not found');
    err.statusCode = 404;
    throw err;
  }
  const note = await TelephonyCallNote.create({
    organizationId,
    callId,
    userId,
    notes: notes || '',
    disposition,
    followUpDate,
    nextAction,
  });
  if (disposition) {
    call.disposition = disposition;
    await call.save();
  }
  return note;
}

module.exports = {
  placeOutboundCall,
  handleNormalizedWebhook,
  hangUp,
  mute,
  hold,
  transfer,
  getCall,
  listCalls,
  attachNotes,
  mapProviderStatus,
};
