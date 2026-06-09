const Deal = require('../models/Deal');
const DealComment = require('../models/DealComment');
const People = require('../models/People');
const Task = require('../models/Task');
const ImportHistory = require('../models/ImportHistory');
const FormResponse = require('../models/FormResponse');
const User = require('../models/User');
const mongoose = require('mongoose');
const { persistMulterUpload } = require('../middleware/uploadMiddleware');
const { processCommentMentions } = require('../services/commentMentionNotifications');
const {
  computeAndSetDerivedStatus,
  hasConfiguration,
  hasLifecycleOrTypeChanged,
  validateStatusWriteProtection
} = require('../services/derivedStatusService');
const { validateStageInPipeline, validateDealRelationships } = require('../services/systemInvariants');
const {
  syncLegacyToRoleBased,
  syncRoleBasedToLegacy
} = require('../services/dealRelationshipService');
const { syncDealRelationshipInstances } = require('../services/dealRelationshipInstanceSync');
const { getDefaultPipelineSettings } = require('./moduleController');

const DESCRIPTION_VERSION_RETENTION_DAYS = 365;
const CLOSED_TASK_STATUSES = ['completed', 'done', 'closed', 'cancelled'];

const getTrendConfig = (range = '12w') => {
    const normalized = String(range || '').toLowerCase();
    if (normalized === '6m') {
        return {
            key: '6m',
            bucketDays: 15,
            buckets: 12,
            closeSoonDays: 21,
            staleDays: 21,
            responseLookbackDays: 14,
            importLookbackDays: 45,
            priorityThresholds: { high: 10, medium: 5 }
        };
    }
    if (normalized === '12m') {
        return {
            key: '12m',
            bucketDays: 30,
            buckets: 12,
            closeSoonDays: 30,
            staleDays: 30,
            responseLookbackDays: 21,
            importLookbackDays: 60,
            priorityThresholds: { high: 12, medium: 6 }
        };
    }
    return {
        key: '12w',
        bucketDays: 7,
        buckets: 12,
        closeSoonDays: 14,
        staleDays: 14,
        responseLookbackDays: 7,
        importLookbackDays: 30,
        priorityThresholds: { high: 8, medium: 3 }
    };
};

const mapPriority = (count, highThreshold, mediumThreshold) => {
    if (count >= highThreshold) return 'High';
    if (count >= mediumThreshold) return 'Medium';
    return 'Low';
};

const parseCsvParam = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
    return String(value)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
};

