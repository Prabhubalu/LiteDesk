# Forms Module - Comprehensive Implementation Plan

**Status:** 📋 Planning Phase  
**Date:** December 2024  
**Module:** Forms Builder, Audit/Inspection System & Submission Management

---

## 📋 Overview

The Forms Module is a **strategic data-collection engine** that enables businesses to design, assign, execute, review, and analyze structured inputs such as:
- **Audits** (compliance/inspections with scoring)
- **Surveys** (polls/public forms with expiry)
- **Feedback** (customer/partner satisfaction with ratings)
- **Inspections** (field service/maintenance with auto-task closure)
- **Custom** (any workflow)

### Why This Module Exists

**Before:** Organizations relied on external form tools (Google Forms, Typeform, Zoho Forms) that:
- Stored data outside the system
- Had no linkage to CRM records
- Lacked approval and corrective flows
- Required manual CSV imports
- Couldn't track historical performance or compliance
- Had no automation or KPI-driven insights

**After:** Unified data capture within CRM with:
- ✅ Context-aware integration with CRM modules
- ✅ Smart workflows + scoring + approvals
- ✅ Real-time KPIs, trends, and insights
- ✅ 100% reusable multi-use templates

---

## 🎯 Core Requirements

### 1. Form Types & Behaviors

| Type | Purpose | Unique Behavior |
|------|---------|----------------|
| **Audit** | Compliance or inspections | Scoring logic + Pass/Fail thresholds |
| **Feedback** | Customer/partner satisfaction | Ratings + comments + NPS |
| **Survey** | Polls/public forms | Expiry + public link + response rate |
| **Inspection** | Field service/maintenance | Auto-close linked task |
| **Custom** | Any workflow | Fully customizable |

### 2. Form Structure

**Hierarchical Organization:**
- **Sections** (main categories with weightage)
  - **Sub-sections** (nested groups with weightage)
    - **Questions** (individual questions with scoring)

**Example:**
```
Section: Store Readiness (40%)
  Sub-section: Exterior (20%)
    Q1: Is signage visible? (Yes/No, Pass/Fail)
    Q2: Is parking area clean? (Yes/No, Pass/Fail)
  Sub-section: Interior (20%)
    Q3: Are shelves stocked? (Yes/No, Pass/Fail)

Section: Safety Compliance (60%)
  Q4: Is fire extinguisher functional? (Yes/No, Pass/Fail)
  Q5: Are exit signs visible? (Yes/No, Pass/Fail)
```

### 3. Scoring & KPI Calculation

- **Question-level scoring**: Pass/Fail based on answer
- **Section-level KPIs**: Pass %, Fail %, Score per section
- **Form-level KPIs**: Compliance %, Satisfaction %, Rating
- **Scoring Formula**: `(Passed / Total) × 100`
- **Thresholds**: Pass ≥ 80%, Partial ≥ 50%

### 4. Approval Workflow (Corrective Action Flow)

**Complete Flow:**
1. **Auditor submits audit** → Status: `Pending Corrective Action`
2. **Store Manager reviews failed questions** → Adds corrective actions
3. **Auditor re-verifies** → Approves or rejects
4. **Final report generated** → Includes comparisons and trends

### 5. Response Template (Report Designer)

- Default templates + custom templates
- Auto-compare Current vs Previous audits
- Multi-audit trends (last 3-5 audits)
- Drag/drop page builder
- Charts (Line/Bar/Pie)
- Corrective action blocks
- Automatic report generation

### 6. Event Integration

- Forms can be linked to Events
- Events can assign forms to auditors
- Recurring audits via recurring events
- "My Audits" view for assigned auditors

### 7. Organization Widget

- Audit summary on Organization records
- Shows: Audit Name, Date, Auditor, Score %, Result, Corrective Actions
- Summary KPIs: Avg compliance, Pass rate, Trend, Last audit date

---

## 🏗️ Architecture

### Backend Components

#### 1. Database Models

