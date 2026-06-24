/**
 * ============================================================================
 * Execution Domains Registry
 * ============================================================================
 *
 * Platform-level registry for execution domains.
 * Execution domains represent first-class execution entities in the platform
 * that drive workflows, corrective actions, approvals, and reporting.
 *
 * ⚠️ This is PLATFORM metadata, NOT tenant data
 * ⚠️ Defines execution domains, NOT new apps
 *
 * Responses Registration:
 * - Responses are a platform execution domain (FormResponse state machine)
 * - Platform controllers (/api/forms) remain the mutation surface
 * - Audit App and Portal consume Response state read-only
 *
 * ============================================================================
 */

// Phase 0I.3: Import review actions metadata
const { RESPONSE_REVIEW_ACTIONS } = require('./reviewActions');

const PLATFORM_EXECUTION_OWNER = 'PLATFORM';
const READ_ONLY_RESPONSE_APPS = ['AUDIT', 'PORTAL'];

module.exports = {
  PLATFORM_EXECUTION_OWNER,
  READ_ONLY_RESPONSE_APPS,

  RESPONSE: {
    key: 'RESPONSE',
    label: 'Response',
    sourceApp: PLATFORM_EXECUTION_OWNER,
    executionOwner: PLATFORM_EXECUTION_OWNER,
    primaryModel: 'FormResponse',
    reviewable: true,
    supportsCorrectiveActions: true,
    exposedToApps: ['AUDIT', 'PORTAL'],
    immutableAfterSubmit: true,

    statuses: {
      executionStatus: [
        'Not Started',
        'In Progress',
        'Submitted'
      ],
      reviewStatus: [
        null,
        'Pending Corrective Action',
        'Needs Auditor Review',
        'Approved',
        'Rejected',
        'Closed'
      ]
    },

    lifecycleOwner: PLATFORM_EXECUTION_OWNER,

    // Phase 0I.3: Review actions metadata
    // ⚠️ SAFETY: These are declarative metadata only, not executable logic.
    // All actions are Platform-owned. Audit App and Portal are read-only.
    reviewActions: RESPONSE_REVIEW_ACTIONS,

    // Phase 0I.3: Execution ownership metadata
    executionOwnedBy: PLATFORM_EXECUTION_OWNER,
    allowsDirectExecution: false,
    auditAppReadOnly: true,
    portalReadOnly: true,

    appAccessRules: {
      AUDIT: {
        mode: 'READ_ONLY',
        via: 'Execution Gateway',
        description: 'Audit App never mutates Response directly. All mutations go through Platform execution controllers.'
      },
      PORTAL: {
        mode: 'INDIRECT',
        via: 'Corrective Actions',
        description: 'Portal does NOT access responses directly. Portal sees Corrective Actions and Evidence uploads. Status derived from FormResponse.reviewStatus.'
      }
    },

    description:
      'Execution record created from form submission. Drives corrective actions, auditor review, and reporting.'
  }
};
