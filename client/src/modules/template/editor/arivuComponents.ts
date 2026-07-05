import type { Editor } from 'grapesjs';

interface ArivuComponentSpec {
  type: string;
  attr: string;
  name: string;
  tagName?: string;
  droppable?: boolean;
  draggable?: boolean;
  editable?: boolean;
  copyable?: boolean;
}

const ARIVU_COMPONENT_SPECS: ArivuComponentSpec[] = [
  { type: 'arivu-section', attr: 'data-section', name: 'Section', tagName: 'section', droppable: true },
  { type: 'arivu-container', attr: 'data-container', name: 'Container', droppable: true },
  { type: 'arivu-row', attr: 'data-row', name: 'Row', droppable: true },
  { type: 'arivu-column', attr: 'data-column', name: 'Column', droppable: true },
  { type: 'arivu-header', attr: 'data-header-block', name: 'Header', tagName: 'header', droppable: true },
  { type: 'arivu-footer', attr: 'data-footer-block', name: 'Footer', tagName: 'footer', droppable: true },
  { type: 'arivu-heading', attr: 'data-heading', name: 'Heading', tagName: 'h2', editable: true },
  { type: 'arivu-paragraph', attr: 'data-paragraph', name: 'Paragraph', tagName: 'p', editable: true },
  { type: 'arivu-text-block', attr: 'data-text-block', name: 'Text', tagName: 'div', editable: true },
  { type: 'arivu-rich-text', attr: 'data-rich-text', name: 'Rich text', droppable: true, editable: true },
  { type: 'arivu-list', attr: 'data-list', name: 'List', tagName: 'ul', droppable: true, editable: true },
  { type: 'arivu-spacer', attr: 'data-spacer', name: 'Spacer', droppable: false, draggable: true },
  { type: 'arivu-divider', attr: 'data-divider', name: 'Divider', tagName: 'hr', droppable: false },
  { type: 'arivu-merge-field', attr: 'data-merge-field', name: 'Merge field', tagName: 'span', editable: false },
  { type: 'arivu-variable', attr: 'data-variable', name: 'Variable', tagName: 'span', editable: false },
  { type: 'arivu-formula', attr: 'data-formula', name: 'Formula', tagName: 'span', editable: false },
  { type: 'arivu-conditional', attr: 'data-conditional', name: 'Conditional', droppable: true },
  { type: 'arivu-loop', attr: 'data-loop', name: 'Loop', droppable: true },
  { type: 'arivu-repeater', attr: 'data-repeater', name: 'Repeater', droppable: true },
  { type: 'arivu-related-records', attr: 'data-related-records', name: 'Related records', droppable: true },
  { type: 'arivu-totals', attr: 'data-totals', name: 'Totals', droppable: false },
  { type: 'arivu-tax-summary', attr: 'data-tax-summary', name: 'Tax summary', droppable: false },
  { type: 'arivu-address', attr: 'data-address-block', name: 'Address', droppable: false, editable: true },
  { type: 'arivu-organization', attr: 'data-organization-block', name: 'Organization', droppable: false, editable: true },
  { type: 'arivu-contact-card', attr: 'data-contact-card', name: 'Contact card', droppable: false, editable: true },
  { type: 'arivu-logo', attr: 'data-logo', name: 'Logo', tagName: 'img', droppable: false },
  { type: 'arivu-icon', attr: 'data-icon', name: 'Icon', tagName: 'span', droppable: false },
  { type: 'arivu-qr-code', attr: 'data-qr-code', name: 'QR code', droppable: false },
  { type: 'arivu-barcode', attr: 'data-barcode', name: 'Barcode', droppable: false },
  { type: 'arivu-signature', attr: 'data-signature', name: 'Signature', droppable: false },
  { type: 'arivu-button', attr: 'data-button', name: 'Button', tagName: 'a', editable: true },
  { type: 'arivu-social-icons', attr: 'data-social-icons', name: 'Social icons', droppable: true },
  { type: 'arivu-watermark', attr: 'data-watermark', name: 'Watermark', droppable: false, editable: true },
  { type: 'arivu-page-break', attr: 'data-page-break', name: 'Page break', droppable: false },
  { type: 'arivu-page-number', attr: 'data-page-number', name: 'Page number', tagName: 'span', droppable: false },
  { type: 'arivu-html', attr: 'data-html-block', name: 'HTML', droppable: false, editable: true }
];

export function registerArivuComponents(editor: Editor): void {
  for (const spec of ARIVU_COMPONENT_SPECS) {
    if (editor.DomComponents.getType(spec.type)) continue;

    const defaults = {
      type: spec.type,
      tagName: spec.tagName || 'div',
      name: spec.name,
      attributes: { [spec.attr]: 'true' },
      droppable: spec.droppable ?? false,
      draggable: spec.draggable ?? true,
      editable: spec.editable ?? false,
      copyable: spec.copyable ?? true,
      stylable: true,
      layerable: true
    };

    // Grapes RTE (dblclick → onActive) lives on ComponentTextView — only the `text` type has it.
    const definition: Parameters<Editor['DomComponents']['addType']>[1] = {
      isComponent: (el) => {
        if (!(el instanceof HTMLElement)) return false;
        return el.getAttribute(spec.attr) === 'true';
      },
      model: { defaults },
      ...(spec.editable ? { extend: 'text' as const } : {})
    };

    editor.DomComponents.addType(spec.type, definition);
  }
}
