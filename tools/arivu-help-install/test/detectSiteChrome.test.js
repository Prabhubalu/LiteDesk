'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectSiteChrome } = require('../lib/detectSiteChrome');

function withProject(layouts, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arivu-chrome-'));
  const appDir = path.join(dir, 'src', 'app');
  fs.mkdirSync(appDir, { recursive: true });

  for (const [relativePath, source] of Object.entries(layouts)) {
    const filePath = path.join(dir, 'src', 'app', relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, source);
  }

  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const rootOnly = `
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;

const blogLayout = `
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      {children}
      <SiteFooter />
    </>
  );
}
`;

test('detectSiteChrome flags help layout patch when chrome lives in blog layout', () => {
  withProject({
    'layout.tsx': rootOnly,
    'blog/layout.tsx': blogLayout,
  }, (dir) => {
    const result = detectSiteChrome(dir, { appDir: path.join('src', 'app'), usesSrcDir: true });
    assert.equal(result.preservesSiteChrome, false);
    assert.equal(result.needsHelpLayoutChrome, true);
    assert.equal(result.referenceLayoutPath, path.join('src', 'app', 'blog', 'layout.tsx'));
    assert.deepEqual(result.referenceChromeComponents.map((component) => component.name), [
      'SiteNav',
      'SiteFooter',
    ]);
  });
});

test('detectSiteChrome skips help layout patch when root layout already has chrome', () => {
  withProject({
    'layout.tsx': `
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
`,
    'blog/layout.tsx': blogLayout,
  }, (dir) => {
    const result = detectSiteChrome(dir, { appDir: path.join('src', 'app'), usesSrcDir: true });
    assert.equal(result.preservesSiteChrome, true);
    assert.equal(result.needsHelpLayoutChrome, false);
  });
});
