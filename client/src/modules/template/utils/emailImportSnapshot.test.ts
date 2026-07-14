import { describe, expect, it } from 'vitest';
import {
  buildSnapshotFromParts,
  isEmailDefinitionDegraded,
  preserveEmailCss,
  preserveEmailHtml,
  protectEmailDefinitionRoundTrip
} from './emailImportSnapshot';
import { createBlankGrapesDefinition } from '../editor/storage';

describe('preserveEmailCss', () => {
  it('keeps previous css when next is empty', () => {
    expect(preserveEmailCss('', '.a{color:red}')).toBe('.a{color:red}');
  });

  it('prefers next css when present', () => {
    expect(preserveEmailCss('.b{color:blue}', '.a{color:red}')).toBe('.b{color:blue}');
  });
});

describe('preserveEmailHtml', () => {
  it('keeps structured previous html when next is flattened text', () => {
    const structured = '<table><tr><td>Hi</td></tr></table>';
    const flat = 'Body Container Hi /Email Container';
    expect(preserveEmailHtml(flat, structured)).toBe(structured);
  });

  it('prefers live structured canvas html so merge-tag edits survive', () => {
    const previous = '<table><tr><td>Hi there</td></tr></table>';
    const next = '<table><tr><td>Hi {{People.first_name}}</td></tr></table>';
    expect(preserveEmailHtml(next, previous)).toBe(next);
  });

  it('keeps previous when next is a severe size regression', () => {
    const previous = `<table>${'<tr><td>cell content here</td></tr>'.repeat(40)}</table>`;
    const next = '<table><tr><td>x</td></tr></table>';
    expect(preserveEmailHtml(next, previous)).toBe(previous);
  });
});

describe('isEmailDefinitionDegraded', () => {
  it('detects empty overwrite of structured email', () => {
    const previous = {
      ...createBlankGrapesDefinition(),
      html: '<table><tr><td>Happy Birthday email body with real content</td></tr></table>'.repeat(5)
    };
    const next = { ...createBlankGrapesDefinition(), html: '' };
    expect(isEmailDefinitionDegraded(next, previous)).toBe(true);
  });
});

describe('protectEmailDefinitionRoundTrip', () => {
  it('restores css and structured html from last good definition', () => {
    const previous = {
      ...createBlankGrapesDefinition(),
      html: '<table width="600"><tr><td>Happy Birthday</td></tr></table>',
      css: '.card{background:#111}',
      importSnapshot: buildSnapshotFromParts(
        '<table width="600"><tr><td>Happy Birthday</td></tr></table>',
        '.card{background:#111}',
        'html-edit'
      )
    };
    const next = {
      ...createBlankGrapesDefinition(),
      html: 'Body Container Happy Birthday /Email Container',
      css: '',
      project: { pages: [] }
    };

    const protectedDef = protectEmailDefinitionRoundTrip(next, previous);
    expect(protectedDef.css).toBe('.card{background:#111}');
    expect(protectedDef.html).toContain('<table');
    expect(protectedDef.project).toBeNull();
  });
});