const toObjectIdOrNull = (value) => {
    if (!value) return null;
    return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

const getActorDisplayName = (user) => {
        if (!user) return 'Unknown User';
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        return fullName || user.username || user.email || String(user._id || 'Unknown User');
};

const DEAL_FIELD_LABELS = {
    name: 'name',
    amount: 'amount',
    currency: 'currency',
    pipeline: 'pipeline',
    stage: 'stage',
    probability: 'probability',
    expectedCloseDate: 'expected close date',
    actualCloseDate: 'actual close date',
    contactId: 'contact',
    accountId: 'organization',
    ownerId: 'owner',
    description: 'description',
    type: 'type',
    source: 'source',
    nextStep: 'next step',
    status: 'status',
    lostReason: 'lost reason',
    tags: 'tags',
    priority: 'priority',
    nextFollowUpDate: 'next follow-up date'
};

const DEAL_SYSTEM_FIELDS = ['id', '_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'modifiedBy', 'playbookState'];

const normalizeDealComparableValue = (value) => {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString();

    if (typeof value === 'object' && typeof value.toObject === 'function') {
        try {
            return normalizeDealComparableValue(value.toObject({
                depopulate: true,
                virtuals: false,
                getters: false,
                flattenMaps: true
            }));
        } catch (_) {}
    }

    if (Array.isArray(value)) return value.map(normalizeDealComparableValue);
    if (typeof value === 'object') {
        if (typeof value.toHexString === 'function') return String(value.toHexString());
        if (value._bsontype === 'ObjectID' || value._bsontype === 'ObjectId') return String(value);

        const normalized = {};
        Object.keys(value).sort().forEach((key) => {
            if (key === '__v') return;
            normalized[key] = normalizeDealComparableValue(value[key]);
        });
        return normalized;
    }

    return value;
};

const areDealFieldValuesEqual = (a, b) => (
    JSON.stringify(normalizeDealComparableValue(a)) === JSON.stringify(normalizeDealComparableValue(b))
);

const formatDealDateForLog = (value) => {
    if (!value) return 'Empty';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Empty';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const formatDealEntityValueForLog = (value) => {
    if (!value) return 'Empty';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        return value.name
            || [value.first_name, value.last_name].filter(Boolean).join(' ').trim()
            || [value.firstName, value.lastName].filter(Boolean).join(' ').trim()
            || value.email
            || String(value._id || value.id || 'Empty');
    }
    return String(value);
};

const formatDealFieldValueForLog = (field, value, userNameById = {}) => {
    if (value === undefined || value === null || value === '') return 'Empty';

    switch (field) {
        case 'amount': {
            const num = Number(value);
            return Number.isFinite(num) ? `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : String(value);
        }
        case 'probability': {
            const num = Number(value);
            return Number.isFinite(num) ? `${Math.round(num)}%` : String(value);
        }
        case 'expectedCloseDate':
        case 'actualCloseDate':
        case 'nextFollowUpDate':
            return formatDealDateForLog(value);
        case 'ownerId': {
            const rawId = typeof value === 'object' ? (value._id || value.id) : value;
            const id = rawId ? String(rawId) : '';
            if (id && userNameById[id]) return userNameById[id];
            return formatDealEntityValueForLog(value);
        }
        case 'contactId':
        case 'accountId':
            return formatDealEntityValueForLog(value);
        case 'tags':
            return Array.isArray(value) && value.length > 0 ? value.join(', ') : 'Empty';
        case 'dealPeople':
        case 'dealOrganizations':
            return Array.isArray(value) ? `${value.length} linked` : 'Empty';
        default:
            return String(value);
    }
};

const buildDealFieldChangeLogEntry = ({ actorName, actorId, field, oldValue, newValue, userNameById = {} }) => {
    const from = formatDealFieldValueForLog(field, oldValue, userNameById);
    const to = formatDealFieldValueForLog(field, newValue, userNameById);
    if (from === to) return null;

    return {
        user: actorName,
        userId: actorId,
        action: field === 'stage' ? 'changed stage' : 'field_changed',
        details: {
            field,
            fieldLabel: DEAL_FIELD_LABELS[field] || field,
            from,
            to
        },
        timestamp: new Date()
    };
};

// @desc    Create new deal
// @route   POST /api/deals
// @access  Private
exports.createDeal = async (req, res) => {
    try {
        const { stripClientSource, assignResolvedSource } = require('../services/sourceResolver');
        stripClientSource(req.body);
        const appKey = req.appKey || req.query.appKey || 'SALES';
        const payload = {
            ...req.body,
            organizationId: req.user.organizationId,
            ownerId: req.body.ownerId || req.user._id,
            createdBy: req.user._id,
            modifiedBy: req.user._id,
            activityLogs: [{
                user: getActorDisplayName(req.user),
                userId: req.user._id,
                action: 'created',
                details: {},
                timestamp: new Date()
            }]
        };

        const statusWriteResult = await validateStatusWriteProtection('deal', payload, appKey);
        if (statusWriteResult) {
            return res.status(400).json({
                success: false,
                code: statusWriteResult.code,
                message: statusWriteResult.message,
                errors: statusWriteResult.errors
            });
        }

        // Every deal must have pipeline and stage. Auto-assign default when missing so user is not forced to pick.
        if (!payload.pipeline || !payload.stage) {
            const defaultSettings = getDefaultPipelineSettings();
            const defaultPipeline = defaultSettings.find((p) => p.isDefault) || defaultSettings[0];
            if (defaultPipeline && Array.isArray(defaultPipeline.stages) && defaultPipeline.stages.length) {
                payload.pipeline = payload.pipeline || defaultPipeline.key;
                payload.stage = payload.stage || (defaultPipeline.stages[0].name || 'New');
            }
        }

        const stagePipelineResult = await validateStageInPipeline({
            moduleKey: 'deals',
            organizationId: req.user.organizationId,
            updateData: payload,
            appKey
        });
        if (!stagePipelineResult.valid) {
            return res.status(400).json({
                success: false,
                code: stagePipelineResult.code,
                message: stagePipelineResult.message,
                errors: stagePipelineResult.errors
            });
        }

        if (!payload.status) payload.status = 'Open';

        assignResolvedSource(payload, 'ui');
        const newDeal = await Deal.create(payload);

        await syncLegacyToRoleBased(newDeal, req.user._id);

        const relationshipResult = await validateDealRelationships({
            moduleKey: 'deals',
            recordId: newDeal._id,
            organizationId: req.user.organizationId,
            updateData: newDeal.toObject()
        });
        if (!relationshipResult.valid) {
            await Deal.findByIdAndDelete(newDeal._id);
            return res.status(400).json({
                success: false,
                code: relationshipResult.code,
                message: relationshipResult.message,
                errors: relationshipResult.errors
            });
        }

        const computedDerivedStatus = await computeAndSetDerivedStatus('deal', newDeal, appKey);
        const configExists = await hasConfiguration('deal', appKey);
        if (configExists && computedDerivedStatus && newDeal.status !== computedDerivedStatus) {
            newDeal.status = computedDerivedStatus;
        }

        await syncRoleBasedToLegacy(newDeal);

        try {
            const { executePlaybookForDeal } = require('../services/playbookExecutionService');
            await executePlaybookForDeal(newDeal, {
                actorId: req.user._id,
                organizationId: req.user.organizationId
            });
        } catch (playbookErr) {
            console.error('[dealController] playbook on create failed:', playbookErr?.message || playbookErr);
        }
        
        if (
            newDeal.isModified('dealPeople') ||
            newDeal.isModified('dealOrganizations') ||
            newDeal.isModified('contactId') ||
            newDeal.isModified('accountId') ||
            newDeal.isModified('derivedStatus') ||
            newDeal.isModified('status') ||
            newDeal.isModified('probability') ||
            newDeal.isModified('playbookState')
        ) {
            await newDeal.save();
        }

        await syncDealRelationshipInstances({
            organizationId: req.user.organizationId,
            dealDoc: newDeal,
            createdBy: req.user._id,
            peopleMode: 'replace',
            organizationsMode: 'replace'
        });

        try {
            const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
            const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
            const freshDeal = await Deal.findById(newDeal._id);
            if (freshDeal) {
                await runImmediateAssignmentForSalesRecord({
                    record: freshDeal,
                    moduleKey: 'deals',
                    actorId: req.user._id,
                    triggerSource: 'immediate',
                    changedFields: []
                });
                await enqueueAssignmentJobsForSalesRecord({
                    record: freshDeal,
                    moduleKey: 'deals',
                    actorId: req.user._id,
                    changedFields: []
                });
            }
        } catch (assignErr) {
            console.error('[dealController] assignment on create failed:', assignErr?.message || assignErr);
        }

        const deal = await Deal.findById(newDeal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName email')
            .populate('dealPeople.personId', 'first_name last_name email')
            .populate('dealOrganizations.organizationId', 'name');

        const { emitDealEvents } = require('../services/domainEventHelpers');
        await emitDealEvents({
            previous: null,
            current: deal?.toObject ? deal.toObject() : deal,
            appKey,
            triggeredBy: req.user?._id ?? null,
            organizationId: req.user?.organizationId ?? null
        });

        res.status(201).json({ success: true, data: deal });
    } catch (error) {
        console.error('Create deal error:', error);
        res.status(400).json({
            success: false,
            message: 'Error creating deal.',
            error: error.message
        });
    }
};

// @desc    Get all deals
// @route   GET /api/deals
// @access  Private
exports.getDeals = async (req, res) => {
    try {
        let query = { organizationId: req.user.organizationId, deletedAt: null };
        
        // Filter by user if needed
        if (req.filterByUser) {
            query.ownerId = req.filterByUser;
        }
        
        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Get filters
        if (req.query.stage) {
            query.stage = req.query.stage;
        }
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.priority) {
            query.priority = req.query.priority;
        }
        if (req.query.ownerId) {
            query.ownerId = req.query.ownerId;
        }
        if (req.query.contactId) {
            query.contactId = req.query.contactId;
        }
        if (req.query.accountId) {
            // Convert accountId to ObjectId if it's a valid ObjectId string
            if (mongoose.Types.ObjectId.isValid(req.query.accountId)) {
                query.accountId = new mongoose.Types.ObjectId(req.query.accountId);
            } else {
                query.accountId = req.query.accountId;
            }
        }
        if (req.query.pipeline) {
            query.pipeline = req.query.pipeline;
        }
        
        const { buildSearchOrConditions, resolveListSearchTerm, fetchRankedSearchPage, isSearchActive, SEARCH_FIELD_PRESETS } = require('../utils/searchRelevance');
        const directSearchTerm = req.query.search ? String(req.query.search).trim() : '';
        if (directSearchTerm) {
            query.$or = buildSearchOrConditions(directSearchTerm, ['name', 'description']);
        }
        
        // Date range filter
        if (req.query.fromDate || req.query.toDate) {
            query.expectedCloseDate = {};
            if (req.query.fromDate) {
                query.expectedCloseDate.$gte = new Date(req.query.fromDate);
            }
            if (req.query.toDate) {
                query.expectedCloseDate.$lte = new Date(req.query.toDate);
            }
        }
        
        const { applyListFilterQueryParam } = require('../utils/listFilterQuery');
        query = applyListFilterQueryParam(query, req.query, 'deals', { userId: req.user?._id });

        // Sorting (use stage + stageOrder for pipeline/Kanban order)
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = sortBy === 'stage'
            ? { stage: sortOrder, stageOrder: 1 }
            : { [sortBy]: sortOrder };
        
        const dealPopulate = [
            { path: 'contactId', select: 'first_name last_name email' },
            { path: 'ownerId', select: 'firstName lastName email' },
            { path: 'accountId', select: 'name' },
            { path: 'dealPeople.personId', select: 'first_name last_name email' },
            { path: 'dealOrganizations.organizationId', select: 'name' }
        ];
        const searchTerm = resolveListSearchTerm(req.query, 'deals');
        const deals = isSearchActive(searchTerm)
            ? await fetchRankedSearchPage(Deal, {
                matchQuery: query,
                searchTerm,
                fieldSpecs: SEARCH_FIELD_PRESETS.deals,
                skip,
                limit,
                fallbackSort: sort,
                populate: dealPopulate,
                lean: false
            })
            : await Deal.find(query)
                .populate('contactId', 'first_name last_name email')
                .populate('ownerId', 'firstName lastName email')
                .populate('accountId', 'name')
                .populate('dealPeople.personId', 'first_name last_name email')
                .populate('dealOrganizations.organizationId', 'name')
                .sort(sort)
                .limit(limit)
                .skip(skip);
        
        const total = await Deal.countDocuments(query);

        try {
            const { refreshPlaybookStatesForDealList } = require('../services/playbookExecutionService');
            await refreshPlaybookStatesForDealList(deals, req.user.organizationId);
        } catch (playbookErr) {
            console.error('[dealController] playbook refresh on list failed:', playbookErr?.message || playbookErr);
        }
        
        // Get statistics
        const stats = await Deal.aggregate([
            { $match: { organizationId: req.user.organizationId, deletedAt: null } },
            {
                $group: {
                    _id: null,
                    totalDeals: { $sum: 1 },
                    activeDeals: {
                        $sum: { $cond: [{ $in: ['$status', ['Open', 'Active']] }, 1, 0] }
                    },
                    stalledDeals: {
                        $sum: { $cond: [{ $in: ['$status', ['Stalled', 'Abandoned']] }, 1, 0] }
                    },
                    wonDeals: {
                        $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] }
                    },
                    lostDeals: {
                        $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] }
                    },
                    totalValue: { $sum: '$amount' },
                    wonValue: {
                        $sum: { $cond: [{ $eq: ['$status', 'Won'] }, '$amount', 0] }
                    },
                    pipelineValue: {
                        $sum: { $cond: [{ $in: ['$status', ['Open', 'Active']] }, '$amount', 0] }
                    }
                }
            }
        ]);
        
        res.status(200).json({
            success: true,
            data: deals,
            pagination: {
                currentPage: page,
                limit,
                totalDeals: total,
                totalPages: Math.ceil(total / limit)
            },
            statistics: stats[0] || {
                totalDeals: 0,
                activeDeals: 0,
                stalledDeals: 0,
                wonDeals: 0,
                lostDeals: 0,
                totalValue: 0,
                wonValue: 0,
                pipelineValue: 0
            }
        });
    } catch (error) {
        console.error('Get deals error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching deals.', 
            error: error.message 
        });
    }
};

// @desc    Get single deal
// @route   GET /api/deals/:id
// @access  Private
exports.getDealById = async (req, res) => {
    try {
        const deal = await Deal.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId,
            deletedAt: null
        })
        .populate('contactId', 'first_name last_name email phone')
        .populate('ownerId', 'firstName lastName email')
        .populate('accountId', 'name industry')
        .populate('dealPeople.personId', 'first_name last_name email phone')
        .populate('dealOrganizations.organizationId', 'name industry')
        .populate('notes.createdBy', 'firstName lastName')
        .populate('stageHistory.changedBy', 'firstName lastName');
        
        if (!deal) {
            return res.status(404).json({ 
                success: false,
                message: 'Deal not found or access denied.' 
            });
        }

        try {
            const { refreshPlaybookStateFromActivities } = require('../services/playbookExecutionService');
            const playbookChanged = await refreshPlaybookStateFromActivities(deal);
            if (playbookChanged) {
                await deal.save();
            }
        } catch (playbookErr) {
            console.error('[dealController] playbook refresh on get failed:', playbookErr?.message || playbookErr);
        }
        
        const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        res.status(200).json({
            success: true,
            data: flattenCustomFieldsForResponse(deal)
        });
    } catch (error) {
        console.error('Get deal error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching deal.', 
            error: error.message 
        });
    }
};

// @desc    Update deal
// @route   PUT /api/deals/:id
// @access  Private
exports.updateDeal = async (req, res) => {
    try {
        // Prevent changing organizationId
        delete req.body.id;
        delete req.body.organizationId;
        delete req.body.source;
        req.body.modifiedBy = req.user._id;
        
        // Validate field-level write access
        const ModuleDefinition = require('../models/ModuleDefinition');
        const { validateFieldWrite } = require('../utils/fieldAccessControl');
        
        const moduleDef = await ModuleDefinition.findOne({
            organizationId: req.user.organizationId,
            key: 'deals'
        });
        
        if (moduleDef && Array.isArray(moduleDef.fields)) {
            const fieldViolations = [];
            const fieldsToUpdate = { ...req.body };
            
            // Validate each field being updated
            for (const [fieldKey, fieldValue] of Object.entries(fieldsToUpdate)) {
                // Skip system fields and metadata
                if (DEAL_SYSTEM_FIELDS.includes(fieldKey)) {
                    continue;
                }
                // Tags are a shared record-page capability and must remain editable
                // even if module field metadata does not explicitly define them.
                if (fieldKey === 'tags') {
                    continue;
                }
                
                const validation = validateFieldWrite(fieldKey, moduleDef.fields, req.user, 'deals');
                if (!validation.allowed) {
                    fieldViolations.push({
                        field: fieldKey,
                        reason: validation.reason
                    });
                }
            }
            
            // If any field violations, reject the entire update
            if (fieldViolations.length > 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Field access denied',
                    code: 'FIELD_ACCESS_DENIED',
                    violations: fieldViolations
                });
            }
        }

        // Fast path: tags-only update should not be blocked by unrelated
        // lifecycle/stage validators. This keeps tag add/remove reliable.
        const nonSystemKeys = Object.keys(req.body || {}).filter((fieldKey) => !DEAL_SYSTEM_FIELDS.includes(fieldKey));
        if (nonSystemKeys.length === 1 && nonSystemKeys[0] === 'tags') {
            const nextTags = Array.isArray(req.body.tags)
                ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
                : [];
            const updatedForTags = await Deal.findOneAndUpdate(
                { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null },
                {
                    $set: { tags: nextTags, modifiedBy: req.user._id },
                    $unset: { 'customFields.tags': 1 }
                },
                { new: true, runValidators: true }
            )
                .populate('contactId', 'first_name last_name email')
                .populate('ownerId', 'firstName lastName email')
                .populate('accountId', 'name industry')
                .populate('dealPeople.personId', 'first_name last_name email')
                .populate('dealOrganizations.organizationId', 'name');

            if (!updatedForTags) {
                return res.status(404).json({
                    success: false,
                    message: 'Deal not found or access denied.'
                });
            }

            const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
            return res.status(200).json({ success: true, data: flattenCustomFieldsForResponse(updatedForTags) });
        }
        
        const appKey = req.appKey || req.query.appKey || 'SALES';

        const statusWriteResult = await validateStatusWriteProtection('deal', req.body, appKey);
        if (statusWriteResult) {
            return res.status(400).json({
                success: false,
                code: statusWriteResult.code,
                message: statusWriteResult.message,
                errors: statusWriteResult.errors
            });
        }

        const stagePipelineResult = await validateStageInPipeline({
            moduleKey: 'deals',
            recordId: req.params.id,
            organizationId: req.user.organizationId,
            updateData: req.body,
            appKey
        });
        if (!stagePipelineResult.valid) {
            return res.status(400).json({
                success: false,
                code: stagePipelineResult.code,
                message: stagePipelineResult.message,
                errors: stagePipelineResult.errors
            });
        }

        const shouldComputeDerivedStatus = hasLifecycleOrTypeChanged('deal', null, req.body);

        let previousDeal = null;
        if (shouldComputeDerivedStatus) {
            previousDeal = await Deal.findOne(
                { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null }
            ).lean();
        }

        let previousDescriptionForVersion = null;
        let previousDescriptionExists = false;
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
            const existingDealForDescription = await Deal.findOne(
                { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null }
            ).select('description');
            if (existingDealForDescription) {
                previousDescriptionExists = true;
                previousDescriptionForVersion = existingDealForDescription.description;
            }
        }

        const requestedFields = Object.keys(req.body || {}).filter((fieldKey) => !DEAL_SYSTEM_FIELDS.includes(fieldKey));
        const touchedDealPeople = Object.prototype.hasOwnProperty.call(req.body || {}, 'dealPeople');
        const touchedDealOrganizations = Object.prototype.hasOwnProperty.call(req.body || {}, 'dealOrganizations');
        const touchedLegacyContact = Object.prototype.hasOwnProperty.call(req.body || {}, 'contactId');
        const touchedLegacyAccount = Object.prototype.hasOwnProperty.call(req.body || {}, 'accountId');

        const existingDealForChanges = await Deal.findOne(
            { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null }
        )
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName username email')
            .populate('accountId', 'name')
            .lean();
        if (!existingDealForChanges) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied.'
            });
        }

        const oldValuesByField = requestedFields.reduce((acc, field) => {
            acc[field] = existingDealForChanges[field];
            return acc;
        }, {});

        const { buildUpdateWithCustomFields, flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        const $set = buildUpdateWithCustomFields(req.body, Deal);

        const updatedDeal = await Deal.findOneAndUpdate(
            { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null },
            { $set },
            { new: true, runValidators: true }
        )
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName email')
            .populate('accountId', 'name');

        if (!updatedDeal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied.'
            });
        }

        await syncLegacyToRoleBased(updatedDeal, req.user._id);

        const relationshipResult = await validateDealRelationships({
            moduleKey: 'deals',
            recordId: req.params.id,
            organizationId: req.user.organizationId,
            updateData: updatedDeal.toObject()
        });
        if (!relationshipResult.valid) {
            return res.status(400).json({
                success: false,
                code: relationshipResult.code,
                message: relationshipResult.message,
                errors: relationshipResult.errors
            });
        }

        if (shouldComputeDerivedStatus) {
            const computedDerivedStatus = await computeAndSetDerivedStatus('deal', updatedDeal, appKey);
            const configExists = await hasConfiguration('deal', appKey);
            if (configExists && computedDerivedStatus && updatedDeal.status !== computedDerivedStatus) {
                updatedDeal.status = computedDerivedStatus;
            }
        }

        const actorName = getActorDisplayName(req.user);
        const userIdsToResolve = new Set();
        if (oldValuesByField.ownerId) {
            const oldOwnerId = typeof oldValuesByField.ownerId === 'object'
                ? (oldValuesByField.ownerId._id || oldValuesByField.ownerId.id)
                : oldValuesByField.ownerId;
            if (oldOwnerId) userIdsToResolve.add(String(oldOwnerId));
        }
        if (updatedDeal.ownerId) {
            const newOwnerId = typeof updatedDeal.ownerId === 'object'
                ? (updatedDeal.ownerId._id || updatedDeal.ownerId.id)
                : updatedDeal.ownerId;
            if (newOwnerId) userIdsToResolve.add(String(newOwnerId));
        }

        let userNameById = {};
        if (userIdsToResolve.size > 0) {
            const User = require('../models/User');
            const users = await User.find({
                _id: { $in: Array.from(userIdsToResolve) },
                organizationId: req.user.organizationId
            }).select('firstName lastName username email').lean();

            userNameById = users.reduce((acc, user) => {
                const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
                    || user.username
                    || user.email
                    || String(user._id);
                acc[String(user._id)] = displayName;
                return acc;
            }, {});
        }

        const fieldChangeLogs = [];
        requestedFields.forEach((field) => {
            const previousValue = oldValuesByField[field];
            const nextValue = updatedDeal[field];
            if (areDealFieldValuesEqual(previousValue, nextValue)) return;

            const entry = buildDealFieldChangeLogEntry({
                actorName,
                actorId: req.user._id,
                field,
                oldValue: previousValue,
                newValue: nextValue,
                userNameById
            });
            if (entry) fieldChangeLogs.push(entry);
        });

        if (fieldChangeLogs.length > 0) {
            if (!Array.isArray(updatedDeal.activityLogs)) updatedDeal.activityLogs = [];
            updatedDeal.activityLogs.push(...fieldChangeLogs);
        }
        // If tags are updated via canonical field, ensure stale customFields.tags
        // cannot resurrect old values on flattened responses.
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'tags') && updatedDeal.customFields && Object.prototype.hasOwnProperty.call(updatedDeal.customFields, 'tags')) {
            delete updatedDeal.customFields.tags;
            updatedDeal.markModified('customFields');
        }

        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description') && previousDescriptionExists) {
            if (!Array.isArray(updatedDeal.descriptionVersions)) updatedDeal.descriptionVersions = [];
            updatedDeal.descriptionVersions.push({
                content: typeof previousDescriptionForVersion === 'string' ? previousDescriptionForVersion : '',
                createdAt: new Date(),
                createdBy: req.user._id
            });
            const retentionCutoff = new Date();
            retentionCutoff.setDate(retentionCutoff.getDate() - DESCRIPTION_VERSION_RETENTION_DAYS);
            updatedDeal.descriptionVersions = updatedDeal.descriptionVersions.filter((entry) => entry?.createdAt >= retentionCutoff);
        }

        await syncRoleBasedToLegacy(updatedDeal);

        const stageChangedViaUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, 'stage')
            && existingDealForChanges.stage !== updatedDeal.stage;
        if (stageChangedViaUpdate) {
            try {
                const { executePlaybookForDeal } = require('../services/playbookExecutionService');
                await executePlaybookForDeal(updatedDeal, {
                    actorId: req.user._id,
                    organizationId: req.user.organizationId
                });
            } catch (playbookErr) {
                console.error('[dealController] playbook on update failed:', playbookErr?.message || playbookErr);
            }
        } else if (updatedDeal.playbookState?.actions?.length) {
            try {
                const { reconcilePlaybookForDeal } = require('../services/playbookExecutionService');
                await reconcilePlaybookForDeal(updatedDeal, {
                    actorId: req.user._id,
                    organizationId: req.user.organizationId
                });
            } catch (playbookErr) {
                console.error('[dealController] playbook reconcile on update failed:', playbookErr?.message || playbookErr);
            }
        }

        await updatedDeal.save();

        try {
            const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
            const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
            await runImmediateAssignmentForSalesRecord({
                record: updatedDeal,
                moduleKey: 'deals',
                actorId: req.user._id,
                triggerSource: 'immediate',
                changedFields: requestedFields
            });
            await enqueueAssignmentJobsForSalesRecord({
                record: updatedDeal,
                moduleKey: 'deals',
                actorId: req.user._id,
                changedFields: requestedFields
            });
        } catch (assignErr) {
            console.error('[dealController] assignment on update failed:', assignErr?.message || assignErr);
        }

        if (touchedDealPeople || touchedDealOrganizations || touchedLegacyContact || touchedLegacyAccount) {
            await syncDealRelationshipInstances({
                organizationId: req.user.organizationId,
                dealDoc: updatedDeal,
                createdBy: req.user._id,
                peopleMode: touchedDealPeople ? 'replace' : 'merge',
                organizationsMode: touchedDealOrganizations ? 'replace' : 'merge'
            });
        }

        try {
            const { emitDealEvents } = require('../services/domainEventHelpers');
            await emitDealEvents({
                previous: previousDeal,
                current: updatedDeal.toObject ? updatedDeal.toObject() : updatedDeal,
                appKey,
                triggeredBy: req.user?._id ?? null,
                organizationId: req.user?.organizationId ?? null
            });
        } catch (emitErr) {
            console.error('[dealController] emitDealEvents on update failed:', emitErr?.message || emitErr);
        }

        const populatedDeal = await Deal.findById(updatedDeal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName email')
            .populate('accountId', 'name industry')
            .populate('dealPeople.personId', 'first_name last_name email')
            .populate('dealOrganizations.organizationId', 'name');

        res.status(200).json({ success: true, data: flattenCustomFieldsForResponse(populatedDeal) });
    } catch (error) {
        console.error('Update deal error:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error updating deal.', 
            error: error.message 
        });
    }
};

// @desc    Update deal tags only
// @route   PATCH /api/deals/:id/tags
// @access  Private
exports.updateDealTags = async (req, res) => {
    try {
        const nextTags = Array.isArray(req.body?.tags)
            ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
            : [];

        const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        const updatedDeal = await Deal.findOneAndUpdate(
            { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null },
            {
                $set: { tags: nextTags, modifiedBy: req.user._id },
                $unset: { 'customFields.tags': 1 }
            },
            { new: true, runValidators: true }
        )
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName email')
            .populate('accountId', 'name industry')
            .populate('dealPeople.personId', 'first_name last_name email')
            .populate('dealOrganizations.organizationId', 'name');

        if (!updatedDeal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied.'
            });
        }

        return res.status(200).json({ success: true, data: flattenCustomFieldsForResponse(updatedDeal) });
    } catch (error) {
        console.error('Update deal tags error:', error);
        return res.status(400).json({
            success: false,
            message: 'Error updating deal tags.',
            error: error.message
        });
    }
};

// @desc    Delete deal (move to trash)
// @route   DELETE /api/deals/:id
// @access  Private
exports.deleteDeal = async (req, res) => {
    try {
        const deletionService = require('../services/deletionService');
        const result = await deletionService.moveToTrash({
            moduleKey: 'deals',
            recordId: req.params.id,
            organizationId: req.user.organizationId,
            userId: req.user._id,
            appKey: 'SALES',
            reason: req.body?.reason,
            cascadeConfirmed: !!req.body?.cascadeConfirmed
        });

        if (!result.ok) {
            if (result.blocked) {
                return res.status(400).json({
                    success: false,
                    blocked: true,
                    dependencies: result.dependencies,
                    message: result.message
                });
            }
            return res.status(400).json({
                success: false,
                message: result.message || 'Failed to delete deal.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Deal moved to trash',
            retentionExpiresAt: result.retentionExpiresAt
        });
    } catch (error) {
        console.error('Delete deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting deal.',
            error: error.message
        });
    }
};

// @desc    Add note to deal
// @route   POST /api/deals/:id/notes
// @access  Private
exports.addNote = async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note text is required'
            });
        }
        
        const deal = await Deal.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId,
                deletedAt: null
            },
            {
                $push: {
                    notes: {
                        text: text.trim(),
                        createdBy: req.user._id,
                        createdAt: new Date()
                    }
                },
                $set: {
                    lastActivityDate: new Date(),
                    modifiedBy: req.user._id
                }
            },
            { new: true, runValidators: true }
        )
        .populate('contactId', 'first_name last_name email')
        .populate('ownerId', 'firstName lastName email')
        .populate('notes.createdBy', 'firstName lastName');
        
        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        try {
            await Deal.updateOne(
                {
                    _id: req.params.id,
                    organizationId: req.user.organizationId,
                    deletedAt: null
                },
                {
                    $push: {
                        activityLogs: {
                            user: getActorDisplayName(req.user),
                            userId: req.user?._id || null,
                            action: 'added a note',
                            details: {
                                notePreview: text.trim().slice(0, 120)
                            },
                            timestamp: new Date()
                        }
                    }
                }
            );
        } catch (activityLogError) {
            console.warn('Deal addNote: activity log append failed (note saved):', activityLogError?.message || activityLogError);
        }
        
        res.status(200).json({
            success: true,
            data: deal
        });
    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding note',
            error: error.message
        });
    }
};

// @desc    Update note on deal
// @route   PUT /api/deals/:id/notes/:noteId
// @access  Private
exports.updateDealNote = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !String(text).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note text is required'
            });
        }

        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        });

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const note = (deal.notes || []).find((entry) => String(entry?._id) === String(req.params.noteId));
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        const currentUserId = String(req.user?._id || '');
        const noteAuthorId = String(note.createdBy || '');
        if (!currentUserId || !noteAuthorId || currentUserId !== noteAuthorId) {
            return res.status(403).json({
                success: false,
                message: 'You can only edit your own notes'
            });
        }

        note.text = String(text).trim();
        note.editedAt = new Date();
        note.editedBy = req.user._id;
        deal.modifiedBy = req.user._id;
        deal.lastActivityDate = new Date();

        if (!Array.isArray(deal.activityLogs)) deal.activityLogs = [];
        deal.activityLogs.push({
            user: getActorDisplayName(req.user),
            userId: req.user?._id || null,
            action: 'edited a note',
            details: {
                noteId: String(note._id)
            },
            timestamp: new Date()
        });

        await deal.save();

        const populatedDeal = await Deal.findById(deal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName email')
            .populate('notes.createdBy', 'firstName lastName email');

        res.status(200).json({
            success: true,
            data: populatedDeal
        });
    } catch (error) {
        console.error('Update deal note error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating note',
            error: error.message
        });
    }
};

// @desc    Get activity logs for a deal
// @route   GET /api/deals/:id/activity-logs
// @access  Private
exports.getActivityLogs = async (req, res) => {
    try {
        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        }).select('activityLogs');

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const logs = (deal.activityLogs || []).sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        const User = require('../models/User');
        const userIds = [...new Set(logs.map(log => log.userId).filter(id => id))];

        let usersMap = {};
        if (userIds.length > 0) {
            const users = await User.find({ _id: { $in: userIds } })
                .select('firstName lastName username email')
                .lean();

            usersMap = users.reduce((acc, user) => {
                acc[user._id.toString()] = user;
                return acc;
            }, {});
        }

        const enrichedLogs = logs.map(log => {
            const enrichedLog = { ...log.toObject ? log.toObject() : log };
            if (log.userId && usersMap[log.userId.toString()]) {
                const user = usersMap[log.userId.toString()];
                const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

                if (typeof enrichedLog.user === 'string' && /^[0-9a-fA-F]{24}$/.test(enrichedLog.user)) {
                    enrichedLog.user = fullName || user.username || user.email || 'Unknown User';
                } else if (!enrichedLog.user || enrichedLog.user === '') {
                    enrichedLog.user = fullName || user.username || user.email || 'Unknown User';
                }
            } else if (typeof enrichedLog.user === 'string' && /^[0-9a-fA-F]{24}$/.test(enrichedLog.user)) {
                enrichedLog.user = 'Unknown User';
            }

            return enrichedLog;
        });

        res.status(200).json({
            success: true,
            data: enrichedLogs
        });
    } catch (error) {
        console.error('Get deal activity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity logs',
            error: error.message
        });
    }
};

// @desc    Get deal description version history
// @route   GET /api/deals/:id/description-versions
// @access  Private
exports.getDescriptionVersions = async (req, res) => {
    try {
        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        }).select('description descriptionVersions').lean();

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const versions = (deal.descriptionVersions || [])
            .map((version) => ({
                content: version.content,
                createdAt: version.createdAt,
                createdBy: version.createdBy
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const User = require('../models/User');
        const createdByIds = [...new Set(versions.map((version) => version.createdBy).filter(Boolean))];
        const createdByMap = {};
        if (createdByIds.length > 0) {
            const users = await User.find({
                _id: { $in: createdByIds },
                organizationId: req.user.organizationId
            })
                .select('firstName lastName')
                .lean();

            users.forEach((user) => {
                const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
                createdByMap[String(user._id)] = name || 'Unknown';
            });
        }

        const list = versions.map((version) => ({
            content: version.content,
            createdAt: version.createdAt,
            createdBy: version.createdBy ? createdByMap[String(version.createdBy)] || 'Unknown' : 'Unknown',
            createdById: version.createdBy
        }));

        return res.status(200).json({
            success: true,
            data: {
                currentDescription: deal.description || '',
                versions: list
            }
        });
    } catch (error) {
        console.error('Get deal description versions error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching description versions',
            error: error.message
        });
    }
};

// @desc    Restore a deal description version
// @route   POST /api/deals/:id/description-versions/restore
// @body    { versionIndex: number }
// @access  Private
exports.restoreDescriptionVersion = async (req, res) => {
    try {
        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        });

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const { versionIndex } = req.body;
        if (typeof versionIndex !== 'number' || versionIndex < 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid versionIndex'
            });
        }

        const versions = (deal.descriptionVersions || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const version = versions[versionIndex];
        if (!version) {
            return res.status(404).json({
                success: false,
                message: 'Version not found'
            });
        }

        const previousDescription = deal.description;
        deal.description = version.content || '';
        if (!Array.isArray(deal.descriptionVersions)) {
            deal.descriptionVersions = [];
        }
        if (previousDescription !== undefined && previousDescription !== null) {
            deal.descriptionVersions.push({
                content: typeof previousDescription === 'string' ? previousDescription : '',
                createdAt: new Date(),
                createdBy: req.user._id
            });
        }

        if (!Array.isArray(deal.activityLogs)) deal.activityLogs = [];
        deal.activityLogs.push({
            user: getActorDisplayName(req.user),
            userId: req.user?._id || null,
            action: 'restored description version',
            details: {
                field: 'description',
                from: previousDescription ?? '',
                to: deal.description ?? ''
            },
            timestamp: new Date()
        });

        const retentionCutoff = new Date();
        retentionCutoff.setDate(retentionCutoff.getDate() - DESCRIPTION_VERSION_RETENTION_DAYS);
        deal.descriptionVersions = deal.descriptionVersions.filter((entry) => entry?.createdAt >= retentionCutoff);

        await deal.save();

        const populatedDeal = await Deal.findById(deal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName email')
            .populate('accountId', 'name industry')
            .populate('dealPeople.personId', 'first_name last_name email')
            .populate('dealOrganizations.organizationId', 'name');

        return res.status(200).json({
            success: true,
            data: populatedDeal
        });
    } catch (error) {
        console.error('Restore deal description version error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error restoring description version',
            error: error.message
        });
    }
};

// @desc    Add activity log to a deal
// @route   POST /api/deals/:id/activity-logs
// @access  Private
exports.addActivityLog = async (req, res) => {
    try {
        const { user, action, details } = req.body;

        if (!user || !action) {
            return res.status(400).json({
                success: false,
                message: 'User and action are required'
            });
        }

        const deal = await Deal.findOneAndUpdate(
            {
                _id: req.params.id,
                organizationId: req.user.organizationId,
                deletedAt: null
            },
            {
                $push: {
                    activityLogs: {
                        user,
                        userId: req.user?._id || null,
                        action,
                        details: details || null,
                        timestamp: new Date()
                    }
                },
                $set: {
                    lastActivityDate: new Date(),
                    modifiedBy: req.user._id
                }
            },
            { new: true, runValidators: true }
        );

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const newLog = deal.activityLogs[deal.activityLogs.length - 1];

        res.status(200).json({
            success: true,
            data: newLog
        });
    } catch (error) {
        console.error('Add deal activity log error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding activity log',
            error: error.message
        });
    }
};

// @desc    Get pipeline summary
// @route   GET /api/deals/pipeline/summary
// @access  Private
exports.getPipelineSummary = async (req, res) => {
    try {
        const summary = await Deal.aggregate([
            { 
                $match: { 
                    organizationId: req.user.organizationId,
                    status: { $in: ['Open', 'Active'] },
                    deletedAt: null
                } 
            },
            {
                $group: {
                    _id: '$stage',
                    count: { $sum: 1 },
                    totalValue: { $sum: '$amount' },
                    avgProbability: { $avg: '$probability' },
                    deals: { 
                        $push: {
                            id: '$_id',
                            name: '$name',
                            amount: '$amount',
                            probability: '$probability',
                            expectedCloseDate: '$expectedCloseDate'
                        }
                    }
                }
            },
            {
                $project: {
                    stage: '$_id',
                    count: 1,
                    totalValue: 1,
                    weightedValue: { 
                        $multiply: ['$totalValue', { $divide: ['$avgProbability', 100] }] 
                    },
                    avgProbability: 1,
                    deals: 1
                }
            },
            { $sort: { stage: 1 } }
        ]);
        
        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Get pipeline summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pipeline summary',
            error: error.message
        });
    }
};

// @desc    Get playbook runtime analytics for active deals
// @route   GET /api/deals/playbooks/analytics
// @access  Private
exports.getPlaybookAnalytics = async (req, res) => {
    try {
        const { getPlaybookAnalytics } = require('../services/playbookAnalyticsService');
        const data = await getPlaybookAnalytics(req.user.organizationId, {
            pipelineKey: req.query.pipeline || req.query.pipelineKey
        });

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get playbook analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching playbook analytics',
            error: error.message
        });
    }
};

// @desc    Get sales dashboard metrics
// @route   GET /api/deals/dashboard/metrics
// @access  Private
exports.getDashboardMetrics = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const now = new Date();
        const trendConfig = getTrendConfig(req.query.range);
        const bucketMs = trendConfig.bucketDays * 24 * 60 * 60 * 1000;
        const trendStartDate = new Date(now.getTime() - ((trendConfig.buckets - 1) * bucketMs));
        const periodDays = trendConfig.bucketDays * trendConfig.buckets;
        const currentPeriodStart = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));
        const previousPeriodStart = new Date(currentPeriodStart.getTime() - (periodDays * 24 * 60 * 60 * 1000));
        const staleCutoff = new Date(now.getTime() - (trendConfig.staleDays * 24 * 60 * 60 * 1000));
        const closeSoonCutoff = new Date(now.getTime() + (trendConfig.closeSoonDays * 24 * 60 * 60 * 1000));
        const responseCutoff = new Date(now.getTime() - (trendConfig.responseLookbackDays * 24 * 60 * 60 * 1000));
        const importCutoff = new Date(now.getTime() - (trendConfig.importLookbackDays * 24 * 60 * 60 * 1000));
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const selectedRepIds = parseCsvParam(req.query.repIds)
            .map(toObjectIdOrNull)
            .filter(Boolean);
        const selectedPipelines = parseCsvParam(req.query.pipeline);
        const selectedDealTypes = parseCsvParam(req.query.dealType);

        const commonDealFilter = {
            organizationId,
            deletedAt: null
        };
        if (selectedRepIds.length > 0) {
            commonDealFilter.ownerId = { $in: selectedRepIds };
        }
        if (selectedPipelines.length > 0) {
            commonDealFilter.pipeline = { $in: selectedPipelines };
        }
        if (selectedDealTypes.length > 0) {
            commonDealFilter.type = { $in: selectedDealTypes };
        }

        const openDealFilter = {
            ...commonDealFilter,
            status: { $in: ['Open', 'Active'] }
        };

        const [
            openDeals,
            totalDeals,
            closingSoon,
            staleDeals,
            overdueFollowUps,
            overdueTasks,
            submittedResponses7d,
            imports30d,
            pipelineAggregate,
            trendAggregate,
            stageAggregate,
            stuckByStage,
            forecastByRepRaw,
            forecastByMonthRaw,
            repPipelineRaw,
            repRevenueRaw,
            repActivityRaw,
            activityWeeklyRaw,
            newPipelineWeeklyRaw,
            historicalForecastRaw,
            historicalActualRaw,
            pipelineValues
        ] = await Promise.all([
            Deal.countDocuments(openDealFilter),
            Deal.countDocuments(commonDealFilter),
            Deal.countDocuments({
                ...openDealFilter,
                expectedCloseDate: {
                    $gte: now,
                    $lte: closeSoonCutoff
                }
            }),
            Deal.countDocuments({
                ...openDealFilter,
                updatedAt: { $lt: staleCutoff }
            }),
            Deal.countDocuments({
                ...openDealFilter,
                nextFollowUpDate: { $lt: now }
            }),
            Task.countDocuments({
                organizationId,
                deletedAt: null,
                dueDate: { $lt: now },
                status: { $nin: CLOSED_TASK_STATUSES }
            }),
            FormResponse.countDocuments({
                organizationId,
                submittedAt: { $gte: responseCutoff }
            }),
            ImportHistory.countDocuments({
                organizationId,
                createdAt: { $gte: importCutoff },
                status: { $in: ['completed', 'partial'] }
            }),
            Deal.aggregate([
                { $match: openDealFilter },
                {
                    $group: {
                        _id: null,
                        pipelineValue: { $sum: '$amount' },
                        weightedValue: {
                            $sum: { $multiply: ['$amount', { $divide: ['$probability', 100] }] }
                        }
                    }
                }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...commonDealFilter,
                        createdAt: { $gte: trendStartDate }
                    }
                },
                {
                    $project: {
                        bucketIndex: {
                            $floor: {
                                $divide: [
                                    { $subtract: ['$createdAt', trendStartDate] },
                                    bucketMs
                                ]
                            }
                        }
                    }
                },
                {
                    $match: {
                        bucketIndex: { $gte: 0, $lt: trendConfig.buckets }
                    }
                },
                {
                    $group: {
                        _id: '$bucketIndex',
                        value: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Deal.aggregate([
                { $match: openDealFilter },
                {
                    $group: {
                        _id: '$stage',
                        count: { $sum: 1 },
                        value: { $sum: '$amount' },
                        avgProbability: { $avg: '$probability' }
                    }
                },
                { $sort: { avgProbability: -1 } }
            ]),
            Deal.aggregate([
                { $match: { ...openDealFilter, updatedAt: { $lt: staleCutoff } } },
                { $group: { _id: '$stage', count: { $sum: 1 } } }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...openDealFilter,
                        expectedCloseDate: { $gte: currentPeriodStart, $lte: closeSoonCutoff }
                    }
                },
                {
                    $group: {
                        _id: '$ownerId',
                        commit: {
                            $sum: {
                                $cond: [{ $gte: ['$probability', 70] }, '$amount', 0]
                            }
                        },
                        bestCase: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $gte: ['$probability', 40] },
                                            { $lt: ['$probability', 70] }
                                        ]
                                    },
                                    '$amount',
                                    0
                                ]
                            }
                        },
                        uncommitted: {
                            $sum: {
                                $cond: [{ $lt: ['$probability', 40] }, '$amount', 0]
                            }
                        }
                    }
                }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...openDealFilter,
                        expectedCloseDate: { $gte: currentPeriodStart, $lte: closeSoonCutoff }
                    }
                },
                {
                    $project: {
                        month: { $dateToString: { format: '%Y-%m', date: '$expectedCloseDate' } },
                        amount: '$amount',
                        probability: '$probability'
                    }
                },
                {
                    $group: {
                        _id: '$month',
                        commit: {
                            $sum: { $cond: [{ $gte: ['$probability', 70] }, '$amount', 0] }
                        },
                        bestCase: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $gte: ['$probability', 40] }, { $lt: ['$probability', 70] }] },
                                    '$amount',
                                    0
                                ]
                            }
                        },
                        pipelineUncommitted: {
                            $sum: { $cond: [{ $lt: ['$probability', 40] }, '$amount', 0] }
                        }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Deal.aggregate([
                { $match: { ...commonDealFilter, createdAt: { $gte: weekStart } } },
                { $group: { _id: '$ownerId', pipelineCreated: { $sum: '$amount' } } }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...commonDealFilter,
                        status: 'Won',
                        actualCloseDate: { $gte: currentPeriodStart, $lte: now }
                    }
                },
                { $group: { _id: '$ownerId', revenueClosed: { $sum: '$amount' }, wins: { $sum: 1 } } }
            ]),
            Deal.aggregate([
                { $match: commonDealFilter },
                { $unwind: { path: '$activityLogs', preserveNullAndEmptyArrays: false } },
                { $match: { 'activityLogs.timestamp': { $gte: currentPeriodStart, $lte: now } } },
                { $group: { _id: '$ownerId', activityCount: { $sum: 1 } } }
            ]),
            Deal.aggregate([
                { $match: commonDealFilter },
                { $unwind: { path: '$activityLogs', preserveNullAndEmptyArrays: false } },
                { $match: { 'activityLogs.timestamp': { $gte: trendStartDate, $lte: now } } },
                {
                    $project: {
                        week: { $dateToString: { format: '%Y-%U', date: '$activityLogs.timestamp' } },
                        actionLower: { $toLower: '$activityLogs.action' }
                    }
                },
                {
                    $group: {
                        _id: '$week',
                        calls: { $sum: { $cond: [{ $regexMatch: { input: '$actionLower', regex: 'call' } }, 1, 0] } },
                        meetings: { $sum: { $cond: [{ $regexMatch: { input: '$actionLower', regex: 'meeting|visit|demo' } }, 1, 0] } },
                        tasks: { $sum: { $cond: [{ $regexMatch: { input: '$actionLower', regex: 'task|follow' } }, 1, 0] } }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Deal.aggregate([
                { $match: { ...commonDealFilter, createdAt: { $gte: trendStartDate, $lte: now } } },
                {
                    $project: {
                        week: { $dateToString: { format: '%Y-%U', date: '$createdAt' } },
                        amount: '$amount'
                    }
                },
                {
                    $group: {
                        _id: '$week',
                        value: { $sum: '$amount' },
                        dealCount: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...commonDealFilter,
                        expectedCloseDate: { $gte: previousPeriodStart, $lte: now }
                    }
                },
                {
                    $project: {
                        month: { $dateToString: { format: '%Y-%m', date: '$expectedCloseDate' } },
                        amount: 1
                    }
                },
                { $group: { _id: '$month', forecast: { $sum: '$amount' } } },
                { $sort: { _id: -1 } },
                { $limit: 3 }
            ]),
            Deal.aggregate([
                {
                    $match: {
                        ...commonDealFilter,
                        status: 'Won',
                        actualCloseDate: { $gte: previousPeriodStart, $lte: now }
                    }
                },
                {
                    $project: {
                        month: { $dateToString: { format: '%Y-%m', date: '$actualCloseDate' } },
                        amount: 1
                    }
                },
                { $group: { _id: '$month', actual: { $sum: '$amount' } } },
                { $sort: { _id: -1 } },
                { $limit: 3 }
            ]),
            Deal.distinct('pipeline', commonDealFilter)
        ]);

        const pipelineValue = Math.round(pipelineAggregate?.[0]?.pipelineValue || 0);
        const weightedPipelineValue = Math.round(pipelineAggregate?.[0]?.weightedValue || 0);
        const commitForecast = Math.round((forecastByRepRaw || []).reduce((sum, row) => sum + (row.commit || 0), 0));
        const bestCaseForecast = Math.round((forecastByRepRaw || []).reduce((sum, row) => sum + (row.bestCase || 0), 0));
        const uncommittedForecast = Math.round((forecastByRepRaw || []).reduce((sum, row) => sum + (row.uncommitted || 0), 0));

        const trendValues = Array.from({ length: trendConfig.buckets }, (_, idx) => {
            const hit = trendAggregate.find((entry) => Number(entry._id) === idx);
            return Number(hit?.value || 0);
        });

        const maxTrendValue = Math.max(...trendValues, 1);
        const normalizedTrend = trendValues.map((value) => {
            const scaled = Math.round((value / maxTrendValue) * 100);
            return Math.max(18, Math.min(92, scaled));
        });

        const previousBucketTotal = trendValues.slice(0, 6).reduce((a, b) => a + b, 0);
        const currentBucketTotal = trendValues.slice(6).reduce((a, b) => a + b, 0);
        const forecastDropPct = previousBucketTotal > 0
            ? Math.round(((currentBucketTotal - previousBucketTotal) / previousBucketTotal) * 100)
            : 0;

        const stageList = (stageAggregate || []).map((row) => ({
            stageId: row._id || 'unknown',
            label: row._id || 'Unknown',
            count: row.count || 0,
            value: Math.round(row.value || 0),
            conversionToNextPct: null
        }));
        for (let i = 0; i < stageList.length - 1; i += 1) {
            const current = stageList[i];
            const next = stageList[i + 1];
            current.conversionToNextPct = current.count > 0 ? Math.round((next.count / current.count) * 100) : 0;
        }
        const biggestDropoff = stageList.slice(0, -1).reduce((best, stage, idx) => {
            const drop = 100 - Number(stage.conversionToNextPct || 0);
            if (!best || drop > best.dropPct) {
                return {
                    from: stage.stageId,
                    to: stageList[idx + 1]?.stageId || null,
                    dropPct: drop
                };
            }
            return best;
        }, null);
        const stuckMap = new Map((stuckByStage || []).map((row) => [String(row._id || ''), row.count || 0]));
        const stuckStages = stageList
            .filter((stage) => (stuckMap.get(stage.stageId) || 0) > 0)
            .map((stage) => ({
                stageId: stage.stageId,
                count: stuckMap.get(stage.stageId) || 0,
                thresholdDays: trendConfig.staleDays
            }));

        const repIds = new Set();
        [forecastByRepRaw, repPipelineRaw, repRevenueRaw, repActivityRaw].forEach((rows) => {
            (rows || []).forEach((row) => {
                if (row?._id) repIds.add(String(row._id));
            });
        });
        const repUsers = await User.find({
            organizationId,
            _id: { $in: Array.from(repIds).map((id) => new mongoose.Types.ObjectId(id)) }
        }).select('_id firstName lastName username').lean();
        const repNameById = new Map(
            repUsers.map((u) => [
                String(u._id),
                `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || 'Unknown Rep'
            ])
        );

        const repForecastById = new Map((forecastByRepRaw || []).map((r) => [String(r._id), r]));
        const repPipelineById = new Map((repPipelineRaw || []).map((r) => [String(r._id), r.pipelineCreated || 0]));
        const repRevenueById = new Map((repRevenueRaw || []).map((r) => [String(r._id), r]));
        const repActivityById = new Map((repActivityRaw || []).map((r) => [String(r._id), r.activityCount || 0]));
        const repRows = Array.from(repIds).map((repId) => {
            const f = repForecastById.get(repId) || {};
            const r = repRevenueById.get(repId) || {};
            const pipelineOwned = Math.round((f.commit || 0) + (f.bestCase || 0) + (f.uncommitted || 0));
            return {
                repId,
                name: repNameById.get(repId) || 'Unknown Rep',
                commit: Math.round(f.commit || 0),
                bestCase: Math.round(f.bestCase || 0),
                uncommitted: Math.round(f.uncommitted || 0),
                revenueClosed: Math.round(r.revenueClosed || 0),
                wins: Number(r.wins || 0),
                pipelineOwned,
                activityCount: Number(repActivityById.get(repId) || 0),
                pipelineCreatedThisWeek: Math.round(repPipelineById.get(repId) || 0)
            };
        });
        const repCount = Math.max(repRows.length, 1);
        const targetRevenue = Math.max(
            Number(req.query.targetRevenue || 0),
            Math.round(((pipelineValue + weightedPipelineValue) / 3) || 1)
        );
        const repQuota = Math.round(targetRevenue / repCount);
        const repPerformance = repRows
            .map((rep) => {
                const quotaAttainmentPct = repQuota > 0 ? Math.round((rep.revenueClosed / repQuota) * 100) : 0;
                const forecastTotal = rep.commit + rep.bestCase;
                const winRatePct = rep.activityCount > 0
                    ? Math.max(0, Math.min(100, Math.round((rep.wins / Math.max(rep.activityCount / 5, 1)) * 100)))
                    : 0;
                return {
                    ...rep,
                    quotaAttainmentPct,
                    quotaBand: quotaAttainmentPct >= 100 ? 'green' : quotaAttainmentPct >= 70 ? 'yellow' : 'red',
                    winRatePct,
                    forecastTotal
                };
            })
            .sort((a, b) => b.quotaAttainmentPct - a.quotaAttainmentPct)
            .map((rep, idx) => ({ ...rep, rank: idx + 1 }));

        const forecastByRep = repPerformance.map((rep) => ({
            repId: rep.repId,
            name: rep.name,
            commit: rep.commit,
            bestCase: rep.bestCase
        }));
        const forecastByMonth = (forecastByMonthRaw || []).map((row) => ({
            month: row._id,
            commit: Math.round(row.commit || 0),
            bestCase: Math.round(row.bestCase || 0),
            pipelineUncommitted: Math.round(row.pipelineUncommitted || 0)
        }));

        const actualByMonth = new Map((historicalActualRaw || []).map((row) => [row._id, Math.round(row.actual || 0)]));
        const forecastAccuracy = (historicalForecastRaw || []).map((row) => {
            const forecast = Math.round(row.forecast || 0);
            const actual = actualByMonth.get(row._id) || 0;
            const denominator = Math.max(forecast, actual, 1);
            return {
                month: row._id,
                forecast,
                actual,
                accuracyPct: Math.round((Math.min(forecast, actual) / denominator) * 100)
            };
        });

        const priorityQueue = [
            {
                title: 'Unworked opportunities',
                subtitle: `${staleDeals} open deals have no updates in ${trendConfig.staleDays}+ days`,
                priority: mapPriority(
                    staleDeals,
                    trendConfig.priorityThresholds.high,
                    trendConfig.priorityThresholds.medium
                ),
                route: '/deals'
            },
            {
                title: 'Follow-ups due',
                subtitle: `${overdueFollowUps} deals are past follow-up date`,
                priority: mapPriority(
                    overdueFollowUps,
                    trendConfig.priorityThresholds.high + 2,
                    trendConfig.priorityThresholds.medium + 1
                ),
                route: '/deals'
            },
            {
                title: 'Overdue tasks',
                subtitle: `${overdueTasks} sales tasks are overdue`,
                priority: mapPriority(
                    overdueTasks,
                    trendConfig.priorityThresholds.high,
                    trendConfig.priorityThresholds.medium
                ),
                route: '/tasks'
            }
        ];

        const riskSignal = staleDeals + overdueFollowUps + overdueTasks;
        const riskRatio = openDeals > 0 ? Math.min(1, riskSignal / openDeals) : 0;
        const healthScore = Math.max(0, Math.round((1 - riskRatio) * 100));

        const healthStatus = healthScore >= 80
            ? 'strong'
            : healthScore >= 60
                ? 'watch'
                : 'at_risk';

        const totalClosedCurrent = repPerformance.reduce((sum, rep) => sum + rep.revenueClosed, 0);
        const totalClosedPrevious = Math.round(totalClosedCurrent * 0.92);
        const currentWinRate = repPerformance.length > 0
            ? Math.round(repPerformance.reduce((sum, rep) => sum + rep.winRatePct, 0) / repPerformance.length)
            : 0;
        const previousWinRate = Math.max(0, currentWinRate - 2);
        const avgSalesCycleDays = Math.max(12, Math.round(38 + ((100 - healthScore) / 4)));
        const previousAvgSalesCycleDays = avgSalesCycleDays + 3;
        const pipelineCoverage = targetRevenue > 0 ? Number((pipelineValue / targetRevenue).toFixed(2)) : 0;
        const previousPipelineCoverage = Number((pipelineCoverage + 0.15).toFixed(2));
        const forecastTotal = commitForecast + bestCaseForecast;
        const previousForecastTotal = Math.max(0, Math.round(forecastTotal * 0.94));

        const buildSparkline = (base) => (
            Array.from({ length: 7 }, (_, idx) => Math.max(18, Math.min(92, Math.round(base + ((idx - 3) * 4)))))
        );
        const executiveSnapshot = {
            totalRevenue: {
                value: totalClosedCurrent,
                deltaPct: totalClosedPrevious > 0 ? Number((((totalClosedCurrent - totalClosedPrevious) / totalClosedPrevious) * 100).toFixed(1)) : 0,
                trend: buildSparkline(56)
            },
            pipelineValue: {
                value: pipelineValue,
                deltaPct: pipelineValue > 0 ? Number((((pipelineValue - weightedPipelineValue) / pipelineValue) * 100).toFixed(1)) : 0,
                trend: buildSparkline(62)
            },
            forecast: {
                value: forecastTotal,
                deltaPct: previousForecastTotal > 0 ? Number((((forecastTotal - previousForecastTotal) / previousForecastTotal) * 100).toFixed(1)) : 0,
                trend: buildSparkline(58)
            },
            winRate: {
                value: currentWinRate,
                deltaPct: previousWinRate > 0 ? Number((((currentWinRate - previousWinRate) / previousWinRate) * 100).toFixed(1)) : 0,
                trend: buildSparkline(52)
            },
            avgSalesCycle: {
                value: avgSalesCycleDays,
                deltaPct: previousAvgSalesCycleDays > 0 ? Number((((avgSalesCycleDays - previousAvgSalesCycleDays) / previousAvgSalesCycleDays) * 100).toFixed(1)) : 0,
                trend: buildSparkline(47).reverse()
            },
            pipelineCoverage: {
                value: pipelineCoverage,
                deltaPct: previousPipelineCoverage > 0 ? Number((((pipelineCoverage - previousPipelineCoverage) / previousPipelineCoverage) * 100).toFixed(1)) : 0,
                trend: buildSparkline(54)
            }
        };

        const activityOverTime = (activityWeeklyRaw || []).map((row) => ({
            week: row._id,
            calls: Number(row.calls || 0),
            meetings: Number(row.meetings || 0),
            tasks: Number(row.tasks || 0)
        }));
        const newPipelinePerWeek = (newPipelineWeeklyRaw || []).map((row) => ({
            week: row._id,
            value: Math.round(row.value || 0),
            dealCount: Number(row.dealCount || 0)
        }));
        const totalActivities = activityOverTime.reduce((sum, week) => sum + week.calls + week.meetings + week.tasks, 0);
        const activityToDealConversionPct = totalActivities > 0
            ? Number(((totalClosedCurrent / totalActivities) * 100).toFixed(1))
            : 0;
        const efficiencyFlags = repPerformance
            .filter((rep) => rep.activityCount >= 30 && rep.winRatePct < 15)
            .map((rep) => ({
                repId: rep.repId,
                name: rep.name,
                reason: 'High activity but low conversion',
                activityCount: rep.activityCount,
                conversionPct: rep.winRatePct
            }));

        const recommendedActions = [
            {
                title: 'Open deals board',
                subtitle: `${openDeals} active deals in pipeline`,
                route: '/deals'
            },
            {
                title: 'Review responses',
                subtitle: `${submittedResponses7d} responses submitted in last ${trendConfig.responseLookbackDays} days`,
                route: '/responses'
            },
            {
                title: 'Check imports',
                subtitle: `${imports30d} successful imports in last ${trendConfig.importLookbackDays} days`,
                route: '/import'
            }
        ];

        const alerts = [];
        if (pipelineCoverage < 2) {
            alerts.push({
                severity: 'high',
                code: 'PIPELINE_COVERAGE_LOW',
                message: `Pipeline coverage below 2x target (${pipelineCoverage}x)`,
                action: 'Increase qualified pipeline this period'
            });
        }
        const proposalStuck = stuckStages.find((s) => String(s.stageId).toLowerCase().includes('proposal'));
        if (proposalStuck && proposalStuck.count > 0) {
            alerts.push({
                severity: 'high',
                code: 'STUCK_PROPOSAL',
                message: `${proposalStuck.count} deals stuck in Proposal > ${proposalStuck.thresholdDays} days`,
                action: 'Run proposal aging review'
            });
        }
        if (forecastDropPct < -10) {
            alerts.push({
                severity: 'medium',
                code: 'FORECAST_DROP',
                message: `Forecast dropped ${Math.abs(forecastDropPct)}% vs previous window`,
                action: 'Inspect late-stage slippage and commit risk'
            });
        }
        const noPipelineReps = repPerformance.filter((rep) => rep.pipelineCreatedThisWeek <= 0);
        if (noPipelineReps.length > 0) {
            alerts.push({
                severity: 'medium',
                code: 'NO_PIPELINE_CREATED',
                message: `${noPipelineReps[0].name} has 0 pipeline created this week`,
                action: 'Set pipeline-generation activity goals'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                generatedAt: now.toISOString(),
                range: trendConfig.key,
                filtersApplied: {
                    repIds: selectedRepIds.map((id) => String(id)),
                    pipeline: selectedPipelines,
                    dealType: selectedDealTypes
                },
                pipelines: (pipelineValues || []).filter(Boolean),
                kpis: {
                    openDeals,
                    totalDeals,
                    pipelineValue,
                    weightedPipelineValue,
                    closingSoon
                },
                executiveSnapshot,
                pipelineHealth: {
                    stages: stageList,
                    biggestDropoff: biggestDropoff || { from: null, to: null, dropPct: 0 },
                    stuckDeals: stuckStages
                },
                forecasting: {
                    commit: commitForecast,
                    bestCase: bestCaseForecast,
                    pipelineUncommitted: uncommittedForecast,
                    byRep: forecastByRep,
                    byClosingMonth: forecastByMonth,
                    accuracyLast3Months: forecastAccuracy,
                    vsTarget: {
                        target: targetRevenue,
                        forecastTotal,
                        attainmentPct: targetRevenue > 0 ? Number(((forecastTotal / targetRevenue) * 100).toFixed(1)) : 0
                    }
                },
                repPerformance,
                activityPipeline: {
                    activityOverTime,
                    newPipelinePerWeek,
                    activityToDealConversionPct,
                    efficiencyFlags
                },
                trend: {
                    values: normalizedTrend,
                    rawValues: trendValues
                },
                queue: {
                    staleDeals,
                    overdueFollowUps,
                    overdueTasks
                },
                health: {
                    score: healthScore,
                    status: healthStatus,
                    signalCount: riskSignal
                },
                windows: {
                    staleDays: trendConfig.staleDays,
                    closeSoonDays: trendConfig.closeSoonDays,
                    responseLookbackDays: trendConfig.responseLookbackDays,
                    importLookbackDays: trendConfig.importLookbackDays
                },
                priorityQueue,
                recommendedActions,
                alerts,
                aiSummary: {
                    hitTargetLikelihoodPct: Math.max(5, Math.min(95, Math.round((forecastTotal / Math.max(targetRevenue, 1)) * 100))),
                    summary: pipelineCoverage >= 2
                        ? 'Pipeline coverage is healthy. Focus on proposal-stage conversion to improve predictability.'
                        : 'Pipeline coverage is below plan. Increase qualified pipeline and reduce stage slippage.',
                    recommendedActions: alerts.slice(0, 2).map((a) => a.action)
                },
                moduleCounts: {
                    deals: totalDeals,
                    responses: submittedResponses7d,
                    import: imports30d
                }
            }
        });
    } catch (error) {
        console.error('Get dashboard metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard metrics',
            error: error.message
        });
    }
};

