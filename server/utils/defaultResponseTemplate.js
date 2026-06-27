/**
 * Default response template for PDF report generation.
 * Mirrors the core blocks created by ResponseTemplateBuilder.vue on the client.
 */

const CORE_BLOCK_IDS = {
    REPORT_IDENTITY: 'core_report_identity',
    OVERALL_PERFORMANCE: 'core_overall_performance',
    SECTION_BREAKDOWN: 'core_section_breakdown'
};

function getDefaultBranding() {
    return {
        logo: null,
        colors: {
            primary: '#FF6B35',
            secondary: '#004E89',
            success: '#4CAF50',
            danger: '#F44336',
            warning: '#FF9800',
            text: '#333333',
            textLight: '#666666',
            background: '#FFFFFF'
        },
        typography: {
            fontFamily: 'Arial, sans-serif',
            headingFont: 'Arial, sans-serif',
            baseFontSize: 12
        },
        header: {
            showLogo: true,
            showCompanyName: true,
            alignment: 'center'
        },
        footer: {
            showDisclaimer: true,
            disclaimerText: 'Confidential property of GDI',
            alignment: 'right'
        }
    };
}

function createCoreBlocks() {
    return [
        {
            id: CORE_BLOCK_IDS.REPORT_IDENTITY,
            type: 'report_identity',
            mandatory: true,
            locked: true,
            visibilityRule: 'ALWAYS',
            order: 0,
            config: {
                companyName: '',
                reportTitle: 'Audit Report',
                showAuditId: true,
                showDates: true,
                showRound: true,
                showAddress: false,
                showGeneralManager: false
            }
        },
        {
            id: CORE_BLOCK_IDS.OVERALL_PERFORMANCE,
            type: 'overall_performance',
            mandatory: true,
            locked: true,
            visibilityRule: 'ALWAYS',
            order: 1,
            config: {
                showScore: true,
                showRating: true,
                showBenchmark: true,
                showScoreBreakdown: true,
                showClassification: true,
                chartType: 'donut',
                showPerformanceHistory: false
            }
        },
        {
            id: CORE_BLOCK_IDS.SECTION_BREAKDOWN,
            type: 'section_breakdown',
            mandatory: true,
            locked: true,
            visibilityRule: 'ALWAYS',
            order: 2,
            config: {
                showCurrentScores: true,
                showPreviousScores: false,
                showChange: false,
                showPassFailCounts: true,
                sortBy: 'default',
                sortOrder: 'asc'
            }
        }
    ];
}

function buildDefaultResponseTemplate() {
    const template = {
        id: 'default',
        name: 'Default Template',
        isDefault: true,
        blocks: createCoreBlocks(),
        branding: getDefaultBranding()
    };

    return {
        template,
        responseTemplate: {
            templates: [template],
            activeTemplateId: null
        }
    };
}

module.exports = {
    CORE_BLOCK_IDS,
    getDefaultBranding,
    createCoreBlocks,
    buildDefaultResponseTemplate
};
