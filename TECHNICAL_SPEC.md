# LiteDesk CRM - Technical Specification Document

## 1. Executive Summary

**Project Name:** LiteDesk CRM  
**Type:** Multi-tenant SaaS CRM Application  
**Tech Stack:** Vue 3 + Node.js/Express + MongoDB  
**Architecture:** MERN Stack with JWT Authentication

---

## 2. System Architecture

### 2.1 Multi-Tenancy Model
**Approach:** Database-per-schema (Shared Database, Isolated Collections)

- Each organization (tenant) has isolated data
- All data models include `organizationId` for data segregation
- Middleware ensures users can only access their organization's data

### 2.2 Core Components

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vue 3)                      │
│  ┌────────┬────────┬────────┬────────┬──────────────┐  │
│  │ Auth   │ CRM    │ Settings│ Reports│ Automation   │  │
│  │ Module │ Modules│ & RBAC  │ Module │ Module       │  │
│  └────────┴────────┴────────┴────────┴──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                    [API Gateway]
                          │
┌─────────────────────────────────────────────────────────┐
│                 Backend (Node.js/Express)                │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Authentication & Authorization Middleware          │ │
│  │ - JWT Verification                                 │ │
│  │ - Organization Isolation                           │ │
│  │ - Permission Checking                              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────┬─────────┬─────────┬──────────┬──────────┐ │
│  │ Auth    │ CRM     │ Settings│ Billing  │ Reports  │ │
│  │ Service │ Service │ Service │ Service  │ Service  │ │
│  └─────────┴─────────┴─────────┴──────────┴──────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│                    MongoDB Database                      │
│  Collections: Users, Organizations, Contacts, Deals,    │
│  Projects, Tasks, Events, Documents, Transactions, etc. │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema Design

### 3.1 Core Models

#### 3.1.1 Organization (Tenant)
```javascript
{
  _id: ObjectId,
  name: String,                    // "Acme Corporation"
  slug: String,                    // "acme-corp" (unique, URL-friendly)
  industry: String,                // Business vertical
  
  // Subscription Management
  subscription: {
    status: String,                // 'trial' | 'active' | 'expired' | 'cancelled'
    tier: String,                  // 'trial' | 'starter' | 'professional' | 'enterprise'
    trialStartDate: Date,
    trialEndDate: Date,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    autoRenew: Boolean
  },
  
  // Limits & Features
  limits: {
    maxUsers: Number,              // Based on subscription tier
    maxContacts: Number,
    maxDeals: Number,
    maxStorageGB: Number
  },
  
  enabledModules: [String],        // ['contacts', 'deals', 'projects', ...]
  
  // Settings
  settings: {
    dateFormat: String,
    timeZone: String,
    currency: String,
    logoUrl: String,
    primaryColor: String
  },
  
  // Metadata
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean
}
```

#### 3.1.2 User (Enhanced)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,        // Reference to Organization
  
  // Basic Info
  username: String,
  email: String,
  password: String,                // Bcrypt hashed
  
  // Profile
  firstName: String,
  lastName: String,
  phoneNumber: String,
  avatar: String,
  
  // Role & Permissions
  role: String,                    // 'owner' | 'admin' | 'manager' | 'user' | 'viewer'
  permissions: {
    contacts: ['view', 'create', 'edit', 'delete'],
    deals: ['view', 'create', 'edit'],
    projects: ['view'],
    // ... granular permissions per module
  },
  
  // Status
  status: String,                  // 'active' | 'inactive' | 'suspended'
  isOwner: Boolean,                // True for the user who created the org
  
  // Activity
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 3.2 CRM Modules

