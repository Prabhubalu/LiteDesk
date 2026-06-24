/**
 * ============================================================================
 * Phase 0I.4: Execution Capabilities Registry
 * ============================================================================
 * 
 * Platform-level registry of all execution capabilities in the system.
 * 
 * ⚠️ IMPORTANT: This is METADATA ONLY
 * - No logic is executed here
 * - No state mutation happens here
 * - No UI rendering happens here
 * - This is purely declarative vocabulary
 * 
 * Purpose:
 * - Declare what actions exist in the system
 * - Declare which app owns execution
 * - Declare who can execute vs who can only view
 * - Enable Process Designer discovery (future)
 * - Enable UI rendering without guessing (future)
 * 
 * Core Principles:
 * - Execution ownership is explicit
 * - Every action has exactly one execution owner app
 * - Discovery ≠ Execution
 * - Platform owns Response execution (FormResponse state machine)
 * - Sales remains execution engine for Event/Audit workflows
 * - Audit App and Portal are never execution owners
 * 
 * ============================================================================
 */

/**
 * Execution Capabilities Registry
 * 
 * Each capability declares:
 * - What action exists
 * - Which app owns execution
 * - Who can discover vs execute
 * - Whether automation is allowed
 * - UI hints for future rendering
 * 
 * ⚠️ SAFETY: These are declarations only, not executable logic.
 * Any execution must occur via execution controllers only.
 */
