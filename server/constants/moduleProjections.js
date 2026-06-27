/**
 * ============================================================================
 * Phase 2A.1: Module Projection Metadata Registry
 * ============================================================================
 * 
 * This file defines projection metadata that allows apps to extend and
 * constrain platform-owned core primitives (People, Organizations, Events, Forms)
 * without duplicating data or altering schemas.
 * 
 * ⚠️ This is PLATFORM metadata, NOT tenant data
 * ⚠️ Pure metadata - no logic, no behavior changes
 * ⚠️ Single source of truth for projection definitions
 * 
 * Design Principles:
 * - Single Source of Truth: Core primitives remain one table per primitive
 * - Apps project, not own: Apps declare how they see a primitive
 * - Platform owns the primitive: Platform controls the schema
 * - Type-driven: Visibility and behavior determined by type
 * - Backward compatible: Existing APIs continue working
 * 
 * ============================================================================
 */

module.exports = {
  PEOPLE: {
    platformOwned: true,
    baseModuleKey: 'people',
    types: ['LEAD', 'CONTACT', 'PARTNER'],
    apps: {
      SALES: {
        allowedTypes: ['LEAD', 'CONTACT'],
        defaultType: 'LEAD',
        behaviors: {
          conversion: {
            from: 'LEAD',
            to: 'CONTACT'
          }
        }
      },
      HELPDESK: {
        allowedTypes: ['CONTACT']
      },
      AUDIT: {
        readOnly: true,
        allowedTypes: ['CONTACT']
      },
      PORTAL: {
        readOnly: true,
        allowedTypes: ['CONTACT']
      }
    }
  },

  ORGANIZATION: {
    platformOwned: true,
    baseModuleKey: 'organizations',
    types: ['CUSTOMER', 'PARTNER', 'VENDOR', 'DEALER', 'CONTRACTOR', 'AUDITOR'],
    apps: {
      SALES: {
        allowedTypes: ['CUSTOMER', 'PARTNER']
      },
      HELPDESK: {
        allowedTypes: ['CUSTOMER']
      },
      AUDIT: {
        readOnly: true,
        allowedTypes: ['CUSTOMER', 'PARTNER', 'VENDOR']
      },
      PORTAL: {
        readOnly: true,
        allowedTypes: ['CUSTOMER', 'PARTNER', 'VENDOR', 'DEALER', 'CONTRACTOR', 'AUDITOR']
      }
    }
  },

  EVENT: {
    platformOwned: true,
    baseModuleKey: 'events',
    types: ['MEETING', 'INTERNAL_AUDIT', 'EXTERNAL_AUDIT_SINGLE', 'EXTERNAL_AUDIT_BEAT', 'FIELD_SALES_BEAT'],
    apps: {
      SALES: {
        allowedTypes: ['MEETING', 'INTERNAL_AUDIT', 'EXTERNAL_AUDIT_SINGLE', 'EXTERNAL_AUDIT_BEAT', 'FIELD_SALES_BEAT'],
        defaultType: 'MEETING'
      },
      AUDIT: {
        allowedTypes: ['INTERNAL_AUDIT', 'EXTERNAL_AUDIT_SINGLE', 'EXTERNAL_AUDIT_BEAT'],
        readOnly: true
      },
      PORTAL: {
        readOnly: true,
        allowedTypes: ['MEETING', 'INTERNAL_AUDIT', 'EXTERNAL_AUDIT_SINGLE', 'EXTERNAL_AUDIT_BEAT']
      }
    }
  },

  FORM: {
    platformOwned: true,
    baseModuleKey: 'forms',
    types: ['SURVEY', 'AUDIT', 'FEEDBACK'],
    apps: {
      SALES: {
        allowedTypes: ['SURVEY', 'AUDIT', 'FEEDBACK'],
        defaultType: 'SURVEY'
      },
      AUDIT: {
        allowedTypes: ['AUDIT'],
        readOnly: true
      },
      PORTAL: {
        readOnly: true,
        allowedTypes: ['SURVEY', 'FEEDBACK']
      }
    }
  }
};

