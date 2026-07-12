'use strict';

/**
 * Process Formula Builder — helper catalog + implementations.
 * Spec: Formula_Builder_Helper_Library.md
 */

const crypto = require('crypto');

function isNull(v) {
  return v === null || v === undefined;
}

function isEmpty(v) {
  if (isNull(v)) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function toStr(v) {
  if (isNull(v)) return '';
  return String(v);
}

function toNum(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
}

function parseDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return new Date(v.getTime());
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v || '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

function addCalendarDays(date, days) {
  const d = parseDate(date);
  if (!d) return null;
  const n = toNum(days);
  d.setDate(d.getDate() + (Number.isFinite(n) ? n : 0));
  return d;
}

function addWeekdays(date, days) {
  const d = parseDate(date);
  if (!d) return null;
  let remaining = Math.trunc(toNum(days) || 0);
  if (!Number.isFinite(remaining)) return d;
  // Cap runaway loops (customer typos with huge day counts)
  if (Math.abs(remaining) > 36600) remaining = remaining > 0 ? 36600 : -36600;
  const step = remaining >= 0 ? 1 : -1;
  remaining = Math.abs(remaining);
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) remaining -= 1;
  }
  return d;
}

function addMonths(date, months) {
  const d = parseDate(date);
  if (!d) return null;
  const n = toNum(months);
  d.setMonth(d.getMonth() + (Number.isFinite(n) ? n : 0));
  return d;
}

function addYears(date, years) {
  const d = parseDate(date);
  if (!d) return null;
  const n = toNum(years);
  d.setFullYear(d.getFullYear() + (Number.isFinite(n) ? n : 0));
  return d;
}

function addMinutes(date, minutes) {
  const d = parseDate(date);
  if (!d) return null;
  const n = toNum(minutes);
  d.setMinutes(d.getMinutes() + (Number.isFinite(n) ? n : 0));
  return d;
}

function weekdayCountBetween(a, b) {
  const start = startOfDay(parseDate(a));
  const end = startOfDay(parseDate(b));
  if (!start || !end) return null;
  let from = start;
  let to = end;
  let sign = 1;
  if (from > to) {
    from = end;
    to = start;
    sign = -1;
  }
  let count = 0;
  const cur = new Date(from.getTime());
  // Cap iteration (~100 years)
  let guard = 0;
  while (cur < to && guard < 36600) {
    cur.setDate(cur.getDate() + 1);
    guard += 1;
    const wd = cur.getDay();
    if (wd !== 0 && wd !== 6) count += 1;
  }
  return count * sign;
}

function formatDateToken(date, format) {
  const d = parseDate(date);
  if (!d) return '';
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const map = {
    YYYY: String(d.getFullYear()),
    YY: String(d.getFullYear()).slice(-2),
    MM: pad(d.getMonth() + 1),
    M: String(d.getMonth() + 1),
    DD: pad(d.getDate()),
    D: String(d.getDate()),
    HH: pad(d.getHours()),
    H: String(d.getHours()),
    mm: pad(d.getMinutes()),
    m: String(d.getMinutes()),
    ss: pad(d.getSeconds()),
    s: String(d.getSeconds())
  };
  let out = String(format || 'YYYY-MM-DD');
  // Replace longer tokens first
  for (const token of ['YYYY', 'YY', 'MM', 'DD', 'HH', 'mm', 'ss', 'M', 'D', 'H', 'm', 's']) {
    if (map[token] != null) out = out.split(token).join(map[token]);
  }
  return out;
}

