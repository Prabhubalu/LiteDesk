import { normalizeDateTimeInput, parseDateTimeLocal } from '@/utils/datePickerUtils';

/** API / stored value → datetime-local string for DateTimePicker. */
export function normalizeEngagementExpiryForInput(value) {
  const normalized = normalizeDateTimeInput(value);
  return normalized || null;
}

/** datetime-local string → ISO instant for API. */
export function serializeEngagementExpiryForApi(value) {
  if (!value) return null;
  const parsed = parseDateTimeLocal(value);
  if (!parsed) return null;
  return parsed.toISOString();
}

export function isEngagementFormType(formType) {
  const normalized = String(formType || '').toLowerCase();
  return normalized === 'survey' || normalized === 'feedback';
}

/** Whether a form record page should load and show response data. */
export function canShowFormResponses(form) {
  if (!form) return false;
  const status = String(form.status || '');
  if (status === 'Active') return true;
  return status === 'Ready' && isEngagementFormType(form.formType);
}

export function isAuditFormType(formType) {
  return String(formType || '').toLowerCase() === 'audit';
}

/** Section/subsection anchors for engagement response detail navigation. */
export function buildEngagementResponseNavigation(form) {
  const items = [];
  if (!form?.sections) return items;

  getVisibleFormSections(form.sections).forEach((section, sIndex) => {
    const sectionId = `section-${section.sectionId || sIndex}`;
    const showSectionTitle = shouldShowEngagementSectionTitle(form, section);
    const subsections = (section.subsections || []).filter((subsection) => {
      const hasQuestions = (subsection.questions || []).length > 0;
      return hasQuestions && shouldShowEngagementSubsectionTitle(form, section, subsection);
    });

    if (showSectionTitle || subsections.length > 0) {
      const item = {
        id: sectionId,
        label: section.name,
        type: 'section',
        subsections: subsections.map((subsection, subIndex) => ({
          id: `subsection-${subsection.subsectionId || subIndex}`,
          label: subsection.name,
          type: 'subsection'
        }))
      };
      items.push(item);
    }
  });

  return items.filter((item) => item.label || item.subsections?.length);
}

/** Sections shown on public/preview surfaces (excludes empty builder root wrapper). */
export function getVisibleFormSections(sections) {
  if (!Array.isArray(sections)) return [];

  const nonRootSections = sections.filter((section) => !section._isRootSection);
  if (nonRootSections.length > 0) {
    return nonRootSections;
  }

  const rootSection = sections.find((section) => section._isRootSection);
  if (!rootSection) return [];

  const hasRootQuestions =
    (rootSection.questions || []).length > 0 ||
    (rootSection.subsections || []).some((sub) => (sub.questions || []).length > 0);

  return hasRootQuestions ? [rootSection] : [];
}

export function forEachFormQuestion(sections, callback) {
  getVisibleFormSections(sections).forEach((section) => {
    (section.questions || []).forEach((question) => {
      if (question?.questionId) {
        callback(question, section, null);
      }
    });
    (section.subsections || []).forEach((subsection) => {
      (subsection.questions || []).forEach((question) => {
        if (question?.questionId) {
          callback(question, section, subsection);
        }
      });
    });
  });
}

export function shouldShowEngagementSectionTitle(form, section) {
  const title = String(section?.name || '').trim();
  if (!title) return false;
  if (isEngagementFormType(form?.formType) && title === String(form?.name || '').trim()) {
    return false;
  }
  return true;
}

export function shouldShowEngagementSubsectionTitle(form, section, subsection) {
  const title = String(subsection?.name || '').trim();
  if (!title) return false;
  if (isDefaultEngagementSubsectionName(title)) return false;
  if (!shouldShowEngagementSectionTitle(form, section)) {
    return false;
  }
  return true;
}

const DEFAULT_SUBSECTION_NAME_PATTERN = /^Subsection\s+\d+$/i;

export function isDefaultEngagementSubsectionName(name) {
  const trimmed = String(name || '').trim();
  return trimmed === '' || DEFAULT_SUBSECTION_NAME_PATTERN.test(trimmed);
}

export function isDefaultEngagementWrapperSectionName(sectionName, formName) {
  const section = String(sectionName || '').trim();
  const form = String(formName || '').trim();
  if (!section) return true;
  if (form && section === form) return true;
  return false;
}

