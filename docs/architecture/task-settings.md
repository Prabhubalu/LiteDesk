# Task Settings Architecture

**Version:** 1.0  
**Date:** January 2026  
**Status:** Architectural Specification (Locked)  
**Type:** Platform Architecture Specification

---

## Executive Summary

This document defines the Task Settings module for the Arivu platform. Task Settings configure the structure and behavior of task records across the platform. This specification aligns with the Module Settings Doctrine and uses People Settings as the canonical reference implementation.

**Canonical Reference:** People Settings (`/settings?tab=core-modules&moduleKey=people`)  
**Settings Location:** `/settings?tab=core-modules&moduleKey=tasks`  
**Doctrine Reference:** `module-settings-doctrine.md`

---

## 1. Purpose & Scope

### Purpose

Task Settings configure how task records are structured, displayed, and behave across the platform. These settings control field definitions, visibility rules, relationship configurations, status and priority picklists, and app participation—not the task records themselves.

### Scope

Task Settings apply **only** to task structure and configuration:
- Field definitions and visibility
- Status and priority picklist values
- Relationship definitions (Task ↔ People, Task ↔ Organization, Task ↔ Event)
- Quick Create field configuration
- App participation settings

### Explicit Scope Exclusion: Task Management

Task Settings **do not** manage tasks themselves. Task management belongs to:
- **Surfaces** (`/tasks`) - Task list views and browsing
- **Inbox** (`/inbox`) - Tasks as attention items requiring action
- **Work interfaces** - Task creation, editing, completion, and lifecycle management

**Rationale:** Tasks are Work objects, not identity entities like People or Organizations. Task Settings configure the structure that enables task management elsewhere. This separation prevents confusion and maintains architectural boundaries between Settings (structure) and Surfaces/Work (data and execution).

### Mental Model

```
Task Settings → Configure task structure
Task Surfaces → Browse and view tasks
Task Work → Create, edit, complete tasks
Inbox → Tasks as attention items
```

---

## 2. UX Placement

### Location

Task Settings are located at:
**Settings → Core Modules → Tasks**

### Layout Structure

Task Settings follow the **exact same layout and component structure** as People Settings:

#### Left Navigation
- Located in Settings left nav under "Core Modules"
- Clicking "Core Modules" navigates to Core Modules list
- Selecting "Tasks" navigates to Task Settings detail

#### Right Panel Structure
- Header with module name and badges (Platform-Owned, Shared)
- Tabbed interface with four tabs:
  1. **Module Details**: Name, description, app participation
  2. **Field Configurations**: Field definitions, types, visibility
  3. **Relationships**: Module-to-module relationships
  4. **Quick Create**: Field selection and order

### Component Reuse

Task Settings use the same components as People Settings:
- `CoreModuleDetail.vue` (wrapper component)
- `ModulesAndFields.vue` (configuration interface)
- Same visual design (badges, spacing, typography)
- Same permission model (`settings.edit` permission required)

**Rationale:** Consistency across module settings reduces cognitive load and ensures predictable admin experience.

---

## 3. Allowed Configuration Areas

### 3.1 Module Details

Task Settings allow configuration of:

#### Module Name
- Display name for the Tasks module
- Default: "Tasks"
- Can be customized per tenant

#### Module Description
- Description text explaining what Tasks are
- Displayed in module settings header
- Can be customized per tenant

#### Badges
- **Platform-Owned**: Indicates Tasks is a platform core module
- **Shared by X applications**: Shows how many apps use Tasks module

### 3.2 Field Configuration

Task Settings allow configuration of fields grouped by ownership:

#### Core Task Fields (Platform-Owned)

**Required Fields:**
- `title` (required, cannot be made optional)
- `assignedTo` (required, cannot be made optional)

**Optional Core Fields:**
- `description` (text field)
- `dueDate` (date field)
- `startDate` (date field)
- `priority` (picklist, see Section 3.3)
- `status` (picklist, see Section 3.3)
- `taskType` (picklist, see Section 3.3)
- `tags` (array of strings)

**Allowed Actions:**
- Configure visibility (show/hide in list views, detail views)
- Configure requirements (mark optional fields as required, except title and assignedTo)
- Configure read-only state (where applicable)
- Reorder fields (where applicable)

**Prohibited:** Creating or deleting core fields. Core task fields are platform-defined. Settings configure visibility and behavior, not field existence.

#### App Participation Fields