#### 3.2.1 Contacts
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Information
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  mobile: String,
  
  // Organization Link
  organizationContactId: ObjectId, // Link to Organization/Company
  jobTitle: String,
  department: String,
  
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  
  // Social & Web
  linkedin: String,
  twitter: String,
  website: String,
  
  // Classification
  type: String,                    // 'lead' | 'customer' | 'vendor' | 'partner'
  status: String,                  // 'active' | 'inactive' | 'do_not_contact'
  source: String,                  // 'website' | 'referral' | 'social' | 'event'
  tags: [String],
  
  // Relationship
  assignedTo: ObjectId,            // User who manages this contact
  
  // Custom Fields
  customFields: Map,               // Flexible schema for custom data
  
  // Activity Tracking
  lastContactedDate: Date,
  notes: String,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.2 Organizations (Companies/Accounts)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,        // Tenant
  
  // Basic Info
  name: String,
  industry: String,
  type: String,                    // 'customer' | 'vendor' | 'partner' | 'competitor'
  
  // Contact Details
  email: String,
  phone: String,
  website: String,
  
  // Address
  billingAddress: { /* same as contact */ },
  shippingAddress: { /* same as contact */ },
  
  // Business Info
  numberOfEmployees: Number,
  annualRevenue: Number,
  taxId: String,
  
  // Relationship
  accountOwner: ObjectId,          // Assigned user
  parentCompany: ObjectId,         // For hierarchies
  
  // Social & Web
  linkedin: String,
  twitter: String,
  
  // Classification
  status: String,                  // 'active' | 'inactive' | 'suspended'
  rating: Number,                  // 1-5 stars
  tags: [String],
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.3 Deals (Opportunities)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  name: String,
  description: String,
  
  // Relationships
  contactId: ObjectId,
  organizationContactId: ObjectId, // Related company
  assignedTo: ObjectId,
  
  // Deal Details
  value: Number,
  currency: String,
  probability: Number,             // 0-100%
  
  // Pipeline
  stage: String,                   // 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
  pipeline: String,                // 'sales' | 'partnership' | custom
  
  // Dates
  expectedCloseDate: Date,
  actualCloseDate: Date,
  
  // Classification
  source: String,
  type: String,                    // 'new_business' | 'existing_business' | 'renewal'
  lostReason: String,
  tags: [String],
  
  // Products/Items
  lineItems: [{
    itemId: ObjectId,
    quantity: Number,
    price: Number,
    discount: Number,
    total: Number
  }],
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.4 Projects
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  name: String,
  description: String,
  
  // Relationships
  clientId: ObjectId,              // Organization or Contact
  dealId: ObjectId,                // Related deal
  
  // Team
  projectManager: ObjectId,
  teamMembers: [ObjectId],
  
  // Timeline
  startDate: Date,
  endDate: Date,
  status: String,                  // 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
  
  // Budget
  budgetedHours: Number,
  actualHours: Number,
  budgetedCost: Number,
  actualCost: Number,
  
  // Progress
  progressPercentage: Number,
  priority: String,                // 'low' | 'medium' | 'high' | 'urgent'
  
  // Classification
  type: String,
  tags: [String],
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.5 Tasks
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  title: String,
  description: String,
  
  // Relationships
  relatedTo: {
    type: String,                  // 'contact' | 'deal' | 'project' | 'organization'
    id: ObjectId
  },
  projectId: ObjectId,
  
  // Assignment
  assignedTo: ObjectId,
  assignedBy: ObjectId,
  
  // Status & Priority
  status: String,                  // 'todo' | 'in_progress' | 'waiting' | 'completed' | 'cancelled'
  priority: String,                // 'low' | 'medium' | 'high' | 'urgent'
  
  // Timeline
  dueDate: Date,
  startDate: Date,
  completedDate: Date,
  estimatedHours: Number,
  actualHours: Number,
  
  // Checklist
  subtasks: [{
    title: String,
    completed: Boolean
  }],
  
  // Classification
  tags: [String],
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.6 Events (Calendar)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  title: String,
  description: String,
  location: String,
  
  // Type
  type: String,                    // 'meeting' | 'call' | 'email' | 'task' | 'deadline' | 'other'
  
  // Relationships
  relatedTo: {
    type: String,                  // 'contact' | 'deal' | 'project' | 'organization'
    id: ObjectId
  },
  
  // Participants
  organizer: ObjectId,
  attendees: [{
    userId: ObjectId,
    contactId: ObjectId,
    email: String,
    status: String                 // 'pending' | 'accepted' | 'declined' | 'tentative'
  }],
  
  // Timing
  startDateTime: Date,
  endDateTime: Date,
  isAllDay: Boolean,
  timeZone: String,
  
  // Recurrence
  isRecurring: Boolean,
  recurrenceRule: String,          // iCal RRULE format
  
  // Reminders
  reminders: [{
    type: String,                  // 'email' | 'notification' | 'sms'
    minutesBefore: Number
  }],
  
  // Meeting Details
  meetingUrl: String,              // Zoom/Meet link
  conferenceType: String,          // 'zoom' | 'meet' | 'teams'
  
  // Status
  status: String,                  // 'scheduled' | 'completed' | 'cancelled'
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.7 Items (Products/Services)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  name: String,
  sku: String,
  description: String,
  
  // Type
  type: String,                    // 'product' | 'service'
  category: String,
  
  // Pricing
  unitPrice: Number,
  currency: String,
  costPrice: Number,
  taxRate: Number,
  
  // Inventory (for products)
  stockQuantity: Number,
  lowStockThreshold: Number,
  trackInventory: Boolean,
  
  // Service Details (for services)
  billingType: String,             // 'hourly' | 'fixed' | 'recurring'
  defaultDuration: Number,         // In hours
  
  // Status
  isActive: Boolean,
  
  // Media
  images: [String],
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.8 Documents
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  name: String,
  description: String,
  
  // File Details
  fileName: String,
  fileType: String,                // 'pdf' | 'docx' | 'xlsx' | 'image' | etc.
  fileSize: Number,                // In bytes
  fileUrl: String,                 // Cloud storage URL
  
  // Relationships
  relatedTo: {
    type: String,                  // 'contact' | 'deal' | 'project' | 'organization' | 'task'
    id: ObjectId
  },
  
  // Classification
  category: String,                // 'contract' | 'proposal' | 'invoice' | 'report' | 'other'
  tags: [String],
  
  // Version Control
  version: Number,
  previousVersions: [{
    version: Number,
    fileUrl: String,
    uploadedBy: ObjectId,
    uploadedAt: Date
  }],
  
  // Access Control
  isPrivate: Boolean,
  sharedWith: [ObjectId],          // User IDs
  
  // Metadata
  uploadedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.9 Transactions (Invoices/Payments)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  transactionNumber: String,       // Auto-generated
  type: String,                    // 'invoice' | 'payment' | 'credit_note' | 'estimate'
  
  // Relationships
  contactId: ObjectId,
  organizationContactId: ObjectId,
  dealId: ObjectId,
  projectId: ObjectId,
  
  // Financial Details
  lineItems: [{
    itemId: ObjectId,
    description: String,
    quantity: Number,
    unitPrice: Number,
    taxRate: Number,
    discount: Number,
    total: Number
  }],
  
  subtotal: Number,
  taxTotal: Number,
  discountTotal: Number,
  grandTotal: Number,
  currency: String,
  
  // Dates
  issueDate: Date,
  dueDate: Date,
  paidDate: Date,
  
  // Status
  status: String,                  // 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
  paymentStatus: String,           // 'pending' | 'partial' | 'paid' | 'refunded'
  
  // Payment Details
  paymentMethod: String,           // 'cash' | 'card' | 'bank_transfer' | 'check'
  paymentReference: String,
  
  // Notes
  notes: String,
  termsAndConditions: String,
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### 3.3 Supporting Models

