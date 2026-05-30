/**
 * Block-Based PDF Generation Service
 * 
 * Generates PDF reports from template blocks in order.
 * This is the ONLY supported PDF generation path.
 * 
 * Templates must contain required core blocks and be properly structured.
 */

const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const fileStorage = require('../fileStorageService');
const FormResponse = require('../../models/FormResponse');
const Form = require('../../models/Form');
const { getBlockRenderer, hasBlockRenderer } = require('./blockRendererRegistry');
const { evaluateBlockVisibility, filterVisibleBlocks } = require('../../utils/blockVisibility');
const reportTemplateService = require('../reportTemplateService');
const { validateTemplate } = require('./templateValidator');

/**
 * Generate PDF from template blocks
 * @param {ObjectId} responseId - Response ID
 * @param {Object} template - Template object with blocks and branding
 * @param {Object} options - Generation options
 * @returns {Promise<String>} PDF file URL
 * @throws {Error} If template validation fails
 */
async function generatePdfFromTemplateBlocks(responseId, template, options = {}) {
    // Validate template before proceeding
    const validation = validateTemplate(template);
    if (!validation.valid) {
        throw new Error(
            `Template validation failed: ${validation.errors.join('; ')}`
        );
    }
    try {
        const {
            organizationId,
            includeComparison = false,
            previousResponseId = null
        } = options;
        
        // Fetch response with all related data
        const response = await FormResponse.findById(responseId)
            .populate('formId')
            .populate('submittedBy', 'firstName lastName email')
            .populate('organizationId', 'name');
        
        if (!response) {
            throw new Error('Response not found');
        }
        
        if (!response.formId) {
            throw new Error('Form ID not found in response');
        }
        
        if (!response.organizationId) {
            throw new Error('Organization ID not found in response');
        }
        
        // Fetch previous response if comparison is needed
        let previousResponse = null;
        if (includeComparison && previousResponseId) {
            previousResponse = await FormResponse.findById(previousResponseId)
                .populate('formId');
        }
        
        // Get historical responses count for visibility evaluation
        const historicalResponsesCount = await FormResponse.countDocuments({
            formId: response.formId._id || response.formId,
            organizationId: response.organizationId._id || response.organizationId,
            _id: { $ne: responseId }
        });
        
        // Build context for renderers
        const context = {
            previousResponse,
            historicalResponsesCount,
            benchmarkScore: options.benchmarkScore || 80,
            round: options.round || '1st Round 2024'
        };
        
        // Get branding from template (with defaults)
        const branding = template.branding || reportTemplateService.extractBrandingFromTemplate(template);
        
        // Build response data object for visibility evaluation
        const responseDataForVisibility = {
            sectionScores: response.sectionScores || [],
            responseDetails: response.responseDetails || [],
            correctiveActions: response.correctiveActions || [],
            kpis: response.kpis || {}
        };
        
        // Filter blocks based on visibility rules
        const visibleBlocks = filterVisibleBlocks(
            template.blocks || [],
            responseDataForVisibility,
            context
        );
        
        // Sort blocks by order
        const sortedBlocks = visibleBlocks.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        // Validate determinism: Ensure no duplicate block IDs
        const blockIds = sortedBlocks.map(block => block.id).filter(Boolean);
        const duplicateIds = blockIds.filter((id, index) => blockIds.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            throw new Error(
                `Template contains duplicate block IDs: ${duplicateIds.join(', ')}. ` +
                'Each block must have a unique ID for deterministic rendering.'
            );
        }
        
        // Validate determinism: Ensure all blocks have explicit order
        const blocksWithoutOrder = sortedBlocks.filter(block => block.order === undefined || block.order === null);
        if (blocksWithoutOrder.length > 0) {
            throw new Error(
                `Template contains blocks without explicit order: ${blocksWithoutOrder.map(b => b.type).join(', ')}. ` +
                'All blocks must have an explicit order value for deterministic rendering.'
            );
        }
        
        // Generate PDF
        const pdfUrl = await generatePDFFromBlocks(
            sortedBlocks,
            response,
            branding,
            context,
            organizationId
        );
        
        return pdfUrl;
    } catch (error) {
        console.error('Generate PDF from template blocks error:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

/**
 * Generate PDF document from blocks
 * @param {Array} blocks - Array of visible, sorted blocks
 * @param {Object} responseData - FormResponse data
 * @param {Object} branding - Branding configuration
 * @param {Object} context - Additional context
 * @param {string} organizationId - Organization ID
 * @returns {Promise<String>} PDF file URL
 */
async function generatePDFFromBlocks(blocks, responseData, branding, context, organizationId) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                size: 'A4',
                margin: 0
            });
            
            // Apply branding to document
            applyBrandingToDocument(doc, branding);
            
            // Generate filename
            const auditId = responseData.responseId || responseData._id.toString();
            const sanitizedAuditId = auditId.toString().replace(/[^a-zA-Z0-9-_]/g, '-');
            const filename = `block-based-report-${sanitizedAuditId}-${Date.now()}.pdf`;

            const chunks = [];
            const stream = new PassThrough();
            stream.on('data', (chunk) => chunks.push(chunk));
            doc.pipe(stream);
            
            // Render blocks in order (fully driven by template block order)
            // NO hardcoded page sequencing - structure is determined by template
            let currentY = 0;
            const pageHeight = doc.page.height;
            const margin = 24; // Reduced margin for more content space
            
            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i];
                const blockConfig = block.config || {};
                
                // Check if renderer exists
                if (!hasBlockRenderer(block.type)) {
                    console.warn(`Block renderer not implemented for type: ${block.type}. Skipping.`);
                    continue;
                }
                
                // Get renderer
                const renderer = getBlockRenderer(block.type);
                
                // Check if we need a new page (automatic page break when content exceeds page)
                if (i > 0 && currentY > pageHeight - 100) {
                    doc.addPage();
                    applyBrandingToDocument(doc, branding);
                    currentY = margin;
                }
                
                // Render block
                try {
                    // Convert response to plain object if needed
                    const responseDataObj = responseData.toObject ? responseData.toObject() : responseData;
                    
                    // For first block, start at margin; otherwise use current Y position
                    const startY = i === 0 ? margin : currentY;
                    
                    const result = await renderer(doc, responseDataObj, blockConfig, branding, context, startY);
                    
                    // Update current Y position based on returned endY or calculate from height
                    if (result.endY !== undefined) {
                        currentY = result.endY;
                    } else {
                        currentY = startY + (result.height || 200);
                    }
                    
                    // Add spacing between blocks
                    if (!result.pageBreak && i < blocks.length - 1) {
                        currentY += 20; // Add 20px spacing between blocks
                    }
                    
                    // Add page break if block explicitly requests it
                    if (result.pageBreak) {
                        doc.addPage();
                        applyBrandingToDocument(doc, branding);
                        currentY = margin;
                    }
                } catch (renderError) {
                    console.error(`Error rendering block ${block.type}:`, renderError);
                    console.error('Block render error stack:', renderError.stack);
                    // Do NOT continue - fail fast to ensure deterministic output
                    throw new Error(
                        `Failed to render block ${block.type} (ID: ${block.id || 'unknown'}): ${renderError.message}`
                    );
                }
            }
            
            // Finalize PDF
            doc.end();
            
            // Wait for stream to finish
            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', reject);
            });

            const uploadResult = await fileStorage.uploadBuffer({
                buffer: Buffer.concat(chunks),
                originalName: filename,
                mimeType: 'application/pdf',
                organizationId,
                category: 'reports'
            });

            resolve(uploadResult.url);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Apply branding to PDF document
 * @param {PDFDocument} doc - PDFDocument instance
 * @param {Object} branding - Branding configuration
 */
function applyBrandingToDocument(doc, branding) {
    // Set default font family if branding specifies it
    if (branding?.typography?.fontFamily) {
        // PDFKit doesn't directly support setting default font family per page
        // This will be applied per text element in renderers
    }
    
    // Header and footer will be applied per page in renderers
    // This function can be extended to set document-level defaults
}

module.exports = {
    generatePdfFromTemplateBlocks
};

