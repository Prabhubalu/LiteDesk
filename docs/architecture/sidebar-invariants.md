# Sidebar invariants (locked contract)

The sidebar is a **doctrine-enforced surface**. It renders **surfaces, application peers, and governance — never raw entities inline**.

## Hierarchy

```
Workspace (shell)
  Home, Inbox, Astra, Announcements, Approvals, Attention, …

Applications (peers)
  Core → modules in docked drawer / hover flyout
  Sales → …
  Helpdesk → …
  …

Governance
  Help, Settings
```

## Rules

1. **Rail = top-level only.** Shell surfaces + installed apps. No module lists in the rail.
2. **Modules live beside the rail.** Hover shows a temporary `AppFlyout` peek. Click an app icon docks `AppModuleDrawer`. Navigating from the flyout does not open the drawer.
3. **Core is a peer app** (`id: CORE`), not an expandable inline section. Sales/Helpdesk/etc. are peers, not nested under Core.
4. **One docked drawer.** Persists in localStorage until the user collapses it. Hover flyout never pins. On mobile (`< lg`), an application peer must stay docked: route-owning app when a module is selected, otherwise Core.
5. **Permissions / routing / active state** stay registry- and route-driven — do not hardcode module lists in the sidebar UI.

If a new sidebar item is needed, update:
- `SidebarStructure` (`client/src/types/sidebar.types.ts`)
- `sidebar-invariants.md` (this file)
- `buildSidebarFromRegistry.ts`
- `AppSidebar.vue` / `AppModuleDrawer.vue` / `AppFlyout.vue` only if the UI contract changes