#### 3.3.1 Activity Log
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Activity Details
  action: String,                  // 'created' | 'updated' | 'deleted' | 'viewed' | 'sent'
  entityType: String,              // 'contact' | 'deal' | 'task' | etc.
  entityId: ObjectId,
  
  // Changes (for updates)
  changes: [{
    field: String,
    oldValue: Mixed,
    newValue: Mixed
  }],
  
  // User
  userId: ObjectId,
  userName: String,
  
  // Metadata
  ipAddress: String,
  userAgent: String,
  timestamp: Date
}
```

#### 3.3.2 Notes
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Note Content
  content: String,                 // Rich text/HTML
  
  // Relationships
  relatedTo: {
    type: String,
    id: ObjectId
  },
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  isPinned: Boolean
}
```

#### 3.3.3 Custom Fields Definition
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Field Definition
  fieldName: String,
  fieldLabel: String,
  fieldType: String,               // 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'multiselect'
  
  // Applied To
  entityType: String,              // 'contact' | 'deal' | 'project' | etc.
  
  // Options (for dropdown/multiselect)
  options: [String],
  
  // Validation
  isRequired: Boolean,
  defaultValue: Mixed,
  
  // Display
  displayOrder: Number,
  isActive: Boolean,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date
}
```

#### 3.3.4 Email Templates
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  name: String,
  subject: String,
  body: String,                    // HTML content with placeholders
  
  // Classification
  category: String,                // 'welcome' | 'follow_up' | 'proposal' | 'invoice'
  
  // Metadata
  isActive: Boolean,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 4. Role-Based Access Control (RBAC)

### 4.1 Role Hierarchy
```
Owner > Admin > Manager > User > Viewer
```

### 4.2 Default Role Permissions

| Module         | Owner | Admin | Manager | User | Viewer |
|----------------|-------|-------|---------|------|--------|
| Contacts       | CRUD  | CRUD  | CRUD    | CRUD | R      |
| Organizations  | CRUD  | CRUD  | CRUD    | CRUD | R      |
| Deals          | CRUD  | CRUD  | CRUD    | CRU  | R      |
| Projects       | CRUD  | CRUD  | CRU     | CRU  | R      |
| Tasks          | CRUD  | CRUD  | CRUD    | CRUD | R      |
| Events         | CRUD  | CRUD  | CRUD    | CRUD | R      |
| Items          | CRUD  | CRUD  | CRU     | R    | R      |
| Documents      | CRUD  | CRUD  | CRUD    | CRUD | R      |
| Transactions   | CRUD  | CRUD  | CRU     | R    | R      |
| Reports        | All   | All   | Custom  | Own  | None   |
| Settings       | All   | Most  | None    | None | None   |
| User Mgmt      | All   | CRUD  | None    | None | None   |
| Billing        | All   | R     | None    | None | None   |

*C=Create, R=Read, U=Update, D=Delete*

### 4.3 Permission Structure
```javascript
permissions: {
  contacts: {
    view: Boolean,
    create: Boolean,
    edit: Boolean,
    delete: Boolean,
    viewAll: Boolean,        // View all vs only assigned
    exportData: Boolean
  },
  deals: { /* same */ },
  // ... for each module
  
  settings: {
    manageUsers: Boolean,
    manageBilling: Boolean,
    manageIntegrations: Boolean,
    customizeFields: Boolean
  },
  
  reports: {
    viewStandard: Boolean,
    viewCustom: Boolean,
    createCustom: Boolean,
    exportReports: Boolean
  }
}
```

---

## 5. Subscription & Billing System

### 5.1 Subscription Tiers

| Feature                | Trial (15 days) | Starter     | Professional | Enterprise  |
|------------------------|-----------------|-------------|--------------|-------------|
| Users                  | 3               | 5           | 25           | Unlimited   |
| Contacts               | 100             | 1,000       | 10,000       | Unlimited   |
| Deals                  | 50              | 500         | 5,000        | Unlimited   |
| Projects               | 10              | 50          | 500          | Unlimited   |
| Storage                | 1 GB            | 10 GB       | 100 GB       | 1 TB        |
| Custom Fields          | 5               | 20          | Unlimited    | Unlimited   |
| Form Builder           | ❌              | Basic       | Advanced     | Advanced    |
| Process Designer       | ❌              | ❌          | ✅           | ✅          |
| API Access             | ❌              | Basic       | Full         | Full        |
| Reports                | Basic           | Standard    | Advanced     | Custom      |
| Email Integration      | ❌              | ✅          | ✅           | ✅          |
| Support                | Email           | Email       | Priority     | Dedicated   |
| **Price/Month**        | **Free**        | **$29**     | **$99**      | **Custom**  |

### 5.2 Trial Management

```javascript
// Middleware to check trial status
const checkSubscription = async (req, res, next) => {
  const org = await Organization.findById(req.user.organizationId);
  
  if (org.subscription.status === 'trial') {
    const now = new Date();
    if (now > org.subscription.trialEndDate) {
      return res.status(403).json({ 
        message: 'Trial expired. Please upgrade to continue.',
        requiresUpgrade: true 
      });
    }
    
    // Calculate days remaining
    const daysLeft = Math.ceil((org.subscription.trialEndDate - now) / (1000 * 60 * 60 * 24));
    res.locals.trialDaysLeft = daysLeft;
  }
  
  next();
};
```

### 5.3 Feature Gating

```javascript
// Middleware to check feature access
const checkFeature = (featureName) => {
  return async (req, res, next) => {
    const org = await Organization.findById(req.user.organizationId);
    
    if (!org.enabledModules.includes(featureName)) {
      return res.status(403).json({ 
        message: `This feature requires ${getRequiredTier(featureName)} plan.`,
        upgradeRequired: true 
      });
    }
    
    next();
  };
};