**Sales App Fields:**
- `salesStageTaskType` (task type classification)
- Additional sales-specific task fields

**Helpdesk App Fields:**
- `helpdeskSLA` (service level agreement reference)
- Additional helpdesk-specific task fields

**Audit App Fields:**
- `auditCorrectiveFlag` (corrective action indicator)
- Additional audit-specific task fields

**Allowed Actions:**
- Configure visibility (show/hide based on app participation)
- Configure requirements (mark as required/optional)
- Configure read-only state

**Prohibited:** Creating or deleting app participation fields. These fields are app-owned. Settings configure visibility and behavior, not field existence.

#### System Fields

**System-Managed Fields:**
- `_id` (MongoDB identifier)
- `organizationId` (tenant isolation)
- `createdAt`, `updatedAt` (timestamps)
- `createdBy` (creator reference)
- `assignedBy` (assigner reference)
- `completedDate` (completion timestamp)
- `completedAt` (completion timestamp, virtual)

**Allowed Actions:**
- Configure visibility only (show/hide in views)

**Prohibited:** Editing, deleting, or modifying system field behavior. System fields are required for platform operation.

### 3.3 Status & Priority (Task-Specific)

Tasks receive status and priority picklist configuration, unlike People (which do not have status/priority picklists).

#### Status Picklist

**Default Values:**
- `todo` (To Do)
- `in_progress` (In Progress)
- `waiting` (Waiting)
- `completed` (Completed) - **System-locked**
- `cancelled` (Cancelled)

**Allowed Configuration:**
- Add custom status values (except cannot modify `completed`)
- Remove status values (except cannot remove `completed`)
- Configure status labels (display names)
- Set default status (must be one of available values)
- Configure status order/sequence

**System Lock:** The `completed` status is system-controlled and cannot be:
- Removed from the picklist
- Renamed
- Made optional
- Modified in behavior

**Rationale:** Completion state is a core platform invariant. Tasks must transition to `completed` when finished, and this state triggers system behaviors (completion date, Inbox removal, etc.).

#### Priority Picklist

**Default Values:**
- `low` (Low)
- `medium` (Medium) - Default
- `high` (High)
- `urgent` (Urgent)

**Allowed Configuration:**
- Add custom priority values
- Remove priority values (except must maintain at least one)
- Configure priority labels (display names)
- Set default priority (must be one of available values)
- Configure priority order/sequence

**Rationale:** Priority picklists control task urgency options. Configuration allows organizations to customize priority values to match their business processes.

#### Task Type Picklist

**Default Values:**
- `general_task` (General Task) - Default
- `follow_up` (Follow-up)
- `call` (Call)
- `email` (Email)
- `meeting` (Meeting)
- `support` (Support)
- `research` (Research)
- `documentation` (Documentation)
- `internal` (Internal)
- `bug` (Bug)
- `enhancement` (Enhancement)
- `feature_request` (Feature Request)
- `usability` (Usability Issue)

**Allowed Configuration:**
- Add custom task type values
- Remove task type values (except must maintain at least one)
- Configure task type labels (display names)
- Set default task type (must be one of available values)
- Configure task type order/sequence

**Rationale:** Task type classifies the nature of work (activity, support, product feedback, etc.) independently of status and priority.

### 3.4 Relationship Configuration

Task Settings allow configuration of:

#### Task ↔ People Relationship
- Configure cardinality (many-to-many)
- Relationship labels and descriptions
- Relationship visibility rules
- Configure which fields appear in relationship views
- Configure `assignedTo` field behavior (required/optional, visibility)

#### Task ↔ Organization Relationship
- Configure cardinality (many-to-many)
- Relationship labels and descriptions
- Relationship visibility rules
- Configure which fields appear in relationship views
- Configure `relatedTo` field behavior for organizations

#### Task ↔ Event Relationship
- Configure cardinality (many-to-many)
- Relationship labels and descriptions
- Relationship visibility rules
- Configure which fields appear in relationship views
- Configure `relatedTo` field behavior for events

**Note:** Settings configure relationship definitions, not actual relationships between records. Actual relationships are created and managed in Surfaces and Work interfaces.

### 3.5 Quick Create (Critical)

Quick Create configuration is **critical** for Tasks because tasks are frequently created from various contexts (Inbox, Surfaces, Work interfaces).

#### Quick Create Fields ONLY

