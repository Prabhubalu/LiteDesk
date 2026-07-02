'use strict';

const { parseFilterQueryParam } = require('../../utils/filterQueryCompiler');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeFilterAst(raw) {
  return parseFilterQueryParam(raw);
}

function getAstVersion(ast) {
  if (!ast || !isPlainObject(ast)) return 1;
  const version = parseInt(String(ast.version || '1'), 10);
  return Number.isFinite(version) && version >= 2 ? 2 : 1;
}

function isLegacyAst(ast) {
  return getAstVersion(ast) < 2;
}

function getPrimaryEntity(ast) {
  if (!ast?.primaryEntity?.moduleKey) {
    return { appKey: 'sales', moduleKey: 'people' };
  }
  return {
    appKey: String(ast.primaryEntity.appKey || 'sales').toLowerCase(),
    moduleKey: String(ast.primaryEntity.moduleKey || 'people').toLowerCase()
  };
}

function wrapLegacyAst(ast) {
  if (!ast) return null;
  if (getAstVersion(ast) >= 2) return ast;
  return {
    version: 1,
    primaryEntity: { appKey: 'sales', moduleKey: 'people' },
    logic: String(ast.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
    children: Array.isArray(ast.children) ? ast.children : []
  };
}

function normalizeV2Ast(ast) {
  const parsed = normalizeFilterAst(ast);
  if (!parsed) return null;
  if (isLegacyAst(parsed)) {
    return wrapLegacyAst(parsed);
  }
  return {
    version: 2,
    primaryEntity: getPrimaryEntity(parsed),
    logic: String(parsed.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
    children: Array.isArray(parsed.children) ? parsed.children : []
  };
}

function detectNodeType(node) {
  if (!node || !isPlainObject(node)) return null;
  if (node.type) return String(node.type);
  if (node.fieldKey) return 'field';
  if (node.relationshipPath || node.type === 'relationship') return 'relationship';
  if (node.function && node.type === 'aggregate') return 'aggregate';
  if (Array.isArray(node.children) && (node.logic === 'AND' || node.logic === 'OR')) return 'group';
  if (Array.isArray(node.children)) return 'group';
  return null;
}

module.exports = {
  normalizeFilterAst,
  getAstVersion,
  isLegacyAst,
  getPrimaryEntity,
  wrapLegacyAst,
  normalizeV2Ast,
  detectNodeType
};
