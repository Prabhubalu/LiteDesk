const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const FormKPIs = require('../models/FormKPIs');
const Event = require('../models/Event');
const User = require('../models/User');
const Organization = require('../models/Organization');
const mongoose = require('mongoose');
const { applyProjectionFilter } = require('../utils/appProjectionQuery');
const { getProjection } = require('../utils/moduleProjectionResolver');
const { resolveCreateType, getTypeFieldName } = require('../utils/appProjectionCreateResolver');
const { sanitizeWebformBranding } = require('../constants/webformBranding');
const {
    isEngagementFormType,
    normalizeEngagementPublishStatus,
    isFormStructurallyLocked,
    isEngagementFormExpired,
    normalizeEngagementExpiryDate,
    FORM_HAS_SUBMITTED_RESPONSES,
    countSubmittedFormResponses
} = require('../utils/engagementFormLifecycle');

function applyFormBrandingToPayload(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (payload.branding !== undefined) {
        payload.branding = sanitizeWebformBranding(payload.branding);
    }
}

// Helper function to clean responseTemplate.activeTemplateId
// Converts string "default" to null since schema expects ObjectId or null
const cleanResponseTemplateActiveId = (payload) => {
    if (payload.responseTemplate?.activeTemplateId === 'default') {
        payload.responseTemplate.activeTemplateId = null;
    }
    return payload;
};

function slugifyFormName(name) {
    let baseSlug = String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);

    return baseSlug;
}

async function generateUniqueFormPublicSlug({ formName, formId, organizationId, excludeFormId }) {
    let baseSlug = slugifyFormName(formName);
    if (!baseSlug) {
        const idPart = formId ? String(formId).substring(0, 8) : 'unknown';
        baseSlug = `form-${idPart}`;
    }

    let slug = baseSlug;
    let counter = 1;
    let existingForm = await Form.findOne({
        'publicLink.slug': slug,
        _id: { $ne: excludeFormId },
        organizationId
    });

    while (existingForm) {
        slug = `${baseSlug}-${counter}`;
        existingForm = await Form.findOne({
            'publicLink.slug': slug,
            _id: { $ne: excludeFormId },
            organizationId
        });
        counter += 1;
        if (counter > 100) {
            slug = `${baseSlug}-${Date.now()}`;
            break;
        }
    }

    return slug;
}

async function resolvePublicLinkPayload({
    publicLink,
    formName,
    formId,
    organizationId,
    excludeFormId,
    visibility,
    formType,
    status
}) {
    const isEngagement = ['survey', 'feedback'].includes(String(formType || '').toLowerCase());
    const publishReady = ['Ready', 'Active'].includes(String(status || ''));
    const explicitlyEnabled = publicLink?.enabled === true;
    const shouldEnable = explicitlyEnabled
        || (isEngagement && visibility === 'Public' && publishReady);

    if (!shouldEnable) {
        return explicitlyEnabled === false ? { enabled: false } : null;
    }

    let slug = String(publicLink?.slug || '').trim().toLowerCase();
    if (!slug) {
        slug = await generateUniqueFormPublicSlug({
            formName,
            formId,
            organizationId,
            excludeFormId
        });
    }

    return { enabled: true, slug };
}

async function applyPublicLinkToPayload(payload, { organizationId, excludeFormId } = {}) {
    if (!payload || typeof payload !== 'object') return;

    const resolved = await resolvePublicLinkPayload({
        publicLink: payload.publicLink,
        formName: payload.name,
        formId: payload._id || payload.formId,
        organizationId,
        excludeFormId,
        visibility: payload.visibility,
        formType: payload.formType,
        status: payload.status
    });

    if (resolved) {
        payload.publicLink = resolved;
        return;
    }

    if (payload.publicLink) {
        if (!payload.publicLink.enabled || !payload.publicLink.slug || payload.publicLink.slug.trim() === '') {
            delete payload.publicLink.slug;
        }
    }
}

