'use strict';

const { isAllowedCorsOrigin } = require('../config/corsConfig');
const {
  extractOrgSlugFromPublicContentPath,
  isArticlesEmbedOriginAllowed,
} = require('../services/contentStudio/articlesEmbedOriginService');

const isProduction = process.env.NODE_ENV === 'production';

function setPublicContentCorsHeaders(res, origin) {
  if (!origin) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function resolvePublicContentCorsAllowed(req, origin) {
  if (!origin) return true;

  if (isAllowedCorsOrigin(origin, {
    allowLocalhost: !isProduction,
    allowTenantSubdomains: isProduction,
  })) {
    return true;
  }

  const orgSlug = extractOrgSlugFromPublicContentPath(req.path || req.url || '');
  return isArticlesEmbedOriginAllowed(origin, orgSlug);
}

async function publicContentCorsMiddleware(req, res, next) {
  const origin = req.get('Origin') || '';

  try {
    const allowed = await resolvePublicContentCorsAllowed(req, origin);

    if (req.method === 'OPTIONS') {
      if (allowed) {
        setPublicContentCorsHeaders(res, origin);
        return res.sendStatus(204);
      }
      return res.sendStatus(403);
    }

    if (!origin || allowed) {
      if (origin && allowed) {
        setPublicContentCorsHeaders(res, origin);
      }
      return next();
    }

    console.log(`❌ Public content CORS blocked origin: ${origin} (${req.method} ${req.originalUrl})`);
    return res.status(403).json({ success: false, message: 'Not allowed by CORS' });
  } catch (error) {
    return next(error);
  }
}

module.exports = publicContentCorsMiddleware;
