/**
 * ============================================================================
 * PLATFORM CORE: Authentication Middleware
 * ============================================================================
 * 
 * This middleware handles app-agnostic authentication:
 * - JWT token verification
 * - User authentication
 * - Session management
 * 
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * ============================================================================
 */

// 🔓 OPTIONAL AUTH BYPASS (explicit opt-in only)
// Set DISABLE_SECURITY=true in .env to bypass all security checks.
// IMPORTANT: Do NOT disable security by default in development, otherwise the backend will
// impersonate the first user in the DB and the frontend may "switch users" on refresh
// (e.g., during /api/users/profile refresh).
const SECURITY_DISABLED = process.env.DISABLE_SECURITY === 'true';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { resolveUserFromToken } = require('../utils/resolveUserFromToken');

const protect = async (req, res, next) => {
    // 🔓 BYPASS: Security disabled - create dummy user
    if (SECURITY_DISABLED) {
        // If a Bearer token is provided, honor it even in dev-bypass mode.
        // This prevents confusing "user switches" on refresh when multiple users log in locally.
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            // fall through to normal auth below
        } else {
        console.warn('⚠️  [DEV] Security disabled - bypassing authentication');
        
        // CRITICAL: Even in bypass mode, we should NOT use the first user found
        // because that could be from a different organization. Instead, we should
        // require a token or fail. However, for backward compatibility, we'll
        // try to extract organizationId from query params or headers if available.
        
        // Try to get organizationId from query params (for testing)
        const orgIdFromQuery = req.query?.organizationId || req.headers['x-organization-id'];
        
        try {
            let dummyUser = null;
            
            // If organizationId is provided, try to find a user from that org
            if (orgIdFromQuery) {
                dummyUser = await User.findOne({ organizationId: orgIdFromQuery }).lean();
            }
            
            // If no user found with orgId, or no orgId provided, we cannot safely proceed
            // because using the first user would cause data leakage between organizations
            if (!dummyUser) {
                console.error('[AuthMiddleware] SECURITY BYPASS: Cannot determine user context. Token required or provide organizationId in query.');
                return res.status(400).json({ 
                    message: 'In development bypass mode, either provide a Bearer token or organizationId query param',
                    code: 'DEV_BYPASS_REQUIRES_CONTEXT'
                });
            }
            
            req.user = dummyUser;
            req.user.organizationId = dummyUser.organizationId || dummyUser._id;
            req.user.isOwner = true; // Grant all permissions
            req.user.role = 'owner';
            req.user.permissions = {}; // Empty permissions = all allowed
            
            console.log('[AuthMiddleware] Using user from organization:', {
                userId: req.user._id,
                userEmail: req.user.email,
                organizationId: req.user.organizationId
            });
            
        } catch (error) {
            console.error('[AuthMiddleware] Error in security bypass:', error);
            return res.status(500).json({ 
                message: 'Error in development bypass mode',
                code: 'DEV_BYPASS_ERROR'
            });
        }
        return next();
        }
    }

    // 🔒 SECURITY ENABLED: Original authentication logic
    let token;

    // SECURITY: Ensure JWT_SECRET is set - fail hard if not configured
    if (!process.env.JWT_SECRET) {
        console.error('CRITICAL: JWT_SECRET environment variable is not set!');
        return res.status(500).json({ 
            message: 'Server configuration error. Please contact support.',
            code: 'SERVER_CONFIG_ERROR'
        });
    }

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query?.token) {
        // EventSource cannot send Authorization headers; allow token via query for SSE streams.
        token = String(req.query.token).trim();
    }

    if (token) {
        try {
            req.user = await resolveUserFromToken(token, { lean: false });

            if (!req.user) {
                return res.status(401).json({ message: 'User not found' });
            }

            try {
                const { getSentry } = require('../lib/sentryNode');
                const Sentry = getSentry();
                if (Sentry && process.env.SENTRY_DSN && typeof Sentry.setUser === 'function') {
                    Sentry.setUser({
                        id: req.user._id ? String(req.user._id) : undefined,
                        email: req.user.email,
                        username: req.user.username,
                    });
                    if (typeof Sentry.setTag === 'function' && req.user.organizationId) {
                        Sentry.setTag('organizationId', String(req.user.organizationId));
                    }
                }
            } catch (_e) {
                /* optional */
            }

            try {
                const { hydrateUserPermissionsFromRole } = require('../utils/rolePermissionProjection');
                await hydrateUserPermissionsFromRole(req.user);
            } catch (hydrateErr) {
                console.error('[AuthMiddleware] hydrateUserPermissionsFromRole failed:', hydrateErr.message);
            }

            return next();
        } catch (error) {
            console.error('Token verification error:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    return res.status(401).json({ message: 'Not authorized, no token' });
};

module.exports = { protect };