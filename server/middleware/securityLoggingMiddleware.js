/**
 * ============================================================================
 * PLATFORM CORE: Security Event Logging Middleware
 * ============================================================================
 * 
 * This middleware provides app-agnostic audit logging:
 * - Authentication events (login, logout, failed attempts)
 * - Permission denial events
 * - Suspicious activity detection
 * - Rate limit violations
 * - Data access events
 * 
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * Persists to SecurityEvent when organizationId is present (non-blocking).
 * ============================================================================
 */

const AUTH_EVENT_TO_SECURITY_TYPE = {
    LOGIN_SUCCESS: 'login_success',
    LOGIN_FAILED: 'login_failed',
    LOGOUT: 'logout',
    PASSWORD_RESET_REQUESTED: 'password_reset_requested',
    PASSWORD_RESET_COMPLETED: 'password_reset_completed'
};

function persistSecurityEventAsync(payload) {
    if (!payload?.organizationId || !payload?.type) {
        return;
    }
    setImmediate(() => {
        try {
            const { recordSecurityEvent } = require('../services/securityAuditService');
            recordSecurityEvent(payload).catch((err) => {
                console.error('[securityLogger] persist failed:', err.message);
            });
        } catch (err) {
            console.error('[securityLogger] persist unavailable:', err.message);
        }
    });
}

const securityLogger = {
    persistSecurityEventAsync,

    /**
     * Log authentication events
     */
    logAuthEvent: (event, details) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'AUTH',
            event,
            ...details,
            severity: details.success ? 'INFO' : 'WARN'
        };
        
        console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);

        const securityType = AUTH_EVENT_TO_SECURITY_TYPE[event];
        if (securityType && details?.organizationId) {
            persistSecurityEventAsync({
                organizationId: details.organizationId,
                type: securityType,
                description: String(event),
                userId: details.userId || null,
                actorUserId: details.userId || null,
                userEmail: details.email || null,
                ipAddress: details.ip || null,
                userAgent: details.userAgent || null,
                metadata: {
                    success: details.success === true,
                    code: details.code || null
                }
            });
        }
        
        // In production, send to logging service (e.g., CloudWatch, Datadog, etc.)
        if (process.env.NODE_ENV === 'production' && process.env.SECURITY_LOG_ENDPOINT) {
            // Send to external logging service
            // fetch(process.env.SECURITY_LOG_ENDPOINT, { method: 'POST', body: JSON.stringify(logEntry) })
        }
    },
    
    /**
     * Log permission denial events
     */
    logPermissionDenial: (req, resource, action) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'PERMISSION_DENIED',
            userId: req.user?._id,
            userEmail: req.user?.email,
            ip: req.ip,
            resource,
            action,
            path: req.path,
            method: req.method,
            severity: 'WARN'
        };
        
        console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
    },
    
    /**
     * Log suspicious activity
     */
    logSuspiciousActivity: (event, details) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'SUSPICIOUS_ACTIVITY',
            event,
            ...details,
            severity: 'HIGH'
        };
        
        console.error(`[SECURITY ALERT] ${JSON.stringify(logEntry)}`);
        
        // In production, send alert to security team
        if (process.env.NODE_ENV === 'production' && process.env.SECURITY_ALERT_ENDPOINT) {
            // Send alert to security team
            // fetch(process.env.SECURITY_ALERT_ENDPOINT, { method: 'POST', body: JSON.stringify(logEntry) })
        }
    },
    
    /**
     * Log rate limit violations
     */
    logRateLimitViolation: (req, limitType) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'RATE_LIMIT_VIOLATION',
            ip: req.ip,
            limitType,
            path: req.path,
            method: req.method,
            userAgent: req.get('user-agent'),
            severity: 'MEDIUM'
        };
        
        console.warn(`[SECURITY] ${JSON.stringify(logEntry)}`);
    },
    
    /**
     * Log data access events (for sensitive operations)
     */
    logDataAccess: (req, resource, action, resourceId) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'DATA_ACCESS',
            userId: req.user?._id,
            userEmail: req.user?.email,
            organizationId: req.user?.organizationId,
            resource,
            action,
            resourceId,
            ip: req.ip,
            path: req.path,
            severity: 'INFO'
        };
        
        // Only log in production or if explicitly enabled
        if (process.env.ENABLE_DATA_ACCESS_LOGGING === 'true') {
            console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
        }
    }
};

module.exports = securityLogger;

