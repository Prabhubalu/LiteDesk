/**
 * Rate Limiting Middleware
 * Prevents brute force attacks and API abuse
 * 
 * 🔓 SECURITY DISABLED FOR DEVELOPMENT
 * Set DISABLE_SECURITY=true in .env to bypass all rate limiting
 */

const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const {
    createRateLimitStore,
    shouldPassOnRateLimitStoreError,
} = require('./rateLimitRedisStore');

// 🔓 SECURITY DISABLED: Bypass all rate limiting
const SECURITY_DISABLED = process.env.DISABLE_SECURITY === 'true' || process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';
const bypassDisabled = process.env.BYPASS_RATE_LIMIT === 'false';

const parsePositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const RATE_LIMIT_WINDOW_MS = parsePositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const GENERAL_API_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.GENERAL_API_RATE_LIMIT_MAX_REQUESTS,
    300
);
const ORGANIZATION_SETTINGS_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.ORGANIZATION_SETTINGS_RATE_LIMIT_MAX_REQUESTS,
    600
);
const AUTH_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.AUTH_RATE_LIMIT_WINDOW_MS,
    isProduction ? 15 * 60 * 1000 : 5 * 60 * 1000
);
const AUTH_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    isProduction ? 5 : 30
);
const GENERAL_RATE_LIMIT_REDIS_FAILURE_MODE = process.env.GENERAL_RATE_LIMIT_REDIS_FAILURE_MODE || 'fail-open';
const AUTH_RATE_LIMIT_REDIS_FAILURE_MODE = process.env.AUTH_RATE_LIMIT_REDIS_FAILURE_MODE || 'fail-closed';
const ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE = process.env.ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE || 'fail-open';
const SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE = process.env.SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE || 'fail-closed';

const isHealthCheckPath = (req) => {
    const p = req.path || '';
    return (
        p === '/health' ||
        p === '/health/' ||
        p === '/health/live' ||
        p === '/health/ready' ||
        p === '/health/status' ||
        p === '/api/health'
    );
};

const hasBypassHeader = (req) => {
    const bypassHeader = req.headers['x-bypass-rate-limit'];
    const testHeader = req.headers['x-test-mode'];
    return bypassHeader === 'true' || testHeader === 'true';
};

const isAuthPath = (req) => {
    const originalUrl = req.originalUrl || '';
    const path = req.path || '';
    return originalUrl.startsWith('/api/auth/') || path.startsWith('/auth/');
};

const isOrganizationSettingsReadPath = (req) => {
    const originalUrl = (req.originalUrl || '').split('?')[0];
    return req.method === 'GET' && originalUrl === '/api/settings/organization';
};

/** In-app notification list + SSE are user-scoped and polled infrequently; exclude from the general API bucket. */
const isNotificationReadPath = (req) => {
    const pathOnly = (req.originalUrl || req.path || '').split('?')[0];
    if (req.method === 'GET' && pathOnly === '/api/notifications/stream') {
        return true;
    }
    if (req.method === 'GET' && pathOnly === '/api/notifications') {
        return true;
    }
    return false;
};

const getBearerToken = (req) => {
    const authorization = req.headers.authorization || '';
    if (!authorization.startsWith('Bearer ')) {
        return null;
    }
    return authorization.slice('Bearer '.length).trim();
};

const getClientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const getRateLimitKey = (req, namespace = 'api') => {
    const token = getBearerToken(req);
    if (token && process.env.JWT_SECRET) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded?.id) {
                return `${namespace}:user:${decoded.id}`;
            }
        } catch (_error) {
            // Invalid tokens fall back to the network identity and are rejected by auth later.
        }
    }

    return `${namespace}:ip:${getClientIp(req)}`;
};

const logRateLimitHit = (limiterName, req) => {
    console.log('RATE LIMIT HIT:', getClientIp(req), req.originalUrl, {
        limiter: limiterName,
        method: req.method,
        xForwardedFor: req.headers['x-forwarded-for'] || null,
        forwarded: req.headers.forwarded || null,
        userAgent: req.headers['user-agent'] || null
    });
};

const makeRateLimitHandler = (limiterName, message) => (req, res) => {
    logRateLimitHit(limiterName, req);
    res.status(429).json(message);
};

const RATE_LIMIT_APP_NAME = process.env.CACHE_APP_NAME || process.env.APP_NAME || 'arivu';
const RATE_LIMIT_ENV = process.env.CACHE_ENV || process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const RATE_LIMIT_PREFIX = process.env.RATE_LIMIT_REDIS_PREFIX || `${RATE_LIMIT_APP_NAME}:${RATE_LIMIT_ENV}:rate-limit:`;

const rateLimitHeadersAndStore = (limiterName, windowMs, failureMode) => ({
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    store: createRateLimitStore({
        prefix: `${RATE_LIMIT_PREFIX}${limiterName}:`,
        windowMs,
    }),
    passOnStoreError: shouldPassOnRateLimitStoreError(failureMode),
});

