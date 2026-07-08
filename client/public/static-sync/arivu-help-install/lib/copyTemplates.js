'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(dest);
  fs.copyFileSync(src, dest);
}

function copyDirectory(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function copyLayoutIntegratedTemplates(packageRoot, targetRoot, options) {
  const templatesRoot = path.join(packageRoot, 'templates', 'next');
  const appBase = options.appDir || 'app';
  const libDir = options.libDir || 'lib';

  copyDirectory(
    path.join(templatesRoot, 'app', 'help'),
    path.join(targetRoot, appBase, 'help'),
  );

  copyFile(
    path.join(templatesRoot, 'lib', 'arivu-help.ts'),
    path.join(targetRoot, libDir, 'arivu-help.ts'),
  );

  return {
    helpRoutes: path.join(targetRoot, appBase, 'help'),
    lib: path.join(targetRoot, libDir, 'arivu-help.ts'),
  };
}

function copyStandaloneHtmlTemplates(packageRoot, targetRoot, options) {
  const templatesRoot = path.join(packageRoot, 'templates');
  const helpSyncRoot = path.join(packageRoot, 'help-sync');

  copyFile(
    path.join(templatesRoot, 'scripts', 'sync-help-static.mjs'),
    path.join(targetRoot, 'scripts', 'sync-help-static.mjs'),
  );

  copyDirectory(helpSyncRoot, path.join(targetRoot, 'help-sync'));

  const webhookSrc = path.join(templatesRoot, 'app', 'api', 'arivu-webhook', 'route.ts');
  const appBase = options.appDir || 'app';
  const webhookDest = path.join(targetRoot, appBase, 'api', 'arivu-webhook', 'route.ts');
  copyFile(webhookSrc, webhookDest);

  return {
    scripts: path.join(targetRoot, 'scripts', 'sync-help-static.mjs'),
    helpSync: path.join(targetRoot, 'help-sync'),
    webhook: webhookDest,
  };
}

function copyTemplates(packageRoot, targetRoot, options) {
  const mode = options.integrationMode || 'layout';
  if (mode === 'layout') {
    const layoutFiles = copyLayoutIntegratedTemplates(packageRoot, targetRoot, options);
    const webhookSrc = path.join(packageRoot, 'templates', 'app', 'api', 'arivu-webhook', 'route.ts');
    const appBase = options.appDir || 'app';
    const webhookDest = path.join(targetRoot, appBase, 'api', 'arivu-webhook', 'route.ts');
    copyFile(webhookSrc, webhookDest);
    return {
      ...layoutFiles,
      webhook: webhookDest,
    };
  }

  return copyStandaloneHtmlTemplates(packageRoot, targetRoot, options);
}

function removeConflictingHelpRoutes(targetRoot, appDir) {
  if (!appDir) return [];
  const helpDir = path.join(targetRoot, appDir, 'help');
  if (!fs.existsSync(helpDir)) return [];

  fs.rmSync(helpDir, { recursive: true, force: true });
  return [helpDir];
}

module.exports = {
  copyTemplates,
  removeConflictingHelpRoutes,
};
