# CommandPalette Invariants

## Purpose

Define Command Palette as a calm, keyboard-first action execution surface for explicit user intent.

## 1. Core Definition

Command Palette is an action execution surface, not a search surface.
It executes explicit user intent.
It never returns entities for browsing.

## 2. Relationship to Search

- Search and Command Palette share a UI shell
- They are separate modes with explicit entry
- Default mode is Search
- Command mode is entered explicitly (via ">" prefix or dedicated shortcut)

## 3. What Command Palette MUST show

- Global actions (navigation, creation, app switching)
- Contextual actions (only when context is known)
- Stateless, fast actions

## 4. What Command Palette MUST NOT show

- Entity lists (People, Orgs, Deals, etc.)
- Historical data
- Search results
- Read-only previews

## 5. UX Principles

- Calm, minimal, keyboard-first
- Scannable in under 2 seconds
- No nested menus
- Settings: hub + top-level tabs only (permission-gated); no deep configuration routes

## 6. Safety Rules

- No destructive actions without confirmation
- No hidden side effects
- Actions must be reversible where possible

## 7. Initial Scope (v1)

- Navigation commands
- Creation commands
- Context-aware shortcuts (Inbox, People, Organization)
- Settings hub and top-level tab navigation (permission-gated)

## 8. Non-goals

- This is NOT a workflow engine
- NOT automation
- NOT a power-user scripting tool

## Lock Statement

Command Palette must remain an action execution surface, not a search or browsing interface.
Any new command requires:
- Explicit UX rationale
- Architectural doc update
- UX review

Any change to these rules requires updating this document first.
