/**
 * ============================================================================
 * COMMAND PALETTE TYPE DEFINITIONS
 * ============================================================================
 * 
 * This type defines the STRICT contract for Command Palette items.
 * 
 * IMPORTANT: This is a COMMAND DEFINITION, not a feature.
 * - Commands are intentional and limited
 * - Commands must be executable in under 100ms
 * - Commands are stateless, fast actions
 * - Commands execute explicit user intent
 * 
 * See docs/architecture/command-palette-invariants.md for the architectural
 * rules that this contract enforces.
 * 
 * ============================================================================
 */

import type { Router } from 'vue-router';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

/**
 * Command identifier
 * 
 * Unique string identifier for a command.
 * Format: 'category-action' (e.g., 'nav-inbox', 'create-person')
 * 
 * Used for:
 * - Command registration and lookup
 * - Command execution tracking
 * - Command filtering and matching
 */
export type CommandId = string;

/**
 * Command category
 * 
 * Groups commands by their primary purpose:
 * - 'navigation' = Navigate to a surface or view
 * - 'create' = Create a new entity (Person, Organization, Deal, etc.)
 * - 'action' = Execute a stateless action (switch app, toggle setting, etc.)
 * 
 * Used for:
 * - Visual grouping in Command Palette UI
 * - Command filtering and organization
 * - Understanding command intent
 */
export type CommandCategory = 'navigation' | 'create' | 'action';

/**
 * Command scope
 * 
 * Determines command visibility:
 * - 'global' = Always visible, regardless of active surface
 * - 'contextual' = Only visible when context matches active surface
 * 
 * Used for:
 * - Command filtering and visibility
 * - Architectural separation between global and contextual commands
 * 
 * Note: Scope determines visibility, context determines which surface.
 */
export type CommandScope = 'global' | 'contextual';

/**
 * Command context
 * 
 * Indicates which surface a contextual command applies to:
 * - 'inbox' = Available when viewing Inbox surface
 * - 'people' = Available when viewing People surface
 * - 'organization' = Available when viewing Organization surface
 * 
 * Used for:
 * - Context-aware command filtering
 * - Showing only relevant commands
 * - Preventing command clutter
 * 
 * Note: Only used when scope='contextual'. Global commands don't need context.
 */
export type CommandContext = 'inbox' | 'people' | 'organization';

/**
 * Command icon
 * 
 * Icon representation for the command.
 * Can be:
 * - String emoji (e.g., '📥', '➕', '🏢')
 * - Icon component name (future: icon library integration)
 * 
 * Used for:
 * - Visual identification in Command Palette UI
 * - Quick scanning and recognition
 * - Consistent visual language
 */
export type CommandIcon = string;

/**
 * Keyboard shortcut hint
 * 
 * Optional keyboard shortcut for the command.
 * Format: 'Cmd+K' or 'Ctrl+P' or '⌘K'
 * 
 * Used for:
 * - Displaying shortcut hints in UI
 * - Power user efficiency
 * - Keyboard-first interaction
 * 
 * Note: Shortcuts are hints only. Actual keyboard handling
 * is managed by the Command Palette component, not the command definition.
 */
export type CommandShortcut = string;

/**
 * Command execution function
 * 
 * Function that executes the command action.
 * 
 * REQUIREMENTS:
 * - Must execute in under 100ms (synchronous or fast async)
 * - Must be stateless (no side effects beyond intended action)
 * - Must be reversible where possible (per safety rules)
 * - Must not show nested menus or configuration
 * 
 * SIGNATURE:
 * - Can return void (synchronous action)
 * - Can return Promise<void> (async action, must complete quickly)
 * 
 * EXAMPLES:
 * ```typescript
 * // Navigation command
 * run: () => router.push('/inbox')
 * 
 * // Creation command
 * run: () => router.push('/people/new')
 * 
 * // Async action (must be fast)
 * run: async () => {
 *   await toggleTheme()
 * }
 * ```
 */
export type CommandRun = () => Promise<void> | void;

/**
 * Command kind
 * 
 * Discriminated union to distinguish between navigation and action commands:
 * - 'navigate' = Commands that navigate to routes (use NavigationUtilities)
 * - 'action' = Commands that execute handler functions (use action handlers)
 * 
 * Used for:
 * - Type-safe command execution
 * - Clear separation between navigation and action commands
 * - Enabling different execution paths for different command types
 */
export type CommandKind = 'navigate' | 'action';

/**
 * Action handler function
 * 
 * Function that executes an action command.
 * Action commands perform operations other than navigation.
 * 
 * REQUIREMENTS:
 * - Must execute in under 100ms
 * - Must be stateless
 * - Must be reversible where possible
 * 
 * SIGNATURE:
 * - Receives current route as parameter for accessing route params
 * - Can return void (synchronous action)
 * - Can return Promise<void> (async action, must complete quickly)
 * 
 * EXAMPLES:
 * ```typescript
 * // Toggle theme
 * handler: () => toggleTheme()
 * 
 * // Open modal with route context
 * handler: (route) => {
 *   const orgId = route.params?.id;
 *   openLinkDrawer({ organizationId: orgId });
 * }
 * ```
 */
