'use strict';

const Notification = require('../models/Notification');
const { deliverNotificationSSE } = require('./notificationSSEDeliver');

function displayName(user) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.email || 'A teammate';
}

async function createInAppNotification({ userId, organizationId, eventType, title, body, appKey = 'SALES' }) {
  if (!userId || !organizationId) return null;

  const doc = await Notification.create({
    userId,
    organizationId,
    appKey,
    sourceAppKey: appKey,
    eventType,
    title,
    body,
    channel: 'IN_APP',
    priority: 'NORMAL',
    source: 'SYSTEM'
  });

  try {
    await deliverNotificationSSE({
      userId,
      organizationId,
      appKey,
      payload: {
        id: String(doc._id),
        appKey,
        eventType,
        title,
        body,
        priority: 'NORMAL',
        createdAt: doc.createdAt
      }
    });
  } catch (err) {
    console.warn('[onboardingInviteNotifications] SSE deliver failed:', err.message);
  }

  return doc;
}

async function notifyInviterInviteAccepted({ inviterId, invitee, organizationId }) {
  if (!inviterId || !invitee) return;

  const name = displayName(invitee);
  await createInAppNotification({
    userId: inviterId,
    organizationId,
    eventType: 'ONBOARDING_INVITE_ACCEPTED',
    title: 'Invitation accepted',
    body: `${name} accepted your invitation and joined the workspace.`
  });
}

async function notifyInviterMemberReady({ inviterId, invitee, organizationId }) {
  if (!inviterId || !invitee) return;

  const name = displayName(invitee);
  await createInAppNotification({
    userId: inviterId,
    organizationId,
    eventType: 'ONBOARDING_MEMBER_READY',
    title: 'Teammate is ready',
    body: `${name} completed getting started.`
  });
}

async function notifyInviterStalledInvite({ inviterId, invitee, organizationId }) {
  if (!inviterId || !invitee) return;

  const name = displayName(invitee);
  await createInAppNotification({
    userId: inviterId,
    organizationId,
    eventType: 'ONBOARDING_INVITE_STALLED',
    title: 'Invitation pending',
    body: `${name} has not accepted your invitation yet. Consider sending a reminder.`
  });
}

module.exports = {
  notifyInviterInviteAccepted,
  notifyInviterMemberReady,
  notifyInviterStalledInvite,
  createInAppNotification
};
