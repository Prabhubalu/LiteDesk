#!/usr/bin/env node
'use strict';

const { syncArticleExport, syncFull, handleWebhookPayload } = require('../lib/sync');
const { verifyWebhook } = require('../lib/verify');

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

function parseArgs(argv) {
  const args = {
    command: argv[2] || 'help',
    org: process.env.ARIVU_ORG || '',
    dest: process.env.ARIVU_SYNC_DEST || '',
    apiOrigin: process.env.ARIVU_API_ORIGIN || '',
    slug: '',
    pathPrefix: process.env.HELP_URL_PREFIX || '/help/',
    articleLinkPrefix: process.env.HELP_ARTICLE_LINK_PREFIX || '',
    assetsPrefix: process.env.HELP_ASSETS_PREFIX || '',
    full: false,
    mirrorAssets: process.env.ARIVU_MIRROR_ASSETS !== '0',
    siteOrigin: process.env.SITE_ORIGIN || '',
  };

  const tokens = argv.slice(3);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--org') {
      args.org = tokens[index + 1] || '';
      index += 1;
      continue;
    }
    if (token === '--dest') {
      args.dest = tokens[index + 1] || '';
      index += 1;
      continue;
    }
    if (token === '--api-origin') {
      args.apiOrigin = tokens[index + 1] || '';
      index += 1;
      continue;
    }
    if (token === '--slug') {
      args.slug = tokens[index + 1] || '';
      index += 1;
      continue;
    }
    if (token === '--path-prefix') {
      args.pathPrefix = tokens[index + 1] || '/help/';
      index += 1;
      continue;
    }
    if (token === '--article-link-prefix') {
      args.articleLinkPrefix = tokens[index + 1] || '';
      index += 1;
      continue;
    }
    if (token === '--assets-prefix') {
      args.assetsPrefix = tokens[index + 1] || '';
      index += 1;
      continue;
    }
    if (token === '--full') {
      args.full = true;
      continue;
    }
    if (token === '--no-mirror-assets') {
      args.mirrorAssets = false;
    }
  }

  return args;
}

function printHelp() {
  process.stdout.write(`Arivu help static sync

Usage:
  arivu-help-sync sync --org <org> --dest <path> [--slug <slug>] [--full] [--api-origin <url>]
  arivu-help-sync webhook --dest <path> [--org <org>] [--api-origin <url>]

Environment:
  ARIVU_ORG, ARIVU_API_ORIGIN, ARIVU_SYNC_DEST, HELP_URL_PREFIX

Examples:
  arivu-help-sync sync --org art_pub_xxx --dest ./public/help --full
  arivu-help-sync sync --org art_pub_xxx --dest ./public/help --slug create-invoice
  curl -X POST https://yoursite.com/webhook | arivu-help-sync webhook --dest ./public/help
`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.command === 'help' || args.command === '--help' || args.command === '-h') {
    printHelp();
    return;
  }

  if (!args.dest) {
    throw new Error('--dest is required');
  }
  if (!args.apiOrigin) {
    throw new Error('--api-origin or ARIVU_API_ORIGIN is required');
  }

  if (args.command === 'webhook') {
    const raw = await readStdin();
    const secret = process.env.ARIVU_WEBHOOK_SECRET || '';
    const signature = process.env.ARIVU_WEBHOOK_SIGNATURE || '';
    if (secret && !verifyWebhook(raw, secret, signature)) {
      throw new Error('Invalid webhook signature');
    }
    const payload = JSON.parse(raw || '{}');
    const org = args.org || payload?.organization?.slug || '';
    if (!org) throw new Error('--org or payload.organization.slug is required for webhook mode');

    const result = await handleWebhookPayload({
      apiOrigin: args.apiOrigin,
      org,
      dest: args.dest,
      payload,
      pathPrefix: args.pathPrefix,
      articleLinkPrefix: args.articleLinkPrefix || args.pathPrefix,
      assetsPrefix: args.assetsPrefix,
      mirrorAssets: args.mirrorAssets,
      siteOrigin: args.siteOrigin,
    });
    process.stdout.write(`${JSON.stringify({ success: true, result }, null, 2)}\n`);
    return;
  }

  if (args.command !== 'sync') {
    throw new Error(`Unknown command: ${args.command}`);
  }
  if (!args.org) {
    throw new Error('--org is required');
  }

  if (args.full) {
    const result = await syncFull({
      apiOrigin: args.apiOrigin,
      org: args.org,
      dest: args.dest,
      pathPrefix: args.pathPrefix,
      articleLinkPrefix: args.articleLinkPrefix || args.pathPrefix,
      assetsPrefix: args.assetsPrefix,
      mirrorAssets: args.mirrorAssets,
      siteOrigin: args.siteOrigin,
    });
    process.stdout.write(`${JSON.stringify({ success: true, ...result }, null, 2)}\n`);
    return;
  }

  if (!args.slug) {
    throw new Error('--slug is required unless --full is set');
  }

  const result = await syncArticleExport({
    apiOrigin: args.apiOrigin,
    org: args.org,
    dest: args.dest,
    slug: args.slug,
    pathPrefix: args.pathPrefix,
    articleLinkPrefix: args.articleLinkPrefix || args.pathPrefix,
    assetsPrefix: args.assetsPrefix,
    mirrorAssets: args.mirrorAssets,
  });
  process.stdout.write(`${JSON.stringify({ success: true, result }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message || error}\n`);
  process.exitCode = 1;
});
