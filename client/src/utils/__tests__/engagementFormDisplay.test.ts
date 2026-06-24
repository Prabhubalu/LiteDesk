import { describe, expect, it } from 'vitest';
import {
  canShowFormResponses,
  collapseSurveyDefaultWrapper,
  flattenFeedbackFormStructure,
  isAuditFormType,
  isDefaultEngagementSubsectionName,
  isDefaultEngagementWrapperSectionName,
  buildEngagementResponseNavigation,
  shouldShowEngagementSubsectionTitle
} from '@/utils/engagementFormDisplay';

describe('engagementFormDisplay collapseSurveyDefaultWrapper', () => {
  it('recognizes default wrapper section and subsection names', () => {
    expect(isDefaultEngagementWrapperSectionName('', 'Reddy Survey')).toBe(true);
    expect(isDefaultEngagementWrapperSectionName('Reddy Survey', 'Reddy Survey')).toBe(true);
    expect(isDefaultEngagementWrapperSectionName('Part 2', 'Reddy Survey')).toBe(false);
    expect(isDefaultEngagementSubsectionName('')).toBe(true);
    expect(isDefaultEngagementSubsectionName('Subsection 1')).toBe(true);
    expect(isDefaultEngagementSubsectionName('Details')).toBe(false);
  });

  it('collapses a single publish wrapper back into root flat storage', () => {
    const formData = {
      formType: 'Survey',
      name: 'Reddy Survey',
      sections: [{
        sectionId: 'SEC-saved',
        name: 'Reddy Survey',
        subsections: [{
          subsectionId: 'SUB-saved',
          name: 'Subsection 1',
          questions: [{ questionId: 'Q-1', questionText: 'Rate us', type: 'Rating' }]
        }],
        questions: []
      }]
    };

    const collapsed = collapseSurveyDefaultWrapper(formData, {
      generateId: (prefix: string) => `${prefix}-test`
    });

    expect(collapsed).toBe(true);
    expect(formData.sections).toHaveLength(1);
    expect(formData.sections[0]._isRootSection).toBe(true);
    expect(formData.sections[0].subsections[0].questions).toHaveLength(1);
    expect(formData.sections[0].subsections[0].questions[0].questionId).toBe('Q-1');
  });

  it('does not collapse when multiple visible sections exist', () => {
    const formData = {
      formType: 'Survey',
      name: 'Reddy Survey',
      sections: [
        { sectionId: 'SEC-1', name: 'Reddy Survey', subsections: [{ questions: [] }], questions: [] },
        { sectionId: 'SEC-2', name: 'Part 2', subsections: [{ questions: [] }], questions: [] }
      ]
    };

    expect(collapseSurveyDefaultWrapper(formData)).toBe(false);
    expect(formData.sections).toHaveLength(2);
  });

  it('flattens feedback forms with visible sections into root storage', () => {
    const formData = {
      formType: 'Feedback',
      name: 'Product Feedback',
      sections: [
        {
          sectionId: 'SEC-root',
          name: '',
          _isRootSection: true,
          subsections: [{ subsectionId: 'SUB-root', name: '', questions: [] }],
          questions: []
        },
        {
          sectionId: 'SEC-visible',
          name: 'Product Feedback',
          subsections: [{
            subsectionId: 'SUB-visible',
            name: 'Subsection 1',
            questions: [
              { questionId: 'Q-1', questionText: 'Rate us', type: 'Rating' },
              { questionId: 'Q-2', questionText: 'Comments', type: 'Textarea' }
            ]
          }],
          questions: []
        }
      ]
    };

    const flattened = flattenFeedbackFormStructure(formData, {
      generateId: (prefix: string) => `${prefix}-test`
    });

    expect(flattened).toBe(true);
    expect(formData.sections).toHaveLength(1);
    expect(formData.sections[0]._isRootSection).toBe(true);
    expect(formData.sections[0].subsections[0].questions).toHaveLength(2);
    expect(formData.sections[0].subsections[0].questions[0].questionId).toBe('Q-1');
  });
});

describe('engagementFormDisplay form type helpers', () => {
  it('detects audit vs engagement form types', () => {
    expect(isAuditFormType('Audit')).toBe(true);
    expect(isAuditFormType('audit')).toBe(true);
    expect(isAuditFormType('Survey')).toBe(false);
    expect(isAuditFormType('Feedback')).toBe(false);
  });

  it('shows responses for Active forms and Ready engagement forms', () => {
    expect(canShowFormResponses({ status: 'Active', formType: 'Audit' })).toBe(true);
    expect(canShowFormResponses({ status: 'Ready', formType: 'Survey' })).toBe(true);
    expect(canShowFormResponses({ status: 'Ready', formType: 'Feedback' })).toBe(true);
    expect(canShowFormResponses({ status: 'Ready', formType: 'Audit' })).toBe(false);
    expect(canShowFormResponses({ status: 'Draft', formType: 'Survey' })).toBe(false);
  });

  it('builds navigation only for meaningful engagement sections', () => {
    const flatForm = {
      formType: 'Feedback',
      name: 'Product Feedback',
      sections: [{
        sectionId: 'SEC-root',
        name: '',
        _isRootSection: true,
        subsections: [{
          subsectionId: 'SUB-root',
          name: '',
          questions: [
            { questionId: 'Q-1', questionText: 'Rate us' },
            { questionId: 'Q-2', questionText: 'Comments' }
          ]
        }],
        questions: []
      }]
    };

    expect(buildEngagementResponseNavigation(flatForm)).toHaveLength(0);

    const sectionedForm = {
      formType: 'Survey',
      name: 'Customer Survey',
      sections: [
        {
          sectionId: 'SEC-1',
          name: 'Experience',
          subsections: [{
            subsectionId: 'SUB-1',
            name: 'Service',
            questions: [{ questionId: 'Q-1', questionText: 'Rate service' }]
          }],
          questions: []
        },
        {
          sectionId: 'SEC-2',
          name: 'Product',
          subsections: [{
            subsectionId: 'SUB-2',
            name: 'Quality',
            questions: [{ questionId: 'Q-2', questionText: 'Rate product' }]
          }],
          questions: []
        }
      ]
    };

    const nav = buildEngagementResponseNavigation(sectionedForm);
    expect(nav).toHaveLength(2);
    expect(nav[0].label).toBe('Experience');
    expect(nav[1].label).toBe('Product');
  });

  it('hides default subsection names like Subsection 1', () => {
    const form = { formType: 'Survey', name: 'Reddy Survey' };
    const section = { sectionId: 'SEC-1', name: 'Part 2' };
    const defaultSub = { subsectionId: 'SUB-1', name: 'Subsection 1' };
    const namedSub = { subsectionId: 'SUB-2', name: 'Service quality' };

    expect(shouldShowEngagementSubsectionTitle(form, section, defaultSub)).toBe(false);
    expect(shouldShowEngagementSubsectionTitle(form, section, namedSub)).toBe(true);
  });
});
