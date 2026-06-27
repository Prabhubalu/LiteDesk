/**
 * Template Validator
 * 
 * Validates that templates meet the requirements for PDF generation.
 * Ensures deterministic, enterprise-grade report generation.
 */

const { ReportBlockType } = require('../../types/reportBlockContract');
const { buildDefaultResponseTemplate } = require('../../utils/defaultResponseTemplate');

/**
 * Core block types that must be present in every template
 */
const REQUIRED_CORE_BLOCKS = [
    ReportBlockType.REPORT_IDENTITY,
    ReportBlockType.OVERALL_PERFORMANCE,
    ReportBlockType.SECTION_BREAKDOWN
];

/**
 * Validate template structure and core blocks
 * @param {Object} template - Template object to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateTemplate(template) {
    const errors = [];

    // Check if template exists
    if (!template) {
        errors.push('Template is required for PDF generation');
        return { valid: false, errors };
    }

    // Check if template has blocks
    if (!template.blocks || !Array.isArray(template.blocks)) {
        errors.push('Template must have a blocks array');
        return { valid: false, errors };
    }

    if (template.blocks.length === 0) {
        errors.push('Template must have at least one block');
        return { valid: false, errors };
    }

    // Check for required core blocks
    // Normalize block types to uppercase for comparison (handle case-insensitive matching)
    const blockTypes = template.blocks.map(block => block.type ? block.type.toUpperCase() : null);
    const normalizedRequiredBlocks = REQUIRED_CORE_BLOCKS.map(block => block.toUpperCase());
    
    const missingCoreBlocks = normalizedRequiredBlocks.filter(
        coreType => !blockTypes.includes(coreType)
    );

    if (missingCoreBlocks.length > 0) {
        errors.push(
            `Template is missing required core blocks: ${missingCoreBlocks.join(', ')}`
        );
    }

    // Validate block structure
    template.blocks.forEach((block, index) => {
        if (!block.type) {
            errors.push(`Block at index ${index} is missing type`);
        }

        if (block.order === undefined || block.order === null) {
            errors.push(`Block at index ${index} (type: ${block.type}) is missing order`);
        }

        // Validate that mandatory/locked blocks cannot be removed or hidden
        if (block.mandatory && block.visibilityRule && block.visibilityRule !== 'ALWAYS') {
            errors.push(
                `Block at index ${index} (type: ${block.type}) is mandatory but has visibility rule ${block.visibilityRule}. Mandatory blocks must always be visible.`
            );
        }
    });

    // Validate block ordering
    const orders = template.blocks.map(block => block.order || 0);
    const hasDuplicateOrders = new Set(orders).size !== orders.length;
    if (hasDuplicateOrders) {
        errors.push('Blocks must have unique order values');
    }

    // Validate that core blocks are mandatory and locked
    template.blocks.forEach((block, index) => {
        // Normalize block type for comparison (case-insensitive)
        const blockTypeUpper = block.type ? block.type.toUpperCase() : '';
        const isCoreBlock = REQUIRED_CORE_BLOCKS.some(coreType => coreType.toUpperCase() === blockTypeUpper);
        
        if (isCoreBlock) {
            if (!block.mandatory) {
                errors.push(
                    `Core block at index ${index} (type: ${block.type}) must be marked as mandatory`
                );
            }
            if (!block.locked) {
                errors.push(
                    `Core block at index ${index} (type: ${block.type}) must be marked as locked`
                );
            }
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

function findTemplateById(templates, templateId) {
    if (!templateId || !templates?.length) {
        return null;
    }
    const idStr = templateId.toString();
    return templates.find(
        (t) =>
            (t._id && t._id.toString() === idStr) ||
            (t.id && t.id.toString() === idStr)
    );
}

/**
 * Get active template from form
 * @param {Object} form - Form object with responseTemplate field
 * @param {Object} [options]
 * @param {boolean} [options.useDefaultFallback=true] - Use built-in default when no templates exist
 * @returns {Object|null} Active template or null
 */
function getActiveTemplate(form, options = {}) {
    const { useDefaultFallback = true } = options;

    if (!form) {
        return null;
    }

    const { templates, activeTemplateId } = form.responseTemplate || {};

    if (!templates || !Array.isArray(templates) || templates.length === 0) {
        return useDefaultFallback ? buildDefaultResponseTemplate().template : null;
    }

    if (activeTemplateId) {
        const activeTemplate = findTemplateById(templates, activeTemplateId);
        if (activeTemplate) {
            return activeTemplate;
        }
    }

    return templates[0];
}

module.exports = {
    validateTemplate,
    getActiveTemplate,
    REQUIRED_CORE_BLOCKS
};

