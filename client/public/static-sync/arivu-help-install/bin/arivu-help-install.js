#!/usr/bin/env node
'use strict';

const path = require('path');
const { installIntoProject, scaffoldStandalone, printSuccess } = require('../lib/install');
const { uninstallFromProject, printUninstallResult } = require('../lib/uninstall');

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    target: '.',
    org: process.env.ARIVU_HELP_ORG || process.env.ARIVU_ORG || '',
    apiOrigin: process.env.ARIVU_API_ORIGIN || '',
    pathPrefix: process.env.HELP_URL_PREFIX || '/help/',
    siteOrigin: process.env.SITE_ORIGIN || '',
    dest: process.env.ARIVU_SYNC_DEST || './public',
    packageRoot: process.env.ARIVU_INSTALL_ROOT || '',
    removeIsrRoutes: true,
    integrationMode: 'hybrid',
    dryRun: false,
    keepEnv: false,
    keepStatic: false,
    force: false,
    updateKit: false,
  };

  const tokens = argv.slice(3);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1] || '';

    if (token === 'install' || token === 'create' || token === 'uninstall') {
      args.command = token;
      continue;
    }

    if (!token.startsWith('--')) {
      if ((args.command === 'create' || args.command === 'install' || args.command === 'uninstall') && args.target === '.') {
        args.target = token;
      }
      continue;
    }

    const [key, inlineValue] = token.slice(2).split('=');
    const value = inlineValue ?? next;
    if (!inlineValue && !next && !['no-remove-isr', 'dry-run', 'keep-env', 'keep-static', 'force', 'update-kit'].includes(key)) {
      continue;
    }

    if (key === 'org') args.org = value;
    if (key === 'api-origin') args.apiOrigin = value;
    if (key === 'path-prefix') args.pathPrefix = value;
    if (key === 'site-origin') args.siteOrigin = value;
    if (key === 'dest') args.dest = value;
    if (key === 'package-root') args.packageRoot = value;
    if (key === 'no-remove-isr') args.removeIsrRoutes = false;
    if (key === 'dry-run') args.dryRun = true;
    if (key === 'keep-env') args.keepEnv = true;
    if (key === 'keep-static') args.keepStatic = true;
    if (key === 'force') args.force = true;
    if (key === 'update-kit') args.updateKit = true;
    if (key === 'mode') {
      if (value === 'standalone-html') args.integrationMode = 'standalone-html';
      else if (value === 'layout') args.integrationMode = 'layout';
      else args.integrationMode = 'hybrid';
    }
    if (!inlineValue && !['no-remove-isr', 'dry-run', 'keep-env', 'keep-static', 'force', 'update-kit'].includes(key)) {
      index += 1;
    }
  }

  return args;
}

function printHelp() {
  process.stdout.write(`Arivu help install — Next.js / Vercel

Usage:
  arivu-help-install install [options]       Install into current Next.js project
  arivu-help-install uninstall [options]     Remove files added by install
  arivu-help-install create <dir> [options]  Scaffold a new standalone project

Options:
  --org=<embed-site-id>          Required for install/create. e.g. art_pub_xxx
  --api-origin=<url>             Required for install/create (curl bootstrap always needs this)
  --site-origin=<url>            Your public site, e.g. https://www.example.com
  --path-prefix=/help/           Help URL prefix (default /help/)
  --dest=./public                Static sync output directory (hybrid/static)
  --mode=hybrid                  Live embed + silent public/help HTML (default)
  --mode=layout                  Live embed only — skip static HTML write
  --mode=standalone-html         Full HTML files in public/help/ (no site chrome)
  --dry-run                      Uninstall: print paths without deleting
  --keep-env                     Uninstall: leave .env.local / .env.example alone
  --keep-static                  Uninstall: leave public/help/ synced HTML alone
  --force                        Overwrite all install files including UI/CSS
  --update-kit                   Refresh sync/webhook/help-sync/lib only (keep layouts)

Install:
  curl -fsSL https://app.arivu.com/static-sync/arivu-help-install.mjs | node - install \\
    --org=art_pub_xxx --api-origin=https://app.arivu.com --site-origin=https://www.example.com

Update tooling without touching CSS/layouts:
  curl -fsSL https://app.arivu.com/static-sync/arivu-help-install.mjs | node - install \\
    --org=art_pub_xxx --api-origin=https://app.arivu.com --update-kit

Uninstall:
  curl -fsSL https://app.arivu.com/static-sync/arivu-help-install.mjs | node - uninstall \\
    --api-origin=https://app.arivu.com
`);
}

function validateInstallArgs(args) {
  if (!args.org) throw new Error('--org is required');
  if (!args.apiOrigin) throw new Error('--api-origin is required');
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.command === 'help' || args.command === '--help' || args.command === '-h') {
    printHelp();
    return;
  }

  const targetDir = path.resolve(process.cwd(), args.target);

  if (args.command === 'uninstall') {
    const result = uninstallFromProject(targetDir, {
      dryRun: args.dryRun,
      keepEnv: args.keepEnv,
      keepStatic: args.keepStatic,
    });
    printUninstallResult(result);
    if (!result.installed) process.exitCode = 1;
    return;
  }

  validateInstallArgs(args);

  const options = {
    org: args.org,
    apiOrigin: args.apiOrigin,
    pathPrefix: args.pathPrefix,
    siteOrigin: args.siteOrigin,
    dest: args.dest,
    packageRoot: args.packageRoot || path.resolve(__dirname, '..'),
    removeIsrRoutes: args.removeIsrRoutes,
    integrationMode: args.integrationMode,
    force: args.force,
    updateKit: args.updateKit,
  };

  let result;
  if (args.command === 'create') {
    result = scaffoldStandalone(targetDir, options);
  } else if (args.command === 'install') {
    result = installIntoProject(targetDir, options);
  } else {
    throw new Error(`Unknown command: ${args.command}`);
  }

  printSuccess(result, options);
}

main().catch((error) => {
  process.stderr.write(`${error.message || error}\n`);
  process.exitCode = 1;
});
