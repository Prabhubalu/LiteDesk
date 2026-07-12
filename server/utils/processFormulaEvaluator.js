'use strict';

/**
 * Safe formula expression evaluator (no eval).
 * Supports: literals, dotted field paths, helper calls, comparisons, && || !
 */

const {
  callHelper,
  CONSTANTS,
  HELPERS,
  truthy
} = require('./processFormulaHelpers');

class FormulaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormulaError';
  }
}

function tokenize(input) {
  const s = String(input || '');
  const tokens = [];
  let i = 0;

  const push = (type, value) => tokens.push({ type, value });

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      let str = '';
      while (i < s.length && s[i] !== quote) {
        if (s[i] === '\\' && i + 1 < s.length) {
          str += s[i + 1];
          i += 2;
          continue;
        }
        str += s[i];
        i += 1;
      }
      if (i >= s.length) throw new FormulaError('Unterminated string');
      i += 1;
      push('string', str);
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < s.length && /[0-9]/.test(s[i + 1]))) {
      let num = '';
      while (i < s.length && /[0-9.]/.test(s[i])) {
        num += s[i];
        i += 1;
      }
      const n = Number(num);
      if (!Number.isFinite(n)) throw new FormulaError(`Invalid number: ${num}`);
      push('number', n);
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let id = '';
      while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) {
        id += s[i];
        i += 1;
      }
      // dotted path continuation: trigger.first_name
      while (i < s.length && s[i] === '.' && i + 1 < s.length && /[A-Za-z_]/.test(s[i + 1])) {
        id += '.';
        i += 1;
        while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) {
          id += s[i];
          i += 1;
        }
      }
      const lower = id.toLowerCase();
      if (lower === 'true') push('boolean', true);
      else if (lower === 'false') push('boolean', false);
      else if (lower === 'null') push('null', null);
      else push('ident', id);
      continue;
    }

    const two = s.slice(i, i + 2);
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) {
      push('op', two);
      i += 2;
      continue;
    }
    if ('><!+-*/%,()'.includes(ch)) {
      push('op', ch);
      i += 1;
      continue;
    }

    throw new FormulaError(`Unexpected character: ${ch}`);
  }

  push('eof', null);
  return tokens;
}

