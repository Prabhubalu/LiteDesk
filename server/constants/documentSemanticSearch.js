'use strict';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
  'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with', 'this', 'but', 'they',
  'have', 'had', 'what', 'when', 'where', 'who', 'which', 'or', 'not', 'your', 'you'
]);

const EMBEDDING_DIMENSIONS = 128;

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function hashToken(token) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildEmbedding(text, dimensions = EMBEDDING_DIMENSIONS) {
  const tokens = tokenize(text);
  const vector = new Float32Array(dimensions);
  if (!tokens.length) return Array.from(vector);

  for (const token of tokens) {
    const hash = hashToken(token);
    for (let i = 0; i < dimensions; i += 1) {
      vector[i] += Math.sin((hash % 997) * (i + 1) * 0.017) / Math.sqrt(tokens.length);
    }
  }

  let norm = 0;
  for (let i = 0; i < dimensions; i += 1) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dimensions; i += 1) {
    vector[i] /= norm;
  }

  return Array.from(vector);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += (a[i] || 0) * (b[i] || 0);
  }
  return dot;
}

function buildDocumentSemanticSource(doc) {
  return [
    doc?.title,
    doc?.description,
    doc?.documentNumber,
    Array.isArray(doc?.tags) ? doc.tags.join(' ') : '',
    doc?.richContentText,
    doc?.ocrText
  ].filter(Boolean).join('\n');
}

module.exports = {
  EMBEDDING_DIMENSIONS,
  STOP_WORDS,
  tokenize,
  buildEmbedding,
  cosineSimilarity,
  buildDocumentSemanticSource
};
