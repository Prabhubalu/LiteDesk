import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(clientRoot, 'public/static-sync/next-app-router');
const outputPath = path.join(clientRoot, 'public/static-sync/arivu-next-static-sync.zip');
const bundleEntries = ['app', 'lib', 'README.md'];

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

async function addEntry(zip, entryName) {
  const entryPath = path.join(sourceRoot, entryName);
  const stat = await fs.stat(entryPath);
  if (stat.isDirectory()) {
    await addDirectory(zip, entryPath, entryName);
    return;
  }
  zip.file(entryName, await fs.readFile(entryPath));
}

async function main() {
  await fs.access(sourceRoot);
  const zip = new JSZip();
  for (const entryName of bundleEntries) {
    await addEntry(zip, entryName);
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

main().catch((error) => {
  console.error('[static-sync] Failed to build Next.js template zip:', error);
  process.exit(1);
});
