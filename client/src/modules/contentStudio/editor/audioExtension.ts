import { Node, mergeAttributes, nodePasteRule } from '@tiptap/core';
import { AUDIO_URL_REGEX_GLOBAL, isValidAudioUrl, sanitizeAudioSrc } from '../utils/audioUrl';

export interface ContentStudioAudioOptions {
  addPasteHandler: boolean;
  allowBase64: boolean;
  autoplay: boolean;
  controls: boolean;
  loop: boolean;
  muted: boolean;
  preload: 'auto' | 'metadata' | 'none' | null;
  controlslist?: string;
  crossorigin?: '' | 'anonymous' | 'use-credentials';
  disableRemotePlayback: boolean;
  HTMLAttributes: Record<string, string | number | boolean | null | undefined>;
  inline: boolean;
}

type SetAudioOptions = {
  src: string;
  title?: string;
  info?: string;
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: 'auto' | 'metadata' | 'none' | null;
  controlslist?: string;
  crossorigin?: '' | 'anonymous' | 'use-credentials';
  disableremoteplayback?: boolean;
  HTMLAttributes?: Record<string, string | number | boolean | null | undefined>;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    audio: {
      setAudio: (options: SetAudioOptions) => ReturnType;
    };
  }
}

function readLegacyFigureAudio(element: Element): false | { src: string | null; title?: string; info?: string } {
  const audio = element.querySelector('audio');
  const src = audio?.getAttribute('src');
  if (!src) return false;
  const title = element.querySelector('.content-audio__title')?.textContent?.trim() || '';
  const info = element.querySelector('.content-audio__info')?.textContent?.trim() || '';
  return { src, title, info };
}

export const ContentStudioAudio = Node.create<ContentStudioAudioOptions>({
  name: 'audio',

  addOptions() {
    return {
      addPasteHandler: true,
      allowBase64: false,
      autoplay: false,
      controls: true,
      loop: false,
      muted: false,
      preload: 'metadata',
      controlslist: undefined,
      crossorigin: undefined,
      disableRemotePlayback: false,
      HTMLAttributes: {},
      inline: false,
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: '' },
      info: { default: '' },
      controls: { default: this.options.controls },
      autoplay: { default: this.options.autoplay },
      loop: { default: this.options.loop },
      muted: { default: this.options.muted },
      preload: { default: this.options.preload },
      controlslist: { default: this.options.controlslist },
      crossorigin: { default: this.options.crossorigin },
      disableremoteplayback: { default: this.options.disableRemotePlayback },
    };
  },

  parseHTML() {
    const audioTag = this.options.allowBase64 ? 'audio[src]' : 'audio[src]:not([src^="data:"])';

    return [
      { tag: audioTag },
      {
        tag: 'figure[data-content-audio], figure.content-audio-block',
        getAttrs: readLegacyFigureAudio,
      },
    ];
  },

  addCommands() {
    return {
      setAudio:
        (options) =>
        ({ commands }) => {
          if (!isValidAudioUrl(options.src, this.options.allowBase64)) {
            return false;
          }

          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) {
      return [];
    }

    return [
      nodePasteRule({
        find: AUDIO_URL_REGEX_GLOBAL,
        type: this.type,
        getAttributes: (match) => ({ src: match[0] }),
      }),
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const sanitizedSrc = sanitizeAudioSrc(
      typeof HTMLAttributes.src === 'string' ? HTMLAttributes.src : null,
      this.options.allowBase64,
    );

    const mergedAttributes = mergeAttributes(
      this.options.HTMLAttributes,
      {
        controls: this.options.controls,
        autoplay: this.options.autoplay,
        loop: this.options.loop,
        muted: this.options.muted,
        preload: this.options.preload,
        controlslist: this.options.controlslist,
        crossorigin: this.options.crossorigin,
        disableremoteplayback: this.options.disableRemotePlayback,
      },
      {
        ...HTMLAttributes,
        src: sanitizedSrc,
      },
    );

    const cleanedAttributes = Object.fromEntries(
      Object.entries(mergedAttributes).filter(
        ([, value]) => value !== null && value !== undefined && value !== false,
      ),
    );

    const title = String(HTMLAttributes.title || '').trim();
    const info = String(HTMLAttributes.info || '').trim();
    const audioNode: ['audio', Record<string, unknown>] = ['audio', cleanedAttributes];

    if (!title && !info) {
      return audioNode;
    }

    const figureContent: Array<['p', Record<string, string>, string] | ['audio', Record<string, unknown>]> = [];
    if (title) figureContent.push(['p', { class: 'content-audio__title' }, title]);
    figureContent.push(audioNode);
    if (info) figureContent.push(['p', { class: 'content-audio__info' }, info]);

    return [
      'figure',
      mergeAttributes(this.options.HTMLAttributes, { class: 'content-audio-block' }),
      ...figureContent,
    ];
  },
});