// Usage:
router.post('/process', protect, checkFeature('process_designer'), createProcess);
```

---

## 6. Advanced Features

### 6.1 Form Builder

#### 6.1.1 Form Schema
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  name: String,
  description: String,
  
  // Form Configuration
  targetEntity: String,            // 'contact' | 'lead' | 'custom'
  
  fields: [{
    id: String,
    type: String,                  // 'text' | 'email' | 'number' | 'dropdown' | 'checkbox' | 'file'
    label: String,
    placeholder: String,
    required: Boolean,
    validation: {
      type: String,
      pattern: String,
      min: Number,
      max: Number,
      options: [String]
    },
    order: Number
  }],
  
  // Styling
  theme: {
    primaryColor: String,
    backgroundColor: String,
    fontFamily: String
  },
  
  // Behavior
  submitAction: String,            // 'create_contact' | 'webhook' | 'email_notification'
  redirectUrl: String,
  successMessage: String,
  
  // Notifications
  notifyUsers: [ObjectId],
  emailNotification: Boolean,
  
  // Analytics
  submissionCount: Number,
  conversionRate: Number,
  
  // Status
  isActive: Boolean,
  isPublic: Boolean,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 6.1.2 Form Submissions
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  formId: ObjectId,
  
  // Submitted Data
  data: Map,                       // Key-value pairs of field responses
  
  // Metadata
  submittedAt: Date,
  ipAddress: String,
  userAgent: String,
  
  // Processing
  status: String,                  // 'new' | 'processed' | 'error'
  processedAt: Date,
  createdEntityId: ObjectId        // If it created a contact/lead
}
```

### 6.2 Process Designer (Workflow Automation)

