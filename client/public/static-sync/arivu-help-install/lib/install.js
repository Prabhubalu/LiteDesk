'use strict';

const fs = require('fs');
const path = require('path');
const { detectNextProject } = require('./detect');
const { detectSiteChrome, resolveLibDir } = require('./detectSiteChrome');
const { copyTemplates } = require('./copyTemplates');
const {
  patchPackageJson,
  patchNextConfig,
  createDefaultNextConfig,
  writeEnvFile,
  writeArivuHelpConfig,
} = require('./mergeConfig');
const { buildArivuHelpConfigCjs } = require('./mergeConfigCjs');
const { syncFullWithState } = require('../help-sync/lib/syncIncremental');

function resolvePackageRoot() {
  return path.resolve(__dirname, '..');
}

function scaffoldStandalone(targetDir, options) {
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const templatesRoot = path.join(packageRoot, 'templates', 'standalone');

  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of ['package.json', 'tsconfig.json', 'next.config.mjs', 'README.txt']) {
    copyIfExists(path.join(templatesRoot, entry), path.join(targetDir, entry));
  }

  for (const entry of ['layout.tsx', 'page.tsx']) {
    copyIfExists(
      path.join(templatesRoot, 'app', entry),
      path.join(targetDir, 'app', entry),
    );
  }

  return installIntoProject(targetDir, {
    ...options,
    packageRoot,
    allowMissingAppDir: true,
  });
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function installIntoProject(targetDir, options) {
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const integrationMode = options.integrationMode || 'layout';
  const project = detectNextProject(targetDir);

  if (!project.isNext && !options.allowMissingAppDir) {
    throw new Error(project.reason || 'Not a Next.js project');
  }

  const appDir = project.appDir || 'app';
  if (!project.appDir && !options.allowMissingAppDir) {
    throw new Error('App Router not found. Create an app/ or src/app/ directory first.');
  }

  const libDir = resolveLibDir(targetDir, project);
  const siteChrome = detectSiteChrome(targetDir, project);

  const copied = copyTemplates(packageRoot, targetDir, {
    appDir,
    libDir,
    integrationMode,
  });

  if (integrationMode === 'standalone-html') {
    writeArivuHelpConfig(targetDir, options.pathPrefix);
    fs.writeFileSync(
      path.join(targetDir, 'arivu-help.config.cjs'),
      buildArivuHelpConfigCjs(options.pathPrefix),
    );
  }

  const scripts = project.packageJsonPath
    ? patchPackageJson(project.packageJsonPath, { integrationMode })
    : null;

  let configResult = { patched: false, skipped: true };
  if (integrationMode === 'standalone-html') {
    if (project.configFile) {
      configResult = patchNextConfig(path.join(targetDir, project.configFile));
    } else {
      const created = createDefaultNextConfig(targetDir, options.pathPrefix);
      configResult = { created: created.created, patched: created.created, skipped: !created.created };
    }
  }

  const envValues = { ...options, integrationMode };
  const envFile = writeEnvFile(targetDir, envValues, '.env.local');
  writeEnvFile(targetDir, envValues, '.env.example');

  return {
    targetDir,
    appDir,
    libDir,
    integrationMode,
    copied,
    scripts,
    configResult,
    envFile,
    siteChrome,
    webhookPath: '/api/arivu-webhook',
  };
}

async function runPostInstallFullRegenerate(result, options) {
  if (options.integrationMode === 'standalone-html') {
    await syncFullWithState({
      apiOrigin: options.apiOrigin,
      org: options.org,
      dest: path.resolve(result.targetDir, options.dest || './public'),
      pathPrefix: options.pathPrefix,
      siteOrigin: options.siteOrigin,
      mirrorAssets: true,
      statePath: path.join(result.targetDir, '.arivu/sync-state.json'),
    });
    process.stdout.write('\nRegenerated all help HTML files (full sync).\n');
    return;
  }

  const deployHook = String(options.deployHook || process.env.VERCEL_DEPLOY_HOOK_URL || '').trim();
  if (!deployHook) {
    process.stdout.write('\nDeploy once to regenerate all help pages with the latest template.\n');
    return;
  }

  const response = await fetch(deployHook, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Deploy hook request failed (${response.status})`);
  }
  process.stdout.write('\nTriggered Vercel deploy to regenerate all help pages.\n');
}

function printSuccess(result, options) {
  const siteOrigin = options.siteOrigin || 'https://www.example.com';
  process.stdout.write('\nArivu help center installed.\n\n');

  if (result.integrationMode === 'layout') {
    process.stdout.write('Mode: site layout (help pages inherit your nav and footer)\n\n');
    process.stdout.write('How it works:\n');
    process.stdout.write('  - /help routes render inside your existing app/layout.tsx\n');
    process.stdout.write('  - Your header, footer, and site chrome stay visible\n');
    process.stdout.write('  - SEO metadata is generated at build time from Arivu\n\n');
  } else {
    process.stdout.write('Mode: standalone HTML files in public/help/\n\n');
  }

  process.stdout.write('Files added:\n');
  if (result.copied.helpRoutes) {
    process.stdout.write(`  - ${result.copied.helpRoutes}/\n`);
    process.stdout.write(`  - ${result.copied.lib}\n`);
  }
  if (result.copied.scripts) {
    process.stdout.write(`  - ${result.copied.scripts}\n`);
    process.stdout.write(`  - ${result.copied.helpSync}/\n`);
  }
  if (result.copied.webhook) {
    process.stdout.write(`  - ${result.copied.webhook}\n`);
  }
  process.stdout.write(`  - ${result.envFile}\n`);

  if (result.siteChrome?.hasRootLayout) {
    process.stdout.write(`\nSite layout detected: ${result.siteChrome.layoutPath}\n`);
    if (result.siteChrome.chromeUsedInLayout.length) {
      process.stdout.write('Chrome components found in layout:\n');
      result.siteChrome.chromeUsedInLayout.forEach((item) => {
        process.stdout.write(`  - ${item}\n`);
      });
    } else if (result.siteChrome.chromeComponents.length) {
      process.stdout.write('Tip: ensure your header/footer are rendered in app/layout.tsx\n');
    }
  } else {
    process.stdout.write('\nTip: add your site nav and footer to app/layout.tsx — help pages inherit it automatically\n');
  }

  process.stdout.write('\nVercel checklist:\n');
  process.stdout.write('  1. Copy env vars from .env.local into Vercel → Settings → Environment Variables\n');
  process.stdout.write('  2. Create a Deploy Hook → set VERCEL_DEPLOY_HOOK_URL\n');
  process.stdout.write(`  3. In Arivu Articles settings, set publish webhook to ${siteOrigin}/api/arivu-webhook\n`);
  if (result.integrationMode === 'layout') {
    process.stdout.write('  4. Deploy — Next.js builds /help inside your site layout\n\n');
  } else {
    process.stdout.write('  4. Deploy — prebuild syncs changed help pages only; use npm run sync:help:full to regenerate all\n\n');
  }
}

module.exports = {
  installIntoProject,
  scaffoldStandalone,
  printSuccess,
  resolvePackageRoot,
  runPostInstallFullRegenerate,
};