export type ActionHandler = (route: RouteLocationNormalizedLoaded) => Promise<void> | void;

/**
 * ============================================================================
 * COMMAND PALETTE ITEM BASE
 * ============================================================================
 * 
 * Base properties shared by all command types.
 * 
 * Command Palette is an action execution surface, not a search surface.
 * It executes explicit user intent through well-defined commands.
 * 
 * Each command is:
 * - Intentional: Explicitly added for a specific purpose
 * - Limited: Only essential actions, not exhaustive feature sets
 * - Fast: Executable in under 100ms
 * - Stateless: No hidden side effects
 * - Reversible: Where possible, actions can be undone
 * 
 * ============================================================================
 */
interface CommandPaletteItemBase {
  /**
   * Command identifier
   * 
   * Unique string identifier for this command.
   * Format: 'category-action' (e.g., 'nav-inbox', 'create-person')
   */
  id: CommandId;

  /**
   * Command label
   * 
   * Human-readable label displayed in Command Palette UI.
   * Must be concise and action-oriented.
   */
  label: string;

  /**
   * Command description
   * 
   * Short, muted description shown below the label.
   * Provides additional context without cluttering the UI.
   */
  description?: string;

  /**
   * Command category
   * 
   * Groups commands by their primary purpose.
   * Used for visual grouping and organization in UI.
   */
  category: CommandCategory;

  /**
   * Command scope
   * 
   * Determines command visibility:
   * - 'global' = Always visible, regardless of active surface
   * - 'contextual' = Only visible when context matches active surface
   */
  scope: CommandScope;

  /**
   * Command context
   * 
   * Indicates which surface a contextual command applies to.
   * Only used when scope='contextual'.
   */
  context?: CommandContext;

  /**
   * Module key for resolving the standard module icon (sidebar / list views).
   * Preferred over emoji `icon` in the command palette UI.
   */
  moduleKey?: string;

  /**
   * Command icon (legacy emoji or icon id fallback).
   */
  icon?: CommandIcon;

  /**
   * Keyboard shortcut hint
   * 
   * Optional keyboard shortcut for power users.
   * Format: 'Cmd+K' or 'Ctrl+P' or '⌘K'
   */
  shortcut?: CommandShortcut;

  /**
   * Whether this command is destructive
   * 
   * Destructive commands require confirmation before execution.
   * Default: false (commands are non-destructive by default)
   */
  destructive?: boolean;
}

/**
 * Navigation command
 * 
 * Commands that navigate to routes using NavigationUtilities.
 * These commands use the router to change the current route.
 * 
 * EXAMPLES:
 * - "Go to Inbox" -> navigates to /inbox
 * - "Create Person" -> navigates to /people/create
 * - "Create Deal" -> navigates to /deals with query params
 */
export interface NavigateCommand extends CommandPaletteItemBase {
  kind: 'navigate';
  /**
   * Navigation execution function
   * 
   * Function that executes navigation using NavigationUtilities.
   * Receives NavigationUtilities as parameter for navigation operations.
   * 
   * EXAMPLES:
   * ```typescript
   * run: (nav) => nav.navigate('/inbox')
   * run: (nav) => nav.navigateWithQuery('/deals', { createNew: 'true' })
   * ```
   */
  run: (nav: NavigationUtilities) => Promise<void> | void;
}

/**
 * Action command
 * 
 * Commands that execute handler functions instead of navigation.
 * These commands perform operations other than routing.
 * 
 * EXAMPLES:
 * - "Toggle Theme" -> calls theme toggle handler
 * - "Refresh Data" -> calls refresh handler
 * - "Export Data" -> calls export handler
 */
export interface ActionCommand extends CommandPaletteItemBase {
  kind: 'action';
  /**
   * Action handler function
   * 
   * Function that executes the action.
   * Does not receive NavigationUtilities - actions don't navigate.
   * 
   * EXAMPLES:
   * ```typescript
   * handler: () => toggleTheme()
   * handler: async () => await refreshData()
   * ```
   */
  handler: ActionHandler;
}

/**
 * Navigation utilities interface
 * 
 * Used by navigation commands to perform routing operations.
 * This abstraction allows commands to work with different navigation systems.
 */
export interface NavigationUtilities {
  /** Navigate to a route */
  navigate: (path: string) => Promise<void> | void;
  
  /** Navigate to a route with query parameters */
  navigateWithQuery: (path: string, query: Record<string, string>) => Promise<void> | void;
  
  /** Open a route in a new tab with a title */
  openTab: (path: string, options?: { title?: string; background?: boolean }) => Promise<void> | void;
  
  /** Get current route (for accessing params) */
  getCurrentRoute: () => Router['currentRoute'];
}

/**
 * ============================================================================
 * COMMAND PALETTE ITEM
 * ============================================================================
 * 
 * Discriminated union of NavigateCommand and ActionCommand.
 * 
 * This allows type-safe distinction between:
 * - Navigation commands (kind: 'navigate') - use NavigationUtilities
 * - Action commands (kind: 'action') - use handler functions
 * 
 * The 'kind' field is the discriminator that determines which type of command
 * it is and what execution path to use.
 * 
 * ============================================================================
 */