function finiteOrNull(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;

/** @type {Record<string, (...args: unknown[]) => unknown>} */
const HELPERS = {
  // —— String ——
  concat: (...args) => args.map(toStr).join(''),
  substring: (field, start, length) => {
    const s = toStr(field);
    const i = Math.trunc(toNum(start)) || 0;
    if (length === undefined || length === null || length === '') return s.slice(i);
    return s.slice(i, i + (Math.trunc(toNum(length)) || 0));
  },
  lowercase: (field) => toStr(field).toLowerCase(),
  uppercase: (field) => toStr(field).toUpperCase(),
  replace: (field, search, replacement) => {
    const s = toStr(field);
    const find = toStr(search);
    // Empty search would split every character — treat as no-op replace
    if (find === '') return s;
    return s.split(find).join(toStr(replacement));
  },
  extract_before: (field, delimiter) => {
    const s = toStr(field);
    const d = toStr(delimiter);
    const idx = s.indexOf(d);
    return idx < 0 ? s : s.slice(0, idx);
  },
  extract_after: (field, delimiter) => {
    const s = toStr(field);
    const d = toStr(delimiter);
    const idx = s.indexOf(d);
    return idx < 0 ? '' : s.slice(idx + d.length);
  },
  trim: (field) => toStr(field).trim(),
  length: (field) => toStr(field).length,
  contains: (field, value) => toStr(field).includes(toStr(value)),
  starts_with: (field, value) => toStr(field).startsWith(toStr(value)),
  ends_with: (field, value) => toStr(field).endsWith(toStr(value)),

  // —— Date & Time ——
  today: () => formatDateToken(new Date(), 'YYYY-MM-DD'),
  today_datetime: () => new Date().toISOString(),
  tomorrow: () => formatDateToken(addCalendarDays(new Date(), 1), 'YYYY-MM-DD'),
  yesterday: () => formatDateToken(addCalendarDays(new Date(), -1), 'YYYY-MM-DD'),
  add_days: (date, days) => {
    const d = addCalendarDays(date, days);
    return d ? d.toISOString() : null;
  },
  sub_days: (date, days) => HELPERS.add_days(date, -(toNum(days) || 0)),
  add_weekdays: (date, days) => {
    const d = addWeekdays(date, days);
    return d ? d.toISOString() : null;
  },
  sub_weekdays: (date, days) => HELPERS.add_weekdays(date, -(toNum(days) || 0)),
  add_month: (date, months) => {
    const d = addMonths(date, months);
    return d ? d.toISOString() : null;
  },
  sub_month: (date, months) => HELPERS.add_month(date, -(toNum(months) || 0)),
  add_year: (date, years) => {
    const d = addYears(date, years);
    return d ? d.toISOString() : null;
  },
  sub_year: (date, years) => HELPERS.add_year(date, -(toNum(years) || 0)),
  add_time: (timefield, minutes) => {
    const d = addMinutes(timefield, minutes);
    return d ? d.toISOString() : null;
  },
  sub_time: (timefield, minutes) => HELPERS.add_time(timefield, -(toNum(minutes) || 0)),
  time_diff: (a, b) => {
    const da = parseDate(a);
    const db = b === undefined || b === null || b === '' ? new Date() : parseDate(b);
    if (!da || !db) return null;
    return Math.round((db.getTime() - da.getTime()) / 60000);
  },
  time_diffdays: (a, b) => {
    const da = parseDate(a);
    const db = b === undefined || b === null || b === '' ? new Date() : parseDate(b);
    if (!da || !db) return null;
    const sa = startOfDay(da);
    const sb = startOfDay(db);
    if (!sa || !sb) return null;
    return Math.round((sb.getTime() - sa.getTime()) / 86400000);
  },
  time_diffweekdays: (a, b) => {
    const db = b === undefined || b === null || b === '' ? new Date() : b;
    return weekdayCountBetween(a, db);
  },
  day_of_date: (date) => {
    const d = parseDate(date);
    return d ? d.getDate() : null;
  },
  date_format: (date, format) => formatDateToken(date, format),
  now: () => new Date().toISOString(),
  month: (date) => {
    const d = parseDate(date);
    return d ? d.getMonth() + 1 : null;
  },
  year: (date) => {
    const d = parseDate(date);
    return d ? d.getFullYear() : null;
  },
  weekday: (date) => {
    const d = parseDate(date);
    return d ? d.getDay() : null;
  },

  // —— Math ——
  power: (base, exponent) => finiteOrNull(Math.pow(toNum(base), toNum(exponent))),
  roundoff: (number, precision) => {
    const p = Math.trunc(toNum(precision));
    const n = toNum(number);
    if (!Number.isFinite(n)) return null;
    if (!Number.isFinite(p) || p < 0) return finiteOrNull(Math.round(n));
    if (p > 12) return finiteOrNull(Math.round(n));
    const f = 10 ** p;
    return finiteOrNull(Math.round(n * f) / f);
  },
  abs: (number) => finiteOrNull(Math.abs(toNum(number))),
  ceil: (number) => finiteOrNull(Math.ceil(toNum(number))),
  floor: (number) => finiteOrNull(Math.floor(toNum(number))),
  sqrt: (number) => {
    const n = toNum(number);
    if (!Number.isFinite(n) || n < 0) return null;
    return finiteOrNull(Math.sqrt(n));
  },
  min: (...args) => {
    const nums = args.map(toNum).filter((n) => Number.isFinite(n));
    return nums.length ? Math.min(...nums) : null;
  },
  max: (...args) => {
    const nums = args.map(toNum).filter((n) => Number.isFinite(n));
    return nums.length ? Math.max(...nums) : null;
  },
  mod: (a, b) => {
    const x = toNum(a);
    const y = toNum(b);
    if (!Number.isFinite(x) || !Number.isFinite(y) || y === 0) return null;
    return finiteOrNull(x % y);
  },

  // —— Conditional ——
  if: (condition, trueValue, falseValue) => (truthy(condition) ? trueValue : falseValue),
  if_else_ladder: (...args) => {
    if (args.length === 0) return null;
    for (let i = 0; i + 1 < args.length; i += 2) {
      if (truthy(args[i])) return args[i + 1];
    }
    return args.length % 2 === 1 ? args[args.length - 1] : null;
  },
  switch: (value, ...rest) => {
    for (let i = 0; i + 1 < rest.length; i += 2) {
      if (String(value) === String(rest[i])) return rest[i + 1];
    }
    return rest.length % 2 === 1 ? rest[rest.length - 1] : null;
  },
  coalesce: (...args) => {
    for (const a of args) {
      if (!isEmpty(a)) return a;
    }
    return null;
  },
  is_empty: (value) => isEmpty(value),
  is_not_empty: (value) => !isEmpty(value),
  is_null: (value) => isNull(value),
  is_not_null: (value) => !isNull(value),

  // —— Logical ——
  and: (...args) => args.every(truthy),
  or: (...args) => args.some(truthy),
  not: (condition) => !truthy(condition),
  xor: (a, b) => truthy(a) !== truthy(b),

  // —— Validation ——
  is_email: (value) => EMAIL_RE.test(toStr(value).trim()),
  is_phone: (value) => PHONE_RE.test(toStr(value).trim()),
  is_numeric: (value) => Number.isFinite(toNum(value)) && String(value).trim() !== '',
  is_date: (value) => parseDate(value) != null,
  is_boolean: (value) => typeof value === 'boolean' || value === 'true' || value === 'false',

  // —— Utility ——
  uuid: () =>
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex'),
  to_string: (value) => toStr(value),
  to_number: (value) => {
    const n = toNum(value);
    return Number.isFinite(n) ? n : null;
  },
  to_date: (value) => {
    const d = parseDate(value);
    return d ? formatDateToken(d, 'YYYY-MM-DD') : null;
  },
  to_datetime: (value) => {
    const d = parseDate(value);
    return d ? d.toISOString() : null;
  }
};

// Aliases
HELPERS.upper = HELPERS.uppercase;
HELPERS.lower = HELPERS.lowercase;

function truthy(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  if (isNull(v)) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === '' || s === 'false' || s === '0' || s === 'null') return false;
    return true;
  }
  return Boolean(v);
}