const shouldBypassRateLimit = (req, { logContext } = {}) => {
    if (isProduction || bypassDisabled) {
        return false;
    }

    if (hasBypassHeader(req)) {
        if (logContext) {
            console.warn(`⚠️  [DEV] Rate limiting bypassed for ${logContext}`);
        }
        return true;
    }

    return false;
};

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: GENERAL_API_RATE_LIMIT_MAX_REQUESTS,
    ...rateLimitHeadersAndStore('api', RATE_LIMIT_WINDOW_MS, GENERAL_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => getRateLimitKey(req, 'api'),
    handler: makeRateLimitHandler('api', {
        error: 'Too many requests from this user or IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    }),
    // Skip rate limiting for certain conditions
    skip: (req) => {
        // 🔓 BYPASS: Skip all rate limiting if security is disabled
        if (SECURITY_DISABLED) {
            return true;
        }
        
        if (shouldBypassRateLimit(req)) {
            return true;
        }

        // Auth routes have dedicated, stricter limiters mounted on authRoutes.
        // Organization settings are read during normal settings navigation and
        // have a dedicated relaxed limiter after authentication.
        return (
            isHealthCheckPath(req) ||
            isAuthPath(req) ||
            isOrganizationSettingsReadPath(req) ||
            isNotificationReadPath(req)
        );
    }
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    max: AUTH_RATE_LIMIT_MAX_REQUESTS,
    ...rateLimitHeadersAndStore('auth', AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many login attempts from this IP, please try again after a few minutes.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    handler: makeRateLimitHandler('auth', {
        error: 'Too many login attempts from this IP, please try again after a few minutes.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
    }),
    // Use IP + user identifier for better tracking
    keyGenerator: (req) => {
        const email = String(req.body?.email || '').trim().toLowerCase();
        return `auth:ip:${getClientIp(req)}:email:${email}`;
    },
    // DEVELOPMENT ONLY: Skip rate limiting if bypass header is present
    skip: (req) => {
        // 🔓 BYPASS: Skip all rate limiting if security is disabled
        if (SECURITY_DISABLED) {
            return true;
        }
        
        if (shouldBypassRateLimit(req, { logContext: `auth request from ${req.ip} (${req.body?.email || 'unknown user'})` })) {
            return true;
        }

        // Skip for health checks
        return isHealthCheckPath(req);
    }
});

// Strict rate limiter for password reset
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit to 3 password reset attempts per hour
    ...rateLimitHeadersAndStore('password-reset', 60 * 60 * 1000, AUTH_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many password reset attempts, please try again later.',
        code: 'PASSWORD_RESET_LIMIT_EXCEEDED'
    },
    handler: makeRateLimitHandler('password-reset', {
        error: 'Too many password reset attempts, please try again later.',
        code: 'PASSWORD_RESET_LIMIT_EXCEEDED'
    }),
    // Skip rate limiting in development mode
    skip: (req) => {
        // 🔓 BYPASS: Skip all rate limiting if security is disabled
        if (SECURITY_DISABLED) {
            return true;
        }
        return process.env.NODE_ENV !== 'production';
    },
    keyGenerator: (req) => {
        const email = String(req.body?.email || '').trim().toLowerCase();
        return `password-reset:ip:${getClientIp(req)}:email:${email}`;
    }
});

// Strict rate limiter for registration
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit to 3 registrations per hour per IP
    ...rateLimitHeadersAndStore('registration', 60 * 60 * 1000, AUTH_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many registration attempts, please try again later.',
        code: 'REGISTRATION_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => `registration:ip:${getClientIp(req)}`,
    handler: makeRateLimitHandler('registration', {
        error: 'Too many registration attempts, please try again later.',
        code: 'REGISTRATION_LIMIT_EXCEEDED'
    }),
    // Skip rate limiting in development mode
    skip: (req) => {
        return process.env.NODE_ENV !== 'production';
    }
});

// Strict rate limiter for sensitive operations (delete, update critical data)
const sensitiveOperationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit to 10 sensitive operations per 15 minutes
    ...rateLimitHeadersAndStore('sensitive-operation', 15 * 60 * 1000, SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many sensitive operations, please try again later.',
        code: 'SENSITIVE_OPERATION_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => getRateLimitKey(req, 'sensitive'),
    handler: makeRateLimitHandler('sensitive-operation', {
        error: 'Too many sensitive operations, please try again later.',
        code: 'SENSITIVE_OPERATION_LIMIT_EXCEEDED'
    }),
    // Skip rate limiting in development mode
    skip: (req) => {
        return process.env.NODE_ENV !== 'production';
    }
});

