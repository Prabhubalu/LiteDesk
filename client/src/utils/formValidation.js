/**
 * Form Validation Utility
 * 
 * Validates form structure to ensure it remains valid, especially for Ready forms.
 * Ready forms must maintain their validity - if an edit would make them invalid,
 * auto-save should be blocked.
 */

/**
 * Validate if a form structure is valid
 * @param {Object} form - Form object to validate
 * @param {boolean} strict - If true, enforce Ready-level validation. If false, allow Draft-level (incomplete) states
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateFormStructure = (form, strict = false) => {
  const errors = [];

  // Basic validation - always required
  if (!form.name || !form.name.trim()) {
    errors.push('Form name is required');
  }

  if (!form.formType) {
    errors.push('Form type is required');
  }

  // For strict validation (Ready forms), check structure
  if (strict) {
    const sections = form.sections || [];
    const formType = (form.formType || '').toLowerCase();
    const isAudit = formType === 'audit';
    const isFlatMode = formType === 'survey' || formType === 'feedback';

    // Check for sections/questions
    if (isAudit) {
      const visibleSections = sections.filter(s => !s._isRootSection);
      if (visibleSections.length === 0) {
        errors.push('Audit forms must have at least one section');
      }

      // Validate scoring requirements for audit forms
      const scorableTypes = ['Yes-No', 'Dropdown', 'Rating', 'Number'];
      const hasScorableQuestion = (question) => {
        return scorableTypes.includes(question.type);
      };

      const hasValidPassCondition = (question) => {
        if (!question.scoring) {
          return false;
        }
        const passCondition = question.scoring.passCondition || {};
        
        if (question.type === 'Yes-No') {
          return passCondition.expectedValue === 'Yes' || passCondition.expectedValue === 'No';
        } else if (question.type === 'Dropdown') {
          return Array.isArray(passCondition.passOptions) && passCondition.passOptions.length > 0;
        } else if (question.type === 'Rating') {
          return typeof passCondition.minRating === 'number' && passCondition.minRating >= 1;
        } else if (question.type === 'Number') {
          if (passCondition.rule === 'between') {
            return typeof passCondition.minValue === 'number' && typeof passCondition.maxValue === 'number';
          } else {
            return typeof passCondition.value === 'number';
          }
        }
        return false;
      };

      // Check that each section has at least one scorable question
      for (const section of visibleSections) {
        let sectionHasScorableQuestion = false;
        
        // Check section-level questions
        const sectionQuestions = section.questions || [];
        for (const question of sectionQuestions) {
          if (hasScorableQuestion(question)) {
            sectionHasScorableQuestion = true;
            
            if (!hasValidPassCondition(question)) {
              errors.push(`Question "${question.questionText || 'Untitled'}" in section "${section.name || 'Untitled'}" has invalid scoring configuration`);
            }
            
            if (!question.scoring || !question.scoring.weight || question.scoring.weight < 1) {
              errors.push(`Question "${question.questionText || 'Untitled'}" in section "${section.name || 'Untitled'}" must have a weight of at least 1`);
            }
          }
        }
        
        // Check subsection-level questions
        const subsections = section.subsections || [];
        for (const subsection of subsections) {
          const subsectionQuestions = subsection.questions || [];
          for (const question of subsectionQuestions) {
            if (hasScorableQuestion(question)) {
              sectionHasScorableQuestion = true;
              
              if (!hasValidPassCondition(question)) {
                errors.push(`Question "${question.questionText || 'Untitled'}" in subsection "${subsection.name || 'Untitled'}" has invalid scoring configuration`);
              }
              
              if (!question.scoring || !question.scoring.weight || question.scoring.weight < 1) {
                errors.push(`Question "${question.questionText || 'Untitled'}" in subsection "${subsection.name || 'Untitled'}" must have a weight of at least 1`);
              }
            }
          }
        }
        
        if (!sectionHasScorableQuestion) {
          errors.push(`Section "${section.name || 'Untitled'}" must have at least one scorable question`);
        }
      }
    }

    // For flat mode: check for root questions (feedback) or root questions / sections (survey)
    if (isFlatMode) {
      const isFeedback = formType === 'feedback';
      let hasRootQuestions = false;
      const rootSection = sections.find(s => s._isRootSection);
      if (rootSection && rootSection.subsections && rootSection.subsections.length > 0) {
        const rootQuestions = rootSection.subsections[0].questions || [];
        hasRootQuestions = rootQuestions.some(q => q?.questionText?.trim());
      }

      if (isFeedback) {
        if (!hasRootQuestions) {
          errors.push('Feedback forms must have at least one question');
        }
      } else {
        const visibleSectionsForFlat = sections.filter(s => !s._isRootSection);
        const hasVisibleSections = visibleSectionsForFlat.length > 0;

        if (!hasRootQuestions && !hasVisibleSections) {
          errors.push('Survey forms must have at least one question or section');
        }
      }
    }

    // Validate all questions have text
    for (const section of sections) {
      const sectionQuestions = section.questions || [];
      for (const question of sectionQuestions) {
        if (!question.questionText || typeof question.questionText !== 'string' || question.questionText.trim().length === 0) {
          errors.push('All questions must have question text');
          break; // Only report once
        }
        
        if (question.type === 'Dropdown') {
          const options = Array.isArray(question.options) ? question.options : [];
          const hasValidOption = options.some(opt => opt && typeof opt === 'string' && opt.trim().length > 0);
          if (!hasValidOption) {
            errors.push(`Dropdown question "${question.questionText || 'Untitled'}" must have at least one option`);
          }
        }
      }
      
      const subsections = section.subsections || [];
      for (const subsection of subsections) {
        const questions = subsection.questions || [];
        for (const question of questions) {
          if (!question.questionText || typeof question.questionText !== 'string' || question.questionText.trim().length === 0) {
            errors.push('All questions must have question text');
            break;
          }
          
          if (question.type === 'Dropdown') {
            const options = Array.isArray(question.options) ? question.options : [];
            const hasValidOption = options.some(opt => opt && typeof opt === 'string' && opt.trim().length > 0);
            if (!hasValidOption) {
              errors.push(`Dropdown question "${question.questionText || 'Untitled'}" must have at least one option`);
            }
          }
        }
      }
    }

    // Validate outcomes & rules for audit forms
    if (isAudit) {
      const outcomes = form.outcomesAndRules || {};
      if (!outcomes.auditResultRule) {
        errors.push('Audit forms must have an audit result rule configured');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Check if a Ready form would remain valid after an edit
 * @param {Object} form - Form object to validate
 * @returns {boolean}
 */
export const isReadyFormValid = (form) => {
  const validation = validateFormStructure(form, true);
  return validation.valid;
};

