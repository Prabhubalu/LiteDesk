#!/usr/bin/env node

/**
 * DEPRECATED: This script is no longer needed after Organization/OrganizationV2 consolidation.
 * 
 * All organizations are now unified in the Organization model with isTenant flag.
 * 
 * If you need to migrate old data, use migrateOrganizationV2ToOrganization.js instead.
 */

console.log('⚠️  This script is deprecated.');
console.log('📝 Organizations are now unified in the Organization model.');
console.log('📝 Tenant organizations have isTenant: true');
console.log('📝 CRM organizations have isTenant: false');
console.log('\n✅ No migration needed - use the unified Organization model.');

process.exit(0);
