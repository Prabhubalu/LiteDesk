'use strict';

const fs = require('fs');
const fileStorage = require('../../fileStorageService');
const { resolveUploadLogoSource } = require('../../quoteBrandingService');

const IMG_SRC_PATTERN = /<img\b([^>]*?)\ssrc=(["'])([^"']+)\2([^>]*)>/gi;

function mimeFromExtension(src) {
  const ext = String(src || '').split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'png') return 'image/png';
  return null;
}

function detectMimeType(buffer, src) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return mimeFromExtension(src) || 'image/png';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF') return 'image/webp';

  const head = buffer.slice(0, 512).toString('utf8').trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return 'image/svg+xml';
  }

  return mimeFromExtension(src) || 'image/png';
}

function toDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function normalizeManagedImageRef(src) {
  const trimmed = String(src || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (
        url.pathname.startsWith('/api/files/download')
        || url.pathname.startsWith('/api/uploads/')
      ) {
        return `${url.pathname}${url.search}`;
      }
    } catch {
      return null;
    }
    return null;
  }

  return trimmed;
}

async function readExternalImageBuffer(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return null;
    const headerMime = String(response.headers.get('content-type') || '').split(';')[0].trim();
    const mimeType = headerMime.startsWith('image/') ? headerMime : detectMimeType(buffer, url);
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

async function readImageBuffer(src, organizationId) {
  const trimmed = String(src || '').trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  const managedRef = normalizeManagedImageRef(trimmed);
  if (managedRef) {
    const parsed = fileStorage.parseStoragePath(managedRef);
    if (parsed) {
      try {
        const buffer = await fileStorage.getObjectBuffer(managedRef);
        if (buffer?.length) {
          return { buffer, mimeType: detectMimeType(buffer, managedRef) };
        }
      } catch {
        // fall through to legacy resolver
      }
    }

    const uploadSource = await resolveUploadLogoSource(managedRef, organizationId);
    if (uploadSource) {
      if (Buffer.isBuffer(uploadSource)) {
        return { buffer: uploadSource, mimeType: detectMimeType(uploadSource, managedRef) };
      }
      if (typeof uploadSource === 'string' && fs.existsSync(uploadSource)) {
        const buffer = await fs.promises.readFile(uploadSource);
        return { buffer, mimeType: detectMimeType(buffer, managedRef) };
      }
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return readExternalImageBuffer(trimmed);
  }

  return null;
}

/**
 * Inline local/API image sources as data URLs so headless PDF rendering can load them.
 * @param {string} html
 * @param {object} [options]
 * @param {string} [options.organizationId]
 */
async function inlineHtmlImages(html, options = {}) {
  const organizationId = options.organizationId;
  const source = String(html || '');
  if (!source.includes('<img')) return source;

  const replacements = [];
  let match = IMG_SRC_PATTERN.exec(source);
  while (match) {
    const full = match[0];
    const before = match[1];
    const quote = match[2];
    const src = match[3];
    const after = match[4];

    if (!src.startsWith('data:')) {
      // eslint-disable-next-line no-await-in-loop
      const loaded = await readImageBuffer(src, organizationId);
      if (loaded?.buffer?.length) {
        const dataUrl = toDataUrl(loaded.buffer, loaded.mimeType);
        replacements.push({
          full,
          next: `<img${before} src=${quote}${dataUrl}${quote}${after}>`
        });
      }
    }

    match = IMG_SRC_PATTERN.exec(source);
  }

  if (!replacements.length) return source;

  let result = source;
  for (const item of replacements) {
    result = result.replace(item.full, item.next);
  }
  return result;
}

module.exports = {
  inlineHtmlImages,
  detectMimeType,
  normalizeManagedImageRef
};
