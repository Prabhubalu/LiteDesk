const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const Task = require('../models/Task');
const mongoose = require('mongoose');
const formProcessingService = require('../services/formProcessingService');

// @desc    Submit form response (public or authenticated)
// @route   POST /api/public/forms/:slug/submit OR POST /api/forms/:id/submit
// @access  Public (for public forms) or Private
exports.submitForm = async (req, res) => {
    try {
        let form;
        let organizationId;
        
        // Determine if this is a public submission or authenticated
        if (req.params.slug) {
            // Public form submission - allow both Active and Draft for preview
            form = await Form.findOne({
                'publicLink.slug': req.params.slug,
                'publicLink.enabled': true,
                status: { $in: ['Active', 'Draft'] } // Allow Draft for preview
            });
            
            if (!form) {
                return res.status(404).json({
                    success: false,
                    message: 'Form not found or not available.'
                });
            }
            
            // Check expiry
            if (form.expiryDate && new Date() > form.expiryDate) {
                return res.status(410).json({
                    success: false,
                    message: 'This form has expired.'
                });
            }
            
            organizationId = form.organizationId;
            if (!organizationId) {
                return res.status(500).json({
                    success: false,
                    message: 'Form organization ID is missing.'
                });
            }
        } else {
            // Authenticated form submission
            form = await Form.findOne({
                _id: req.params.id,
                organizationId: req.user.organizationId,
                status: 'Active'
            });
            
            if (!form) {
                return res.status(404).json({
                    success: false,
                    message: 'Form not found or access denied.'
                });
            }
            
            organizationId = req.user.organizationId;
        }
        
        const { responseDetails, linkedTo } = req.body;
        
        // Validate response details
        if (!responseDetails || !Array.isArray(responseDetails) || responseDetails.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Response details are required.'
            });
        }
        
        // Process submission using service
        const processedResponse = await formProcessingService.processSubmission({
            form,
            responseDetails,
            linkedTo,
            organizationId,
            submittedBy: req.user ? req.user._id : null,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent')
        });
        
        res.status(201).json({
            success: true,
            data: processedResponse,
            message: 'Form submitted successfully'
        });
    } catch (error) {
        console.error('Submit form error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting form.',
            error: error.message
        });
    }
};

// @desc    Get all responses for a form
// @route   GET /api/forms/:id/responses
// @access  Private
exports.getResponses = async (req, res) => {
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
        
        const query = {
            formId: req.params.id,
            organizationId: req.user.organizationId
        };
        
        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Get filters
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.linkedToType) {
            query['linkedTo.type'] = req.query.linkedToType;
        }
        if (req.query.linkedToId) {
            query['linkedTo.id'] = req.query.linkedToId;
        }
        
        // Date range filter
        if (req.query.fromDate || req.query.toDate) {
            query.submittedAt = {};
            if (req.query.fromDate) {
                query.submittedAt.$gte = new Date(req.query.fromDate);
            }
            if (req.query.toDate) {
                query.submittedAt.$lte = new Date(req.query.toDate);
            }
        }
        
        // Sorting
        const sortBy = req.query.sortBy || 'submittedAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortBy]: sortOrder };
        
        // Execute query
        const responses = await FormResponse.find(query)
            .populate('submittedBy', 'firstName lastName email')
            .populate('linkedTo.id')
            .sort(sort)
            .limit(limit)
            .skip(skip);
        
        const total = await FormResponse.countDocuments(query);
        
        res.status(200).json({
            success: true,
            data: responses,
            pagination: {
                currentPage: page,
                limit,
                totalResponses: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get responses error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching responses.',
            error: error.message
        });
    }
};

// @desc    Get single response
// @route   GET /api/forms/:id/responses/:responseId
// @access  Private
exports.getResponseById = async (req, res) => {
    try {
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        })
        .populate('submittedBy', 'firstName lastName email')
        .populate('linkedTo.id')
        .populate('correctiveActions.managerAction.addedBy', 'firstName lastName email')
        .populate('correctiveActions.auditorVerification.verifiedBy', 'firstName lastName email')
        .populate('finalReport.previousResponseId');
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        res.status(200).json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error('Get response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching response.',
            error: error.message
        });
    }
};

