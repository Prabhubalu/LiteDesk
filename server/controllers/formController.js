const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const FormKPIs = require('../models/FormKPIs');
const Event = require('../models/Event');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Create new form
// @route   POST /api/forms
// @access  Private
exports.createForm = async (req, res) => {
    try {
        const payload = {
            ...req.body,
            organizationId: req.user.organizationId,
            createdBy: req.user._id,
            modifiedBy: req.user._id
        };

        // Validate form structure only if form is Active (Draft forms can be saved without sections)
        const form = new Form(payload);
        if (payload.status === 'Active') {
            const validation = form.validateStructure();
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.error
                });
            }
        }

        const newForm = await Form.create(payload);
        
        const populatedForm = await Form.findById(newForm._id)
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email')
            .populate('approvalWorkflow.approver', 'firstName lastName email');
        
        res.status(201).json({
            success: true,
            data: populatedForm
        });
    } catch (error) {
        console.error('Create form error:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error creating form.', 
            error: error.message 
        });
    }
};

// @desc    Get all forms
// @route   GET /api/forms
// @access  Private
exports.getForms = async (req, res) => {
    try {
        const query = { organizationId: req.user.organizationId };
        
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
        if (req.query.linkedModule) {
            query.linkedModule = req.query.linkedModule;
        }
        if (req.query.visibility) {
            query.visibility = req.query.visibility;
        }
        
        // Search functionality
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { name: searchRegex },
                { description: searchRegex },
                { formId: searchRegex }
            ];
        }
        
        // Sorting
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortBy]: sortOrder };
        
        // Execute query
        const forms = await Form.find(query)
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email')
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
                    closedForms: {
                        $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] }
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
                closedForms: 0,
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
        const form = await Form.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        })
        .populate('assignedTo', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('modifiedBy', 'firstName lastName email')
        .populate('approvalWorkflow.approver', 'firstName lastName email')
        .populate('workflowOnSubmit.notify', 'firstName lastName email')
        .populate('responseTemplate.templateId');
        
        if (!form) {
            return res.status(404).json({ 
                success: false,
                message: 'Form not found or access denied.' 
            });
        }
        
        res.status(200).json({
            success: true,
            data: form
        });
    } catch (error) {
        console.error('Get form error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching form.', 
            error: error.message 
        });
    }
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
        
        // Check if form is Draft (only Draft forms can be edited)
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
        
        if (existingForm.status !== 'Draft') {
            return res.status(400).json({
                success: false,
                message: 'Only Draft forms can be edited. Please create a new version or duplicate the form.'
            });
        }
        
        // Validate form structure only if form is being set to Active status
        // Draft forms can be saved without sections/questions
        if (req.body.status === 'Active' || (existingForm.status === 'Active' && req.body.sections)) {
            const tempForm = new Form({ ...existingForm.toObject(), ...req.body });
            const validation = tempForm.validateStructure();
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.error
                });
            }
        }
        
        const updatedForm = await Form.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId,
                status: 'Draft' // Double-check status
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
                message: 'Form not found, access denied, or form is not in Draft status.' 
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
        const result = await Form.findOneAndDelete({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        });

        if (!result) {
            return res.status(404).json({ 
                success: false,
                message: 'Form not found or access denied.' 
            });
        }
        
        // Optionally delete associated responses and KPIs
        // For now, we'll keep them for historical data
        
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
        // Allow both Active and Draft forms for preview (Draft forms can be previewed)
        const form = await Form.findOne({
            'publicLink.slug': req.params.slug,
            'publicLink.enabled': true,
            status: { $in: ['Active', 'Draft'] } // Allow both Active and Draft for preview
        })
        .populate('assignedTo', 'firstName lastName email');
        
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or not available.'
            });
        }
        
        // Check if form is expired (for Surveys)
        if (form.expiryDate && new Date() > form.expiryDate) {
            return res.status(410).json({
                success: false,
                message: 'This form has expired.'
            });
        }
        
        res.status(200).json({
            success: true,
            data: form
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
            // Generate slug from form name
            let baseSlug = form.name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
                .replace(/\s+/g, '-')           // Replace spaces with hyphens
                .replace(/-+/g, '-')            // Replace multiple hyphens with single
                .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
                .substring(0, 50);              // Limit length

            // Ensure slug is not empty
            if (!baseSlug) {
                baseSlug = `form-${form.formId || form._id.toString().substring(0, 8)}`;
            }

            // Check if slug exists and make it unique
            slug = baseSlug;
            let counter = 1;
            let existingForm = await Form.findOne({
                'publicLink.slug': slug,
                _id: { $ne: form._id },
                organizationId: req.user.organizationId
            });

            while (existingForm) {
                slug = `${baseSlug}-${counter}`;
                existingForm = await Form.findOne({
                    'publicLink.slug': slug,
                    _id: { $ne: form._id },
                    organizationId: req.user.organizationId
                });
                counter++;
                
                // Prevent infinite loop
                if (counter > 100) {
                    slug = `${baseSlug}-${Date.now()}`;
                    break;
                }
            }
        }

        // Update form with public link
        form.publicLink = {
            enabled: true,
            slug: slug
        };
        form.modifiedBy = req.user._id;
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

// @desc    Get forms assigned to current user via events (My Audits)
// @route   GET /api/forms/my-audits
// @access  Private
exports.getMyAudits = async (req, res) => {
    try {
        const { status, dueDate, page = 1, limit = 20 } = req.query;
        
        // Find events where current user is assigned as auditor
        const query = {
            organizationId: req.user.organizationId,
            'formAssignment.assignedAuditor': req.user._id,
            linkedFormId: { $ne: null }
        };
        
        // Filter by status if provided
        if (status) {
            query.status = status;
        }
        
        // Filter by due date if provided
        if (dueDate) {
            if (dueDate === 'overdue') {
                query['formAssignment.dueDate'] = { $lt: new Date() };
            } else if (dueDate === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                query['formAssignment.dueDate'] = { $gte: today, $lt: tomorrow };
            } else if (dueDate === 'upcoming') {
                query['formAssignment.dueDate'] = { $gte: new Date() };
            }
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get events with linked forms
        const events = await Event.find(query)
            .populate('linkedFormId', 'name formId formType status description')
            .populate('organizer', 'firstName lastName email')
            .sort({ 'formAssignment.dueDate': 1, startDate: 1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        // Get total count
        const total = await Event.countDocuments(query);
        
        // Transform to include form details and check for existing responses
        const audits = await Promise.all(events.map(async (event) => {
            if (!event.linkedFormId) return null;
            
            // Populate assignedAuditor manually if it exists
            let assignedAuditor = null;
            if (event.formAssignment && event.formAssignment.assignedAuditor) {
                if (typeof event.formAssignment.assignedAuditor === 'object' && event.formAssignment.assignedAuditor._id) {
                    // Already populated
                    assignedAuditor = event.formAssignment.assignedAuditor;
                } else {
                    // Need to populate
                    assignedAuditor = await User.findById(event.formAssignment.assignedAuditor)
                        .select('firstName lastName email')
                        .lean();
                }
            }
            
            // Check if user has already submitted a response for this form
            const existingResponse = await FormResponse.findOne({
                formId: event.linkedFormId._id,
                organizationId: req.user.organizationId,
                submittedBy: req.user._id
            })
            .sort({ submittedAt: -1 })
            .select('_id responseId status submittedAt kpis')
            .lean();
            
            return {
                eventId: event._id,
                formId: event.linkedFormId._id,
                formName: event.linkedFormId.name,
                formType: event.linkedFormId.formType,
                formStatus: event.linkedFormId.status,
                eventTitle: event.title,
                eventDescription: event.description || '',
                dueDate: event.formAssignment?.dueDate || null,
                assignedAt: event.formAssignment?.assignedAt || null,
                assignedBy: assignedAuditor || event.organizer || null,
                startDate: event.startDate,
                endDate: event.endDate,
                location: event.location || '',
                existingResponse: existingResponse || null,
                canStart: !existingResponse || existingResponse.status === 'Draft'
            };
        }));
        
        // Filter out null values
        const validAudits = audits.filter(audit => audit !== null);
        
        res.status(200).json({
            success: true,
            data: validAudits,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalRecords: total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get my audits error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching my audits.',
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

