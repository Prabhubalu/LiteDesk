const { createClient } = require('redis');

let client = null;
let connectPromise = null;
let warnedMissingConfig = false;
let shuttingDown = false;
/** @type {Set<import('redis').RedisClientType>} */
const managedClients = new Set();

function isRedisShuttingDown() {
  return shuttingDown;
}

function registerManagedClient(redisClient) {
  if (redisClient) {
    managedClients.add(redisClient);
  }
}

function defaultReconnectStrategy(retries) {
  if (shuttingDown) return false;
  return Math.min(retries * 100, 3000);
}

async function forceCloseClient(redisClient) {
  if (!redisClient) return;
  managedClients.delete(redisClient);
  try {
    redisClient.removeAllListeners('error');
    redisClient.removeAllListeners('reconnecting');
  } catch (_error) {
    // Ignore listener cleanup failures.
  }
  if (!redisClient.isOpen) return;
  try {
    // Do not call unsubscribe/quit first — in-flight replies can arrive after
    // the queue is flushed and crash node-redis commands-queue.js.
    await redisClient.disconnect();
  } catch (_error) {
    // Ignore shutdown failures.
  }
}

function buildRedisUrl() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST;
  if (!host) return null;

  const port = process.env.REDIS_PORT || 6379;
  const pass = process.env.REDIS_PASSWORD;
  if (pass) {
    return `redis://:${encodeURIComponent(pass)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

function isRedisConfigured() {
  return Boolean(buildRedisUrl());
}

async function getRedisClient({ component = 'redis', required = false } = {}) {
  if (shuttingDown) {
    if (required) {
      throw new Error(`[${component}] Redis is shutting down`);
    }
    return null;
  }

  const url = buildRedisUrl();
  if (!url) {
    if (required) {
      throw new Error(`[${component}] Redis is required but REDIS_URL/REDIS_HOST is not configured`);
    }
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn('[redis] REDIS_URL/REDIS_HOST not configured; Redis-backed features will use their fallback behavior');
    }
    return null;
  }

  if (client?.isOpen) {
    return client;
  }

  if (!client) {
    client = createClient({
      url,
      socket: {
        connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '5000', 10),
        reconnectStrategy: defaultReconnectStrategy,
      },
    });

    client.on('error', (error) => {
      console.error(`[redis] ${component} client error:`, error.message);
    });
  }

  if (!connectPromise) {
    connectPromise = client.connect().catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  await connectPromise;
  return client;
}

async function closeRedisClient() {
  shuttingDown = true;
  if (!client) return;

  await forceCloseClient(client);
  client = null;
  connectPromise = null;
}

async function closeAllRedisConnections() {
  shuttingDown = true;

  const externalClients = [...managedClients];
  managedClients.clear();
  await Promise.allSettled(externalClients.map((redisClient) => forceCloseClient(redisClient)));

  await closeRedisClient();

  // Stray socket data events from closed clients may still be queued.
  await new Promise((resolve) => setImmediate(resolve));
}

module.exports = {
  buildRedisUrl,
  closeAllRedisConnections,
  closeRedisClient,
  defaultReconnectStrategy,
  forceCloseClient,
  getRedisClient,
  isRedisConfigured,
  isRedisShuttingDown,
  registerManagedClient,
};
