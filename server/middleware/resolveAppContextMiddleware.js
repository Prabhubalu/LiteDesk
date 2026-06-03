/**
 * ============================================================================
 * App Context Resolution Middleware
 * ============================================================================
 * 
 * Resolves the application context (appKey) from incoming requests and
 * attaches it to the request lifecycle.
 * 
 * Resolution Priority:
 * 1. URL namespace (/app/crm, /portal, /audit, /lms)
 * 2. Fallback: DEFAULT_APP_KEY (CRM)
 * 
 * Middleware Chain Position:
 * - Runs AFTER authentication (protect middleware)
 * - Runs BEFORE permission checks
 * 
 * Behavior:
 * - Only resolves appKey for authenticated requests (req.user exists)
 * - Logs appKey for every authenticated request
 * - Does NOT change any business logic
 * 
 * ============================================================================
 */

const { APP_KEYS, DEFAULT_APP_KEY, isValidAppKey } = require('../constants/appKeys');

/**
 * URL namespace to appKey mapping
 * Maps URL path prefixes to application keys
 * IMPORTANT: Order matters - more specific paths must come first
 */
const URL_NAMESPACE_MAP = {
    '/api/helpdesk': APP_KEYS.HELPDESK, // Must come before /api
    '/api/projects': APP_KEYS.PROJECTS, // Must come before /api
    '/api/audit': APP_KEYS.AUDIT,  // Must come before /api
    '/api/portal': APP_KEYS.PORTAL, // Must come before /api
    '/api/lms': APP_KEYS.LMS,       // Must come before /api
    '/api/inventory': APP_KEYS.INVENTORY, // Must come before /api
    '/api/control': APP_KEYS.CONTROL_PLANE, // Must come before /api
    '/app/crm': APP_KEYS.SALES,
    '/helpdesk': APP_KEYS.HELPDESK,
    '/projects': APP_KEYS.PROJECTS,
    '/portal': APP_KEYS.PORTAL,
    '/audit': APP_KEYS.AUDIT,
    '/lms': APP_KEYS.LMS,
    '/control': APP_KEYS.CONTROL_PLANE,
    // Legacy support: /api routes default to CRM (must be last)
    '/api': APP_KEYS.SALES
};

/**
 * Resolve appKey from request URL
 * @param {string} path - Request path
 * @returns {string} - Resolved appKey or DEFAULT_APP_KEY
 */
function resolveAppKeyFromUrl(path) {
    // Check for explicit app namespaces first
    // IMPORTANT: Order matters - more specific paths must be checked first
    // Sort by length (longest first) to ensure /api/audit matches before /api
    const sortedEntries = Object.entries(URL_NAMESPACE_MAP).sort((a, b) => b[0].length - a[0].length);
    
    for (const [namespace, appKey] of sortedEntries) {
        if (path.startsWith(namespace)) {
            console.log(`[AppContext] Resolved appKey=${appKey} from path=${path} using namespace=${namespace}`);
            return appKey;
        }
    }
    
    // Fallback to default
    console.log(`[AppContext] No namespace match for path=${path}, using default=${DEFAULT_APP_KEY}`);
    return DEFAULT_APP_KEY;
}

/**
 * App Context Resolution Middleware
 * 
 * Attaches req.appKey to the request lifecycle for use in controllers and middleware.
 * Only processes authenticated requests (when req.user exists).
 * 
 * Resolution Priority:
 * 1. Query parameter (req.query.appKey) - highest priority
 * 2. URL namespace (/app/crm, /portal, /audit, /lms)
 * 3. Fallback: DEFAULT_APP_KEY (SALES)
 */
const resolveAppContext = (req, res, next) => {
    // Only resolve appKey for authenticated requests
    // Auth routes don't have req.user, so they skip this
    if (!req.user) {
        return next();
    }
    
    // Priority 1: Check query parameter for explicit appKey
    if (req.query.appKey) {
        const queryAppKey = req.query.appKey.toUpperCase();
        if (isValidAppKey(queryAppKey)) {
            req.appKey = queryAppKey;
            const userId = req.user?._id?.toString() || 'unknown';
            const orgId = req.user?.organizationId?.toString() || 'unknown';
            console.log(`[AppContext] appKey=${req.appKey} from query param req.query.appKey=${req.query.appKey} path=${req.path} userId=${userId} orgId=${orgId}`);
            return next();
        } else {
            console.warn(`[AppContext] Invalid appKey in query param: ${req.query.appKey}, falling back to URL resolution`);
        }
    }
    
    // Priority 2: Resolve from URL path
    // Use originalUrl to get the full path before Express route mounting
    // req.path is relative to the mount point, but we need the full path
    // req.originalUrl includes query string, so we extract just the path
    const fullPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
    
    // Resolve appKey from full URL path
    const appKey = resolveAppKeyFromUrl(fullPath);
    
    // Validate appKey (safety check)
    if (!isValidAppKey(appKey)) {
        console.warn(`[AppContext] Invalid appKey resolved: ${appKey}, using default: ${DEFAULT_APP_KEY}`);
        req.appKey = DEFAULT_APP_KEY;
    } else {
        req.appKey = appKey;
    }
    
    // Log appKey for every authenticated request
    // Format: [AppContext] appKey=CRM path=/api/deals userId=...
    const userId = req.user?._id?.toString() || 'unknown';
    const orgId = req.user?.organizationId?.toString() || 'unknown';
    console.log(`[AppContext] appKey=${req.appKey} fullPath=${fullPath} req.path=${req.path} userId=${userId} orgId=${orgId}`);
    
    next();
};

module.exports = {
    resolveAppContext,
    resolveAppKeyFromUrl, // Exported for testing
    URL_NAMESPACE_MAP // Exported for reference
};

