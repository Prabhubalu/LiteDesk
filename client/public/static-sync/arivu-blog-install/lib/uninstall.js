'use strict';

const fs = require('fs');
const path = require('path');
const { detectNextProject } = require('./detect');
const { resolveLibDir } = require('./detectSiteChrome');

const BLOG_ENV_KEYS = [
  'ARIVU_BLOG_ORG',
  'BLOG_URL_PREFIX',
  'ARIVU_BLOG_WEBHOOK_SECRET',
];

const SHARED_ENV_KEYS = [
  'ARIVU_ORG',
  'ARIVU_API_ORIGIN',
  'ARIVU_SYNC_MODE',
  'ARIVU_SYNC_DEST',
  'SITE_ORIGIN',
  'VERCEL_DEPLOY_HOOK_URL',
  'ARIVU_MIRROR_ASSETS',
  'ARIVU_SYNC_WRITE_LOCAL',
  'ARIVU_SYNC_FULL',
];

function exists(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath);
}

function removePath(targetPath, removed) {
  if (!exists(targetPath)) return false;
  const stat = fs.lstatSync(targetPath);
  if (stat.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }
  removed.push(targetPath);
  return true;
}

function removeEmptyDirsUp(startDir, stopDir, removed, options = {}) {
  const protectedDirs = new Set(
    (options.protectedDirs || []).map((dir) => path.resolve(dir)),
  );
  let current = startDir;
  const stop = path.resolve(stopDir);
  while (current && path.resolve(current) !== stop) {
    const resolved = path.resolve(current);
    if (protectedDirs.has(resolved)) break;
    if (!exists(current)) break;
    const entries = fs.readdirSync(current);
    if (entries.length > 0) break;
    fs.rmdirSync(current);
    removed.push(`${current}/ (empty)`);
    current = path.dirname(current);
  }
}

function parseEnvEntries(content) {
  const order = [];
  const values = new Map();
  const otherLines = [];
  for (const rawLine of String(content || '').split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (line.trimStart().startsWith('#')) {
      otherLines.push(line);
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      otherLines.push(line);
      continue;
    }
    if (!values.has(match[1])) order.push(match[1]);
    values.set(match[1], match[2]);
  }
  return { order, values, otherLines };
}

function removeEnvKeysFromFile(filePath, keysToRemove, removed) {
  if (!exists(filePath)) return false;
  const { order, values, otherLines } = parseEnvEntries(fs.readFileSync(filePath, 'utf8'));
  let changed = false;
  for (const key of keysToRemove) {
    if (!values.has(key)) continue;
    values.delete(key);
    changed = true;
  }
  if (!changed) return false;

  const remaining = order.filter((key) => values.has(key));
  const body = [
    ...otherLines,
    ...remaining.map((key) => `${key}=${values.get(key)}`),
  ].join('\n');

  if (!body.trim()) {
    fs.unlinkSync(filePath);
    removed.push(filePath);
  } else {
    fs.writeFileSync(filePath, `${body}\n`);
    removed.push(`${filePath} (env keys)`);
  }
  return true;
}

function helpInstallPresent(targetDir, project) {
  const appDir = project.appDir || 'app';
  const libDir = resolveLibDir(targetDir, project);
  return (
    exists(path.join(targetDir, libDir, 'arivu-help.ts'))
    || exists(path.join(targetDir, 'scripts', 'sync-help-static.mjs'))
    || exists(path.join(targetDir, appDir, 'help', 'ArivuHelpEmbed.tsx'))
    || exists(path.join(targetDir, appDir, 'api', 'arivu-webhook', 'route.ts'))
  );
}

function detectBlogInstall(targetDir) {
  const project = detectNextProject(targetDir);
  const appDir = project.appDir || 'app';
  const libDir = resolveLibDir(targetDir, project);
  const markers = {
    blogRoutes: path.join(targetDir, appDir, 'blog'),
    lib: path.join(targetDir, libDir, 'arivu-blog.ts'),
    syncScript: path.join(targetDir, 'scripts', 'sync-blog-static.mjs'),
    helpSync: path.join(targetDir, 'help-sync'),
    webhook: path.join(targetDir, appDir, 'api', 'arivu-webhook', 'blog'),
    configMjs: path.join(targetDir, 'arivu-blog.config.mjs'),
    configCjs: path.join(targetDir, 'arivu-blog.config.cjs'),
    staticOut: path.join(targetDir, 'public', 'blog'),
    packageJson: project.packageJsonPath,
    nextConfig: project.configFile ? path.join(targetDir, project.configFile) : null,
  };

  const found = Object.entries(markers)
    .filter(([key, value]) => key !== 'packageJson' && key !== 'nextConfig' && exists(value))
    .map(([key]) => key);

  const pkgHasSync = exists(markers.packageJson)
    && /"sync:blog"/.test(fs.readFileSync(markers.packageJson, 'utf8'));
  if (pkgHasSync) found.push('packageJson');

  return {
    project,
    appDir,
    libDir,
    markers,
    found,
    installed: found.length > 0,
    helpAlsoInstalled: helpInstallPresent(targetDir, project),
  };
}

function unpatchPackageJson(packageJsonPath, removed) {
  if (!exists(packageJsonPath)) return false;
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  let changed = false;

  if (pkg.scripts['sync:blog']) {
    delete pkg.scripts['sync:blog'];
    changed = true;
  }

  const prebuild = String(pkg.scripts.prebuild || '').trim();
  if (prebuild) {
    const parts = prebuild
      .split(/\s*&&\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => part !== 'npm run sync:blog');
    if (parts.length === 0) {
      delete pkg.scripts.prebuild;
      changed = true;
    } else if (parts.join(' && ') !== prebuild) {
      pkg.scripts.prebuild = parts.join(' && ');
      changed = true;
    }
  }

  if (!changed) return false;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  removed.push(`${packageJsonPath} (scripts)`);
  return true;
}

