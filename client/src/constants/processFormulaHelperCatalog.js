/**
 * Process formula helper catalog (mirrors server/utils/processFormulaHelpers.js).
 * Used by Process Designer expression builder UI.
 */

/** @typedef {{ name: string, category: string, description: string, signature: string, recommended?: boolean }} FormulaHelperDef */

/** @type {FormulaHelperDef[]} */
export const PROCESS_FORMULA_HELPER_CATALOG = [
  { name: 'concat', category: 'string', signature: 'concat(...)', description: 'Combines text values.' },
  { name: 'substring', category: 'string', signature: 'substring(field, start, length)', description: 'Extracts a portion of text.' },
  { name: 'lowercase', category: 'string', signature: 'lowercase(field)', description: 'Lowercase string.' },
  { name: 'uppercase', category: 'string', signature: 'uppercase(field)', description: 'Uppercase string.' },
  { name: 'replace', category: 'string', signature: 'replace(field, search, replace)', description: 'Replace all occurrences.' },
  { name: 'extract_before', category: 'string', signature: 'extract_before(field, delimiter)', description: 'Text before delimiter.' },
  { name: 'extract_after', category: 'string', signature: 'extract_after(field, delimiter)', description: 'Text after delimiter.' },
  { name: 'trim', category: 'string', signature: 'trim(field)', description: 'Trim whitespace.', recommended: true },
  { name: 'length', category: 'string', signature: 'length(field)', description: 'String length.', recommended: true },
  { name: 'contains', category: 'string', signature: 'contains(field, value)', description: 'Contains check.', recommended: true },
  { name: 'starts_with', category: 'string', signature: 'starts_with(field, value)', description: 'Starts-with check.', recommended: true },
  { name: 'ends_with', category: 'string', signature: 'ends_with(field, value)', description: 'Ends-with check.', recommended: true },
  { name: 'today', category: 'date', signature: 'today', description: "Today's date." },
  { name: 'today_datetime', category: 'date', signature: 'today_datetime', description: 'Current datetime.' },
  { name: 'tomorrow', category: 'date', signature: 'tomorrow', description: "Tomorrow's date." },
  { name: 'yesterday', category: 'date', signature: 'yesterday', description: "Yesterday's date." },
  { name: 'add_days', category: 'date', signature: 'add_days(date, days)', description: 'Add calendar days.' },
  { name: 'sub_days', category: 'date', signature: 'sub_days(date, days)', description: 'Subtract calendar days.' },
  { name: 'add_weekdays', category: 'date', signature: 'add_weekdays(date, days)', description: 'Add business days.' },
  { name: 'sub_weekdays', category: 'date', signature: 'sub_weekdays(date, days)', description: 'Subtract business days.' },
  { name: 'add_month', category: 'date', signature: 'add_month(date, months)', description: 'Add months.' },
  { name: 'sub_month', category: 'date', signature: 'sub_month(date, months)', description: 'Subtract months.' },
  { name: 'add_year', category: 'date', signature: 'add_year(date, years)', description: 'Add years.' },
  { name: 'sub_year', category: 'date', signature: 'sub_year(date, years)', description: 'Subtract years.' },
  { name: 'add_time', category: 'date', signature: 'add_time(timefield, minutes)', description: 'Add minutes.' },
  { name: 'sub_time', category: 'date', signature: 'sub_time(timefield, minutes)', description: 'Subtract minutes.' },
  { name: 'time_diff', category: 'date', signature: 'time_diff(a, b?)', description: 'Diff in minutes.' },
  { name: 'time_diffdays', category: 'date', signature: 'time_diffdays(a, b?)', description: 'Diff in days.' },
  { name: 'time_diffweekdays', category: 'date', signature: 'time_diffweekdays(a, b?)', description: 'Diff in weekdays.' },
  { name: 'day_of_date', category: 'date', signature: 'day_of_date(date)', description: 'Day of month.' },
  { name: 'date_format', category: 'date', signature: 'date_format(date, format)', description: 'Format date.' },
  { name: 'now', category: 'date', signature: 'now()', description: 'Current datetime.', recommended: true },
  { name: 'month', category: 'date', signature: 'month(date)', description: 'Month number.', recommended: true },
  { name: 'year', category: 'date', signature: 'year(date)', description: 'Year number.', recommended: true },
  { name: 'weekday', category: 'date', signature: 'weekday(date)', description: 'Weekday 0–6.', recommended: true },
  { name: 'power', category: 'math', signature: 'power(base, exponent)', description: 'Exponentiation.' },
  { name: 'roundoff', category: 'math', signature: 'roundoff(number, precision)', description: 'Round to precision.' },
  { name: 'abs', category: 'math', signature: 'abs(number)', description: 'Absolute value.', recommended: true },
  { name: 'ceil', category: 'math', signature: 'ceil(number)', description: 'Round up.', recommended: true },
  { name: 'floor', category: 'math', signature: 'floor(number)', description: 'Round down.', recommended: true },
  { name: 'sqrt', category: 'math', signature: 'sqrt(number)', description: 'Square root.', recommended: true },
  { name: 'min', category: 'math', signature: 'min(...)', description: 'Minimum.', recommended: true },
  { name: 'max', category: 'math', signature: 'max(...)', description: 'Maximum.', recommended: true },
  { name: 'mod', category: 'math', signature: 'mod(a, b)', description: 'Modulo.', recommended: true },
  { name: 'if', category: 'conditional', signature: 'if(condition, trueValue, falseValue)', description: 'Conditional value.', recommended: true },
  { name: 'if_else_ladder', category: 'conditional', signature: 'if_else_ladder(...)', description: 'Multi-condition ladder.' },
  { name: 'switch', category: 'conditional', signature: 'switch(value, case, result, ..., default?)', description: 'Switch/case.', recommended: true },
  { name: 'coalesce', category: 'conditional', signature: 'coalesce(...)', description: 'First non-empty.', recommended: true },
  { name: 'is_empty', category: 'conditional', signature: 'is_empty(value)', description: 'Empty check.', recommended: true },
  { name: 'is_not_empty', category: 'conditional', signature: 'is_not_empty(value)', description: 'Not-empty check.', recommended: true },
  { name: 'is_null', category: 'conditional', signature: 'is_null(value)', description: 'Null check.', recommended: true },
  { name: 'is_not_null', category: 'conditional', signature: 'is_not_null(value)', description: 'Not-null check.', recommended: true },
  { name: 'and', category: 'logical', signature: 'and(...)', description: 'Logical AND.', recommended: true },
  { name: 'or', category: 'logical', signature: 'or(...)', description: 'Logical OR.', recommended: true },
  { name: 'not', category: 'logical', signature: 'not(condition)', description: 'Logical NOT.', recommended: true },
  { name: 'xor', category: 'logical', signature: 'xor(a, b)', description: 'Logical XOR.', recommended: true },
  { name: 'is_email', category: 'validation', signature: 'is_email(value)', description: 'Email validation.', recommended: true },
  { name: 'is_phone', category: 'validation', signature: 'is_phone(value)', description: 'Phone validation.', recommended: true },
  { name: 'is_numeric', category: 'validation', signature: 'is_numeric(value)', description: 'Numeric check.', recommended: true },
  { name: 'is_date', category: 'validation', signature: 'is_date(value)', description: 'Date check.', recommended: true },
  { name: 'is_boolean', category: 'validation', signature: 'is_boolean(value)', description: 'Boolean check.', recommended: true },
  { name: 'uuid', category: 'utility', signature: 'uuid()', description: 'Generate UUID.' },
  { name: 'to_string', category: 'utility', signature: 'to_string(value)', description: 'To text.', recommended: true },
  { name: 'to_number', category: 'utility', signature: 'to_number(value)', description: 'To number.', recommended: true },
  { name: 'to_date', category: 'utility', signature: 'to_date(value)', description: 'To date.', recommended: true },
  { name: 'to_datetime', category: 'utility', signature: 'to_datetime(value)', description: 'To datetime.', recommended: true }
];