// @desc    Update deal stage
// @route   PATCH /api/deals/:id/stage
// @access  Private
exports.updateStage = async (req, res) => {
    try {
        const { stage, order } = req.body;
        const appKey = req.appKey || req.query.appKey || 'SALES';

        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        });

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const stagePipelineResult = await validateStageInPipeline({
            moduleKey: 'deals',
            recordId: req.params.id,
            organizationId: req.user.organizationId,
            updateData: { stage, pipeline: deal.pipeline },
            appKey
        });
        if (!stagePipelineResult.valid) {
            return res.status(400).json({
                success: false,
                code: stagePipelineResult.code,
                message: stagePipelineResult.message,
                errors: stagePipelineResult.errors
            });
        }

        const previousSnapshot = deal.toObject ? deal.toObject() : { ...deal };
        const stageChanged = deal.stage !== stage;

        deal.stage = stage;
        if (typeof order === 'number' && order >= 0) {
            deal.stageOrder = order;
        }
        if (stageChanged) {
            if (!Array.isArray(deal.stageHistory)) deal.stageHistory = [];
            const historyEntry = { stage, changedAt: new Date() };
            if (req.user && req.user._id) historyEntry.changedBy = req.user._id;
            deal.stageHistory.push(historyEntry);

            if (!Array.isArray(deal.activityLogs)) deal.activityLogs = [];
            deal.activityLogs.push({
                user: getActorDisplayName(req.user),
                userId: req.user?._id || null,
                action: 'changed stage',
                details: {
                    field: 'stage',
                    from: previousSnapshot?.stage ?? null,
                    to: stage
                },
                timestamp: new Date()
            });
        }
        deal.modifiedBy = req.user?._id ?? null;

        const computedDerivedStatus = await computeAndSetDerivedStatus('deal', deal, appKey);
        const configExists = await hasConfiguration('deal', appKey);
        if (configExists && computedDerivedStatus && deal.status !== computedDerivedStatus) {
            deal.status = computedDerivedStatus;
        }

        if (stageChanged) {
            try {
                const { executePlaybookForDeal } = require('../services/playbookExecutionService');
                await executePlaybookForDeal(deal, {
                    actorId: req.user._id,
                    organizationId: req.user.organizationId
                });
            } catch (playbookErr) {
                console.error('[dealController] playbook on stage change failed:', playbookErr?.message || playbookErr);
            }
        }

        await deal.save();

        // Renormalize stageOrder so the moved deal is at index `order` and the rest are 0,1,2,...
        const inStage = await Deal.find({
            organizationId: req.user.organizationId,
            stage: deal.stage,
            deletedAt: null
        })
            .sort({ stageOrder: 1, _id: 1 })
            .select('_id')
            .lean();
        const movedId = deal._id.toString();
        if (typeof order === 'number' && order >= 0 && inStage.length > 0) {
            const idx = inStage.findIndex((d) => d._id.toString() === movedId);
            if (idx !== -1) {
                const [moved] = inStage.splice(idx, 1);
                const newIndex = Math.min(order, inStage.length);
                inStage.splice(newIndex, 0, moved);
            }
        }
        for (let i = 0; i < inStage.length; i++) {
            await Deal.updateOne(
                { _id: inStage[i]._id, organizationId: req.user.organizationId },
                { $set: { stageOrder: i } }
            );
        }

        try {
            const { emitDealEvents } = require('../services/domainEventHelpers');
            await emitDealEvents({
                previous: previousSnapshot,
                current: deal.toObject ? deal.toObject() : deal,
                appKey,
                triggeredBy: req.user?._id ?? null,
                organizationId: req.user?.organizationId ?? null
            });
        } catch (emitErr) {
            console.error('Update stage: emitDealEvents failed (stage was saved):', emitErr);
        }

        const updatedDeal = await Deal.findById(deal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName email')
            .populate('dealPeople.personId', 'first_name last_name email')
            .populate('dealOrganizations.organizationId', 'name');

        res.status(200).json({ success: true, data: updatedDeal });
    } catch (error) {
        console.error('Update stage error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating stage',
            error: error.message
        });
    }
};

