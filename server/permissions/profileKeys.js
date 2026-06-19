/**
 * System profile keys — seeded per tenant, referenced by roles.
 */
const SYSTEM_PROFILE_KEYS = {
  PLATFORM_FULL: 'platform_full',
  SALES_FULL: 'sales_full',
  SALES_MANAGER: 'sales_manager',
  SALES_STANDARD: 'sales_standard',
  READ_ONLY: 'read_only',
  HELPDESK_ADMIN: 'helpdesk_admin',
  HELPDESK_AGENT: 'helpdesk_agent',
  AUDIT_MANAGER: 'audit_manager',
  AUDIT_AUDITOR: 'audit_auditor',
  PORTAL_CUSTOMER: 'portal_customer',
  PORTAL_VIEWER: 'portal_viewer',
  PROJECTS_MEMBER: 'projects_member',
  INVENTORY_OPERATOR: 'inventory_operator'
};

module.exports = {
  SYSTEM_PROFILE_KEYS
};
