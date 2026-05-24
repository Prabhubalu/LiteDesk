#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, 'auto-migrate-vue.mjs');
const mergeScript = path.join(__dirname, 'merge-locale-keys.mjs');
const root = path.join(__dirname, '../..');

const BATCHES = [
  {
    id: 'record-shell',
    namespace: 'records',
    files: [
      'src/components/ExecutionActionBar.vue',
      'src/components/record-page/AccordionSection.vue',
      'src/components/record-page/CommentContent.vue',
      'src/components/record-page/EditableTitle.vue',
      'src/components/record-page/RecordContextPanel.vue',
      'src/components/record-page/RecordPageLayout.vue',
      'src/components/record-page/RecordPageTitleRow.vue',
      'src/pages/ModuleRecordPage.vue',
    ],
  },
  { id: 'ui-primitives', namespace: 'common', globs: ['src/components/ui'] },
  {
    id: 'common-widgets',
    namespace: 'common',
    files: [
      'src/components/common/Avatar.vue',
      'src/components/common/CardWidget.vue',
      'src/components/common/HoverTooltip.vue',
      'src/components/common/KeyFieldsWidget.vue',
      'src/components/common/LifecycleStageWidget.vue',
      'src/components/common/PermissionButton.vue',
      'src/components/common/PhoneInput.vue',
      'src/components/common/QuickPreviewDrawer.vue',
      'src/components/common/table/BadgeCell.vue',
      'src/components/common/table/DateCell.vue',
    ],
  },
  {
    id: 'activity-chrome',
    namespace: 'records',
    files: [
      'src/components/activity/ActivityEventRenderer.vue',
      'src/components/activity/controls/AttachmentList.vue',
      'src/components/activity/controls/ThreadReplies.vue',
      'src/components/activity/events/ActivityEmailThreadCard.vue',
      'src/components/admin/process/TimelineItem.vue',
    ],
  },
  {
    id: 'events-misc',
    namespace: 'events',
    files: ['src/components/events/EventQuickCreateDrawer.vue'],
  },
  {
    id: 'forms-misc',
    namespace: 'forms',
    files: [
      'src/components/forms/question-types/DateQuestion.vue',
      'src/components/forms/question-types/SignatureQuestion.vue',
    ],
  },
  {
    id: 'people-misc',
    namespace: 'people',
    files: ['src/components/people/PeopleListParticipationTypeCell.vue'],
  },
  {
    id: 'product-misc',
    namespace: 'common',
    files: [
      'src/components/global/GlobalSurfacesProvider.vue',
      'src/components/helpdesk/CaseSlaContextBanner.vue',
      'src/components/notifications/ChannelBadge.vue',
      'src/components/platform/AttentionItemRow.vue',
      'src/components/relationships/RelatedRecordRow.vue',
      'src/components/targets/TargetEmptyState.vue',
      'src/components/targets/TargetProgressBar.vue',
      'src/views/ItemDetail.vue',
      'src/views/TaskDetail.vue',
    ],
  },
  {
    id: 'process-misc',
    namespace: 'process',
    files: ['src/components/process-flow/ProcessActionFields.vue'],
  },
  {
    id: 'settings-misc',
    namespace: 'settings',
    files: ['src/components/settings/NotificationSettings.vue'],
  },
  {
    id: 'app-shell',
    namespace: 'navigation',
    files: [
      'src/App.vue',
      'src/components/NotificationContainer.vue',
      'src/components/PlatformShell.vue',
      'src/layouts/PlatformLandingLayout.vue',
    ],
  },
];

for (const batch of BATCHES) {
  console.log(`\n=== ${batch.id} (${batch.namespace}) ===`);
  const args = ['--namespace', batch.namespace, '--write'];
  if (batch.files) args.push(...batch.files);
  if (batch.globs) for (const g of batch.globs) args.push('--glob', g);
  const r = spawnSync('node', [script, ...args], { stdio: 'inherit', cwd: root });
  if (r.status !== 0) process.exit(r.status ?? 1);

  const keysFile = path.join(__dirname, `auto-${batch.namespace}-keys.json`);
  if (fs.existsSync(keysFile)) {
    spawnSync('node', [mergeScript, batch.namespace, path.basename(keysFile)], {
      stdio: 'inherit',
      cwd: __dirname,
    });
  }
}

console.log('\nFinal Vue migrations complete.');
