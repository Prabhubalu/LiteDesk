'use strict';

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function detectNextProject(cwd) {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return { isNext: false, reason: 'package.json not found' };
  }

  const pkg = readJson(packageJsonPath);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps.next) {
    return { isNext: false, reason: 'next is not listed in package.json dependencies' };
  }

  let appDir = null;
  if (fs.existsSync(path.join(cwd, 'src', 'app'))) {
    appDir = path.join('src', 'app');
  } else if (fs.existsSync(path.join(cwd, 'app'))) {
    appDir = 'app';
  }

  const configCandidates = ['next.config.ts', 'next.config.mjs', 'next.config.js'];
  const configFile = configCandidates.find((name) => fs.existsSync(path.join(cwd, name))) || null;

  return {
    isNext: true,
    appDir,
    configFile,
    packageJsonPath,
    usesSrcDir: appDir === path.join('src', 'app'),
  };
}

module.exports = {
  detectNextProject,
};
