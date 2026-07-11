'use strict';

function buildArivuHelpConfigCjs(pathPrefix) {
  const { buildArivuHelpConfigContent, normalizePathPrefix } = require('./mergeConfig');
  const normalized = normalizePathPrefix(pathPrefix);
  const base = normalized.replace(/\/$/, '') || '/help';
  return `'use strict';

function getArivuHelpRewrites() {
  return [
    { source: '${base}', destination: '${base}/index.html' },
    { source: '${base}/', destination: '${base}/index.html' },
    { source: '${base}/:path+/', destination: '${base}/:path+/index.html' },
    { source: '${base}/:path+', destination: '${base}/:path+/index.html' },
  ];
}

function withArivuHelp(config = {}) {
  const existingRewrites = config.rewrites;
  return {
    ...config,
    async rewrites() {
      const arivu = getArivuHelpRewrites();
      const base = typeof existingRewrites === 'function'
        ? await existingRewrites()
        : (existingRewrites || []);
      return [...arivu, ...base];
    },
  };
}

module.exports = {
  getArivuHelpRewrites,
  withArivuHelp,
};
`;
}

module.exports = {
  buildArivuHelpConfigCjs,
};
