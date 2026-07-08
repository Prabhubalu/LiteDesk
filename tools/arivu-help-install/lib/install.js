'use strict';

const fs = require('fs');
const path = require('path');
const { detectNextProject } = require('./detect');
const { detectSiteChrome, resolveLibDir } = require('./detectSiteChrome');
const { buildHelpLayoutContent } = require('./buildHelpLayout');
const { copyTemplates } = require('./copyTemplates');
const {
  patchPackageJson,
  patchNextConfig,
  createDefaultNextConfig,
  writeEnvFile,
  writeArivuHelpConfig,
} = require('./mergeConfig');
const { buildArivuHelpConfigCjs } = require('./mergeConfigCjs');

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

  let helpLayoutPatched = false;
  if (integrationMode === 'layout' && siteChrome.needsHelpLayoutChrome) {
    const helpLayoutContent = buildHelpLayoutContent({
      chromeComponents: siteChrome.referenceChromeComponents,
    });
    if (helpLayoutContent) {
      const helpLayoutPath = path.join(targetDir, appDir, 'help', 'layout.tsx');
      fs.writeFileSync(helpLayoutPath, helpLayoutContent);
      helpLayoutPatched = true;
    }
  }

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
    helpLayoutPatched,
    webhookPath: '/api/arivu-webhook',
  };
}

function printSuccess(result, options) {
  const siteOrigin = options.siteOrigin || 'https://www.example.com';
  process.stdout.write('\nArivu help center installed.\n\n');

  if (result.integrationMode === 'layout') {
    process.stdout.write('Mode: site layout (help pages use your site nav and footer)\n\n');
    process.stdout.write('How it works:\n');
    process.stdout.write('  - /help routes are Next.js App Router pages that fetch content from Arivu\n');
    process.stdout.write('  - ARIVU_SYNC_MODE=layout skips public/help/ static HTML (that output is not rendered)\n');
    process.stdout.write('  - Site chrome is applied in app/help/layout.tsx\n');
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

  if (result.helpLayoutPatched) {
    if (result.siteChrome.referenceLayoutPath) {
      process.stdout.write(`\nHelp layout wrapped with site chrome from ${result.siteChrome.referenceLayoutPath}:\n`);
    } else {
      process.stdout.write('\nHelp layout wrapped with detected site chrome components:\n');
    }
    result.siteChrome.referenceChromeComponents.forEach((component) => {
      process.stdout.write(`  - ${component.name}\n`);
    });
  } else if (result.siteChrome?.preservesSiteChrome) {
    process.stdout.write(`\nSite chrome detected in ${result.siteChrome.layoutPath} — help pages inherit it automatically\n`);
    result.siteChrome.chromeUsedInLayout.forEach((item) => {
      process.stdout.write(`  - ${item}\n`);
    });
  } else if (result.siteChrome?.hasRootLayout) {
    process.stdout.write(`\nSite layout detected: ${result.siteChrome.layoutPath}\n`);
    if (result.siteChrome.referenceLayoutPath) {
      process.stdout.write(`Tip: copy nav/footer from ${result.siteChrome.referenceLayoutPath} into app/help/layout.tsx\n`);
    } else if (result.siteChrome.chromeComponents.length) {
      process.stdout.write('Tip: wrap app/help/layout.tsx with your SiteNav and SiteFooter components\n');
    } else {
      process.stdout.write('Tip: add your site nav and footer to app/help/layout.tsx\n');
    }
  } else {
    process.stdout.write('\nTip: add your site nav and footer to app/help/layout.tsx\n');
  }

  process.stdout.write('\nVercel checklist:\n');
  process.stdout.write('  1. Copy env vars from .env.local into Vercel → Settings → Environment Variables\n');
  process.stdout.write('  2. Create a Deploy Hook → set VERCEL_DEPLOY_HOOK_URL\n');
  process.stdout.write(`  3. In Arivu Articles settings, set publish webhook to ${siteOrigin}/api/arivu-webhook\n`);
  if (result.integrationMode === 'layout') {
    process.stdout.write('  4. Deploy — Next.js builds /help inside your site layout\n\n');
  } else {
    process.stdout.write('  4. Deploy — prebuild syncs SEO-ready HTML into public/help/\n\n');
  }
}

module.exports = {
  installIntoProject,
  scaffoldStandalone,
  printSuccess,
  resolvePackageRoot,
};
