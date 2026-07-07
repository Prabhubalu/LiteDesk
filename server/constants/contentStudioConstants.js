'use strict';

const { ADDON_KEYS } = require('./addonKeys');
const { APP_KEYS } = require('./appKeys');

const CONTENT_STUDIO_CONTENT_TYPES = [
  'knowledge_article',
  'blog_post',
];

const CONTENT_STUDIO_STATUSES = [
  'draft',
  'review',
  'scheduled',
  'published',
  'archived',
];

const CONTENT_STUDIO_VISIBILITY = [
  'private',
  'internal',
  'portal',
  'public',
];

const CONTENT_STUDIO_PROSEMIRROR_NODE_TYPES = [
  'doc',
  'text',
  'paragraph',
  'heading',
  'image',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'hardBreak',
  'callout',
  'steps',
  'step',
  'faq',
  'faqItem',
  'relatedArticles',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'taskList',
  'taskItem',
  'embed',
  'spacer',
  'button',
  'audio',
  'file',
  'gallery',
  'timeline',
  'timelineItem',
  'tabs',
  'tabItem',
  'columns',
  'column',
  'section',
  'toc',
  'form',
  'social',
  'rating',
  'progress',
  'hero',
  'newsletterSignup',
];

const CONTENT_STUDIO_BLOCK_TYPES = [
  'paragraph',
  'heading',
  'image',
  'list',
  'checklist',
  'quote',
  'code',
  'divider',
  'callout',
  'embed',
  'table',
  'steps',
  'faq',
  'related_articles',
  'hero',
  'cta',
  'gallery',
  'audio',
  'file',
  'timeline',
  'tabs',
  'columns',
  'section',
  'spacer',
  'button',
  'toc',
  'form',
  'social',
  'rating',
  'progress',
  'testimonial',
  'stats',
  'newsletter_signup',
];

const CONTENT_STUDIO_RENDER_CHANNELS = [
  'portal_kb',
  'blog_web',
  'headless_json',
  'email_excerpt',
];

const CONTENT_STUDIO_COVER_POSITIONS = [
  'above-title',
  'below-title',
];

const CONTENT_STUDIO_SUBTITLE_SIZES = [
  'sm',
  'md',
  'lg',
  'xl',
];

const CONTENT_TYPE_BY_ADDON = {
  [ADDON_KEYS.ARTICLES]: 'knowledge_article',
  [ADDON_KEYS.BLOG]: 'blog_post',
};

const APP_KEY_BY_ADDON = {
  [ADDON_KEYS.ARTICLES]: APP_KEYS.HELPDESK,
  [ADDON_KEYS.BLOG]: APP_KEYS.MARKETING,
};

const ADDON_DEFAULT_SETTINGS = {
  [ADDON_KEYS.ARTICLES]: {
    portalPublishing: true,
    caseDeflectionEnabled: true,
    staleContentAlertDays: 90,
    publishing: {
      headlessApiEnabled: true,
      publishWebhookUrl: '',
    },
    appearance: {
      layoutPreset: 'classic',
      primaryColor: '#4f46e5',
      secondaryColor: '#6366f1',
      bodyFont: 'Inter, system-ui, sans-serif',
      headingFont: 'Inter, system-ui, sans-serif',
      contentWidth: 'standard',
      borderRadius: 'md',
      defaultCoverPosition: 'below-title',
      defaultSubtitleSize: 'md',
      showLogoInHeader: false,
      logoUrl: '',
    },
  },
  [ADDON_KEYS.BLOG]: {
    urlPrefix: '/blog',
    rssEnabled: true,
    commentsEnabled: false,
    publishing: {
      headlessApiEnabled: true,
      publishWebhookUrl: '',
    },
  },
};

module.exports = {
  CONTENT_STUDIO_CONTENT_TYPES,
  CONTENT_STUDIO_STATUSES,
  CONTENT_STUDIO_VISIBILITY,
  CONTENT_STUDIO_PROSEMIRROR_NODE_TYPES,
  CONTENT_STUDIO_BLOCK_TYPES,
  CONTENT_STUDIO_RENDER_CHANNELS,
  CONTENT_STUDIO_COVER_POSITIONS,
  CONTENT_STUDIO_SUBTITLE_SIZES,
  CONTENT_TYPE_BY_ADDON,
  APP_KEY_BY_ADDON,
  ADDON_DEFAULT_SETTINGS,
};
