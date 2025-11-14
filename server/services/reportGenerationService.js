const FormResponse = require('../models/FormResponse');
const Form = require('../models/Form');

/**
 * Generate final report using template
 * @param {ObjectId} responseId - Response ID
 * @param {ObjectId} templateId - Template ID (optional)
 * @returns {Promise<Object>} Generated report data
 */
exports.generateReport = async (responseId, templateId = null) => {
    try {
        const response = await FormResponse.findById(responseId)
            .populate('formId')
            .populate('submittedBy', 'firstName lastName email');
        
        if (!response) {
            throw new Error('Response not found');
        }
        
        // Calculate overall score from section scores
        let overallScore = 0;
        if (response.sectionScores && typeof response.sectionScores === 'object') {
            const scores = Object.values(response.sectionScores).filter(s => typeof s === 'number');
            if (scores.length > 0) {
                const sum = scores.reduce((acc, score) => acc + score, 0);
                overallScore = Math.round(sum / scores.length);
            }
        }
        
        return {
            responseId: response._id,
            formName: response.formId.name,
            submittedBy: response.submittedBy ? `${response.submittedBy.firstName} ${response.submittedBy.lastName}` : 'N/A',
            submittedAt: response.submittedAt,
            kpis: {
                ...response.kpis,
                finalScore: response.kpis?.finalScore || overallScore,
                passRate: response.kpis?.passRate || 0
            },
            sectionScores: response.sectionScores,
            overallScore,
            reportUrl: null // Will be set after PDF generation
        };
    } catch (error) {
        console.error('Generate report error:', error);
        throw error;
    }
};

/**
 * Build comparison table (Current vs Previous)
 * @param {ObjectId} currentResponseId - Current response ID
 * @param {ObjectId} previousResponseId - Previous response ID
 * @returns {Promise<Object>} Comparison data
 */
exports.buildComparisonTable = async (currentResponseId, previousResponseId) => {
    try {
        const current = await FormResponse.findById(currentResponseId);
        const previous = await FormResponse.findById(previousResponseId);
        
        if (!current || !previous) {
            throw new Error('Response not found');
        }
        
        return {
            metrics: [
                {
                    name: 'Compliance %',
                    current: current.kpis.compliancePercentage,
                    previous: previous.kpis.compliancePercentage,
                    change: current.kpis.compliancePercentage - previous.kpis.compliancePercentage
                },
                {
                    name: 'Failed Points',
                    current: current.kpis.totalFailed,
                    previous: previous.kpis.totalFailed,
                    change: current.kpis.totalFailed - previous.kpis.totalFailed
                },
                {
                    name: 'Final Score',
                    current: current.kpis.finalScore,
                    previous: previous.kpis.finalScore,
                    change: current.kpis.finalScore - previous.kpis.finalScore
                }
            ]
        };
    } catch (error) {
        console.error('Build comparison table error:', error);
        throw error;
    }
};

/**
 * Build trends chart (Multi-audit trends)
 * @param {ObjectId} formId - Form ID
 * @param {Number} limit - Number of recent responses to include
 * @returns {Promise<Object>} Trends data
 */
exports.buildTrendsChart = async (formId, limit = 5) => {
    try {
        const responses = await FormResponse.find({ formId })
            .sort({ submittedAt: -1 })
            .limit(limit)
            .select('submittedAt kpis.compliancePercentage kpis.finalScore');
        
        return {
            labels: responses.map(r => r.submittedAt.toISOString().split('T')[0]),
            compliance: responses.map(r => r.kpis.compliancePercentage),
            scores: responses.map(r => r.kpis.finalScore)
        };
    } catch (error) {
        console.error('Build trends chart error:', error);
        throw error;
    }
};

/**
 * Build KPI section
 * @param {Object} kpis - KPI object
 * @returns {Object} KPI section data
 */
exports.buildKPISection = (kpis) => {
    return {
        compliancePercentage: kpis.compliancePercentage,
        satisfactionPercentage: kpis.satisfactionPercentage,
        rating: kpis.rating,
        totalPassed: kpis.totalPassed,
        totalFailed: kpis.totalFailed,
        totalQuestions: kpis.totalQuestions,
        finalScore: kpis.finalScore
    };
};