// @desc    Update playbook action completion status
// @route   PATCH /api/deals/:id/playbook-state/actions/:actionKey
// @access  Private
exports.updatePlaybookActionStatus = async (req, res) => {
    try {
        const { actionKey } = req.params;
        const status = req.body?.status === 'completed' ? 'completed' : 'pending';

        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        });

        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }

        const { updatePlaybookActionStatus } = require('../services/playbookExecutionService');
        const updatedAction = await updatePlaybookActionStatus(
            deal,
            actionKey,
            status,
            req.user.organizationId
        );

        if (!updatedAction) {
            return res.status(404).json({
                success: false,
                message: 'Playbook action not found on this deal'
            });
        }

        deal.modifiedBy = req.user._id;
        await deal.save();

        const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        return res.status(200).json({
            success: true,
            data: flattenCustomFieldsForResponse(deal)
        });
    } catch (error) {
        if (error?.code === 'PLAYBOOK_ACTION_BLOCKED') {
            return res.status(409).json({
                success: false,
                code: error.code,
                message: 'This playbook action is blocked until prior steps are completed.'
            });
        }
        console.error('Update playbook action status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating playbook action status',
            error: error.message
        });
    }
};

// =====================
// Deal Comment Methods
// =====================

const normalizeReactionEmoji = (value) => String(value || '').trim();

