import { ref } from 'vue';

export const pointerDragUserId = ref(null);
export const pointerDragUserTargetRoleId = ref(null);
export const pointerUserDragActive = ref(false);

const DRAG_THRESHOLD_PX = 8;

let moveListener = null;
let upListener = null;
let cancelListener = null;
let pendingDrag = null;
let ghostEl = null;
let capturedEl = null;
let capturedPointerId = null;

function resolveUserDropTarget(clientX, clientY, draggingUserId) {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    if (ghostEl && (el === ghostEl || ghostEl.contains(el))) continue;

    const chip = el.closest?.('[data-hierarchy-role-id]');
    if (!chip) continue;
    const roleId = chip.getAttribute('data-hierarchy-role-id');
    if (!roleId) continue;
    if (chip.getAttribute('data-hierarchy-no-drop') === 'true') continue;
    if (chip.getAttribute('data-hierarchy-user-drop-disabled') === 'true') continue;
    return { kind: 'assign', roleId };
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
  el.className = 'role-hierarchy-user-drag-ghost';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <span class="role-hierarchy-user-drag-ghost-icon" aria-hidden="true">👤</span>
    <span class="role-hierarchy-user-drag-ghost-label"></span>
  `;
  el.querySelector('.role-hierarchy-user-drag-ghost-label').textContent = label || 'User';
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.classList.add('role-hierarchy-user-drag-ghost-visible');
  });
  return el;
}

function removeGhost() {
  if (!ghostEl) return;
  ghostEl.classList.remove('role-hierarchy-user-drag-ghost-visible');
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
  pointerUserDragActive.value = false;
  pointerDragUserId.value = null;
  pointerDragUserTargetRoleId.value = null;
  pendingDrag = null;
  document.body.classList.remove('role-hierarchy-user-dragging');
  removeGhost();
  releasePointerCapture();
  cleanupListeners();
}

function activateDrag(session, moveEvent) {
  pointerUserDragActive.value = true;
  pointerDragUserId.value = session.userId;
  pointerDragUserTargetRoleId.value = null;
  document.body.classList.add('role-hierarchy-user-dragging');
  ghostEl = createGhost(session.label);
  updateGhostPosition(moveEvent.clientX, moveEvent.clientY);
  const target = resolveUserDropTarget(moveEvent.clientX, moveEvent.clientY, session.userId);
  pointerDragUserTargetRoleId.value = target?.roleId || null;
}

/**
 * @param {string} userId
 * @param {PointerEvent} event
 * @param {{ label?: string, currentRoleId?: string|null, onDrop: Function }} handlers
 */
export function startRoleHierarchyUserDrag(userId, event, handlers) {
  if (pointerUserDragActive.value || pendingDrag || !userId) return;
  if (event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();

  const gripEl = event.currentTarget;
  capturedEl = gripEl;
  capturedPointerId = event.pointerId;
  gripEl.setPointerCapture?.(event.pointerId);

  const session = {
    userId: String(userId),
    label: handlers?.label || 'User',
    currentRoleId: handlers?.currentRoleId ? String(handlers.currentRoleId) : null,
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

    if (!pointerUserDragActive.value) {
      if (distance < DRAG_THRESHOLD_PX) return;
      activateDrag(pendingDrag, moveEvent);
    }

    updateGhostPosition(moveEvent.clientX, moveEvent.clientY);
    const target = resolveUserDropTarget(moveEvent.clientX, moveEvent.clientY, pendingDrag.userId);
    pointerDragUserTargetRoleId.value = target?.roleId || null;
  };

  upListener = (upEvent) => {
    if (!pendingDrag || upEvent.pointerId !== capturedPointerId) return;

    const wasDragging = pointerUserDragActive.value;
    const callback = pendingDrag.onDrop;
    const draggedUserId = pendingDrag.userId;
    const currentRoleId = pendingDrag.currentRoleId;

    if (wasDragging) {
      const target = resolveUserDropTarget(upEvent.clientX, upEvent.clientY, draggedUserId);
      endPointerDrag();
      if (target?.roleId && String(target.roleId) !== String(currentRoleId)) {
        callback?.({ userId: draggedUserId, roleId: target.roleId });
      }
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

export function cancelRoleHierarchyUserDrag() {
  endPointerDrag();
}

export function isActiveUserDropTarget(roleId) {
  return Boolean(
    pointerUserDragActive.value
    && pointerDragUserTargetRoleId.value
    && String(pointerDragUserTargetRoleId.value) === String(roleId)
  );
}
