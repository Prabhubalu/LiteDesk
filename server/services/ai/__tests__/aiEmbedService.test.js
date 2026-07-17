const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveDocumentCorpusMeta,
  resolveContentDocumentCorpusMeta,
  buildDocumentSourceText,
  buildContentDocumentSourceText,
  chunkText,
} = require('../aiEmbedService');

describe('aiEmbedService corpus tagging', () => {
  it('tags knowledge_article Documents as HELPDESK articles', () => {
    assert.deepEqual(resolveDocumentCorpusMeta({ documentType: 'knowledge_article' }), {
      sourceType: 'article',
      appKey: 'HELPDESK',
      moduleKey: 'articles',
    });
  });

  it('tags Content Studio articles and blog posts', () => {
    assert.deepEqual(resolveContentDocumentCorpusMeta({
      addonKey: 'articles',
      contentType: 'knowledge_article',
      appKey: 'HELPDESK',
    }), {
      sourceType: 'article',
      appKey: 'HELPDESK',
      moduleKey: 'articles',
    });

    assert.deepEqual(resolveContentDocumentCorpusMeta({
      addonKey: 'blog',
      contentType: 'blog_post',
      appKey: 'SALES',
    }), {
      sourceType: 'article',
      appKey: 'SALES',
      moduleKey: 'blog',
    });
  });

  it('builds searchable text from rich document and content document fields', () => {
    const docText = buildDocumentSourceText({
      title: 'Refund policy',
      description: 'How refunds work',
      richContentText: 'Customers get 30 days',
      richContent: { html: '<p>Ignore if richContentText present</p>' },
    });
    assert.match(docText, /Refund policy/);
    assert.match(docText, /30 days/);

    const articleText = buildContentDocumentSourceText({
      title: 'Shipping FAQ',
      subtitle: 'Logistics',
      summary: 'When packages ship',
      searchText: 'Orders leave within 24 hours',
    });
    assert.match(articleText, /Shipping FAQ/);
    assert.match(articleText, /24 hours/);
  });

  it('chunks long article text', () => {
    const chunks = chunkText('a'.repeat(2500));
    assert.ok(chunks.length >= 2);
    assert.ok(chunks[0].length <= 1200);
  });
});
