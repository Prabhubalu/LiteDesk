'use strict';

const { isRedisConfigured } = require('../lib/redisClient');

/**
 * Deliver an in-app notification over SSE (local hub and/or Redis cluster fan-out).
 *
 * @param {{ userId: string, organizationId: string, appKey: string, payload: object }} envelope
 */
async function deliverNotificationSSE(envelope) {
  if (!envelope?.userId || !envelope?.organizationId || !envelope?.appKey || !envelope?.payload) {
    return;
  }

  if (isRedisConfigured()) {
    const { publishNotificationToCluster } = require('./notificationSSEPubSub');
    await publishNotificationToCluster(envelope);
    return;
  }

  const notificationSSEHub = require('./notificationSSEHub');
  notificationSSEHub.publish(envelope);
}

module.exports = {
  deliverNotificationSSE
};
