/**
 * Shared create/edit form control classes.
 * Keep DynamicFormField, FormTagsField, HeadlessSelect, PhoneInput, and EditableLabeledValue in sync via these tokens.
 */

export const FORM_FIELD_LABEL_CLASS =
  'block text-sm font-normal text-gray-700 dark:text-gray-300';

/** Base control — no vertical margin (compose with mt-1 / mt-2 as needed). */
export const FORM_FIELD_CONTROL_CLASS =
  'block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20';

/** Search input with leading magnifying-glass icon (pl-9) and room for optional clear (pr-9). */
export const FORM_FIELD_SEARCH_CONTROL_CLASS = `${FORM_FIELD_CONTROL_CLASS} pl-9 pr-9`;

export const FORM_FIELD_CONTROL_MT_CLASS = `mt-2 ${FORM_FIELD_CONTROL_CLASS}`;

export const FORM_FIELD_TEXTAREA_CLASS = `${FORM_FIELD_CONTROL_MT_CLASS} resize-none`;

export const FORM_FIELD_LISTBOX_CLASS =
  `${FORM_FIELD_CONTROL_CLASS} relative cursor-default text-left`;

export const FORM_FIELD_READ_ONLY_CLASS =
  'block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400';

export const FORM_FIELD_INVALID_CLASS =
  'border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:focus:border-red-500 dark:focus:ring-red-500/20';

/** Phone national-number segment (paired with country button). */
export const FORM_FIELD_PHONE_INPUT_CLASS =
  'block w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20';

export function joinFormFieldClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}