/**
 * Build corrective actions section
 * @param {Array} correctiveActions - Corrective actions array
 * @returns {Object} Corrective actions section data
 */
exports.buildCorrectiveActionsSection = (correctiveActions) => {
    return {
        total: correctiveActions.length,
        resolved: correctiveActions.filter(a => a.managerAction.status === 'Resolved').length,
        inProgress: correctiveActions.filter(a => a.managerAction.status === 'In Progress').length,
        pending: correctiveActions.filter(a => a.managerAction.status === 'Pending').length,
        actions: correctiveActions.map(action => ({
            questionText: action.questionText,
            auditorFinding: action.auditorFinding,
            managerAction: action.managerAction,
            auditorVerification: action.auditorVerification
        }))
    };
};

/**
 * Export report to PDF
 * @param {Object} reportData - Report data object
 * @param {String} organizationId - Organization ID for file storage
 * @returns {Promise<String>} PDF file URL
 */
exports.exportToPDF = async (reportData, organizationId) => {
    try {
        const PDFDocument = require('pdfkit');
        const fs = require('fs');
        const path = require('path');
        
        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        
        // Generate filename
        const filename = `report-${reportData.responseId}-${Date.now()}.pdf`;
        const reportsDir = path.join(__dirname, '../uploads', organizationId.toString(), 'reports');
        
        // Ensure reports directory exists
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const filePath = path.join(reportsDir, filename);
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        
        // Add content to PDF
        doc.fontSize(20).text(reportData.formName || 'Form Report', { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(12).text(`Submitted by: ${reportData.submittedBy || 'N/A'}`, { align: 'left' });
        doc.text(`Submitted at: ${new Date(reportData.submittedAt).toLocaleString()}`, { align: 'left' });
        doc.moveDown();
        
        // Overall Score
        if (reportData.kpis) {
            doc.fontSize(16).text('Summary', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12);
            doc.text(`Overall Score: ${reportData.kpis.finalScore || 'N/A'}%`);
            doc.text(`Compliance: ${reportData.kpis.compliancePercentage || 'N/A'}%`);
            doc.text(`Pass Rate: ${reportData.kpis.passRate || 'N/A'}%`);
            doc.moveDown();
        }
        
        // Section Scores
        if (reportData.sectionScores) {
            doc.fontSize(16).text('Section Scores', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12);
            Object.entries(reportData.sectionScores).forEach(([sectionId, score]) => {
                doc.text(`${sectionId}: ${score}%`);
            });
            doc.moveDown();
        }
        
        // Corrective Actions
        if (reportData.correctiveActions && reportData.correctiveActions.length > 0) {
            doc.fontSize(16).text('Corrective Actions', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12);
            reportData.correctiveActions.forEach((action, index) => {
                doc.text(`${index + 1}. ${action.questionText}`);
                doc.text(`   Status: ${action.managerAction?.status || 'Pending'}`);
                if (action.managerAction?.comment) {
                    doc.text(`   Comment: ${action.managerAction.comment}`, { indent: 20 });
                }
                doc.moveDown(0.5);
            });
        }
        
        // Finalize PDF
        doc.end();
        
        // Wait for stream to finish
        await new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
        
        // Return URL
        return `/api/uploads/${organizationId}/reports/${filename}`;
    } catch (error) {
        console.error('Export to PDF error:', error);
        throw error;
    }
};

/**
 * Export report to Excel
 * @param {Object} reportData - Report data object
 * @param {String} organizationId - Organization ID for file storage
 * @returns {Promise<String>} Excel file URL
 */
exports.exportToExcel = async (reportData, organizationId) => {
    try {
        const ExcelJS = require('exceljs');
        const fs = require('fs');
        const path = require('path');
        
        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Form Report');
        
        // Set column widths
        worksheet.columns = [
            { width: 30 },
            { width: 20 }
        ];
        
        // Header row
        worksheet.mergeCells('A1:B1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = reportData.formName || 'Form Report';
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.addRow([]);
        
        // Report metadata
        worksheet.addRow(['Submitted by:', reportData.submittedBy || 'N/A']);
        worksheet.addRow(['Submitted at:', new Date(reportData.submittedAt).toLocaleString()]);
        worksheet.addRow(['Report generated:', new Date().toLocaleString()]);
        worksheet.addRow([]);
        
        // Summary KPIs section
        if (reportData.kpis) {
            worksheet.mergeCells('A6:B6');
            const summaryHeader = worksheet.getCell('A6');
            summaryHeader.value = 'Summary';
            summaryHeader.font = { size: 14, bold: true };
            summaryHeader.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            
            worksheet.addRow(['Overall Score:', `${reportData.kpis.finalScore || 'N/A'}%`]);
            worksheet.addRow(['Compliance:', `${reportData.kpis.compliancePercentage || 'N/A'}%`]);
            worksheet.addRow(['Pass Rate:', `${reportData.kpis.passRate || 'N/A'}%`]);
            if (reportData.kpis.totalFailed !== undefined) {
                worksheet.addRow(['Total Failed:', reportData.kpis.totalFailed]);
            }
            if (reportData.kpis.totalPassed !== undefined) {
                worksheet.addRow(['Total Passed:', reportData.kpis.totalPassed]);
            }
            worksheet.addRow([]);
        }
        
        // Section Scores section
        if (reportData.sectionScores && Object.keys(reportData.sectionScores).length > 0) {
            const sectionRow = worksheet.addRow(['Section Scores', '']);
            sectionRow.getCell(1).font = { size: 14, bold: true };
            sectionRow.getCell(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            worksheet.mergeCells(`A${sectionRow.number}:B${sectionRow.number}`);
            
            Object.entries(reportData.sectionScores).forEach(([sectionId, score]) => {
                worksheet.addRow([sectionId, `${score}%`]);
            });
            worksheet.addRow([]);
        }
        
        // Corrective Actions section
        if (reportData.correctiveActions && reportData.correctiveActions.length > 0) {
            const caRow = worksheet.addRow(['Corrective Actions', '']);
            caRow.getCell(1).font = { size: 14, bold: true };
            caRow.getCell(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            worksheet.mergeCells(`A${caRow.number}:B${caRow.number}`);
            
            // Header for corrective actions table
            const caHeaderRow = worksheet.addRow(['Question', 'Status']);
            caHeaderRow.getRow().font = { bold: true };
            caHeaderRow.getRow().fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F0F0' }
            };
            
            reportData.correctiveActions.forEach((action) => {
                const row = worksheet.addRow([
                    action.questionText || 'N/A',
                    action.managerAction?.status || 'Pending'
                ]);
                
                // Add comment if available
                if (action.managerAction?.comment) {
                    worksheet.addRow(['Comment:', action.managerAction.comment]);
                    worksheet.mergeCells(`A${worksheet.rowCount}:B${worksheet.rowCount}`);
                }
                
                // Add verification status if available
                if (action.auditorVerification?.verifiedBy) {
                    worksheet.addRow([
                        'Verified:',
                        action.auditorVerification.approved ? 'Approved' : 'Rejected'
                    ]);
                    if (action.auditorVerification.comment) {
                        worksheet.addRow(['Verification Comment:', action.auditorVerification.comment]);
                        worksheet.mergeCells(`A${worksheet.rowCount}:B${worksheet.rowCount}`);
                    }
                }
                
                worksheet.addRow([]); // Empty row between actions
            });
        }
        
        // Generate filename
        const filename = `report-${reportData.responseId}-${Date.now()}.xlsx`;
        const reportsDir = path.join(__dirname, '../uploads', organizationId.toString(), 'reports');
        
        // Ensure reports directory exists
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const filePath = path.join(reportsDir, filename);
        
        // Write file
        await workbook.xlsx.writeFile(filePath);
        
        // Return URL
        return `/api/uploads/${organizationId}/reports/${filename}`;
    } catch (error) {
        console.error('Export to Excel error:', error);
        throw error;
    }
};