**A) Form Model** (`/server/models/Form.js`)
```javascript
{
  // Multi-tenancy
  organizationId: ObjectId (ref: 'Organization', required, indexed)
  
  // Form Identification
  formId: String (auto-generated: FRM-001, unique)
  name: String (required)
  description: String
  formType: String (enum: 'Audit', 'Survey', 'Feedback', 'Inspection', 'Custom')
  
  // Form Details Tab
  linkedModule: String (enum: 'Organization', 'Deal', 'Task', 'Event', 'Lead', 'Contact')
  visibility: String (enum: 'Internal', 'Partner', 'Public')
  status: String (enum: 'Draft', 'Active', 'Closed')
  assignedTo: ObjectId (ref: 'User')
  expiryDate: Date (for Surveys)
  tags: [String]
  approvalRequired: Boolean
  linkedReport: ObjectId (ref: 'Report')
  attachments: [String] // File URLs
  notes: String
  
  // Sections & Questions (hierarchical)
  sections: [{
    sectionId: String (auto-generated)
    name: String (required)
    weightage: Number (percentage, default: 0)
    order: Number
    subsections: [{
      subsectionId: String (auto-generated)
      name: String
      weightage: Number
      order: Number
      questions: [{
        questionId: String (auto-generated)
        questionText: String (required)
        type: String (enum: 'Text', 'Dropdown', 'Rating', 'File', 'Signature', 'Yes-No')
        options: [String] // For dropdown/checkbox
        mandatory: Boolean
        scoringLogic: {
          passValue: Mixed // e.g., "Yes" or 4
          failValue: Mixed // e.g., "No" or < 4
          weightage: Number // Question weightage
        }
        conditionalLogic: {
          showIf: {
            questionId: String
            operator: String (enum: 'equals', 'not_equals', 'contains')
            value: Mixed
          }
        }
        attachmentAllowance: Boolean
        passFailDefinition: String // e.g., "Yes = Pass"
        order: Number
      }]
    }]
  }]
  
  // Settings & Logic Tab
  kpiMetrics: {
    compliancePercentage: Boolean
    satisfactionPercentage: Boolean
    rating: Boolean
  }
  scoringFormula: String (default: "(Passed / Total) × 100")
  thresholds: {
    pass: Number (default: 80)
    partial: Number (default: 50)
  }
  autoAssignment: {
    enabled: Boolean
    linkTo: String // 'org' | 'events'
  }
  workflowOnSubmit: {
    notify: [ObjectId] // Users to notify
    createTask: Boolean
    updateField: {
      field: String
      value: Mixed
    }
  }
  approvalWorkflow: {
    enabled: Boolean
    approver: ObjectId (ref: 'User')
  }
  formVersion: Number (auto-increment)
  publicLink: {
    enabled: Boolean
    slug: String (unique, for public URLs)
  }
  
  // Response Template
  responseTemplate: {
    templateId: String (ref: 'ResponseTemplate')
    customTemplate: {
      layout: Schema.Types.Mixed // Drag-drop structure
      includeComparison: Boolean
      includeTrends: Boolean
      includeCharts: Boolean
      includeCorrectiveActions: Boolean
    }
  }
  
  // Analytics (calculated)
  totalResponses: Number (default: 0)
  avgRating: Number
  avgCompliance: Number
  responseRate: Number
  lastSubmission: Date
  
  // Metadata
  createdBy: ObjectId (ref: 'User')
  modifiedBy: ObjectId (ref: 'User')
  timestamps: { createdAt, updatedAt }
}
```

**B) FormResponse Model** (`/server/models/FormResponse.js`)
```javascript
{
  // Multi-tenancy
  organizationId: ObjectId (ref: 'Organization', required, indexed)
  formId: ObjectId (ref: 'Form', required, indexed)
  
  // Response Identification
  responseId: String (auto-generated: RSP-001)
  
  // Linked Records
  linkedTo: {
    type: String (enum: 'Organization', 'Deal', 'Task', 'Event', 'Lead', 'Contact')
    id: ObjectId (refPath: 'linkedTo.type')
  }
  
  // Submitter Info
  submittedBy: ObjectId (ref: 'User')
  submittedAt: Date (default: Date.now)
  
  // Response Data (question-level)
  responseDetails: [{
    questionId: String (required)
    sectionId: String
    subsectionId: String
    answer: Schema.Types.Mixed // Can be String, Number, Boolean, [String], File URL
    score: Number // Calculated score for this question
    passFail: String (enum: 'Pass', 'Fail', 'N/A')
    attachments: [String] // File URLs
    timestamp: Date
  }]
  
  // Section-level KPIs (calculated)
  sectionScores: [{
    sectionId: String
    sectionName: String
    passed: Number
    failed: Number
    total: Number
    percentage: Number
    score: Number
  }]
  
  // Form-level KPIs (calculated)
  kpis: {
    compliancePercentage: Number
    satisfactionPercentage: Number
    rating: Number
    totalPassed: Number
    totalFailed: Number
    totalQuestions: Number
    finalScore: Number
  }
  
  // Status & Workflow
  status: String (enum: 'Pending Corrective Action', 'Needs Auditor Review', 'Approved', 'Rejected', 'Closed')
  
  // Corrective Actions
  correctiveActions: [{
    questionId: String
    questionText: String
    auditorFinding: String
    managerAction: {
      comment: String
      proof: [String] // File URLs
      status: String (enum: 'Resolved', 'In Progress', 'Pending')
      addedBy: ObjectId (ref: 'User')
      addedAt: Date
    }
    auditorVerification: {
      approved: Boolean
      comment: String
      verifiedBy: ObjectId (ref: 'User')
      verifiedAt: Date
    }
  }]
  
  // Final Report
  finalReport: {
    reportUrl: String // Generated report file URL
    generatedAt: Date
    includesComparison: Boolean
    previousResponseId: ObjectId (ref: 'FormResponse') // For comparison
  }
  
  // Metadata
  ipAddress: String
  userAgent: String
  timestamps: { createdAt, updatedAt }
}
```