// Relaxed limiter for a read-heavy settings bootstrap endpoint.
// Mounted after auth, so req.user is available and tenants/users do not share
// one bucket just because a proxy presents the same network IP.
const organizationSettingsLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: ORGANIZATION_SETTINGS_RATE_LIMIT_MAX_REQUESTS,
    ...rateLimitHeadersAndStore('organization-settings', RATE_LIMIT_WINDOW_MS, ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many organization settings requests, please try again later.',
        code: 'ORGANIZATION_SETTINGS_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        if (req.user?._id) {
            return `organization-settings:user:${req.user._id}`;
        }
        return getRateLimitKey(req, 'organization-settings');
    },
    handler: makeRateLimitHandler('organization-settings', {
        error: 'Too many organization settings requests, please try again later.',
        code: 'ORGANIZATION_SETTINGS_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => {
        if (SECURITY_DISABLED) {
            return true;
        }
        return shouldBypassRateLimit(req);
    }
});

const MAILROOM_PUBLIC_RATE_LIMIT_MAX = parsePositiveInteger(
    process.env.MAILROOM_PUBLIC_RATE_LIMIT_MAX,
    120
);
const MAILROOM_PORTAL_RATE_LIMIT_MAX = parsePositiveInteger(
    process.env.MAILROOM_PORTAL_RATE_LIMIT_MAX,
    180
);
const MAILROOM_CONNECTOR_WINDOW_MS = parsePositiveInteger(
    process.env.MAILROOM_CONNECTOR_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000
);

const mailroomPublicIngestLimiter = rateLimit({
    windowMs: MAILROOM_CONNECTOR_WINDOW_MS,
    max: MAILROOM_PUBLIC_RATE_LIMIT_MAX,
    ...rateLimitHeadersAndStore('mailroom-public', MAILROOM_CONNECTOR_WINDOW_MS, ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many Mailroom public API requests, please try again later.',
        code: 'MAILROOM_PUBLIC_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        const orgId = req.headers['x-organization-id'] || req.headers['x-org-id'] || 'unknown-org';
        return `mailroom-public:${orgId}:${getClientIp(req)}`;
    },
    handler: makeRateLimitHandler('mailroom-public', {
        error: 'Too many Mailroom public API requests, please try again later.',
        code: 'MAILROOM_PUBLIC_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

const PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000
);
const PUBLIC_QUOTE_VIEW_MAX = parsePositiveInteger(process.env.PUBLIC_QUOTE_VIEW_MAX, 120);
const PUBLIC_QUOTE_ACTION_MAX = parsePositiveInteger(process.env.PUBLIC_QUOTE_ACTION_MAX, 20);

const publicQuoteViewLimiter = rateLimit({
    windowMs: PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS,
    max: PUBLIC_QUOTE_VIEW_MAX,
    ...rateLimitHeadersAndStore('public-quote-view', PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS, ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many requests for this quote link. Please try again later.',
        code: 'PUBLIC_QUOTE_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        const token = String(req.params?.token || 'unknown').slice(0, 64);
        return `public-quote:view:${token}:${getClientIp(req)}`;
    },
    handler: makeRateLimitHandler('public-quote-view', {
        error: 'Too many requests for this quote link. Please try again later.',
        code: 'PUBLIC_QUOTE_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

const publicQuoteActionLimiter = rateLimit({
    windowMs: PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS,
    max: PUBLIC_QUOTE_ACTION_MAX,
    ...rateLimitHeadersAndStore('public-quote-action', PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS, SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many actions on this quote link. Please try again later.',
        code: 'PUBLIC_QUOTE_ACTION_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        const token = String(req.params?.token || 'unknown').slice(0, 64);
        return `public-quote:action:${token}:${getClientIp(req)}`;
    },
    handler: makeRateLimitHandler('public-quote-action', {
        error: 'Too many actions on this quote link. Please try again later.',
        code: 'PUBLIC_QUOTE_ACTION_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

const mailroomPortalIngestLimiter = rateLimit({
    windowMs: MAILROOM_CONNECTOR_WINDOW_MS,
    max: MAILROOM_PORTAL_RATE_LIMIT_MAX,
    ...rateLimitHeadersAndStore('mailroom-portal', MAILROOM_CONNECTOR_WINDOW_MS, ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many Mailroom portal requests, please try again later.',
        code: 'MAILROOM_PORTAL_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        if (req.user?._id) {
            return `mailroom-portal:user:${req.user._id}`;
        }
        return getRateLimitKey(req, 'mailroom-portal');
    },
    handler: makeRateLimitHandler('mailroom-portal', {
        error: 'Too many Mailroom portal requests, please try again later.',
        code: 'MAILROOM_PORTAL_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

module.exports = {
    apiLimiter,
    authLimiter,
    passwordResetLimiter,
    registrationLimiter,
    sensitiveOperationLimiter,
    organizationSettingsLimiter,
    mailroomPublicIngestLimiter,
    mailroomPortalIngestLimiter,
    publicQuoteViewLimiter,
    publicQuoteActionLimiter
};
