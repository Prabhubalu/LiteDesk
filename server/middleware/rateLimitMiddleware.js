/**
 * Rate Limiting Middleware
 * Prevents brute force attacks and API abuse
 */

const rateLimit = require('express-rate-limit');

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
        // Skip for health checks
        return req.path === '/health' || req.path === '/api/health';
    }
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
        error: 'Too many login attempts from this IP, please try again after 15 minutes.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use IP + user identifier for better tracking
    keyGenerator: (req) => {
        return req.ip + (req.body?.email || '');
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
    legacyHeaders: false
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
    legacyHeaders: false
});

module.exports = {
    apiLimiter,
    authLimiter,
    passwordResetLimiter,
    registrationLimiter,
    sensitiveOperationLimiter
};

