# Organization Settings Architecture

**Version:** 1.0  
**Date:** January 2026  
**Status:** Architectural Specification (Locked)  
**Type:** Platform Architecture Specification

---

## Executive Summary

This document defines the Organization Settings module for the Arivu platform. Organization Settings configure the structure and behavior of business organization records (Customer, Partner, Vendor, etc.), not tenant organizations. This specification aligns with the Module Settings Doctrine and uses People Settings as the canonical reference implementation.

**Canonical Reference:** People Settings (`/settings?tab=core-modules&moduleKey=people`)  
**Settings Location:** `/settings?tab=core-modules&moduleKey=organizations`  
**Doctrine Reference:** `module-settings-doctrine.md`

---

## 1. Purpose & Scope

### Purpose

Organization Settings configure how business organization records are structured, displayed, and behave across the platform. These settings control field definitions, visibility rules, relationship configurations, and app participation—not the organization records themselves.

### Scope

Organization Settings apply **only** to business organizations (CRM entities):
- Customer organizations
- Partner organizations  
- Vendor organizations
- Distributor organizations
- Dealer organizations

### Explicit Scope Exclusion: Tenant Organizations

Organization Settings **do not** configure tenant organizations (workspace/account organizations). Tenant organization configuration belongs to:
- **Settings → Platform** (organization-wide settings)
- **Settings → Subscriptions** (billing and plans)
- **Settings → Security** (authentication and access)

**Rationale:** Tenant organizations (`isTenant: true`) are platform infrastructure, not business data. Business organizations (`isTenant: false`) are CRM entities that require configurable structure. This separation prevents confusion and maintains architectural boundaries.

### Mental Model

```
Organization Settings → Configure business organization structure
Platform Settings → Configure tenant organization (workspace)
```

---

## 2. UX Placement

### Location

Organization Settings are located at:
**Settings → Core Modules → Organizations**

### Layout Structure

Organization Settings follow the **exact same layout and component structure** as People Settings:

#### Left Navigation
- Located in Settings left nav under "Core Modules"
- Clicking "Core Modules" navigates to Core Modules list
- Selecting "Organizations" navigates to Organization Settings detail

#### Right Panel Structure
- Header with module name and badges (Platform-Owned, Shared)
- Tabbed interface with four tabs:
  1. **Module Details**: Name, description, app participation
  2. **Field Configurations**: Field definitions, types, visibility
  3. **Relationships**: Module-to-module relationships
  4. **Quick Create**: Field selection and order

### Component Reuse

Organization Settings use the same components as People Settings:
- `CoreModuleDetail.vue` (wrapper component)
- `ModulesAndFields.vue` (configuration interface)
- Same visual design (badges, spacing, typography)
- Same permission model (`settings.edit` permission required)

**Rationale:** Consistency across module settings reduces cognitive load and ensures predictable admin experience.

---

## 3. Allowed Configuration Areas

### 3.1 Field Configurations

Organization Settings allow configuration of:

#### Field Visibility
- Show/hide fields in list views
- Show/hide fields in detail views
- Field-level permission overrides (canView, canEdit)

#### Field Requirements
- Mark fields as required in forms
- Configure validation rules
- Set default values

#### Field Grouping
Fields are grouped by ownership model (see Section 5):
- **Core Business Fields**: Platform-owned business fields
- **App Participation Fields**: App-specific fields (Sales, Helpdesk, etc.)
- **System Fields**: System-managed fields

**Prohibited:** Creating or deleting fields. Organization fields are platform-defined. Settings configure visibility and behavior, not field existence.

### 3.2 Organization Types

Organization Settings allow configuration of:

#### Type Definitions
- Configure available organization types (labels, enabled, type-scoped fields)
- Platform participation registry gates which types appear by **enabled apps**:
  - **Sales** → Lead, Customer
  - **Helpdesk** → Customer
  - **Inventory** → Vendor
  - **Marketing** → Marketing Lead, Customer
  - **Portal** → Partner

#### Storage
- `organization.participations[APP] = { role }` — app-scoped source of truth (mirrors People)
- `organization.types[]` — **system-derived** union of roles for field visibility, filters, list column, and BC (not admin-edited; hidden from Field Configurations)

#### Type-Specific Behavior
- Configure which fields appear based on selected types
- Type-based field requirements
- Type-based relationship rules

**Note:** Settings configure which types are available and how they behave, not which organizations have which types. App enablement controls which participation roles are offered in create/edit pickers. Create/edit uses App Participation UI only — never a flat editable Types multi-picklist.

### 3.3 Status Picklists

Organization Settings allow configuration of:

#### Customer Status (`customerStatus`)
- Available values: Active, Prospect, Churned, Lead Customer
- Add/remove status values
- Configure status labels
- Set default status