**C) FormKPIs Model** (`/server/models/FormKPIs.js`)
```javascript
{
  organizationId: ObjectId (ref: 'Organization', indexed)
  formId: ObjectId (ref: 'Form', indexed)
  
  // Question-level KPIs
  questionKPIs: [{
    questionId: String
    questionText: String
    totalResponses: Number
    passed: Number
    failed: Number
    passRate: Number
    avgScore: Number
    trend: String (enum: 'improving', 'declining', 'stable')
  }]
  
  // Section-level KPIs
  sectionKPIs: [{
    sectionId: String
    sectionName: String
    totalResponses: Number
    avgScore: Number
    avgPassRate: Number
    trend: String
  }]
  
  // Form-level KPIs
  formKPIs: {
    totalResponses: Number
    avgCompliance: Number
    avgRating: Number
    passRate: Number
    avgCompletionTime: Number // minutes
    trend: String
  }
  
  // Organization-level KPIs (if linked to orgs)
  organizationKPIs: [{
    organizationId: ObjectId
    organizationName: String
    totalAudits: Number
    avgCompliance: Number
    passRate: Number
    trend: String
  }]
  
  // Timestamps
  calculatedAt: Date (default: Date.now)
  timestamps: { createdAt, updatedAt }
}
```

**D) ResponseTemplate Model** (`/server/models/ResponseTemplate.js`)
```javascript
{
  organizationId: ObjectId (ref: 'Organization')
  name: String
  description: String
  
  // Template Structure (drag-drop layout)
  layout: Schema.Types.Mixed // JSON structure defining report layout
  
  // Template Options
  includeComparison: Boolean // Current vs Previous
  includeTrends: Boolean // Multi-audit trends
  includeCharts: Boolean
  includeCorrectiveActions: Boolean
  
  // Chart Configurations
  charts: [{
    type: String (enum: 'line', 'bar', 'pie')
    dataSource: String // Which KPI to chart
    title: String
    position: Number // Order in layout
  }]
  
  // Default Template Flag
  isDefault: Boolean
  isPublic: Boolean // Can be used by other orgs
  
  // Metadata
  createdBy: ObjectId (ref: 'User')
  timestamps: { createdAt, updatedAt }
}
```

#### 2. Controllers

**Form Controller** (`/server/controllers/formController.js`)
- `createForm` - Create new form (with sections/questions)
- `getForms` - List all forms (with pagination, filters, search)
- `getFormById` - Get single form with full structure
- `updateForm` - Update form (only if Draft)
- `deleteForm` - Delete form
- `duplicateForm` - Duplicate existing form
- `getFormBySlug` - Get form by public slug (for public submission)
- `getFormAnalytics` - Get form statistics and KPIs
- `getFormKPIs` - Get detailed KPI breakdown
- `linkFormToEvent` - Link form to event for assignment

**Form Response Controller** (`/server/controllers/formResponseController.js`)
- `submitForm` - Submit form response (public or authenticated)
- `getResponses` - List responses for a form
- `getResponseById` - Get single response with full details
- `updateResponseStatus` - Update response status
- `addCorrectiveAction` - Add manager corrective action
- `verifyCorrectiveAction` - Auditor verification
- `approveResponse` - Approve response
- `rejectResponse` - Reject response
- `generateReport` - Generate final report using template
- `getResponseComparison` - Compare current vs previous response
- `exportResponses` - Export responses to CSV/Excel

**Form KPI Controller** (`/server/controllers/formKPIController.js`)
- `calculateKPIs` - Calculate/update KPIs for a form
- `getQuestionKPIs` - Get question-level KPIs
- `getSectionKPIs` - Get section-level KPIs
- `getFormKPIs` - Get form-level KPIs
- `getOrganizationKPIs` - Get organization-level KPIs (for audits)
- `getTrends` - Get trends over time

