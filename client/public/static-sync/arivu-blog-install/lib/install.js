'use strict';

const fs = require('fs');
const path = require('path');
const { detectNextProject } = require('./detect');
const { detectSiteChrome, resolveLibDir } = require('./detectSiteChrome');
const { buildBlogLayoutContent } = require('./buildBlogLayout');
const { copyTemplates } = require('./copyTemplates');
const {
  patchPackageJson,
  patchNextConfig,
  createDefaultNextConfig,
  writeEnvFile,
  writeArivuBlogConfig,
  buildArivuBlogConfigCjs,
} = require('./mergeConfig');

function resolvePackageRoot() {
  return path.resolve(__dirname, '..');
}

function copyIfExists(src, dest, options = {}) {
  if (!fs.existsSync(src)) return;
  if (!options.force && fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function scaffoldStandalone(targetDir, options) {
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const templatesRoot = path.join(packageRoot, 'templates', 'standalone');

  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of ['package.json', 'tsconfig.json', 'next.config.mjs', 'README.txt']) {
    copyIfExists(path.join(templatesRoot, entry), path.join(targetDir, entry), options);
  }

  for (const entry of ['layout.tsx', 'page.tsx']) {
    copyIfExists(
      path.join(templatesRoot, 'app', entry),
      path.join(targetDir, 'app', entry),
      options,
    );
  }

  return installIntoProject(targetDir, {
    ...options,
    packageRoot,
    allowMissingAppDir: true,
  });
}

function installIntoProject(targetDir, options) {
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const integrationMode = options.integrationMode || 'hybrid';
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
    force: Boolean(options.force),
    updateKit: Boolean(options.updateKit),
  });

  let blogLayoutPatched = false;
  if ((integrationMode === 'layout' || integrationMode === 'hybrid') && siteChrome.needsBlogLayoutChrome) {
    const blogLayoutPath = path.join(targetDir, appDir, 'blog', 'layout.tsx');
    if (options.force || !fs.existsSync(blogLayoutPath)) {
      const blogLayoutContent = buildBlogLayoutContent({
        chromeComponents: siteChrome.referenceChromeComponents,
      });
      if (blogLayoutContent) {
        fs.writeFileSync(blogLayoutPath, blogLayoutContent);
        blogLayoutPatched = true;
      }
    }
  }

  if (integrationMode === 'standalone-html') {
    const configMjs = path.join(targetDir, 'arivu-blog.config.mjs');
    const configCjs = path.join(targetDir, 'arivu-blog.config.cjs');
    if (options.force || !fs.existsSync(configMjs)) {
      writeArivuBlogConfig(targetDir, options.pathPrefix);
    }
    if (options.force || !fs.existsSync(configCjs)) {
      fs.writeFileSync(configCjs, buildArivuBlogConfigCjs(options.pathPrefix));
    }
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
    blogLayoutPatched,
    webhookPath: '/api/arivu-webhook/blog',
  };
}

function printSuccess(result, options) {
  const siteOrigin = options.siteOrigin || 'https://www.example.com';
  process.stdout.write('\nArivu blog installed.\n\n');

  if (result.integrationMode === 'layout' || result.integrationMode === 'hybrid') {
    const modeLabel = result.integrationMode === 'hybrid'
      ? 'hybrid (live embed + silent static HTML)'
      : 'site layout (/blog pages use your site nav and footer)';
    process.stdout.write(`Mode: ${modeLabel}\n\n`);
    process.stdout.write('How it works:\n');
    process.stdout.write('  - /blog routes are Next.js App Router pages that fetch content from Arivu\n');
    process.stdout.write('  - ARIVU_SYNC_MODE=hybrid writes public/blog/ static HTML while /blog stays live embed+layout\n');
    process.stdout.write('  - ARIVU_SYNC_MODE=layout skips static HTML write\n');
    process.stdout.write('  - On Vercel hybrid: set VERCEL_DEPLOY_HOOK_URL so publish rebuilds static files\n');
    process.stdout.write('  - Local hybrid: webhook writes files when not on Vercel (or ARIVU_SYNC_WRITE_LOCAL=1)\n');
    process.stdout.write('  - Site chrome is applied in app/blog/layout.tsx\n');
    process.stdout.write('  - SEO metadata is generated at build time from Arivu\n\n');
  } else {
    process.stdout.write('Mode: standalone HTML files in public/blog/\n\n');
  }

  process.stdout.write('Files added:\n');
  if (result.copied.blogRoutes) {
    process.stdout.write(`  - ${result.copied.blogRoutes}/\n`);
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

  const skipped = result.copied.stats?.skipped || [];
  const written = result.copied.stats?.written || [];
  if (options.updateKit && !options.force) {
    process.stdout.write(`\nUpdate-kit: refreshed ${written.length} tooling file(s); left UI/CSS routes alone.\n`);
  }
  if (skipped.length) {
    process.stdout.write(`\nSkipped ${skipped.length} existing file(s) (customizations kept). Use --update-kit (tooling) or --force (everything).\n`);
  }

  if (result.blogLayoutPatched) {
    if (result.siteChrome.referenceLayoutPath) {
      process.stdout.write(`\nBlog layout wrapped with site chrome from ${result.siteChrome.referenceLayoutPath}:\n`);
    } else {
      process.stdout.write('\nBlog layout wrapped with detected site chrome components:\n');
    }
    result.siteChrome.referenceChromeComponents.forEach((component) => {
      process.stdout.write(`  - ${component.name}\n`);
    });
  } else if (result.siteChrome?.preservesSiteChrome) {
    process.stdout.write(`\nSite chrome detected in ${result.siteChrome.layoutPath} — blog pages inherit it automatically\n`);
  } else if (result.siteChrome?.hasRootLayout) {
    process.stdout.write(`\nSite layout detected: ${result.siteChrome.layoutPath}\n`);
    process.stdout.write('Tip: wrap app/blog/layout.tsx with your SiteNav and SiteFooter components\n');
  }

  process.stdout.write('\nVercel checklist:\n');
  process.stdout.write('  1. Copy env vars from .env.local into Vercel → Settings → Environment Variables\n');
  process.stdout.write('  2. Set ARIVU_BLOG_WEBHOOK_SECRET (and VERCEL_DEPLOY_HOOK_URL for publish rebuilds)\n');
  process.stdout.write(`  3. In Arivu Blog settings, set publish webhook to ${siteOrigin}/api/arivu-webhook/blog\n`);
  if (result.integrationMode === 'layout') {
    process.stdout.write('  4. Deploy — Next.js builds /blog inside your site layout\n\n');
  } else if (result.integrationMode === 'hybrid') {
    process.stdout.write('  4. Deploy — live /blog + prebuild writes public/blog/ static HTML\n\n');
  } else {
    process.stdout.write('  4. Deploy — prebuild syncs SEO-ready HTML into public/blog/\n\n');
  }
}

module.exports = {
  installIntoProject,
  scaffoldStandalone,
  printSuccess,
  resolvePackageRoot,
};