#### 6.2.1 Process Schema
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  name: String,
  description: String,
  
  // Trigger
  trigger: {
    type: String,                  // 'record_created' | 'record_updated' | 'field_changed' | 'time_based' | 'webhook'
    entity: String,                // 'contact' | 'deal' | 'task'
    conditions: [{
      field: String,
      operator: String,            // 'equals' | 'contains' | 'greater_than' | 'less_than'
      value: Mixed
    }]
  },
  
  // Workflow Steps
  steps: [{
    id: String,
    type: String,                  // 'send_email' | 'create_task' | 'update_field' | 'webhook' | 'wait' | 'condition'
    order: Number,
    
    config: {
      // For send_email
      templateId: ObjectId,
      to: String,
      cc: String,
      
      // For create_task
      taskTitle: String,
      assignTo: ObjectId,
      dueInDays: Number,
      
      // For update_field
      fieldName: String,
      newValue: Mixed,
      
      // For webhook
      url: String,
      method: String,
      headers: Map,
      
      // For wait
      duration: Number,
      unit: String,                // 'minutes' | 'hours' | 'days'
      
      // For condition
      conditions: Array,
      trueStep: String,
      falseStep: String
    }
  }],
  
  // Status
  isActive: Boolean,
  
  // Analytics
  executionCount: Number,
  successRate: Number,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 6.2.2 Process Execution Log
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  processId: ObjectId,
  
  // Trigger Info
  triggeredBy: String,             // 'record_created' | 'manual' | 'schedule'
  entityId: ObjectId,
  
  // Execution
  steps: [{
    stepId: String,
    status: String,                // 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
    startedAt: Date,
    completedAt: Date,
    error: String,
    output: Mixed
  }],
  
  overallStatus: String,           // 'running' | 'completed' | 'failed'
  
  // Metadata
  startedAt: Date,
  completedAt: Date,
  duration: Number                 // In milliseconds
}
```

### 6.3 Report Builder

#### 6.3.1 Report Schema
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  name: String,
  description: String,
  
  // Report Configuration
  reportType: String,              // 'sales' | 'activity' | 'funnel' | 'custom'
  entity: String,                  // 'deals' | 'contacts' | 'tasks'
  
  // Filters
  filters: [{
    field: String,
    operator: String,
    value: Mixed
  }],
  
  // Date Range
  dateRange: {
    type: String,                  // 'custom' | 'last_7_days' | 'this_month' | 'this_quarter' | 'this_year'
    startDate: Date,
    endDate: Date
  },
  
  // Grouping & Aggregation
  groupBy: [String],               // ['assignedTo', 'stage']
  metrics: [{
    field: String,
    aggregation: String,           // 'sum' | 'avg' | 'count' | 'min' | 'max'
    label: String
  }],
  
  // Visualization
  chartType: String,               // 'table' | 'bar' | 'line' | 'pie' | 'funnel'
  
  // Sorting
  sortBy: String,
  sortOrder: String,               // 'asc' | 'desc'
  
  // Scheduling
  isScheduled: Boolean,
  schedule: {
    frequency: String,             // 'daily' | 'weekly' | 'monthly'
    recipients: [String],          // Email addresses
    nextRun: Date
  },
  
  // Access
  isPublic: Boolean,
  sharedWith: [ObjectId],
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 7. API Structure

### 7.1 API Versioning
```
Base URL: /api/v1
```

### 7.2 Core Endpoints

#### 7.2.1 Authentication
```
POST   /api/v1/auth/register          # Sign up new organization + owner
POST   /api/v1/auth/login             # Login
POST   /api/v1/auth/logout            # Logout
POST   /api/v1/auth/refresh-token     # Refresh JWT
POST   /api/v1/auth/forgot-password   # Password reset request
POST   /api/v1/auth/reset-password    # Reset password
```

#### 7.2.2 Organization & Users
```
GET    /api/v1/organization           # Get current org details
PUT    /api/v1/organization           # Update org settings
GET    /api/v1/organization/users     # List all users
POST   /api/v1/organization/users     # Invite new user
PUT    /api/v1/organization/users/:id # Update user role/permissions
DELETE /api/v1/organization/users/:id # Deactivate user
```

#### 7.2.3 Subscription
```
GET    /api/v1/subscription           # Get subscription status
POST   /api/v1/subscription/upgrade   # Upgrade plan
POST   /api/v1/subscription/cancel    # Cancel subscription
GET    /api/v1/subscription/invoice   # Get invoices
```

#### 7.2.4 CRM Modules (Standard CRUD pattern)
```
# Contacts
GET    /api/v1/contacts               # List (with pagination, filters, search)
POST   /api/v1/contacts               # Create
GET    /api/v1/contacts/:id           # Get single
PUT    /api/v1/contacts/:id           # Update
DELETE /api/v1/contacts/:id           # Delete
POST   /api/v1/contacts/import        # Bulk import
POST   /api/v1/contacts/export        # Export to CSV

# Organizations, Deals, Projects, Tasks, Events, Items, Documents, Transactions
# Follow same pattern as contacts
```

#### 7.2.5 Advanced Features
```
# Forms
GET    /api/v1/forms
POST   /api/v1/forms
GET    /api/v1/forms/:id
PUT    /api/v1/forms/:id
DELETE /api/v1/forms/:id
POST   /api/v1/forms/:id/submissions  # Public endpoint for form submissions

# Processes
GET    /api/v1/processes
POST   /api/v1/processes
GET    /api/v1/processes/:id
PUT    /api/v1/processes/:id
DELETE /api/v1/processes/:id
POST   /api/v1/processes/:id/execute  # Manually trigger
GET    /api/v1/processes/:id/logs     # Execution history