**Response Template Controller** (`/server/controllers/responseTemplateController.js`)
- `createTemplate` - Create custom response template
- `getTemplates` - List templates
- `getTemplateById` - Get template
- `updateTemplate` - Update template
- `deleteTemplate` - Delete template
- `duplicateTemplate` - Duplicate template
- `getDefaultTemplates` - Get system default templates

#### 3. Services

**Form Processing Service** (`/server/services/formProcessingService.js`)
- `processSubmission` - Process form submission
  - Validate responses
  - Calculate scores (question, section, form level)
  - Determine pass/fail
  - Update form analytics
  - Trigger workflows
- `calculateQuestionScore` - Calculate score for a question
- `calculateSectionScore` - Calculate section-level KPIs
- `calculateFormKPIs` - Calculate form-level KPIs
- `determinePassFail` - Determine pass/fail based on thresholds
- `triggerWorkflows` - Trigger workflows on submit
- `createCorrectiveTask` - Create task for failed questions (if KPI < threshold)

**Report Generation Service** (`/server/services/reportGenerationService.js`)
- `generateReport` - Generate final report using template
- `buildComparisonTable` - Build current vs previous comparison
- `buildTrendsChart` - Build multi-audit trends
- `buildKPISection` - Build KPI summary section
- `buildCorrectiveActionsSection` - Build corrective actions section
- `exportToPDF` - Export report to PDF
- `exportToExcel` - Export report to Excel

**Form Scoring Service** (`/server/services/formScoringService.js`)
- `scoreResponse` - Score entire response
- `scoreQuestion` - Score individual question
- `scoreSection` - Score section with subsections
- `applyWeightage` - Apply weightage to scores
- `calculateCompliance` - Calculate compliance percentage

#### 4. Routes

**Form Routes** (`/server/routes/formRoutes.js`)
```
Protected Routes:
GET    /api/forms                    # List all forms
POST   /api/forms                    # Create form
GET    /api/forms/:id                # Get form by ID
PUT    /api/forms/:id                # Update form (Draft only)
DELETE /api/forms/:id                # Delete form
POST   /api/forms/:id/duplicate      # Duplicate form
GET    /api/forms/:id/analytics      # Get form analytics
GET    /api/forms/:id/kpis           # Get form KPIs
POST   /api/forms/:id/link-event     # Link form to event
GET    /api/forms/:id/responses       # Get form responses
POST   /api/forms/:id/responses/:responseId/approve  # Approve response
POST   /api/forms/:id/responses/:responseId/reject   # Reject response
POST   /api/forms/:id/responses/:responseId/corrective-action  # Add corrective action
POST   /api/forms/:id/responses/:responseId/verify   # Verify corrective action
POST   /api/forms/:id/responses/:responseId/generate-report  # Generate report

Public Routes:
GET    /api/public/forms/:slug       # Get form by public slug
POST   /api/public/forms/:slug/submit  # Submit form (public)
```

**Response Template Routes** (`/server/routes/responseTemplateRoutes.js`)
```
GET    /api/response-templates       # List templates
POST   /api/response-templates       # Create template
GET    /api/response-templates/:id   # Get template
PUT    /api/response-templates/:id   # Update template
DELETE /api/response-templates/:id   # Delete template
POST   /api/response-templates/:id/duplicate  # Duplicate template
GET    /api/response-templates/defaults  # Get default templates
```

---

### Frontend Components

#### 1. Views

**A) Forms List View** (`/client/src/views/Forms.vue`)
- List all forms in data table
- Filter by form type, status, assigned to
- Search forms
- Create new form button
- Statistics cards (total forms, active forms, total responses, avg compliance)
- Quick actions (edit, duplicate, view responses, link to event)
- Form type badges
- Status indicators

**B) Form Builder View** (`/client/src/views/FormBuilder.vue`)
- **4 Tabs:**
  1. **Form Details** - Basic form info
  2. **Sections & Questions** - Hierarchical builder
  3. **Settings & Logic** - KPIs, workflows, approval
  4. **Response Template** - Report designer

- Drag-and-drop section/question builder
- Section/subsection/question hierarchy
- Question properties panel
- Form settings panel
- Preview mode
- Save/Publish buttons

**C) Form Detail View** (`/client/src/views/FormDetail.vue`)
- **4 Tabs:**
  1. **Overview** - KPI summary, statistics
  2. **Responses** - List of all responses
  3. **Analytics** - Charts, trends, insights
  4. **Settings** - Edit form (Draft only)

