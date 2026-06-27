const notificationSSEHub = require('../services/notificationSSEHub');
const { applySseCors } = require('../utils/sseCors');
const { resolveUserFromToken } = require('../utils/resolveUserFromToken');
const { canAccessLiveChatNotifications } = require('../utils/liveChatNotificationAccess');
const Organization = require('../models/Organization');
const { materializeEffectiveCRMEnvelopeOnUser } = require('../utils/rolePermissionProjection');

const APP_KEYS = ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK', 'PLATFORM'];

function normalizeAppKey(req) {
  const fromQuery = req.query.appKey;
  const fromContext = req.appContext?.appKey;
  const appKey = fromQuery || fromContext;
  if (!appKey || !APP_KEYS.includes(appKey)) {
    return null;
  }
  return appKey;
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

/**
 * GET /api/notifications/stream?appKey=SALES|AUDIT|PORTAL|HELPDESK&token=<bearer_token>
 * 
 * Server-Sent Events endpoint for real-time notification delivery.
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
    hasToken: !!req.query.token,
    method: req.method,
    path: req.path
  });

  const appKey = normalizeAppKey(req);
  if (!appKey) {
    console.warn('[notificationStreamController] Invalid or missing appKey');
    // For SSE, we can't send JSON error - just close connection
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('appKey is required');
    return;
  }

  // Validate user is authenticated via token in query param
  // (EventSource can't send Authorization header)
  const user = await validateTokenFromQuery(req);
  if (!user || !user._id || !user.organizationId) {
    console.warn('[notificationStreamController] Authentication failed');
    // For SSE, we can't send JSON error - just close connection
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('Unauthorized');
    return;
  }

  await hydrateUserForStream(user);

  // Validate app entitlement (user must have access to this app)
  const allowedApps = resolveAllowedAppsForStream(user);
  if (appKey === 'PLATFORM') {
    const canPlatform = await canAccessLiveChatNotifications(user, user.organizationId);
    if (!canPlatform) {
      console.warn('[notificationStreamController] Live Chat notification access denied:', {
        userId: user._id,
        appKey,
      });
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('App access denied');
      return;
    }
  } else if (!allowedApps.includes(appKey)) {
    console.warn('[notificationStreamController] App access denied:', {
      userId: user._id,
      appKey,
      allowedApps
    });
    // For SSE, we can't send JSON error - just close connection
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('App access denied');
    return;
  }

  console.log('[notificationStreamController] Stream authorized for:', {
    userId: user._id,
    organizationId: user.organizationId,
    appKey
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
  res.write(`event: connected\ndata: ${JSON.stringify({ appKey, timestamp: Date.now() })}\n\n`);

  // Register connection in hub
  const connectionId = notificationSSEHub.subscribe(
    res,
    user._id,
    user.organizationId,
    appKey
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

