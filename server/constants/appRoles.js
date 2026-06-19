/**
 * ============================================================================
 * App Role Definitions (Constants Only)
 * ============================================================================
 * 
 * Defines valid role keys for each application in the platform.
 * These are constants only - no permission logic is implemented here.
 * 
 * Role keys are scoped to appKey - roles do NOT merge across apps.
 * 
 * ============================================================================
 */

/**
 * SALES Application Roles
 * Used for SALES app access control
 */
const SALES_ROLES = ['ADMIN', 'MANAGER', 'USER'];

/**
 * Audit Application Roles
 * Used for Audit app access control
 */
const AUDIT_ROLES = ['AUDITOR'];

/**
 * Portal Application Roles
 * Used for Portal app access control
 */
const PORTAL_ROLES = ['CUSTOMER', 'VIEWER'];

/**
 * Get valid roles for an app
 * @param {string} appKey - The app key (SALES, AUDIT, PORTAL)
 * @returns {string[]} - Array of valid role keys for the app
 */
function getRolesForApp(appKey) {
    const roleMap = {
        'SALES': SALES_ROLES,
        'AUDIT': AUDIT_ROLES,
        'PORTAL': PORTAL_ROLES
    };
    return roleMap[appKey] || [];
}

/**
 * Check if a role is valid for an app
 * @param {string} appKey - The app key
 * @param {string} roleKey - The role key to validate
 * @returns {boolean} - True if role is valid for the app
 */
function isValidRoleForApp(appKey, roleKey) {
    const validRoles = getRolesForApp(appKey);
    return validRoles.includes(roleKey);
}

/**
 * Map legacy role string to SALES roleKey
 * Used for backward compatibility when migrating from legacy role system
 * @param {string} legacyRole - Legacy role ('owner', 'admin', 'manager', 'user', 'viewer')
 * @returns {string} - SALES roleKey ('ADMIN', 'MANAGER', 'USER')
 */
function mapLegacyRoleToSales(legacyRole) {
    const roleMap = {
        'owner': 'ADMIN',
        'admin': 'ADMIN',
        'administrator': 'ADMIN',
        'manager': 'MANAGER',
        'sales manager': 'MANAGER',
        'user': 'USER',
        'sales executive': 'USER',
        'viewer': 'USER'
    };
    return roleMap[legacyRole?.toLowerCase()] || 'USER';
}

module.exports = {
    SALES_ROLES,
    CRM_ROLES: SALES_ROLES, // Backward compatibility alias
    AUDIT_ROLES,
    PORTAL_ROLES,
    getRolesForApp,
    isValidRoleForApp,
    mapLegacyRoleToSales,
    mapLegacyRoleToCRM: mapLegacyRoleToSales // Backward compatibility alias
};

