/**
 * Security Headers Middleware
 * Adds security headers to all responses
 */

const securityHeaders = (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection (legacy but still useful)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy - control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy (formerly Feature Policy)
    res.setHeader('Permissions-Policy', 
        'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
    );
    
    // Content Security Policy
    // Adjust based on your needs - this is a strict policy
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust for Vue.js
        "style-src 'self' 'unsafe-inline'", // Adjust for CSS
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ].join('; ');
    
    res.setHeader('Content-Security-Policy', csp);
    
    // Strict Transport Security (HSTS) - only in production with HTTPS
    if (process.env.NODE_ENV === 'production' && req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Remove X-Powered-By header (don't reveal we're using Express)
    res.removeHeader('X-Powered-By');
    
    next();
};

module.exports = securityHeaders;

