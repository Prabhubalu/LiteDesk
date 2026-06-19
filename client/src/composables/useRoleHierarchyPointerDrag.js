import { ref } from 'vue';

export const pointerDragRoleId = ref(null);
export const pointerDropTarget = ref(null);
export const pointerDragActive = ref(false);

const DRAG_THRESHOLD_PX = 8;

let moveListener = null;
let upListener = null;
let cancelListener = null;
let pendingDrag = null;
let ghostEl = null;
let capturedEl = null;
let capturedPointerId = null;

function normalizeParentId(parentRoleId) {
  if (!parentRoleId) return null;
  return String(parentRoleId);
}

function resolveDropTarget(clientX, clientY, draggingRoleId) {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    if (ghostEl && (el === ghostEl || ghostEl.contains(el))) continue;

    const reorderSlot = el.closest?.('[data-hierarchy-reorder-slot]');
    if (reorderSlot) {
      const parentRoleId = reorderSlot.getAttribute('data-hierarchy-parent-role-id');
      const insertBeforeRoleId = reorderSlot.getAttribute('data-hierarchy-insert-before-role-id');
      const insertAfterRoleId = reorderSlot.getAttribute('data-hierarchy-insert-after-role-id');
      const slotKey = reorderSlot.getAttribute('data-hierarchy-slot-key');
      return {
        kind: 'reorder',
        parentRoleId: parentRoleId || null,
        insertBeforeRoleId: insertBeforeRoleId || null,
        insertAfterRoleId: insertAfterRoleId || null,
        slotKey: slotKey || null
      };
    }

    const root = el.closest?.('[data-hierarchy-root-drop]');
    if (root) return { kind: 'root' };

    const chip = el.closest?.('[data-hierarchy-role-id]');
    if (!chip) continue;
    const roleId = chip.getAttribute('data-hierarchy-role-id');
    if (!roleId || roleId === draggingRoleId) continue;
    if (chip.getAttribute('data-hierarchy-no-drop') === 'true') continue;
    return { kind: 'reparent', parentRoleId: roleId };
  }
  return null;
}

function updateGhostPosition(clientX, clientY) {
  if (!ghostEl) return;
  ghostEl.style.left = `${clientX}px`;
  ghostEl.style.top = `${clientY}px`;
}