# Reports
GET    /api/v1/reports
POST   /api/v1/reports
GET    /api/v1/reports/:id
PUT    /api/v1/reports/:id
DELETE /api/v1/reports/:id
POST   /api/v1/reports/:id/run        # Execute report
POST   /api/v1/reports/:id/export     # Export results
```

#### 7.2.6 Activity & Notes
```
GET    /api/v1/activities             # Get activity log
POST   /api/v1/notes                  # Add note
GET    /api/v1/:entity/:id/notes      # Get notes for entity
```

### 7.3 Response Format

#### Success Response
```json
{
  "success": true,
  "data": { /* ... */ },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

---

## 8. Security Considerations

### 8.1 Authentication & Authorization
- ✅ JWT tokens with 1-day expiration
- ✅ Refresh tokens with 30-day expiration
- ✅ Password hashing with bcrypt (10+ rounds)
- ✅ Organization isolation middleware
- ✅ Permission-based access control
- ✅ Rate limiting on auth endpoints

### 8.2 Data Security
- ✅ Input validation on all endpoints
- ✅ SQL/NoSQL injection prevention
- ✅ XSS protection
- ✅ CSRF tokens for state-changing operations
- ✅ Encrypted sensitive data at rest
- ✅ HTTPS only in production
- ✅ Regular security audits

### 8.3 Privacy & Compliance
- ✅ GDPR compliance (data export, deletion)
- ✅ Data retention policies
- ✅ Audit logs for sensitive operations
- ✅ Privacy policy & terms of service

---

## 9. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Multi-tenancy & RBAC

- [ ] Update User model with organizationId and roles
- [ ] Create Organization model with subscription
- [ ] Implement trial system (15 days)
- [ ] Build organization isolation middleware
- [ ] Create permission checking system
- [ ] Update auth flow to create org on signup
- [ ] Build user management (Settings page)
- [ ] Implement role assignment UI

**Deliverables:**
- Working multi-tenant system
- Admin can invite users with roles
- Trial countdown visible

### Phase 2: Core CRM (Weeks 3-5)
**Goal:** Complete basic CRM modules

- [ ] Contacts (enhance existing)
- [ ] Organizations/Companies
- [ ] Deals pipeline
- [ ] Tasks management
- [ ] Events/Calendar
- [ ] Activity logging
- [ ] Notes system

**Deliverables:**
- Fully functional contact management
- Deal pipeline with stages
- Task assignment and tracking
- Calendar integration

### Phase 3: Project Management (Weeks 6-7)
**Goal:** Project tracking

- [ ] Projects module
- [ ] Items/Products catalog
- [ ] Documents management
- [ ] File upload & storage
- [ ] Project time tracking

**Deliverables:**
- Project creation and management
- Product catalog
- Document repository

### Phase 4: Financial (Weeks 8-9)
**Goal:** Invoicing & payments

- [ ] Transactions model
- [ ] Invoice generation
- [ ] Payment tracking
- [ ] Basic reporting

**Deliverables:**
- Invoice creation & sending
- Payment recording
- Financial reports

### Phase 5: Advanced Features - Part 1 (Weeks 10-11)
**Goal:** Form Builder

- [ ] Form builder UI (drag-drop)
- [ ] Form rendering engine
- [ ] Form submissions handling
- [ ] Form analytics
- [ ] Public form links

**Deliverables:**
- Working form builder
- Embeddable forms
- Submission tracking

### Phase 6: Advanced Features - Part 2 (Weeks 12-13)
**Goal:** Process Designer

- [ ] Visual workflow builder
- [ ] Trigger configuration
- [ ] Action library
  - Send email
  - Create task
  - Update field
  - Webhook call
- [ ] Execution engine
- [ ] Process logs

**Deliverables:**
- Visual workflow designer
- Automated processes
- Execution monitoring

### Phase 7: Reporting (Weeks 14-15)
**Goal:** Report generation

- [ ] Report builder UI
- [ ] Pre-built report templates
  - Sales reports
  - Activity reports
  - Funnel analysis
- [ ] Custom report creation
- [ ] Chart visualizations
- [ ] Export to PDF/Excel
- [ ] Scheduled reports

**Deliverables:**
- Interactive reports
- Export functionality
- Scheduled delivery

### Phase 8: Subscription & Billing (Weeks 16-17)
**Goal:** Monetization

- [ ] Subscription tier enforcement
- [ ] Feature gating
- [ ] Upgrade/downgrade flows
- [ ] Payment integration (Stripe)
- [ ] Billing dashboard
- [ ] Invoice generation
- [ ] Usage tracking

**Deliverables:**
- Working subscription system
- Payment processing
- Billing management

### Phase 9: Polish & Optimization (Weeks 18-20)
**Goal:** Production readiness

- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] Email notifications
- [ ] Search improvements
- [ ] Import/Export functionality
- [ ] API documentation
- [ ] User onboarding flow
- [ ] Help documentation
- [ ] Security audit
- [ ] Load testing

**Deliverables:**
- Production-ready application
- Complete documentation
- Onboarding materials

---

## 10. Technology Stack

### 10.1 Current Stack
- **Frontend:** Vue 3 + Vite + Tailwind CSS + Pinia
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose
- **Authentication:** JWT

### 10.2 Additional Libraries Needed

#### Frontend
```json
{
  "vue-router": "^4.x",           // ✅ Already installed
  "pinia": "^2.x",                // ✅ Already installed
  "@vueuse/core": "^10.x",        // Vue composition utilities
  "vue-chartjs": "^5.x",          // Charts for reports
  "chart.js": "^4.x",             // Chart library
  "date-fns": "^2.x",             // Date manipulation
  "vue-draggable-next": "^2.x",   // For form/process builder
  "@tiptap/vue-3": "^2.x",        // Rich text editor
  "vue-advanced-cropper": "^2.x", // Image cropping
  "pdfmake": "^0.x",              // PDF generation
  "xlsx": "^0.x"                  // Excel export
}
```

