import type { Editor } from '@tiptap/core';
import type { MediaInsertBlockType, MediaInsertValues } from './mediaInsertDialog';
import { TextSelection } from '@tiptap/pm/state';
import type { NodeType } from '@tiptap/pm/model';

function schemaNode(state: Editor['state'], name: string): NodeType | undefined {
  return state.schema.nodes[name];
}

function findTabItemDepth(state: Editor['state']): number | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'tabItem') return depth;
  }
  return null;
}

function findTimelineItemDepth(state: Editor['state']): number | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'timelineItem') return depth;
  }
  return null;
}

export const CONTENT_STUDIO_ADD_TAB_META = 'contentStudioAddTabItem';

export function splitTabItemParagraph(editor: Editor): boolean {
  const tabItemDepth = findTabItemDepth(editor.state);
  if (tabItemDepth === null) return false;

  const { $from } = editor.state.selection;
  const tabItem = $from.node(tabItemDepth);
  const atEndOfBlock = $from.parentOffset === $from.parent.content.size;
  const inLastBlock = $from.index(tabItemDepth) === tabItem.childCount - 1;
  const blockIsEmpty = $from.parent.content.size === 0;

  if (atEndOfBlock && inLastBlock) {
    if (blockIsEmpty && tabItem.childCount === 1) {
      return true;
    }
    const insertPos = $from.after();
    return editor
      .chain()
      .focus()
      .insertContentAt(insertPos, { type: 'paragraph' })
      .command(({ tr }) => {
        tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
        return true;
      })
      .run();
  }

  return editor.chain().focus().splitBlock().run();
}

export function splitTimelineItemParagraph(editor: Editor): boolean {
  const timelineItemDepth = findTimelineItemDepth(editor.state);
  if (timelineItemDepth === null) return false;

  const { $from } = editor.state.selection;
  const timelineItem = $from.node(timelineItemDepth);
  const atEndOfBlock = $from.parentOffset === $from.parent.content.size;
  const inLastBlock = $from.index(timelineItemDepth) === timelineItem.childCount - 1;

  if (atEndOfBlock && inLastBlock) {
    return addTimelineItem(editor);
  }

  return editor.chain().focus().splitBlock().run();
}

export function backspaceTimelineItem(editor: Editor): boolean {
  const timelineItemDepth = findTimelineItemDepth(editor.state);
  if (timelineItemDepth === null) return false;

  const { $from, empty } = editor.state.selection;
  if (!empty) return false;

  const atStartOfBlock = $from.parentOffset === 0;
  const inFirstBlock = $from.index(timelineItemDepth) === 0;
  const blockIsEmpty = $from.parent.content.size === 0;

  if (atStartOfBlock && inFirstBlock && blockIsEmpty) {
    return removeTimelineItem(editor);
  }

  return false;
}

export function createTimelineBlockContent() {
  return {
    type: 'timeline',
    content: [
      {
        type: 'timelineItem',
        attrs: { title: '', date: '' },
        content: [{ type: 'paragraph' }],
      },
    ],
  };
}

export function createGalleryBlockContent(imageSrc: string, alt = '') {
  return {
    type: 'gallery',
    attrs: { layout: 'grid' },
    content: [
      { type: 'image', attrs: { src: imageSrc, alt, width: '100%' } },
    ],
  };
}

export function createButtonBlockContent(label = 'Learn more', href = 'https://') {
  return {
    type: 'button',
    attrs: { label, href, variant: 'primary' },
  };
}

export function createSpacerBlockContent(height = 48) {
  return {
    type: 'spacer',
    attrs: { height },
  };
}

export function createAudioBlockContent(src: string, title = '', info = '') {
  return {
    type: 'audio',
    attrs: { src, title, info, controls: true },
  };
}

export function createEmbedBlockContent(values: MediaInsertValues) {
  return {
    type: 'embed',
    attrs: {
      src: values.url.trim(),
      title: values.title.trim() || 'Embedded content',
      info: values.info.trim(),
      height: 360,
    },
  };
}