export const PROCESS_FORMULA_HELPER_CATEGORIES = [
  { value: 'recommended', labelKey: 'process.formulaCatRecommended' },
  { value: 'string', labelKey: 'process.formulaCatString' },
  { value: 'date', labelKey: 'process.formulaCatDate' },
  { value: 'math', labelKey: 'process.formulaCatMath' },
  { value: 'conditional', labelKey: 'process.formulaCatConditional' },
  { value: 'logical', labelKey: 'process.formulaCatLogical' },
  { value: 'validation', labelKey: 'process.formulaCatValidation' },
  { value: 'utility', labelKey: 'process.formulaCatUtility' }
];

/**
 * Full code-block templates — pasted into the editor so users replace placeholders
 * with their mergetags / values.
 * @type {Record<string, string>}
 */
export const PROCESS_FORMULA_HELPER_CODEBLOCKS = {
  concat: 'concat("Follow up: ", trigger.first_name, " ", trigger.last_name)',
  substring: 'substring(trigger.first_name, 0, 3)',
  lowercase: 'lowercase(trigger.first_name)',
  uppercase: 'uppercase(trigger.first_name)',
  replace: 'replace(trigger.email, "@", " at ")',
  extract_before: 'extract_before(trigger.email, "@")',
  extract_after: 'extract_after(trigger.email, "@")',
  trim: 'trim(trigger.first_name)',
  length: 'length(trigger.first_name)',
  contains: 'contains(trigger.email, "@")',
  starts_with: 'starts_with(trigger.first_name, "A")',
  ends_with: 'ends_with(trigger.email, ".com")',
  today: 'today',
  today_datetime: 'today_datetime',
  tomorrow: 'tomorrow',
  yesterday: 'yesterday',
  add_days: 'add_days(today, 3)',
  sub_days: 'sub_days(today, 3)',
  add_weekdays: 'add_weekdays(today, 5)',
  sub_weekdays: 'sub_weekdays(today, 5)',
  add_month: 'add_month(today, 1)',
  sub_month: 'sub_month(today, 1)',
  add_year: 'add_year(today, 1)',
  sub_year: 'sub_year(today, 1)',
  add_time: 'add_time(now(), 30)',
  sub_time: 'sub_time(now(), 30)',
  time_diff: 'time_diff(trigger.createdAt, now())',
  time_diffdays: 'time_diffdays(trigger.createdAt)',
  time_diffweekdays: 'time_diffweekdays(trigger.createdAt)',
  day_of_date: 'day_of_date(today)',
  date_format: 'date_format(now(), "YYYY-MM-DD HH:mm")',
  now: 'now()',
  month: 'month(today)',
  year: 'year(today)',
  weekday: 'weekday(today)',
  power: 'power(2, 3)',
  roundoff: 'roundoff(10.456, 2)',
  abs: 'abs(-5)',
  ceil: 'ceil(4.2)',
  floor: 'floor(4.8)',
  sqrt: 'sqrt(16)',
  min: 'min(1, 5, 3)',
  max: 'max(1, 5, 3)',
  mod: 'mod(10, 3)',
  if: 'if(is_not_empty(trigger.email), trigger.email, "no-email")',
  if_else_ladder:
    'if_else_ladder(is_empty(trigger.first_name), "Anonymous", contains(trigger.email, "@"), trigger.email, "unknown")',
  switch: 'switch(trigger.sales_type, "Lead", "New lead", "Contact", "Contact", "Other")',
  coalesce: 'coalesce(trigger.mobile, trigger.phone, trigger.email, "n/a")',
  is_empty: 'is_empty(trigger.email)',
  is_not_empty: 'is_not_empty(trigger.email)',
  is_null: 'is_null(trigger.organization)',
  is_not_null: 'is_not_null(trigger.organization)',
  and: 'and(is_not_empty(trigger.first_name), is_email(trigger.email))',
  or: 'or(is_empty(trigger.phone), is_empty(trigger.mobile))',
  not: 'not(is_empty(trigger.email))',
  xor: 'xor(is_empty(trigger.phone), is_empty(trigger.mobile))',
  is_email: 'is_email(trigger.email)',
  is_phone: 'is_phone(trigger.phone)',
  is_numeric: 'is_numeric(trigger.amount)',
  is_date: 'is_date(today)',
  is_boolean: 'is_boolean(true)',
  uuid: 'uuid()',
  to_string: 'to_string(123)',
  to_number: 'to_number("42")',
  to_date: 'to_date(now())',
  to_datetime: 'to_datetime(today)'
};