**Default Locked Order:**
1. **Title** (required, locked position, cannot be removed)
2. **Due Date** (optional, can be reordered or removed)
3. **Priority** (optional, can be reordered or removed)
4. **Related To** (Person / Organization, optional, can be reordered or removed)
5. **Assignee** (required, can be reordered but cannot be removed)

#### Quick Create Rules

**Allowed Fields:**
- Core task fields only (title, dueDate, priority, assignedTo, relatedTo)
- System fields that are user-editable (none for Quick Create)

**Prohibited Fields:**
- **App fields** ❌ (app participation fields cannot appear in Quick Create)
- **System fields** ❌ (system-managed fields cannot appear in Quick Create)
- **Description** ❌ (by default, description is excluded from Quick Create for speed)
- **Status** ❌ (status defaults to 'todo', cannot be set in Quick Create)
- **Time tracking fields** ❌ (estimatedHours, actualHours)
- **Subtasks** ❌ (subtask management belongs in full task edit)
- **Tags** ❌ (tags can be added in full task edit)

**Rationale:** Quick Create must be fast and focused. Only essential fields for task creation appear. Full task editing happens in Work interfaces where all fields are available.

### 3.6 App Participation

Task Settings provide **read-only visibility** of:

#### Which Apps Use Tasks
- Display list of applications that use Tasks module
- Show required vs optional app participation
- Display app-specific field usage

**Prohibited:** Toggling app participation. App participation is controlled at the application level, not the module level. Task Settings display this information for transparency only.

---

## 4. Explicit Exclusions (Hard Lock)

Task Settings must **NEVER** include:

### 4.1 No Task List

**Excluded:** Tables, lists, or any display of actual task records.

**Rationale:** Lists belong in Surfaces (`/tasks`), not Settings. Settings configure how lists are displayed, not the lists themselves. See Module Settings Doctrine Section 3.1.

**Example Violation:**
```vue
<!-- ❌ FORBIDDEN in Task Settings -->
<DataTable :records="tasks" />
```

**Correct Approach:**
```vue
<!-- ✅ CORRECT: Configure list structure -->
<FieldVisibilityConfiguration :fields="listViewFields" />
```

### 4.2 No Inbox Configuration

**Excluded:** Any configuration related to Inbox display, filtering, or aggregation of tasks.

**Rationale:** Inbox is a Surface, not a module. Inbox aggregation rules are defined in Inbox doctrine (`inbox-surface-invariants.md`), not in Task Settings. Tasks appear in Inbox as attention items, but Inbox configuration belongs to Inbox Settings, not Task Settings.

**Excluded Areas:**
- Inbox filtering rules
- Inbox sorting preferences
- Inbox display configuration
- Task-to-Inbox aggregation rules

**Location:** Inbox configuration belongs in Settings → Platform → Inbox (if such settings exist) or in Inbox doctrine.

### 4.3 No Task Completion

**Excluded:** Any interface for completing, cancelling, or executing lifecycle transitions on task records.

**Rationale:** Task completion belongs in Surfaces and Work interfaces, not Settings. Settings configure the structure that enables completion (status picklist), not completion execution.

**Excluded Actions:**
- Mark complete buttons
- Status transition interfaces
- Completion workflows
- Bulk completion actions

### 4.4 No Time Tracking Configuration

**Excluded:** Any configuration related to time tracking execution or display.

**Rationale:** Time tracking (`estimatedHours`, `actualHours`) is a task management feature, not a settings concern. Settings can configure field visibility, but time tracking execution belongs in Work interfaces.

**Excluded Areas:**
- Time tracking workflows
- Time tracking reports
- Time tracking automation
- Time tracking display rules (beyond basic visibility)

**Note:** Field visibility for `estimatedHours` and `actualHours` can be configured in Field Configurations, but time tracking execution is excluded.

### 4.5 No SLA Execution

**Excluded:** Any configuration related to SLA (Service Level Agreement) execution, monitoring, or enforcement.

**Rationale:** SLA execution belongs to Helpdesk app logic, not Task Settings. Settings can configure SLA field visibility, but SLA execution is app-specific business logic.

**Excluded Areas:**
- SLA calculation rules
- SLA violation detection
- SLA automation
- SLA monitoring dashboards

**Note:** SLA field visibility (`helpdeskSLA`) can be configured in Field Configurations, but SLA execution is excluded.

### 4.6 No Automation / Workflows

**Excluded:** Any configuration related to task automation, workflows, or business process execution.