export function createFileBlockContent(label: string, href: string, fileName = '', info = '') {
  return {
    type: 'file',
    attrs: { label, href, fileName, info },
  };
}

export function createFileBlockContentFromValues(values: MediaInsertValues) {
  const url = values.url.trim();
  const fileName = url.split('/').filter(Boolean).pop() || '';
  return createFileBlockContent(
    values.title.trim() || 'Download file',
    url,
    fileName,
    values.info.trim(),
  );
}

export function insertMediaBlock(editor: Editor, type: MediaInsertBlockType, values: MediaInsertValues) {
  if (!values.url.trim()) return;

  switch (type) {
    case 'audio':
      editor.chain().focus().setAudio({
        src: values.url.trim(),
        title: values.title.trim(),
        info: values.info.trim(),
        controls: true,
      }).run();
      break;
    case 'file':
      editor.chain().focus().insertContent(createFileBlockContentFromValues(values)).run();
      break;
    case 'embed':
      editor.chain().focus().insertContent(createEmbedBlockContent(values)).run();
      break;
    default:
      break;
  }
}

export function createTabsBlockContent() {
  return {
    type: 'tabs',
    content: [
      { type: 'tabItem', attrs: { label: 'Tab 1' }, content: [{ type: 'paragraph' }] },
      { type: 'tabItem', attrs: { label: 'Tab 2' }, content: [{ type: 'paragraph' }] },
    ],
  };
}

export function createColumnsBlockContent(columnCount = 2) {
  const count = Math.min(Math.max(columnCount, 2), 3);
  return {
    type: 'columns',
    attrs: { columnCount: count },
    content: Array.from({ length: count }, () => ({
      type: 'column',
      content: [{ type: 'paragraph' }],
    })),
  };
}

export function createSectionBlockContent(variant = 'default') {
  return {
    type: 'section',
    attrs: { variant },
    content: [{ type: 'paragraph' }],
  };
}

export function createTocBlockContent() {
  return {
    type: 'toc',
    attrs: { title: 'On this page', minLevel: 2, maxLevel: 3 },
  };
}

export function createFormBlockContent() {
  return {
    type: 'form',
    attrs: {
      title: 'Contact us',
      description: 'Send us a message and we will get back to you.',
      submitLabel: 'Submit',
      showMessageField: true,
    },
  };
}

export function createSocialBlockContent() {
  return {
    type: 'social',
    attrs: {
      twitter: '',
      linkedin: '',
      facebook: '',
      instagram: '',
      youtube: '',
    },
  };
}

export function createRatingBlockContent() {
  return {
    type: 'rating',
    attrs: { value: 4.5, max: 5, label: 'Customer rating' },
  };
}

export function createProgressBlockContent() {
  return {
    type: 'progress',
    attrs: { value: 65, label: 'Progress' },
  };
}

export function createHeroBlockContent() {
  return {
    type: 'hero',
    attrs: {
      title: 'Hero title',
      subtitle: 'Add a compelling subtitle for this section.',
      imageUrl: '',
      buttonLabel: 'Get started',
      buttonHref: 'https://',
    },
  };
}

export function createNewsletterSignupBlockContent() {
  return {
    type: 'newsletterSignup',
    attrs: {
      title: 'Subscribe to our newsletter',
      description: 'Get the latest updates delivered to your inbox.',
      placeholder: 'Enter your email',
      buttonLabel: 'Subscribe',
    },
  };
}

export function insertTableBlock(editor: Editor, rows = 3, cols = 3): boolean {
  return editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
}

export function createStepsBlockContent() {
  return {
    type: 'steps',
    attrs: { orientation: 'vertical', titleLayout: 'inline', headerAlign: 'start', contentAlign: 'start' },
    content: [{ type: 'step', attrs: { title: 'Step 1' }, content: [{ type: 'paragraph' }] }],
  };
}

export function createFaqBlockContent() {
  return {
    type: 'faq',
    content: [{ type: 'faqItem', attrs: { question: 'Question?' }, content: [{ type: 'paragraph' }] }],
  };
}