// @desc    Create new form
// @route   POST /api/forms
// @access  Private
exports.createForm = async (req, res) => {
    try {
        // Phase 2A.3: Projection-aware create type resolution
        // SAFETY: Projection-aware create logic — non-blocking fallback
        const appKey = req.appKey || 'SALES'; // From resolveAppContext middleware
        const moduleKey = 'forms';
        const typeFieldName = getTypeFieldName(moduleKey);
        
        if (typeFieldName) {
            const explicitType = req.body.hasOwnProperty(typeFieldName) ? req.body[typeFieldName] : null;
            const resolved = resolveCreateType({
                appKey,
                moduleKey,
                explicitType: explicitType,
                fallbackType: null // Model will use its default if needed
            });

            if (resolved.allowed === false) {
                return res.status(400).json({
                    success: false,
                    message: resolved.message || 'This form type is not allowed in this app.',
                    code: resolved.reason
                });
            }

            // Set resolved type in body (applies default if no explicit type provided)
            if (resolved.type !== null && resolved.type !== undefined) {
                req.body[typeFieldName] = resolved.type;
            }
        }

        const payload = {
            ...req.body,
            organizationId: req.user.organizationId,
            createdBy: req.user._id,
            modifiedBy: req.user._id
        };

        // Clean up responseTemplate.activeTemplateId - convert "default" string to null
        cleanResponseTemplateActiveId(payload);

        await applyPublicLinkToPayload(payload, {
            organizationId: req.user.organizationId
        });
        applyFormBrandingToPayload(payload);

        if (Object.prototype.hasOwnProperty.call(payload, 'expiryDate')) {
            payload.expiryDate = normalizeEngagementExpiryDate(payload.expiryDate);
        }

        // Never accept client-supplied formId on create — server assigns it
        delete payload.formId;

        payload.status = normalizeEngagementPublishStatus(payload.status, payload.formType);

        // Draft forms can be saved without validation (incomplete state is allowed)
        // Only validate if form is being set to Ready or Active
        const form = new Form(payload);
        if (payload.status === 'Ready' || payload.status === 'Active') {
            // Debug logging in development
            if (process.env.NODE_ENV === 'development') {
                console.log('Validating form structure:', {
                    status: payload.status,
                    sectionsCount: payload.sections?.length || 0,
                    sections: payload.sections?.map(s => ({
                        name: s.name,
                        questionsCount: s.questions?.length || 0,
                        subsectionsCount: s.subsections?.length || 0
                    }))
                });
            }
            const validation = form.validateStructure();
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.error
                });
            }
        }
        // Draft forms: no validation required (allow incomplete/invalid states)

        let newForm;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                newForm = await Form.create(payload);
                break;
            } catch (createError) {
                const isDuplicateFormId = createError?.code === 11000
                    && (createError?.keyPattern?.formId || String(createError?.message || '').includes('formId'));
                if (isDuplicateFormId && attempt < 2) {
                    delete payload.formId;
                    continue;
                }
                throw createError;
            }
        }

        if (!newForm) {
            throw new Error('Unable to create form after retries');
        }
        
        const populatedForm = await Form.findById(newForm._id)
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email')
            .populate('organizationId', 'name')
            .populate('approvalWorkflow.approver', 'firstName lastName email');
        
        res.status(201).json({
            success: true,
            data: populatedForm
        });
    } catch (error) {
        console.error('Create form error:', error);
        console.error('Create form error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            payload: req.body
        });
        res.status(400).json({ 
            success: false,
            message: 'Error creating form.', 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// @desc    List meta fingerprint for forms
// @route   GET /api/forms/meta
exports.getFormsListMeta = async (req, res) => {
    try {
        const { buildFormsListQuery } = require('../utils/listQueryBuilders/formsListQuery');
        const { fetchListMeta, sendListMetaResponse } = require('../utils/listMetaService');
        const query = buildFormsListQuery(req);
        const meta = await fetchListMeta(Form, query);
        sendListMetaResponse(res, meta);
    } catch (error) {
        console.error('[getFormsListMeta] error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch forms list meta' });
    }
};

// @desc    Get all forms
// @route   GET /api/forms
// @access  Private
exports.getForms = async (req, res) => {
    try {
        let query = { organizationId: req.user.organizationId };
        
        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Get filters
        if (req.query.formType) {
            query.formType = req.query.formType;
        }
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.assignedTo) {
            query.assignedTo = req.query.assignedTo;
        }
        if (req.query.visibility) {
            query.visibility = req.query.visibility;
        }
        
        const { buildSearchOrConditions, resolveListSearchTerm, fetchRankedSearchPage, isSearchActive, SEARCH_FIELD_PRESETS } = require('../utils/searchRelevance');
        const directSearchTerm = req.query.search ? String(req.query.search).trim() : '';
        if (directSearchTerm) {
            query.$or = buildSearchOrConditions(directSearchTerm, ['name', 'description', 'formId']);
        }
        
        // Phase 2A.2: Apply projection filter (read-time filtering only)
        // SAFETY: Projection filtering is read-only.
        // SAFETY: No record ownership or permissions are enforced here.
        const appKey = req.appKey || 'SALES'; // From resolveAppContext middleware
        const moduleKey = 'forms';
        const projectionMeta = getProjection(appKey, moduleKey);
        
        // Debug logging
        console.log('[formController] Before projection filter:', {
          appKey,
          moduleKey,
          hasProjection: !!projectionMeta,
          queryBefore: JSON.stringify(query)
        });
        
        query = applyProjectionFilter({
            appKey,
            moduleKey,
            baseQuery: query,
            projectionMeta
        });
        
        // Debug logging
        console.log('[formController] After projection filter:', {
          queryAfter: JSON.stringify(query)
        });

        const { applyListFilterQueryParam } = require('../utils/listFilterQuery');
        query = applyListFilterQueryParam(query, req.query, 'forms', { userId: req.user?._id });
        
        // Sorting
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortBy]: sortOrder };
        
        const formPopulate = [
            { path: 'assignedTo', select: 'firstName lastName email' },
            { path: 'createdBy', select: 'firstName lastName email' },
            { path: 'organizationId', select: 'name' }
        ];
        const searchTerm = resolveListSearchTerm(req.query, 'forms');
        const forms = isSearchActive(searchTerm)
            ? await fetchRankedSearchPage(Form, {
                matchQuery: query,
                searchTerm,
                fieldSpecs: SEARCH_FIELD_PRESETS.forms,
                skip,
                limit,
                fallbackSort: sort,
                populate: formPopulate,
                lean: false
            })
            : await Form.find(query)
                .populate('assignedTo', 'firstName lastName email')
                .populate('createdBy', 'firstName lastName email')
                .populate('organizationId', 'name')
                .sort(sort)
                .limit(limit)
                .skip(skip);
        
        const total = await Form.countDocuments(query);
        
        // Get statistics
        const stats = await Form.aggregate([
            { $match: { organizationId: req.user.organizationId } },
            {
                $group: {
                    _id: null,
                    totalForms: { $sum: 1 },
                    activeForms: {
                        $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
                    },
                    draftForms: {
                        $sum: { $cond: [{ $eq: ['$status', 'Draft'] }, 1, 0] }
                    },
                    readyForms: {
                        $sum: { $cond: [{ $eq: ['$status', 'Ready'] }, 1, 0] }
                    },
                    archivedForms: {
                        $sum: { $cond: [{ $eq: ['$status', 'Archived'] }, 1, 0] }
                    },
                    totalResponses: { $sum: '$totalResponses' }
                }
            }
        ]);
        
        res.status(200).json({
            success: true,
            data: forms,
            pagination: {
                currentPage: page,
                limit,
                totalForms: total,
                totalPages: Math.ceil(total / limit)
            },
            statistics: stats[0] || {
                totalForms: 0,
                activeForms: 0,
                draftForms: 0,
                readyForms: 0,
                archivedForms: 0,
                totalResponses: 0
            }
        });
    } catch (error) {
        console.error('Get forms error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching forms.', 
            error: error.message 
        });
    }
};