**Rationale:** Automation and workflows belong to Work interfaces and app-specific logic, not Settings. Settings configure structure, not execution.

**Excluded Areas:**
- Task creation automation
- Status transition automation
- Assignment automation
- Notification automation
- Workflow definitions

**Location:** Automation belongs in Settings → Applications → [App] → Automation (if such settings exist) or in Work interfaces.

### 4.7 No Bulk Actions

**Excluded:** Any interface for performing bulk operations on task records.

**Rationale:** Bulk actions belong in Surfaces (`/tasks`), not Settings. Settings configure structure, not data manipulation.

**Excluded Actions:**
- Bulk status updates
- Bulk assignment
- Bulk deletion
- Bulk export
- Bulk import

### 4.8 No Record Editing or Creation

**Excluded:** Any interface for creating, editing, or deleting task records.

**Rationale:** Record manipulation belongs in Surfaces (`/tasks`) and Work interfaces, not Settings. Settings configure the structure that enables these actions elsewhere. See Module Settings Doctrine Section 3.2.

**Example Violation:**
```vue
<!-- ❌ FORBIDDEN in Task Settings -->
<button @click="createTask">Create Task</button>
```

**Correct Approach:**
```vue
<!-- ✅ CORRECT: Configure quick create fields -->
<QuickCreateConfiguration :fields="quickCreateFields" />
```

---

## 5. How Tasks Differ from People / Organizations

### 5.1 Tasks Are Work Objects, Not Identity Entities

**People and Organizations:**
- Identity entities that exist independently
- Represent real-world entities (persons, companies)
- Have app-agnostic core identity
- Participate in apps but maintain core identity

**Tasks:**
- Work objects that represent actionable items
- Do not have independent identity
- Are always created in a context (assigned to someone, related to something)
- Have lifecycle states (todo → in_progress → completed)

**Implication:** Task Settings focus on work structure (status, priority, relationships), not identity structure (name, contact info, organization type).

### 5.2 Tasks Have Status & Priority Picklists

**People:**
- Do not have status picklists (People have app-specific participation states, not global status)
- Do not have priority picklists

**Organizations:**
- Have type-specific status picklists (`customerStatus`, `partnerStatus`, `vendorStatus`)
- Do not have priority picklists

**Tasks:**
- Have a single status picklist (applies to all tasks)
- Have a priority picklist (applies to all tasks)
- Status includes system-locked `completed` state

**Implication:** Task Settings include Status & Priority configuration (Section 3.3), which People Settings do not have.

### 5.3 Tasks Are Always Assigned

**People:**
- May or may not have `assignedTo` (optional field)
- Assignment is for ownership/management, not work execution

**Organizations:**
- May or may not have `assignedTo` (optional field)
- Assignment is for ownership/management, not work execution

**Tasks:**
- Always have `assignedTo` (required field)
- Assignment is for work execution (who does the task)
- Tasks without assignees are invalid

**Implication:** Task Settings must enforce `assignedTo` as required and cannot allow it to be optional.

### 5.4 Tasks Appear in Inbox

**People:**
- Do not appear in Inbox (People are identity entities, not attention items)

**Organizations:**
- Do not appear in Inbox (Organizations are identity entities, not attention items)

**Tasks:**
- Appear in Inbox when assigned to user and not completed
- Inbox shows tasks as attention items requiring action
- Tasks are removed from Inbox when completed

**Implication:** Task Settings must understand that tasks serve dual purpose: work objects (in Surfaces) and attention items (in Inbox). However, Inbox configuration is excluded from Task Settings (Section 4.2).

### 5.5 Tasks Have Completion State

**People:**
- Do not have completion state (People are permanent identity records)

**Organizations:**
- Do not have completion state (Organizations are permanent identity records)

**Tasks:**
- Have completion state (`status: 'completed'`)
- Completion is system-controlled (triggers `completedDate`, removes from Inbox)
- Completion cannot be undone via Settings (belongs to Work interfaces)

**Implication:** Task Settings must lock `completed` status and cannot allow it to be modified or removed.

---

## 6. Canonical References

### 6.1 People Settings

**Reference:** People Settings (`/settings?tab=core-modules&moduleKey=people`)

