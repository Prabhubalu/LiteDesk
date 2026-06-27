import type { Editor, Plugin } from 'grapesjs';
import basicBlocks from 'grapesjs-blocks-basic';
import webpagePreset from 'grapesjs-preset-webpage';
import newsletterPreset from 'grapesjs-preset-newsletter';

export type TemplateOutputFormat = 'pdf' | 'email' | 'html' | string;

export interface EditorPluginConfig {
  plugins: Plugin[];
  pluginsOpts: Record<string, Record<string, unknown>>;
}

const BASIC_BLOCKS_OPTS = {
  flexGrid: true,
  addBasicStyle: false,
  category: 'Basic',
  rowHeight: 75
} as const;

const basicBlocksPlugin: Plugin = (editor: Editor) => {
  basicBlocks(editor, { ...BASIC_BLOCKS_OPTS });
};

const webpagePresetPlugin: Plugin = (editor: Editor) => {
  webpagePreset(editor, {
    useCustomTheme: false,
    showStylesOnChange: false
  });
};

const newsletterPresetPlugin: Plugin = (editor: Editor) => {
  newsletterPreset(editor, {
    showBlocksOnLoad: false,
    showStylesOnChange: false,
    useCustomTheme: false
  });
};

export function resolveEditorPlugins(outputFormat: TemplateOutputFormat = 'pdf'): EditorPluginConfig {
  const isEmail = outputFormat === 'email';

  if (isEmail) {
    return {
      plugins: [newsletterPresetPlugin],
      pluginsOpts: {}
    };
  }

  return {
    plugins: [basicBlocksPlugin, webpagePresetPlugin],
    pluginsOpts: {}
  };
}
