/** Shared presentation classes so canvas and preview render the same article chrome. */

import type { ContentStudioPresentation } from '../types/contentStudio';

type ContentStudioSubtitleSize = ContentStudioPresentation['subtitleSize'];
export type ContentStudioContentWidth = 'narrow' | 'standard' | 'wide';

export const CONTENT_STUDIO_DEFAULT_PRESENTATION: ContentStudioPresentation = {
  coverPosition: 'below-title',
  titleOverlapCover: false,
  subtitleSize: 'md',
  headingColor: '',
  subheadingColor: '',
};

export const DEFAULT_ARTICLE_HEADING_COLOR = '#111827';
export const DEFAULT_ARTICLE_SUBHEADING_COLOR = '#4b5563';
export const DEFAULT_ARTICLE_OVERLAP_HEADING_COLOR = '#ffffff';
export const DEFAULT_ARTICLE_OVERLAP_SUBHEADING_COLOR = 'rgba(255,255,255,0.9)';

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeArticleColor(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!HEX_COLOR_PATTERN.test(raw)) return '';
  const normalized = raw.toLowerCase();
  if (normalized.length === 4) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  return normalized;
}

export function resolveArticleChromeColors(
  presentation?: Partial<ContentStudioPresentation> | null,
  options?: { heroOverlap?: boolean },
) {
  const normalized = normalizeContentStudioPresentation(presentation);
  const headingFallback = options?.heroOverlap
    ? DEFAULT_ARTICLE_OVERLAP_HEADING_COLOR
    : DEFAULT_ARTICLE_HEADING_COLOR;
  const subheadingFallback = options?.heroOverlap
    ? DEFAULT_ARTICLE_OVERLAP_SUBHEADING_COLOR
    : DEFAULT_ARTICLE_SUBHEADING_COLOR;
  return {
    headingColor: normalizeArticleColor(normalized.headingColor) || headingFallback,
    subheadingColor: normalizeArticleColor(normalized.subheadingColor) || subheadingFallback,
  };
}

const SUBTITLE_SIZE_CLASSES: Record<ContentStudioSubtitleSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl',
};

const SUBTITLE_SIZE_OVERLAP_CLASSES: Record<ContentStudioSubtitleSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

export const CONTENT_STUDIO_CANVAS_WIDTH_CLASS: Record<ContentStudioContentWidth, string> = {
  narrow: 'max-w-[680px]',
  standard: 'max-w-[768px]',
  wide: 'max-w-[960px]',
};

export function resolveContentStudioCanvasWidthClass(
  contentWidth: ContentStudioContentWidth = 'standard',
  previewDevice = 'desktop',
): string {
  if (previewDevice === 'mobile') return 'max-w-[390px]';
  if (previewDevice === 'tablet') return 'max-w-[768px]';
  return CONTENT_STUDIO_CANVAS_WIDTH_CLASS[contentWidth] || CONTENT_STUDIO_CANVAS_WIDTH_CLASS.standard;
}

export function normalizeContentStudioContentWidth(value?: string | null): ContentStudioContentWidth {
  if (value === 'narrow' || value === 'wide') return value;
  return 'standard';
}

export function normalizeContentStudioPresentation(
  value?: Partial<ContentStudioPresentation> | null,
): ContentStudioPresentation {
  const coverPosition = value?.coverPosition === 'above-title' ? 'above-title' : 'below-title';
  const subtitleSize = value?.subtitleSize && SUBTITLE_SIZE_CLASSES[value.subtitleSize]
    ? value.subtitleSize
    : 'md';
  const titleOverlapCover = coverPosition === 'above-title' && Boolean(value?.titleOverlapCover);
  return {
    coverPosition,
    titleOverlapCover,
    subtitleSize,
    headingColor: normalizeArticleColor(value?.headingColor),
    subheadingColor: normalizeArticleColor(value?.subheadingColor),
  };
}

export function resolveArticleChromeLayout(presentation?: Partial<ContentStudioPresentation> | null) {
  const normalized = normalizeContentStudioPresentation(presentation);
  return {
    ...normalized,
    coverFirst: normalized.coverPosition === 'above-title',
    useHeroOverlap: normalized.titleOverlapCover,
  };
}

