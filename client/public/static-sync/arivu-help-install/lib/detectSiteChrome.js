'use strict';

const fs = require('fs');
const path = require('path');
const {
  extractChromeComponents,
  inferChromeComponentsFromDiscovered,
} = require('./buildHelpLayout');

const CHROME_PATTERNS = [
  /header/i,
  /footer/i,
  /navbar/i,
  /nav-bar/i,
  /site.?nav/i,
  /main.?nav/i,
  /topbar/i,
  /top-bar/i,
  /navigation/i,
  /spacer/i,
  /container/i,
];

const REFERENCE_LAYOUT_HINTS = [
  /\/blog\/layout\.(tsx|jsx|js)$/i,
  /\/docs\/layout\.(tsx|jsx|js)$/i,
  /\/marketing\/layout\.(tsx|jsx|js)$/i,
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

function listLayoutFiles(cwd, appDir) {
  const appPath = path.join(cwd, appDir);
  if (!fs.existsSync(appPath)) return [];

  const layouts = [];
  const stack = [appPath];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (/^layout\.(tsx|jsx|js)$/i.test(entry.name)) {
        layouts.push(fullPath);
      }
    }
  }

  return layouts.sort((left, right) => left.localeCompare(right));
}

function scoreLayoutPath(layoutPath) {
  const normalized = layoutPath.split(path.sep).join('/');
  for (let index = 0; index < REFERENCE_LAYOUT_HINTS.length; index += 1) {
    if (REFERENCE_LAYOUT_HINTS[index].test(normalized)) {
      return 100 - index;
    }
  }
  if (/\/app\/layout\.(tsx|jsx|js)$/i.test(normalized) || /\/src\/app\/layout\.(tsx|jsx|js)$/i.test(normalized)) {
    return 1;
  }
  return 10;
}

function chromeUsedInSource(source, relativePaths) {
  return relativePaths.filter((relativePath) => {
    const baseName = path.basename(relativePath, path.extname(relativePath));
    return source.includes(baseName);
  });
}

function analyzeLayoutSource(source) {
  const components = extractChromeComponents(source);
  const usedNames = components.map((component) => component.name);
  return {
    hasChrome: components.length > 0,
    wrapsChildren: source.includes('{children}'),
    components,
    usedNames,
  };
}

function detectSiteChrome(cwd, project) {
  const appDir = project.appDir || 'app';
  const layoutFiles = listLayoutFiles(cwd, appDir);
  const appRoot = path.join(cwd, appDir);
  const rootLayoutPath = ['layout.tsx', 'layout.jsx', 'layout.js']
    .map((name) => path.join(appRoot, name))
    .find((layoutPath) => fs.existsSync(layoutPath)) || null;
  const rootLayoutSource = rootLayoutPath ? fs.readFileSync(rootLayoutPath, 'utf8') : '';

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

  const rootAnalysis = analyzeLayoutSource(rootLayoutSource);
  const chromeUsedInRootLayout = chromeUsedInSource(rootLayoutSource, discovered);
  const preservesSiteChrome = rootAnalysis.hasChrome && rootAnalysis.wrapsChildren;

  const candidateLayouts = layoutFiles
    .filter((layoutPath) => layoutPath !== rootLayoutPath)
    .map((layoutPath) => {
      const source = fs.readFileSync(layoutPath, 'utf8');
      const analysis = analyzeLayoutSource(source);
      return {
        layoutPath,
        relativePath: path.relative(cwd, layoutPath),
        score: scoreLayoutPath(layoutPath) + analysis.components.length,
        analysis,
        source,
      };
    })
    .filter((entry) => entry.analysis.hasChrome && entry.analysis.wrapsChildren)
    .sort((left, right) => right.score - left.score);

  const referenceLayout = candidateLayouts[0] || null;
  const inferredChromeComponents = referenceLayout
    ? []
    : inferChromeComponentsFromDiscovered(discovered);
  const referenceChromeComponents = referenceLayout?.analysis.components.length
    ? referenceLayout.analysis.components
    : inferredChromeComponents;
  const needsHelpLayoutChrome = !preservesSiteChrome && referenceChromeComponents.length > 0;

  return {
    hasRootLayout: Boolean(rootLayoutSource),
    layoutPath: rootLayoutSource ? path.relative(cwd, rootLayoutPath) : null,
    chromeComponents: [...new Set(discovered)].slice(0, 12),
    chromeUsedInLayout: [...new Set(chromeUsedInRootLayout)],
    preservesSiteChrome,
    needsHelpLayoutChrome,
    referenceLayoutPath: referenceLayout?.relativePath || null,
    referenceChromeComponents,
    inferredChromeComponents,
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