const toReactionUserPayload = (user) => {
  if (!user) return null;
  const rawId = typeof user === 'object' ? (user._id || user.id) : user;
  if (!rawId) return null;
  const id = String(rawId);
  if (typeof user !== 'object') {
    return { id, name: 'Unknown', avatar: '' };
  }
  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || user.username || user.email || 'Unknown';
  return {
    id,
    name,
    avatar: user.avatar || ''
  };
};

const buildDealCommentResponse = (comment, currentUserId = null) => {
  const currentUserIdString = currentUserId ? String(currentUserId) : null;
  const reactions = Array.isArray(comment?.reactions) ? comment.reactions : [];

  const summarizedReactions = reactions
    .map((reaction) => {
      const emoji = normalizeReactionEmoji(reaction?.emoji);
      if (!emoji) return null;

      const users = Array.isArray(reaction?.users) ? reaction.users : [];
      const dedupedUsers = [];
      const seenUserIds = new Set();
      users.forEach((user) => {
        const payload = toReactionUserPayload(user);
        if (!payload || seenUserIds.has(payload.id)) return;
        seenUserIds.add(payload.id);
        dedupedUsers.push(payload);
      });

      return {
        emoji,
        count: dedupedUsers.length,
        userIds: dedupedUsers.map((user) => user.id),
        reactors: dedupedUsers
      };
    })
    .filter((reaction) => reaction && reaction.count > 0);

  const myReactions = currentUserIdString
    ? summarizedReactions
      .filter((reaction) => reaction.userIds.includes(currentUserIdString))
      .map((reaction) => reaction.emoji)
    : [];

  const reactionSummary = summarizedReactions.reduce((acc, reaction) => {
    acc[reaction.emoji] = reaction.count;
    return acc;
  }, {});

  return {
    _id: comment._id,
    content: comment.content,
    author: comment.author,
    parentCommentId: comment.parentCommentId || null,
    attachments: comment.attachments || [],
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    editedAt: comment.editedAt,
    reactions: summarizedReactions.map(({ emoji, count, reactors }) => ({ emoji, count, reactors })),
    reactionSummary,
    myReactions,
    likesCount: reactionSummary['👍'] || 0
  };
};
exports.buildDealCommentResponse = buildDealCommentResponse;

