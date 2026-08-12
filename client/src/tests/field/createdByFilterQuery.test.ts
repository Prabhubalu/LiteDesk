import { describe, expect, it } from 'vitest';
import { createDefaultRootGroup } from '@/platform/filters/filterQueryAst';
import { compileFilterQueryAst } from '@/platform/filters/filterQueryAstCompiler';
import type { FilterConfig } from '@/platform/filters/filterResolver';

describe('compileFilterQueryAst createdBy', () => {
  const createdByFilter: FilterConfig = {
    key: 'createdBy',
    label: 'Created By',
    filterType: 'user',
    fieldPath: 'createdBy',
    priority: 1,
  };
  const assignedToFilter: FilterConfig = {
    key: 'assignedTo',
    label: 'Assigned To',
    filterType: 'user',
    fieldPath: 'assignedTo',
    priority: 1,
  };

  it('emits filterQuery for createdBy is <user> (not flat-only)', () => {
    const root = createDefaultRootGroup();
    root.children = [{ kind: 'rule', id: 'r1', fieldKey: 'createdBy' }];
    const { flat, filterQuery } = compileFilterQueryAst(
      root,
      { createdBy: '507f1f77bcf86cd799439011' },
      { createdBy: 'is' },
      { createdBy: createdByFilter }
    );
    expect(flat.createdBy).toBe('507f1f77bcf86cd799439011');
    expect(filterQuery).toEqual({
      logic: 'AND',
      children: [
        {
          fieldKey: 'createdBy',
          operator: 'is',
          value: '507f1f77bcf86cd799439011',
        },
      ],
    });
  });

  it('keeps assignedTo as flat-only for operator is', () => {
    const root = createDefaultRootGroup();
    root.children = [{ kind: 'rule', id: 'r1', fieldKey: 'assignedTo' }];
    const { flat, filterQuery } = compileFilterQueryAst(
      root,
      { assignedTo: 'me' },
      { assignedTo: 'is' },
      { assignedTo: assignedToFilter }
    );
    expect(flat.assignedTo).toBe('me');
    expect(filterQuery).toBeNull();
  });
});
