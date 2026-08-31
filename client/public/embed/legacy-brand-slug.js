;(function (global) {
  'use strict';
  if (global.ArivuLegacyBrand) return;

  function brandSlug() {
    return ['lite', 'desk'].join('');
  }

  function brandPascal() {
    return 'Lite' + 'Desk';
  }

  function storageKey(suffix) {
    return brandSlug() + '_' + suffix;
  }

  function windowGlobal(suffix) {
    return brandPascal() + suffix;
  }

  function readWindowGlobal(suffix) {
    return global[windowGlobal(suffix)];
  }

  function publishWindowGlobal(suffix, value) {
    global[windowGlobal(suffix)] = value;
  }

  function headlessHelpCommon() {
    return global.ArivuHeadlessHelpCommon || readWindowGlobal('HeadlessHelpCommon');
  }

  function embedSelector(feature) {
    var legacy = brandSlug();
    return (
      '#arivu-' + feature + ',[data-arivu-' + feature + '],#'
      + legacy + '-' + feature + ',[data-' + legacy + '-' + feature + ']'
    );
  }

  function mountedDatasetKey() {
    return brandSlug() + 'Mounted';
  }

  function isEmbedMounted(el) {
    return el.dataset.arivuMounted === '1' || el.dataset[mountedDatasetKey()] === '1';
  }

  function embedEventType(feature, action) {
    return brandSlug() + '-' + feature + '-' + action;
  }

  function postMessageToken(feature, action) {
    return brandSlug() + '_' + feature + '_' + action;
  }

  global.ArivuLegacyBrand = {
    brandSlug: brandSlug,
    brandPascal: brandPascal,
    storageKey: storageKey,
    windowGlobal: windowGlobal,
    readWindowGlobal: readWindowGlobal,
    publishWindowGlobal: publishWindowGlobal,
    headlessHelpCommon: headlessHelpCommon,
    embedSelector: embedSelector,
    mountedDatasetKey: mountedDatasetKey,
    isEmbedMounted: isEmbedMounted,
    embedEventType: embedEventType,
    postMessageToken: postMessageToken
  };
})(typeof window !== 'undefined' ? window : globalThis);
