'use strict';

const path = require('path');

const CHROME_WIDTH_OVERRIDE = [
  '      <style>{`',
  '        .arivu-help-chrome .ld-help-page,',
  '        .arivu-help-chrome .ld-help-home,',
  '        .arivu-help-chrome .ld-help-site {',
  '          max-width: none;',
  '          padding-inline: 0;',
  '        }',
  '      `}</style>',
].join('\n');

function parseImportLines(source) {
  const imports = new Map();
  for (const match of source.matchAll(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm)) {
    const clause = match[1].trim();
    const fromPath = match[2];
    if (clause.startsWith('{')) {
      for (const name of clause.slice(1, -1).split(',')) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+as\s+/);
        const localName = (parts[1] || parts[0]).trim();
        imports.set(localName, `import { ${trimmed} } from '${fromPath}';`);
      }
      continue;
    }
    if (clause.includes(',')) {
      const parts = clause.split(',');
      const defaultName = parts[0].replace(/^type\s+/, '').trim();
      imports.set(defaultName, `import ${clause} from '${fromPath}';`);
      continue;
    }
    const localName = clause.replace(/^type\s+/, '').trim();
    imports.set(localName, `import ${clause} from '${fromPath}';`);
  }
  return imports;
}

function isChromeComponentName(name) {
  return /header|footer|navbar|nav-bar|site.?nav|main.?nav|topbar|top-bar|spacer|container|wrapper|shell|page-shell|navigation/i.test(name);
}

function classifyChromeRole(name) {
  if (/footer/i.test(name)) return 'footer';
  if (/spacer/i.test(name)) return 'spacer';
  if (/container|wrapper|shell|page-shell/i.test(name)) return 'container';
  if (/header|navbar|nav-bar|site.?nav|main.?nav|topbar|top-bar|navigation/i.test(name)) return 'header';
  return 'header';
}

const INFERRED_COMPONENT_ORDER = [
  { pattern: /site.?nav|main.?nav|navbar|nav-bar|topbar|top-bar|header|navigation/i, role: 'header' },
  { pattern: /spacer/i, role: 'spacer' },
  { pattern: /container|wrapper|shell|page-shell/i, role: 'container' },
  { pattern: /footer/i, role: 'footer' },
];

function toComponentImportPath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  const withoutExt = normalized.replace(/\.(tsx|jsx|vue)$/i, '');
  if (withoutExt.startsWith('src/components/')) {
    return `@/${withoutExt.slice(4)}`;
  }
  if (withoutExt.startsWith('components/')) {
    return `@/${withoutExt}`;
  }
  if (withoutExt.startsWith('src/app/components/')) {
    return `@/${withoutExt.slice(4)}`;
  }
  if (withoutExt.startsWith('app/components/')) {
    return `@/${withoutExt}`;
  }
  return null;
}

function inferChromeComponentsFromDiscovered(relativePaths = []) {
  const components = [];

  for (const { pattern, role } of INFERRED_COMPONENT_ORDER) {
    const matchPath = relativePaths.find((relativePath) => {
      const baseName = path.basename(relativePath, path.extname(relativePath));
      return pattern.test(baseName);
    });
    if (!matchPath) continue;

    const name = path.basename(matchPath, path.extname(matchPath));
    const importFrom = toComponentImportPath(matchPath);
    if (!importFrom) continue;

    components.push({
      name,
      props: role === 'container' ? 'wide' : '',
      role,
      importLine: `import ${name} from '${importFrom}';`,
    });
  }

  return components;
}

function extractChromeComponents(source) {
  const imports = parseImportLines(source);
  const ordered = [];
  const seen = new Set();

  for (const match of source.matchAll(/<([A-Z][A-Za-z0-9]*)\b([^>/]*)\/?>/g)) {
    const name = match[1];
    if (seen.has(name)) continue;
    if (!isChromeComponentName(name)) {
      continue;
    }
    seen.add(name);
    ordered.push({
      name,
      props: match[2].trim(),
      role: classifyChromeRole(name),
      importLine: imports.get(name) || null,
    });
  }

  return ordered;
}

function renderComponentTag(component) {
  const props = component.props ? ` ${component.props}` : '';
  if (component.role === 'container') {
    return `<${component.name}${props}>`;
  }
  return `<${component.name}${props} />`;
}

function buildHelpLayoutContent({ chromeComponents = [] } = {}) {
  const usable = chromeComponents.filter((component) => component.importLine);
  if (!usable.length) {
    return null;
  }

  const importLines = [...new Set(usable.map((component) => component.importLine))];
  const headers = usable.filter((component) => component.role === 'header' || component.role === 'spacer');
  const container = usable.find((component) => component.role === 'container');
  const footers = usable.filter((component) => component.role === 'footer');

  const beforeLines = headers.map((component) => `      ${renderComponentTag(component)}`);
  const afterLines = footers.map((component) => `      ${renderComponentTag(component)}`);

  const helpContent = '        <div className="ld-help-root ld-help-embed arivu-help-chrome">{children}</div>';

  let middleBlock;
  if (container) {
    middleBlock = [
      `      ${renderComponentTag(container)}`,
      helpContent,
      `      </${container.name}>`,
    ].join('\n');
  } else {
    middleBlock = helpContent.replace(/^        /, '      ');
  }

  return `import ArivuHelpAssets from './ArivuHelpAssets';
${importLines.join('\n')}

const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const stylesheetOrigin = API_ORIGIN.replace(/\\/$/, '');

  return (
    <>
      {stylesheetOrigin ? (
        <link rel="stylesheet" href={\`\${stylesheetOrigin}/embed/headless-blocks.css\`} />
      ) : null}
${beforeLines.length ? `${beforeLines.join('\n')}\n` : ''}${middleBlock}
${afterLines.length ? `${afterLines.join('\n')}\n` : ''}      <ArivuHelpAssets apiOrigin={API_ORIGIN} />
${CHROME_WIDTH_OVERRIDE}
    </>
  );
}
`;
}

module.exports = {
  buildHelpLayoutContent,
  classifyChromeRole,
  extractChromeComponents,
  inferChromeComponentsFromDiscovered,
  isChromeComponentName,
  parseImportLines,
  toComponentImportPath,
};
