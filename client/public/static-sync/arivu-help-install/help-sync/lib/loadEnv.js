'use strict';

const fs = require('fs');
const path = require('path');

function parseAndApplyEnv(content, presetKeys) {
  for (const rawLine of String(content || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    // Shell / CI values win; later files (.env.local) override earlier (.env).
    if (presetKeys.has(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/**
 * Load Next-style env files for plain Node scripts (sync CLI).
 * Order: .env then .env.local. Existing process.env keys are never overwritten.
 */
function loadEnvFiles(cwd = process.cwd()) {
  const presetKeys = new Set(Object.keys(process.env));
  for (const name of ['.env', '.env.local']) {
    const filePath = path.join(cwd, name);
    if (!fs.existsSync(filePath)) continue;
    parseAndApplyEnv(fs.readFileSync(filePath, 'utf8'), presetKeys);
  }
}

module.exports = {
  loadEnvFiles,
};
