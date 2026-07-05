import { computed, reactive, ref, watch, type Ref } from 'vue';
import type { Component } from 'grapesjs';
import { normalizeDisplayText, isComponentDomFocused } from '../editor/textContent';
import { patchComponentAttributes, readComponentAttributes } from '../editor/selection';

type ReadFn = (component: Component) => string;
type WriteFn = (component: Component, value: string) => void;

export interface ComponentTextDraftField {
  draft: string;
  onFocus: () => void;
  onInput: () => void;
  onBlur: () => void;
}

export function useComponentTextDraft(
  component: Ref<Component | null | undefined>,
  watchKey: Ref<string>,
  read: ReadFn,
  write: WriteFn,
  onCommit?: () => void
): ComponentTextDraftField {
  const isFocused = ref(false);
  const localEdit = ref('');

  function readSafe(model: Component | null | undefined): string {
    if (!model) return '';
    try {
      return normalizeDisplayText(read(model));
    } catch {
      return '';
    }
  }

  const draft = computed({
    get() {
      if (isFocused.value) return localEdit.value;
      const model = component.value;
      if (model && isComponentDomFocused(model)) {
        return localEdit.value;
      }
      return readSafe(model);
    },
    set(value: string) {
      localEdit.value = normalizeDisplayText(value);
    }
  });

  watch(watchKey, () => {
    isFocused.value = false;
    const model = component.value;
    if (!model || !isComponentDomFocused(model)) {
      localEdit.value = readSafe(model);
    }
  }, { immediate: true });

  function commit() {
    const model = component.value;
    if (!model) return;
    write(model, localEdit.value);
    onCommit?.();
  }

  function onFocus() {
    isFocused.value = true;
    localEdit.value = readSafe(component.value);
  }

  function onInput() {
    // Commit on blur only — avoids fighting canvas RTE on every keystroke.
  }

  function onBlur() {
    isFocused.value = false;
    const model = component.value;
    if (model && isComponentDomFocused(model)) {
      return;
    }
    commit();
    localEdit.value = readSafe(model);
  }

  // Refs nested in a plain object are not unwrapped in templates (shows [object Object]).
  return reactive({
    draft,
    onFocus,
    onInput,
    onBlur
  });
}

export function useAttrDraft(
  component: Ref<Component | null | undefined>,
  watchKey: Ref<string>,
  attrKey: string,
  defaultValue = '',
  onCommit?: () => void
) {
  return useComponentTextDraft(
    component,
    watchKey,
    (model) => readComponentAttributes(model)[attrKey] || defaultValue,
    (model, value) => patchComponentAttributes(model, { [attrKey]: value }),
    onCommit
  );
}
