'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createCopyStats() {
  return { written: [], skipped: [] };
}

function copyFile(src, dest, options = {}) {
  const force = Boolean(options.force);
  const stats = options.stats || createCopyStats();
  ensureDir(dest);
  if (!force && fs.existsSync(dest)) {
    stats.skipped.push(dest);
    return false;
  }
  fs.copyFileSync(src, dest);
  stats.written.push(dest);
  return true;
}

function copyDirectory(srcDir, destDir, options = {}) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, options);
    } else {
      copyFile(srcPath, destPath, options);
    }
  }
}

function uiForce(options) {
  return Boolean(options.force);
}

function kitForce(options) {
  return Boolean(options.force || options.updateKit);
}

function copyLayoutIntegratedTemplates(packageRoot, targetRoot, options) {
  const templatesRoot = path.join(packageRoot, 'templates', 'next');
  const appBase = options.appDir || 'app';
  const libDir = options.libDir || 'lib';
  const stats = options.stats || createCopyStats();

  copyDirectory(
    path.join(templatesRoot, 'app', 'blog'),
    path.join(targetRoot, appBase, 'blog'),
    { force: uiForce(options), stats },
  );

  copyFile(
    path.join(templatesRoot, 'lib', 'arivu-blog.ts'),
    path.join(targetRoot, libDir, 'arivu-blog.ts'),
    { force: kitForce(options), stats },
  );

  return {
    blogRoutes: path.join(targetRoot, appBase, 'blog'),
    lib: path.join(targetRoot, libDir, 'arivu-blog.ts'),
    stats,
  };
}

function copyStandaloneHtmlTemplates(packageRoot, targetRoot, options) {
  const templatesRoot = path.join(packageRoot, 'templates');
  const helpSyncRoot = path.join(packageRoot, 'help-sync');
  const stats = options.stats || createCopyStats();
  const forceKit = kitForce(options);

  copyFile(
    path.join(templatesRoot, 'scripts', 'sync-blog-static.mjs'),
    path.join(targetRoot, 'scripts', 'sync-blog-static.mjs'),
    { force: forceKit, stats },
  );

  copyDirectory(helpSyncRoot, path.join(targetRoot, 'help-sync'), { force: forceKit, stats });

  const webhookSrc = path.join(templatesRoot, 'app', 'api', 'arivu-webhook', 'blog', 'route.ts');
  const appBase = options.appDir || 'app';
  const webhookDest = path.join(targetRoot, appBase, 'api', 'arivu-webhook', 'blog', 'route.ts');
  copyFile(webhookSrc, webhookDest, { force: forceKit, stats });

  return {
    scripts: path.join(targetRoot, 'scripts', 'sync-blog-static.mjs'),
    helpSync: path.join(targetRoot, 'help-sync'),
    webhook: webhookDest,
    stats,
  };
}

function copyHybridSyncAssets(packageRoot, targetRoot, options = {}) {
  const templatesRoot = path.join(packageRoot, 'templates');
  const helpSyncRoot = path.join(packageRoot, 'help-sync');
  const stats = options.stats || createCopyStats();
  const forceKit = kitForce(options);

  copyFile(
    path.join(templatesRoot, 'scripts', 'sync-blog-static.mjs'),
    path.join(targetRoot, 'scripts', 'sync-blog-static.mjs'),
    { force: forceKit, stats },
  );

  const helpSyncDest = path.join(targetRoot, 'help-sync');
  if (forceKit || !fs.existsSync(helpSyncDest)) {
    copyDirectory(helpSyncRoot, helpSyncDest, { force: forceKit, stats });
  } else {
    stats.skipped.push(helpSyncDest);
  }

  return {
    scripts: path.join(targetRoot, 'scripts', 'sync-blog-static.mjs'),
    helpSync: helpSyncDest,
    stats,
  };
}

function copyTemplates(packageRoot, targetRoot, options) {
  const mode = options.integrationMode || 'hybrid';
  const stats = createCopyStats();
  const nextOptions = { ...options, stats };

  if (mode === 'layout' || mode === 'hybrid') {
    const layoutFiles = copyLayoutIntegratedTemplates(packageRoot, targetRoot, nextOptions);
    const webhookSrc = path.join(packageRoot, 'templates', 'app', 'api', 'arivu-webhook', 'blog', 'route.ts');
    const appBase = options.appDir || 'app';
    const webhookDest = path.join(targetRoot, appBase, 'api', 'arivu-webhook', 'blog', 'route.ts');
    copyFile(webhookSrc, webhookDest, { force: kitForce(options), stats });
    const syncAssets = mode === 'hybrid' ? copyHybridSyncAssets(packageRoot, targetRoot, nextOptions) : {};
    return {
      ...layoutFiles,
      ...syncAssets,
      webhook: webhookDest,
      stats,
    };
  }

  return copyStandaloneHtmlTemplates(packageRoot, targetRoot, nextOptions);
}

module.exports = {
  copyTemplates,
  createCopyStats,
};