const EXECUTION_CAPABILITIES = {
  // ============================================================================
  // RESPONSE Domain Capabilities
  // ============================================================================
  
  RESPONSE_SUBMIT: {
    capabilityKey: 'RESPONSE_SUBMIT',
    domain: 'RESPONSE',
    action: 'SUBMIT',
    
    executionOwnerApp: 'PLATFORM',
    executionType: 'USER',
    
    discoverableBy: ['SALES', 'AUDIT', 'PORTAL', 'PROCESS_DESIGNER'],
    executableBy: ['PLATFORM'],
    
    auditAppPolicy: 'READ_ONLY',
    portalPolicy: 'READ_ONLY',
    
    requiresOwnership: false,
    requiresInstanceActive: true,
    
    uiHints: {
      label: 'Submit Response',
      variant: 'primary',
      icon: 'paper-plane',
      confirmationRequired: false
    }
  },

  RESPONSE_APPROVE: {
    capabilityKey: 'RESPONSE_APPROVE',
    domain: 'RESPONSE',
    action: 'APPROVE',
    
    executionOwnerApp: 'PLATFORM',
    executionType: 'AUTOMATION', // Can be automated by Process Designer
    
    discoverableBy: ['SALES', 'AUDIT', 'PORTAL', 'PROCESS_DESIGNER'],
    executableBy: ['PLATFORM'],
    
    auditAppPolicy: 'READ_ONLY',
    portalPolicy: 'READ_ONLY',
    
    requiresOwnership: true, // Auditor must own the event
    requiresInstanceActive: true,
    
    uiHints: {
      label: 'Approve Response',
      variant: 'success',
      icon: 'check-circle',
      confirmationRequired: true
    }
  },

  RESPONSE_REJECT: {
    capabilityKey: 'RESPONSE_REJECT',
    domain: 'RESPONSE',
    action: 'REJECT',
    
    executionOwnerApp: 'PLATFORM',
    executionType: 'AUTOMATION',
    
    discoverableBy: ['SALES', 'AUDIT', 'PORTAL', 'PROCESS_DESIGNER'],
    executableBy: ['PLATFORM'],
    
    auditAppPolicy: 'READ_ONLY',
    portalPolicy: 'READ_ONLY',
    
    requiresOwnership: true,
    requiresInstanceActive: true,
    
    uiHints: {
      label: 'Reject Response',
      variant: 'danger',
      icon: 'x-circle',
      confirmationRequired: true
    }
  },

  RESPONSE_CLOSE: {
    capabilityKey: 'RESPONSE_CLOSE',
    domain: 'RESPONSE',
    action: 'CLOSE',
    
    executionOwnerApp: 'PLATFORM',
    executionType: 'AUTOMATION',
    
    discoverableBy: ['SALES', 'AUDIT', 'PORTAL', 'PROCESS_DESIGNER'],
    executableBy: ['PLATFORM'],
    
    auditAppPolicy: 'READ_ONLY',
    portalPolicy: 'READ_ONLY',
    
    requiresOwnership: true,
    requiresInstanceActive: true,
    
    uiHints: {
      label: 'Close Response',
      variant: 'secondary',
      icon: 'lock-closed',
      confirmationRequired: true
    }
  },

  // ============================================================================
  // EVENT / AUDIT Domain Capabilities
  // ============================================================================
  
  AUDIT_CHECK_IN: {
    capabilityKey: 'AUDIT_CHECK_IN',
    domain: 'EVENT',
    action: 'CHECK_IN',
    
    executionOwnerApp: 'SALES',
    executionType: 'USER',
    
    discoverableBy: ['SALES', 'AUDIT', 'PROCESS_DESIGNER'],
    executableBy: ['SALES'],
    
    auditAppPolicy: 'READ_ONLY',
    portalPolicy: 'HIDDEN',
    
    requiresOwnership: true, // Auditor must own the event
    requiresInstanceActive: true,
    
    uiHints: {
      label: 'Check In to Audit',
      variant: 'primary',
      icon: 'map-pin',
      confirmationRequired: false
    }
  },

  AUDIT_SUBMIT: {
    capabilityKey: 'AUDIT_SUBMIT',
    domain: 'EVENT',
    action: 'SUBMIT',
    
    executionOwnerApp: 'SALES',
    executionType: 'USER',
    
    discoverableBy: ['SALES', 'AUDIT', 'PROCESS_DESIGNER'],
    executableBy: ['SALES'],
    
    auditAppPolicy: 'READ_ONLY',
    portalPolicy: 'HIDDEN',
    
    requiresOwnership: true,
    requiresInstanceActive: true,
    
    uiHints: {
      label: 'Submit Audit Response',
      variant: 'primary',
      icon: 'paper-plane',
      confirmationRequired: true
    }
  },

  AUDIT_APPROVE: {
    capabilityKey: 'AUDIT_APPROVE',
    domain: 'EVENT',
    action: 'APPROVE',
    
    executionOwnerApp: 'SALES',
    executionType: 'AUTOMATION',
    
    discoverableBy: ['SALES', 'AUDIT', 'PROCESS_DESIGNER'],
    executableBy: ['SALES'],
    
    auditAppPolicy: 'READ_ONLY',
    portalPolicy: 'HIDDEN',
    
    requiresOwnership: true,
    requiresInstanceActive: true,
    
    uiHints: {
      label: 'Approve Audit',
      variant: 'success',
      icon: 'check-circle',
      confirmationRequired: true
    }
  },

  AUDIT_REJECT: {
    capabilityKey: 'AUDIT_REJECT',
    domain: 'EVENT',
    action: 'REJECT',
    
    executionOwnerApp: 'SALES',
    executionType: 'AUTOMATION',
    
    discoverableBy: ['SALES', 'AUDIT', 'PROCESS_DESIGNER'],
    executableBy: ['SALES'],
    
    auditAppPolicy: 'READ_ONLY',
    portalPolicy: 'HIDDEN',
    
    requiresOwnership: true,
    requiresInstanceActive: true,
    
    uiHints: {
      label: 'Reject Audit',
      variant: 'danger',
      icon: 'x-circle',
      confirmationRequired: true
    }
  }
};

/**
 * Get all execution capabilities
 * 
 * @returns {Object} - All execution capabilities keyed by capabilityKey
 */
function getAllExecutionCapabilities() {
  return { ...EXECUTION_CAPABILITIES };
}

/**
 * Get capabilities by domain
 * 
 * @param {string} domain - Execution domain (e.g., 'RESPONSE', 'EVENT')
 * @returns {Array} - Array of capability objects for the domain
 */
function getCapabilitiesByDomain(domain) {
  if (!domain) {
    return [];
  }

  const domainUpper = domain.toUpperCase();
  return Object.values(EXECUTION_CAPABILITIES).filter(
    cap => cap.domain === domainUpper
  );
}

/**
 * Get a specific capability by key
 * 
 * @param {string} capabilityKey - Capability key (e.g., 'RESPONSE_APPROVE')
 * @returns {Object|null} - Capability object or null if not found
 */
function getCapability(capabilityKey) {
  if (!capabilityKey) {
    return null;
  }

  return EXECUTION_CAPABILITIES[capabilityKey.toUpperCase()] || null;
}

module.exports = {
  EXECUTION_CAPABILITIES,
  getAllExecutionCapabilities,
  getCapabilitiesByDomain,
  getCapability
};

