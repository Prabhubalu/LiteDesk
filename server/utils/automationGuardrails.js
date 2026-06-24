/**
 * ============================================================================
 * Phase 0H: Automation Guardrails for Control Plane
 * Phase 0I.1: Responses Execution Domain Guardrails
 * Phase 0I.3: Response Review Actions Guardrails
 * ============================================================================
 * 
 * This utility provides guardrails to prevent CONTROL_PLANE modules from
 * being used in automation (Process Designer, triggers, conditions, actions).
 * 
 * CONTROL_PLANE modules are platform control inputs, not business data,
 * and should never be automated.
 * 
 * Phase 0I.1: Responses can be used as triggers and in conditions later,
 * but no executable automation is introduced now.
 * 
 * Phase 0I.3: Response review actions are Platform-owned. Only Platform execution
 * controllers may execute review actions. Audit App and Portal are read-only.
 * 
 * ============================================================================
 */

const ModuleDefinition = require('../models/ModuleDefinition');
const AppDefinition = require('../models/AppDefinition');

const CONTROL_PLANE_APP_KEY = 'control_plane';

/**
 * Check if a module can be used in automation
 * @param {string} appKey - Application key
 * @param {string} moduleKey - Module key
 * @returns {Promise<{allowed: boolean, reason: string}>} - Whether automation is allowed
 */
async function canUseModuleInAutomation(appKey, moduleKey) {
    try {
        // Block CONTROL_PLANE app entirely
        if (appKey.toLowerCase() === CONTROL_PLANE_APP_KEY) {
            return {
                allowed: false,
                reason: 'CONTROL_PLANE_MODULES_CANNOT_BE_AUTOMATED'
            };
        }

        // Phase 0I.1: Responses can be used as triggers and in conditions (future)
        if (moduleKey.toLowerCase() === 'responses') {
            return {
                allowed: true,
                reason: 'RESPONSES_CAN_BE_USED_AS_TRIGGERS_AND_IN_CONDITIONS',
                note: 'Responses trigger automation but are not automated entities themselves'
            };
        }

        // Check ModuleDefinition for automation support
        const moduleDef = await ModuleDefinition.findOne({
            appKey: appKey.toLowerCase(),
            moduleKey: moduleKey.toLowerCase()
        });

        if (!moduleDef) {
            // If module definition doesn't exist, allow by default (backward compatibility)
            return {
                allowed: true,
                reason: 'MODULE_DEFINITION_NOT_FOUND'
            };
        }

        // Check if module supports automation
        if (moduleDef.supports && moduleDef.supports.automation === false) {
            return {
                allowed: false,
                reason: 'MODULE_DOES_NOT_SUPPORT_AUTOMATION'
            };
        }

        // Check app-level automation capability
        const appDef = await AppDefinition.findOne({
            appKey: appKey.toLowerCase()
        });

        if (appDef && appDef.capabilities && appDef.capabilities.usesAutomation === false) {
            return {
                allowed: false,
                reason: 'APP_DOES_NOT_SUPPORT_AUTOMATION'
            };
        }

        return {
            allowed: true,
            reason: 'AUTOMATION_ALLOWED'
        };
    } catch (error) {
        console.error('[AutomationGuardrails] Error checking automation permission:', error);
        // On error, deny access (fail-safe)
        return {
            allowed: false,
            reason: 'ERROR_CHECKING_AUTOMATION_PERMISSION'
        };
    }
}

/**
 * Check if a relationship can be used in automation
 * @param {string} relationshipKey - Relationship key
 * @returns {Promise<{allowed: boolean, reason: string}>} - Whether automation is allowed
 */
async function canUseRelationshipInAutomation(relationshipKey) {
    try {
        const RelationshipDefinition = require('../models/RelationshipDefinition');
        
        const relDef = await RelationshipDefinition.findOne({
            relationshipKey: relationshipKey.toLowerCase()
        });

        if (!relDef) {
            return {
                allowed: false,
                reason: 'RELATIONSHIP_NOT_FOUND'
            };
        }

        // Check if relationship allows automation
        if (relDef.automation && relDef.automation.allowed === false) {
            return {
                allowed: false,
                reason: 'RELATIONSHIP_DOES_NOT_SUPPORT_AUTOMATION'
            };
        }

        // Check if source or target is CONTROL_PLANE
        if (relDef.source.appKey.toLowerCase() === CONTROL_PLANE_APP_KEY ||
            relDef.target.appKey.toLowerCase() === CONTROL_PLANE_APP_KEY) {
            return {
                allowed: false,
                reason: 'CONTROL_PLANE_RELATIONSHIPS_CANNOT_BE_AUTOMATED'
            };
        }

        return {
            allowed: true,
            reason: 'AUTOMATION_ALLOWED'
        };
    } catch (error) {
        console.error('[AutomationGuardrails] Error checking relationship automation permission:', error);
        return {
            allowed: false,
            reason: 'ERROR_CHECKING_RELATIONSHIP_AUTOMATION_PERMISSION'
        };
    }
}

/**
 * Validate that a trigger configuration doesn't use CONTROL_PLANE modules
 * @param {Object} trigger - Trigger configuration
 * @returns {Promise<{valid: boolean, errors: Array<string>}>} - Validation result
 */
