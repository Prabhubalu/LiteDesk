import { describe, expect, it } from 'vitest';
import type { Component } from 'grapesjs';
import {
  inspectorShowsAppearance,
  inspectorShowsLayout,
  inspectorShowsTypography,
  resolveInspectorContext
} from './componentInspector';

function mockComponent(options: {
  tagName?: string;
  attrs?: Record<string, string>;
  parent?: ReturnType<typeof mockComponent> | null;
  name?: string;
}) {
  return {
    get(key: string) {
      if (key === 'tagName') return options.tagName || 'div';
      if (key === 'name') return options.name || '';
      if (key === 'content') return '';
      return '';
    },
    getAttributes() {
      return options.attrs || {};
    },
    getClasses() {
      return [];
    },
    getStyle() {
      return {};
    },
    parent() {
      return options.parent ?? null;
    },
    components() {
      return { models: [] };
    },
    getId() {
      return 'cmp-1';
    }
  };
}

describe('componentInspector', () => {
  it('detects merge field by data attribute', () => {
    const component = mockComponent({
      tagName: 'span',
      attrs: { 'data-merge-field': 'true' }
    });
    const ctx = resolveInspectorContext(component as unknown as Component);
    expect(ctx?.kind).toBe('merge-field');
  });

  it('detects totals on ancestor', () => {
    const totals = mockComponent({
      attrs: { 'data-totals': 'true' }
    });
    const child = mockComponent({
      tagName: 'span',
      parent: totals
    });
    const ctx = resolveInspectorContext(child as unknown as Component);
    expect(ctx?.kind).toBe('totals');
    expect(ctx?.target).toBe(totals);
  });

  it('hides typography for QR codes', () => {
    expect(inspectorShowsTypography('qr-code')).toBe(false);
    expect(inspectorShowsLayout('qr-code')).toBe(false);
    expect(inspectorShowsAppearance('qr-code')).toBe(true);
  });

  it('shows layout for containers', () => {
    expect(inspectorShowsLayout('container')).toBe(true);
    expect(inspectorShowsTypography('container')).toBe(false);
  });
});
