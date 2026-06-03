import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUARANTINE_FILE = path.join(__dirname, '../../fixtures/quarantine.json');

let cache = null;

export function loadQuarantineIds() {
  if (cache) return cache;
  if (!fs.existsSync(QUARANTINE_FILE)) {
    cache = new Set();
    return cache;
  }
  const raw = JSON.parse(fs.readFileSync(QUARANTINE_FILE, 'utf8'));
  const ids = Array.isArray(raw) ? raw : raw.caseIds || [];
  cache = new Set(ids.filter(Boolean));
  return cache;
}

export function isQuarantined(caseId) {
  if (process.env.ATP_IGNORE_QUARANTINE === '1') return false;
  return loadQuarantineIds().has(caseId);
}
