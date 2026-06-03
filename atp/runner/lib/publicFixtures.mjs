import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '../../fixtures');

export function loadPublicFixtures() {
  const file = path.join(FIXTURES_DIR, 'public.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function getPublicFixture(key) {
  const all = loadPublicFixtures();
  return all[key] ?? process.env[key] ?? null;
}
