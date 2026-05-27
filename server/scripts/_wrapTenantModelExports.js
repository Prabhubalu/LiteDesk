#!/usr/bin/env node

/**
 * One-shot script: wraps tenant-scoped model files with the tenant proxy.
 *
 * This script is intended to be run ONCE. It is idempotent — re-running on an
 * already-wrapped file is a no-op.
 *
 * What it does for each target file:
 *   - Adds `const { wrapTenantModel } = require('../utils/tenantModelProxy');`
 *     near the top, if missing.
 *   - Replaces the LAST `module.exports = <expr>;` with
 *     `module.exports = wrapTenantModel(<expr>);`
 *
 * Master-only models (Organization, AppDefinition, etc.) are NOT modified.
 *
 * Usage:
 *   node server/scripts/_wrapTenantModelExports.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const TENANT_SCOPED_MODELS = [
    'User',
    'Role',
    'Group',
    'UserPreferences',
    'People',
    'PersonNote',
    'PersonFileAttachment',
    'Deal',
    'DealComment',
    'Task',
    'TaskComment',
    'Event',
    'EventOrder',
    'EventTracking',
    'Item',
    'Case',
    'CorrectiveActionEvidence',
    'ResponseTemplate',
    'Form',
    'FormResponse',
    'FormKPIs',
    'ImportHistory',
    'AutomationRule',
    'AutomationExecution',
    'BusinessFlow',
    'Process',
    'ProcessExecution',
    'ApprovalInstance',
    'AuditAssignment',
    'AuditExecutionContext',
    'AuditTimeline',
    'Notification',
    'NotificationPreference',
    'NotificationRule',
    'PushSubscription',
    'Lifecycle',
    'LifecycleStatusMap',
    'EntityType',
    'Scheduling',
    'AssignmentRuleSet',
    'AssignmentExecutionLog',
    'AssignmentScheduleJob',
    'TenantMailroomConfig',
    'MailroomRawPayload',
    'MailroomConversation',
    'MailroomMessage',
    'MailroomAttachment',
  'DeferredAutomationAction',
    'BusinessHoursDailyKpi',
    'Communication',
    'RelationshipInstance',
    'Report',
    'ThreadView',
    'TrashSnapshot',
    'ExecutionLog',
    'RecordActivity',
    'RecordDescriptionVersion',
    'OrganizationSubscription'
];

const MODELS_DIR = path.join(__dirname, '..', 'models');

const dryRun = process.argv.includes('--dry-run');
const importLine = `const { wrapTenantModel } = require('../utils/tenantModelProxy');`;
const importMarker = 'wrapTenantModel';

function wrapFile(filePath, modelName) {
    if (!fs.existsSync(filePath)) {
        return { skipped: true, reason: 'file missing' };
    }
    const original = fs.readFileSync(filePath, 'utf8');
    if (original.includes(importMarker)) {
        return { skipped: true, reason: 'already wrapped' };
    }

    // Find the LAST top-level `module.exports = ...;` assignment.
    // Match either:
    //   module.exports = mongoose.model('Name', Schema);
    //   module.exports = SomeIdentifier;
    // Anchored at start of line, captures the right-hand-side without trailing
    // semicolon.
    const exportRegex = /^(module\.exports\s*=\s*)([^;]+);/gm;
    let lastMatch = null;
    let matchArr;
    while ((matchArr = exportRegex.exec(original)) !== null) {
        lastMatch = matchArr;
    }
    if (!lastMatch) {
        return { skipped: true, reason: 'no module.exports = ...; found' };
    }

    const rhs = lastMatch[2].trim();
    // Avoid double-wrapping if the RHS already references wrapTenantModel
    if (rhs.includes('wrapTenantModel')) {
        return { skipped: true, reason: 'rhs already wrapped' };
    }

    // Build replacement: wrap the RHS with wrapTenantModel(...)
    const replacement = `${lastMatch[1]}wrapTenantModel(${rhs});`;
    let updated =
        original.slice(0, lastMatch.index) +
        replacement +
        original.slice(lastMatch.index + lastMatch[0].length);

    // Inject the require line near the top. Insert after the first non-comment
    // line that already references mongoose, otherwise at the top. We add it
    // immediately after the last top-of-file `require(` line to keep imports
    // grouped.
    const lines = updated.split('\n');
    let insertAt = -1;
    for (let i = 0; i < Math.min(lines.length, 80); i += 1) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('const ') && trimmed.includes("require('")) {
            insertAt = i + 1;
        } else if (trimmed.length === 0 && insertAt !== -1) {
            // First blank line after the require block - stop here.
            break;
        } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            continue;
        } else if (trimmed.length === 0) {
            continue;
        } else if (insertAt === -1) {
            // Hit code before any require — insert before this line.
            insertAt = i;
            break;
        }
    }
    if (insertAt === -1) insertAt = 0;
    lines.splice(insertAt, 0, importLine);
    updated = lines.join('\n');

    if (!dryRun) {
        fs.writeFileSync(filePath, updated, 'utf8');
    }
    return { wrapped: true, modelName };
}

function main() {
    const results = [];
    for (const modelName of TENANT_SCOPED_MODELS) {
        const filePath = path.join(MODELS_DIR, `${modelName}.js`);
        const result = wrapFile(filePath, modelName);
        results.push({ modelName, ...result });
        if (result.wrapped) {
            console.log(`✅ ${modelName}.js wrapped`);
        } else {
            console.log(`⏭️  ${modelName}.js skipped (${result.reason})`);
        }
    }

    const wrappedCount = results.filter((r) => r.wrapped).length;
    console.log(`\nDone. ${wrappedCount} file(s) wrapped${dryRun ? ' (dry run)' : ''}.`);
}

if (require.main === module) {
    main();
}

module.exports = { TENANT_SCOPED_MODELS };