export type CommandPaletteItem = NavigateCommand | ActionCommand;

/**
 * ============================================================================
 * EXPLICIT EXCLUSIONS
 * ============================================================================
 * 
 * The following are EXPLICITLY EXCLUDED from CommandPaletteItem because
 * they violate Command Palette invariants:
 * 
 * EXCLUDED FIELDS:
 * 
 * API PAYLOADS:
 * - requestBody: API request payloads (commands don't make API calls directly)
 *   WHY: Commands execute actions, not API requests. API calls belong in
 *        action handlers, not command definitions. Commands navigate or
 *        trigger actions, they don't carry data.
 * 
 * - responseData: API response data (commands don't return data)
 *   WHY: Commands execute actions, not data fetches. Commands navigate or
 *        trigger actions, they don't return entities or data.
 * 
 * - apiEndpoint: API endpoint URLs (commands don't make API calls)
 *   WHY: Commands execute actions via navigation or component methods,
 *        not direct API calls. API integration belongs in action handlers.
 * 
 * ENTITY DATA:
 * - entityId: Entity identifiers (commands don't operate on entities)
 *   WHY: Commands execute actions, not entity operations. Commands navigate
 *        to surfaces where entities are managed, they don't carry entity data.
 * 
 * - entityType: Entity types (commands don't operate on entities)
 *   WHY: Commands execute actions, not entity operations. Entity operations
 *        belong in dedicated surfaces, not Command Palette.
 * 
 * - entityData: Entity data objects (commands don't carry entity data)
 *   WHY: Commands execute actions, not entity operations. Commands navigate
 *        or trigger actions, they don't carry entity payloads.
 * 
 * CONDITIONAL UI STATE:
 * - isEnabled: Conditional enablement (commands are always available)
 *   WHY: Commands are stateless and always available. Conditional behavior
 *        violates the "stateless" principle. If an action is conditional,
 *        it belongs in a context surface, not Command Palette.
 * 
 * - isVisible: Conditional visibility (commands are always visible in context)
 *   WHY: Commands are filtered by context, not conditional visibility.
 *        Context filtering is handled by Command Palette component, not
 *        individual command definitions.
 * 
 * - requiresPermission: Permission checks (commands don't check permissions)
 *   WHY: Permission checks belong in action handlers or route guards, not
 *        command definitions. Commands are available based on context,
 *        permissions are enforced at execution time.
 * 
 * - dependsOnState: State dependencies (commands are stateless)
 *   WHY: Commands are stateless and don't depend on UI state. State-dependent
 *        actions belong in context surfaces, not Command Palette.
 * 
 * - showWhen: Conditional display logic (commands are always shown in context)
 *   WHY: Commands are filtered by context, not conditional display logic.
 *        Context filtering is handled by Command Palette component.
 * 
 * FEATURE FLAGS:
 * - featureFlag: Feature flag references (commands don't depend on features)
 *   WHY: Commands are core actions, not feature-gated functionality. Feature
 *        flags belong in feature implementations, not command definitions.
 * 
 * CONFIGURATION:
 * - config: Command configuration (commands don't have configuration)
 *   WHY: Commands are stateless actions, not configurable features. Configuration
 *        belongs in Settings surface, not Command Palette.
 * 
 * - options: Command options (commands don't have options)
 *   WHY: Commands execute single actions, not multi-option features. Options
 *        belong in dedicated surfaces, not Command Palette.
 * 
 * - parameters: Command parameters (commands don't accept parameters)
 *   WHY: Commands execute fixed actions, not parameterized features. Parameters
 *        belong in dedicated surfaces or search mode, not Command Palette.
 * 
 * NESTED MENUS:
 * - subCommands: Sub-commands (commands don't have nested menus)
 *   WHY: Commands are flat, scannable actions. Nested menus violate the
 *        "no nested menus" principle. Complex actions belong in dedicated surfaces.
 * 
 * - children: Child commands (commands don't have children)
 *   WHY: Commands are flat, scannable actions. Nested structures violate
 *        the "no nested menus" principle.
 * 
 * HISTORY/STATE:
 * - lastUsed: Last usage timestamp (commands don't track history)
 *   WHY: Commands are stateless and don't track usage. History belongs in
 *        Search mode or dedicated surfaces, not Command Palette.
 * 
 * - usageCount: Usage count (commands don't track usage)
 *   WHY: Commands are stateless and don't track metrics. Metrics belong in
 *        analytics systems, not command definitions.
 * 
 * - recentItems: Recent items list (commands don't show history)
 *   WHY: Commands execute actions, not history browsing. History belongs in
 *        Search mode or dedicated surfaces.
 * 
 * These exclusions ensure that CommandPaletteItem remains a lightweight,
 * stateless command definition focused on fast action execution, not feature
 * complexity. Complex features belong in dedicated surfaces, not Command Palette.
 * 
 * ============================================================================
 */
