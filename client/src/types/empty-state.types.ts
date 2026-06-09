/**
 * ============================================================================
 * PLATFORM EMPTY STATES: Pure Data Contract
 * ============================================================================
 *
 * Empty is a state — not an error.
 * Every empty state must answer: "What should I do next?"
 *
 * This file defines standard empty state types and structures used across:
 * - Dashboards
 * - Modules / lists
 * - KPIs / widgets
 * - Entire domains with no active modules
 *
 * No UI components, no visuals. Data only.
 * ============================================================================
 */

/**
 * Standard empty state types.
 */
export enum EmptyStateType {
  NO_ACCESS = 'NO_ACCESS',
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  NO_DATA = 'NO_DATA',
  DISABLED = 'DISABLED',
  FIRST_TIME = 'FIRST_TIME',
}

/**
 * Empty state action (primary or secondary).
 */
export interface EmptyStateAction {
  /** Button or link label */
  label: string;

  /** i18n key alternative to label */
  labelKey?: string;

  /** Route to navigate to when action is taken (optional for purely informational actions) */
  route?: string;

  /** Permission required to see/execute this action (primary only) */
  permission?: string;
}

/**
 * Empty state definition (data-only).
 */
export interface EmptyStateDefinition {
  /** Type of empty state */
  type: EmptyStateType;

  /** Title shown in the empty state */
  title: string;

  /** Optional description giving more context */
  description?: string;

  /** Primary action guiding the user on what to do next */
  primaryAction?: EmptyStateAction;

  /** i18n keys (used for FIRST_TIME and onboarding-driven states) */
  titleKey?: string;
  descriptionKey?: string;

  /** Secondary action (optional) */
  secondaryAction?: EmptyStateAction;
}


