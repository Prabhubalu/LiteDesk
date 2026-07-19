/**
 * Server-Sent Events (SSE) hub for real-time notification delivery.
 * 
 * Maintains in-memory subscriber registry keyed by organizationId + userId + appKey.
 * Never persists, never throws, best-effort only.
 * 
 * Phase 10G: Added connection limits, heartbeat monitoring, and structured logging.
 */

const NOTIFICATION_DEBUG = process.env.NOTIFICATION_DEBUG === 'true';
const MAX_CONNECTIONS_PER_USER_APP = parseInt(process.env.MAX_CONNECTIONS_PER_USER_APP || '2', 10);
const MAX_CONNECTIONS_PER_ORG = parseInt(process.env.MAX_CONNECTIONS_PER_ORG || '500', 10);
const INACTIVE_CONNECTION_TIMEOUT = 60000; // 60 seconds

function debugLog(event, data) {
  if (NOTIFICATION_DEBUG) {
    // Never log PII or payload body
    const safeData = { ...data };
    if (safeData.payload) delete safeData.payload;
    if (safeData.body) delete safeData.body;
    console.log(`[${event}]`, JSON.stringify(safeData));
  }
}

class NotificationSSEHub {
  constructor() {
    // Map: connectionId -> { res, userId, organizationId, appKey, appKeys, lastHeartbeat, createdAt }
    this.connections = new Map();
    
    // Map: key (orgId_userId_appKey) -> Set of connectionIds
    this.subscribersByKey = new Map();
    
    // Map: organizationId -> Set of connectionIds (for org-level limits)
    this.connectionsByOrg = new Map();
    
    // Heartbeat interval (20-30s)
    this.heartbeatInterval = 25000; // 25 seconds
    this.heartbeatTimer = null;
    this.cleanupTimer = null;
    
    // Uptime tracking
    this.startedAt = Date.now();
    
    this.startHeartbeat();
    this.startCleanupTimer();
  }

  /**
   * Generate unique connection ID
   */
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate subscriber key for indexing
   */
  getSubscriberKey(userId, organizationId, appKey) {
    return `${String(organizationId)}_${String(userId)}_${appKey}`;
  }

  normalizeAppKeys(appKeyOrKeys) {
    const list = Array.isArray(appKeyOrKeys) ? appKeyOrKeys : [appKeyOrKeys];
    return [...new Set(
      list
        .map((k) => String(k || '').toUpperCase().trim())
        .filter(Boolean)
    )];
  }