- Response cards with status
- Quick actions (view, approve, reject)
- Analytics charts
- Top failed questions
- Compliance trends

**D) Form Response Detail View** (`/client/src/views/FormResponseDetail.vue`)
- Full response display
- Question-by-question answers
- Section scores
- Form-level KPIs
- Corrective actions (if applicable)
- Auditor verification
- Final report (if generated)
- Comparison with previous response
- Actions (approve, reject, add corrective action, verify)

**E) My Audits View** (`/client/src/views/MyAudits.vue`)
- List of forms assigned to current user (via Events)
- Filter by status, due date
- Quick actions (start audit, view response)
- Calendar view integration

#### 2. Components

**A) Form Builder Components**
- `FormBuilderTabs.vue` - Tab navigation (Details, Sections, Settings, Template)
- `FormDetailsTab.vue` - Form details form
- `SectionsBuilder.vue` - Sections/subsection/question builder
- `SectionEditor.vue` - Section properties
- `SubsectionEditor.vue` - Subsection properties
- `QuestionEditor.vue` - Question properties (type, scoring, validation)
- `FormSettingsTab.vue` - Settings & logic configuration
- `ResponseTemplateTab.vue` - Report template designer
- `FormPreview.vue` - Preview form as it will appear

**B) Question Type Components**
- `TextQuestion.vue` - Text input
- `DropdownQuestion.vue` - Dropdown/select
- `RatingQuestion.vue` - Star rating
- `FileQuestion.vue` - File upload
- `SignatureQuestion.vue` - Signature capture
- `YesNoQuestion.vue` - Yes/No radio buttons

**C) Form Response Components**
- `FormResponseList.vue` - List of responses
- `FormResponseCard.vue` - Response card with summary
- `FormResponseDetail.vue` - Full response view
- `QuestionResponse.vue` - Individual question response display
- `SectionScore.vue` - Section score display
- `FormKPISummary.vue` - Form-level KPI summary
- `CorrectiveActionPanel.vue` - Corrective action management
- `AuditorVerificationPanel.vue` - Auditor verification interface

**D) Analytics Components**
- `ComplianceTrendChart.vue` - Compliance trend line chart
- `RatingDistributionChart.vue` - Rating distribution pie chart
- `TopFailedQuestions.vue` - Top failed questions list
- `SectionScoresChart.vue` - Section scores bar chart
- `ResponseRateChart.vue` - Response rate over time

**E) Report Template Components**
- `ReportTemplateBuilder.vue` - Drag-drop report builder
- `ReportPreview.vue` - Preview generated report
- `ComparisonTable.vue` - Current vs Previous comparison
- `TrendsChart.vue` - Multi-audit trends chart
- `KPISection.vue` - KPI summary section
- `CorrectiveActionsSection.vue` - Corrective actions section

**F) Organization Widget**
- `OrganizationAuditWidget.vue` - Audit summary widget for Organization detail view
- Shows audit history, scores, corrective actions
- Links to full audit reports

#### 3. Composables

**Form Builder Composable** (`/client/src/composables/useFormBuilder.js`)
- Form state management
- Section/subsection/question manipulation
- Form validation
- Form preview logic
- Auto-save functionality

**Form Response Composable** (`/client/src/composables/useFormResponse.js`)
- Submit form response
- Calculate scores client-side (for preview)
- Handle submission response
- Error handling

**Form Scoring Composable** (`/client/src/composables/useFormScoring.js`)
- Calculate question scores
- Calculate section scores
- Calculate form KPIs
- Determine pass/fail

**Corrective Action Composable** (`/client/src/composables/useCorrectiveAction.js`)
- Add corrective action
- Verify corrective action
- Update action status

---

## 📝 Implementation Steps

### Phase 1: Backend Foundation - Models & Core Structure (Week 1)

#### Step 1.1: Database Models
- [ ] Create `Form` model (`/server/models/Form.js`)
  - Form details fields
  - Sections/subsections/questions structure
  - Settings & logic fields
  - Response template reference
  - Indexes (organizationId, formId, publicLink.slug)

- [ ] Create `FormResponse` model (`/server/models/FormResponse.js`)
  - Response identification
  - Linked records
  - Response details (question-level)
  - Section-level KPIs
  - Form-level KPIs
  - Corrective actions structure
  - Final report reference
  - Indexes (formId, organizationId, status, linkedTo)

- [ ] Create `FormKPIs` model (`/server/models/FormKPIs.js`)
  - Question-level KPIs
  - Section-level KPIs
  - Form-level KPIs
  - Organization-level KPIs
  - Indexes (formId, organizationId)