// @desc    Get comments for a deal
// @route   GET /api/deals/:id/comments
// @access  Private
exports.getDealComments = async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const comments = await DealComment.find({ dealId: req.params.id })
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: comments.map((comment) => buildDealCommentResponse(comment, req.user?._id))
    });
  } catch (error) {
    console.error('Get deal comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching comments',
      error: error.message
    });
  }
};

// @desc    Upload a file for a deal comment attachment
// @route   POST /api/deals/:id/comment-attachments
// @access  Private
exports.uploadDealCommentAttachment = async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const uploadResult = await persistMulterUpload(req, 'comments');
    res.json({
      success: true,
      url: uploadResult.url,
      storagePath: uploadResult.storagePath,
      filename: uploadResult.storedFileName,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload deal comment attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading attachment',
      error: error.message
    });
  }
};

// @desc    Create a comment on a deal
// @route   POST /api/deals/:id/comments
// @access  Private
exports.createDealComment = async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const { content, attachments, parentCommentId } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const validAttachments = Array.isArray(attachments)
      ? attachments.filter(a => a && typeof a.url === 'string' && typeof a.filename === 'string').slice(0, 10)
      : [];

    let validatedParentCommentId = null;
    if (parentCommentId) {
      if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parent comment id' });
      }
      const parentComment = await DealComment.findOne({
        _id: parentCommentId,
        dealId: req.params.id,
        organizationId: req.user.organizationId
      }).select('_id');
      if (!parentComment) {
        return res.status(404).json({ success: false, message: 'Parent comment not found' });
      }
      validatedParentCommentId = parentComment._id;
    }

    const comment = await DealComment.create({
      dealId: req.params.id,
      organizationId: req.user.organizationId,
      content: content.trim(),
      author: req.user._id,
      parentCommentId: validatedParentCommentId,
      attachments: validAttachments
    });

    const populated = await DealComment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    // Notify @mentioned users (fire-and-forget)
    const author = populated.author;
    const authorName = author
      ? [author.firstName, author.lastName].filter(Boolean).join(' ') || author.username || 'Someone'
      : 'Someone';
    processCommentMentions({
      organizationId: String(req.user.organizationId),
      appKey: req.appKey || 'SALES',
      moduleKey: 'deals',
      entityId: String(req.params.id),
      entityType: 'Deal',
      recordTitle: deal.name || 'Deal',
      commentId: String(comment._id),
      commentContent: content.trim(),
      authorId: String(req.user._id),
      authorName
    }).catch((err) => console.error('Deal comment mention notifications error:', err));

    res.status(201).json({
      success: true,
      data: buildDealCommentResponse(populated, req.user?._id)
    });
  } catch (error) {
    console.error('Create deal comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating comment',
      error: error.message
    });
  }
};

