import type { Component, Editor } from 'grapesjs';

type CanMoveResult = ReturnType<Editor['Components']['canMove']>;

const CAN_MOVE_TARGET_REJECT = 2 as CanMoveResult['reason'];

/**
 * GrapesJS canMove calls `el.matches()` on drag targets/sources. During external
 * block drag the resolved element can be a text node or not yet mounted, which throws.
 */
export function patchComponentCanMove(editor: Editor): void {
  const components = editor.Components;
  const original = components.canMove.bind(components);

  components.canMove = (target, source, index): CanMoveResult => {
    try {
      return original(target, source, index);
    } catch {
      return {
        result: false,
        reason: CAN_MOVE_TARGET_REJECT,
        target,
        source: null
      };
    }
  };
}

export function elementMatchesSelector(el: unknown, selector: string): boolean {
  return el instanceof Element && el.matches(selector);
}

export function componentElementMatches(component: Component | null | undefined, selector: string): boolean {
  if (!component) return false;
  return elementMatchesSelector(component.getEl(), selector);
}
