import { inject, nextTick, provide, ref } from 'vue';

const HIERARCHY_NAV_KEY = Symbol('roleHierarchyNavigation');

function flattenPreorder(nodes, list = []) {
  for (const node of nodes || []) {
    list.push(node);
    if (node.children?.length) flattenPreorder(node.children, list);
  }
  return list;
}

function findAncestorIds(nodes, roleId, path = []) {
  for (const node of nodes || []) {
    if (String(node._id) === String(roleId)) return path;
    const found = findAncestorIds(node.children, roleId, [...path, String(node._id)]);
    if (found) return found;
  }
  return null;
}

export function provideRoleHierarchyNavigation(getHierarchy) {
  const focusedRoleId = ref(null);
  const expandPathSignal = ref({ roleIds: [], tick: 0 });

  function focusRole(roleId) {
    if (!roleId) return;
    const hierarchy = getHierarchy();
    const ancestors = findAncestorIds(hierarchy, roleId) || [];
    expandPathSignal.value = {
      roleIds: [...ancestors, String(roleId)],
      tick: Date.now()
    };
    focusedRoleId.value = String(roleId);

    nextTick(() => {
      const el = document.querySelector(`[data-hierarchy-focus-id="${roleId}"]`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function handleRoleKeydown(event, roleId, callbacks = {}) {
    const hierarchy = getHierarchy();
    const flat = flattenPreorder(hierarchy);
    const idx = flat.findIndex((node) => String(node._id) === String(roleId));
    if (idx < 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (flat[idx + 1]) focusRole(flat[idx + 1]._id);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (flat[idx - 1]) focusRole(flat[idx - 1]._id);
        break;
      case 'ArrowRight':
        event.preventDefault();
        callbacks.onExpand?.();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        callbacks.onCollapse?.();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        callbacks.onActivate?.();
        break;
      default:
        break;
    }
  }

  provide(HIERARCHY_NAV_KEY, {
    focusedRoleId,
    expandPathSignal,
    focusRole,
    handleRoleKeydown
  });

  return { focusedRoleId, expandPathSignal, focusRole, handleRoleKeydown };
}

export function useRoleHierarchyNavigation() {
  return inject(HIERARCHY_NAV_KEY, {
    focusedRoleId: ref(null),
    expandPathSignal: ref({ roleIds: [], tick: 0 }),
    focusRole: () => {},
    handleRoleKeydown: () => {}
  });
}
