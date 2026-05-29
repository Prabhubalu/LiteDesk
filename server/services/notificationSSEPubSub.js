'use strict';

/**
 * Cross-instance fan-out for notification SSE (Railway/K8s multi-replica).
 * Without Redis, callers fall back to in-process notificationSSEHub.publish only.
 */

const { createClient } = require('redis');
const { buildRedisUrl, isRedisConfigured } = require('../lib/redisClient');

const CHANNEL = 'arivu:notification:sse';
const INSTANCE_ID = `inst_${process.pid}_${Date.now()}`;

let subscriberClient = null;
let publisherClient = null;
let subscriberStarted = false;

async function getPublisher() {
  if (!isRedisConfigured()) return null;
  if (publisherClient?.isOpen) return publisherClient;
  const url = buildRedisUrl();
  publisherClient = createClient({ url });
  publisherClient.on('error', (err) => {
    console.error('[notificationSSEPubSub] publisher error:', err.message);
  });
  await publisherClient.connect();
  return publisherClient;
}

/**
 * Publish to Redis so every API replica can push to its local SSE subscribers.
 * @param {{ userId: string, organizationId: string, appKey: string, payload: object }} envelope
 */
async function publishNotificationToCluster(envelope) {
  if (!envelope?.userId || !envelope?.organizationId || !envelope?.appKey || !envelope?.payload) {
    return false;
  }
  if (!isRedisConfigured()) return false;

  try {
    const pub = await getPublisher();
    if (!pub) return false;
    await pub.publish(
      CHANNEL,
      JSON.stringify({ ...envelope, originInstanceId: INSTANCE_ID })
    );
    return true;
  } catch (err) {
    console.error('[notificationSSEPubSub] publish failed:', err.message);
    return false;
  }
}

/**
 * Subscribe once per process; deliver to local notificationSSEHub.
 */
async function startNotificationSSESubscriber() {
  if (subscriberStarted || !isRedisConfigured()) return;
  subscriberStarted = true;

  const notificationSSEHub = require('./notificationSSEHub');
  const url = buildRedisUrl();

  subscriberClient = createClient({ url });
  subscriberClient.on('error', (err) => {
    console.error('[notificationSSEPubSub] subscriber error:', err.message);
  });

  await subscriberClient.connect();
  await subscriberClient.subscribe(CHANNEL, (message) => {
    try {
      const envelope = JSON.parse(message);
      if (!envelope?.userId || !envelope?.payload) return;
      notificationSSEHub.publish({
        userId: envelope.userId,
        organizationId: envelope.organizationId,
        appKey: envelope.appKey,
        payload: envelope.payload
      });
    } catch (err) {
      console.error('[notificationSSEPubSub] message parse failed:', err.message);
    }
  });

  console.log('[notificationSSEPubSub] Subscribed to cluster fan-out channel');
}

async function stopNotificationSSESubscriber() {
  subscriberStarted = false;
  try {
    if (subscriberClient?.isOpen) {
      await subscriberClient.unsubscribe(CHANNEL);
      await subscriberClient.quit();
    }
  } catch (_err) {
    // ignore shutdown errors
  } finally {
    subscriberClient = null;
  }
  try {
    if (publisherClient?.isOpen) {
      await publisherClient.quit();
    }
  } catch (_err) {
    // ignore
  } finally {
    publisherClient = null;
  }
}

module.exports = {
  publishNotificationToCluster,
  startNotificationSSESubscriber,
  stopNotificationSSESubscriber
};
