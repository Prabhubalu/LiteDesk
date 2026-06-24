/**
 * ============================================================================
 * Phase 0I.1: App Boundary Enforcement Guards
 * ============================================================================
 *
 * Enforces hard boundaries between apps to ensure:
 * - Platform owns FormResponse execution (state machine)
 * - Audit App never mutates Responses directly
 * - Portal App accesses Responses only through corrective actions
 *
 * ⚠️ Critical: These guards prevent cross-app state machine duplication
 * ⚠️ These are defensive guards, not business logic
 *
 * ============================================================================
 */

const { APP_KEYS } = require('../constants/appKeys');
const EXECUTION_DOMAINS = require('../constants/executionDomains');
const {
  canDiscoverCapability,
  canExecuteCapability,
  getCapability
} = require('../utils/executionCapabilityRegistry');

const READ_ONLY_RESPONSE_APPS = new Set(EXECUTION_DOMAINS.READ_ONLY_RESPONSE_APPS || ['AUDIT', 'PORTAL']);

/**
 * Guard: Prevent Audit App from directly mutating Responses
 * Audit App must call Platform execution controllers internally
 */
function enforceAuditAppReadOnly(req, res, next) {
  if (req.appKey !== APP_KEYS.AUDIT) {
    return next();
  }

  const isResponseMutation = req.path.includes('/responses') ||
                             req.path.includes('/form-responses') ||
                             req.body?.executionStatus ||
                             req.body?.reviewStatus;

  if (isResponseMutation && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    console.warn(`[AppBoundaryGuard] BLOCKED: Audit App attempted to mutate Response directly: ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: 'Audit App cannot mutate Responses directly. All mutations must go through the Platform execution gateway.',
      code: 'AUDIT_APP_READ_ONLY'
    });
  }

  next();
}

/**
 * Guard: Prevent Portal App from accessing Responses directly
 * Portal should only see corrective actions
 */
function enforcePortalIndirectAccess(req, res, next) {
  if (req.appKey !== APP_KEYS.PORTAL) {
    return next();
  }

  const isResponseAccess = req.path.includes('/responses') ||
                           req.path.includes('/form-responses') ||
                           (req.query?.module === 'responses');

  if (isResponseAccess) {
    console.warn(`[AppBoundaryGuard] BLOCKED: Portal App attempted to access Response directly: ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: 'Portal App cannot access Responses directly. Portal should access corrective actions only.',
      code: 'PORTAL_INDIRECT_ACCESS_ONLY'
    });
  }

  next();
}

/**
 * Guard: Ensure Platform execution authority for Response mutations
 * Read-only apps (Audit, Portal) must use the execution gateway
 */