// @desc    Update response status
// @route   PATCH /api/forms/:id/responses/:responseId/status
// @access  Private
exports.updateResponseStatus = async (req, res) => {
    try {
        const { status } = req.body;
        
        const validStatuses = ['Pending Corrective Action', 'Needs Auditor Review', 'Approved', 'Rejected', 'Closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status.'
            });
        }
        
        const response = await FormResponse.findOneAndUpdate(
            {
                _id: req.params.responseId,
                formId: req.params.id,
                organizationId: req.user.organizationId
            },
            { status },
            { new: true, runValidators: true }
        )
        .populate('submittedBy', 'firstName lastName email');
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        res.status(200).json({
            success: true,
            data: response,
            message: 'Response status updated successfully'
        });
    } catch (error) {
        console.error('Update response status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating response status.',
            error: error.message
        });
    }
};

// @desc    Add corrective action
// @route   POST /api/forms/:id/responses/:responseId/corrective-action
// @access  Private
exports.addCorrectiveAction = async (req, res) => {
    try {
        const { questionId, comment, status } = req.body;
        
        // Handle file uploads
        const proofUrls = [];
        if (req.files && req.files.length > 0) {
            const { getFileUrl } = require('../middleware/uploadMiddleware');
            proofUrls.push(...req.files.map(file => getFileUrl(req, file.filename)));
        } else if (req.body.proof && Array.isArray(req.body.proof)) {
            // If proof URLs are already provided (from existing files)
            proofUrls.push(...req.body.proof);
        }
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Find the question in response details
        const questionResponse = response.responseDetails.find(detail => detail.questionId === questionId);
        if (!questionResponse) {
            return res.status(404).json({
                success: false,
                message: 'Question not found in response.'
            });
        }
        
        // Get form to find question text
        const Form = require('../models/Form');
        const form = await Form.findById(req.params.id);
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found.'
            });
        }
        
        // Find question text from form
        let questionText = '';
        for (const section of form.sections) {
            for (const subsection of section.subsections) {
                const question = subsection.questions.find(q => q.questionId === questionId);
                if (question) {
                    questionText = question.questionText;
                    break;
                }
            }
            if (questionText) break;
        }
        
        if (!questionText) {
            return res.status(404).json({
                success: false,
                message: 'Question not found in form.'
            });
        }
        
        // Find or create corrective action
        let correctiveAction = response.correctiveActions.find(action => action.questionId === questionId);
        
        if (correctiveAction) {
            // Update existing corrective action
            correctiveAction.managerAction.comment = comment || correctiveAction.managerAction.comment;
            // Merge new proof files with existing ones
            const existingProof = correctiveAction.managerAction.proof || [];
            correctiveAction.managerAction.proof = [...existingProof, ...proofUrls];
            correctiveAction.managerAction.status = status || correctiveAction.managerAction.status;
            correctiveAction.managerAction.addedBy = req.user._id;
            correctiveAction.managerAction.addedAt = new Date();
        } else {
            // Create new corrective action
            correctiveAction = {
                questionId,
                questionText: questionText,
                auditorFinding: questionResponse.answer || '',
                managerAction: {
                    comment: comment || '',
                    proof: proofUrls,
                    status: status || 'Pending',
                    addedBy: req.user._id,
                    addedAt: new Date()
                },
                auditorVerification: {
                    approved: false
                }
            };
            response.correctiveActions.push(correctiveAction);
        }
        
        // Update response status
        response.status = 'Needs Auditor Review';
        
        await response.save();
        
        const updatedResponse = await FormResponse.findById(response._id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('correctiveActions.managerAction.addedBy', 'firstName lastName email');
        
        res.status(200).json({
            success: true,
            data: updatedResponse,
            message: 'Corrective action added successfully'
        });
    } catch (error) {
        console.error('Add corrective action error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding corrective action.',
            error: error.message
        });
    }
};

