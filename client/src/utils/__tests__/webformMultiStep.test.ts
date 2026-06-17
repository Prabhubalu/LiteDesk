import { describe, expect, it } from 'vitest';
import {
  defaultWebformStep,
  fieldsOnStep,
  filterVisibleFieldsForStep,
  isMultiStepEnabled,
  orderedWebformSteps,
  sanitizeFieldStepId
} from '@/utils/webformMultiStep';

const webform = {
  multiStep: { enabled: true, showProgress: true },
  steps: [
    { stepId: 'step_1', title: 'Contact', order: 0 },
    { stepId: 'step_2', title: 'Details', order: 1 }
  ],
  fields: [
    { fieldId: 'email', label: 'Email', type: 'Email', stepId: 'step_1', order: 0 },
    { fieldId: 'phone', label: 'Phone', type: 'Phone', stepId: 'step_2', order: 1 }
  ]
};

describe('webformMultiStep', () => {
  it('detects enabled multi-step forms', () => {
    expect(isMultiStepEnabled(webform)).toBe(true);
    expect(isMultiStepEnabled({ multiStep: { enabled: false }, steps: [] })).toBe(false);
  });

  it('orders steps and resolves field step ids', () => {
    expect(orderedWebformSteps(webform).map((step) => step.stepId)).toEqual(['step_1', 'step_2']);
    expect(sanitizeFieldStepId('', webform)).toBe('step_1');
    expect(sanitizeFieldStepId('step_2', webform)).toBe('step_2');
  });

  it('groups fields by step', () => {
    const fields = webform.fields;
    expect(fieldsOnStep(fields, webform, 'step_1').map((field) => field.fieldId)).toEqual(['email']);
    expect(fieldsOnStep(fields, webform, 'step_2').map((field) => field.fieldId)).toEqual(['phone']);
  });

  it('filters visible fields within a step', () => {
    const fields = [
      ...webform.fields,
      {
        fieldId: 'company',
        label: 'Company',
        type: 'Text',
        stepId: 'step_2',
        order: 2,
        visibility: {
          enabled: true,
          match: 'all',
          conditions: [{ fieldId: 'email', operator: 'is_not_empty', value: '' }]
        }
      }
    ];
    expect(filterVisibleFieldsForStep(fields, webform, 'step_2', { email: '' }).map((f) => f.fieldId))
      .toEqual(['phone']);
    expect(filterVisibleFieldsForStep(fields, webform, 'step_2', { email: 'a@b.com' }).map((f) => f.fieldId))
      .toEqual(['phone', 'company']);
  });

  it('creates default step shape', () => {
    expect(defaultWebformStep(1)).toMatchObject({ stepId: 'step_2', title: 'Step 2', order: 1 });
  });
});
