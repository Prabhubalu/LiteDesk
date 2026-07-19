const notificationSSEHub = require('../services/notificationSSEHub');
const { applySseCors } = require('../utils/sseCors');
const { resolveUserFromToken } = require('../utils/resolveUserFromToken');
const { canAccessLiveChatNotifications } = require('../utils/liveChatNotificationAccess');
const Organization = require('../models/Organization');
const { materializeEffectiveCRMEnvelopeOnUser } = require('../utils/rolePermissionProjection');

const APP_KEYS = ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK', 'PLATFORM'];

/**
 * Resolve requested app keys from query.
 * Supports:
 * - appKeys=SALES,AUDIT,HELPDESK (preferred multiplex)
 * - appKey=SALES (legacy single-app)
 */
function resolveRequestedAppKeys(req) {
  const fromMulti = req.query.appKeys;
  if (fromMulti != null && String(fromMulti).trim() !== '') {
    return [...new Set(
      String(fromMulti)
        .split(',')
        .map((k) => String(k || '').toUpperCase().trim())
        .filter((k) => APP_KEYS.includes(k))
    )];
  }

  const fromQuery = req.query.appKey;
  const fromContext = req.appContext?.appKey;
  const appKey = fromQuery || fromContext;
  if (!appKey || !APP_KEYS.includes(String(appKey).toUpperCase())) {
    return [];
  }
  return [String(appKey).toUpperCase()];
}

/**
 * Validate token from query parameter or Authorization header.
 * EventSource can't send custom headers, so query param is primary.
 * Returns user object if valid, null otherwise.
 */
async function validateTokenFromQuery(req) {
  let token = req.query.token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    console.log('[notificationStreamController] No token provided');
    return null;
  }
  return resolveUserFromToken(token, { lean: true });
}

function resolveAllowedAppsForStream(user) {
  if (Array.isArray(user.allowedApps) && user.allowedApps.length > 0) {
    return user.allowedApps.map((app) => String(app).toUpperCase());
  }
  if (Array.isArray(user.appAccess) && user.appAccess.length > 0) {
    return user.appAccess
      .filter((access) => String(access?.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
      .map((access) => String(access.appKey || '').toUpperCase())
      .filter(Boolean);
  }
  return [];
}

async function hydrateUserForStream(user) {
  if (!user?.organizationId) return user;
  const organization = await Organization.findById(user.organizationId)
    .select('enabledApps moduleOverrides settings subscription')
    .lean();
  await materializeEffectiveCRMEnvelopeOnUser(user, {
    organization,
    activeExternalRoleId: user.activeExternalRoleId || null
  });
  return user;
}

async function filterEntitledAppKeys(requestedKeys, user) {
  const allowedApps = resolveAllowedAppsForStream(user);
  const entitled = [];
  for (const appKey of requestedKeys) {
    if (appKey === 'PLATFORM') {
      const canPlatform = await canAccessLiveChatNotifications(user, user.organizationId);
      if (canPlatform) entitled.push(appKey);
      continue;
    }
    if (allowedApps.includes(appKey)) {
      entitled.push(appKey);
    }
  }
  return entitled;
}

/**
 * GET /api/notifications/stream?appKeys=SALES,AUDIT&token=…
 * GET /api/notifications/stream?appKey=SALES&token=… (legacy)
 *
 * Server-Sent Events endpoint for real-time notification delivery.
 * One connection can subscribe to multiple entitled apps (connection-pool friendly).
 *
 * Note: EventSource doesn't support custom headers, so token is passed as query param.
 * This route handles its own authentication (bypasses protect middleware).
 *
 * Security: Token is validated via JWT verification.
 */
exports.streamNotifications = async (req, res) => {
  applySseCors(req, res);

  console.log('[notificationStreamController] Stream request received:', {
    appKey: req.query.appKey,
    appKeys: req.query.appKeys,
    hasToken: !!req.query.token,
    method: req.method,
    path: req.path
  });

  const requestedKeys = resolveRequestedAppKeys(req);
  if (requestedKeys.length === 0) {
    console.warn('[notificationStreamController] Invalid or missing appKey/appKeys');
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('appKey or appKeys is required');
    return;
  }

  // Validate user is authenticated via token in query param
  // (EventSource can't send Authorization header)
  const user = await validateTokenFromQuery(req);
  if (!user || !user._id || !user.organizationId) {
    console.warn('[notificationStreamController] Authentication failed');
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('Unauthorized');
    return;
  }

  await hydrateUserForStream(user);

  const appKeys = await filterEntitledAppKeys(requestedKeys, user);
  if (appKeys.length === 0) {
    console.warn('[notificationStreamController] App access denied:', {
      userId: user._id,
      requestedKeys,
    });
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('App access denied');
    return;
  }

  console.log('[notificationStreamController] Stream authorized for:', {
    userId: user._id,
    organizationId: user.organizationId,
    appKeys
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Send initial connection message
  res.write(`event: connected\ndata: ${JSON.stringify({ appKeys, timestamp: Date.now() })}\n\n`);

  // Register connection in hub (one socket, many apps)
  const connectionId = notificationSSEHub.subscribe(
    res,
    user._id,
    user.organizationId,
    appKeys
  );

  // Keep connection alive
  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (err) {
      // Connection closed, cleanup will happen via 'close' event
      clearInterval(keepAlive);
    }
  }, 15000); // 15 seconds

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    notificationSSEHub.unsubscribe(connectionId);
    console.log(`[notificationStreamController] Client disconnected: ${connectionId}`);
  });

  // Cleanup on error
  req.on('error', (err) => {
    console.error(`[notificationStreamController] Stream error:`, err);
    clearInterval(keepAlive);
    notificationSSEHub.unsubscribe(connectionId);
  });
};