/**
 * @param {FormulaHelperDef[]} catalog
 * @param {string} category
 */
export function helpersForCategory(catalog, category) {
  const list = Array.isArray(catalog) ? catalog : PROCESS_FORMULA_HELPER_CATALOG;
  if (category === 'recommended') return list.filter((h) => h.recommended);
  return list.filter((h) => h.category === category);
}

/**
 * Paste the complete helper code-block into the editor (user replaces placeholders).
 * @param {FormulaHelperDef} helper
 */
export function helperInsertSnippet(helper) {
  const name = String(helper?.name || '').trim();
  if (PROCESS_FORMULA_HELPER_CODEBLOCKS[name]) {
    return PROCESS_FORMULA_HELPER_CODEBLOCKS[name];
  }
  const sig = String(helper?.signature || name || '').trim();
  if (!sig.includes('(')) return sig || name;
  if (name === 'now' || name === 'uuid') return `${name}()`;
  return sig;
}

/** @typedef {'is_empty'|'is_not_empty'|'equals'|'not_equals'|'contains'|'starts_with'|'ends_with'|'gt'|'gte'|'lt'|'lte'|'is_email'|'is_phone'} SimpleConditionOp */

/** Operators shown in the guided (non-technical) condition builder */
export const SIMPLE_CONDITION_OPERATORS = [
  { value: 'is_empty', needsValue: false },
  { value: 'is_not_empty', needsValue: false },
  { value: 'equals', needsValue: true },
  { value: 'not_equals', needsValue: true },
  { value: 'contains', needsValue: true },
  { value: 'starts_with', needsValue: true },
  { value: 'ends_with', needsValue: true },
  { value: 'gt', needsValue: true },
  { value: 'gte', needsValue: true },
  { value: 'lt', needsValue: true },
  { value: 'lte', needsValue: true },
  { value: 'is_email', needsValue: false },
  { value: 'is_phone', needsValue: false }
];