**Usage:** Canonical layout and component structure. Task Settings must follow the exact same layout pattern as People Settings:
- Same left navigation structure
- Same right panel tabs (Module Details, Field Configurations, Relationships, Quick Create)
- Same component reuse (`CoreModuleDetail.vue`, `ModulesAndFields.vue`)
- Same visual design (badges, spacing, typography)

**Deviation:** Task Settings add Status & Priority configuration (Section 3.3), which People Settings do not have. This is the only allowed deviation from People Settings pattern.

### 6.2 Organization Settings

**Reference:** Organization Settings (`/settings?tab=core-modules&moduleKey=organizations`)

**Usage:** Shared-entity handling pattern. Organization Settings demonstrate how to handle:
- App participation fields
- Type-specific status picklists (though Tasks use a single status picklist)
- Relationship configuration patterns

**Difference:** Tasks are Work objects, not shared entities like Organizations. Task Settings focus on work structure, not entity structure.

### 6.3 Inbox Doctrine

**Reference:** Inbox Surface Invariants (`docs/architecture/inbox-surface-invariants.md`)

**Usage:** Understanding tasks as attention, not management. Inbox doctrine clarifies that:
- Tasks appear in Inbox as attention items requiring action
- Inbox is an attention surface, not a task manager
- Task management belongs in Surfaces and Work interfaces, not Inbox
- Task Settings do not configure Inbox (Inbox configuration is excluded, Section 4.2)

**Rationale:** This reference ensures Task Settings maintain proper boundaries with Inbox and do not attempt to configure Inbox behavior.

---

## 7. Lock Statement

### Scope Lock

Task Settings are **locked in scope**. The following are **NON-NEGOTIABLE**:

1. **Settings do not display task records.** Lists, tables, and record browsers belong in Surfaces (`/tasks`).
2. **Settings do not execute actions.** Create, update, delete, completion, and lifecycle actions belong in Surfaces and Work interfaces.
3. **Settings configure structure only.** Field definitions, layouts, relationships, status/priority picklists, and display rules are the sole domain of Settings.
4. **Settings exclude task management.** Task completion, time tracking, SLA execution, automation, and bulk actions belong in Work interfaces and app-specific logic.
5. **Settings exclude Inbox configuration.** Inbox aggregation and display rules belong in Inbox doctrine, not Task Settings.
6. **Settings lock completion state.** The `completed` status is system-controlled and cannot be modified or removed.

### Change Process

Any proposal to add functionality to Task Settings that violates these locks must:

1. **Justify the violation** with clear architectural reasoning
2. **Propose alternative** that maintains the Settings/Surfaces/Work separation
3. **Update this document** if the change is approved
4. **Update module-settings-doctrine.md** if the change affects the doctrine
5. **Update People Settings** if the change becomes the new canonical pattern

### Enforcement

- **Code Review:** Reject PRs that violate Task Settings scope
- **Architecture Review:** Require architecture approval for scope changes
- **Documentation:** Update this document before implementing scope changes
- **Testing:** Verify Task Settings do not include prohibited content

### Future-Proofing

This specification prevents scope creep by:

- **Explicit boundaries** between Settings, Surfaces, and Work
- **Canonical reference** (People Settings) for consistency
- **Locked prohibitions** that require explicit override
- **Change process** that prevents ad-hoc additions
- **Clear separation** between task structure (Settings) and task management (Surfaces/Work)

**These rules must be enforced at the code level, not merely documented.**

---

## Summary

Task Settings configure the structure and behavior of task records across the platform. They are distinct from Surfaces (data browsing) and Work (task management). Settings configure structure; they do not display or manipulate data.

**Key Principles:**
1. Settings configure, Surfaces navigate, Work executes
2. Settings use the same layout and components as People Settings
3. Settings never include lists, records, or execution actions
4. Settings exclude task management (completion, time tracking, SLA, automation)
5. Settings exclude Inbox configuration (Inbox is a Surface, not a module)
6. Tasks are Work objects with status/priority picklists (unlike People/Organizations)
7. Scope is locked; changes require architecture approval

**Reference:** People Settings (`/settings?tab=core-modules&moduleKey=people`)  
**Doctrine:** Module Settings Doctrine (`module-settings-doctrine.md`)  
**Inbox Reference:** Inbox Surface Invariants (`docs/architecture/inbox-surface-invariants.md`)  
**Enforcement:** Code review, architecture review, documentation updates

---

**This document defines NON-NEGOTIABLE invariants for Task Settings.**  
**These rules must never be violated, regardless of feature requests or UI preferences.**