/** Zero-arg / bare constants */
const CONSTANTS = new Set([
  'today',
  'today_datetime',
  'tomorrow',
  'yesterday',
  'now'
]);

/**
 * UI + docs catalog (68 helpers).
 * @type {Array<{ name: string, category: string, description: string, signature: string, recommended?: boolean }>}
 */
const FORMULA_HELPER_CATALOG = [
  // String
  { name: 'concat', category: 'string', signature: 'concat(...)', description: 'Combines two or more text values into a single string.' },
  { name: 'substring', category: 'string', signature: 'substring(field, start, length)', description: 'Extracts a portion of text from the specified position for the given length.' },
  { name: 'lowercase', category: 'string', signature: 'lowercase(field)', description: 'Converts all characters in a string to lowercase.' },
  { name: 'uppercase', category: 'string', signature: 'uppercase(field)', description: 'Converts all characters in a string to uppercase.' },
  { name: 'replace', category: 'string', signature: 'replace(field, search, replace)', description: 'Replaces all occurrences of the search text with the replacement text.' },
  { name: 'extract_before', category: 'string', signature: 'extract_before(field, delimiter)', description: 'Returns everything before the specified delimiter.' },
  { name: 'extract_after', category: 'string', signature: 'extract_after(field, delimiter)', description: 'Returns everything after the specified delimiter.' },
  { name: 'trim', category: 'string', signature: 'trim(field)', description: 'Removes leading and trailing whitespace.', recommended: true },
  { name: 'length', category: 'string', signature: 'length(field)', description: 'Returns the number of characters in a string.', recommended: true },
  { name: 'contains', category: 'string', signature: 'contains(field, value)', description: 'Returns true if the string contains the specified value.', recommended: true },
  { name: 'starts_with', category: 'string', signature: 'starts_with(field, value)', description: 'Checks whether a string starts with the specified value.', recommended: true },
  { name: 'ends_with', category: 'string', signature: 'ends_with(field, value)', description: 'Checks whether a string ends with the specified value.', recommended: true },
  // Date
  { name: 'today', category: 'date', signature: 'today', description: "Returns today's date." },
  { name: 'today_datetime', category: 'date', signature: 'today_datetime', description: 'Returns the current date and time.' },
  { name: 'tomorrow', category: 'date', signature: 'tomorrow', description: "Returns tomorrow's date." },
  { name: 'yesterday', category: 'date', signature: 'yesterday', description: "Returns yesterday's date." },
  { name: 'add_days', category: 'date', signature: 'add_days(date, days)', description: 'Adds the specified number of calendar days to a date.' },
  { name: 'sub_days', category: 'date', signature: 'sub_days(date, days)', description: 'Subtracts calendar days from a date.' },
  { name: 'add_weekdays', category: 'date', signature: 'add_weekdays(date, days)', description: 'Adds business days while skipping weekends.' },
  { name: 'sub_weekdays', category: 'date', signature: 'sub_weekdays(date, days)', description: 'Subtracts business days while skipping weekends.' },
  { name: 'add_month', category: 'date', signature: 'add_month(date, months)', description: 'Adds months to a date.' },
  { name: 'sub_month', category: 'date', signature: 'sub_month(date, months)', description: 'Subtracts months from a date.' },
  { name: 'add_year', category: 'date', signature: 'add_year(date, years)', description: 'Adds years to a date.' },
  { name: 'sub_year', category: 'date', signature: 'sub_year(date, years)', description: 'Subtracts years from a date.' },
  { name: 'add_time', category: 'date', signature: 'add_time(timefield, minutes)', description: 'Adds minutes to a time or datetime value.' },
  { name: 'sub_time', category: 'date', signature: 'sub_time(timefield, minutes)', description: 'Subtracts minutes from a time or datetime value.' },
  { name: 'time_diff', category: 'date', signature: 'time_diff(a, b?)', description: 'Returns the time difference in minutes between two datetimes (or vs now).' },
  { name: 'time_diffdays', category: 'date', signature: 'time_diffdays(a, b?)', description: 'Returns the number of calendar days between two dates (or vs today).' },
  { name: 'time_diffweekdays', category: 'date', signature: 'time_diffweekdays(a, b?)', description: 'Returns the number of business days between two dates (or vs today).' },
  { name: 'day_of_date', category: 'date', signature: 'day_of_date(date)', description: 'Returns the day of the month from a date.' },
  { name: 'date_format', category: 'date', signature: 'date_format(date, format)', description: 'Formats a date using tokens like YYYY-MM-DD HH:mm.' },
  { name: 'now', category: 'date', signature: 'now()', description: 'Returns the current date and time.', recommended: true },
  { name: 'month', category: 'date', signature: 'month(date)', description: 'Returns the month number.', recommended: true },
  { name: 'year', category: 'date', signature: 'year(date)', description: 'Returns the year number.', recommended: true },
  { name: 'weekday', category: 'date', signature: 'weekday(date)', description: 'Returns the day of the week (0=Sun … 6=Sat).', recommended: true },
  // Math
  { name: 'power', category: 'math', signature: 'power(base, exponent)', description: 'Raises a number to the specified exponent.' },
  { name: 'roundoff', category: 'math', signature: 'roundoff(number, precision)', description: 'Rounds a number to the specified decimal precision.' },
  { name: 'abs', category: 'math', signature: 'abs(number)', description: 'Returns the absolute value.', recommended: true },
  { name: 'ceil', category: 'math', signature: 'ceil(number)', description: 'Rounds a number up.', recommended: true },
  { name: 'floor', category: 'math', signature: 'floor(number)', description: 'Rounds a number down.', recommended: true },
  { name: 'sqrt', category: 'math', signature: 'sqrt(number)', description: 'Returns the square root.', recommended: true },
  { name: 'min', category: 'math', signature: 'min(...)', description: 'Returns the smallest value.', recommended: true },
  { name: 'max', category: 'math', signature: 'max(...)', description: 'Returns the largest value.', recommended: true },
  { name: 'mod', category: 'math', signature: 'mod(a, b)', description: 'Returns the remainder after division.', recommended: true },
  // Conditional
  { name: 'if', category: 'conditional', signature: 'if(condition, trueValue, falseValue)', description: 'Returns one value when the condition is true, otherwise another.', recommended: true },
  { name: 'if_else_ladder', category: 'conditional', signature: 'if_else_ladder(cond, val, ..., default?)', description: 'Evaluates multiple conditions sequentially and returns the first matching result.' },
  { name: 'switch', category: 'conditional', signature: 'switch(value, case, result, ..., default?)', description: 'Matches a value against multiple cases and returns the corresponding result.', recommended: true },
  { name: 'coalesce', category: 'conditional', signature: 'coalesce(value1, value2, ...)', description: 'Returns the first non-empty or non-null value.', recommended: true },
  { name: 'is_empty', category: 'conditional', signature: 'is_empty(value)', description: 'Returns true if the value is empty.', recommended: true },
  { name: 'is_not_empty', category: 'conditional', signature: 'is_not_empty(value)', description: 'Returns true if the value contains data.', recommended: true },
  { name: 'is_null', category: 'conditional', signature: 'is_null(value)', description: 'Returns true if the value is null.', recommended: true },
  { name: 'is_not_null', category: 'conditional', signature: 'is_not_null(value)', description: 'Returns true if the value is not null.', recommended: true },
  // Logical
  { name: 'and', category: 'logical', signature: 'and(condition1, condition2, ...)', description: 'Returns true only if all conditions are true.', recommended: true },
  { name: 'or', category: 'logical', signature: 'or(condition1, condition2, ...)', description: 'Returns true if at least one condition is true.', recommended: true },
  { name: 'not', category: 'logical', signature: 'not(condition)', description: 'Reverses the result of a condition.', recommended: true },
  { name: 'xor', category: 'logical', signature: 'xor(condition1, condition2)', description: 'Returns true when exactly one condition is true.', recommended: true },
  // Validation
  { name: 'is_email', category: 'validation', signature: 'is_email(value)', description: 'Validates whether the value is a valid email address.', recommended: true },
  { name: 'is_phone', category: 'validation', signature: 'is_phone(value)', description: 'Validates whether the value is a valid phone number.', recommended: true },
  { name: 'is_numeric', category: 'validation', signature: 'is_numeric(value)', description: 'Returns true if the value is numeric.', recommended: true },
  { name: 'is_date', category: 'validation', signature: 'is_date(value)', description: 'Returns true if the value is a valid date.', recommended: true },
  { name: 'is_boolean', category: 'validation', signature: 'is_boolean(value)', description: 'Returns true if the value is a boolean.', recommended: true },
  // Utility
  { name: 'uuid', category: 'utility', signature: 'uuid()', description: 'Generates a UUID.' },
  { name: 'to_string', category: 'utility', signature: 'to_string(value)', description: 'Converts a value to text.', recommended: true },
  { name: 'to_number', category: 'utility', signature: 'to_number(value)', description: 'Converts a value to a number.', recommended: true },
  { name: 'to_date', category: 'utility', signature: 'to_date(value)', description: 'Converts a value to a date (YYYY-MM-DD).', recommended: true },
  { name: 'to_datetime', category: 'utility', signature: 'to_datetime(value)', description: 'Converts a value to a datetime (ISO).', recommended: true }
];

function callHelper(name, args) {
  const key = String(name || '').trim().toLowerCase();
  const fn = HELPERS[key];
  if (typeof fn !== 'function') {
    throw new Error(`Unknown helper: ${name}`);
  }
  try {
    return fn(...(Array.isArray(args) ? args : []));
  } catch (err) {
    // Never let a helper throw into process execution
    return null;
  }
}

module.exports = {
  HELPERS,
  FORMULA_HELPER_CATALOG,
  CONSTANTS,
  callHelper,
  isEmpty,
  isNull,
  toStr,
  toNum,
  parseDate,
  truthy
};