// @desc    Get single form
// @route   GET /api/forms/:id
// @access  Private
exports.getFormById = async (req, res) => {
    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid form ID format.'
            });
        }

        let form = await Form.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        }).lean();
        
        if (!form) {
            return res.status(404).json({ 
                success: false,
                message: 'Form not found or access denied.' 
            });
        }
        
        // Helper function to get ObjectId string or ObjectId instance
        const getObjectId = (value) => {
            if (!value) return null;
            // If it's already a string, return it
            if (typeof value === 'string') {
                return mongoose.Types.ObjectId.isValid(value) ? value : null;
            }
            // If it's an ObjectId instance
            if (value instanceof mongoose.Types.ObjectId || value.constructor?.name === 'ObjectID') {
                return value;
            }
            // If it has _id property
            if (value._id) {
                return getObjectId(value._id);
            }
            // If it has toString method, try to use it
            if (typeof value.toString === 'function') {
                const str = value.toString();
                return mongoose.Types.ObjectId.isValid(str) ? str : null;
            }
            return null;
        };
        
        // Populate fields manually to avoid populate errors
        if (form.assignedTo) {
            try {
                const assignedToId = getObjectId(form.assignedTo);
                if (assignedToId) {
                    const assignedUser = await User.findById(assignedToId).select('firstName lastName email').lean();
                    if (assignedUser) form.assignedTo = assignedUser;
                }
            } catch (err) {
                console.warn('Error populating assignedTo:', err.message);
            }
        }
        
        if (form.createdBy) {
            try {
                const createdById = getObjectId(form.createdBy);
                if (createdById) {
                    const createdUser = await User.findById(createdById).select('firstName lastName email').lean();
                    if (createdUser) form.createdBy = createdUser;
                }
            } catch (err) {
                console.warn('Error populating createdBy:', err.message);
            }
        }
        
        if (form.modifiedBy) {
            try {
                const modifiedById = getObjectId(form.modifiedBy);
                if (modifiedById) {
                    const modifiedUser = await User.findById(modifiedById).select('firstName lastName email').lean();
                    if (modifiedUser) form.modifiedBy = modifiedUser;
                }
            } catch (err) {
                console.warn('Error populating modifiedBy:', err.message);
            }
        }
        
        if (form.approvalWorkflow && form.approvalWorkflow.approver) {
            try {
                const approverId = getObjectId(form.approvalWorkflow.approver);
                if (approverId) {
                    const approver = await User.findById(approverId).select('firstName lastName email').lean();
                    if (approver) form.approvalWorkflow.approver = approver;
                }
            } catch (err) {
                console.warn('Error populating approver:', err.message);
            }
        }
        
        if (form.workflowOnSubmit && form.workflowOnSubmit.notify && Array.isArray(form.workflowOnSubmit.notify) && form.workflowOnSubmit.notify.length > 0) {
            try {
                const validNotifyIds = form.workflowOnSubmit.notify
                    .map(id => getObjectId(id))
                    .filter(id => id !== null);
                    
                if (validNotifyIds.length > 0) {
                    const notifyUsers = await User.find({ 
                        _id: { $in: validNotifyIds } 
                    }).select('firstName lastName email').lean();
                    form.workflowOnSubmit.notify = notifyUsers || [];
                } else {
                    form.workflowOnSubmit.notify = [];
                }
            } catch (err) {
                console.warn('Error populating notify users:', err.message);
                form.workflowOnSubmit.notify = [];
            }
        }
        
        // Populate organizationId
        if (form.organizationId) {
            try {
                const orgId = getObjectId(form.organizationId);
                if (orgId) {
                    const organization = await Organization.findById(orgId).select('name').lean();
                    if (organization) form.organizationId = organization;
                }
            } catch (err) {
                console.warn('Error populating organizationId:', err.message);
            }
        }
        
        res.status(200).json({
            success: true,
            data: form
        });
    } catch (error) {
        console.error('Get form error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching form.', 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Helper function to check if a change is breaking (affects responses)
const isBreakingChange = (existingForm, updateData) => {
    // Check if sections are being removed or modified
    if (updateData.sections) {
        const existingSectionIds = new Set(
            (existingForm.sections || []).map(s => s.sectionId)
        );
        const newSectionIds = new Set(
            (updateData.sections || []).map(s => s.sectionId)
        );
        
        // Check for removed sections
        for (const existingId of existingSectionIds) {
            if (!newSectionIds.has(existingId)) {
                return true; // Section removed
            }
        }
        
        // Check for removed subsections or questions
        for (const existingSection of existingForm.sections || []) {
            const newSection = updateData.sections.find(s => s.sectionId === existingSection.sectionId);
            if (!newSection) continue;
            
            // Check subsection removal
            const existingSubsectionIds = new Set(
                (existingSection.subsections || []).map(ss => ss.subsectionId)
            );
            const newSubsectionIds = new Set(
                (newSection.subsections || []).map(ss => ss.subsectionId)
            );
            
            for (const existingId of existingSubsectionIds) {
                if (!newSubsectionIds.has(existingId)) {
                    return true; // Subsection removed
                }
            }
            
            // Check question removal or type change
            for (const existingSubsection of existingSection.subsections || []) {
                const newSubsection = newSection.subsections?.find(ss => ss.subsectionId === existingSubsection.subsectionId);
                if (!newSubsection) continue;
                
                const existingQuestionIds = new Set(
                    (existingSubsection.questions || []).map(q => q.questionId)
                );
                const newQuestionIds = new Set(
                    (newSubsection.questions || []).map(q => q.questionId)
                );
                
                // Check for removed questions
                for (const existingId of existingQuestionIds) {
                    if (!newQuestionIds.has(existingId)) {
                        return true; // Question removed
                    }
                }
                
                // Check for question type changes
                for (const existingQuestion of existingSubsection.questions || []) {
                    const newQuestion = newSubsection.questions?.find(q => q.questionId === existingQuestion.questionId);
                    if (newQuestion && newQuestion.type !== existingQuestion.type) {
                        return true; // Question type changed
                    }
                    
                    // Check for scoring logic changes
                    if (newQuestion && existingQuestion.scoringLogic) {
                        const existingScoring = JSON.stringify(existingQuestion.scoringLogic);
                        const newScoring = JSON.stringify(newQuestion.scoringLogic || {});
                        if (existingScoring !== newScoring) {
                            return true; // Scoring logic changed
                        }
                    }
                    
                    // Check for mandatory/required changes
                    if (newQuestion && newQuestion.mandatory !== existingQuestion.mandatory) {
                        return true; // Required status changed
                    }
                }
            }
            
            // Check section-level questions
            const existingSectionQuestionIds = new Set(
                (existingSection.questions || []).map(q => q.questionId)
            );
            const newSectionQuestionIds = new Set(
                (newSection.questions || []).map(q => q.questionId)
            );
            
            for (const existingId of existingSectionQuestionIds) {
                if (!newSectionQuestionIds.has(existingId)) {
                    return true; // Section-level question removed
                }
            }
            
            for (const existingQuestion of existingSection.questions || []) {
                const newQuestion = newSection.questions?.find(q => q.questionId === existingQuestion.questionId);
                if (newQuestion && newQuestion.type !== existingQuestion.type) {
                    return true; // Question type changed
                }
            }
        }
    }
    
    // Check for scoring formula changes
    if (updateData.scoringFormula && updateData.scoringFormula !== existingForm.scoringFormula) {
        return true;
    }
    
    // Check for threshold changes
    if (updateData.thresholds) {
        if (updateData.thresholds.pass !== existingForm.thresholds?.pass ||
            updateData.thresholds.partial !== existingForm.thresholds?.partial) {
            return true;
        }
    }
    
    // Check for outcome rules changes
    if (updateData.outcomesAndRules) {
        const existingRules = JSON.stringify(existingForm.outcomesAndRules || {});
        const newRules = JSON.stringify(updateData.outcomesAndRules);
        if (existingRules !== newRules) {
            return true;
        }
    }
    
    // Check for response template changes (active template)
    if (updateData.responseTemplate && existingForm.responseTemplate?.activeTemplateId) {
        const existingTemplate = JSON.stringify(existingForm.responseTemplate);
        const newTemplate = JSON.stringify(updateData.responseTemplate);
        if (existingTemplate !== newTemplate) {
            return true;
        }
    }
    
    return false;
};

// Helper function to check if only cosmetic changes are being made
const isCosmeticChangeOnly = (existingForm, updateData) => {
    // Allowed cosmetic changes: name, description, section titles, question labels, help text
    const allowedFields = ['name', 'description', 'notes', 'tags', 'visibility', 'branding'];
    
    // Check if only allowed fields are being updated
    const updateKeys = Object.keys(updateData);
    const hasOnlyAllowedFields = updateKeys.every(key => allowedFields.includes(key));
    
    if (hasOnlyAllowedFields) {
        return true;
    }
    
    // Check if sections only have cosmetic changes (titles, question text, help text)
    if (updateData.sections) {
        // Deep comparison would be complex, so we'll use a simpler approach:
        // If sections structure is the same (same IDs, same types, same order), allow
        // This is a simplified check - in production, you might want more thorough validation
        const existingSectionIds = (existingForm.sections || []).map(s => s.sectionId).sort();
        const newSectionIds = (updateData.sections || []).map(s => s.sectionId).sort();
        
        if (JSON.stringify(existingSectionIds) !== JSON.stringify(newSectionIds)) {
            return false; // Structure changed
        }
        
        // For now, we'll be conservative and only allow if no sections are in the update
        // or if we can verify it's only cosmetic
        // In a real implementation, you'd do deeper comparison
    }
    
    return false;
};

// @desc    Update form
// @route   PUT /api/forms/:id
// @access  Private
exports.updateForm = async (req, res) => {
    try {
        // Prevent changing organizationId
        delete req.body.organizationId;
        delete req.body.formId; // Cannot change formId
        req.body.modifiedBy = req.user._id;
        
        // Get existing form
        const existingForm = await Form.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!existingForm) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or access denied.'
            });
        }
        
        // Handle status transitions
        if (req.body.status) {
            req.body.status = normalizeEngagementPublishStatus(
                req.body.status,
                req.body.formType || existingForm.formType
            );
        }
        const newStatus = req.body.status;
        const currentStatus = existingForm.status;
        
        // Validate status transitions
        if (newStatus && newStatus !== currentStatus) {
            const validTransitions = {
                'Draft': ['Ready', 'Active', 'Archived'],
                'Ready': ['Active', 'Archived'],
                'Active': ['Archived'],
                'Archived': [] // No transitions from Archived
            };
            
            if (!validTransitions[currentStatus]?.includes(newStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status transition from ${currentStatus} to ${newStatus}.`
                });
            }
        }
        
        // Edit permission enforcement
        if (existingForm.status === 'Archived') {
            return res.status(400).json({
                success: false,
                message: 'This form is archived and cannot be edited. To make changes, duplicate the form.'
            });
        }
        
        if (isFormStructurallyLocked(existingForm.formType, existingForm.status)) {
            // Check for breaking changes
            if (isBreakingChange(existingForm, req.body)) {
                return res.status(400).json({
                    success: false,
                    message: 'This form is currently active and in use. To make this change, create a new version.',
                    code: 'BREAKING_CHANGE_BLOCKED',
                    action: 'duplicate'
                });
            }
            
            // Allow cosmetic changes only
            if (!isCosmeticChangeOnly(existingForm, req.body)) {
                // Additional check: allow section/question text edits but not structure changes
                // This is a simplified check - you may want to refine this
                const hasStructureChanges = req.body.sections && 
                    JSON.stringify((existingForm.sections || []).map(s => ({
                        sectionId: s.sectionId,
                        subsections: (s.subsections || []).map(ss => ({
                            subsectionId: ss.subsectionId,
                            questions: (ss.questions || []).map(q => q.questionId)
                        })),
                        questions: (s.questions || []).map(q => q.questionId)
                    }))) !== JSON.stringify((req.body.sections || []).map(s => ({
                        sectionId: s.sectionId,
                        subsections: (s.subsections || []).map(ss => ({
                            subsectionId: ss.subsectionId,
                            questions: (ss.questions || []).map(q => q.questionId)
                        })),
                        questions: (s.questions || []).map(q => q.questionId)
                    })));
                
                if (hasStructureChanges) {
                    return res.status(400).json({
                        success: false,
                        message: 'This form is currently active and in use. To make this change, create a new version.',
                        code: 'BREAKING_CHANGE_BLOCKED',
                        action: 'duplicate'
                    });
                }
            }
        }
        
        // Draft and Ready: Allow full editing
        // Validate form structure only if form is being set to Active or Ready status
        if (req.body.status === 'Active' || req.body.status === 'Ready') {
            const tempForm = new Form({ ...existingForm.toObject(), ...req.body });
            const validation = tempForm.validateStructure();
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.error
                });
            }
        }
        
        // Clean up responseTemplate.activeTemplateId - convert "default" string to null
        cleanResponseTemplateActiveId(req.body);

        await applyPublicLinkToPayload(req.body, {
            organizationId: req.user.organizationId,
            excludeFormId: existingForm._id
        });
        applyFormBrandingToPayload(req.body);

        if (Object.prototype.hasOwnProperty.call(req.body, 'expiryDate')) {
            req.body.expiryDate = normalizeEngagementExpiryDate(req.body.expiryDate);
        }

        // Generic description versioning: store previous description before update.
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
            try {
                const prevDesc = String(existingForm?.description ?? existingForm?.customFields?.description ?? '');
                const nextDesc = String(req.body.description ?? '');
                if (prevDesc !== nextDesc) {
                    await Form.updateOne(
                        { _id: req.params.id, organizationId: req.user.organizationId },
                        {
                            $push: {
                                descriptionVersions: {
                                    content: prevDesc,
                                    createdAt: new Date(),
                                    createdBy: req.user?._id
                                }
                            }
                        }
                    );
                }
            } catch (versionErr) {
                console.warn('Description version push (form) failed:', versionErr?.message || versionErr);
            }
        }
        
        // Perform update
        const updatedForm = await Form.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId
            },
            req.body,
            { new: true, runValidators: true }
        )
        .populate('assignedTo', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('modifiedBy', 'firstName lastName email');

        if (!updatedForm) {
            return res.status(404).json({ 
                success: false,
                message: 'Form not found or access denied.' 
            });
        }
        
        res.status(200).json({
            success: true,
            data: updatedForm
        });
    } catch (error) {
        console.error('Update form error:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error updating form.', 
            error: error.message 
        });
    }
};

// @desc    Delete form
// @route   DELETE /api/forms/:id
// @access  Private
exports.deleteForm = async (req, res) => {
    try {
        const form = await Form.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });

        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or access denied.'
            });
        }

        const submittedCount = await countSubmittedFormResponses(
            FormResponse,
            form._id,
            req.user.organizationId
        );

        if (submittedCount > 0) {
            return res.status(403).json({
                success: false,
                message: 'Forms with submitted responses cannot be deleted. Archive the form instead.',
                code: FORM_HAS_SUBMITTED_RESPONSES,
                submittedCount
            });
        }

        await Form.findOneAndDelete({
            _id: form._id,
            organizationId: req.user.organizationId
        });

        res.status(200).json({
            success: true,
            message: 'Form deleted successfully'
        });
    } catch (error) {
        console.error('Delete form error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting form.', 
            error: error.message 
        });
    }
};

// @desc    Duplicate form
// @route   POST /api/forms/:id/duplicate
// @access  Private
exports.duplicateForm = async (req, res) => {
    try {
        const originalForm = await Form.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!originalForm) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or access denied.'
            });
        }
        
        // Create duplicate
        const formData = originalForm.toObject();
        delete formData._id;
        delete formData.formId;
        delete formData.createdAt;
        delete formData.updatedAt;
        delete formData.totalResponses;
        delete formData.avgRating;
        delete formData.avgCompliance;
        delete formData.responseRate;
        delete formData.lastSubmission;
        // Remove public link to avoid duplicate key error
        if (formData.publicLink) {
            delete formData.publicLink.slug;
            delete formData.publicLink.enabled;
            delete formData.publicLink.url;
        }
        formData.publicLink = undefined; // Ensure it's completely removed
        
        formData.name = `${formData.name} (Copy)`;
        formData.status = 'Draft';
        formData.createdBy = req.user._id;
        formData.modifiedBy = req.user._id;
        formData.formVersion = 1;
        
        const duplicatedForm = await Form.create(formData);
        
        const populatedForm = await Form.findById(duplicatedForm._id)
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email');
        
        res.status(201).json({
            success: true,
            data: populatedForm,
            message: 'Form duplicated successfully'
        });
    } catch (error) {
        console.error('Duplicate form error:', error);
        res.status(500).json({
            success: false,
            message: 'Error duplicating form.',
            error: error.message
        });
    }
};

// @desc    Get form by public slug
// @route   GET /api/public/forms/:slug
// @access  Public
exports.getFormBySlug = async (req, res) => {
    try {
        const slug = String(req.params.slug || '').trim().toLowerCase();
        if (!slug) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or not available.'
            });
        }

        const form = await Form.findOne({
            'publicLink.slug': slug,
            'publicLink.enabled': true,
            status: { $in: ['Active', 'Ready', 'Draft'] }
        })
        .populate('assignedTo', 'firstName lastName email');
        
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or not available.'
            });
        }
        
        // Check if form is expired (for Surveys)
        if (isEngagementFormExpired(form.expiryDate)) {
            return res.status(410).json({
                success: false,
                message: 'This form has expired.'
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                ...form.toObject(),
                branding: sanitizeWebformBranding(form.branding)
            }
        });
    } catch (error) {
        console.error('Get form by slug error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching form.',
            error: error.message
        });
    }
};

// @desc    Get form analytics
// @route   GET /api/forms/:id/analytics
// @access  Private
exports.getFormAnalytics = async (req, res) => {
    try {
        const form = await Form.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or access denied.'
            });
        }
        
        // Get response statistics
        const responseStats = await FormResponse.aggregate([
            {
                $match: {
                    formId: new mongoose.Types.ObjectId(req.params.id),
                    organizationId: req.user.organizationId
                }
            },
            {
                $group: {
                    _id: null,
                    totalResponses: { $sum: 1 },
                    avgCompliance: { $avg: '$kpis.compliancePercentage' },
                    avgRating: { $avg: '$kpis.rating' },
                    avgScore: { $avg: '$kpis.finalScore' },
                    passed: {
                        $sum: {
                            $cond: [
                                { $gte: ['$kpis.compliancePercentage', form.thresholds.pass] },
                                1,
                                0
                            ]
                        }
                    },
                    failed: {
                        $sum: {
                            $cond: [
                                { $lt: ['$kpis.compliancePercentage', form.thresholds.partial] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);
        
        // Get recent submissions
        const recentSubmissions = await FormResponse.find({
            formId: req.params.id,
            organizationId: req.user.organizationId
        })
        .sort({ submittedAt: -1 })
        .limit(10)
        .populate('submittedBy', 'firstName lastName email')
        .select('responseId submittedAt kpis status');
        
        res.status(200).json({
            success: true,
            data: {
                form: {
                    name: form.name,
                    formType: form.formType,
                    totalResponses: form.totalResponses,
                    avgRating: form.avgRating,
                    avgCompliance: form.avgCompliance,
                    responseRate: form.responseRate,
                    lastSubmission: form.lastSubmission
                },
                statistics: responseStats[0] || {
                    totalResponses: 0,
                    avgCompliance: 0,
                    avgRating: 0,
                    avgScore: 0,
                    passed: 0,
                    failed: 0
                },
                recentSubmissions
            }
        });
    } catch (error) {
        console.error('Get form analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching form analytics.',
            error: error.message
        });
    }
};

// @desc    Get consolidated per-question response summary (survey/feedback)
// @route   GET /api/forms/:id/response-summary
// @access  Private
exports.getFormResponseSummary = async (req, res) => {
    try {
        const { buildFormResponseSummary } = require('../services/formResponseSummaryService');

        const form = await Form.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });

        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or access denied.'
            });
        }

        const textPreviewLimit = parseInt(req.query.textPreviewLimit, 10) || 5;
        const data = await buildFormResponseSummary(form, req.user.organizationId, { textPreviewLimit });

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get form response summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching form response summary.',
            error: error.message
        });
    }
};

// @desc    Get form KPIs
// @route   GET /api/forms/:id/kpis
// @access  Private
exports.getFormKPIs = async (req, res) => {
    try {
        const form = await Form.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or access denied.'
            });
        }
        
        // Get or create FormKPIs document
        let formKPIs = await FormKPIs.findOne({
            formId: req.params.id,
            organizationId: req.user.organizationId
        }).sort({ calculatedAt: -1 });
        
        // If no KPIs exist, return empty structure
        if (!formKPIs) {
            formKPIs = {
                questionKPIs: [],
                sectionKPIs: [],
                formKPIs: {
                    totalResponses: 0,
                    avgCompliance: 0,
                    avgRating: 0,
                    passRate: 0,
                    avgCompletionTime: 0,
                    trend: 'stable'
                },
                organizationKPIs: []
            };
        }
        
        res.status(200).json({
            success: true,
            data: formKPIs
        });
    } catch (error) {
        console.error('Get form KPIs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching form KPIs.',
            error: error.message
        });
    }
};

// @desc    Link form to event
// @route   POST /api/forms/:id/link-event
// @access  Private
exports.linkFormToEvent = async (req, res) => {
    try {
        const { eventId } = req.body;
        
        const form = await Form.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or access denied.'
            });
        }
        
        // Update event to link form (this will be handled in eventController)
        // For now, we'll just return success
        // The actual linking will be done in the event update endpoint
        
        res.status(200).json({
            success: true,
            message: 'Form can be linked to event. Please update the event with linkedFormId.',
            data: {
                formId: form._id,
                formName: form.name,
                eventId: eventId
            }
        });
    } catch (error) {
        console.error('Link form to event error:', error);
        res.status(500).json({
            success: false,
            message: 'Error linking form to event.',
            error: error.message
        });
    }
};

// @desc    Enable public link for form
// @route   POST /api/forms/:id/enable-public
// @access  Private
exports.enablePublicLink = async (req, res) => {
    try {
        const form = await Form.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });

        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or access denied.'
            });
        }

        // Generate slug from form name if not already set
        let slug = form.publicLink?.slug;
        if (!slug) {
            slug = await generateUniqueFormPublicSlug({
                formName: form.name,
                formId: form.formId || form._id,
                organizationId: req.user.organizationId,
                excludeFormId: form._id
            });
        } else {
            slug = String(slug).trim().toLowerCase();
        }

        // Update form with public link
        form.publicLink = {
            enabled: true,
            slug: slug
        };
        form.modifiedBy = req.user._id;

        if (isEngagementFormType(form.formType) && form.status !== 'Archived') {
            if (form.status === 'Draft') {
                const validation = form.validateStructure();
                if (!validation.valid) {
                    return res.status(400).json({
                        success: false,
                        message: validation.error
                    });
                }
            }
            form.status = 'Active';
        }

        await form.save();

        const populatedForm = await Form.findById(form._id)
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email');

        res.status(200).json({
            success: true,
            data: populatedForm,
            message: 'Public link enabled successfully'
        });
    } catch (error) {
        console.error('Enable public link error:', error);
        res.status(500).json({
            success: false,
            message: 'Error enabling public link.',
            error: error.message
        });
    }
};

// @desc    Get audit history for an organization
// @route   GET /api/forms/organization/:organizationId/audits
// @access  Private
exports.getOrganizationAudits = async (req, res) => {
    try {
        const { organizationId } = req.params;
        
        // Verify organization access
        if (organizationId !== req.user.organizationId.toString()) {
            // Check if user has permission to view other organizations (admin/manager)
            // For now, only allow viewing own organization
            return res.status(403).json({
                success: false,
                message: 'Access denied.'
            });
        }
        
        // Find all form responses linked to this organization
        // We'll link responses to organizations via events or directly
        const responses = await FormResponse.find({
            organizationId: req.user.organizationId,
            formId: { $exists: true }
        })
        .populate('formId', 'name formId formType')
        .populate('submittedBy', 'firstName lastName email')
        .sort({ submittedAt: -1 })
        .limit(50)
        .lean();
        
        // Get form details and calculate summary KPIs
        const audits = responses.map(response => ({
            auditId: response._id,
            responseId: response.responseId,
            formId: response.formId?._id ? response.formId._id.toString() : null,
            formName: response.formId?.name || 'Unknown Form',
            formType: response.formId?.formType || 'Custom',
            auditDate: response.submittedAt,
            auditor: response.submittedBy ? {
                name: `${response.submittedBy.firstName} ${response.submittedBy.lastName}`,
                email: response.submittedBy.email
            } : null,
            score: response.kpis?.finalScore || 0,
            compliance: response.kpis?.compliancePercentage || 0,
            passRate: response.kpis?.passRate || 0,
            status: response.status,
            hasCorrectiveActions: response.correctiveActions && response.correctiveActions.length > 0,
            correctiveActionsCount: response.correctiveActions?.length || 0,
            reportUrl: response.reportUrl || null
        }));
        
        // Calculate summary KPIs
        const totalAudits = audits.length;
        const avgCompliance = totalAudits > 0
            ? Math.round(audits.reduce((sum, audit) => sum + audit.compliance, 0) / totalAudits)
            : 0;
        const avgPassRate = totalAudits > 0
            ? Math.round(audits.reduce((sum, audit) => sum + audit.passRate, 0) / totalAudits)
            : 0;
        const passedAudits = audits.filter(a => a.compliance >= 70).length; // Assuming 70% is pass threshold
        const passRate = totalAudits > 0 ? Math.round((passedAudits / totalAudits) * 100) : 0;
        const lastAuditDate = audits.length > 0 ? audits[0].auditDate : null;
        
        // Calculate trend (compare last 5 audits)
        const recentAudits = audits.slice(0, 5);
        const trend = recentAudits.length >= 2
            ? recentAudits[0].compliance > recentAudits[recentAudits.length - 1].compliance ? 'improving' : 'declining'
            : 'stable';
        
        res.status(200).json({
            success: true,
            data: {
                audits,
                summary: {
                    totalAudits,
                    avgCompliance,
                    avgPassRate,
                    passRate,
                    lastAuditDate,
                    trend
                }
            }
        });
    } catch (error) {
        console.error('Get organization audits error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching organization audits.',
            error: error.message
        });
    }
};

