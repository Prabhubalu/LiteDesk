'use strict';

const FormResponse = require('../models/FormResponse');

const CHOICE_TYPES = new Set(['Dropdown', 'Yes-No']);
const TEXT_TYPES = new Set(['Text', 'Textarea', 'Number']);
const MEDIA_TYPES = new Set(['File', 'Signature']);
const RATING_TYPE = 'Rating';

function isEngagementFormType(formType) {
    const normalized = String(formType || '').toLowerCase();
    return normalized === 'survey' || normalized === 'feedback';
}

function getVisibleFormSections(sections) {
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

function forEachFormQuestion(sections, callback) {
    getVisibleFormSections(sections).forEach((section, sectionIndex) => {
        (section.questions || []).forEach((question, questionIndex) => {
            if (question?.questionId) {
                callback(question, section, null, sectionIndex, questionIndex);
            }
        });
        (section.subsections || []).forEach((subsection, subsectionIndex) => {
            (subsection.questions || []).forEach((question, questionIndex) => {
                if (question?.questionId) {
                    callback(question, section, subsection, sectionIndex, subsectionIndex, questionIndex);
                }
            });
        });
    });
}

function isAnswerEmpty(answer, attachments) {
    if (Array.isArray(attachments) && attachments.length > 0) return false;
    if (answer === null || answer === undefined) return true;
    if (typeof answer === 'string' && answer.trim() === '') return true;
    if (Array.isArray(answer) && answer.length === 0) return true;
    return false;
}

function normalizeYesNo(value) {
    if (value === true || value === 1) return 'Yes';
    if (value === false || value === 0) return 'No';
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'yes' || normalized === 'y' || normalized === 'true') return 'Yes';
    if (normalized === 'no' || normalized === 'n' || normalized === 'false') return 'No';
    return null;
}

function normalizeRating(value) {
    const rating = Number(value);
    if (!Number.isFinite(rating)) return null;
    const rounded = Math.round(rating);
    if (rounded < 1 || rounded > 5) return null;
    return rounded;
}

function normalizeChoiceLabel(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(', ');
    return String(value).trim();
}

function buildAnswerIndex(responses) {
    const index = new Map();

    for (const response of responses) {
        const submittedAt = response.submittedAt || null;
        for (const detail of response.responseDetails || []) {
            if (!detail?.questionId) continue;
            const bucket = index.get(detail.questionId) || [];
            bucket.push({
                answer: detail.answer,
                attachments: detail.attachments || [],
                submittedAt
            });
            index.set(detail.questionId, bucket);
        }
    }

    return index;
}

function aggregateChoice(question, answers) {
    const type = question.type;
    const optionLabels = type === 'Yes-No'
        ? ['Yes', 'No']
        : (Array.isArray(question.options) ? question.options.filter(Boolean) : []);

    const counts = new Map();
    for (const label of optionLabels) {
        counts.set(label, 0);
    }

    let answeredCount = 0;
    let otherCount = 0;

    for (const entry of answers) {
        if (isAnswerEmpty(entry.answer, entry.attachments)) continue;

        answeredCount += 1;
        let label = null;

        if (type === 'Yes-No') {
            label = normalizeYesNo(entry.answer);
        } else {
            label = normalizeChoiceLabel(entry.answer);
        }

        if (!label) continue;

        if (counts.has(label)) {
            counts.set(label, counts.get(label) + 1);
        } else {
            otherCount += 1;
        }
    }

    const options = optionLabels.map((label) => ({
        label,
        count: counts.get(label) || 0
    }));

    if (otherCount > 0) {
        options.push({ label: '__other__', count: otherCount });
    }

    return {
        kind: 'choice',
        options: applyPercentages(options, answeredCount)
    };
}

function aggregateRating(_question, answers) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let answeredCount = 0;
    let totalRating = 0;

    for (const entry of answers) {
        if (isAnswerEmpty(entry.answer, entry.attachments)) continue;
        const rating = normalizeRating(entry.answer);
        if (rating === null) continue;

        answeredCount += 1;
        totalRating += rating;
        distribution[rating] += 1;
    }

    const average = answeredCount > 0 ? Math.round((totalRating / answeredCount) * 10) / 10 : null;

    return {
        kind: 'rating',
        average,
        distribution: [1, 2, 3, 4, 5].map((star) => ({
            star,
            count: distribution[star] || 0,
            percentage: answeredCount > 0
                ? Math.round((distribution[star] / answeredCount) * 1000) / 10
                : 0
        }))
    };
}

function aggregateText(_question, answers, textPreviewLimit) {
    const responses = [];

    for (const entry of answers) {
        if (isAnswerEmpty(entry.answer, entry.attachments)) continue;
        const text = normalizeChoiceLabel(entry.answer);
        if (!text) continue;
        responses.push({
            text,
            submittedAt: entry.submittedAt
        });
    }

    return {
        kind: 'text',
        totalTextResponses: responses.length,
        preview: responses.slice(0, textPreviewLimit),
        hasMore: responses.length > textPreviewLimit
    };
}

function aggregateMedia(_question, answers) {
    let answeredCount = 0;

    for (const entry of answers) {
        if (isAnswerEmpty(entry.answer, entry.attachments)) continue;
        answeredCount += 1;
    }

    return {
        kind: 'media',
        uploadedCount: answeredCount
    };
}

