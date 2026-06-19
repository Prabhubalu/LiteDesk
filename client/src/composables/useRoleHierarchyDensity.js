import { inject, provide, ref } from 'vue';

const HIERARCHY_DENSITY_KEY = Symbol('roleHierarchyDensity');

const STORAGE_KEY = 'arivu-hierarchy-compact-density';

export function provideRoleHierarchyDensity() {
  const compactDensity = ref(localStorage.getItem(STORAGE_KEY) === 'true');

  function setCompactDensity(value) {
    compactDensity.value = Boolean(value);
    localStorage.setItem(STORAGE_KEY, compactDensity.value ? 'true' : 'false');
  }

  provide(HIERARCHY_DENSITY_KEY, { compactDensity, setCompactDensity });

  return { compactDensity, setCompactDensity };
}

export function useRoleHierarchyDensity() {
  return inject(HIERARCHY_DENSITY_KEY, {
    compactDensity: ref(false),
    setCompactDensity: () => {}
  });
}