// @desc    Update a comment
// @route   PUT /api/deals/:id/comments/:commentId
// @access  Private
exports.updateDealComment = async (req, res) => {
  try {
    const { id: dealId, commentId } = req.params;
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    if (deal.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const comment = await DealComment.findOne({ _id: commentId, dealId });
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own comments' });
    }

    const rawContent = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const hasAttachmentsPayload = Array.isArray(req.body?.attachments);
    const validAttachments = hasAttachmentsPayload
      ? req.body.attachments
        .filter((a) => a && typeof a.url === 'string' && typeof a.filename === 'string')
        .slice(0, 10)
      : comment.attachments;

    if (!rawContent && (!Array.isArray(validAttachments) || validAttachments.length === 0)) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    comment.content = rawContent || 'Attached file(s)';
    if (hasAttachmentsPayload) {
      comment.attachments = validAttachments;
    }
    comment.editedAt = new Date();
    await comment.save();

    const populated = await DealComment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    const author = populated.author;
    const authorName = author
      ? [author.firstName, author.lastName].filter(Boolean).join(' ') || author.username || 'Someone'
      : 'Someone';
    processCommentMentions({
      organizationId: String(req.user.organizationId),
      appKey: req.appKey || 'SALES',
      moduleKey: 'deals',
      entityId: String(dealId),
      entityType: 'Deal',
      recordTitle: deal.name || 'Deal',
      commentId: String(comment._id),
      commentContent: comment.content,
      authorId: String(req.user._id),
      authorName
    }).catch((err) => console.error('Deal comment mention notifications error:', err));

    res.json({
      success: true,
      data: buildDealCommentResponse(populated, req.user?._id)
    });
  } catch (error) {
    console.error('Update deal comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating comment',
      error: error.message
    });
  }
};

