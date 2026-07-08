'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  patchPackageJson,
  patchNextConfig,
  writeArivuHelpConfig,
} = require('../lib/mergeConfig');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arivu-install-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('patchPackageJson layout mode does not add prebuild sync', () => {
  withTempDir((dir) => {
    const pkgPath = path.join(dir, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify({ scripts: { build: 'next build' } }, null, 2));
    const scripts = patchPackageJson(pkgPath, { integrationMode: 'layout' });
    assert.equal(scripts['sync:help'], undefined);
    assert.equal(scripts.prebuild, undefined);
  });
});

test('patchPackageJson standalone-html mode adds sync:help and prebuild', () => {
  withTempDir((dir) => {
    const pkgPath = path.join(dir, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify({ scripts: { build: 'next build' } }, null, 2));
    const scripts = patchPackageJson(pkgPath, { integrationMode: 'standalone-html' });
    assert.equal(scripts['sync:help'], 'node scripts/sync-help-static.mjs');
    assert.equal(scripts.prebuild, 'npm run sync:help');
  });
});

test('patchPackageJson chains existing prebuild in standalone-html mode', () => {
  withTempDir((dir) => {
    const pkgPath = path.join(dir, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify({ scripts: { prebuild: 'node other.mjs' } }, null, 2));
    const scripts = patchPackageJson(pkgPath, { integrationMode: 'standalone-html' });
    assert.equal(scripts.prebuild, 'npm run sync:help && node other.mjs');
  });
});

test('patchNextConfig wraps export default nextConfig', () => {
  withTempDir((dir) => {
    const configPath = path.join(dir, 'next.config.mjs');
    fs.writeFileSync(configPath, 'const nextConfig = {};\nexport default nextConfig;\n');
    const result = patchNextConfig(configPath);
    assert.equal(result.patched, true);
    const content = fs.readFileSync(configPath, 'utf8');
    assert.match(content, /withArivuHelp\(nextConfig\)/);
  });
});

test('writeArivuHelpConfig writes rewrites for custom prefix', () => {
  withTempDir((dir) => {
    const filePath = writeArivuHelpConfig(dir, '/support/');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.match(content, /\/support/);
  });
});