#### Partner Status (`partnerStatus`)
- Available values: Active, Onboarding, Inactive
- Add/remove status values
- Configure status labels
- Set default status

#### Vendor Status (`vendorStatus`)
- Available values: Approved, Pending, Suspended
- Add/remove status values
- Configure status labels
- Set default status

**Rationale:** Status picklists control workflow state options. Configuration allows organizations to customize status values to match their business processes.

### 3.4 Relationship Configuration

Organization Settings allow configuration of:

#### People ↔ Organizations Relationship
- Configure cardinality (one-to-many, many-to-many)
- Relationship labels and descriptions
- Relationship visibility rules
- Configure which fields appear in relationship views

#### Organizations ↔ Work Relationships
- Configure relationships to Deals, Tickets, Projects, etc.
- Relationship cardinality
- Relationship field visibility

**Note:** Settings configure relationship definitions, not actual relationships between records. Actual relationships are created and managed in Surfaces.

### 3.5 App Participation

Organization Settings provide **read-only visibility** of:

#### Which Apps Use Organizations
- Display list of applications that use Organizations module
- Show required vs optional app participation
- Display app-specific field usage

**Organization type availability** is derived from enabled apps via the platform participation registry (`organizationParticipation`), not toggled in Organization Settings. Enabling Sales / Helpdesk / Inventory / Marketing / Portal controls which roles appear on create/edit.

**Prohibited:** Toggling app participation from Organization Settings. App participation is controlled at the application level. Organization Settings display this information for transparency only.

---

## 4. Explicit Exclusions (with Rationale)

### 4.1 No Organization List

**Excluded:** Tables, lists, or any display of actual organization records.

**Rationale:** Lists belong in Surfaces (`/organizations`), not Settings. Settings configure how lists are displayed, not the lists themselves. See Module Settings Doctrine Section 3.1.

**Example Violation:**
```vue
<!-- ❌ FORBIDDEN in Organization Settings -->
<DataTable :records="organizations" />
```

**Correct Approach:**
```vue
<!-- ✅ CORRECT: Configure list structure -->
<FieldVisibilityConfiguration :fields="listViewFields" />
```

### 4.2 No Tenant Settings

**Excluded:** Any configuration related to tenant organizations (workspace/account settings).

**Rationale:** Tenant organization configuration belongs to Platform Settings, not Module Settings. Mixing tenant and business organization configuration would violate architectural boundaries and confuse administrators.

**Excluded Fields:**
- `slug` (tenant identifier)
- `subscription.*` (billing and subscription)
- `limits.*` (usage limits)
- `settings.*` (organization-wide settings)
- `enabledApps` (app enablement)
- `isTenant` (tenant flag)

**Location:** These settings belong in Settings → Platform, Settings → Subscriptions, or Settings → Security.

### 4.3 No Billing, Subscription, Security

**Excluded:** Billing, subscription management, and security configuration.

**Rationale:** These are platform-level concerns, not module-level concerns. Organization Settings configure business organization structure, not platform infrastructure.

**Excluded Areas:**
- Subscription plans and pricing
- Billing information
- Payment methods
- Security settings (password rules, 2FA, session controls)
- User access and permissions (belongs in Settings → Users & Access)

### 4.4 No Record Editing or Creation

**Excluded:** Any interface for creating, editing, or deleting organization records.

**Rationale:** Record manipulation belongs in Surfaces (`/organizations`), not Settings. Settings configure the structure that enables these actions elsewhere. See Module Settings Doctrine Section 3.2.

**Example Violation:**
```vue
<!-- ❌ FORBIDDEN in Organization Settings -->
<button @click="createOrganization">Create Organization</button>
```

**Correct Approach:**
```vue
<!-- ✅ CORRECT: Configure quick create fields -->
<QuickCreateConfiguration :fields="quickCreateFields" />
```

### 4.5 No Workflow Execution

**Excluded:** Any interface for executing workflows, transitions, or business processes on organization records.

**Rationale:** Workflow execution belongs in Surfaces and Work interfaces. Settings configure workflow structure (status values, field requirements), not workflow execution.

**Excluded Actions:**
- Status transitions
- Type changes
- Relationship creation/deletion
- Bulk operations
- Import/export of records

---

## 5. Field Ownership Model

Organization fields follow a three-tier ownership model:

### 5.1 Core Business Fields

**Owner:** Platform Core  
**Intent:** Business identity and relationships

**Fields Include:**
- **Identity:** `name`, `industry`, `website`, `phone`, `address`, `tags`
- **Relationships:** `assignedTo`, `accountManager`, `primaryContact`

**Characteristics:**
- Platform-owned and shared across all applications
- Cannot be deleted or renamed
- Visibility and requirements can be configured
- Appear in all apps that use Organizations

