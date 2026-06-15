#!/usr/bin/env node
'use strict';

/**
 * Seed example release notes for local / staging verification.
 *
 * Usage:
 *   node scripts/seedReleaseNotes.js [admin-email]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getMongoUris, connectMasterWithRetry } = require('../lib/mongoConnect');
const User = require('../models/User');
const ReleaseNote = require('../models/ReleaseNote');
const ReleaseNoteItem = require('../models/ReleaseNoteItem');

const SEED_SLUGS = ['2-8-0-platform-home', '2-8-1-helpdesk-inbox', '2-8-2-bugfixes', '2-9-0-draft-preview'];

async function upsertRelease({ slug, createdBy, note, items }) {
  let release = await ReleaseNote.findOne({ slug });
  if (release) {
    console.log(`  ↷ Skipping existing release: ${slug}`);
    return release;
  }

  release = await ReleaseNote.create({ ...note, slug, createdBy });
  if (items?.length) {
    await ReleaseNoteItem.insertMany(
      items.map((item, index) => ({
        releaseNoteId: release._id,
        sortOrder: index,
        ...item
      }))
    );
  }
  console.log(`  ✓ Created release: ${slug} (${release.status})`);
  return release;
}

async function main() {
  const email = String(
    process.argv[2] || process.env.DEFAULT_ADMIN_EMAIL || 'hello@arivusystems.com'
  ).trim().toLowerCase();

  const { masterUri } = getMongoUris();
  await connectMasterWithRetry(masterUri);

  const admin = await User.findOne({ email });
  if (!admin) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const existing = await ReleaseNote.find({ slug: { $in: SEED_SLUGS } }).select('_id').lean();
  if (existing.length) {
    const ids = existing.map((row) => row._id);
    await ReleaseNoteItem.deleteMany({ releaseNoteId: { $in: ids } });
    await ReleaseNote.deleteMany({ _id: { $in: ids } });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log(`Seeding release notes (createdBy: ${email})...`);

  await upsertRelease({
    slug: '2-8-0-platform-home',
    createdBy: admin._id,
    note: {
      version: '2.8.0',
      title: 'Platform Home redesign',
      summary: 'A clearer landing experience with signals, inbox, and app shortcuts.',
      importance: 'major',
      status: 'published',
      targetApps: [],
      targetPlans: [],
      publishedAt: weekAgo,
      publishedBy: admin._id
    },
    items: [
      {
        type: 'feature',
        title: 'Today brief',
        description: 'See what needs attention across apps in one glance.',
        ctaLabel: 'Open Platform Home',
        ctaUrl: '/platform'
      },
      {
        type: 'feature',
        title: 'App pills',
        description: 'Jump into Sales, Helpdesk, and other apps faster.',
        ctaUrl: '/platform'
      },
      {
        type: 'improvement',
        title: 'Faster load',
        description: 'Platform Home snapshot loads with fewer round trips.'
      }
    ]
  });

  await upsertRelease({
    slug: '2-8-1-helpdesk-inbox',
    createdBy: admin._id,
    note: {
      version: '2.8.1',
      title: 'Helpdesk inbox improvements',
      summary: 'Triage cases faster with a refined inbox layout.',
      importance: 'minor',
      status: 'published',
      targetApps: ['HELPDESK'],
      targetPlans: [],
      publishedAt: threeDaysAgo,
      publishedBy: admin._id
    },
    items: [
      {
        type: 'feature',
        title: 'Unified inbox filters',
        description: 'Filter by assignee, priority, and channel in one bar.',
        ctaLabel: 'Open Cases',
        ctaUrl: '/helpdesk/cases'
      }
    ]
  });

  await upsertRelease({
    slug: '2-8-2-bugfixes',
    createdBy: admin._id,
    note: {
      version: '2.8.2',
      title: 'Patch release',
      summary: 'Stability fixes across tasks and notifications.',
      importance: 'patch',
      status: 'published',
      targetApps: [],
      targetPlans: [],
      publishedAt: yesterday,
      publishedBy: admin._id
    },
    items: [
      {
        type: 'bugfix',
        title: 'Task due date timezone',
        description: 'Due dates now respect the workspace timezone consistently.'
      },
      {
        type: 'bugfix',
        title: 'Notification badge sync',
        description: 'Unread counts stay in sync when marking notifications read on mobile.'
      }
    ]
  });

  await upsertRelease({
    slug: '2-9-0-draft-preview',
    createdBy: admin._id,
    note: {
      version: '2.9.0',
      title: 'Draft: Release notes CMS',
      summary: 'Control Plane editor for platform admins (not published).',
      importance: 'minor',
      status: 'draft',
      targetApps: [],
      targetPlans: []
    },
    items: [
      {
        type: 'feature',
        title: 'Control Plane authoring',
        description: 'Create, schedule, and publish release notes from /control/release-notes.'
      }
    ]
  });

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
