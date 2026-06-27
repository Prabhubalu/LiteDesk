import type { Editor } from 'grapesjs';

export interface GrapesStyleUiHosts {
  traits: HTMLElement;
  selectors: HTMLElement;
  styles: HTMLElement;
}

const mounted = new WeakSet<Editor>();

export function mountGrapesStyleUi(editor: Editor, hosts: GrapesStyleUiHosts): boolean {
  const { traits, selectors, styles } = hosts;
  if (!traits || !selectors || !styles) return false;

  const needsMount =
    !mounted.has(editor) ||
    traits.childElementCount === 0 ||
    selectors.childElementCount === 0 ||
    styles.childElementCount === 0;

  if (needsMount) {
    traits.replaceChildren(editor.TraitManager.render());
    selectors.replaceChildren(editor.SelectorManager.render());
    styles.replaceChildren(editor.StyleManager.render());
    mounted.add(editor);
  }

  return true;
}

export function unmountGrapesStyleUi(editor: Editor | null | undefined): void {
  if (!editor || !mounted.has(editor)) return;
  mounted.delete(editor);
}