- [ ] Create `ResponseTemplate` model (`/server/models/ResponseTemplate.js`)
  - Template structure
  - Layout definition
  - Chart configurations
  - Indexes (organizationId, isDefault)

#### Step 1.2: Form Controller
- [ ] Create `formController.js`
  - Implement `createForm` (with sections/questions)
  - Implement `getForms` (with pagination, filters, search)
  - Implement `getFormById` (with full structure)
  - Implement `updateForm` (Draft only check)
  - Implement `deleteForm`
  - Implement `duplicateForm`
  - Implement `getFormBySlug` (public)
  - Implement `getFormAnalytics`
  - Implement `getFormKPIs`
  - Implement `linkFormToEvent`

#### Step 1.3: Form Response Controller
- [ ] Create `formResponseController.js`
  - Implement `submitForm` (public or authenticated)
  - Implement `getResponses` (with filters)
  - Implement `getResponseById` (with full details)
  - Implement `updateResponseStatus`
  - Implement `addCorrectiveAction`
  - Implement `verifyCorrectiveAction`
  - Implement `approveResponse`
  - Implement `rejectResponse`
  - Implement `generateReport`
  - Implement `getResponseComparison`
  - Implement `exportResponses`

#### Step 1.4: Form Services
- [ ] Create `formProcessingService.js`
  - Implement `processSubmission`
  - Implement `calculateQuestionScore`
  - Implement `calculateSectionScore`
  - Implement `calculateFormKPIs`
  - Implement `determinePassFail`
  - Implement `triggerWorkflows`
  - Implement `createCorrectiveTask`

- [ ] Create `formScoringService.js`
  - Implement `scoreResponse`
  - Implement `scoreQuestion`
  - Implement `scoreSection`
  - Implement `applyWeightage`
  - Implement `calculateCompliance`

- [ ] Create `reportGenerationService.js`
  - Implement `generateReport`
  - Implement `buildComparisonTable`
  - Implement `buildTrendsChart`
  - Implement `buildKPISection`
  - Implement `buildCorrectiveActionsSection`
  - Implement `exportToPDF`
  - Implement `exportToExcel`

#### Step 1.5: Routes
- [ ] Create `formRoutes.js`
  - Set up protected routes with middleware
  - Set up public routes (no auth)
  - Add proper permission checks
  - Register routes in `server.js`

- [ ] Create `responseTemplateRoutes.js`
  - Set up routes for template management
  - Register routes in `server.js`

#### Step 1.6: Event Model Integration
- [ ] Update `Event` model to support form linking
  - Add `linkedFormId` field
  - Add `formAssignment` field (assigned auditor)
  - Update event controller to handle form assignment

#### Step 1.7: Permissions
- [ ] Add 'forms' module to permission system
  - Update User model permissions
  - Add default permissions for roles
  - Update permission middleware

### Phase 2: Frontend Foundation - Forms List & Builder Structure (Week 2)

#### Step 2.1: Forms List View
- [ ] Create `Forms.vue` view
  - Data table with forms list
  - Search and filters (type, status, assigned to)
  - Create form button
  - Statistics cards
  - Quick actions (edit, duplicate, view responses, link to event)
  - Form type badges
  - Status indicators

#### Step 2.2: Form Builder - Basic Structure
- [ ] Create `FormBuilder.vue` view
  - Tab navigation (Details, Sections, Settings, Template)
  - Basic state management
  - Navigation between builder and list
  - Auto-save functionality

#### Step 2.3: Form Builder - Form Details Tab
- [ ] Create `FormDetailsTab.vue` component
  - Form ID (auto-generated)
  - Form name, description
  - Form type selection
  - Linked module selection
  - Visibility selection
  - Status selection
  - Assigned to lookup
  - Expiry date (for surveys)
  - Tags
  - Approval required checkbox
  - Linked report lookup
  - Attachments
  - Notes

#### Step 2.4: Form Builder - Sections Builder
- [ ] Create `SectionsBuilder.vue` component
  - Add section button
  - Section list with drag-drop reordering
  - Section properties (name, weightage)
  - Add subsection button
  - Subsection list with drag-drop
  - Subsection properties (name, weightage)
  - Add question button
  - Question list with drag-drop
  - Question properties panel

#### Step 2.5: Form Builder - Question Editor
- [ ] Create `QuestionEditor.vue` component
  - Question text input
  - Question type selection (Text, Dropdown, Rating, File, Signature, Yes-No)
  - Options input (for dropdown)
  - Mandatory checkbox
  - Scoring logic configuration
  - Weightage input
  - Conditional logic configuration
  - Attachment allowance checkbox
  - Pass/fail definition