### 5.2 App Participation Fields

**Owner:** App Participation (mirrors People)  
**Intent:** Per-app role (state) and type-scoped attributes

**Fields Include:**
- **Virtual roles** → `participations[APP].role`:
  - Sales: `sales_type` (Lead, Customer)
  - Helpdesk: `helpdesk_role` (Customer)
  - Inventory: `inventory_role` (Vendor)
  - Marketing: `marketing_role` (Marketing Lead, Customer)
  - Portal: `portal_role` (Partner)
- **Sales attributes:** `customerStatus`, `customerTier`, `slaLevel`, `paymentTerms`, `creditLimit`, `annualRevenue`, `numberOfEmployees`
- **Inventory attributes:** `vendorStatus`, `vendorRating`, `vendorContract`, `preferredPaymentMethod`, `taxId`
- **Portal attributes:** `partnerStatus`, `partnerTier`, `partnerType`, `partnerSince`, `territory`, `discountRate`

**Characteristics:**
- Grouped under **SALES / HELPDESK / INVENTORY / MARKETING / PORTAL PARTICIPATION** in Field Configurations
- Virtual role fields are visibility-configurable; options come from Types / participation registry
- Type-attribute fields remain visibility-gated by selected participation roles (`types` union)
- Cannot be deleted or renamed

### 5.3 System-Managed Fields

**Owner:** System  
**Intent:** System tracking and metadata

**Fields Include:**
- `_id` (MongoDB identifier)
- `organizationId` (tenant isolation)
- `createdAt`, `updatedAt` (timestamps)
- `createdBy` (creator reference)
- `types` (derived participation union — hidden from Field Configurations; list/filter/key-field summary only)
- `participations` (app participation map — not shown in Field Configurations; virtual roles are flattened)
- `isTenant` (tenant flag - excluded from Settings)

**Characteristics:**
- System-managed, not user-configurable
- Visibility can be controlled (where `isVisibleInConfig`)
- Cannot be edited or deleted
- Required for system operation

### Field Configuration Rules

1. **Core fields:** Can configure visibility, requirements, default values. Cannot delete or rename.
2. **Participation fields:** Can configure visibility (state fields may be locked like People). Cannot delete or rename.
3. **System fields:** Can configure visibility only. Cannot edit, delete, or modify behavior.

---

## 6. Lock Statement

### Scope Lock

Organization Settings are **locked in scope**. The following are **NON-NEGOTIABLE**:

1. **Settings do not display organization records.** Lists, tables, and record browsers belong in Surfaces (`/organizations`).
2. **Settings do not execute actions.** Create, update, delete, and lifecycle actions belong in Surfaces and Work interfaces.
3. **Settings configure structure only.** Field definitions, layouts, relationships, and display rules are the sole domain of Settings.
4. **Settings exclude tenant configuration.** Tenant organization settings belong in Platform Settings, not Module Settings.

### Change Process

Any proposal to add functionality to Organization Settings that violates these locks must:

1. **Justify the violation** with clear architectural reasoning
2. **Propose alternative** that maintains the Settings/Surfaces/Work separation
3. **Update this document** if the change is approved
4. **Update module-settings-doctrine.md** if the change affects the doctrine
5. **Update People Settings** if the change becomes the new canonical pattern

### Enforcement

- **Code Review:** Reject PRs that violate Organization Settings scope
- **Architecture Review:** Require architecture approval for scope changes
- **Documentation:** Update this document before implementing scope changes
- **Testing:** Verify Organization Settings do not include prohibited content

### Future-Proofing

This specification prevents scope creep by:

- **Explicit boundaries** between Settings, Surfaces, and Work
- **Canonical reference** (People Settings) for consistency
- **Locked prohibitions** that require explicit override
- **Change process** that prevents ad-hoc additions
- **Clear separation** between business organizations and tenant organizations

**These rules must be enforced at the code level, not merely documented.**

---

## Summary

Organization Settings configure the structure and behavior of business organization records (Customer, Partner, Vendor, etc.). They are distinct from Surfaces (data browsing) and Work (business objects). Settings configure structure; they do not display or manipulate data.

**Key Principles:**
1. Settings configure, Surfaces navigate, Work executes
2. Settings use the same layout and components as People Settings
3. Settings never include lists, records, or execution actions
4. Settings exclude tenant organization configuration
5. Scope is locked; changes require architecture approval

**Reference:** People Settings (`/settings?tab=core-modules&moduleKey=people`)  
**Doctrine:** Module Settings Doctrine (`module-settings-doctrine.md`)  
**Enforcement:** Code review, architecture review, documentation updates

---

**This document defines NON-NEGOTIABLE invariants for Organization Settings.**  
**These rules must never be violated, regardless of feature requests or UI preferences.**
