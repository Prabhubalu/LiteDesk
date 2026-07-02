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
import { resolveCanvasFrameCss } from './canvasFrameCss';
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
    canvasCss: resolveCanvasFrameCss(outputFormat),
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
  const isEmail = outputFormat === 'email';
  setupPageLayout(editor, { isEmail });
  configureComponentToolbar(editor);
  registerArivuBlocks(editor);
  if (!isEmail) {
    registerLineItemComponent(editor);
  }
  registerCommands(editor);
  registerTraits(editor);
  setupExternalBlockDrop(editor);

  const pageWidth = parseDimensionPx(options.canvasWidth);
  const pageHeight = parseDimensionPx(options.canvasHeight);
  if (pageWidth && pageHeight) {
    editor.on('load', () => {
      applyPageDimensions(editor, {
        dimensions: { width: pageWidth, height: pageHeight },
        isEmail: outputFormat === 'email'
      });
    });
  }

  if (options.canvasWidth) {
    editor.setDevice('Desktop');
  }

  return editor;
}

export type { Editor };
