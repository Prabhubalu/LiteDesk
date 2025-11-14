const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const FormKPIs = require('../models/FormKPIs');
const Task = require('../models/Task');
const formScoringService = require('./formScoringService');

/**
 * Process form submission
 * @param {Object} params - Submission parameters
 * @returns {Promise<FormResponse>} Processed response
 */
exports.processSubmission = async (params) => {
    const { form, responseDetails, linkedTo, organizationId, submittedBy, ipAddress, userAgent } = params;
    
    try {
        // Validate responses against form structure
        const validation = await validateSubmission(form, responseDetails);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        // Calculate scores using scoring service
        const scoredResponse = await formScoringService.scoreResponse(form, responseDetails);
        
        // Ensure responseDetails have section/subsection IDs
        scoredResponse.responseDetails = scoredResponse.responseDetails.map(detail => {
            // Find the question in form to get section/subsection IDs
            const question = findQuestionInForm(form, detail.questionId);
            if (question) {
                // Find which section/subsection contains this question
                for (const section of form.sections) {
                    for (const subsection of section.subsections) {
                        const foundQuestion = subsection.questions.find(q => q.questionId === detail.questionId);
                        if (foundQuestion) {
                            detail.sectionId = section.sectionId;
                            detail.subsectionId = subsection.subsectionId;
                            break;
                        }
                    }
                }
            }
            return detail;
        });
        
        // Validate form has _id
        if (!form || !form._id) {
            throw new Error('Form ID is missing');
        }
        
        // Validate organizationId
        if (!organizationId) {
            throw new Error('Organization ID is missing');
        }
        
        // Create response document
        const responseData = {
            organizationId: organizationId.toString ? organizationId.toString() : organizationId,
            formId: form._id.toString ? form._id.toString() : form._id,
            linkedTo: linkedTo || null,
            submittedBy: submittedBy || null,
            submittedAt: new Date(),
            responseDetails: scoredResponse.responseDetails,
            sectionScores: scoredResponse.sectionScores,
            kpis: scoredResponse.kpis,
            status: determineInitialStatus(form, scoredResponse.kpis),
            ipAddress,
            userAgent
        };
        
        const formResponse = await FormResponse.create(responseData);
        
        // Update form analytics
        await updateFormAnalytics(form._id.toString ? form._id.toString() : form._id, organizationId.toString ? organizationId.toString() : organizationId);
        
        // Trigger workflows
        await triggerWorkflows(form, formResponse);
        
        // Create corrective task if needed
        if (formResponse.status === 'Pending Corrective Action') {
            await createCorrectiveTask(form, formResponse, organizationId);
        }
        
        // Populate and return
        return await FormResponse.findById(formResponse._id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('linkedTo.id');
    } catch (error) {
        console.error('Process submission error:', error);
        throw error;
    }
};

/**
 * Validate submission against form structure
 */
async function validateSubmission(form, responseDetails) {
    // Check if form has sections and questions
    if (!form.sections || form.sections.length === 0) {
        return { valid: false, error: 'Form has no sections' };
    }
    
    // Collect all question IDs from form
    const formQuestionIds = new Set();
    form.sections.forEach(section => {
        section.subsections.forEach(subsection => {
            subsection.questions.forEach(question => {
                formQuestionIds.add(question.questionId);
            });
        });
    });
    
    // Check if all mandatory questions are answered
    const answeredQuestionIds = new Set(responseDetails.map(detail => detail.questionId));
    
    for (const section of form.sections) {
        for (const subsection of section.subsections) {
            for (const question of subsection.questions) {
                if (question.mandatory && !answeredQuestionIds.has(question.questionId)) {
                    return { 
                        valid: false, 
                        error: `Mandatory question "${question.questionText}" is not answered` 
                    };
                }
            }
        }
    }
    
    // Check for invalid question IDs
    for (const detail of responseDetails) {
        if (!formQuestionIds.has(detail.questionId)) {
            return { 
                valid: false, 
                error: `Invalid question ID: ${detail.questionId}` 
            };
        }
    }
    
    return { valid: true };
}

/**
 * Determine initial status based on KPIs
 */
function determineInitialStatus(form, kpis) {
    // If form requires approval workflow
    if (form.approvalRequired) {
        return 'Pending Corrective Action';
    }
    
    // For Audit forms, check if compliance is below threshold
    if (form.formType === 'Audit') {
        if (kpis.compliancePercentage < form.thresholds.partial) {
            return 'Pending Corrective Action';
        }
    }
    
    // Default status
    return 'Pending Corrective Action';
}

/**
 * Update form analytics
 */
async function updateFormAnalytics(formId, organizationId) {
    try {
        if (!formId || !organizationId) {
            console.error('updateFormAnalytics: Missing formId or organizationId', { formId, organizationId });
            return;
        }
        
        // Convert to ObjectId if needed
        const mongoose = require('mongoose');
        const formObjectId = mongoose.Types.ObjectId.isValid(formId) 
            ? (formId instanceof mongoose.Types.ObjectId ? formId : new mongoose.Types.ObjectId(formId))
            : null;
        const orgObjectId = mongoose.Types.ObjectId.isValid(organizationId)
            ? (organizationId instanceof mongoose.Types.ObjectId ? organizationId : new mongoose.Types.ObjectId(organizationId))
            : null;
        
        if (!formObjectId || !orgObjectId) {
            console.error('updateFormAnalytics: Invalid ObjectId', { formId, organizationId, formObjectId, orgObjectId });
            return;
        }
        
        const form = await Form.findById(formObjectId);
        if (!form) {
            console.error('updateFormAnalytics: Form not found', { formId: formObjectId });
            return;
        }
        
        // Get response statistics
        const stats = await FormResponse.aggregate([
            {
                $match: {
                    formId: formObjectId,
                    organizationId: orgObjectId
                }
            },
            {
                $group: {
                    _id: null,
                    totalResponses: { $sum: 1 },
                    avgCompliance: { $avg: '$kpis.compliancePercentage' },
                    avgRating: { $avg: '$kpis.rating' },
                    lastSubmission: { $max: '$submittedAt' }
                }
            }
        ]);
        
        if (stats.length > 0) {
            form.totalResponses = stats[0].totalResponses;
            form.avgCompliance = Math.round(stats[0].avgCompliance || 0);
            form.avgRating = Math.round((stats[0].avgRating || 0) * 10) / 10;
            form.lastSubmission = stats[0].lastSubmission;
            
            await form.save();
        }
    } catch (error) {
        console.error('Update form analytics error:', error);
    }
}

/**
 * Trigger workflows on submit
 */
async function triggerWorkflows(form, formResponse) {
    try {
        const workflow = form.workflowOnSubmit;
        if (!workflow) return;
        
        // Notify users
        if (workflow.notify && workflow.notify.length > 0) {
            // TODO: Implement notification service
            console.log('Notify users:', workflow.notify);
        }
        
        // Create task if configured
        if (workflow.createTask) {
            // Task creation will be handled separately
            console.log('Create task workflow triggered');
        }
        
        // Update field if configured
        if (workflow.updateField && workflow.updateField.field) {
            // Field update will be handled based on linkedTo
            console.log('Update field workflow triggered');
        }
    } catch (error) {
        console.error('Trigger workflows error:', error);
    }
}

/**
 * Create corrective task for failed questions
 */
async function createCorrectiveTask(form, formResponse, organizationId) {
    try {
        const failedQuestions = formResponse.responseDetails.filter(detail => detail.passFail === 'Fail');
        
        if (failedQuestions.length === 0) return;
        
        // Create task for corrective actions
        const taskData = {
            organizationId,
            title: `Corrective Actions Required: ${form.name}`,
            description: `Please address ${failedQuestions.length} failed question(s) from form submission ${formResponse.responseId}`,
            relatedTo: {
                type: form.linkedModule ? form.linkedModule.toLowerCase() : 'none',
                id: formResponse.linkedTo ? formResponse.linkedTo.id : null
            },
            assignedTo: form.assignedTo || formResponse.submittedBy,
            status: 'todo',
            priority: 'high',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        };
        
        // Only create task if form is linked to a module
        if (formResponse.linkedTo && formResponse.linkedTo.id) {
            await Task.create(taskData);
        }
    } catch (error) {
        console.error('Create corrective task error:', error);
    }
}

/**
 * Map form data to contact (for forms that create contacts)
 */
exports.mapFormDataToContact = (form, responseDetails) => {
    const contactData = {
        type: 'Lead',
        lead_status: 'New'
    };
    
    // Map common fields
    responseDetails.forEach(detail => {
        const question = findQuestionInForm(form, detail.questionId);
        if (!question) return;
        
        // Map email
        if (question.type === 'Text' && question.questionText.toLowerCase().includes('email')) {
            contactData.email = detail.answer;
        }
        
        // Map phone
        if (question.type === 'Text' && question.questionText.toLowerCase().includes('phone')) {
            contactData.phone = detail.answer;
        }
        
        // Map first name
        if (question.type === 'Text' && question.questionText.toLowerCase().includes('first name')) {
            contactData.first_name = detail.answer;
        }
        
        // Map last name
        if (question.type === 'Text' && question.questionText.toLowerCase().includes('last name')) {
            contactData.last_name = detail.answer;
        }
    });
    
    return contactData;
};

/**
 * Find question in form structure
 */
function findQuestionInForm(form, questionId) {
    for (const section of form.sections) {
        for (const subsection of section.subsections) {
            for (const question of subsection.questions) {
                if (question.questionId === questionId) {
                    return question;
                }
            }
        }
    }
    return null;
}

