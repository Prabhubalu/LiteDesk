module.exports = function deprecate(routeName, alternative) {
  return function(req, res, next) {
    const msg = `Deprecated endpoint: ${routeName}. Use ${alternative} instead.`;
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', `<${alternative}>; rel="successor-version"`);
    res.setHeader('Warning', `299 - "${msg}"`);
    console.warn(`[DEPRECATION] ${msg}`);
    next();
  };
};