function applyPercentages(options, total) {
    return options.map((option) => ({
        ...option,
        percentage: total > 0 ? Math.round((option.count / total) * 1000) / 10 : 0
    }));
}

function buildQuestionSummary(question, answers, totalResponses, textPreviewLimit) {
    const answeredCount = answers.filter((entry) => !isAnswerEmpty(entry.answer, entry.attachments)).length;
    const skippedCount = Math.max(totalResponses - answeredCount, 0);
    const responseRate = totalResponses > 0
        ? Math.round((answeredCount / totalResponses) * 1000) / 10
        : 0;

    let summary;
    if (question.type === RATING_TYPE) {
        summary = aggregateRating(question, answers);
    } else if (CHOICE_TYPES.has(question.type)) {
        summary = aggregateChoice(question, answers);
    } else if (TEXT_TYPES.has(question.type)) {
        summary = aggregateText(question, answers, textPreviewLimit);
    } else if (MEDIA_TYPES.has(question.type)) {
        summary = aggregateMedia(question, answers);
    } else {
        summary = aggregateText(question, answers, textPreviewLimit);
    }

    return {
        questionId: question.questionId,
        questionText: question.questionText,
        type: question.type,
        mandatory: Boolean(question.mandatory),
        totalResponses,
        answeredCount,
        skippedCount,
        responseRate,
        summary
    };
}

function buildOverview(form, responses, questionCount) {
    const totalResponses = responses.length;

    if (totalResponses === 0) {
        return {
            totalResponses: 0,
            totalQuestions: questionCount,
            avgAnsweredPerResponse: 0,
            completionRate: 0,
            avgRating: null,
            satisfactionPercentage: null
        };
    }

    let totalAnswered = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    let satisfactionSum = 0;
    let satisfactionCount = 0;

    for (const response of responses) {
        const answered = (response.responseDetails || []).filter(
            (detail) => !isAnswerEmpty(detail.answer, detail.attachments)
        ).length;
        totalAnswered += answered;

        const rating = Number(response.kpis?.rating);
        if (Number.isFinite(rating) && rating > 0) {
            ratingSum += rating;
            ratingCount += 1;
        }

        const satisfaction = Number(response.kpis?.satisfactionPercentage);
        if (Number.isFinite(satisfaction)) {
            satisfactionSum += satisfaction;
            satisfactionCount += 1;
        }
    }

    const avgAnsweredPerResponse = totalResponses > 0
        ? Math.round((totalAnswered / totalResponses) * 10) / 10
        : 0;

    return {
        totalResponses,
        totalQuestions: questionCount,
        avgAnsweredPerResponse,
        completionRate: questionCount > 0
            ? Math.round((totalAnswered / (totalResponses * questionCount)) * 1000) / 10
            : 0,
        avgRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
        satisfactionPercentage: satisfactionCount > 0
            ? Math.round(satisfactionSum / satisfactionCount)
            : null
    };
}

/**
 * Build consolidated per-question response summary for engagement forms.
 *
 * @param {import('mongoose').Document} form
 * @param {import('mongoose').Types.ObjectId} organizationId
 * @param {{ textPreviewLimit?: number }} [options]
 */
async function buildFormResponseSummary(form, organizationId, options = {}) {
    const textPreviewLimit = Math.min(Math.max(parseInt(options.textPreviewLimit, 10) || 5, 1), 50);

    if (!isEngagementFormType(form.formType)) {
        return {
            supported: false,
            overview: buildOverview(form, [], 0),
            sections: []
        };
    }

    const responses = await FormResponse.find({
        formId: form._id,
        organizationId,
        executionStatus: 'Submitted',
        archived: { $ne: true },
        invalidated: { $ne: true }
    })
        .select('responseDetails submittedAt kpis')
        .lean();

    const answerIndex = buildAnswerIndex(responses);
    const totalResponses = responses.length;

    const sectionMap = new Map();
    let questionCount = 0;

    forEachFormQuestion(form.sections || [], (question, section, subsection) => {
        questionCount += 1;
        const sectionKey = section?.sectionId || section?.name || 'default';
        if (!sectionMap.has(sectionKey)) {
            sectionMap.set(sectionKey, {
                sectionId: section?.sectionId || sectionKey,
                sectionName: String(section?.name || '').trim(),
                subsections: new Map()
            });
        }

        const sectionEntry = sectionMap.get(sectionKey);
        const subsectionKey = subsection?.subsectionId || subsection?.name || '__root__';
        if (!sectionEntry.subsections.has(subsectionKey)) {
            sectionEntry.subsections.set(subsectionKey, {
                subsectionId: subsection?.subsectionId || null,
                subsectionName: subsection ? String(subsection.name || '').trim() : '',
                questions: []
            });
        }

        const answers = answerIndex.get(question.questionId) || [];
        sectionEntry.subsections.get(subsectionKey).questions.push(
            buildQuestionSummary(question, answers, totalResponses, textPreviewLimit)
        );
    });

    const sections = Array.from(sectionMap.values()).map((section) => ({
        sectionId: section.sectionId,
        sectionName: section.sectionName,
        subsections: Array.from(section.subsections.values())
    }));

    return {
        supported: true,
        formType: form.formType,
        overview: buildOverview(form, responses, questionCount),
        sections
    };
}

module.exports = {
    isEngagementFormType,
    buildFormResponseSummary,
    getVisibleFormSections,
    forEachFormQuestion
};
