const notificationSSEHub = require('../services/notificationSSEHub');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const APP_KEYS = ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK'];

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
  // Check query param first (for EventSource)
  let token = req.query.token;
  
  // Fallback to Authorization header (for regular requests)
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    console.log('[notificationStreamController] No token provided');
    return null;
  }

  try {
    if (!process.env.JWT_SECRET) {
      console.error('[notificationStreamController] JWT_SECRET not configured');
      return null;
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[notificationStreamController] Token decoded, userId:', decoded.id);
    
    const user = await User.findById(decoded.id).select('-password').lean();
    if (!user) {
      console.warn('[notificationStreamController] User not found:', decoded.id);
      return null;
    }
    
    // Status check: treat undefined/null as active (backward compatibility)
    if (user.status && user.status !== 'active') {
      console.warn('[notificationStreamController] User not active:', decoded.id, 'status:', user.status);
      return null;
    }
    
    if (!user.organizationId) {
      console.warn('[notificationStreamController] User missing organizationId:', decoded.id);
      return null;
    }
    
    console.log('[notificationStreamController] Token validated successfully for user:', {
      id: decoded.id,
      email: user.email,
      status: user.status || 'active (default)',
      organizationId: user.organizationId,
      allowedApps: user.allowedApps
    });
    return user;
  } catch (err) {
    console.error('[notificationStreamController] Token validation failed:', err.message, err.name);
    return null;
  }
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

  // Validate app entitlement (user must have access to this app)
  const allowedApps = user.allowedApps || [];
  if (!allowedApps.includes(appKey)) {
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
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

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

