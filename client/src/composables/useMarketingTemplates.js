import { useTemplates } from '@/composables/useTemplates';

const EMAIL_OUTPUT_FORMAT = 'email';
const MARKETING_PURPOSE = 'marketing';

/**
 * Build a full HTML document from template html + css for campaign body.
 * @param {string} html
 * @param {string} css
 * @returns {string}
 */
export function buildMarketingEmailHtml(html = '', css = '') {
  const body = String(html || '').trim();
  const styles = String(css || '').trim();
  if (!body && !styles) return '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${styles ? `<style>${styles}</style>` : ''}
</head>
<body>${body}</body>
</html>`;
}

/**
 * Extract campaign-ready HTML from a core ContentTemplate record.
 * @param {object|null|undefined} template
 * @returns {string}
 */
export function buildMarketingEmailFromTemplate(template) {
  const definition = template?.draftDefinition;
  if (definition && typeof definition === 'object' && !Array.isArray(definition)) {
    return buildMarketingEmailHtml(definition.html, definition.css);
  }
  return '';
}

/**
 * Marketing email templates — thin wrapper over core ContentTemplate (outputFormat=email).
 */
export function useMarketingTemplates() {
  const core = useTemplates();

  async function fetchTemplates(options = {}) {
    return core.fetchTemplates({
      ...options,
      outputFormat: EMAIL_OUTPUT_FORMAT,
      purpose: options.purpose || undefined
    });
  }

  async function fetchTemplate(id) {
    const template = await core.fetchTemplate(id);
    if (String(template?.outputFormat || '').toLowerCase() !== EMAIL_OUTPUT_FORMAT) {
      throw new Error('Template is not an email template');
    }
    return template;
  }

  async function createTemplate(payload = {}) {
    return core.createTemplate({
      name: payload.name,
      description: payload.description || '',
      outputFormat: EMAIL_OUTPUT_FORMAT,
      moduleScope: payload.moduleScope || 'people',
      purpose: payload.purpose || MARKETING_PURPOSE,
      category: payload.category || 'marketing'
    });
  }

  return {
    templates: core.templates,
    loading: core.loading,
    template: core.templates,
    pagination: core.pagination,
    fetchTemplates,
    fetchTemplate,
    createTemplate,
    buildMarketingEmailHtml,
    buildMarketingEmailFromTemplate
  };
}
