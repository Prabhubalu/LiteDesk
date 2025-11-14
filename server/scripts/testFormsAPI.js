#!/usr/bin/env node

/**
 * Forms Module API Test Script
 * Tests all Forms Module endpoints
 * 
 * Usage:
 *   node server/scripts/testFormsAPI.js
 * 
 * Prerequisites:
 *   - Server must be running
 *   - Valid user credentials in .env or as arguments
 *   - Forms module enabled in organization
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || process.env.SERVER_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Test credentials (update these or pass as env vars)
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@litedesk.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Admin@123';

// Test data storage
let authToken = null;
let organizationId = null;
let userId = null;
let createdFormId = null;
let createdResponseId = null;
let publicFormSlug = null;

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
    log(`\n🧪 Testing: ${testName}`, 'cyan');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

// Test helper functions
async function makeRequest(method, url, data = null, headers = {}) {
    try {
        // DEVELOPMENT ONLY: Add bypass header for rate limiting
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const bypassRateLimit = process.env.BYPASS_RATE_LIMIT !== 'false'; // Default to true in dev
        
        const config = {
            method,
            url: `${API_BASE}${url}`,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        // Add bypass header in development mode (unless explicitly disabled)
        if (isDevelopment && bypassRateLimit) {
            config.headers['X-Bypass-Rate-Limit'] = 'true';
            config.headers['X-Test-Mode'] = 'true';
        }
        
        if (authToken) {
            config.headers.Authorization = `Bearer ${authToken}`;
        }
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data || error.message,
            status: error.response?.status || 500,
            fullError: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers
            } : null
        };
    }
}

// ============================================
// TEST FUNCTIONS
// ============================================

async function testAuthentication() {
    logTest('Authentication');
    
    const result = await makeRequest('POST', '/auth/login', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
    });
    
    if (result.success && result.data.token) {
        authToken = result.data.token;
        userId = result.data._id;
        organizationId = result.data.organization?._id || result.data.organizationId;
        logSuccess('Authentication successful');
        logInfo(`Token: ${authToken.substring(0, 20)}...`);
        logInfo(`User ID: ${userId}`);
        logInfo(`Email: ${result.data.email}`);
        logInfo(`Role: ${result.data.role}`);
        logInfo(`Organization ID: ${organizationId}`);
        logInfo(`Organization: ${result.data.organization?.name || 'N/A'}`);
        return true;
    } else {
        logError(`Authentication failed: ${JSON.stringify(result.error)}`);
        if (result.fullError) {
            logInfo(`Status: ${result.fullError.status} ${result.fullError.statusText}`);
            logInfo(`Response: ${JSON.stringify(result.fullError.data)}`);
        }
        logInfo(`\n💡 Tip: Check if user exists and credentials are correct.`);
        logInfo(`   Default: admin@litedesk.com / Admin@123456`);
        logInfo(`   Or set: TEST_EMAIL and TEST_PASSWORD environment variables`);
        return false;
    }
}

async function testCreateForm() {
    logTest('Create Form');
    
    const formData = {
        name: 'Test Audit Form',
        description: 'A test audit form for API testing',
        formType: 'Audit',
        linkedModule: 'Organization',
        visibility: 'Internal',
        status: 'Draft',
        sections: [
            {
                sectionId: 'SEC-001',
                name: 'Store Readiness',
                weightage: 40,
                order: 1,
                subsections: [
                    {
                        subsectionId: 'SUB-001',
                        name: 'Exterior',
                        weightage: 20,
                        order: 1,
                        questions: [
                            {
                                questionId: 'Q-001',
                                questionText: 'Is signage visible?',
                                type: 'Yes-No',
                                mandatory: true,
                                scoringLogic: {
                                    passValue: 'Yes',
                                    failValue: 'No',
                                    weightage: 10
                                },
                                passFailDefinition: 'Yes = Pass',
                                order: 1
                            },
                            {
                                questionId: 'Q-002',
                                questionText: 'Is parking area clean?',
                                type: 'Yes-No',
                                mandatory: true,
                                scoringLogic: {
                                    passValue: 'Yes',
                                    failValue: 'No',
                                    weightage: 10
                                },
                                passFailDefinition: 'Yes = Pass',
                                order: 2
                            }
                        ]
                    },
                    {
                        subsectionId: 'SUB-002',
                        name: 'Interior',
                        weightage: 20,
                        order: 2,
                        questions: [
                            {
                                questionId: 'Q-003',
                                questionText: 'Are shelves stocked?',
                                type: 'Yes-No',
                                mandatory: true,
                                scoringLogic: {
                                    passValue: 'Yes',
                                    failValue: 'No',
                                    weightage: 10
                                },
                                passFailDefinition: 'Yes = Pass',
                                order: 1
                            }
                        ]
                    }
                ]
            },
            {
                sectionId: 'SEC-002',
                name: 'Safety Compliance',
                weightage: 60,
                order: 2,
                subsections: [
                    {
                        subsectionId: 'SUB-003',
                        name: 'Safety',
                        weightage: 60,
                        order: 1,
                        questions: [
                            {
                                questionId: 'Q-004',
                                questionText: 'Is fire extinguisher functional?',
                                type: 'Yes-No',
                                mandatory: true,
                                scoringLogic: {
                                    passValue: 'Yes',
                                    failValue: 'No',
                                    weightage: 30
                                },
                                passFailDefinition: 'Yes = Pass',
                                order: 1
                            },
                            {
                                questionId: 'Q-005',
                                questionText: 'Are exit signs visible?',
                                type: 'Yes-No',
                                mandatory: true,
                                scoringLogic: {
                                    passValue: 'Yes',
                                    failValue: 'No',
                                    weightage: 30
                                },
                                passFailDefinition: 'Yes = Pass',
                                order: 2
                            }
                        ]
                    }
                ]
            }
        ],
        kpiMetrics: {
            compliancePercentage: true,
            satisfactionPercentage: false,
            rating: false
        },
        scoringFormula: '(Passed / Total) × 100',
        thresholds: {
            pass: 80,
            partial: 50
        },
        approvalRequired: true
    };
    
    const result = await makeRequest('POST', '/forms', formData);
    
    if (result.success && result.data.success) {
        createdFormId = result.data.data._id;
        logSuccess('Form created successfully');
        logInfo(`Form ID: ${createdFormId}`);
        logInfo(`Form ID (auto-generated): ${result.data.data.formId}`);
        return true;
    } else {
        logError(`Form creation failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testGetForms() {
    logTest('Get All Forms');
    
    const result = await makeRequest('GET', '/forms');
    
    if (result.success && result.data.success) {
        logSuccess(`Retrieved ${result.data.data.length} forms`);
        logInfo(`Total forms: ${result.data.statistics.totalForms}`);
        logInfo(`Active forms: ${result.data.statistics.activeForms}`);
        return true;
    } else {
        logError(`Get forms failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testGetFormById() {
    logTest('Get Form By ID');
    
    if (!createdFormId) {
        logError('No form ID available');
        return false;
    }
    
    const result = await makeRequest('GET', `/forms/${createdFormId}`);
    
    if (result.success && result.data.success) {
        logSuccess('Form retrieved successfully');
        logInfo(`Form Name: ${result.data.data.name}`);
        logInfo(`Form Type: ${result.data.data.formType}`);
        logInfo(`Sections: ${result.data.data.sections.length}`);
        return true;
    } else {
        logError(`Get form failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testUpdateForm() {
    logTest('Update Form');
    
    if (!createdFormId) {
        logError('No form ID available');
        return false;
    }
    
    const updateData = {
        name: 'Updated Test Audit Form',
        description: 'Updated description'
    };
    
    const result = await makeRequest('PUT', `/forms/${createdFormId}`, updateData);
    
    if (result.success && result.data.success) {
        logSuccess('Form updated successfully');
        logInfo(`Updated name: ${result.data.data.name}`);
        return true;
    } else {
        logError(`Update form failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testEnablePublicForm() {
    logTest('Enable Public Form');
    
    if (!createdFormId) {
        logError('No form ID available');
        return false;
    }
    
    // First, activate the form
    const activateData = {
        status: 'Active',
        publicLink: {
            enabled: true,
            slug: `test-form-${Date.now()}`
        }
    };
    
    const result = await makeRequest('PUT', `/forms/${createdFormId}`, activateData);
    
    if (result.success && result.data.success) {
        publicFormSlug = result.data.data.publicLink.slug;
        logSuccess('Public form enabled');
        logInfo(`Public slug: ${publicFormSlug}`);
        return true;
    } else {
        logError(`Enable public form failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testGetPublicForm() {
    logTest('Get Public Form (No Auth)');
    
    if (!publicFormSlug) {
        logError('No public form slug available');
        return false;
    }
    
    // Temporarily remove auth token
    const tempToken = authToken;
    authToken = null;
    
    const result = await makeRequest('GET', `/public/forms/${publicFormSlug}`);
    
    // Restore auth token
    authToken = tempToken;
    
    if (result.success && result.data.success) {
        logSuccess('Public form retrieved successfully');
        logInfo(`Form Name: ${result.data.data.name}`);
        return true;
    } else {
        logError(`Get public form failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testSubmitForm() {
    logTest('Submit Form Response');
    
    if (!createdFormId) {
        logError('No form ID available');
        return false;
    }
    
    const responseData = {
        responseDetails: [
            {
                questionId: 'Q-001',
                sectionId: 'SEC-001',
                subsectionId: 'SUB-001',
                answer: 'Yes'
            },
            {
                questionId: 'Q-002',
                sectionId: 'SEC-001',
                subsectionId: 'SUB-001',
                answer: 'Yes'
            },
            {
                questionId: 'Q-003',
                sectionId: 'SEC-001',
                subsectionId: 'SUB-002',
                answer: 'Yes'
            },
            {
                questionId: 'Q-004',
                sectionId: 'SEC-002',
                subsectionId: 'SUB-003',
                answer: 'No' // This will fail
            },
            {
                questionId: 'Q-005',
                sectionId: 'SEC-002',
                subsectionId: 'SUB-003',
                answer: 'Yes'
            }
        ],
        linkedTo: {
            type: 'Organization',
            id: organizationId
        }
    };
    
    const result = await makeRequest('POST', `/forms/${createdFormId}/submit`, responseData);
    
    if (result.success && result.data.success) {
        createdResponseId = result.data.data._id;
        logSuccess('Form submitted successfully');
        logInfo(`Response ID: ${createdResponseId}`);
        logInfo(`Response ID (auto-generated): ${result.data.data.responseId}`);
        logInfo(`Status: ${result.data.data.status}`);
        logInfo(`Compliance: ${result.data.data.kpis.compliancePercentage}%`);
        logInfo(`Final Score: ${result.data.data.kpis.finalScore}`);
        return true;
    } else {
        logError(`Submit form failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testGetResponses() {
    logTest('Get Form Responses');
    
    if (!createdFormId) {
        logError('No form ID available');
        return false;
    }
    
    const result = await makeRequest('GET', `/forms/${createdFormId}/responses`);
    
    if (result.success && result.data.success) {
        logSuccess(`Retrieved ${result.data.data.length} responses`);
        return true;
    } else {
        logError(`Get responses failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testGetResponseById() {
    logTest('Get Response By ID');
    
    if (!createdFormId || !createdResponseId) {
        logError('No response ID available');
        return false;
    }
    
    const result = await makeRequest('GET', `/forms/${createdFormId}/responses/${createdResponseId}`);
    
    if (result.success && result.data.success) {
        logSuccess('Response retrieved successfully');
        logInfo(`Status: ${result.data.data.status}`);
        logInfo(`Total Passed: ${result.data.data.kpis.totalPassed}`);
        logInfo(`Total Failed: ${result.data.data.kpis.totalFailed}`);
        return true;
    } else {
        logError(`Get response failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testAddCorrectiveAction() {
    logTest('Add Corrective Action');
    
    if (!createdFormId || !createdResponseId) {
        logError('No response ID available');
        return false;
    }
    
    const correctiveActionData = {
        questionId: 'Q-004',
        comment: 'Fire extinguisher needs to be replaced',
        proof: [],
        status: 'In Progress'
    };
    
    const result = await makeRequest('POST', `/forms/${createdFormId}/responses/${createdResponseId}/corrective-action`, correctiveActionData);
    
    if (result.success && result.data.success) {
        logSuccess('Corrective action added successfully');
        logInfo(`Status updated to: ${result.data.data.status}`);
        return true;
    } else {
        logError(`Add corrective action failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testVerifyCorrectiveAction() {
    logTest('Verify Corrective Action');
    
    if (!createdFormId || !createdResponseId) {
        logError('No response ID available');
        return false;
    }
    
    const verificationData = {
        questionId: 'Q-004',
        approved: true,
        comment: 'Fire extinguisher has been replaced and verified'
    };
    
    const result = await makeRequest('POST', `/forms/${createdFormId}/responses/${createdResponseId}/verify`, verificationData);
    
    if (result.success && result.data.success) {
        logSuccess('Corrective action verified successfully');
        logInfo(`Status: ${result.data.data.status}`);
        return true;
    } else {
        logError(`Verify corrective action failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testGetFormAnalytics() {
    logTest('Get Form Analytics');
    
    if (!createdFormId) {
        logError('No form ID available');
        return false;
    }
    
    const result = await makeRequest('GET', `/forms/${createdFormId}/analytics`);
    
    if (result.success && result.data.success) {
        logSuccess('Form analytics retrieved successfully');
        logInfo(`Total Responses: ${result.data.data.statistics.totalResponses}`);
        logInfo(`Avg Compliance: ${result.data.data.statistics.avgCompliance}%`);
        logInfo(`Avg Rating: ${result.data.data.statistics.avgRating}`);
        return true;
    } else {
        logError(`Get analytics failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testGetFormKPIs() {
    logTest('Get Form KPIs');
    
    if (!createdFormId) {
        logError('No form ID available');
        return false;
    }
    
    const result = await makeRequest('GET', `/forms/${createdFormId}/kpis`);
    
    if (result.success && result.data.success) {
        logSuccess('Form KPIs retrieved successfully');
        logInfo(`Form-level KPIs available: ${!!result.data.data.formKPIs}`);
        return true;
    } else {
        logError(`Get KPIs failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testDuplicateForm() {
    logTest('Duplicate Form');
    
    if (!createdFormId) {
        logError('No form ID available');
        return false;
    }
    
    const result = await makeRequest('POST', `/forms/${createdFormId}/duplicate`);
    
    if (result.success && result.data.success) {
        logSuccess('Form duplicated successfully');
        logInfo(`Duplicated Form ID: ${result.data.data._id}`);
        logInfo(`Duplicated Form Name: ${result.data.data.name}`);
        return true;
    } else {
        logError(`Duplicate form failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testExportResponses() {
    logTest('Export Responses');
    
    if (!createdFormId) {
        logError('No form ID available');
        return false;
    }
    
    const result = await makeRequest('GET', `/forms/${createdFormId}/responses/export`);
    
    if (result.success && result.status === 200) {
        logSuccess('Responses exported successfully');
        logInfo('CSV data received');
        return true;
    } else {
        logError(`Export responses failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

async function testGetResponseComparison() {
    logTest('Get Response Comparison');
    
    if (!createdFormId || !createdResponseId) {
        logError('No response ID available');
        return false;
    }
    
    const result = await makeRequest('GET', `/forms/${createdFormId}/responses/${createdResponseId}/compare`);
    
    if (result.success && result.data.success) {
        logSuccess('Response comparison retrieved');
        if (result.data.data.comparison) {
            logInfo(`Compliance Change: ${result.data.data.comparison.complianceChange}%`);
        } else {
            logInfo('No previous response for comparison');
        }
        return true;
    } else {
        logError(`Get comparison failed: ${JSON.stringify(result.error)}`);
        return false;
    }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runTests() {
    log('\n🚀 Starting Forms Module API Tests\n', 'yellow');
    log(`Base URL: ${BASE_URL}`, 'blue');
    log(`API Base: ${API_BASE}`, 'blue');
    
    // Show rate limit bypass status
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const bypassRateLimit = process.env.BYPASS_RATE_LIMIT !== 'false';
    if (isDevelopment && bypassRateLimit) {
        log(`⚠️  Rate Limit Bypass: ENABLED (Development Mode)`, 'yellow');
    } else {
        log(`🔒 Rate Limit Bypass: DISABLED`, 'blue');
    }
    log('', 'reset');
    
    const tests = [
        { name: 'Authentication', fn: testAuthentication, required: true },
        { name: 'Create Form', fn: testCreateForm, required: true },
        { name: 'Get All Forms', fn: testGetForms, required: false },
        { name: 'Get Form By ID', fn: testGetFormById, required: false },
        { name: 'Update Form', fn: testUpdateForm, required: false },
        { name: 'Enable Public Form', fn: testEnablePublicForm, required: false },
        { name: 'Get Public Form', fn: testGetPublicForm, required: false },
        { name: 'Submit Form', fn: testSubmitForm, required: true },
        { name: 'Get Responses', fn: testGetResponses, required: false },
        { name: 'Get Response By ID', fn: testGetResponseById, required: false },
        { name: 'Add Corrective Action', fn: testAddCorrectiveAction, required: false },
        { name: 'Verify Corrective Action', fn: testVerifyCorrectiveAction, required: false },
        { name: 'Get Form Analytics', fn: testGetFormAnalytics, required: false },
        { name: 'Get Form KPIs', fn: testGetFormKPIs, required: false },
        { name: 'Duplicate Form', fn: testDuplicateForm, required: false },
        { name: 'Export Responses', fn: testExportResponses, required: false },
        { name: 'Get Response Comparison', fn: testGetResponseComparison, required: false }
    ];
    
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            if (result) {
                passed++;
            } else {
                failed++;
                if (test.required) {
                    logError(`Required test failed: ${test.name}. Stopping tests.`);
                    break;
                }
            }
        } catch (error) {
            logError(`Test ${test.name} threw an error: ${error.message}`);
            failed++;
            if (test.required) {
                break;
            }
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    log('\n' + '='.repeat(50), 'yellow');
    log('📊 TEST SUMMARY', 'yellow');
    log('='.repeat(50), 'yellow');
    log(`✅ Passed: ${passed}`, 'green');
    log(`❌ Failed: ${failed}`, 'red');
    log(`⏭️  Skipped: ${skipped}`, 'blue');
    log('='.repeat(50) + '\n', 'yellow');
    
    if (failed === 0) {
        log('🎉 All tests passed!', 'green');
        process.exit(0);
    } else {
        log('⚠️  Some tests failed. Check the output above for details.', 'red');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
});

