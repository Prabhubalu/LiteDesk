'use strict';

const { emitNotification } = require('../notificationEngine');
const domainEvents = require('../../constants/domainEvents');

async function notifyIncomingCall({ organizationId, call, actorId = null }) {
  if (!organizationId || !call?._id) return;
  try {
    await emitNotification({
      eventType: domainEvents.TELEPHONY_INCOMING_CALL,
      entity: {
        type: 'TelephonyCall',
        id: String(call._id),
        title: `Incoming call from ${call.from || 'Unknown'}`,
        from: call.from || '',
        to: call.to || '',
        providerCallSid: call.providerCallSid || '',
      },
      organizationId,
      triggeredBy: actorId,
      sourceAppKey: 'PLATFORM',
    });
  } catch (error) {
    console.error('[telephonyNotificationService] incoming notify failed:', error.message);
  }
}

async function notifyMissedCall({ organizationId, call, actorId = null }) {
  if (!organizationId || !call?._id) return;
  try {
    await emitNotification({
      eventType: domainEvents.TELEPHONY_CALL_MISSED,
      entity: {
        type: 'TelephonyCall',
        id: String(call._id),
        title: `Missed call from ${call.from || 'Unknown'}`,
        from: call.from || '',
        to: call.to || '',
        providerCallSid: call.providerCallSid || '',
      },
      organizationId,
      triggeredBy: actorId,
      sourceAppKey: 'PLATFORM',
    });
  } catch (error) {
    console.error('[telephonyNotificationService] missed notify failed:', error.message);
  }
}

async function notifyRecordingReady({ organizationId, call, recording, actorId = null }) {
  if (!organizationId || !call?._id) return;
  try {
    await emitNotification({
      eventType: domainEvents.TELEPHONY_RECORDING_READY,
      entity: {
        type: 'TelephonyRecording',
        id: recording?._id ? String(recording._id) : String(call._id),
        title: `Recording ready for call ${call.from || ''} → ${call.to || ''}`,
        callId: String(call._id),
        providerCallSid: call.providerCallSid || '',
      },
      organizationId,
      triggeredBy: actorId,
      sourceAppKey: 'PLATFORM',
    });
  } catch (error) {
    console.error('[telephonyNotificationService] recording notify failed:', error.message);
  }
}

module.exports = {
  notifyIncomingCall,
  notifyMissedCall,
  notifyRecordingReady,
};
