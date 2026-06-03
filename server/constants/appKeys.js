/**
 * ============================================================================
 * App Context: Application Keys
 * ============================================================================
 * 
 * Defines the available application contexts in the Arivu platform.
 * Each appKey represents a distinct application that can run on the platform.
 * 
 * Usage:
 *   const { APP_KEYS } = require('./constants/appKeys');
 *   if (req.appKey === APP_KEYS.SALES) { ... }
 * 
 * ============================================================================
 */

/**
 * Application Keys Enum
 * 
 * - SALES: Sales application (formerly CRM)
 * - HELPDESK: Helpdesk application
 * - PROJECTS: Projects application
 * - PORTAL: Customer/Partner portal application
 * - AUDIT: Audit management application
 * - LMS: Learning Management System application
 * - INVENTORY: Inventory & fulfillment operations (stock ledger)
 * - CONTROL_PLANE: Platform internal operations (non-tenant, non-billable)
 */
const APP_KEYS = {
    SALES: 'SALES',
    HELPDESK: 'HELPDESK',
    PROJECTS: 'PROJECTS',
    PORTAL: 'PORTAL',
    AUDIT: 'AUDIT',
    LMS: 'LMS',
    INVENTORY: 'INVENTORY',
    CONTROL_PLANE: 'CONTROL_PLANE'
};

/**
 * Default application key (used when appKey cannot be resolved from URL)
 */
const DEFAULT_APP_KEY = APP_KEYS.SALES;

/**
 * Valid app keys array (for validation)
 */
const VALID_APP_KEYS = Object.values(APP_KEYS);

/**
 * Check if an appKey is valid
 * @param {string} appKey - The appKey to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidAppKey(appKey) {
    return VALID_APP_KEYS.includes(appKey);
}

module.exports = {
    APP_KEYS,
    DEFAULT_APP_KEY,
    VALID_APP_KEYS,
    isValidAppKey
};

