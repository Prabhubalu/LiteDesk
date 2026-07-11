export type ContentMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type ContentBlockNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ContentBlockNode[];
  text?: string;
  marks?: ContentMark[];
};

export type ContentBlocksDoc = {
  type: 'doc';
  content?: ContentBlockNode[];
};

export type HeadlessRenderContext = {
  doc: ContentBlocksDoc;
  articleLinkPrefix: string;
};

export type HeadlessRenderOptions = {
  title?: string;
  subtitle?: string;
  bodyOnly?: boolean;
  articleLinkPrefix?: string;
  components?: Partial<Record<string, (node: ContentBlockNode, context: HeadlessRenderContext) => string>>;
};

export type RelatedArticleItem = {
  id?: string;
  slug?: string;
  title?: string;
};