#### Step 2.6: Form Builder - Settings Tab
- [ ] Create `FormSettingsTab.vue` component
  - KPI metrics checkboxes
  - Scoring formula input
  - Thresholds (pass, partial)
  - Auto assignment configuration
  - Workflow on submit configuration
  - Approval workflow configuration
  - Form version display
  - Public link configuration

### Phase 3: Form Builder - Response Template & Advanced Features (Week 3)

#### Step 3.1: Response Template Builder
- [ ] Create `ResponseTemplateTab.vue` component
  - Template selection (default or custom)
  - Duplicate template button
  - Drag-drop page builder
  - Add section button
  - Add comparison table
  - Add trends chart
  - Add KPI section
  - Add corrective actions section
  - Preview template

#### Step 3.2: Form Preview
- [ ] Create `FormPreview.vue` component
  - Render form as it will appear
  - Show sections/subsections/questions
  - Show question types correctly
  - Test form submission flow

#### Step 3.3: Question Type Components
- [ ] Create question type components
  - `TextQuestion.vue`
  - `DropdownQuestion.vue`
  - `RatingQuestion.vue`
  - `FileQuestion.vue`
  - `SignatureQuestion.vue`
  - `YesNoQuestion.vue`

### Phase 4: Form Submission & Response Management (Week 4)

#### Step 4.1: Form Submission (Public & Authenticated)
- [ ] Create form submission flow
  - Fetch form by slug (public) or ID (authenticated)
  - Render form with sections/questions
  - Handle file uploads
  - Handle signature capture
  - Validate responses
  - Submit form
  - Show success/error messages

#### Step 4.2: Form Response List
- [ ] Create `FormResponseList.vue` component
  - List responses in data table
  - Filter by status, date, linked to
  - Response cards with summary
  - Quick actions (view, approve, reject)

#### Step 4.3: Form Response Detail
- [ ] Create `FormResponseDetail.vue` component
  - Full response display
  - Question-by-question answers
  - Section scores display
  - Form-level KPIs display
  - Corrective actions panel
  - Auditor verification panel
  - Final report display
  - Comparison with previous response
  - Actions (approve, reject, add corrective action, verify)

#### Step 4.4: Corrective Action Flow
- [ ] Create `CorrectiveActionPanel.vue` component
  - Show failed questions only
  - Add corrective action form
  - Upload proof
  - Mark status (Resolved, In Progress, Pending)
  - Submit for auditor review

- [ ] Create `AuditorVerificationPanel.vue` component
  - Show corrective actions
  - Approve/reject buttons
  - Add verification comment
  - Submit verification

### Phase 5: Analytics & Reporting (Week 5)

#### Step 5.1: Form Detail View - Overview Tab
- [ ] Create form detail overview
  - KPI summary cards (Total Responses, Avg Rating, Compliance %, Response Rate)
  - Last submission date
  - Quick stats

#### Step 5.2: Form Detail View - Analytics Tab
- [ ] Create analytics components
  - `ComplianceTrendChart.vue` - Compliance trend over time
  - `RatingDistributionChart.vue` - Rating distribution
  - `TopFailedQuestions.vue` - Top failed questions list
  - `SectionScoresChart.vue` - Section scores comparison
  - `ResponseRateChart.vue` - Response rate over time

#### Step 5.3: Report Generation
- [ ] Create report generation flow
  - Generate report button
  - Select template
  - Build comparison table
  - Build trends chart
  - Build KPI section
  - Build corrective actions section
  - Export to PDF
  - Export to Excel
  - Attach to response

#### Step 5.4: Response Comparison
- [ ] Create comparison view
  - Select previous response
  - Compare metrics (Current vs Previous)
  - Show change indicators
  - Highlight improvements/declines

### Phase 6: Event Integration & Organization Widget (Week 6)

#### Step 6.1: Event Integration
- [ ] Update Event model/controller
  - Add form linking to event creation
  - Add form assignment to auditor
  - Update event detail view to show linked form

#### Step 6.2: My Audits View
- [ ] Create `MyAudits.vue` view
  - List forms assigned via events
  - Filter by status, due date
  - Quick actions (start audit, view response)
  - Calendar integration

#### Step 6.3: Organization Widget
- [ ] Create `OrganizationAuditWidget.vue` component
  - Show audit history for organization
  - Display: Audit Name, Date, Auditor, Score %, Result, Corrective Actions
  - Summary KPIs: Avg compliance, Pass rate, Trend, Last audit date
  - Link to full audit reports
  - Add to Organization detail view

