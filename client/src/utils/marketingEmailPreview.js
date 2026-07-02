/**
 * Split campaign body HTML or template draft into preview frame parts.
 * @param {string} [bodyHtml]
 * @param {object|null} [template]
 * @returns {{ html: string, css: string }}
 */
export function parseCampaignEmailPreview(bodyHtml = '', template = null) {
  const definition = template?.draftDefinition;
  if (definition && typeof definition === 'object' && !Array.isArray(definition)) {
    return {
      html: String(definition.html || ''),
      css: String(definition.css || '')
    };
  }

  const source = String(bodyHtml || '').trim();
  if (!source) {
    return { html: '', css: '' };
  }

  const styleBlocks = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  const css = styleBlocks.map((match) => match[1].trim()).filter(Boolean).join('\n\n');

  const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let html = bodyMatch ? bodyMatch[1].trim() : source;
  html = html.replace(/<style\b[\s\S]*?<\/style>/gi, '').trim();

  return { html, css };
}
