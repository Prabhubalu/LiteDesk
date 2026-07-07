export function buildHeadlessExamplePrefixes(org) {
  const encodedOrg = encodeURIComponent(org);
  return {
    home: `/examples/headless-help-home?org=${encodedOrg}`,
    list: `/examples/headless-article-list?org=${encodedOrg}`,
    article: `/examples/headless-article?org=${encodedOrg}&slug=`,
    category: `/examples/headless-help-category?org=${encodedOrg}&collection=`,
    section: `/examples/headless-help-section?org=${encodedOrg}&section=`,
  };
}

export function buildHeadlessExampleDemoPrefixes(org) {
  const prefixes = buildHeadlessExamplePrefixes(org);
  return {
    homePrefix: prefixes.home,
    categoryPrefix: prefixes.category,
    sectionPrefix: prefixes.section,
    articlePrefix: prefixes.article,
    linkPrefix: prefixes.category,
  };
}