// @desc    Verify corrective action
// @route   POST /api/forms/:id/responses/:responseId/verify
// @access  Private
exports.verifyCorrectiveAction = async (req, res) => {
    try {
        const { questionId, approved, comment } = req.body;
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        const correctiveAction = response.correctiveActions.find(action => action.questionId === questionId);
        if (!correctiveAction) {
            return res.status(404).json({
                success: false,
                message: 'Corrective action not found.'
            });
        }
        
        // Update verification
        correctiveAction.auditorVerification.approved = approved;
        correctiveAction.auditorVerification.comment = comment || '';
        correctiveAction.auditorVerification.verifiedBy = req.user._id;
        correctiveAction.auditorVerification.verifiedAt = new Date();
        
        // Check if all corrective actions are verified
        const allVerified = response.correctiveActions.every(action => 
            action.auditorVerification.verifiedBy !== undefined
        );
        
        if (allVerified) {
            // Check if all are approved
            const allApproved = response.correctiveActions.every(action =>
                action.auditorVerification.approved === true
            );
            
            if (allApproved) {
                response.status = 'Closed';
            } else {
                response.status = 'Needs Auditor Review'; // Some rejected, needs rework
            }
        }
        
        await response.save();
        
        const updatedResponse = await FormResponse.findById(response._id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('correctiveActions.managerAction.addedBy', 'firstName lastName email')
            .populate('correctiveActions.auditorVerification.verifiedBy', 'firstName lastName email');
        
        res.status(200).json({
            success: true,
            data: updatedResponse,
            message: 'Corrective action verified successfully'
        });
    } catch (error) {
        console.error('Verify corrective action error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying corrective action.',
            error: error.message
        });
    }
};

// @desc    Approve response
// @route   POST /api/forms/:id/responses/:responseId/approve
// @access  Private
exports.approveResponse = async (req, res) => {
    try {
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        response.status = 'Approved';
        await response.save();
        
        res.status(200).json({
            success: true,
            data: response,
            message: 'Response approved successfully'
        });
    } catch (error) {
        console.error('Approve response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving response.',
            error: error.message
        });
    }
};

// @desc    Reject response
// @route   POST /api/forms/:id/responses/:responseId/reject
// @access  Private
exports.rejectResponse = async (req, res) => {
    try {
        const { reason } = req.body;
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        response.status = 'Rejected';
        // Could add rejection reason field if needed
        await response.save();
        
        res.status(200).json({
            success: true,
            data: response,
            message: 'Response rejected successfully'
        });
    } catch (error) {
        console.error('Reject response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error rejecting response.',
            error: error.message
        });
    }
};

// @desc    Delete response
// @route   DELETE /api/forms/:id/responses/:responseId
// @access  Private
exports.deleteResponse = async (req, res) => {
    try {
        const result = await FormResponse.findOneAndDelete({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Response deleted successfully'
        });
    } catch (error) {
        console.error('Delete response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting response.',
            error: error.message
        });
    }
};

// @desc    Export responses
// @route   GET /api/forms/:id/responses/export
// @access  Private
exports.exportResponses = async (req, res) => {
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
        
        const responses = await FormResponse.find({
            formId: req.params.id,
            organizationId: req.user.organizationId
        })
        .populate('submittedBy', 'firstName lastName email')
        .sort({ submittedAt: -1 });
        
        // Convert to CSV format (simplified - in production, use a CSV library)
        const csvRows = [];
        
        // Header row
        const headers = ['Response ID', 'Submitted By', 'Submitted At', 'Status', 'Compliance %', 'Rating', 'Final Score'];
        csvRows.push(headers.join(','));
        
        // Data rows
        responses.forEach(response => {
            const row = [
                response.responseId,
                response.submittedBy ? `${response.submittedBy.firstName} ${response.submittedBy.lastName}` : 'N/A',
                response.submittedAt.toISOString(),
                response.status,
                response.kpis.compliancePercentage,
                response.kpis.rating,
                response.kpis.finalScore
            ];
            csvRows.push(row.join(','));
        });
        
        const csv = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=form-responses-${form.formId}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Export responses error:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting responses.',
            error: error.message
        });
    }
};