export function createRelatedArticlesBlockContent() {
  return {
    type: 'relatedArticles',
    attrs: {
      title: 'Related articles',
      items: [],
    },
  };
}

export function createCalloutBlockContent(variant = 'info') {
  return {
    type: 'callout',
    attrs: { variant },
    content: [{ type: 'paragraph' }],
  };
}

function findTableDepth(editor: Editor): number | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') return depth;
  }
  return null;
}

export function addTableRow(editor: Editor) {
  return editor.chain().focus().addRowAfter().run();
}

export function addTableColumn(editor: Editor) {
  return editor.chain().focus().addColumnAfter().run();
}

export function setTableHeaderRow(editor: Editor, enabled: boolean) {
  const hasHeader = tableHasHeaderRow(editor);
  if (hasHeader === enabled) return true;
  return editor.chain().focus().toggleHeaderRow().run();
}

export function tableHasHeaderRow(editor: Editor): boolean {
  const depth = findTableDepth(editor);
  if (depth === null) return false;
  const table = editor.state.selection.$from.node(depth);
  const firstRow = table.firstChild;
  if (!firstRow) return false;
  for (let i = 0; i < firstRow.childCount; i += 1) {
    if (firstRow.child(i).type.name === 'tableHeader') return true;
  }
  return false;
}

export function getTableDimensions(editor: Editor): { rows: number; cols: number } {
  const depth = findTableDepth(editor);
  if (depth === null) return { rows: 0, cols: 0 };
  const table = editor.state.selection.$from.node(depth);
  return { rows: table.childCount, cols: table.firstChild?.childCount || 0 };
}

export function deleteTable(editor: Editor): boolean {
  return editor.chain().focus().deleteTable().run();
}

export function deleteTableRow(editor: Editor): boolean {
  return editor.chain().focus().deleteRow().run();
}

export function deleteTableColumn(editor: Editor): boolean {
  return editor.chain().focus().deleteColumn().run();
}

export function addFaqItem(editor: Editor) {
  return editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'faq') continue;
        const faq = $from.node(depth);
        const faqPos = $from.before(depth);
        const paragraphType = schemaNode(state, 'paragraph');
        const faqItemType = schemaNode(state, 'faqItem');
        if (!paragraphType || !faqItemType) return false;
        const paragraph = paragraphType.create();
        const item = faqItemType.create(
          { question: 'New question?' },
          paragraph,
        );
        const insertPos = faqPos + faq.nodeSize - 1;
        if (dispatch) tr.insert(insertPos, item);
        return true;
      }
      return false;
    })
    .run();
}

export function removeFaqItem(editor: Editor) {
  return editor
    .chain()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'faqItem') continue;
        for (let faqDepth = depth - 1; faqDepth > 0; faqDepth -= 1) {
          if ($from.node(faqDepth).type.name !== 'faq') continue;
          const faq = $from.node(faqDepth);
          const faqPos = $from.before(faqDepth);
          if (faq.childCount <= 1) {
            if (dispatch) tr.delete(faqPos, faqPos + faq.nodeSize);
            return true;
          }
          const itemPos = $from.before(depth);
          const item = $from.node(depth);
          if (dispatch) {
            tr.delete(itemPos, itemPos + item.nodeSize);
          }
          return true;
        }
      }
      return false;
    })
    .focus()
    .run();
}

export function deleteFaq(editor: Editor) {
  return editor
    .chain()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'faq') continue;
        const faqPos = $from.before(depth);
        const faq = $from.node(depth);
        if (dispatch) tr.delete(faqPos, faqPos + faq.nodeSize);
        return true;
      }
      return false;
    })
    .focus()
    .run();
}