export function contentStudioSubtitleSizeClass(subtitleSize: ContentStudioSubtitleSize = 'md'): string {
  return SUBTITLE_SIZE_CLASSES[subtitleSize];
}

export function contentStudioSubtitleOverlapSizeClass(subtitleSize: ContentStudioSubtitleSize = 'md'): string {
  return SUBTITLE_SIZE_OVERLAP_CLASSES[subtitleSize];
}

export function contentStudioSubtitleEditClass(subtitleSize: ContentStudioSubtitleSize = 'md'): string {
  return `mt-3 w-full resize-none border-0 bg-transparent ${SUBTITLE_SIZE_CLASSES[subtitleSize]} text-neutral-600 outline-none placeholder:text-neutral-400 dark:text-neutral-300`;
}

export function contentStudioSubtitlePreviewClass(subtitleSize: ContentStudioSubtitleSize = 'md'): string {
  return `mt-3 w-full ${SUBTITLE_SIZE_CLASSES[subtitleSize]} text-neutral-600 dark:text-neutral-300`;
}

export function contentStudioSubtitleOverlapEditClass(subtitleSize: ContentStudioSubtitleSize = 'md'): string {
  return `mt-2 w-full resize-none border-0 bg-transparent ${SUBTITLE_SIZE_OVERLAP_CLASSES[subtitleSize]} text-white/90 outline-none placeholder:text-white/60`;
}

export function contentStudioSubtitleOverlapPreviewClass(subtitleSize: ContentStudioSubtitleSize = 'md'): string {
  return `mt-2 w-full ${SUBTITLE_SIZE_OVERLAP_CLASSES[subtitleSize]} text-white/90`;
}

export const CONTENT_STUDIO_TITLE_CLASS =
  'w-full border-0 bg-transparent text-4xl font-bold tracking-tight text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-50';

export const CONTENT_STUDIO_TITLE_OVERLAP_CLASS =
  'w-full border-0 bg-transparent text-4xl font-bold tracking-tight text-white outline-none placeholder:text-white/60 drop-shadow';

export const CONTENT_STUDIO_TITLE_PREVIEW_BASE_CLASS =
  'w-full text-4xl font-bold tracking-tight';

export const CONTENT_STUDIO_TITLE_PREVIEW_CLASS =
  `${CONTENT_STUDIO_TITLE_PREVIEW_BASE_CLASS} text-neutral-900 dark:text-neutral-50`;

export const CONTENT_STUDIO_TITLE_OVERLAP_PREVIEW_BASE_CLASS =
  'w-full text-4xl font-bold tracking-tight drop-shadow';

export const CONTENT_STUDIO_TITLE_OVERLAP_PREVIEW_CLASS =
  `${CONTENT_STUDIO_TITLE_OVERLAP_PREVIEW_BASE_CLASS} text-white`;

export const CONTENT_STUDIO_SUBTITLE_CLASS =
  'mt-3 w-full resize-none border-0 bg-transparent text-lg text-neutral-600 outline-none placeholder:text-neutral-400 dark:text-neutral-300';

export const CONTENT_STUDIO_SUBTITLE_PREVIEW_CLASS =
  'mt-3 w-full text-lg text-neutral-600 dark:text-neutral-300';

export const CONTENT_STUDIO_COVER_PLACEHOLDER_CLASS =
  'flex w-full items-center justify-center rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400';

export const CONTENT_STUDIO_META_ROW_CLASS =
  'mt-4 flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-5 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400';