// @desc    Get response comparison
// @route   GET /api/forms/:id/responses/:responseId/compare
// @access  Private
exports.getResponseComparison = async (req, res) => {
    try {
        const { previousResponseId, compareWith = 'last_audit' } = req.query;
        
        const currentResponse = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!currentResponse) {
            return res.status(404).json({
                success: false,
                message: 'Current response not found or access denied.'
            });
        }
        
        let previousResponse = null;
        
        if (previousResponseId) {
            // Compare with specific response
            previousResponse = await FormResponse.findOne({
                _id: previousResponseId,
                formId: req.params.id,
                organizationId: req.user.organizationId
            });
        } else if (compareWith === 'last_audit') {
            // Get most recent response before current one
            previousResponse = await FormResponse.findOne({
                formId: req.params.id,
                organizationId: req.user.organizationId,
                submittedAt: { $lt: currentResponse.submittedAt }
            })
            .sort({ submittedAt: -1 });
        } else if (compareWith === 'average') {
            // Calculate average from all previous responses
            const previousResponses = await FormResponse.find({
                formId: req.params.id,
                organizationId: req.user.organizationId,
                submittedAt: { $lt: currentResponse.submittedAt }
            })
            .sort({ submittedAt: -1 })
            .limit(10);
            
            if (previousResponses.length > 0) {
                // Create an average response object
                const avgKpis = {
                    compliancePercentage: previousResponses.reduce((sum, r) => sum + (r.kpis?.compliancePercentage || 0), 0) / previousResponses.length,
                    finalScore: previousResponses.reduce((sum, r) => sum + (r.kpis?.finalScore || 0), 0) / previousResponses.length,
                    rating: previousResponses.reduce((sum, r) => sum + (r.kpis?.rating || 0), 0) / previousResponses.length,
                    totalPassed: previousResponses.reduce((sum, r) => sum + (r.kpis?.totalPassed || 0), 0) / previousResponses.length,
                    totalFailed: previousResponses.reduce((sum, r) => sum + (r.kpis?.totalFailed || 0), 0) / previousResponses.length
                };
                
                // Calculate average section scores
                const avgSectionScores = {};
                const sectionScoresMap = {};
                previousResponses.forEach(r => {
                    if (r.sectionScores && typeof r.sectionScores === 'object') {
                        Object.entries(r.sectionScores).forEach(([sectionId, score]) => {
                            if (!sectionScoresMap[sectionId]) {
                                sectionScoresMap[sectionId] = [];
                            }
                            sectionScoresMap[sectionId].push(score);
                        });
                    }
                });
                
                Object.entries(sectionScoresMap).forEach(([sectionId, scores]) => {
                    avgSectionScores[sectionId] = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
                });
                
                previousResponse = {
                    _id: 'average',
                    kpis: avgKpis,
                    sectionScores: avgSectionScores,
                    submittedAt: previousResponses[0].submittedAt // Use most recent date
                };
            }
        }
        
        if (!previousResponse) {
            return res.status(200).json({
                success: true,
                data: {
                    current: currentResponse,
                    previous: null,
                    comparison: null,
                    message: 'No previous response found for comparison'
                }
            });
        }
        
        // Calculate comparison metrics
        const comparison = {
            overallScore: {
                current: currentResponse.kpis?.finalScore || 0,
                previous: previousResponse.kpis?.finalScore || 0,
                difference: (currentResponse.kpis?.finalScore || 0) - (previousResponse.kpis?.finalScore || 0)
            },
            complianceChange: (currentResponse.kpis?.compliancePercentage || 0) - (previousResponse.kpis?.compliancePercentage || 0),
            ratingChange: (currentResponse.kpis?.rating || 0) - (previousResponse.kpis?.rating || 0),
            scoreChange: (currentResponse.kpis?.finalScore || 0) - (previousResponse.kpis?.finalScore || 0),
            passedChange: (currentResponse.kpis?.totalPassed || 0) - (previousResponse.kpis?.totalPassed || 0),
            failedChange: (currentResponse.kpis?.totalFailed || 0) - (previousResponse.kpis?.totalFailed || 0)
        };
        
        // Calculate section-level comparison
        const sectionComparison = {};
        if (currentResponse.sectionScores && previousResponse.sectionScores) {
            const allSectionIds = new Set([
                ...Object.keys(currentResponse.sectionScores),
                ...Object.keys(previousResponse.sectionScores)
            ]);
            
            allSectionIds.forEach(sectionId => {
                const current = currentResponse.sectionScores[sectionId] || 0;
                const previous = previousResponse.sectionScores[sectionId] || 0;
                sectionComparison[sectionId] = {
                    current,
                    previous,
                    difference: current - previous
                };
            });
        }
        
        // Get trends data
        const reportGenerationService = require('../services/reportGenerationService');
        const trends = await reportGenerationService.buildTrendsChart(req.params.id, 5);
        
        res.status(200).json({
            success: true,
            data: {
                current: currentResponse,
                previous: previousResponse,
                comparison,
                sectionComparison,
                trends
            }
        });
    } catch (error) {
        console.error('Get response comparison error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching response comparison.',
            error: error.message
        });
    }
};

