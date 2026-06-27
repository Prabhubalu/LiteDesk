import type { Ref } from 'vue';

/**
 * JSDoc mirror for `useRecordTags.js` so Vue SFC + vue-tsc resolve types.
 */
export function useRecordTags(recordRef: Ref<Record<string, unknown>>, options: Record<string, unknown>): any;

export function getDefaultTagChipClass(tagNameOrObject: unknown): string;
export function getDefaultTagDotClass(tagNameOrObject: unknown): string;