#### Step 6.4: Testing & Bug Fixes
- [ ] Test form creation flow
- [ ] Test form submission flow
- [ ] Test scoring calculation
- [ ] Test corrective action flow
- [ ] Test report generation
- [ ] Test event integration
- [ ] Test organization widget
- [ ] Test permissions
- [ ] Performance testing

#### Step 6.5: Documentation
- [ ] Update API documentation
- [ ] Create user guide for form builder
- [ ] Create guide for audit workflow
- [ ] Create guide for report templates
- [ ] Update technical spec

---

## 🔐 Security Considerations

1. **Public Form Endpoints**
   - Rate limiting on public submission endpoint
   - CAPTCHA option for public forms
   - IP-based spam prevention
   - File upload size limits

2. **Form Access Control**
   - Public forms accessible without auth
   - Internal/Partner forms require organization access
   - Form slug should be unique and hard to guess

3. **Data Validation**
   - Validate all form submissions server-side
   - Sanitize user input
   - Validate file uploads (type, size)
   - Validate scoring calculations

4. **Organization Isolation**
   - All forms scoped to organizationId
   - Responses scoped to organizationId
   - Public forms still track organizationId

5. **Approval Workflow**
   - Only assigned approvers can approve/reject
   - Only managers can add corrective actions
   - Only auditors can verify corrective actions

---

## 📊 Database Indexes

### Form Model
- `{ organizationId: 1 }`
- `{ formId: 1 }` (unique)
- `{ 'publicLink.slug': 1 }` (unique, sparse)
- `{ organizationId: 1, status: 1 }`
- `{ organizationId: 1, formType: 1 }`
- `{ assignedTo: 1 }`

### FormResponse Model
- `{ formId: 1 }`
- `{ organizationId: 1 }`
- `{ responseId: 1 }` (unique)
- `{ formId: 1, status: 1 }`
- `{ organizationId: 1, submittedAt: -1 }`
- `{ 'linkedTo.type': 1, 'linkedTo.id': 1 }`
- `{ submittedBy: 1 }`

### FormKPIs Model
- `{ formId: 1 }`
- `{ organizationId: 1 }`
- `{ formId: 1, calculatedAt: -1 }`

---

## 🎨 UI/UX Considerations

1. **Form Builder**
   - Intuitive drag-and-drop interface
   - Clear section/subsection/question hierarchy
   - Real-time preview
   - Clear field configuration options
   - Visual feedback for actions

2. **Form Submission**
   - Clean, professional appearance
   - Mobile-responsive
   - Accessible (WCAG compliance)
   - Fast loading
   - Clear progress indicators

3. **Response Management**
   - Clear status indicators
   - Easy navigation
   - Quick actions
   - Visual score displays
   - Clear corrective action workflow

4. **Analytics**
   - Interactive charts
   - Clear KPI displays
   - Trend indicators
   - Comparison views

---

## 📈 Future Enhancements

1. **Advanced Features**
   - Template library (industry-specific forms)
   - Form versioning (compare versions)
   - AI insights (predict failure risks)
   - Offline mode (field agent support)
   - Multi-language support
   - QR-based form access

2. **Integrations**
   - Zapier integration
   - Webhook improvements
   - Email marketing integrations
   - Payment integration (for paid forms)

3. **Advanced Analytics**
   - Heatmaps
   - Conversion funnels
   - Predictive analytics
   - Custom dashboards

---

## ✅ Success Criteria

1. ✅ Users can create forms with sections/subsections/questions
2. ✅ Forms support all question types (Text, Dropdown, Rating, File, Signature, Yes-No)
3. ✅ Scoring and KPI calculation works correctly
4. ✅ Corrective action workflow functions end-to-end
5. ✅ Report generation with comparisons and trends works
6. ✅ Forms integrate with Events for assignment
7. ✅ Organization widget displays audit summaries
8. ✅ All form types (Audit, Survey, Feedback, Inspection, Custom) work correctly
9. ✅ Public forms are secure and performant
10. ✅ Analytics and insights are accurate and useful

---

## 📝 Notes

- Follow existing codebase patterns (Deal, Event, Task modules)
- Use same middleware (protect, organizationIsolation, checkPermission)
- Follow same API response format
- Use same frontend component structure
- Ensure multi-tenancy is properly enforced
- Test with different user roles and permissions
- Pay special attention to scoring calculation accuracy
- Ensure corrective action workflow is clear and intuitive

---

**Next Steps:** Review this plan and start with Phase 1, Step 1.1 (Database Models)