// @desc    Generate report
// @route   POST /api/forms/:id/responses/:responseId/generate-report
// @access  Private
exports.generateReport = async (req, res) => {
    try {
        const reportGenerationService = require('../services/reportGenerationService');
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        })
        .populate('formId')
        .populate('submittedBy', 'firstName lastName email');
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Generate report data
        const reportData = await reportGenerationService.generateReport(response._id);
        
        // Add corrective actions if available
        if (response.correctiveActions && response.correctiveActions.length > 0) {
            reportData.correctiveActions = reportGenerationService.buildCorrectiveActionsSection(response.correctiveActions).actions;
        }
        
        // Generate PDF
        let reportUrl = null;
        try {
            reportUrl = await reportGenerationService.exportToPDF(reportData, req.user.organizationId.toString());
            reportData.reportUrl = reportUrl;
        } catch (pdfError) {
            console.error('PDF generation error:', pdfError);
            // Continue without PDF if generation fails
        }
        
        // Update response with report URL
        response.reportGenerated = true;
        response.reportUrl = reportUrl;
        await response.save();
        
        res.status(200).json({
            success: true,
            message: 'Report generated successfully',
            data: reportData
        });
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating report.',
            error: error.message
        });
    }
};

// @desc    Export report to Excel
// @route   POST /api/forms/:id/responses/:responseId/export-excel
// @access  Private
exports.exportExcel = async (req, res) => {
    try {
        const reportGenerationService = require('../services/reportGenerationService');
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        })
        .populate('formId')
        .populate('submittedBy', 'firstName lastName email');
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Generate report data
        const reportData = await reportGenerationService.generateReport(response._id);
        
        // Add corrective actions if available
        if (response.correctiveActions && response.correctiveActions.length > 0) {
            reportData.correctiveActions = reportGenerationService.buildCorrectiveActionsSection(response.correctiveActions).actions;
        }
        
        // Generate Excel
        let excelUrl = null;
        try {
            excelUrl = await reportGenerationService.exportToExcel(reportData, req.user.organizationId.toString());
        } catch (excelError) {
            console.error('Excel generation error:', excelError);
            return res.status(500).json({
                success: false,
                message: 'Error generating Excel report.',
                error: excelError.message
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Excel report generated successfully',
            data: {
                excelUrl,
                reportData
            }
        });
    } catch (error) {
        console.error('Export Excel error:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting Excel report.',
            error: error.message
        });
    }
};