function unpatchNextConfig(configPath, removed) {
  if (!exists(configPath)) return false;
  let content = fs.readFileSync(configPath, 'utf8');
  if (!content.includes('withArivuBlog')) return false;

  const defaultCreated = content.trim() === `import { withArivuBlog } from './arivu-blog.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = withArivuBlog({});

export default nextConfig;`.trim();

  if (defaultCreated) {
    fs.unlinkSync(configPath);
    removed.push(configPath);
    return true;
  }

  const before = content;
  content = content.replace(/import\s+\{\s*withArivuBlog\s*\}\s+from\s+['"]\.\/arivu-blog\.config\.mjs['"];?\r?\n/, '');
  content = content.replace(/const\s+\{\s*withArivuBlog\s*\}\s*=\s*require\(['"]\.\/arivu-blog\.config\.cjs['"]\);?\r?\n/, '');
  content = content.replace(/export\s+default\s+withArivuBlog\(([A-Za-z_$][\w$]*)\);/, 'export default $1;');
  content = content.replace(/module\.exports\s*=\s*withArivuBlog\(([A-Za-z_$][\w$]*)\);/, 'module.exports = $1;');
  content = content.replace(/export\s+default\s+withArivuBlog\(/, 'export default (');
  content = content.replace(/module\.exports\s*=\s*withArivuBlog\(/, 'module.exports = (');

  if (content === before) return false;
  fs.writeFileSync(configPath, content);
  removed.push(`${configPath} (unpatched)`);
  return true;
}

function uninstallFromProject(targetDir, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const keepEnv = Boolean(options.keepEnv);
  const keepStatic = Boolean(options.keepStatic);
  const detection = detectBlogInstall(targetDir);
  const removed = [];
  const skipped = [];

  if (!detection.installed) {
    return {
      targetDir,
      installed: false,
      removed,
      skipped,
      message: 'No Arivu blog install detected in this project.',
    };
  }

  const { markers, helpAlsoInstalled, appDir } = detection;
  const plan = [];

  const queueRemove = (filePath) => {
    if (!exists(filePath)) return;
    plan.push(filePath);
  };

  queueRemove(markers.blogRoutes);
  queueRemove(markers.lib);
  queueRemove(markers.syncScript);
  queueRemove(markers.webhook);
  queueRemove(markers.configMjs);
  queueRemove(markers.configCjs);
  if (!keepStatic) queueRemove(markers.staticOut);

  if (exists(markers.helpSync)) {
    if (helpAlsoInstalled) {
      skipped.push(`${markers.helpSync} (kept — help install still present)`);
    } else {
      queueRemove(markers.helpSync);
    }
  }

  if (dryRun) {
    return {
      targetDir,
      installed: true,
      dryRun: true,
      plan,
      skipped,
      helpAlsoInstalled,
      message: `Dry run: would remove ${plan.length} path(s).`,
    };
  }

  for (const filePath of plan) {
    removePath(filePath, removed);
  }

  const webhookRoot = path.join(targetDir, appDir, 'api', 'arivu-webhook');
  if (exists(webhookRoot)) {
    const entries = fs.readdirSync(webhookRoot);
    if (entries.length === 0) {
      removePath(webhookRoot, removed);
    }
  }

  removeEmptyDirsUp(path.join(targetDir, 'scripts'), targetDir, removed);
  removeEmptyDirsUp(path.join(targetDir, appDir, 'api'), targetDir, removed, {
    protectedDirs: [
      path.join(targetDir, appDir),
      path.join(targetDir, 'src'),
      path.join(targetDir, 'lib'),
      path.join(targetDir, 'public'),
    ],
  });

  unpatchPackageJson(markers.packageJson, removed);
  unpatchNextConfig(markers.nextConfig, removed);

  if (!keepEnv) {
    const envKeys = [...BLOG_ENV_KEYS];
    if (!helpAlsoInstalled) {
      envKeys.push(...SHARED_ENV_KEYS);
    } else {
      skipped.push('Shared env keys kept (help install still present)');
    }
    removeEnvKeysFromFile(path.join(targetDir, '.env.local'), envKeys, removed);
    removeEnvKeysFromFile(path.join(targetDir, '.env.example'), envKeys, removed);
  } else {
    skipped.push('Env files kept (--keep-env)');
  }

  return {
    targetDir,
    installed: true,
    dryRun: false,
    removed,
    skipped,
    helpAlsoInstalled,
    message: `Removed ${removed.length} blog install artifact(s).`,
  };
}

function printUninstallResult(result) {
  process.stdout.write(`\n${result.message}\n`);
  if (result.dryRun && Array.isArray(result.plan)) {
    process.stdout.write('\nWould remove:\n');
    result.plan.forEach((item) => process.stdout.write(`  - ${item}\n`));
  }
  if (result.removed?.length) {
    process.stdout.write('\nRemoved:\n');
    result.removed.forEach((item) => process.stdout.write(`  - ${item}\n`));
  }
  if (result.skipped?.length) {
    process.stdout.write('\nSkipped:\n');
    result.skipped.forEach((item) => process.stdout.write(`  - ${item}\n`));
  }
  process.stdout.write('\n');
}

module.exports = {
  detectBlogInstall,
  uninstallFromProject,
  printUninstallResult,
};
