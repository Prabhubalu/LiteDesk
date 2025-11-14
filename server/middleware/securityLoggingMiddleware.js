/**
 * Security Event Logging Middleware
 * Logs security-relevant events for monitoring and auditing
 */

const securityLogger = {
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

