import { describe, expect, it } from 'vitest';
import {
  canEditForm,
  canHardDeleteForm,
  canMakeCosmeticChanges,
  canModifyStructure,
  getStatusInfo,
  hasSubmittedFormResponses,
  isFormLocked
} from '@/utils/formEditPermissions';

describe('formEditPermissions engagement lifecycle', () => {
  it('locks surveys after publish (Active) except cosmetic edits', () => {
    expect(canEditForm('Active', 'Survey')).toBe(false);
    expect(canModifyStructure('Active', 'Survey')).toBe(false);
    expect(canMakeCosmeticChanges('Active', 'Survey')).toBe(true);
    expect(isFormLocked('Active', 'Survey')).toBe(true);
  });

  it('locks legacy Ready engagement forms', () => {
    expect(canEditForm('Ready', 'Survey')).toBe(false);
    expect(canModifyStructure('Ready', 'Survey')).toBe(false);
    expect(canMakeCosmeticChanges('Ready', 'Survey')).toBe(true);
  });

  it('allows full edit for Draft engagement forms', () => {
    expect(canEditForm('Draft', 'Survey')).toBe(true);
    expect(canModifyStructure('Draft', 'Feedback')).toBe(true);
  });

  it('keeps audit Ready editable until Active', () => {
    expect(canEditForm('Ready', 'Audit')).toBe(true);
    expect(canModifyStructure('Ready', 'Audit')).toBe(true);
    expect(canEditForm('Active', 'Audit')).toBe(false);
    expect(canMakeCosmeticChanges('Active', 'Audit')).toBe(true);
  });

  it('shows Live label for published engagement forms', () => {
    const info = getStatusInfo('Active', 'Survey');
    expect(info.label).toBeTruthy();
  });

  it('blocks hard delete when form has submitted responses', () => {
    expect(canHardDeleteForm({ status: 'Draft' })).toBe(true);
    expect(canHardDeleteForm({ status: 'Draft', lastSubmission: '2026-01-01T00:00:00.000Z' })).toBe(false);
    expect(canHardDeleteForm({ status: 'Active', lastSubmission: null })).toBe(true);
    expect(hasSubmittedFormResponses(null)).toBe(false);
    expect(hasSubmittedFormResponses({}, { overview: { totalResponses: 2 } })).toBe(true);
  });
});
