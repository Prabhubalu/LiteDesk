export type ContentStudioMode = 'articles' | 'blog';

export type ContentStudioSaveStatus = 'saved' | 'saving' | 'dirty' | 'error';

export type ContentStudioPreviewDevice = 'desktop' | 'tablet' | 'mobile';

export type ContentStudioLeftPanel = 'blocks' | 'outline' | 'components' | 'media' | 'ai' | 'templates' | 'seo' | 'settings';

export type ContentStudioInspectorTab = 'document' | 'block';

export interface ContentStudioBlockRegistryItem {
  type: string;
  labelKey: string;
  category: string;
  icon: string;
  enabled?: boolean;
  insertType?: string;
  insertAttrs?: Record<string, unknown>;
  searchTerms?: string[];
}

export interface ContentStudioSeo {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  robots?: string;
}

export interface ContentStudioPresentation {
  coverPosition: 'above-title' | 'below-title';
  titleOverlapCover: boolean;
  subtitleSize: 'sm' | 'md' | 'lg' | 'xl';
  headingColor?: string;
  subheadingColor?: string;
}

export interface ContentStudioDocumentRecord {
  _id: string;
  title: string;
  subtitle?: string;
  slug: string;
  summary?: string;
  status: string;
  visibility?: string;
  featured?: boolean;
  collectionId?: string | null;
  seo?: ContentStudioSeo;
  coverAssetId?: string | null;
  coverImageUrl?: string | null;
  presentation?: Partial<ContentStudioPresentation>;
  currentVersion?: {
    blocks?: Record<string, unknown>;
  } | null;
  publishedAt?: string | null;
  updatedAt?: string;
  staleContent?: {
    isStale: boolean;
    daysSinceUpdate: number;
    staleContentAlertDays: number;
  } | null;
}

export interface ProseMirrorJson {
  type: string;
  content?: ProseMirrorJson[];
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}
