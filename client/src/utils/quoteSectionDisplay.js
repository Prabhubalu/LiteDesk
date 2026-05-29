/**
 * Build display rows for quote lines (bundle-aware visibility).
 */
export function buildQuoteDisplayLineRows(lines, bundleModeByParentId) {
  const modeMap = bundleModeByParentId instanceof Map ? bundleModeByParentId : new Map();
  const source = Array.isArray(lines) ? lines : [];

  return source
    .filter((line) => {
      if (line?.hiddenLine === true) return false;
      const type = String(line?.lineType || '');
      if (type === 'bundle_component') {
        const parentId = line.parentBundleLineId ? String(line.parentBundleLineId) : '';
        if ((modeMap.get(parentId) || 'fixed') === 'fixed') return false;
      }
      if (type === 'bundle_parent') {
        const mode = String(line?.bundleSnapshot?.pricingMode || 'fixed').toLowerCase();
        if (mode === 'rollup') return false;
      }
      return true;
    })
    .map((line) => ({
      line,
      indent: String(line?.lineType || '') === 'bundle_component',
      isBundleParent: String(line?.lineType || '') === 'bundle_parent',
      isOptional: line?.optionalLine === true || line?.bundleSnapshot?.isOptional === true
    }));
}

export function buildBundleModeByParentId(lines) {
  const map = new Map();
  for (const l of lines || []) {
    if (String(l?.lineType || '') !== 'bundle_parent') continue;
    const mode = String(l?.bundleSnapshot?.pricingMode || 'fixed').toLowerCase();
    if (l?._id) map.set(String(l._id), mode);
    if (l?.quoteLineId) map.set(String(l.quoteLineId), mode);
  }
  return map;
}

export function sortQuoteSections(sections) {
  return [...(Array.isArray(sections) ? sections : [])].sort(
    (a, b) => (Number(a?.sectionOrder) || 0) - (Number(b?.sectionOrder) || 0)
  );
}

export function buildQuoteSectionBlocks({ lines, sections, uncategorizedTitle }) {
  const sorted = sortQuoteSections(sections);
  const modeMap = buildBundleModeByParentId(lines);

  if (!sorted.length) {
    return [
      {
        key: '__flat__',
        section: null,
        rows: buildQuoteDisplayLineRows(lines, modeMap)
      }
    ];
  }

  const assignedIds = new Set(sorted.map((s) => String(s._id)));
  const blocks = sorted.map((section) => {
    const sid = String(section._id);
    const sectionLines = (lines || []).filter((l) => String(l?.quoteSectionId || '') === sid);
    return {
      key: section.quoteSectionId || sid,
      section,
      rows: buildQuoteDisplayLineRows(sectionLines, modeMap)
    };
  });

  const orphans = (lines || []).filter(
    (l) => !l?.quoteSectionId || !assignedIds.has(String(l.quoteSectionId))
  );
  if (orphans.length) {
    blocks.push({
      key: '__orphan__',
      section: {
        _id: null,
        quoteSectionId: '__orphan__',
        sectionTitle: uncategorizedTitle,
        sectionType: 'standard',
        sectionTotal: 0,
        includeInQuoteTotal: true
      },
      rows: buildQuoteDisplayLineRows(orphans, modeMap),
      isOrphan: true
    });
  }

  return blocks;
}

export function sectionTypeBadgeKey(sectionType) {
  const t = String(sectionType || 'standard');
  if (t === 'optional') return 'optional';
  if (t === 'future') return 'future';
  return null;
}

export function groupLinesByQuoteSection({ lines, sections, uncategorizedTitle = 'General' }) {
  const sorted = sortQuoteSections(sections).filter((s) => s?.hiddenSection !== true);
  const source = Array.isArray(lines) ? lines : [];

  if (!sorted.length) {
    return [{ key: '__flat__', section: null, lines: source }];
  }

  const assignedIds = new Set(sorted.map((s) => String(s._id)));
  const blocks = sorted.map((section) => ({
    key: section.quoteSectionId || String(section._id),
    section,
    lines: source.filter((l) => String(l.quoteSectionId || '') === String(section._id))
  }));

  const orphans = source.filter(
    (l) => !l.quoteSectionId || !assignedIds.has(String(l.quoteSectionId))
  );
  if (orphans.length) {
    blocks.push({
      key: '__orphan__',
      section: {
        sectionTitle: uncategorizedTitle,
        sectionType: 'standard',
        showSectionTotal: false
      },
      lines: orphans,
      isOrphan: true
    });
  }

  return blocks;
}

export function sectionRef(section) {
  if (!section) return null;
  return section.quoteSectionId || section._id || null;
}
