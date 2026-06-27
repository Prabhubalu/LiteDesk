import grapesjs, { type Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import '../styles/grapesBuilderTheme.css';
import { configurePanels } from './panels';
import { applyHeadlessEditor } from './headless';
import { registerArivuBlocks } from './blocks';
import { registerCommands } from './commands';
import { registerTraits } from './traits';
import { setupExternalBlockDrop } from './dragDrop';
import { resolveEditorPlugins } from './plugins';
import { GRAPES_CANVAS_FRAME_CSS } from './canvasFrameCss';
import { configureComponentToolbar } from './componentActions';
import { applyPageDimensions, parseDimensionPx, setupPageLayout } from './pageDimensions';
import { registerLineItemComponent } from './lineItemComponent';

export interface GrapesEditorOptions {
  height?: string;
  width?: string;
  outputFormat?: string;
  canvasWidth?: string;
  canvasHeight?: string;
}

export function initGrapesEditor(container: HTMLElement, options: GrapesEditorOptions = {}): Editor {
  const outputFormat = options.outputFormat || 'pdf';
  const { plugins, pluginsOpts } = resolveEditorPlugins(outputFormat);

  const editor = grapesjs.init({
    container,
    height: options.height ?? '100%',
    width: options.width ?? 'auto',
    storageManager: false,
    noticeOnUnload: false,
    showDevices: false,
    ...configurePanels(),
    blockManager: { custom: true },
    layerManager: { custom: true },
    styleManager: { custom: true },
    selectorManager: { custom: true },
    traitManager: { custom: true },
    plugins,
    pluginsOpts,
    canvasCss: GRAPES_CANVAS_FRAME_CSS,
    canvas: {
      styles: [],
      allowExternalDrop: true
    },
    deviceManager: {
      devices: [
        { name: 'Desktop', width: '' },
        { name: 'Tablet', width: '768px', widthMedia: '992px' },
        { name: 'Mobile', width: '375px', widthMedia: '480px' }
      ]
    }
  });

  applyHeadlessEditor(editor);
  setupPageLayout(editor);
  configureComponentToolbar(editor);
  registerArivuBlocks(editor);
  registerLineItemComponent(editor);
  registerCommands(editor);
  registerTraits(editor);
  setupExternalBlockDrop(editor);

  const pageWidth = parseDimensionPx(options.canvasWidth);
  const pageHeight = parseDimensionPx(options.canvasHeight);
  if (pageWidth && pageHeight) {
    editor.on('load', () => {
      applyPageDimensions(editor, {
        dimensions: { width: pageWidth, height: pageHeight }
      });
    });
  }

  if (options.canvasWidth) {
    editor.setDevice('Desktop');
  }

  return editor;
}

export type { Editor };