#### Backend
```json
{
  "express": "^4.x",              // ✅ Already installed
  "mongoose": "^7.x",             // ✅ Already installed
  "bcrypt": "^5.x",               // ✅ Already installed
  "jsonwebtoken": "^9.x",         // ✅ Already installed
  "dotenv": "^16.x",              // ✅ Already installed
  "cors": "^2.x",                 // ✅ Already installed
  "express-validator": "^7.x",    // Input validation
  "express-rate-limit": "^6.x",   // Rate limiting
  "helmet": "^7.x",               // Security headers
  "multer": "^1.x",               // File uploads
  "aws-sdk": "^2.x",              // S3 for file storage
  "nodemailer": "^6.x",           // Email sending
  "node-cron": "^3.x",            // Scheduled tasks
  "stripe": "^12.x",              // Payment processing
  "bull": "^4.x",                 // Job queue for workflows
  "redis": "^4.x",                // Cache & queue backend
  "winston": "^3.x",              // Logging
  "morgan": "^1.x"                // HTTP request logging
}
```

### 10.3 Infrastructure

#### Development
- Node.js v18+
- MongoDB 6.x
- Redis 7.x (for queues & cache)

#### Production (Confirmed Stack)
- **Hosting:** AWS (EC2 or ECS)
- **Database:** MongoDB Atlas
- **File Storage:** AWS S3
- **Email:** AWS SES
- **Payment:** Stripe
- **Caching:** Redis (ElastiCache)
- **CDN:** AWS CloudFront
- **Monitoring:** AWS CloudWatch + Sentry
- **Analytics:** Mixpanel or PostHog

---

## 11. Performance Considerations

### 11.1 Database Optimization
- Indexes on frequently queried fields
  - `organizationId` on all collections
  - `email` on Users and Contacts
  - `status`, `assignedTo`, `createdAt`
- Compound indexes for common queries
- Pagination on all list endpoints (default 20 per page)
- Aggregation pipelines for reports

### 11.2 Caching Strategy
- Redis cache for:
  - User sessions
  - Organization settings
  - Frequently accessed lists
  - Report results (5-minute TTL)
- Cache invalidation on updates

### 11.3 File Management
- Store files in S3/Cloudinary (not MongoDB)
- Generate signed URLs for secure access
- Image optimization and resizing
- CDN for static assets

### 11.4 Background Jobs
- Use Bull + Redis for:
  - Email sending
  - Report generation
  - Process automation
  - Data imports/exports
  - Scheduled tasks

---

## 12. API Rate Limits

| Tier          | Requests/Hour | Burst Limit |
|---------------|---------------|-------------|
| Trial         | 100           | 10/min      |
| Starter       | 1,000         | 50/min      |
| Professional  | 10,000        | 200/min     |
| Enterprise    | Unlimited     | 500/min     |

---

## 13. Testing Strategy

### 13.1 Unit Tests
- Controller functions
- Middleware logic
- Utility functions
- Target: 80% coverage

### 13.2 Integration Tests
- API endpoints
- Database operations
- Authentication flow
- Permission checking

### 13.3 E2E Tests
- Critical user flows:
  - Sign up → Create contact → Create deal
  - User invitation → Role assignment
  - Trial expiry → Upgrade

### 13.4 Load Testing
- 100 concurrent users
- 1000 requests/second
- Database query optimization

---

## 14. Documentation Requirements

### 14.1 User Documentation
- [ ] Getting Started Guide
- [ ] Module-specific tutorials
- [ ] Video walkthroughs
- [ ] FAQ section
- [ ] Best practices

### 14.2 API Documentation
- [ ] Interactive API docs (Swagger/Postman)
- [ ] Authentication guide
- [ ] Webhook documentation
- [ ] Rate limits & errors
- [ ] Code examples (multiple languages)

### 14.3 Developer Documentation
- [ ] Setup instructions
- [ ] Architecture overview
- [ ] Database schema
- [ ] Contributing guidelines
- [ ] Deployment guide

---

## 15. Launch Checklist

### Pre-Launch
- [ ] Security audit completed
- [ ] Load testing passed
- [ ] Backup strategy in place
- [ ] Monitoring & alerts configured
- [ ] Terms of Service & Privacy Policy
- [ ] GDPR compliance verified
- [ ] Payment processing tested
- [ ] Email deliverability tested
- [ ] Error tracking configured
- [ ] Analytics implemented

### Launch Day
- [ ] DNS configured
- [ ] SSL certificate active
- [ ] Production database seeded
- [ ] Environment variables set
- [ ] Monitoring active
- [ ] Support channels ready

### Post-Launch
- [ ] Monitor error rates
- [ ] Track user onboarding
- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] Optimize based on usage

---

## 16. Future Enhancements (Post-MVP)

### Integrations
- Email (Gmail, Outlook)
- Calendar (Google Calendar, Outlook)
- Communication (Slack, Teams)
- Payment (Stripe, PayPal, Razorpay)
- Storage (Dropbox, Google Drive)
- Marketing (Mailchimp, SendGrid)
- Social (LinkedIn, Facebook)

