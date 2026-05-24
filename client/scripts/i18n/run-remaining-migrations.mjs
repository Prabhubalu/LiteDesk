#!/usr/bin/env node
/**
 * Run auto-migrate-vue across all remaining non-i18n Vue surfaces.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, 'auto-migrate-vue.mjs');

/** @type {{ namespace: string, globs: string[] }[]} */
const BATCHES = [
  {
    namespace: 'records',
    globs: [
      'src/components/Notes.vue',
      'src/components/Files.vue',
      'src/components/ExecutionActionBar.vue',
      'src/components/ActivityTimeline.vue',
      'src/components/record-page',
      'src/components/record-detail',
      'src/components/relationships',
      'src/components/activity',
      'src/components/approvals',
      'src/pages/ModuleRecordPage.vue',
      'src/pages/tasks/LinkRecordModal.vue',
    ],
  },
  {
    namespace: 'tasks',
    globs: ['src/components/tasks', 'src/views/Tasks.vue', 'src/views/TaskDetail.vue'],
  },
  {
    namespace: 'events',
    globs: [
      'src/components/events',
      'src/views/Events.vue',
      'src/views/EventDetail.vue',
      'src/views/EventExecutionSurface.vue',
    ],
  },
  {
    namespace: 'deals',
    globs: ['src/components/deals', 'src/views/Deals.vue', 'src/views/DealDetail.vue', 'src/pages/deals'],
  },
  {
    namespace: 'people',
    globs: [
      'src/components/people',
      'src/components/contacts',
      'src/views/People.vue',
      'src/views/PeopleCreate.vue',
      'src/views/PeopleDetail.vue',
      'src/views/PeopleQuickCreate.vue',
      'src/views/PeopleSurface.vue',
      'src/views/ContactDetail.vue',
    ],
  },
  {
    namespace: 'organizations',
    globs: [
      'src/components/organizations',
      'src/views/Organizations.vue',
      'src/views/OrganizationDetail.vue',
      'src/views/OrganizationSurface.vue',
      'src/views/CreateOrganizationSurface.vue',
      'src/views/Groups.vue',
      'src/views/GroupDetail.vue',
    ],
  },
  {
    namespace: 'inbox',
    globs: [
      'src/components/inbox',
      'src/components/communications',
      'src/views/InboxSurface.vue',
    ],
  },
  {
    namespace: 'dashboard',
    globs: ['src/components/dashboard', 'src/views/Dashboard.vue'],
  },
  {
    namespace: 'import',
    globs: ['src/components/import', 'src/views/Imports.vue', 'src/views/ImportDetail.vue'],
  },
  {
    namespace: 'audit',
    globs: [
      'src/components/audit',
      'src/views/audit',
      'src/views/portal',
      'src/views/Responses.vue',
      'src/views/ResponseDetail.vue',
    ],
  },
  {
    namespace: 'platform',
    globs: [
      'src/components/platform',
      'src/views/platform',
      'src/views/InstanceManagement.vue',
      'src/views/LandingPage.vue',
      'src/views/GenericModule.vue',
    ],
  },
  {
    namespace: 'auth',
    globs: ['src/components/auth/RegistrationForm.vue', 'src/components/DemoRequestForm.vue'],
  },
  {
    namespace: 'common',
    globs: [
      'src/components/common/Avatar.vue',
      'src/components/common/CardWidget.vue',
      'src/components/common/HoverTooltip.vue',
      'src/components/common/KeyFieldsWidget.vue',
      'src/components/common/LifecycleStageWidget.vue',
      'src/components/common/PermissionButton.vue',
      'src/components/common/PhoneInput.vue',
      'src/components/common/QuickPreviewDrawer.vue',
      'src/components/common/table',
      'src/components/module-list',
      'src/components/groups',
      'src/components/targets',
      'src/components/helpdesk',
      'src/components/admin/process/TimelineItem.vue',
      'src/components/process-flow/ProcessActionFields.vue',
      'src/components/notifications/ChannelBadge.vue',
      'src/components/settings/NotificationSettings.vue',
      'src/views/Trash.vue',
      'src/views/ApprovalDetail.vue',
      'src/views/ApprovalInbox.vue',
      'src/views/Items.vue',
      'src/views/ItemDetail.vue',
      'src/views/DemoRequests.vue',
      'src/views/PublicBookingView.vue',
      'src/views/settings/NotificationOverview.vue',
      'src/views/settings/NotificationHealth.vue',
      'src/views/settings/NotificationPreferences.vue',
      'src/views/settings/NotificationRules.vue',
    ],
  },
  {
    namespace: 'navigation',
    globs: ['src/layouts/PlatformLandingLayout.vue', 'src/App.vue'],
  },
];

const dryRun = process.argv.includes('--dry-run');

for (const batch of BATCHES) {
  console.log(`\n=== ${batch.namespace} ===`);
  const args = ['--namespace', batch.namespace, ...(dryRun ? [] : ['--write'])];
  for (const g of batch.globs) args.push('--glob', g);
  const r = spawnSync('node', [script, ...args], { stdio: 'inherit', cwd: path.join(__dirname, '../..') });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('\nAll batches complete.');