export function removeStep(editor: Editor) {
  return editor
    .chain()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'step') continue;
        for (let stepsDepth = depth - 1; stepsDepth > 0; stepsDepth -= 1) {
          if ($from.node(stepsDepth).type.name !== 'steps') continue;
          const steps = $from.node(stepsDepth);
          const stepsPos = $from.before(stepsDepth);
          if (steps.childCount <= 1) {
            if (dispatch) tr.delete(stepsPos, stepsPos + steps.nodeSize);
            return true;
          }
          const itemPos = $from.before(depth);
          const item = $from.node(depth);
          if (dispatch) {
            tr.delete(itemPos, itemPos + item.nodeSize);
          }
          return true;
        }
      }
      return false;
    })
    .focus()
    .run();
}

export function deleteSteps(editor: Editor) {
  return editor
    .chain()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'steps') continue;
        const stepsPos = $from.before(depth);
        const steps = $from.node(depth);
        if (dispatch) tr.delete(stepsPos, stepsPos + steps.nodeSize);
        return true;
      }
      return false;
    })
    .focus()
    .run();
}

export function addStep(editor: Editor) {
  return editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'steps') continue;
        const steps = $from.node(depth);
        const stepsPos = $from.before(depth);
        const paragraphType = schemaNode(state, 'paragraph');
        const stepType = schemaNode(state, 'step');
        if (!paragraphType || !stepType) return false;
        const paragraph = paragraphType.create();
        const step = stepType.create(
          { title: `Step ${steps.childCount + 1}` },
          paragraph,
        );
        const insertPos = stepsPos + steps.nodeSize - 1;
        if (dispatch) tr.insert(insertPos, step);
        return true;
      }
      return false;
    })
    .run();
}

export function addTimelineItem(editor: Editor) {
  return editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      let timelineDepth: number | null = null;
      let timelineItemDepth: number | null = null;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const name = $from.node(depth).type.name;
        if (name === 'timelineItem' && timelineItemDepth === null) timelineItemDepth = depth;
        if (name === 'timeline') timelineDepth = depth;
      }
      if (timelineDepth === null) return false;

      const timeline = $from.node(timelineDepth);
      const timelinePos = $from.before(timelineDepth);
      const paragraphType = schemaNode(state, 'paragraph');
      const timelineItemType = schemaNode(state, 'timelineItem');
      if (!paragraphType || !timelineItemType) return false;
      const paragraph = paragraphType.create();
      const item = timelineItemType.create(
        { title: '', date: '' },
        paragraph,
      );

      const insertPos = timelineItemDepth !== null
        ? $from.after(timelineItemDepth)
        : timelinePos + timeline.nodeSize - 1;

      if (dispatch) {
        tr.insert(insertPos, item);
        tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 2)));
      }
      return true;
    })
    .run();
}

export function addTabItem(editor: Editor) {
  return editor
    .chain()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'tabs') continue;
        const tabs = $from.node(depth);
        const tabsPos = $from.before(depth);
        const paragraphType = schemaNode(state, 'paragraph');
        const tabItemType = schemaNode(state, 'tabItem');
        if (!paragraphType || !tabItemType) return false;
        const paragraph = paragraphType.create();
        const item = tabItemType.create(
          { label: `Tab ${tabs.childCount + 1}` },
          paragraph,
        );
        const insertPos = tabsPos + tabs.nodeSize - 1;
        if (dispatch) {
          tr.insert(insertPos, item);
          tr.setMeta(CONTENT_STUDIO_ADD_TAB_META, true);
        }
        return true;
      }
      return false;
    })
    .focus()
    .run();
}

export function removeTabItem(editor: Editor) {
  return editor
    .chain()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'tabItem') continue;
        for (let tabsDepth = depth - 1; tabsDepth > 0; tabsDepth -= 1) {
          if ($from.node(tabsDepth).type.name !== 'tabs') continue;
          const tabs = $from.node(tabsDepth);
          const tabsPos = $from.before(tabsDepth);
          if (tabs.childCount <= 1) {
            if (dispatch) tr.delete(tabsPos, tabsPos + tabs.nodeSize);
            return true;
          }
          const tabItemPos = $from.before(depth);
          const tabItem = $from.node(depth);
          if (dispatch) {
            tr.delete(tabItemPos, tabItemPos + tabItem.nodeSize);
          }
          return true;
        }
      }
      return false;
    })
    .focus()
    .run();
}

