/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

// For state-changing operations (POST, PUT, DELETE, PATCH)
const csrfProtection = (req, res, next) => {
    // DEVELOPMENT: Skip CSRF entirely in development mode for easier testing
    // API routes use JWT tokens which provide CSRF protection
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }
    
    // Skip CSRF for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    
    // Skip CSRF for public endpoints (login, register)
    const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }
    
    // Skip CSRF for all API routes - API routes use JWT tokens which provide CSRF protection
    // since tokens are stored in memory (Authorization header) and not accessible to malicious sites
    // Check req.originalUrl (full path) since req.path might be relative to mounted route
    const originalUrl = req.originalUrl || req.url || '';
    const path = req.path || '';
    const fullPath = originalUrl || path;
    
    // Debug: log path for troubleshooting (remove in production)
    if (process.env.NODE_ENV === 'development' && req.method !== 'GET') {
        console.log(`[CSRF] ${req.method} - path: ${path}, originalUrl: ${originalUrl}, fullPath: ${fullPath}`);
    }
    
    // Check if it's an API route (check originalUrl which contains the full path)
    if (fullPath.startsWith('/api/') || originalUrl.startsWith('/api/') || path.startsWith('/api/')) {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[CSRF] Skipping CSRF for API route: ${fullPath}`);
        }
        return next();
    }
    
    // Get CSRF token from header
    const csrfToken = req.headers['x-csrf-token'] || req.headers['csrf-token'];
    
    // Get token from session (if using sessions) or from JWT
    // For JWT-based auth, we can validate the token's origin
    const origin = req.headers.origin || req.headers.referer;
    const allowedOrigins = process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',')
        : [];
    
    // Check if request comes from allowed origin
    if (origin && allowedOrigins.length > 0) {
        const originHost = new URL(origin).hostname;
        const isAllowed = allowedOrigins.some(allowed => {
            const allowedUrl = allowed.startsWith('http') ? new URL(allowed) : { hostname: allowed };
            return originHost === allowedUrl.hostname || 
                   originHost.endsWith('.' + allowedUrl.hostname);
        });
        
        if (!isAllowed && !allowedOrigins.includes('*')) {
            return res.status(403).json({
                error: 'CSRF token validation failed: Invalid origin',
                code: 'CSRF_INVALID_ORIGIN'
            });
        }
    }
    
    // Additional validation: Check if user is authenticated
    // For authenticated requests, the JWT token serves as CSRF protection
    // since it's stored in memory (not accessible to malicious sites)
    if (req.user) {
        // JWT-based auth provides CSRF protection if token is in Authorization header
        // and not in cookies accessible to JavaScript
        return next();
    }
    
    // Check if Authorization header exists (JWT token) - this provides CSRF protection
    // CSRF middleware may run before auth middleware, so check header directly
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // JWT token in Authorization header provides CSRF protection
        return next();
    }
    
    // Skip CSRF in development mode
    if (process.env.NODE_ENV === 'development' || process.env.DISABLE_CSRF === 'true') {
        return next();
    }
    
    // If no user, no JWT token, and no CSRF token, reject
    if (!csrfToken) {
        return res.status(403).json({
            error: 'CSRF token required',
            code: 'CSRF_TOKEN_REQUIRED'
        });
    }
    
    next();
};

module.exports = csrfProtection;