  /**
   * Subscribe a user to notifications for one or more apps on a single SSE response.
   * Enforces connection limits per user/app and per organization.
   *
   * @param {Object} res - Express response object (SSE stream)
   * @param {string} userId - User ID
   * @param {string} organizationId - Organization ID
   * @param {string|string[]} appKeyOrKeys - App key(s) (SALES | AUDIT | PORTAL | …)
   * @returns {string} connectionId
   */
  subscribe(res, userId, organizationId, appKeyOrKeys) {
    const appKeys = this.normalizeAppKeys(appKeyOrKeys);
    if (appKeys.length === 0) {
      throw new Error('appKeys required');
    }

    const connectionId = this.generateConnectionId();
    const orgIdStr = String(organizationId);
    const userIdStr = String(userId);

    for (const appKey of appKeys) {
      const key = this.getSubscriberKey(userIdStr, orgIdStr, appKey);
      const userAppConnections = this.subscribersByKey.get(key) || new Set();
      if (userAppConnections.size >= MAX_CONNECTIONS_PER_USER_APP) {
        const oldestConnectionId = Array.from(userAppConnections)[0];
        console.warn(`[notificationSSEHub] Max connections per user/app exceeded (${MAX_CONNECTIONS_PER_USER_APP}), closing oldest: ${oldestConnectionId}`);
        this.unsubscribe(oldestConnectionId);
      }
    }

    // Check per-organization limit
    const orgConnections = this.connectionsByOrg.get(orgIdStr) || new Set();
    if (orgConnections.size >= MAX_CONNECTIONS_PER_ORG) {
      // Close oldest connection for this org
      const oldestOrgConnectionId = Array.from(orgConnections)[0];
      console.warn(`[notificationSSEHub] Max connections per org exceeded (${MAX_CONNECTIONS_PER_ORG}), closing oldest: ${oldestOrgConnectionId}`);
      this.unsubscribe(oldestOrgConnectionId);
    }

    const now = Date.now();
    const primaryAppKey = appKeys.length === 1 ? appKeys[0] : 'MULTI';
    // Store connection
    this.connections.set(connectionId, {
      res,
      userId: userIdStr,
      organizationId: orgIdStr,
      appKey: primaryAppKey,
      appKeys,
      lastHeartbeat: now,
      createdAt: now
    });

    // Index by each app subscriber key (one socket, many apps)
    for (const appKey of appKeys) {
      const key = this.getSubscriberKey(userIdStr, orgIdStr, appKey);
      if (!this.subscribersByKey.has(key)) {
        this.subscribersByKey.set(key, new Set());
      }
      this.subscribersByKey.get(key).add(connectionId);
    }

    // Index by organization
    if (!this.connectionsByOrg.has(orgIdStr)) {
      this.connectionsByOrg.set(orgIdStr, new Set());
    }
    this.connectionsByOrg.get(orgIdStr).add(connectionId);

    // Setup cleanup on client disconnect
    res.on('close', () => {
      this.unsubscribe(connectionId);
    });

    debugLog('SSE_CONNECT', {
      connectionId,
      userId: userIdStr,
      organizationId: orgIdStr,
      appKey: primaryAppKey,
      appKeys,
      totalConnections: this.connections.size
    });

    console.log(`[notificationSSEHub] Subscribed: ${connectionId} (${appKeys.join(',')})`);
    return connectionId;
  }

  /**
   * Unsubscribe a connection.
   * 
   * @param {string} connectionId
   */
  unsubscribe(connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const orgIdStr = conn.organizationId;
    const appKeys = Array.isArray(conn.appKeys) && conn.appKeys.length > 0
      ? conn.appKeys
      : [conn.appKey].filter(Boolean);

    for (const appKey of appKeys) {
      const key = this.getSubscriberKey(conn.userId, conn.organizationId, appKey);
      const subscribers = this.subscribersByKey.get(key);
      if (subscribers) {
        subscribers.delete(connectionId);
        if (subscribers.size === 0) {
          this.subscribersByKey.delete(key);
        }
      }
    }

    // Remove from organization index
    const orgConnections = this.connectionsByOrg.get(orgIdStr);
    if (orgConnections) {
      orgConnections.delete(connectionId);
      if (orgConnections.size === 0) {
        this.connectionsByOrg.delete(orgIdStr);
      }
    }

    this.connections.delete(connectionId);
    
    debugLog('SSE_DISCONNECT', {
      connectionId,
      userId: conn.userId,
      organizationId: orgIdStr,
      appKey: conn.appKey,
      appKeys,
      totalConnections: this.connections.size
    });

    console.log(`[notificationSSEHub] Unsubscribed: ${connectionId}`);
  }

  /**
   * Publish a notification to all matching subscribers.
   * Fire-and-forget, never throws.
   * 
   * @param {Object} notification - { userId, organizationId, appKey, payload }
   */
  publish({ userId, organizationId, appKey, payload }) {
    if (!userId || !organizationId || !appKey || !payload) {
      console.warn('[notificationSSEHub] Invalid publish params');
      return;
    }

    const key = this.getSubscriberKey(userId, organizationId, appKey);
    const subscribers = this.subscribersByKey.get(key);
    
    if (!subscribers || subscribers.size === 0) {
      // No subscribers - notification will be delivered when user connects or polls
      console.log(`[notificationSSEHub] ⚠️  No active SSE connections for ${key} - notification ${payload.id} will be available on next poll`);
      return;
    }

    const notificationId = payload.id || 'unknown';
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    const deadConnections = [];
    let deliveredCount = 0;

    for (const connectionId of subscribers) {
      const conn = this.connections.get(connectionId);
      if (!conn) {
        deadConnections.push(connectionId);
        continue;
      }

      try {
        conn.res.write(message);
        conn.lastHeartbeat = Date.now();
        deliveredCount++;
      } catch (err) {
        console.warn(`[notificationSSEHub] Failed to send to ${connectionId}:`, err.message);
        deadConnections.push(connectionId);
      }
    }

    // Cleanup dead connections
    deadConnections.forEach(id => this.unsubscribe(id));

    debugLog('NotificationSSE', {
      notificationId,
      deliveredToConnections: deliveredCount,
      appKey,
      userId: String(userId),
      organizationId: String(organizationId)
    });

    if (subscribers.size > 0) {
      console.log(`[notificationSSEHub] Published to ${deliveredCount} subscriber(s) for ${key}`);
    }
  }

