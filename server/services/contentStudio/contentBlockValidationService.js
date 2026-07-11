'use strict';

const {
  CONTENT_STUDIO_BLOCK_TYPES,
  CONTENT_STUDIO_PROSEMIRROR_NODE_TYPES,
} = require('../../constants/contentStudioConstants');

const ALLOWED_BLOCK_TYPES = new Set([
  ...CONTENT_STUDIO_BLOCK_TYPES,
  ...CONTENT_STUDIO_PROSEMIRROR_NODE_TYPES,
]);

class ContentBlockValidationError extends Error {
  constructor(message, code = 'INVALID_BLOCK_DOCUMENT') {
    super(message);
    this.name = 'ContentBlockValidationError';
    this.code = code;
    this.statusCode = 400;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateBlockNode(node, path = 'document') {
  if (!isPlainObject(node)) {
    throw new ContentBlockValidationError(`${path} must be an object`);
  }

  const type = String(node.type || '').trim();
  if (!type) {
    throw new ContentBlockValidationError(`${path}.type is required`);
  }

  const inlineTypes = new Set(['text']);
  if (type !== 'doc' && !inlineTypes.has(type) && !ALLOWED_BLOCK_TYPES.has(type)) {
    throw new ContentBlockValidationError(`${path}.type "${type}" is not supported`);
  }

  if (inlineTypes.has(type)) {
    if (node.text !== undefined && typeof node.text !== 'string') {
      throw new ContentBlockValidationError(`${path}.text must be a string when provided`);
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks)) {
        throw new ContentBlockValidationError(`${path}.marks must be an array when provided`);
      }
      node.marks.forEach((mark, index) => {
        if (!isPlainObject(mark) || !String(mark.type || '').trim()) {
          throw new ContentBlockValidationError(`${path}.marks[${index}] must include a type`);
        }
      });
    }
    return;
  }

  if (node.attrs !== undefined && !isPlainObject(node.attrs)) {
    throw new ContentBlockValidationError(`${path}.attrs must be an object when provided`);
  }

  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) {
      throw new ContentBlockValidationError(`${path}.content must be an array when provided`);
    }
    node.content.forEach((child, index) => {
      validateBlockNode(child, `${path}.content[${index}]`);
    });
  }

  if (node.text !== undefined && typeof node.text !== 'string') {
    throw new ContentBlockValidationError(`${path}.text must be a string when provided`);
  }

  if (node.marks !== undefined) {
    if (!Array.isArray(node.marks)) {
      throw new ContentBlockValidationError(`${path}.marks must be an array when provided`);
    }
    node.marks.forEach((mark, index) => {
      if (!isPlainObject(mark) || !String(mark.type || '').trim()) {
        throw new ContentBlockValidationError(`${path}.marks[${index}] must include a type`);
      }
    });
  }
}

function createEmptyBlockDocument() {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [],
      },
    ],
  };
}

function assertValidBlockDocument(document) {
  validateBlockNode(document, 'document');
  if (document.type !== 'doc') {
    throw new ContentBlockValidationError('document root type must be "doc"');
  }
  return document;
}

module.exports = {
  ContentBlockValidationError,
  createEmptyBlockDocument,
  assertValidBlockDocument,
  validateBlockNode,
};
