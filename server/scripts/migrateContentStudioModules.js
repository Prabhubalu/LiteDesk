'use strict';

/**
 * Idempotent seed for Content Studio sidebar modules (helpdesk.articles, marketing.blog).
 *
 * Usage: node server/scripts/migrateContentStudioModules.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const { getMongoUris } = require('../lib/mongoConnect');

const ARTICLES_MODULE = {
  moduleKey: 'articles',
  appKey: 'helpdesk',
  label: 'Articles',
  pluralLabel: 'Articles',
  entityType: 'CORE',
  primaryField: 'title',
  peopleConstraints: { allowedTypes: ['Contact'], required: false },
  organizationConstraints: { required: false },
  lifecycle: {
    statusField: 'status',
    allowedStatuses: ['draft', 'review', 'scheduled', 'published', 'archived'],
  },
  supports: {
    ownership: true,
    assignment: false,
    comments: true,
    attachments: false,
    automation: false,
  },
  permissions: { create: true, edit: true, delete: true, view: true },
  ui: {
    routeBase: '/helpdesk/articles',
    icon: 'book-open',
    showInSidebar: true,
    sidebarOrder: 2,
    createLabel: 'New Article',
    listLabel: 'Articles',
  },
};

const BLOG_MODULE = {
  moduleKey: 'blog',
  appKey: 'marketing',
  label: 'Blog',
  pluralLabel: 'Blog Posts',
  entityType: 'CORE',
  primaryField: 'title',
  peopleConstraints: { allowedTypes: ['Contact'], required: false },
  organizationConstraints: { required: false },
  lifecycle: {
    statusField: 'status',
    allowedStatuses: ['draft', 'review', 'scheduled', 'published', 'archived'],
  },
  supports: {
    ownership: true,
    assignment: false,
    comments: true,
    attachments: false,
    automation: false,
  },
  permissions: { create: true, edit: true, delete: true, view: true },
  ui: {
    routeBase: '/marketing/blog',
    icon: 'document-text',
    showInSidebar: true,
    sidebarOrder: 2,
    createLabel: 'New Post',
    listLabel: 'Blog',
  },
};

async function upsertModule(doc) {
  const query = {
    appKey: doc.appKey,
    moduleKey: doc.moduleKey,
    organizationId: null,
  };
  const existing = await ModuleDefinition.findOne(query);
  if (existing) {
    Object.assign(existing, doc);
    await existing.save();
    return 'updated';
  }
  await ModuleDefinition.create(doc);
  return 'created';
}

async function ensureContentStudioModulesSeeded(options = {}) {
  const { useExistingConnection = false } = options;

  if (!useExistingConnection) {
    const { masterUri, masterDbName } = getMongoUris();
    await mongoose.connect(masterUri);
    console.log(`Connected to MongoDB (${masterDbName})`);
  }

  const articlesResult = await upsertModule(ARTICLES_MODULE);
  const blogResult = await upsertModule(BLOG_MODULE);

  const { ensureAddonCatalogSeeded } = require('./seedAddonDefinitions');
  const addonResult = await ensureAddonCatalogSeeded({ useExistingConnection: true });

  if (!useExistingConnection) {
    await mongoose.disconnect();
  }

  return { articlesResult, blogResult, addonResult };
}

async function main() {
  const result = await ensureContentStudioModulesSeeded();
  console.log(`helpdesk.articles module: ${result.articlesResult}`);
  console.log(`marketing.blog module: ${result.blogResult}`);
  console.log(`addons articles: ${result.addonResult.defResultArticles}`);
  console.log(`addons blog: ${result.addonResult.defResultBlog}`);
  console.log('Done.');
}

module.exports = { ensureContentStudioModulesSeeded, ARTICLES_MODULE, BLOG_MODULE };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