export const CONTENT_STUDIO_EDITOR_PROSE_CLASS =
  'content-studio-editor mt-6 [&_.content-studio-tiptap_h1]:text-3xl [&_.content-studio-tiptap_h1]:font-bold [&_.content-studio-tiptap_h2]:text-2xl [&_.content-studio-tiptap_h2]:font-semibold [&_.content-studio-tiptap_h3]:text-xl [&_.content-studio-tiptap_h3]:font-semibold [&_.content-studio-tiptap_h4]:text-lg [&_.content-studio-tiptap_h4]:font-semibold [&_.content-studio-tiptap_p]:mb-4 [&_.content-studio-tiptap_p]:leading-7 [&_.content-studio-tiptap_li_p]:mb-0 [&_.content-studio-tiptap_li]:mb-1 [&_.content-studio-tiptap_li:last-child]:mb-0 [&_.content-studio-tiptap_ul]:mb-4 [&_.content-studio-tiptap_ul]:list-disc [&_.content-studio-tiptap_ul]:pl-6 [&_.content-studio-tiptap_li_ul]:mb-0 [&_.content-studio-tiptap_li_ul]:mt-1 [&_.content-studio-tiptap_ul_ul]:list-[circle] [&_.content-studio-tiptap_ul_ul_ul]:list-[square] [&_.content-studio-tiptap_ul.content-task-list]:list-none [&_.content-studio-tiptap_ul.content-task-list_ul]:list-none [&_.content-studio-tiptap_ol]:mb-4 [&_.content-studio-tiptap_ol]:list-decimal [&_.content-studio-tiptap_ol]:pl-6 [&_.content-studio-tiptap_li_ol]:mb-0 [&_.content-studio-tiptap_li_ol]:mt-1 [&_.content-studio-tiptap_ol_ol]:[list-style-type:lower-alpha] [&_.content-studio-tiptap_ol_ol_ol]:[list-style-type:lower-roman] [&_.content-studio-tiptap_ol_ol_ol_ol]:[list-style-type:decimal] [&_.content-studio-tiptap_.content-embed]:my-4 [&_.content-studio-tiptap_.content-embed_iframe]:w-full [&_.content-studio-tiptap_.content-embed--blocked]:rounded-xl [&_.content-studio-tiptap_.content-embed--blocked]:border [&_.content-studio-tiptap_.content-embed--blocked]:border-dashed [&_.content-studio-tiptap_.content-embed--blocked]:border-neutral-300 [&_.content-studio-tiptap_.content-embed--blocked]:bg-neutral-50 [&_.content-studio-tiptap_.content-embed--blocked]:px-4 [&_.content-studio-tiptap_.content-embed--blocked]:py-6 dark:[&_.content-studio-tiptap_.content-embed--blocked]:border-neutral-700 dark:[&_.content-studio-tiptap_.content-embed--blocked]:bg-neutral-900/40 [&_.content-studio-tiptap_.content-embed__fallback]:text-center [&_.content-studio-tiptap_.content-embed__fallback-link]:break-all [&_.content-studio-tiptap_.content-embed__fallback-link]:text-sm [&_.content-studio-tiptap_.content-embed__fallback-link]:font-medium [&_.content-studio-tiptap_.content-embed__fallback-link]:text-primary-700 dark:[&_.content-studio-tiptap_.content-embed__fallback-link]:text-primary-300 [&_.content-studio-tiptap_blockquote]:my-4 [&_.content-studio-tiptap_blockquote]:rounded-r-lg [&_.content-studio-tiptap_blockquote]:border-l-4 [&_.content-studio-tiptap_blockquote]:border-primary-300 [&_.content-studio-tiptap_blockquote]:bg-primary-50 [&_.content-studio-tiptap_blockquote]:px-4 [&_.content-studio-tiptap_blockquote]:py-3 [&_.content-studio-tiptap_blockquote]:text-primary-900 dark:[&_.content-studio-tiptap_blockquote]:border-primary-700 dark:[&_.content-studio-tiptap_blockquote]:bg-primary-950/40 dark:[&_.content-studio-tiptap_blockquote]:text-primary-100 [&_.content-studio-tiptap_.content-callout]:my-4 [&_.content-studio-tiptap_.content-callout]:rounded-lg [&_.content-studio-tiptap_.content-callout]:border [&_.content-studio-tiptap_.content-callout]:px-4 [&_.content-studio-tiptap_.content-callout]:py-3 [&_.content-studio-tiptap_.content-callout--info]:border-sky-300 [&_.content-studio-tiptap_.content-callout--info]:bg-sky-50 dark:[&_.content-studio-tiptap_.content-callout--info]:border-sky-700 dark:[&_.content-studio-tiptap_.content-callout--info]:bg-sky-950/40 [&_.content-studio-tiptap_.content-callout--tip]:border-emerald-300 [&_.content-studio-tiptap_.content-callout--tip]:bg-emerald-50 dark:[&_.content-studio-tiptap_.content-callout--tip]:border-emerald-700 dark:[&_.content-studio-tiptap_.content-callout--tip]:bg-emerald-950/40 [&_.content-studio-tiptap_.content-callout--warning]:border-amber-300 [&_.content-studio-tiptap_.content-callout--warning]:bg-amber-50 dark:[&_.content-studio-tiptap_.content-callout--warning]:border-amber-700 dark:[&_.content-studio-tiptap_.content-callout--warning]:bg-amber-950/40 [&_.content-studio-tiptap_.content-image-figure]:my-4 [&_.content-studio-tiptap_.content-image-figure]:max-w-full [&_.content-studio-tiptap_.content-image-figure_img]:block [&_.content-studio-tiptap_.content-image-figure_img]:w-full [&_.content-studio-tiptap_.content-image-figure_img]:max-w-full [&_.content-studio-tiptap_.content-image-figure_img]:cursor-pointer [&_.content-studio-tiptap_.content-image-figure:not(:has(.content-image-caption-input))_img]:rounded-xl [&_.content-studio-tiptap_.content-image-figure:has(.content-image-caption-input)_img]:rounded-t-xl [&_.content-studio-tiptap_.content-image-caption-input]:m-0 [&_.content-studio-tiptap_.content-image-caption-input]:w-full [&_.content-studio-tiptap_.content-image-caption-input]:border-0 [&_.content-studio-tiptap_.content-image-caption-input]:bg-neutral-100 [&_.content-studio-tiptap_.content-image-caption-input]:px-3 [&_.content-studio-tiptap_.content-image-caption-input]:py-2 [&_.content-studio-tiptap_.content-image-caption-input]:text-center [&_.content-studio-tiptap_.content-image-caption-input]:text-sm [&_.content-studio-tiptap_.content-image-caption-input]:text-neutral-600 [&_.content-studio-tiptap_.content-image-caption-input]:outline-none [&_.content-studio-tiptap_.content-image-caption-input]:ring-0 [&_.content-studio-tiptap_.content-image-caption-input]:placeholder:text-neutral-400 [&_.content-studio-tiptap_.content-image-caption-input]:rounded-b-xl [&_.content-studio-tiptap_.content-image-caption-input]:focus:outline-none [&_.content-studio-tiptap_.content-image-caption-input]:focus:ring-0 dark:[&_.content-studio-tiptap_.content-image-caption-input]:bg-neutral-800/50 dark:[&_.content-studio-tiptap_.content-image-caption-input]:text-neutral-300 [&_.content-studio-tiptap_.content-image-caption]:m-0 [&_.content-studio-tiptap_.content-image-caption]:border-0 [&_.content-studio-tiptap_.content-image-caption]:bg-neutral-100 [&_.content-studio-tiptap_.content-image-caption]:px-3 [&_.content-studio-tiptap_.content-image-caption]:py-2 [&_.content-studio-tiptap_.content-image-caption]:text-center [&_.content-studio-tiptap_.content-image-caption]:text-sm [&_.content-studio-tiptap_.content-image-caption]:leading-snug [&_.content-studio-tiptap_.content-image-caption]:text-neutral-600 [&_.content-studio-tiptap_.content-image-caption]:rounded-b-xl dark:[&_.content-studio-tiptap_.content-image-caption]:bg-neutral-800/50 dark:[&_.content-studio-tiptap_.content-image-caption]:text-neutral-300 [&_.content-studio-tiptap_hr]:my-8 [&_.content-studio-tiptap_hr]:border-neutral-200 dark:[&_.content-studio-tiptap_hr]:border-neutral-700 [&_.content-studio-tiptap_pre]:my-4 [&_.content-studio-tiptap_pre]:overflow-x-auto [&_.content-studio-tiptap_pre]:rounded-lg [&_.content-studio-tiptap_pre]:bg-neutral-100 [&_.content-studio-tiptap_pre]:p-4 dark:[&_.content-studio-tiptap_pre]:bg-neutral-900 [&_.content-studio-tiptap_table]:my-4 [&_.content-studio-tiptap]:[--default-cell-min-width:80px] [&_.tableWrapper]:my-4 [&_.tableWrapper_.column-resize-handle]:bg-primary-500/80 [&_.content-studio-tiptap_td]:border [&_.content-studio-tiptap_td]:border-neutral-200 [&_.content-studio-tiptap_td]:p-2 [&_.content-studio-tiptap_td]:min-w-[80px] [&_.content-studio-tiptap_td]:align-top [&_.content-studio-tiptap_th]:border [&_.content-studio-tiptap_th]:border-neutral-200 [&_.content-studio-tiptap_th]:bg-neutral-50 [&_.content-studio-tiptap_th]:p-2 [&_.content-studio-tiptap_th]:min-w-[80px] [&_.content-studio-tiptap_th]:align-top [&_.content-studio-tiptap_th]:font-semibold dark:[&_.content-studio-tiptap_td]:border-neutral-700 dark:[&_.content-studio-tiptap_th]:border-neutral-700 dark:[&_.content-studio-tiptap_th]:bg-neutral-800/60 [&_.content-block-width-wide]:mx-auto [&_.content-block-width-wide]:max-w-4xl [&_.content-block-width-full]:w-full [&_.content-block-width-full]:max-w-none [&_.content-image-figure[data-width="25%"]]:w-1/4 [&_.content-image-figure[data-width="50%"]]:w-1/2 [&_.content-image-figure[data-width="75%"]]:w-3/4 [&_.content-image-figure[data-width="100%"]]:w-full [&_.content-image-figure[data-text-wrap="wrap-left"]]:float-left [&_.content-image-figure[data-text-wrap="wrap-left"]]:mr-4 [&_.content-image-figure[data-text-wrap="wrap-left"]]:mb-2 [&_.content-image-figure[data-text-wrap="wrap-right"]]:float-right [&_.content-image-figure[data-text-wrap="wrap-right"]]:ml-4 [&_.content-image-figure[data-text-wrap="wrap-right"]]:mb-2 [&_.content-image-figure[data-text-wrap="block"][data-image-position="left"]]:ml-0 [&_.content-image-figure[data-text-wrap="block"][data-image-position="left"]]:mr-auto [&_.content-image-figure[data-text-wrap="block"][data-image-position="center"]]:mx-auto [&_.content-image-figure[data-text-wrap="block"][data-image-position="right"]]:ml-auto [&_.content-image-figure[data-text-wrap="block"][data-image-position="right"]]:mr-0 [&_.content-embed--width-small_iframe]:!w-1/2 [&_.content-embed--width-medium_iframe]:!w-[70%] [&_.content-embed--width-large_iframe]:!w-[85%] [&_.content-embed--width-full_iframe]:!w-full [&_.content-studio-tiptap_.content-spacer]:w-full [&_.content-studio-tiptap_.content-button]:my-4 [&_.content-studio-tiptap_.content-button__link]:inline-flex [&_.content-studio-tiptap_.content-button__link]:items-center [&_.content-studio-tiptap_.content-button__link]:rounded-lg [&_.content-studio-tiptap_.content-button__link]:px-4 [&_.content-studio-tiptap_.content-button__link]:py-2 [&_.content-studio-tiptap_.content-button__link]:text-sm [&_.content-studio-tiptap_.content-button__link]:font-medium [&_.content-studio-tiptap_.content-button__link--primary]:bg-primary-600 [&_.content-studio-tiptap_.content-button__link--primary]:text-white [&_.content-studio-tiptap_audio.content-audio]:my-4 [&_.content-studio-tiptap_audio.content-audio]:w-full [&_.content-studio-tiptap_audio.content-audio]:max-w-full [&_.content-studio-tiptap_.content-audio-block]:my-4 [&_.content-studio-tiptap_.content-audio__title]:mb-2 [&_.content-studio-tiptap_.content-audio__title]:text-sm [&_.content-studio-tiptap_.content-audio__title]:font-semibold [&_.content-studio-tiptap_.content-audio__info]:mt-2 [&_.content-studio-tiptap_.content-audio__info]:text-sm [&_.content-studio-tiptap_.content-audio__info]:text-neutral-600 dark:[&_.content-studio-tiptap_.content-audio__info]:text-neutral-300 [&_.content-studio-tiptap_.content-file-block]:my-4 [&_.content-studio-tiptap_.content-file__info]:mt-2 [&_.content-studio-tiptap_.content-file__info]:text-sm [&_.content-studio-tiptap_.content-file__info]:text-neutral-600 dark:[&_.content-studio-tiptap_.content-file__info]:text-neutral-300 [&_.content-studio-tiptap_.content-embed__info]:mt-2 [&_.content-studio-tiptap_.content-embed__info]:text-sm [&_.content-studio-tiptap_.content-embed__info]:text-neutral-600 dark:[&_.content-studio-tiptap_.content-embed__info]:text-neutral-300 [&_.content-studio-tiptap_.content-file]:my-4 [&_.content-studio-tiptap_.content-file]:inline-flex [&_.content-studio-tiptap_.content-file]:items-center [&_.content-studio-tiptap_.content-file]:rounded-lg [&_.content-studio-tiptap_.content-file]:border [&_.content-studio-tiptap_.content-file]:border-neutral-200 [&_.content-studio-tiptap_.content-file]:px-4 [&_.content-studio-tiptap_.content-file]:py-2 [&_.content-studio-tiptap_.content-file]:text-sm [&_.content-studio-tiptap_.content-file]:font-medium [&_.content-studio-tiptap_.content-file]:text-primary-700 dark:[&_.content-studio-tiptap_.content-file]:border-neutral-700 dark:[&_.content-studio-tiptap_.content-file]:text-primary-300 [&_.content-studio-tiptap_.content-timeline]:my-4 [&_.content-studio-tiptap_.content-timeline]:list-none [&_.content-studio-tiptap_.content-timeline]:space-y-4 [&_.content-studio-tiptap_.content-timeline]:border-l-2 [&_.content-studio-tiptap_.content-timeline]:border-neutral-200 [&_.content-studio-tiptap_.content-timeline]:pl-4 dark:[&_.content-studio-tiptap_.content-timeline]:border-neutral-700 [&_.content-studio-tiptap_.content-timeline-item]:relative [&_.content-studio-tiptap_.content-timeline-item]:pl-2 [&_.content-studio-tiptap_.content-timeline-item]:before:absolute [&_.content-studio-tiptap_.content-timeline-item]:before:-left-[1.35rem] [&_.content-studio-tiptap_.content-timeline-item]:before:top-1 [&_.content-studio-tiptap_.content-timeline-item]:before:h-2.5 [&_.content-studio-tiptap_.content-timeline-item]:before:w-2.5 [&_.content-studio-tiptap_.content-timeline-item]:before:rounded-full [&_.content-studio-tiptap_.content-timeline-item]:before:bg-primary-500 [&_.content-studio-tiptap_.content-timeline-item__date]:ml-2 [&_.content-studio-tiptap_.content-timeline-item__date]:text-xs [&_.content-studio-tiptap_.content-timeline-item__date]:text-neutral-500 [&_.content-studio-tiptap_.content-columns]:my-4 [&_.content-studio-tiptap_.content-columns]:grid [&_.content-studio-tiptap_.content-columns]:gap-4 [&_.content-studio-tiptap_.content-columns--2]:grid-cols-2 [&_.content-studio-tiptap_.content-columns--3]:grid-cols-3 [&_.content-studio-tiptap_.content-column]:min-w-0 [&_.content-studio-tiptap_.content-section]:my-4 [&_.content-studio-tiptap_.content-section]:rounded-xl [&_.content-studio-tiptap_.content-section]:p-4 [&_.content-studio-tiptap_.content-section--muted]:bg-neutral-100 dark:[&_.content-studio-tiptap_.content-section--muted]:bg-neutral-800/50 [&_.content-studio-tiptap_.content-section--highlight]:bg-primary-50 dark:[&_.content-studio-tiptap_.content-section--highlight]:bg-primary-950/30 [&_.content-studio-tiptap_.content-toc]:my-4 [&_.content-studio-tiptap_.content-toc]:rounded-lg [&_.content-studio-tiptap_.content-toc]:border [&_.content-studio-tiptap_.content-toc]:border-neutral-200 [&_.content-studio-tiptap_.content-toc]:p-4 dark:[&_.content-studio-tiptap_.content-toc]:border-neutral-700 [&_.content-studio-tiptap_.content-toc__title]:mb-2 [&_.content-studio-tiptap_.content-toc__title]:text-sm [&_.content-studio-tiptap_.content-toc__title]:font-semibold [&_.content-studio-tiptap_.content-toc__list]:list-decimal [&_.content-studio-tiptap_.content-toc__list]:space-y-1 [&_.content-studio-tiptap_.content-toc__list]:pl-5 [&_.content-studio-tiptap_.content-form]:my-4 [&_.content-studio-tiptap_.content-form]:rounded-xl [&_.content-studio-tiptap_.content-form]:border [&_.content-studio-tiptap_.content-form]:border-neutral-200 [&_.content-studio-tiptap_.content-form]:p-4 dark:[&_.content-studio-tiptap_.content-form]:border-neutral-700 [&_.content-studio-tiptap_.content-form__field]:mt-3 [&_.content-studio-tiptap_.content-form__field]:block [&_.content-studio-tiptap_.content-form__field]:text-sm [&_.content-studio-tiptap_.content-form__field_input]:mt-1 [&_.content-studio-tiptap_.content-form__field_input]:w-full [&_.content-studio-tiptap_.content-form__field_textarea]:mt-1 [&_.content-studio-tiptap_.content-form__field_textarea]:w-full [&_.content-studio-tiptap_.content-form__submit]:mt-4 [&_.content-studio-tiptap_.content-form__submit]:rounded-lg [&_.content-studio-tiptap_.content-form__submit]:bg-primary-600 [&_.content-studio-tiptap_.content-form__submit]:px-4 [&_.content-studio-tiptap_.content-form__submit]:py-2 [&_.content-studio-tiptap_.content-form__submit]:text-sm [&_.content-studio-tiptap_.content-form__submit]:text-white [&_.content-studio-tiptap_.content-social]:my-4 [&_.content-studio-tiptap_.content-social]:flex [&_.content-studio-tiptap_.content-social]:flex-wrap [&_.content-studio-tiptap_.content-social]:gap-2 [&_.content-studio-tiptap_.content-social__link]:rounded-full [&_.content-studio-tiptap_.content-social__link]:border [&_.content-studio-tiptap_.content-social__link]:border-neutral-200 [&_.content-studio-tiptap_.content-social__link]:px-3 [&_.content-studio-tiptap_.content-social__link]:py-1 [&_.content-studio-tiptap_.content-social__link]:text-xs [&_.content-studio-tiptap_.content-social__link]:font-medium dark:[&_.content-studio-tiptap_.content-social__link]:border-neutral-700 [&_.content-studio-tiptap_.content-rating]:my-4 [&_.content-studio-tiptap_.content-rating]:rounded-lg [&_.content-studio-tiptap_.content-rating]:border [&_.content-studio-tiptap_.content-rating]:border-neutral-200 [&_.content-studio-tiptap_.content-rating]:px-4 [&_.content-studio-tiptap_.content-rating]:py-3 dark:[&_.content-studio-tiptap_.content-rating]:border-neutral-700 [&_.content-studio-tiptap_.content-rating__value]:ml-2 [&_.content-studio-tiptap_.content-rating__value]:text-sm [&_.content-studio-tiptap_.content-rating__value]:text-neutral-600 dark:[&_.content-studio-tiptap_.content-rating__value]:text-neutral-300 [&_.content-studio-tiptap_.content-progress]:my-4 [&_.content-studio-tiptap_.content-progress__header]:mb-2 [&_.content-studio-tiptap_.content-progress__header]:flex [&_.content-studio-tiptap_.content-progress__header]:justify-between [&_.content-studio-tiptap_.content-progress__header]:text-sm [&_.content-studio-tiptap_.content-progress__track]:h-2 [&_.content-studio-tiptap_.content-progress__track]:overflow-hidden [&_.content-studio-tiptap_.content-progress__track]:rounded-full [&_.content-studio-tiptap_.content-progress__track]:bg-neutral-200 dark:[&_.content-studio-tiptap_.content-progress__track]:bg-neutral-700 [&_.content-studio-tiptap_.content-progress__bar]:h-full [&_.content-studio-tiptap_.content-progress__bar]:rounded-full [&_.content-studio-tiptap_.content-progress__bar]:bg-primary-600 [&_.content-studio-tiptap_.content-hero]:relative [&_.content-studio-tiptap_.content-hero]:my-4 [&_.content-studio-tiptap_.content-hero]:overflow-hidden [&_.content-studio-tiptap_.content-hero]:rounded-xl [&_.content-studio-tiptap_.content-hero__image]:h-48 [&_.content-studio-tiptap_.content-hero__image]:w-full [&_.content-studio-tiptap_.content-hero__image]:object-cover [&_.content-studio-tiptap_.content-hero__content]:p-6 [&_.content-studio-tiptap_.content-hero__title]:text-2xl [&_.content-studio-tiptap_.content-hero__title]:font-bold [&_.content-studio-tiptap_.content-hero__subtitle]:mt-2 [&_.content-studio-tiptap_.content-hero__subtitle]:text-neutral-600 dark:[&_.content-studio-tiptap_.content-hero__subtitle]:text-neutral-300 [&_.content-studio-tiptap_.content-hero__button]:mt-4 [&_.content-studio-tiptap_.content-hero__button]:inline-flex [&_.content-studio-tiptap_.content-hero__button]:rounded-lg [&_.content-studio-tiptap_.content-hero__button]:bg-primary-600 [&_.content-studio-tiptap_.content-hero__button]:px-4 [&_.content-studio-tiptap_.content-hero__button]:py-2 [&_.content-studio-tiptap_.content-hero__button]:text-sm [&_.content-studio-tiptap_.content-hero__button]:font-medium [&_.content-studio-tiptap_.content-hero__button]:text-white [&_.content-studio-tiptap_.content-newsletter]:my-4 [&_.content-studio-tiptap_.content-newsletter]:rounded-xl [&_.content-studio-tiptap_.content-newsletter]:border [&_.content-studio-tiptap_.content-newsletter]:border-neutral-200 [&_.content-studio-tiptap_.content-newsletter]:p-4 dark:[&_.content-studio-tiptap_.content-newsletter]:border-neutral-700 [&_.content-studio-tiptap_.content-newsletter__form]:mt-3 [&_.content-studio-tiptap_.content-newsletter__form]:flex [&_.content-studio-tiptap_.content-newsletter__form]:gap-2 [&_.content-studio-tiptap_.content-newsletter__form_input]:min-w-0 [&_.content-studio-tiptap_.content-newsletter__form_input]:flex-1 [&_.content-studio-tiptap_.content-newsletter__form_input]:rounded-lg [&_.content-studio-tiptap_.content-newsletter__form_input]:border [&_.content-studio-tiptap_.content-newsletter__form_input]:border-neutral-200 [&_.content-studio-tiptap_.content-newsletter__form_input]:px-3 [&_.content-studio-tiptap_.content-newsletter__form_input]:py-2 dark:[&_.content-studio-tiptap_.content-newsletter__form_input]:border-neutral-700 [&_.content-studio-tiptap_.content-newsletter__form_button]:rounded-lg [&_.content-studio-tiptap_.content-newsletter__form_button]:bg-primary-600 [&_.content-studio-tiptap_.content-newsletter__form_button]:px-4 [&_.content-studio-tiptap_.content-newsletter__form_button]:py-2 [&_.content-studio-tiptap_.content-newsletter__form_button]:text-sm [&_.content-studio-tiptap_.content-newsletter__form_button]:text-white';