/**
 * @param {unknown} value
 * @param {'text'|'field'|'empty'|'helper'} mode
 * @param {string} [fieldPath]
 */
export function quoteFormulaValue(value, mode = 'text', fieldPath = '') {
  if (mode === 'field') {
    const p = String(fieldPath || '').trim();
    return p || '""';
  }
  if (mode === 'empty') return '""';
  if (mode === 'helper') return '""';
  const raw = value == null ? '' : String(value);
  const trimmed = raw.trim();
  if (trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (trimmed === 'true' || trimmed === 'false') return trimmed;
  return JSON.stringify(raw);
}

/** Guided helpers for Then / Otherwise (plain-language). */
export const SIMPLE_RESULT_HELPERS = [
  { value: 'uppercase', arg: 'field' },
  { value: 'lowercase', arg: 'field' },
  { value: 'trim', arg: 'field' },
  { value: 'length', arg: 'field' },
  { value: 'today', arg: 'none' },
  { value: 'tomorrow', arg: 'none' },
  { value: 'yesterday', arg: 'none' },
  { value: 'now', arg: 'none' },
  { value: 'uuid', arg: 'none' },
  { value: 'add_days', arg: 'days' },
  { value: 'sub_days', arg: 'days' }
];

/**
 * Compile Then / Otherwise result expression.
 * @param {{
 *   mode?: 'text'|'field'|'helper',
 *   value?: string,
 *   field?: string,
 *   helper?: string,
 *   helperField?: string,
 *   helperArg?: string|number
 * }} result
 */
export function compileSimpleResultExpr(result) {
  const mode = String(result?.mode || 'text');
  if (mode === 'field') {
    return quoteFormulaValue(null, 'field', result?.field);
  }
  if (mode === 'helper') {
    const helper = String(result?.helper || '').trim();
    const field = String(result?.helperField || '').trim();
    const days = Number(result?.helperArg);
    const n = Number.isFinite(days) ? days : 0;
    switch (helper) {
      case 'uppercase':
      case 'lowercase':
      case 'trim':
      case 'length':
        return field ? `${helper}(${field})` : '""';
      case 'today':
      case 'tomorrow':
      case 'yesterday':
        return helper;
      case 'now':
        return 'now()';
      case 'uuid':
        return 'uuid()';
      case 'add_days':
        return `add_days(today, ${n})`;
      case 'sub_days':
        return `sub_days(today, ${n})`;
      default:
        return field || '""';
    }
  }
  return quoteFormulaValue(result?.value, 'text');
}

/**
 * @param {{
 *   field: string,
 *   op: SimpleConditionOp,
 *   value?: string,
 *   valueMode?: 'text'|'field'|'helper',
 *   valueField?: string,
 *   valueHelper?: string,
 *   valueHelperField?: string,
 *   valueHelperArg?: string|number
 * }} cond
 */
export function compileSimpleCondition(cond) {
  const field = String(cond?.field || '').trim();
  if (!field) return '';
  const op = String(cond?.op || 'is_not_empty');
  const rhs = compileSimpleResultExpr({
    mode: cond?.valueMode || 'text',
    value: cond?.value,
    field: cond?.valueField,
    helper: cond?.valueHelper,
    helperField: cond?.valueHelperField,
    helperArg: cond?.valueHelperArg
  });

  switch (op) {
    case 'is_empty':
      return `is_empty(${field})`;
    case 'is_not_empty':
      return `is_not_empty(${field})`;
    case 'is_email':
      return `is_email(${field})`;
    case 'is_phone':
      return `is_phone(${field})`;
    case 'equals':
      return `${field} == ${rhs}`;
    case 'not_equals':
      return `${field} != ${rhs}`;
    case 'contains':
      return `contains(${field}, ${rhs})`;
    case 'starts_with':
      return `starts_with(${field}, ${rhs})`;
    case 'ends_with':
      return `ends_with(${field}, ${rhs})`;
    case 'gt':
      return `${field} > ${rhs}`;
    case 'gte':
      return `${field} >= ${rhs}`;
    case 'lt':
      return `${field} < ${rhs}`;
    case 'lte':
      return `${field} <= ${rhs}`;
    default:
      return `is_not_empty(${field})`;
  }
}

/**
 * Build if(conditions, then, else) from guided form state.
 * @param {object} form
 */
export function compileSimpleIfExpression(form) {
  const parts = (form?.conditions || [])
    .map((c) => compileSimpleCondition(c))
    .filter(Boolean);
  if (!parts.length) return '';
  const join = form?.join === 'or' ? ' || ' : ' && ';
  const condExpr = parts.length === 1 ? parts[0] : `(${parts.join(join)})`;
  const thenExpr = compileSimpleResultExpr({
    mode: form?.thenMode,
    value: form?.thenValue,
    field: form?.thenField,
    helper: form?.thenHelper,
    helperField: form?.thenHelperField,
    helperArg: form?.thenHelperArg
  });
  const elseExpr = compileSimpleResultExpr({
    mode: form?.elseMode,
    value: form?.elseValue,
    field: form?.elseField,
    helper: form?.elseHelper,
    helperField: form?.elseHelperField,
    helperArg: form?.elseHelperArg
  });
  return `if(${condExpr}, ${thenExpr}, ${elseExpr})`;
}
