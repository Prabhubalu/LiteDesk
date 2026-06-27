'use strict';

const { isGrapesTemplateDefinition } = require('../../constants/grapesTemplateDefinition');
const {
  isRegisteredContentComponentType,
  isRootContentComponentType
} = require('../../constants/contentComponentRegistry');
const {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError
} = require('../../utils/contentPlatformErrors');

/**
 * @typedef {object} ValidationIssue
 * @property {'error'|'warning'|'suggestion'} severity
 * @property {string} code
 * @property {string} message
 * @property {string} [componentId]
 * @property {string} [path]
 */

/**
 * @param {unknown} component
 * @param {string} path
 * @param {ValidationIssue[]} issues
 */
function validateComponentNode(component, path, issues) {
  if (!component || typeof component !== 'object' || Array.isArray(component)) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'Component must be an object',
      path
    });
    return;
  }

  const node = /** @type {Record<string, unknown>} */ (component);
  const id = typeof node.id === 'string' ? node.id.trim() : '';
  const type = typeof node.type === 'string' ? node.type.trim() : '';

  if (!id) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'Component id is required',
      path: `${path}.id`
    });
  }

  if (!type) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'Component type is required',
      path: `${path}.type`,
      componentId: id || undefined
    });
    return;
  }

  if (!isRegisteredContentComponentType(type)) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: `Unsupported component type: ${type}`,
      path: `${path}.type`,
      componentId: id || undefined
    });
  }

  if (node.layout != null && (typeof node.layout !== 'object' || Array.isArray(node.layout))) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'Component layout must be an object',
      path: `${path}.layout`,
      componentId: id || undefined
    });
  }

  if (node.style != null && (typeof node.style !== 'object' || Array.isArray(node.style))) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'Component style must be an object',
      path: `${path}.style`,
      componentId: id || undefined
    });
  }

  if (node.bindings != null && (typeof node.bindings !== 'object' || Array.isArray(node.bindings))) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'Component bindings must be an object',
      path: `${path}.bindings`,
      componentId: id || undefined
    });
  }

  if (node.visibility != null && (typeof node.visibility !== 'object' || Array.isArray(node.visibility))) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'Component visibility must be an object',
      path: `${path}.visibility`,
      componentId: id || undefined
    });
  }

  const children = node.children;
  if (children == null) {
    return;
  }

  if (!Array.isArray(children)) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'Component children must be an array',
      path: `${path}.children`,
      componentId: id || undefined
    });
    return;
  }

  children.forEach((child, index) => {
    validateComponentNode(child, `${path}.children[${index}]`, issues);
  });
}

/**
 * @param {unknown} jsonDefinition
 * @param {ValidationIssue[]} issues
 */
function validateGrapesTemplateDefinition(jsonDefinition, issues) {
  const node = /** @type {Record<string, unknown>} */ (jsonDefinition);

  if (node.version != null && typeof node.version !== 'number') {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'GrapesJS definition version must be a number',
      path: 'jsonDefinition.version'
    });
  }

  if (
    node.project != null
    && (typeof node.project !== 'object' || Array.isArray(node.project))
  ) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'GrapesJS project must be an object or null',
      path: 'jsonDefinition.project'
    });
  }

  if (node.html != null && typeof node.html !== 'string') {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'GrapesJS html must be a string',
      path: 'jsonDefinition.html'
    });
  }

  if (node.css != null && typeof node.css !== 'string') {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'GrapesJS css must be a string',
      path: 'jsonDefinition.css'
    });
  }
}

/**
 * @param {unknown} jsonDefinition
 * @returns {{ valid: boolean, errors: ValidationIssue[], warnings: ValidationIssue[], suggestions: ValidationIssue[] }}
 */
function validateTemplateDefinition(jsonDefinition) {
  const issues = /** @type {ValidationIssue[]} */ ([]);

  if (isGrapesTemplateDefinition(jsonDefinition)) {
    validateGrapesTemplateDefinition(jsonDefinition, issues);
    const errors = issues.filter((issue) => issue.severity === 'error');
    const warnings = issues.filter((issue) => issue.severity === 'warning');
    const suggestions = issues.filter((issue) => issue.severity === 'suggestion');
    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  if (!jsonDefinition || typeof jsonDefinition !== 'object' || Array.isArray(jsonDefinition)) {
    issues.push({
      severity: 'error',
      code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
      message: 'Template definition must be a root component object',
      path: 'jsonDefinition'
    });
  } else {
    validateComponentNode(jsonDefinition, 'jsonDefinition', issues);

    const rootType = typeof jsonDefinition.type === 'string' ? jsonDefinition.type : '';
    if (rootType && !isRootContentComponentType(rootType)) {
      issues.push({
        severity: 'error',
        code: CONTENT_PLATFORM_ERROR_CODES.INVALID_COMPONENT,
        message: `Root component must be one of: Page`,
        path: 'jsonDefinition.type'
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const suggestions = issues.filter((issue) => issue.severity === 'suggestion');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

/**
 * @param {unknown} jsonDefinition
 */
function assertValidTemplateDefinition(jsonDefinition) {
  const result = validateTemplateDefinition(jsonDefinition);
  if (!result.valid) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Template definition validation failed',
      { statusCode: 400, details: result.errors }
    );
  }
  return result;
}

module.exports = {
  validateTemplateDefinition,
  assertValidTemplateDefinition
};