async function validateTriggerConfiguration(trigger) {
    const errors = [];

    if (!trigger || !trigger.entity) {
        return { valid: true, errors: [] };
    }

    // Parse entity to get appKey and moduleKey
    // Format: "appKey.moduleKey" or just "moduleKey" (assumes Sales)
    const entityParts = trigger.entity.split('.');
    let appKey = 'sales'; // Default to Sales
    let moduleKey = trigger.entity;

    if (entityParts.length === 2) {
        appKey = entityParts[0];
        moduleKey = entityParts[1];
    }

    const automationCheck = await canUseModuleInAutomation(appKey, moduleKey);
    if (!automationCheck.allowed) {
        errors.push(`Module ${appKey}.${moduleKey} cannot be used in automation: ${automationCheck.reason}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate that an action configuration doesn't use CONTROL_PLANE modules
 * @param {Object} action - Action configuration
 * @returns {Promise<{valid: boolean, errors: Array<string>}>} - Validation result
 */
async function validateActionConfiguration(action) {
    const errors = [];

    if (!action || !action.type) {
        return { valid: true, errors: [] };
    }

    // Check action types that reference modules
    if (action.type === 'create_record' || action.type === 'update_record') {
        if (action.entity) {
            const entityParts = action.entity.split('.');
            let appKey = 'sales';
            let moduleKey = action.entity;

            if (entityParts.length === 2) {
                appKey = entityParts[0];
                moduleKey = entityParts[1];
            }

            const automationCheck = await canUseModuleInAutomation(appKey, moduleKey);
            if (!automationCheck.allowed) {
                errors.push(`Module ${appKey}.${moduleKey} cannot be used in automation: ${automationCheck.reason}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Phase 0I.1: Get automation metadata for Responses execution domain
 * Returns metadata about how Responses can be used in automation (triggers, conditions)
 * @returns {Object} - Automation metadata for Responses
 */
function getResponsesAutomationMetadata() {
    return {
        canBeTrigger: true,
        canBeUsedInConditions: true,
        canBeAutomated: false, // Responses themselves are not automated
        triggerEvents: [
            'response.submitted',
            'response.execution_status_changed',
            'response.review_status_changed',
            'response.approved',
            'response.rejected'
        ],
        conditionFields: [
            'executionStatus',
            'reviewStatus',
            'correctiveActions.count',
            'kpis.compliancePercentage'
        ],
        excludedFromControlPlane: true // CONTROL_PLANE entities are explicitly excluded
    };
}

/**
 * Phase 0I.3: Check if a Response review action is allowed
 * 
 * ⚠️ SAFETY: This is a guardrail function. It checks metadata only.
 * Actual execution must occur via Platform execution controllers.
 *
 * Rules enforced:
 * - Process Designer may discover actions (metadata)
 * - Only Platform execution controllers may execute them
 * - Audit App / Portal cannot invoke
 *
 * @param {Object} context - Execution context
 * @param {string} context.executionDomain - Execution domain (should be 'RESPONSE')
 * @param {string} context.appKey - Application key of the request context
 * @param {string} context.intent - Intent ('DISCOVER' or 'EXECUTE')
 * @param {string} actionKey - Review action key (APPROVE, REJECT, CLOSE)
 * @returns {boolean} - Whether action is allowed in this context
 */
function isResponseReviewActionAllowed(context, actionKey) {
    if (!context || !actionKey) {
        return false;
    }

    const { executionDomain, appKey, intent } = context;

    // Must be RESPONSE execution domain
    if (executionDomain !== 'RESPONSE') {
        return false;
    }

    // For discovery (Process Designer), allow from any app (metadata access)
    if (intent === 'DISCOVER') {
        return true;
    }

    // For execution, read-only apps cannot invoke Platform-owned actions
    if (intent === 'EXECUTE') {
        const readOnlyApps = new Set(['AUDIT', 'PORTAL']);
        return !readOnlyApps.has(String(appKey || '').toUpperCase());
    }

    // Unknown intent, deny by default
    return false;
}

// Phase 0I.4: Import execution capabilities registry
const {
    isAutomationDiscoverable,
    isAutomationExecutable,
    getCapabilitiesForProcessDesigner
} = require('./executionCapabilityRegistry');

/**
 * Phase 0I.4: Check if a capability is automation-discoverable
 * 
 * Process Designer can only list capabilities marked as discoverable and automation-capable.
 * 
 * @param {string} capabilityKey - Capability key (e.g., 'RESPONSE_APPROVE')
 * @returns {boolean} - Whether capability is automation-discoverable
 */
function isCapabilityAutomationDiscoverable(capabilityKey) {
    return isAutomationDiscoverable(capabilityKey);
}

/**
 * Phase 0I.4: Check if a capability is automation-executable
 * 
 * Only capabilities with executionType !== 'USER' can be auto-executed.
 * RESPONSE review actions must be discoverable but may have restrictions.
 * 
 * @param {string} capabilityKey - Capability key (e.g., 'RESPONSE_APPROVE')
 * @returns {boolean} - Whether capability can be automated
 */
function isCapabilityAutomationExecutable(capabilityKey) {
    return isAutomationExecutable(capabilityKey);
}

/**
 * Phase 0I.4: Get all capabilities available for Process Designer
 * 
 * Returns capabilities that are:
 * - Discoverable by Process Designer
 * - Automation-capable (not USER-only)
 * 
 * @returns {Array} - Array of capability objects
 */
function getAutomationCapabilitiesForProcessDesigner() {
    return getCapabilitiesForProcessDesigner();
}

module.exports = {
    canUseModuleInAutomation,
    canUseRelationshipInAutomation,
    validateTriggerConfiguration,
    validateActionConfiguration,
    getResponsesAutomationMetadata,
    isResponseReviewActionAllowed,
    isCapabilityAutomationDiscoverable,
    isCapabilityAutomationExecutable,
    getAutomationCapabilitiesForProcessDesigner,
    CONTROL_PLANE_APP_KEY
};

