#!/usr/bin/env node
'use strict';

const path = require('path');
const { installIntoProject, scaffoldStandalone, printSuccess } = require('../lib/install');

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    target: '.',
    org: process.env.ARIVU_ORG || '',
    apiOrigin: process.env.ARIVU_API_ORIGIN || '',
    pathPrefix: process.env.HELP_URL_PREFIX || '/help/',
    siteOrigin: process.env.SITE_ORIGIN || '',
    dest: process.env.ARIVU_SYNC_DEST || './public',
    packageRoot: process.env.ARIVU_INSTALL_ROOT || '',
    removeIsrRoutes: true,
    integrationMode: 'layout',
  };

  const tokens = argv.slice(3);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1] || '';

    if (token === 'install' || token === 'create') {
      args.command = token;
      continue;
    }

    if (!token.startsWith('--')) {
      if (args.command === 'create' && args.target === '.') {
        args.target = token;
      }
      continue;
    }

    const [key, inlineValue] = token.slice(2).split('=');
    const value = inlineValue ?? next;
    if (!inlineValue && !next && key !== 'no-remove-isr') {
      continue;
    }

    if (key === 'org') args.org = value;
    if (key === 'api-origin') args.apiOrigin = value;
    if (key === 'path-prefix') args.pathPrefix = value;
    if (key === 'site-origin') args.siteOrigin = value;
    if (key === 'dest') args.dest = value;
    if (key === 'package-root') args.packageRoot = value;
    if (key === 'no-remove-isr') args.removeIsrRoutes = false;
    if (key === 'mode') args.integrationMode = value === 'standalone-html' ? 'standalone-html' : 'layout';
    if (!inlineValue) index += 1;
  }

  return args;
}

function printHelp() {
  process.stdout.write(`Arivu help install — Next.js / Vercel

Usage:
  arivu-help-install install [options]     Install into current Next.js project
  arivu-help-install create <dir> [options]  Scaffold a new standalone project

Options:
  --org=<embed-site-id>          Required. e.g. art_pub_xxx
  --api-origin=<url>             Required. e.g. https://app.arivu.com
  --site-origin=<url>            Your public site, e.g. https://www.example.com
  --path-prefix=/help/           Help URL prefix (default /help/)
  --dest=./public                Static sync output directory (standalone-html mode)
  --mode=layout                  Site layout mode — keeps nav/footer (default)
  --mode=standalone-html         Full HTML files in public/help/ (no site chrome)

One-liner (from your Next.js project root):
  curl -fsSL https://app.arivu.com/static-sync/arivu-help-install.mjs | node - install \\
    --org=art_pub_xxx --api-origin=https://app.arivu.com --site-origin=https://www.example.com
`);
}

function validateArgs(args) {
  if (!args.org) throw new Error('--org is required');
  if (!args.apiOrigin) throw new Error('--api-origin is required');
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.command === 'help' || args.command === '--help' || args.command === '-h') {
    printHelp();
    return;
  }

  validateArgs(args);

  const options = {
    org: args.org,
    apiOrigin: args.apiOrigin,
    pathPrefix: args.pathPrefix,
    siteOrigin: args.siteOrigin,
    dest: args.dest,
    packageRoot: args.packageRoot || path.resolve(__dirname, '..'),
    removeIsrRoutes: args.removeIsrRoutes,
    integrationMode: args.integrationMode,
  };

  let result;
  if (args.command === 'create') {
    const targetDir = path.resolve(process.cwd(), args.target);
    result = scaffoldStandalone(targetDir, options);
  } else if (args.command === 'install') {
    const targetDir = path.resolve(process.cwd(), args.target);
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
