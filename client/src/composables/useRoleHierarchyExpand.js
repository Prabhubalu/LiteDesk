import { inject, provide, ref } from 'vue';

const HIERARCHY_EXPAND_KEY = Symbol('roleHierarchyExpand');

export function provideRoleHierarchyExpand() {
  const expandAllSignal = ref(0);
  const collapseAllSignal = ref(0);

  function expandAll() {
    expandAllSignal.value += 1;
  }

  function collapseAll() {
    collapseAllSignal.value += 1;
  }

  provide(HIERARCHY_EXPAND_KEY, { expandAllSignal, collapseAllSignal });

  return { expandAll, collapseAll };
}

export function useRoleHierarchyExpand() {
  return inject(HIERARCHY_EXPAND_KEY, {
    expandAllSignal: ref(0),
    collapseAllSignal: ref(0)
  });
}
