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

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url} (${response.status})`);
  }
  return response.text();
}

async function downloadInstaller(apiOrigin, cacheDir) {
  const manifestUrl = `${apiOrigin}/static-sync/arivu-help-install/manifest.json`;
  const manifestRaw = await fetchText(manifestUrl);
  const manifest = JSON.parse(manifestRaw);
  const files = Array.isArray(manifest.files) ? manifest.files : [];

  if (!files.length) {
    throw new Error('Installer manifest is empty');
  }

  await fs.mkdir(cacheDir, { recursive: true });
  for (const relativePath of files) {
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