function enforcePlatformResponseExecutionAuthority(req, res, next) {
  const isExecutionOperation = req.path.includes('/responses') &&
                               (req.path.includes('/submit') ||
                                req.path.includes('/approve') ||
                                req.path.includes('/reject') ||
                                req.body?.executionStatus === 'Submitted');

  if (isExecutionOperation && READ_ONLY_RESPONSE_APPS.has(req.appKey)) {
    console.warn(`[AppBoundaryGuard] BLOCKED: Read-only app attempted Response execution: ${req.appKey} ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: 'Only Platform execution controllers may mutate Responses. Read-only apps must use the execution gateway.',
      code: 'PLATFORM_EXECUTION_AUTHORITY_ONLY'
    });
  }

  next();
}

/** @deprecated Use enforcePlatformResponseExecutionAuthority */
const enforceCRMExecutionAuthority = enforcePlatformResponseExecutionAuthority;

/**
 * Guard: Validate execution domain access
 * Checks execution domain registry for app access rules
 */
function validateExecutionDomainAccess(req, res, next) {
  const isResponseOperation = req.path.includes('/responses') ||
                              req.path.includes('/form-responses');

  if (!isResponseOperation) {
    return next();
  }

  const responseDomain = EXECUTION_DOMAINS.RESPONSE;
  if (!responseDomain) {
    return next();
  }

  const appAccessRule = responseDomain.appAccessRules?.[req.appKey];
  if (!appAccessRule) {
    if (!responseDomain.exposedToApps.includes(req.appKey)) {
      console.warn(`[AppBoundaryGuard] BLOCKED: App ${req.appKey} not allowed to access Response domain`);
      return res.status(403).json({
        success: false,
        message: `App ${req.appKey} does not have access to Response execution domain.`,
        code: 'EXECUTION_DOMAIN_ACCESS_DENIED'
      });
    }
  }

  if (req.appKey === APP_KEYS.AUDIT && appAccessRule?.mode === 'READ_ONLY') {
    if (req.method !== 'GET') {
      console.warn(`[AppBoundaryGuard] BLOCKED: Audit App attempted ${req.method} operation on READ_ONLY domain`);
      return res.status(403).json({
        success: false,
        message: 'Audit App has READ_ONLY access. All mutations must go through the Platform execution gateway.',
        code: 'AUDIT_APP_READ_ONLY'
      });
    }
  }

  if (req.appKey === APP_KEYS.PORTAL && appAccessRule?.mode === 'INDIRECT') {
    if (!req.path.includes('/corrective-actions')) {
      console.warn(`[AppBoundaryGuard] BLOCKED: Portal App attempted direct access to Response domain`);
      return res.status(403).json({
        success: false,
        message: 'Portal App has INDIRECT access. Access Responses through corrective actions only.',
        code: 'PORTAL_INDIRECT_ACCESS_ONLY'
      });
    }
  }

  next();
}

function canAppDiscoverCapability(appKey, capabilityKey) {
  if (!appKey || !capabilityKey) {
    return false;
  }

  return canDiscoverCapability(appKey, capabilityKey);
}

function canAppExecuteCapability(appKey, capabilityKey) {
  if (!appKey || !capabilityKey) {
    return false;
  }

  const capability = getCapability(capabilityKey);
  if (!capability) {
    return false;
  }

  if (capability.executionOwnerApp === EXECUTION_DOMAINS.PLATFORM_EXECUTION_OWNER) {
    if (READ_ONLY_RESPONSE_APPS.has(appKey)) {
      return false;
    }
    return canExecuteCapability(EXECUTION_DOMAINS.PLATFORM_EXECUTION_OWNER, capabilityKey);
  }

  if (appKey === APP_KEYS.AUDIT || appKey === APP_KEYS.PORTAL) {
    return false;
  }

  if (appKey === APP_KEYS.SALES) {
    return canExecuteCapability(appKey, capabilityKey);
  }

  return false;
}

function getCapabilitiesMetadataForApp(appKey, domain = null) {
  if (!appKey) {
    return [];
  }

  const { getCapabilitiesForApp, getCapabilitiesByDomain } = require('../utils/executionCapabilityRegistry');

  let capabilities;
  if (domain) {
    const { getCapabilitiesForRecordContext } = require('../utils/executionCapabilityRegistry');
    capabilities = getCapabilitiesForRecordContext(domain, appKey);
  } else {
    capabilities = getCapabilitiesForApp(appKey);
  }

  return capabilities.map(cap => {
    const capabilityKey = cap.capabilityKey;

    return {
      ...cap,
      allowedToDiscover: canAppDiscoverCapability(appKey, capabilityKey),
      allowedToExecute: canAppExecuteCapability(appKey, capabilityKey),
      auditAppPolicy: cap.auditAppPolicy || 'READ_ONLY',
      portalPolicy: cap.portalPolicy || 'READ_ONLY'
    };
  });
}

module.exports = {
  enforceAuditAppReadOnly,
  enforcePortalIndirectAccess,
  enforcePlatformResponseExecutionAuthority,
  enforceCRMExecutionAuthority,
  validateExecutionDomainAccess,
  canAppDiscoverCapability,
  canAppExecuteCapability,
  getCapabilitiesMetadataForApp
};