function getByPath(obj, path) {
  if (obj == null || path == null || path === '') return undefined;
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function resolveIdent(name, scope) {
  const raw = String(name || '');
  const lower = raw.toLowerCase();

  if (CONSTANTS.has(lower) && typeof HELPERS[lower] === 'function') {
    return HELPERS[lower]();
  }

  if (lower === 'entityid' || lower === 'trigger.id') return scope.entityId;

  if (raw.startsWith('dataBag.')) return getByPath(scope.dataBag, raw.slice('dataBag.'.length));
  if (raw.startsWith('event.currentState.')) {
    return getByPath(scope.currentState, raw.slice('event.currentState.'.length));
  }
  if (raw.startsWith('event.')) return getByPath(scope.event, raw.slice('event.'.length));
  if (raw.startsWith('trigger.')) return getByPath(scope.trigger, raw.slice('trigger.'.length));
  if (raw.startsWith('record.')) return getByPath(scope.record, raw.slice('record.'.length));

  return (
    getByPath(scope.trigger, raw) ??
    getByPath(scope.currentState, raw) ??
    getByPath(scope.dataBag, raw)
  );
}

function createParser(tokens, scope) {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = (type, value) => {
    const t = peek();
    if (!t || t.type === 'eof') throw new FormulaError('Unexpected end of expression');
    if (type && t.type !== type) throw new FormulaError(`Expected ${type}, got ${t.type}`);
    if (value !== undefined && t.value !== value) {
      throw new FormulaError(`Expected ${value}, got ${t.value}`);
    }
    pos += 1;
    return t;
  };

  function parseArgs() {
    const args = [];
    if (peek().type === 'op' && peek().value === ')') return args;
    args.push(parseOr());
    while (peek().type === 'op' && peek().value === ',') {
      consume('op', ',');
      args.push(parseOr());
    }
    return args;
  }

  function parsePrimary() {
    const t = peek();
    if (t.type === 'number' || t.type === 'string' || t.type === 'boolean') {
      pos += 1;
      return t.value;
    }
    if (t.type === 'null') {
      pos += 1;
      return null;
    }
    if (t.type === 'op' && t.value === '(') {
      consume('op', '(');
      const v = parseOr();
      consume('op', ')');
      return v;
    }
    if (t.type === 'ident') {
      const name = t.value;
      pos += 1;
      if (peek().type === 'op' && peek().value === '(') {
        consume('op', '(');
        const args = parseArgs();
        consume('op', ')');
        const fnName = String(name).split('.').pop();
        return callHelper(fnName, args);
      }
      return resolveIdent(name, scope);
    }
    throw new FormulaError(`Unexpected token: ${t.type} ${t.value}`);
  }

  function parseUnary() {
    const t = peek();
    if (t.type === 'op' && t.value === '!') {
      consume('op', '!');
      return !truthy(parseUnary());
    }
    if (t.type === 'op' && t.value === '-') {
      consume('op', '-');
      return -Number(parseUnary());
    }
    if (t.type === 'op' && t.value === '+') {
      consume('op', '+');
      return Number(parseUnary());
    }
    return parsePrimary();
  }

  function parseMul() {
    let left = parseUnary();
    while (peek().type === 'op' && '*/%'.includes(peek().value)) {
      const op = consume('op').value;
      const right = parseUnary();
      const a = Number(left);
      const b = Number(right);
      if (op === '*') left = a * b;
      else if (op === '/') left = b === 0 ? null : a / b;
      else left = b === 0 ? null : a % b;
    }
    return left;
  }

  function parseAdd() {
    let left = parseMul();
    while (peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume('op').value;
      const right = parseMul();
      // String concat when either side is string and op is +
      if (op === '+' && (typeof left === 'string' || typeof right === 'string')) {
        left = String(left ?? '') + String(right ?? '');
      } else {
        const a = Number(left);
        const b = Number(right);
        left = op === '+' ? a + b : a - b;
      }
    }
    return left;
  }

  function parseCmp() {
    let left = parseAdd();
    const t = peek();
    if (t.type === 'op' && ['==', '!=', '>', '<', '>=', '<='].includes(t.value)) {
      const op = consume('op').value;
      const right = parseAdd();
      switch (op) {
        case '==':
          return String(left) === String(right);
        case '!=':
          return String(left) !== String(right);
        case '>':
          return Number(left) > Number(right);
        case '<':
          return Number(left) < Number(right);
        case '>=':
          return Number(left) >= Number(right);
        case '<=':
          return Number(left) <= Number(right);
        default:
          return false;
      }
    }
    return left;
  }

  function parseAnd() {
    let left = parseCmp();
    while (peek().type === 'op' && peek().value === '&&') {
      consume('op', '&&');
      const right = parseCmp();
      left = truthy(left) && truthy(right);
    }
    return left;
  }

  function parseOr() {
    let left = parseAnd();
    while (peek().type === 'op' && peek().value === '||') {
      consume('op', '||');
      const right = parseAnd();
      left = truthy(left) || truthy(right);
    }
    return left;
  }

  function parse() {
    if (peek().type === 'eof') throw new FormulaError('Empty expression');
    const value = parseOr();
    if (peek().type !== 'eof') {
      throw new FormulaError(`Unexpected token after expression: ${peek().value}`);
    }
    return value;
  }

  return { parse };
}

/**
 * @param {string} expression
 * @param {object} scope - from processFieldValueResolver.buildScope
 * @returns {unknown}
 */
function evaluateFormula(expression, scope = {}) {
  const tokens = tokenize(expression);
  return createParser(tokens, scope).parse();
}

/**
 * Whether text looks like a formula (vs plain prose after mergetag expand).
 */
function looksLikeFormula(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/^[A-Za-z_][\w.]*\s*\(/.test(s)) return true;
  if (/^(true|false|null|-?\d+(\.\d+)?)$/i.test(s)) return true;
  if (/^["']/.test(s)) return true;
  if (CONSTANTS.has(s.toLowerCase())) return true;
  // dotted path only
  if (/^[A-Za-z_][\w.]*$/.test(s) && s.includes('.')) return true;
  if (/[+\-*/%<>=!&|]/.test(s) && /[A-Za-z_("']/.test(s)) return true;
  return false;
}

module.exports = {
  evaluateFormula,
  looksLikeFormula,
  FormulaError,
  tokenize
};