  /**
   * Send heartbeat ping to all connections.
   */
  sendHeartbeat() {
    const ping = 'event: ping\ndata: {"timestamp":' + Date.now() + '}\n\n';
    const deadConnections = [];

    for (const [connectionId, conn] of this.connections.entries()) {
      try {
        conn.res.write(ping);
        conn.lastHeartbeat = Date.now();
      } catch (err) {
        console.warn(`[notificationSSEHub] Heartbeat failed for ${connectionId}:`, err.message);
        deadConnections.push(connectionId);
      }
    }

    deadConnections.forEach(id => this.unsubscribe(id));
  }

  /**
   * Clean up inactive connections (no heartbeat for >60s).
   */
  cleanupInactiveConnections() {
    const now = Date.now();
    const inactiveConnections = [];

    for (const [connectionId, conn] of this.connections.entries()) {
      const inactiveTime = now - conn.lastHeartbeat;
      if (inactiveTime > INACTIVE_CONNECTION_TIMEOUT) {
        inactiveConnections.push(connectionId);
      }
    }

    if (inactiveConnections.length > 0) {
      debugLog('SSE_CLEANUP', {
        cleanedConnections: inactiveConnections.length,
        totalConnections: this.connections.size
      });
      
      inactiveConnections.forEach(id => {
        console.log(`[notificationSSEHub] Cleaning up inactive connection: ${id}`);
        this.unsubscribe(id);
      });
    }
  }

  /**
   * Start cleanup timer for inactive connections.
   */
  startCleanupTimer() {
    if (this.cleanupTimer) return;
    
    // Run cleanup every 30 seconds
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveConnections();
    }, 30000);
  }

  /**
   * Stop cleanup timer.
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Start heartbeat timer.
   */
  startHeartbeat() {
    if (this.heartbeatTimer) return;
    
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer.
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Get connection count (for monitoring).
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * Get health stats for monitoring endpoint.
   */
  getHealthStats() {
    const byApp = {};
    const orgs = new Set();
    const users = new Set();

    for (const conn of this.connections.values()) {
      const keys = Array.isArray(conn.appKeys) && conn.appKeys.length > 0
        ? conn.appKeys
        : [conn.appKey].filter(Boolean);
      for (const appKey of keys) {
        byApp[appKey] = (byApp[appKey] || 0) + 1;
      }
      
      // Track unique orgs and users
      orgs.add(conn.organizationId);
      users.add(conn.userId);
    }

    return {
      total: this.connections.size,
      byApp,
      organizations: orgs.size,
      users: users.size,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000)
    };
  }

  /**
   * Cleanup all connections (for graceful shutdown).
   */
  shutdown() {
    this.stopHeartbeat();
    this.stopCleanupTimer();
    for (const [connectionId, conn] of this.connections.entries()) {
      try {
        conn.res.end();
      } catch (err) {
        // Ignore errors during shutdown
      }
    }
    this.connections.clear();
    this.subscribersByKey.clear();
    this.connectionsByOrg.clear();
  }
}

// Singleton instance
const hub = new NotificationSSEHub();

// Graceful shutdown handlers removed - let server.js handle shutdown coordination
// The hub.shutdown() method is still available for the server to call

module.exports = hub;