### Advanced Features
- AI-powered insights
- Predictive analytics
- Lead scoring
- Email tracking & engagement
- Mobile apps (iOS, Android)
- WhatsApp integration
- SMS campaigns
- Advanced workflows (conditional branching)
- Custom dashboards
- White-labeling
- Multi-language support
- Advanced permissions (field-level)

---

## 17. Key Technical Decisions

### 17.1 Why Multi-Tenancy?
- Data isolation per organization
- Easier to manage and scale
- Clear billing boundaries
- Better security

### 17.2 Why JWT?
- Stateless authentication
- Easy to scale horizontally
- Works well with SPA architecture
- Can include user metadata

### 17.3 Why MongoDB?
- Flexible schema for custom fields
- Easy to iterate during development
- Good performance for document-based data
- Built-in aggregation for reports

### 17.4 Why Vue 3?
- ✅ Already in use
- Excellent composition API
- Great TypeScript support
- Rich ecosystem

---

## 18. Estimated Effort

| Phase | Duration | Developer Effort |
|-------|----------|------------------|
| Phase 1: Foundation | 2 weeks | 80 hours |
| Phase 2: Core CRM | 3 weeks | 120 hours |
| Phase 3: Projects | 2 weeks | 80 hours |
| Phase 4: Financial | 2 weeks | 80 hours |
| Phase 5: Form Builder | 2 weeks | 80 hours |
| Phase 6: Process Designer | 2 weeks | 80 hours |
| Phase 7: Reporting | 2 weeks | 80 hours |
| Phase 8: Billing | 2 weeks | 80 hours |
| Phase 9: Polish | 3 weeks | 120 hours |
| **Total** | **20 weeks** | **800 hours** |

*For a team of 2 developers, this is approximately 5 months.*

---

## 19. Success Metrics

### Technical Metrics
- API response time < 200ms (p95)
- Uptime > 99.9%
- Error rate < 0.1%
- Page load time < 2s

### Business Metrics
- Trial-to-paid conversion > 15%
- Monthly active users (MAU) growth
- Feature adoption rates
- Customer satisfaction (NPS > 50)
- Churn rate < 5%

---

## 20. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep | High | Strict phase planning, MVP focus |
| Performance issues | Medium | Early load testing, caching strategy |
| Security breach | High | Security audits, penetration testing |
| Data loss | High | Regular backups, disaster recovery plan |
| Payment processing errors | Medium | Thorough testing, fallback mechanisms |
| Third-party API failures | Medium | Circuit breakers, retry logic |

---

## Appendix A: Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000

# Database
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=another-secret
REFRESH_TOKEN_EXPIRES_IN=30d

# Redis
REDIS_URL=redis://...

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=litedesk-files
AWS_REGION=us-east-1

# AWS SES (Email)
AWS_SES_REGION=us-east-1
FROM_EMAIL=noreply@litedesk.com
FROM_NAME=LiteDesk CRM

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend
VITE_API_URL=https://api.litedesk.com
VITE_APP_URL=https://app.litedesk.com
```

---

## Appendix B: Database Indexes

```javascript
// Users
db.users.createIndex({ organizationId: 1, email: 1 });
db.users.createIndex({ email: 1 }, { unique: true });

// Contacts
db.contacts.createIndex({ organizationId: 1, email: 1 });
db.contacts.createIndex({ organizationId: 1, status: 1 });
db.contacts.createIndex({ organizationId: 1, assignedTo: 1 });
db.contacts.createIndex({ organizationId: 1, createdAt: -1 });

// Deals
db.deals.createIndex({ organizationId: 1, stage: 1 });
db.deals.createIndex({ organizationId: 1, assignedTo: 1 });
db.deals.createIndex({ organizationId: 1, expectedCloseDate: 1 });

// Tasks
db.tasks.createIndex({ organizationId: 1, assignedTo: 1, status: 1 });
db.tasks.createIndex({ organizationId: 1, dueDate: 1 });

// Activity Logs
db.activityLogs.createIndex({ organizationId: 1, entityType: 1, entityId: 1 });
db.activityLogs.createIndex({ organizationId: 1, timestamp: -1 });
```

---

## Conclusion

This technical specification provides a comprehensive roadmap for building LiteDesk CRM. The phased approach ensures steady progress while maintaining quality. Start with the foundation (multi-tenancy & RBAC), build core CRM features, then add advanced capabilities.

**Next Steps:**
1. Review and approve this specification
2. Set up project management (Jira/Linear/Trello)
3. Begin Phase 1: Foundation
4. Weekly progress reviews

**Technical Stack Decisions (Confirmed):**
- ✅ Payment gateway: **Stripe**
- ✅ File storage: **AWS S3**
- ✅ Email service: **AWS SES**
- ✅ Hosting platform: **AWS**
- ✅ Database: **MongoDB Atlas**

**Outstanding Questions:**
- Budget for third-party services?
- AWS region preference?
- Estimated user base at launch?

---

*Document Version: 1.0*  
*Last Updated: October 21, 2025*  
*Author: LiteDesk Development Team*

