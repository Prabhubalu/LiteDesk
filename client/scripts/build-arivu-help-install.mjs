import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(clientRoot, '..');
const installerSource = path.join(repoRoot, 'tools/arivu-help-install');
const publicInstallerRoot = path.join(clientRoot, 'public/static-sync/arivu-help-install');
const bootstrapOutput = path.join(clientRoot, 'public/static-sync/arivu-help-install.mjs');

const bundleEntries = [
  'bin',
  'lib',
  'templates',
  'help-sync',
  'README.md',
];

async function copyDirectory(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  await fs.access(installerSource);
  await fs.rm(publicInstallerRoot, { recursive: true, force: true });
  await fs.mkdir(publicInstallerRoot, { recursive: true });

  for (const entryName of bundleEntries) {
    const srcPath = path.join(installerSource, entryName);
    const destPath = path.join(publicInstallerRoot, entryName);
    const stat = await fs.stat(srcPath);
    if (stat.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }

  await fs.copyFile(
    path.join(installerSource, 'bootstrap.mjs'),
    bootstrapOutput,
  );

  console.log(`[arivu-help-install] Published ${publicInstallerRoot}`);
  console.log(`[arivu-help-install] Bootstrap ${bootstrapOutput}`);
}

main().catch((error) => {
  console.error('[arivu-help-install] Failed to publish installer:', error);
  process.exit(1);
});
