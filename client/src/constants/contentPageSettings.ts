/** Standard page dimensions in millimeters (portrait: width × height). */
export const PAPER_DIMENSIONS_MM = {
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
  A7: { width: 74, height: 105 },
  A8: { width: 52, height: 74 },
  B0: { width: 1000, height: 1414 },
  B1: { width: 707, height: 1000 },
  B2: { width: 500, height: 707 },
  B3: { width: 353, height: 500 },
  B4: { width: 250, height: 353 },
  B5: { width: 176, height: 250 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
  Ledger: { width: 432, height: 279 },
  Executive: { width: 184, height: 267 },
  Custom: { width: 210, height: 297 }
} as const;

export const CONTENT_PAPER_SIZES = [
  'A0',
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
  'A7',
  'A8',
  'B0',
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'Letter',
  'Legal',
  'Tabloid',
  'Ledger',
  'Executive',
  'Custom'
] as const;

export type ContentPaperSize = (typeof CONTENT_PAPER_SIZES)[number];
export type ContentOrientation = 'portrait' | 'landscape';

export const CONTENT_ORIENTATIONS: ContentOrientation[] = ['portrait', 'landscape'];

export const PAPER_SIZE_GROUPS = [
  { key: 'isoA', sizes: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'] as ContentPaperSize[] },
  { key: 'isoB', sizes: ['B0', 'B1', 'B2', 'B3', 'B4', 'B5'] as ContentPaperSize[] },
  {
    key: 'us',
    sizes: ['Letter', 'Legal', 'Tabloid', 'Ledger', 'Executive'] as ContentPaperSize[]
  },
  { key: 'custom', sizes: ['Custom'] as ContentPaperSize[] }
] as const;

export const CUSTOM_PAGE_MIN_MM = 50;
export const CUSTOM_PAGE_MAX_MM = 2000;
export const DEFAULT_CUSTOM_PAGE_WIDTH_MM = 210;
export const DEFAULT_CUSTOM_PAGE_HEIGHT_MM = 297;

/** Standard email template canvas width (px). */
export const EMAIL_CANVAS_WIDTH_PX = 600;
/** Minimum email canvas height in the builder (px). */
export const EMAIL_CANVAS_MIN_HEIGHT_PX = 800;

const MM_TO_PX = 96 / 25.4;

export function isEmailOutputFormat(format: string | undefined | null): boolean {
  return String(format || '').toLowerCase() === 'email';
}

export function resolveEmailCanvasDimensionsPx(): PageDimensionsMm {
  return {
    width: EMAIL_CANVAS_WIDTH_PX,
    height: EMAIL_CANVAS_MIN_HEIGHT_PX
  };
}

export interface TemplatePageSettings {
  paperSize: ContentPaperSize | string;
  orientation: ContentOrientation;
  customPageWidth?: number | null;
  customPageHeight?: number | null;
}

export interface PageDimensionsMm {
  width: number;
  height: number;
}

function clampCustomDimension(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(CUSTOM_PAGE_MAX_MM, Math.max(CUSTOM_PAGE_MIN_MM, parsed));
}

export function resolvePageDimensionsMm(
  paperSize: string,
  orientation: ContentOrientation,
  settings: Pick<TemplatePageSettings, 'customPageWidth' | 'customPageHeight'> = {}
): PageDimensionsMm {
  const normalizedSize = paperSize in PAPER_DIMENSIONS_MM ? paperSize : 'A4';
  const base = normalizedSize === 'Custom'
    ? {
        width: clampCustomDimension(settings.customPageWidth, DEFAULT_CUSTOM_PAGE_WIDTH_MM),
        height: clampCustomDimension(settings.customPageHeight, DEFAULT_CUSTOM_PAGE_HEIGHT_MM)
      }
    : { ...PAPER_DIMENSIONS_MM[normalizedSize as ContentPaperSize] };

  if (orientation === 'landscape') {
    return { width: base.height, height: base.width };
  }
  return base;
}

export function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX);
}

export function resolvePageDimensionsPx(
  settings: TemplatePageSettings
): PageDimensionsMm {
  const paperSize = settings.paperSize || 'A4';
  const orientation = settings.orientation === 'landscape' ? 'landscape' : 'portrait';
  const dimensions = resolvePageDimensionsMm(paperSize, orientation, settings);
  return {
    width: mmToPx(dimensions.width),
    height: mmToPx(dimensions.height)
  };
}

export const DEFAULT_PAGE_MARGINS_MM = {
  top: 12,
  right: 12,
  bottom: 12,
  left: 12
} as const;

export type PageMarginsMm = typeof DEFAULT_PAGE_MARGINS_MM;

export interface PageMarginsPx {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ContentAreaPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function resolvePageMarginsPx(
  marginsMm: Partial<PageMarginsMm> = {}
): PageMarginsPx {
  const merged = { ...DEFAULT_PAGE_MARGINS_MM, ...marginsMm };
  return {
    top: mmToPx(merged.top),
    right: mmToPx(merged.right),
    bottom: mmToPx(merged.bottom),
    left: mmToPx(merged.left)
  };
}

export function resolveContentAreaPx(
  pageWidthPx: number,
  pageHeightPx: number,
  marginsPx: PageMarginsPx = resolvePageMarginsPx()
): ContentAreaPx {
  return {
    x: marginsPx.left,
    y: marginsPx.top,
    width: Math.max(0, pageWidthPx - marginsPx.left - marginsPx.right),
    height: Math.max(0, pageHeightPx - marginsPx.top - marginsPx.bottom)
  };
}

export function formatPageSizeLabel(
  paperSize: string,
  orientation: ContentOrientation,
  settings: Pick<TemplatePageSettings, 'customPageWidth' | 'customPageHeight'> = {}
): string {
  if (paperSize === 'Custom') {
    const dimensions = resolvePageDimensionsMm('Custom', orientation, settings);
    return `${dimensions.width} × ${dimensions.height} mm`;
  }
  return paperSize;
}
