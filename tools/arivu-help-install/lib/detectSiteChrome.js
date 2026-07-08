'use strict';

const fs = require('fs');
const path = require('path');

const CHROME_PATTERNS = [
  /header/i,
  /footer/i,
  /navbar/i,
  /nav-bar/i,
  /site-nav/i,
  /main-nav/i,
  /topbar/i,
  /top-bar/i,
];

function listComponentFiles(componentsDir) {
  if (!fs.existsSync(componentsDir)) return [];
  const results = [];
  const stack = [componentsDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (/\.(tsx|jsx|vue)$/i.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function detectSiteChrome(cwd, project) {
  const appDir = project.appDir || 'app';
  const rootLayoutPath = path.join(cwd, appDir, 'layout.tsx');
  const rootLayoutJsPath = path.join(cwd, appDir, 'layout.js');
  const layoutPath = fs.existsSync(rootLayoutPath) ? rootLayoutPath : rootLayoutJsPath;
  const layoutSource = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : '';

  const componentRoots = [
    path.join(cwd, 'components'),
    path.join(cwd, 'src', 'components'),
    path.join(cwd, 'app', 'components'),
    path.join(cwd, 'src', 'app', 'components'),
  ];

  const discovered = [];
  for (const root of componentRoots) {
    for (const filePath of listComponentFiles(root)) {
      const baseName = path.basename(filePath, path.extname(filePath));
      if (CHROME_PATTERNS.some((pattern) => pattern.test(baseName))) {
        discovered.push(path.relative(cwd, filePath));
      }
    }
  }

  const usedInLayout = discovered.filter((relativePath) => {
    const baseName = path.basename(relativePath, path.extname(relativePath));
    return layoutSource.includes(baseName);
  });

  return {
    hasRootLayout: Boolean(layoutSource),
    layoutPath: layoutSource ? path.relative(cwd, layoutPath) : null,
    chromeComponents: [...new Set(discovered)].slice(0, 12),
    chromeUsedInLayout: [...new Set(usedInLayout)],
    preservesSiteChrome: Boolean(layoutSource),
  };
}

function resolveLibDir(cwd, project) {
  if (project.usesSrcDir && fs.existsSync(path.join(cwd, 'src'))) {
    return path.join('src', 'lib');
  }
  return 'lib';
}

module.exports = {
  detectSiteChrome,
  resolveLibDir,
};
