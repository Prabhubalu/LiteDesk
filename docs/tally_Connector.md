# Tally Connector Experience & Smart Onboarding Specification

## Objective

The existing Integration Engine already provides synchronization, queue management, validation, retry mechanisms, audit logs, conflict resolution, dashboards, and connector architecture. This implementation should NOT replace that engine. Instead, build a modern, AI-first connector experience that makes connecting Tally extremely simple for end users.

The primary goal is to reduce connector setup from hours to less than five minutes while hiding all technical complexity.

---

# Design Principles

- Zero Configuration whenever possible.
- AI-first onboarding and configuration.
- Progressive disclosure (simple by default, advanced when needed).
- Friendly user experience instead of technical terminology.
- Automatic discovery before asking for user input.
- One-click recovery for common issues.
- Everything should be manageable from a single Integration Center.

---

# Overall Architecture

Build two independent layers.

## Layer 1 - Integration Engine (Already Exists)

Use the existing Integration Engine for:

- Queue Management
- Validation
- Field Mapping
- Synchronization Rules
- Retry Engine
- Conflict Resolution
- Audit Logs
- Error Logs
- Dashboard
- Background Processing

Do not duplicate these features.

---

## Layer 2 - Connector Experience

Build a new user experience layer that sits on top of the Integration Engine.

This layer is responsible for:

- Installation
- Discovery
- Configuration
- AI Recommendations
- Health Monitoring
- Smart Error Resolution
- Integration Dashboard
- User Guidance

---

# Local Connector Agent

Create a lightweight Windows service called "Arivu Connector Agent".

Responsibilities:

- Connect to Tally
- Monitor Tally
- Discover available companies
- Discover financial years
- Discover Tally version
- Discover XML API configuration
- Discover available ports
- Discover warehouses
- Discover ledgers
- Maintain secure communication with the cloud
- Queue requests while offline
- Automatically reconnect
- Report health information
- Support automatic updates

The agent should run silently in the background.

---

# Installation Wizard

The installation experience should contain only four simple steps.

Step 1

Download and install the Arivu Connector Agent.

Step 2

Login using Arivu credentials.

Step 3

Automatically discover the local Tally installation.

Automatically detect:

- Installed TallyPrime Version
- Running Tally Instances
- Available Companies
- Financial Years
- XML API Status
- Port Configuration
- Available Warehouses
- Existing Ledgers

Step 4

Display the discovered information.

Example:

✓ TallyPrime Found

Company:
ABC Traders

Financial Year:
2026-27

Status:
Ready

Provide a single "Connect" button.

No manual configuration should be required unless discovery fails.

---

# Automatic Validation

Before activating synchronization perform automatic validation.

Validate:

- Internet Connection
- Tally Running
- XML Enabled
- Company Available
- Financial Year
- User Permissions
- Firewall
- Disk Access

Display validation using a simple checklist.

Example

✓ Internet

✓ XML Enabled

✓ Company Loaded

✓ Financial Year

Ready to Connect

---

# AI Mapping Engine

Automatically analyse both systems before showing field mapping.

Compare:

CRM Fields

↓

Tally Fields

Generate confidence scores.

Example

Customer Name → Ledger Name (99%)

GST Number → GST Registration (98%)

Warehouse → Godown (96%)

Automatically approve mappings above the configured confidence threshold.

Only ask the administrator to review mappings with low confidence.

---

# Smart Mapping Suggestions

For custom fields analyse:

- Field Name
- Datatype
- Sample Values
- Module
- Relationships

Generate recommended mappings automatically.

Allow administrators to accept all recommendations with one click.

---

# Dry Run Mode

Before the first synchronization execute a complete simulation.

No records should be written.

Display:

Customers

Items

Invoices

Warnings

Errors

Show detailed recommendations such as:

Duplicate Ledger

Missing Warehouse

Invalid GST

Allow the user to resolve issues before enabling synchronization.

---

# Smart Synchronization Recommendations

Automatically analyse:

- Company Size
- Record Count
- Daily Transactions
- Inventory Size
- Internet Speed

Recommend:

Synchronization Interval

Source of Truth

Synchronization Direction

Retry Strategy

Conflict Resolution Strategy

Provide a single "Accept Recommended Settings" button.

---

# Integration Center

Create a dedicated Integration Center.

This should become the single place for managing every connector.

Include:

## Connections

Installed Connectors

Connection Status

Agent Version

Last Sync

Health

Company

