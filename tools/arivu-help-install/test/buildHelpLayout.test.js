'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildHelpLayoutContent,
  extractChromeComponents,
} = require('../lib/buildHelpLayout');

const blogLayout = `
import SiteNav from '@/components/SiteNav';
import SiteNavSpacer from '@/components/SiteNavSpacer';
import Container from '@/components/Container';
import SiteFooter from '@/components/SiteFooter';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <SiteNavSpacer />
      <Container wide>
        {children}
      </Container>
      <SiteFooter />
    </>
  );
}
`;

test('extractChromeComponents preserves blog layout order', () => {
  const components = extractChromeComponents(blogLayout);
  assert.deepEqual(components.map((component) => component.name), [
    'SiteNav',
    'SiteNavSpacer',
    'Container',
    'SiteFooter',
  ]);
  assert.equal(components[2].props, 'wide');
});

test('buildHelpLayoutContent wraps help content with detected chrome', () => {
  const components = extractChromeComponents(blogLayout);
  const content = buildHelpLayoutContent({ chromeComponents: components });
  assert.match(content, /import SiteNav from '@\/components\/SiteNav';/);
  assert.match(content, /import SiteFooter from '@\/components\/SiteFooter';/);
  assert.match(content, /<SiteNav \/>/);
  assert.match(content, /<Container wide>/);
  assert.match(content, /className="ld-help-root ld-help-embed arivu-help-chrome"/);
  assert.match(content, /<SiteFooter \/>/);
  assert.match(content, /max-width: none;/);
});

test('buildHelpLayoutContent returns null without importable chrome', () => {
  const content = buildHelpLayoutContent({
    chromeComponents: [{ name: 'SiteNav', props: '', role: 'header', importLine: null }],
  });
  assert.equal(content, null);
});

test('inferChromeComponentsFromDiscovered builds imports from component files', () => {
  const { inferChromeComponentsFromDiscovered } = require('../lib/buildHelpLayout');
  const components = inferChromeComponentsFromDiscovered([
    'src/components/SiteNav.tsx',
    'src/components/SiteNavSpacer.tsx',
    'src/components/Container.tsx',
    'src/components/SiteFooter.tsx',
  ]);
  assert.deepEqual(components.map((component) => component.name), [
    'SiteNav',
    'SiteNavSpacer',
    'Container',
    'SiteFooter',
  ]);
  assert.match(components[0].importLine, /@\/components\/SiteNav/);
});