function createGhost(label) {
  const el = document.createElement('div');
  el.className = 'role-hierarchy-drag-ghost';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <span class="role-hierarchy-drag-ghost-grip" aria-hidden="true">≡</span>
    <span class="role-hierarchy-drag-ghost-label"></span>
  `;
  el.querySelector('.role-hierarchy-drag-ghost-label').textContent = label || 'Role';
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.classList.add('role-hierarchy-drag-ghost-visible');
  });
  return el;
}

function removeGhost() {
  if (!ghostEl) return;
  ghostEl.classList.remove('role-hierarchy-drag-ghost-visible');
  const el = ghostEl;
  ghostEl = null;
  window.setTimeout(() => el.remove(), 150);
}

function releasePointerCapture() {
  if (capturedEl && capturedPointerId != null) {
    try {
      capturedEl.releasePointerCapture(capturedPointerId);
    } catch {
      // ignore
    }
  }
  capturedEl = null;
  capturedPointerId = null;
}

function cleanupListeners() {
  if (moveListener) {
    document.removeEventListener('pointermove', moveListener);
    moveListener = null;
  }
  if (upListener) {
    document.removeEventListener('pointerup', upListener);
    upListener = null;
  }
  if (cancelListener) {
    document.removeEventListener('pointercancel', cancelListener);
    cancelListener = null;
  }
}

function endPointerDrag() {
  pointerDragActive.value = false;
  pointerDragRoleId.value = null;
  pointerDropTarget.value = null;
  pendingDrag = null;
  document.body.classList.remove('role-hierarchy-dragging');
  removeGhost();
  releasePointerCapture();
  cleanupListeners();
}

function activateDrag(session, moveEvent) {
  pointerDragActive.value = true;
  pointerDragRoleId.value = session.roleId;
  pointerDropTarget.value = null;
  document.body.classList.add('role-hierarchy-dragging');
  ghostEl = createGhost(session.label);
  updateGhostPosition(moveEvent.clientX, moveEvent.clientY);
  pointerDropTarget.value = resolveDropTarget(moveEvent.clientX, moveEvent.clientY, session.roleId);
}

function emitDrop(callback, draggedRoleId, target) {
  if (!callback || !target) return;

  if (target.kind === 'root') {
    callback({ roleId: draggedRoleId, parentRoleId: null });
    return;
  }

  if (target.kind === 'reorder') {
    callback({
      roleId: draggedRoleId,
      parentRoleId: normalizeParentId(target.parentRoleId),
      insertBeforeRoleId: target.insertBeforeRoleId || null,
      insertAfterRoleId: target.insertAfterRoleId || null
    });
    return;
  }

  if (target.kind === 'reparent') {
    callback({
      roleId: draggedRoleId,
      parentRoleId: target.parentRoleId
    });
  }
}

/**
 * @param {string} roleId
 * @param {PointerEvent} event
 * @param {{ label?: string, parentRoleId?: string|null, onDrop: Function }} handlers
 */
export function startRoleHierarchyPointerDrag(roleId, event, handlers) {
  if (pointerDragActive.value || pendingDrag || !roleId) return;
  if (event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();

  const gripEl = event.currentTarget;
  capturedEl = gripEl;
  capturedPointerId = event.pointerId;
  gripEl.setPointerCapture?.(event.pointerId);

  const session = {
    roleId: String(roleId),
    label: handlers?.label || 'Role',
    parentRoleId: normalizeParentId(handlers?.parentRoleId),
    startX: event.clientX,
    startY: event.clientY,
    onDrop: handlers?.onDrop || null
  };
  pendingDrag = session;

  moveListener = (moveEvent) => {
    if (!pendingDrag || moveEvent.pointerId !== capturedPointerId) return;

    const dx = moveEvent.clientX - pendingDrag.startX;
    const dy = moveEvent.clientY - pendingDrag.startY;
    const distance = Math.hypot(dx, dy);

    if (!pointerDragActive.value) {
      if (distance < DRAG_THRESHOLD_PX) return;
      activateDrag(pendingDrag, moveEvent);
    }

    updateGhostPosition(moveEvent.clientX, moveEvent.clientY);
    pointerDropTarget.value = resolveDropTarget(moveEvent.clientX, moveEvent.clientY, pendingDrag.roleId);
  };

  upListener = (upEvent) => {
    if (!pendingDrag || upEvent.pointerId !== capturedPointerId) return;

    const wasDragging = pointerDragActive.value;
    const callback = pendingDrag.onDrop;
    const draggedRoleId = pendingDrag.roleId;

    if (wasDragging) {
      const target = resolveDropTarget(upEvent.clientX, upEvent.clientY, draggedRoleId);
      endPointerDrag();
      emitDrop(callback, draggedRoleId, target);
      return;
    }

    endPointerDrag();
  };

  cancelListener = (cancelEvent) => {
    if (!pendingDrag || cancelEvent.pointerId !== capturedPointerId) return;
    endPointerDrag();
  };

  document.addEventListener('pointermove', moveListener);
  document.addEventListener('pointerup', upListener);
  document.addEventListener('pointercancel', cancelListener);
}

export function cancelRoleHierarchyPointerDrag() {
  endPointerDrag();
}

export function isActiveReorderSlot(slotKey) {
  const target = pointerDropTarget.value;
  return Boolean(target?.kind === 'reorder' && target.slotKey && target.slotKey === slotKey);
}

export function isActiveReparentTarget(roleId) {
  const target = pointerDropTarget.value;
  return Boolean(target?.kind === 'reparent' && String(target.parentRoleId) === String(roleId));
}