export function removeTimelineItem(editor: Editor) {
  return editor
    .chain()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'timelineItem') continue;
        for (let timelineDepth = depth - 1; timelineDepth > 0; timelineDepth -= 1) {
          if ($from.node(timelineDepth).type.name !== 'timeline') continue;
          const timeline = $from.node(timelineDepth);
          const timelinePos = $from.before(timelineDepth);
          if (timeline.childCount <= 1) {
            if (dispatch) tr.delete(timelinePos, timelinePos + timeline.nodeSize);
            return true;
          }
          const itemPos = $from.before(depth);
          const item = $from.node(depth);
          if (dispatch) {
            tr.delete(itemPos, itemPos + item.nodeSize);
          }
          return true;
        }
      }
      return false;
    })
    .focus()
    .run();
}

export function addColumn(editor: Editor) {
  return editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name !== 'columns') continue;
        const columns = $from.node(depth);
        if (columns.childCount >= 3) return false;
        const columnsPos = $from.before(depth);
        const paragraphType = schemaNode(state, 'paragraph');
        const columnType = schemaNode(state, 'column');
        if (!paragraphType || !columnType) return false;
        const paragraph = paragraphType.create();
        const column = columnType.create(null, paragraph);
        const insertPos = columnsPos + columns.nodeSize - 1;
        if (dispatch) {
          tr.insert(insertPos, column);
          tr.setNodeMarkup(columnsPos, undefined, { ...columns.attrs, columnCount: columns.childCount + 1 });
        }
        return true;
      }
      return false;
    })
    .run();
}

function findGalleryDepth(state: Editor['state']): number | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'gallery') return depth;
  }
  return null;
}

export function isEditorInGallery(editor: Editor): boolean {
  return findGalleryDepth(editor.state) !== null;
}

export function getGalleryImageCount(editor: Editor): number {
  const depth = findGalleryDepth(editor.state);
  if (depth === null) return 0;
  return editor.state.selection.$from.node(depth).childCount;
}

export function addGalleryImage(editor: Editor, imageSrc: string, alt = '') {
  return editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      const depth = findGalleryDepth(state);
      if (depth === null) return false;
      const gallery = state.selection.$from.node(depth);
      const galleryPos = state.selection.$from.before(depth);
      const imageType = schemaNode(state, 'image');
      if (!imageType) return false;
      const image = imageType.create({ src: imageSrc, alt, width: '100%' });
      const insertPos = galleryPos + gallery.nodeSize - 1;
      if (dispatch) tr.insert(insertPos, image);
      return true;
    })
    .run();
}

export function replaceGalleryImage(editor: Editor, imageSrc: string, alt = '') {
  if (!editor.isActive('image') || !isEditorInGallery(editor)) return false;
  return editor.chain().focus().updateAttributes('image', { src: imageSrc, alt, width: '100%' }).run();
}

export function removeGalleryImage(editor: Editor) {
  return editor
    .chain()
    .command(({ tr, state, dispatch }) => {
      const { $from } = state.selection;
      let galleryDepth: number | null = null;
      let imageDepth: number | null = null;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const name = $from.node(depth).type.name;
        if (name === 'image' && imageDepth === null) imageDepth = depth;
        if (name === 'gallery') galleryDepth = depth;
      }
      if (galleryDepth === null || imageDepth === null) return false;

      const gallery = $from.node(galleryDepth);
      const galleryPos = $from.before(galleryDepth);
      if (gallery.childCount <= 1) {
        if (dispatch) tr.delete(galleryPos, galleryPos + gallery.nodeSize);
        return true;
      }
      const imagePos = $from.before(imageDepth);
      const image = $from.node(imageDepth);
      if (dispatch) tr.delete(imagePos, imagePos + image.nodeSize);
      return true;
    })
    .focus()
    .run();
}
