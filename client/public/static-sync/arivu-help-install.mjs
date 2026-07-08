#!/usr/bin/env node
/**
 * Bootstrap: download the Arivu help installer from your Arivu app and run it.
 * Usage:
 *   curl -fsSL https://app.arivu.com/static-sync/arivu-help-install.mjs | node - install --org=... --api-origin=...
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const INSTALLER_FILES = [
  'bin/arivu-help-install.js',
  'lib/detect.js',
  'lib/copyTemplates.js',
  'lib/mergeConfig.js',
  'lib/mergeConfigCjs.js',
  'lib/install.js',
  'templates/next/app/help/[[...slug]]/page.tsx',
  'templates/next/app/help/layout.tsx',
  'templates/next/app/help/ArivuHelpContent.tsx',
  'templates/next/app/help/ArivuHelpAssets.tsx',
  'templates/next/app/help/sitemap.xml/route.ts',
  'templates/next/lib/arivu-help.ts',
  'templates/app/api/arivu-webhook/route.ts',
  'templates/standalone/package.json',
  'templates/standalone/next.config.mjs',
  'templates/standalone/tsconfig.json',
  'templates/standalone/README.txt',
  'templates/standalone/app/layout.tsx',
  'templates/standalone/app/page.tsx',
  'help-sync/package.json',
  'help-sync/lib/client.js',
  'help-sync/lib/index.js',
  'help-sync/lib/pageShell.js',
  'help-sync/lib/paths.js',
  'help-sync/lib/sync.js',
  'help-sync/lib/verify.js',
];

function parseApiOrigin(argv) {
  for (const token of argv.slice(2)) {
    if (token.startsWith('--api-origin=')) {
      return token.slice('--api-origin='.length).replace(/\/$/, '');
    }
    if (token === '--api-origin') {
      const index = argv.indexOf(token);
      return String(argv[index + 1] || '').replace(/\/$/, '');
    }
  }
  return String(process.env.ARIVU_API_ORIGIN || '').replace(/\/$/, '');
}

async function downloadInstaller(apiOrigin, cacheDir) {
  await fs.mkdir(cacheDir, { recursive: true });
  for (const relativePath of INSTALLER_FILES) {
    const url = `${apiOrigin}/static-sync/arivu-help-install/${relativePath}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url} (${response.status})`);
    }
    const destPath = path.join(cacheDir, relativePath);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, Buffer.from(await response.arrayBuffer()));
  }
}

async function main() {
  const apiOrigin = parseApiOrigin(process.argv);
  if (!apiOrigin) {
    process.stderr.write('--api-origin is required (or set ARIVU_API_ORIGIN)\n');
    process.exitCode = 1;
    return;
  }

  const cacheDir = path.join(os.tmpdir(), 'arivu-help-install');
  await downloadInstaller(apiOrigin, cacheDir);

  const entry = path.join(cacheDir, 'bin/arivu-help-install.js');
  const child = spawnSync(
    process.execPath,
    [entry, ...process.argv.slice(2), `--package-root=${cacheDir}`],
    { stdio: 'inherit', cwd: process.cwd(), env: process.env },
  );
  process.exitCode = child.status ?? 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message || error}\n`);
  process.exitCode = 1;
});
