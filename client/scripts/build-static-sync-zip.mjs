import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(clientRoot, '..');
const helpSyncSource = path.join(repoRoot, 'tools/help-sync');
const nextSourceRoot = path.join(clientRoot, 'public/static-sync/next-app-router');
const vercelSourceRoot = path.join(clientRoot, 'public/static-sync/vercel-standalone');
const nextOutputPath = path.join(clientRoot, 'public/static-sync/arivu-next-static-sync.zip');
const vercelOutputPath = path.join(clientRoot, 'public/static-sync/arivu-help-vercel.zip');

const nextBundleEntries = [
  'app',
  'lib',
  'scripts',
  'help-sync',
  'README.md',
  'next.config.example.mjs',
];

async function copyHelpSyncPackage(destRoot) {
  const helpSyncDest = path.join(destRoot, 'help-sync');
  await fs.rm(helpSyncDest, { recursive: true, force: true });
  await fs.mkdir(helpSyncDest, { recursive: true });
  await fs.copyFile(
    path.join(helpSyncSource, 'package.json'),
    path.join(helpSyncDest, 'package.json'),
  );
  await fs.cp(path.join(helpSyncSource, 'lib'), path.join(helpSyncDest, 'lib'), { recursive: true });
}

async function copySharedAssets(destRoot) {
  await fs.cp(
    path.join(nextSourceRoot, 'scripts'),
    path.join(destRoot, 'scripts'),
    { recursive: true },
  );
  await fs.cp(
    path.join(nextSourceRoot, 'app/api'),
    path.join(destRoot, 'app/api'),
    { recursive: true },
  );
}

async function addDirectory(zip, dirPath, zipPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await addDirectory(zip, fullPath, entryZipPath);
    } else {
      zip.file(entryZipPath, await fs.readFile(fullPath));
    }
  }
}

async function addEntry(zip, sourceRoot, entryName) {
  const entryPath = path.join(sourceRoot, entryName);
  const stat = await fs.stat(entryPath);
  if (stat.isDirectory()) {
    await addDirectory(zip, entryPath, entryName);
    return;
  }
  zip.file(entryName, await fs.readFile(entryPath));
}

async function buildZip(sourceRoot, entries, outputPath) {
  const zip = new JSZip();
  for (const entryName of entries) {
    await addEntry(zip, sourceRoot, entryName);
  }
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
  console.log(`[static-sync] Wrote ${outputPath} (${buffer.length} bytes)`);
}

async function main() {
  await fs.access(nextSourceRoot);
  await fs.access(vercelSourceRoot);

  await copyHelpSyncPackage(nextSourceRoot);
  await buildZip(nextSourceRoot, nextBundleEntries, nextOutputPath);

  await copyHelpSyncPackage(vercelSourceRoot);
  await copySharedAssets(vercelSourceRoot);
  await buildZip(vercelSourceRoot, [
    'app',
    'scripts',
    'help-sync',
    'package.json',
    'next.config.mjs',
    'tsconfig.json',
    'README.txt',
  ], vercelOutputPath);
}

main().catch((error) => {
  console.error('[static-sync] Failed to build static sync zips:', error);
  process.exit(1);
});
