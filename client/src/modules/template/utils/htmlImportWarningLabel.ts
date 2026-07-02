const WARNING_TYPE_KEYS: Record<string, string> = {
  'javascript-removed': 'templates.htmlImport.warningJavascriptRemoved',
  'external-css-ignored': 'templates.htmlImport.warningExternalCssIgnored',
  'external-css': 'templates.htmlImport.warningExternalCss',
  'unsupported-css': 'templates.htmlImport.warningUnsupportedCss',
  form: 'templates.htmlImport.warningForm'
};

export function resolveHtmlImportWarningKey(type: string): string {
  return WARNING_TYPE_KEYS[type] || `templates.htmlImport.warningUnsupportedCss`;
}