/**
 * Fold a single publish-time section/subsection wrapper back into flat (_isRootSection) storage.
 * Used when reopening a survey in the builder so the Questions step stays flat.
 *
 * @returns {boolean} true when a wrapper section was collapsed
 */
export function collapseSurveyDefaultWrapper(formData, { generateId } = {}) {
  const formType = String(formData?.formType || '').toLowerCase();
  if (formType !== 'survey' && formType !== 'feedback') return false;

  const sections = formData?.sections;
  if (!Array.isArray(sections)) return false;

  const visibleSections = sections.filter((s) => !s._isRootSection);
  if (visibleSections.length !== 1) return false;

  const wrapperSection = visibleSections[0];
  if (!isDefaultEngagementWrapperSectionName(wrapperSection.name, formData.name)) {
    return false;
  }

  const subsections = Array.isArray(wrapperSection.subsections) ? wrapperSection.subsections : [];
  const sectionLevelQuestions = Array.isArray(wrapperSection.questions)
    ? wrapperSection.questions.filter((q) => q && typeof q === 'object')
    : [];

  if (subsections.length > 1) return false;
  if (subsections.length === 1 && sectionLevelQuestions.length > 0) return false;

  let questionsToMove = [];
  if (subsections.length === 1) {
    const sub = subsections[0];
    if (!isDefaultEngagementSubsectionName(sub.name)) return false;
    questionsToMove = (sub.questions || []).filter((q) => q && typeof q === 'object');
  } else {
    questionsToMove = sectionLevelQuestions;
  }

  const gen = typeof generateId === 'function'
    ? generateId
    : (prefix) => `${prefix}-${Date.now()}`;

  let rootSection = sections.find((s) => s._isRootSection);
  if (!rootSection) {
    rootSection = {
      sectionId: gen('SEC'),
      name: '',
      weightage: 0,
      subsections: [],
      questions: [],
      order: 0,
      _isRootSection: true
    };
    sections.unshift(rootSection);
  }

  if (!rootSection.subsections?.length) {
    rootSection.subsections = [{
      subsectionId: gen('SUB'),
      name: '',
      weightage: 0,
      questions: [],
      order: 0
    }];
  }

  rootSection.subsections[0].questions = questionsToMove.map((q, index) => ({
    ...q,
    order: index
  }));

  const wrapperIndex = sections.findIndex((s) => s === wrapperSection);
  if (wrapperIndex !== -1) {
    sections.splice(wrapperIndex, 1);
  }

  return true;
}

/**
 * Merge all visible section/subsection questions into root flat storage for feedback forms.
 *
 * @returns {boolean} true when visible sections were flattened
 */
export function flattenFeedbackFormStructure(formData, { generateId } = {}) {
  const formType = String(formData?.formType || '').toLowerCase();
  if (formType !== 'feedback') return false;

  const sections = formData?.sections;
  if (!Array.isArray(sections)) return false;

  const visibleSections = sections.filter((s) => !s._isRootSection);
  if (visibleSections.length === 0) return false;

  const gen = typeof generateId === 'function'
    ? generateId
    : (prefix) => `${prefix}-${Date.now()}`;

  const allQuestions = [];
  const rootSection = sections.find((s) => s._isRootSection);
  const rootQuestions = rootSection?.subsections?.[0]?.questions || [];
  allQuestions.push(...rootQuestions.filter((q) => q && typeof q === 'object'));

  const sortedVisible = [...visibleSections].sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const section of sortedVisible) {
    allQuestions.push(...(section.questions || []).filter((q) => q && typeof q === 'object'));
    const sortedSubsections = [...(section.subsections || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const subsection of sortedSubsections) {
      allQuestions.push(...(subsection.questions || []).filter((q) => q && typeof q === 'object'));
    }
  }

  let targetRoot = rootSection;
  if (!targetRoot) {
    targetRoot = {
      sectionId: gen('SEC'),
      name: '',
      weightage: 0,
      subsections: [],
      questions: [],
      order: 0,
      _isRootSection: true
    };
    sections.unshift(targetRoot);
  }

  if (!targetRoot.subsections?.length) {
    targetRoot.subsections = [{
      subsectionId: gen('SUB'),
      name: '',
      weightage: 0,
      questions: [],
      order: 0
    }];
  }

  targetRoot.subsections[0].questions = allQuestions.map((q, index) => ({
    ...q,
    order: index
  }));

  formData.sections = sections.filter((s) => s._isRootSection);
  return true;
}