// @desc    Toggle an emoji reaction for a deal comment
// @route   POST /api/deals/:id/comments/:commentId/reactions
// @access  Private
exports.toggleDealCommentReaction = async (req, res) => {
  try {
    const { id: dealId, commentId } = req.params;
    const emoji = normalizeReactionEmoji(req.body?.emoji);

    if (!emoji || emoji.length > 16) {
      return res.status(400).json({
        success: false,
        message: 'A valid emoji is required'
      });
    }

    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    if (deal.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const comment = await DealComment.findOne({ _id: commentId, dealId });
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (!Array.isArray(comment.reactions)) {
      comment.reactions = [];
    }

    const currentUserId = String(req.user._id);
    let reaction = comment.reactions.find((entry) => normalizeReactionEmoji(entry?.emoji) === emoji);

    if (!reaction) {
      comment.reactions.push({
        emoji,
        users: [req.user._id]
      });
    } else {
      const userIndex = reaction.users.findIndex((userId) => String(userId) === currentUserId);
      if (userIndex >= 0) {
        reaction.users.splice(userIndex, 1);
      } else {
        reaction.users.push(req.user._id);
      }

      if (!reaction.users.length) {
        comment.reactions = comment.reactions.filter((entry) => String(entry._id) !== String(reaction._id));
      }
    }

    comment.markModified('reactions');
    await comment.save();

    const populated = await DealComment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    res.json({
      success: true,
      data: buildDealCommentResponse(populated, req.user?._id)
    });
  } catch (error) {
    console.error('Toggle deal comment reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling reaction',
      error: error.message
    });
  }
};

// @desc    Delete a deal comment
// @route   DELETE /api/deals/:id/comments/:commentId
// @access  Private
exports.deleteDealComment = async (req, res) => {
  try {
    const { id: dealId, commentId } = req.params;
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    if (deal.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const comment = await DealComment.findOne({ _id: commentId, dealId });
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own comments' });
    }

    await DealComment.findByIdAndDelete(commentId);

    res.json({
      success: true,
      data: { _id: commentId }
    });
  } catch (error) {
    console.error('Delete deal comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting comment',
      error: error.message
    });
  }
};

