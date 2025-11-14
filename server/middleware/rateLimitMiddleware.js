/**
 * Rate Limiting Middleware
 * Prevents brute force attacks and API abuse
 * 
 * DEVELOPMENT BYPASS:
 * In development mode (NODE_ENV !== 'production'), rate limiting can be bypassed
 * by sending the header: X-Bypass-Rate-Limit: true or X-Test-Mode: true
 * 
 * This is automatically enabled in test scripts but can be disabled by setting:
 * BYPASS_RATE_LIMIT=false
 * 
 * ⚠️  WARNING: This bypass is DISABLED in production mode for security.
 */

const rateLimit = require('express-rate-limit');

const isProduction = process.env.NODE_ENV === 'production';
const bypassDisabled = process.env.BYPASS_RATE_LIMIT === 'false';

const isHealthCheckPath = (req) => req.path === '/health' || req.path === '/api/health';

const hasBypassHeader = (req) => {
    const bypassHeader = req.headers['x-bypass-rate-limit'];
    const testHeader = req.headers['x-test-mode'];
    return bypassHeader === 'true' || testHeader === 'true';
};

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
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip rate limiting for certain conditions
    skip: (req) => {
        if (shouldBypassRateLimit(req)) {
            return true;
        }

        // Skip for health checks
        return isHealthCheckPath(req);
    }
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 5 * 60 * 1000, // 15 min in prod, 5 min in dev
    max: process.env.NODE_ENV === 'production' ? 5 : 30, // More lenient in development (30 attempts per 5 minutes)
    message: {
        error: 'Too many login attempts from this IP, please try again after a few minutes.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use IP + user identifier for better tracking
    keyGenerator: (req) => {
        return req.ip + (req.body?.email || '');
    },
    // DEVELOPMENT ONLY: Skip rate limiting if bypass header is present
    skip: (req) => {
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
    message: {
        error: 'Too many password reset attempts, please try again later.',
        code: 'PASSWORD_RESET_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in development mode
    skip: (req) => {
        return process.env.NODE_ENV !== 'production';
    },
    keyGenerator: (req) => {
        return req.ip + (req.body?.email || '');
    }
});

// Strict rate limiter for registration
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit to 3 registrations per hour per IP
    message: {
        error: 'Too many registration attempts, please try again later.',
        code: 'REGISTRATION_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in development mode
    skip: (req) => {
        return process.env.NODE_ENV !== 'production';
    }
});

// Strict rate limiter for sensitive operations (delete, update critical data)
const sensitiveOperationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit to 10 sensitive operations per 15 minutes
    message: {
        error: 'Too many sensitive operations, please try again later.',
        code: 'SENSITIVE_OPERATION_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in development mode
    skip: (req) => {
        return process.env.NODE_ENV !== 'production';
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    passwordResetLimiter,
    registrationLimiter,
    sensitiveOperationLimiter
};