Financial Year

---

## Dashboard

Display

Connection Status

Queue Length

Average Sync Time

Failed Records

Retry Queue

Conflicts

Pending

Last Successful Synchronization

Agent Heartbeat

---

## Activity Timeline

Show all synchronization activities.

Example

09:10 Customer Created

09:11 Customer Synced

09:15 Invoice Updated

09:17 Payment Failed

09:18 Retry Scheduled

---

# Smart Error Resolution

Never expose raw technical errors.

Instead analyse the problem and recommend a solution.

Example

Instead of

"Ledger Missing"

Display

"The ledger 'Sales Account' could not be found."

Suggested Match

Sales Ledger

Confidence

99%

Approve Mapping

Retry Automatically

---

# Automatic Recovery

Automatically recover from:

Internet Failure

Power Failure

Windows Restart

Tally Restart

Temporary Authentication Failure

No manual intervention should normally be required.

---

# Offline Mode

If the internet becomes unavailable:

Continue collecting synchronization requests locally.

Display:

Working Offline

128 Changes Waiting

Automatically synchronize when connectivity returns.

---

# Health Monitoring

Continuously monitor:

Agent Online Status

Tally Running

Internet Connectivity

CPU Usage

Memory Usage

Disk Usage

Queue Length

Last Heartbeat

Last Successful Synchronization

Connector Version

Display this information inside the Integration Center.

---

# Automatic Updates

The connector agent should periodically check for updates.

If a new version exists:

Download

Install

Restart

Reconnect

Resume Synchronization

All updates should occur without affecting synchronization.

---

# AI Integration Assistant

Provide an AI assistant capable of understanding the connector.

Example requests:

Connect my Tally

Why isn't my invoice syncing?

Retry failed invoices

Show pending records

Map GST Number

Change synchronization interval

Check connector health

The AI should understand connector status and provide guided recommendations instead of technical instructions.

---

# User Experience Principles

Always prioritise simplicity.

Automatically detect everything possible.

Never ask for information that can be discovered.

Hide advanced settings by default.

Provide AI recommendations before manual configuration.

Use friendly language instead of technical terminology.

Display visual progress during synchronization.

Provide one-click recovery wherever possible.

Support safe dry-run validation before first synchronization.

Make the connector feel like a consumer application rather than an enterprise integration tool.

---

# Success Criteria

- First-time setup completed in less than five minutes.
- More than 90% of field mappings accepted without manual edits.
- Users should rarely need technical documentation.
- Most synchronization failures should be recoverable automatically.
- All connector management should happen through a single Integration Center.
- The connector should be reusable so future integrations (SAP, QuickBooks, Zoho Books, Dynamics, Oracle NetSuite, REST APIs, etc.) can use the same onboarding, monitoring, health, AI assistance, and management experience.

The final implementation should feel comparable to products from Apple, Stripe, Slack, Salesforce, and ClickUp—powerful internally but exceptionally simple for end users.

---

# TDL Pack v1.0.0 (shipped with Agent 0.3.0+)

Production TallyPrime integration requires the Arivu TDL pack on the Windows PC.

## Install paths

- `C:\Program Files\Arivu\Connector\tdl\`
- `%ProgramData%\Arivu\Connector\tdl\`

## Load

1. Prefer `ArivuConnector.tdl` (Includes Masters / Inventory / Vouchers / GST modules).
2. Fallback: `ArivuConnector.All.tdl` (single file, no `#Include`).
3. Restart Tally → Gateway → **Arivu Connector** must show pack **1.0.0**.
4. F12 → enable HTTP/ODBC (port 9000).
5. Keep **Desktop → Arivu Connector** open (user session; Session 0 service cannot see Tally).

## Collections (31)

Masters, inventory (incl. GodownEntries/BatchEntries), vouchers with nested LedgerEntries.*/InventoryEntries.*, GST classifications / tax units / duty ledgers, attendance types, Meta version probe.

## Cloud sync

- Orchestrator enqueues full inbound catalog via `tallyTdlCatalog.js` (dry_run uses a lighter subset).
- Agent discovery probes Meta + Arivu company collection; heartbeat reports `tdlLoaded` / `tdlPackVersion`.
- Inbound apply maps every masterType/exportId into `ConnectorExternalObject` pending rows (incl. vouchers by GUID).

## Agent version

Agent **0.3.0** + TDL pack **1.0.0**. Rebuild installer via Actions → **Tally Connector Installer**.
